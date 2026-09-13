"""
Live data API for the safety model — one place that fetches every external
signal, with on-disk caching so repeat runs are fast and offline runs still work.

Sources (all free, no API key required):
  * METAR weather ....... Iowa State IEM ASOS archive  (visibility, haze, thunderstorm, wind)
  * ENSO / El Nino ...... NOAA CPC Oceanic Nino Index
  * Bird activity ....... GBIF occurrence API (Aves observations, Philippines)

Usage
    from data_sources import refresh_all, get_weather, get_enso, get_birds
    data = refresh_all()                 # pulls/refreshes everything
    wx   = get_weather(["RPLL","RPMZ"])  # daily weather frame

    python data_sources.py               # CLI: refresh + print a status report
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timedelta
from io import StringIO
from pathlib import Path

import pandas as pd
import requests

CACHE_DIR = Path(__file__).resolve().parent / "data_cache"
CACHE_DIR.mkdir(exist_ok=True)

# Stations that actually publish METAR near the wing's bases. The base fields
# themselves (RPLS Sangley, RPML Lumbia) report nothing to this archive.
DEFAULT_STATIONS = ["RPLL", "RPMZ", "RPMD"]

TTL_HOURS = {"metar": 12, "oni": 24 * 7, "birds": 24 * 30}


# ── cache helpers ─────────────────────────────────────────────────────────
def _fresh(path: Path, kind: str) -> bool:
    if not path.exists():
        return False
    age = time.time() - path.stat().st_mtime
    return age < TTL_HOURS[kind] * 3600


def _status(path: Path) -> str:
    if not path.exists():
        return "missing"
    age_h = (time.time() - path.stat().st_mtime) / 3600
    return f"{age_h:.1f}h old"


# ── 1. Weather (METAR) ────────────────────────────────────────────────────
def get_weather(stations=None, start_year=2016, force=False) -> pd.DataFrame:
    """Daily weather per calendar day, averaged across stations."""
    stations = stations or DEFAULT_STATIONS
    cache = CACHE_DIR / "weather_daily.csv"
    if _fresh(cache, "metar") and not force:
        d = pd.read_csv(cache, parse_dates=["date"])
        return d

    frames = []
    for st in stations:
        try:
            r = requests.get(
                "https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py",
                params={"station": st, "data": ["vsby", "sknt", "wxcodes"],
                        "year1": start_year, "month1": 1, "day1": 1,
                        "year2": datetime.now().year, "month2": 12, "day2": 31,
                        "tz": "Etc/UTC", "format": "onlycomma", "missing": "M",
                        "trace": "T", "latlon": "no"},
                timeout=240)
            r.raise_for_status()
            m = pd.read_csv(StringIO(r.text), na_values=["M", "T"])
        except Exception as e:
            print(f"  weather {st}: FAILED ({e})")
            continue
        if m.empty:
            print(f"  weather {st}: 0 rows")
            continue
        m["valid"] = pd.to_datetime(m["valid"])
        m["date"] = m["valid"].dt.floor("D")
        wx = m["wxcodes"].fillna("")
        m["haze"] = wx.str.contains("HZ")
        m["ts"] = wx.str.contains("TS")
        m["rain"] = wx.str.contains("RA")
        for c in ("vsby", "sknt"):
            m[c] = pd.to_numeric(m[c], errors="coerce")
        g = m.groupby("date").agg(
            vsby_min=("vsby", "min"), vsby_avg=("vsby", "mean"),
            wind_max=("sknt", "max"), haze_hours=("haze", "sum"),
            ts_hours=("ts", "sum"), rain_hours=("rain", "sum")).reset_index()
        frames.append(g)
        print(f"  weather {st}: {len(g)} days")

    if not frames:
        return pd.DataFrame()
    d = (pd.concat(frames, ignore_index=True)
         .groupby("date").agg(vsby_min=("vsby_min", "min"), vsby_avg=("vsby_avg", "mean"),
                              wind_max=("wind_max", "max"), haze_hours=("haze_hours", "sum"),
                              ts_hours=("ts_hours", "sum"), rain_hours=("rain_hours", "sum"))
         .reset_index())
    d.to_csv(cache, index=False)
    return d


# ── 2. ENSO / El Nino ─────────────────────────────────────────────────────
def get_enso(force=False) -> dict:
    """{(year, month): ONI}. >= +0.5 El Nino, <= -0.5 La Nina."""
    cache = CACHE_DIR / "oni.json"
    if _fresh(cache, "oni") and not force:
        raw = json.loads(cache.read_text())
        return {tuple(map(int, k.split("-"))): v for k, v in raw.items()}

    center = {"DJF": 1, "JFM": 2, "FMA": 3, "MAM": 4, "AMJ": 5, "MJJ": 6,
              "JJA": 7, "JAS": 8, "ASO": 9, "SON": 10, "OND": 11, "NDJ": 12}
    out = {}
    try:
        txt = requests.get("https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
                           timeout=60).text
        for line in txt.splitlines()[1:]:
            p = line.split()
            if len(p) >= 4 and p[0] in center:
                out[(int(p[1]), center[p[0]])] = float(p[3])
        cache.write_text(json.dumps({f"{y}-{m}": v for (y, m), v in out.items()}))
        print(f"  ENSO: {len(out)} months")
    except Exception as e:
        print(f"  ENSO: FAILED ({e})")
    return out


def enso_now(oni: dict | None = None) -> tuple[float, str]:
    """Latest ONI value and its phase label."""
    oni = oni or get_enso()
    if not oni:
        return 0.0, "unknown"
    v = oni[max(oni)]
    phase = "El Nino" if v >= 0.5 else "La Nina" if v <= -0.5 else "Neutral"
    return v, phase


# ── 3. Bird activity (GBIF) ───────────────────────────────────────────────
def get_birds(country="PH", force=False) -> pd.DataFrame:
    """
    Monthly bird-observation counts for the country from GBIF (taxonKey 212 =
    Aves). A data-driven proxy for migration/abundance seasonality, replacing
    the hand-coded month windows.
    """
    cache = CACHE_DIR / f"birds_{country}.csv"
    if _fresh(cache, "birds") and not force:
        return pd.read_csv(cache)
    try:
        js = None
        for attempt in range(4):  # GBIF returns transient 503s
            try:
                r = requests.get("https://api.gbif.org/v1/occurrence/search",
                                 params={"country": country, "taxonKey": 212, "limit": 0,
                                         "facet": "month", "facetLimit": 12},
                                 timeout=120)
                r.raise_for_status()
                js = r.json()
                break
            except Exception as e:
                if attempt == 3:
                    raise
                print(f"  birds: retry {attempt + 1} after {e.__class__.__name__}")
                time.sleep(3 * (attempt + 1))
        counts = {}
        for f in js.get("facets", []):
            if f.get("field") == "MONTH":
                for c in f.get("counts", []):
                    counts[int(c["name"])] = int(c["count"])
        if not counts:
            print("  birds: no facet data returned")
            return pd.DataFrame()
        df = pd.DataFrame({"month": list(range(1, 13))})
        df["observations"] = df["month"].map(counts).fillna(0).astype(int)
        total = df["observations"].sum()
        df["share"] = df["observations"] / total
        # index vs an even 1/12 share: >1 means more bird activity than average
        df["activity_index"] = (df["share"] * 12).round(3)
        df.to_csv(cache, index=False)
        print(f"  birds: {total:,} observations across 12 months")
        return df
    except Exception as e:
        print(f"  birds: FAILED ({e})")
        return pd.DataFrame()


# ── orchestration ─────────────────────────────────────────────────────────
def refresh_all(stations=None, force=False) -> dict:
    print("refreshing external data sources...")
    weather = get_weather(stations, force=force)
    oni = get_enso(force=force)
    birds = get_birds(force=force)
    return {"weather": weather, "oni": oni, "birds": birds}


def report():
    print("\ncache status")
    for name, fn in [("weather_daily.csv", "metar"), ("oni.json", "oni"),
                     ("birds_PH.csv", "birds")]:
        p = CACHE_DIR / name
        print(f"  {name:<20} {_status(p):>12}   ttl {TTL_HOURS[fn]}h")


if __name__ == "__main__":
    data = refresh_all()
    w, birds = data["weather"], data["birds"]
    if not w.empty:
        print(f"\nweather: {len(w)} days  {w.date.min().date()} -> {w.date.max().date()}")
    v, phase = enso_now(data["oni"])
    print(f"ENSO now: ONI {v:+.1f} ({phase})")
    if not birds.empty:
        top = birds.sort_values("activity_index", ascending=False).head(3)
        names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        peaks = ", ".join(f"{names[int(r.month)]} {r.activity_index:.2f}x" for r in top.itertuples())
        print(f"bird activity peaks: {peaks}")
    report()
