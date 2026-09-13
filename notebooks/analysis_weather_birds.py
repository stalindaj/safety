"""
Empirical check: do weather and bird-migration season actually relate to mishaps?

Runs at DAY level (mishaps have exact dates; METAR is hourly) which has far more
statistical power than the weekly panel used by the forecast model.

    python analysis_weather_birds.py
"""
import sqlite3
from datetime import datetime
from io import StringIO
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from scipy import stats

HERE = Path(__file__).resolve().parent
DB = HERE.parent / "database" / "database.sqlite"
CACHE = HERE / "metar_daily_cache.csv"
STATIONS = ["RPLL", "RPMZ", "RPMD"]          # stations that actually report


def load_mishaps():
    con = sqlite3.connect(DB)
    df = pd.read_sql_query(
        "SELECT mishap_date, environment, category, aircraft, phase FROM mishaps",
        con, parse_dates=["mishap_date"])
    con.close()
    df["date"] = df["mishap_date"].dt.date
    df["month"] = df["mishap_date"].dt.month
    return df


def fetch_daily_weather(start_year):
    """Daily weather summary per station, cached to CSV."""
    if CACHE.exists():
        d = pd.read_csv(CACHE, parse_dates=["date"])
        d["date"] = d["date"].dt.date
        return d
    frames = []
    for st in STATIONS:
        url = "https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py"
        params = {"station": st, "data": ["vsby", "sknt", "wxcodes"],
                  "year1": start_year, "month1": 1, "day1": 1,
                  "year2": datetime.now().year, "month2": 12, "day2": 31,
                  "tz": "Etc/UTC", "format": "onlycomma", "missing": "M",
                  "trace": "T", "latlon": "no"}
        try:
            r = requests.get(url, params=params, timeout=180)
            r.raise_for_status()
            m = pd.read_csv(StringIO(r.text), na_values=["M", "T"])
        except Exception as e:
            print(f"  {st}: fetch failed ({e})")
            continue
        if m.empty:
            continue
        m["valid"] = pd.to_datetime(m["valid"])
        m["date"] = m["valid"].dt.date
        wx = m["wxcodes"].fillna("")
        m["haze"] = wx.str.contains("HZ")
        m["ts"] = wx.str.contains("TS")
        m["rain"] = wx.str.contains("RA")
        for c in ["vsby", "sknt"]:
            m[c] = pd.to_numeric(m[c], errors="coerce")
        g = m.groupby("date").agg(vsby_min=("vsby", "min"), vsby_avg=("vsby", "mean"),
                                  wind_max=("sknt", "max"), haze_hours=("haze", "sum"),
                                  ts_hours=("ts", "sum"), rain_hours=("rain", "sum")).reset_index()
        g["station"] = st
        frames.append(g)
        print(f"  {st}: {len(g)} days")
    if not frames:
        return pd.DataFrame()
    d = pd.concat(frames, ignore_index=True)
    # average across stations -> one row per calendar day (wing-wide weather)
    d = d.groupby("date").agg(vsby_min=("vsby_min", "min"), vsby_avg=("vsby_avg", "mean"),
                              wind_max=("wind_max", "max"), haze_hours=("haze_hours", "sum"),
                              ts_hours=("ts_hours", "sum"), rain_hours=("rain_hours", "sum")).reset_index()
    d.to_csv(CACHE, index=False)
    return d


def test_weather(mishaps, weather):
    print("\n" + "=" * 72)
    print("A. DOES WEATHER RELATE TO MISHAP DAYS?")
    print("=" * 72)
    flight_dates = set(mishaps.loc[mishaps.environment == "flight", "date"])
    ground_dates = set(mishaps.loc[mishaps.environment == "ground", "date"])

    for label, dates in [("FLIGHT", flight_dates), ("GROUND", ground_dates)]:
        w = weather.copy()
        w["mishap"] = w["date"].isin(dates)
        n_yes = int(w["mishap"].sum())
        print(f"\n-- {label} mishaps: {n_yes} mishap-days vs {len(w) - n_yes} quiet days")
        if n_yes < 10:
            print("   too few to test")
            continue
        print(f"   {'variable':<12}{'mishap-day':>12}{'normal-day':>12}{'p-value':>10}   verdict")
        for var in ["vsby_min", "vsby_avg", "wind_max", "haze_hours", "ts_hours", "rain_hours"]:
            a = w.loc[w.mishap, var].dropna()
            b = w.loc[~w.mishap, var].dropna()
            if len(a) < 10 or len(b) < 10:
                continue
            u, p = stats.mannwhitneyu(a, b, alternative="two-sided")
            verdict = "SIGNIFICANT" if p < 0.05 else "no effect"
            print(f"   {var:<12}{a.median():>12.2f}{b.median():>12.2f}{p:>10.3f}   {verdict}")


def test_birds(mishaps):
    print("\n" + "=" * 72)
    print("B. ARE BIRD STRIKES SEASONAL?")
    print("=" * 72)
    birds = mishaps[mishaps.category.fillna("").str.contains("Bird", case=False)]
    print(f"\nbird/wildlife strikes on record: {len(birds)}")
    if birds.empty:
        return
    counts = birds.groupby("month").size().reindex(range(1, 13), fill_value=0)
    names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    print("\n  month   strikes")
    for i, n in enumerate(counts):
        bar = "#" * n
        print(f"  {names[i]:<7}{n:>4}  {bar}")

    # Is the spread across months different from uniform?
    chi2, p = stats.chisquare(counts.values)
    print(f"\n  uniform-across-months test: chi2={chi2:.1f}, p={p:.3f} "
          f"-> {'NOT uniform (seasonal)' if p < 0.05 else 'consistent with uniform (no clear season)'}")

    # Compare the assumed migration windows against the rest of the year.
    south = counts.loc[[9, 10, 11]].sum()
    north = counts.loc[[2, 3, 4, 5]].sum()
    other = counts.sum() - south - north
    exp_south = counts.sum() * 3 / 12
    exp_north = counts.sum() * 4 / 12
    exp_other = counts.sum() * 5 / 12
    print(f"\n  southbound window (Sep-Nov): {south} observed vs {exp_south:.1f} expected")
    print(f"  northbound window (Feb-May): {north} observed vs {exp_north:.1f} expected")
    print(f"  rest of year               : {other} observed vs {exp_other:.1f} expected")
    chi2b, pb = stats.chisquare([south, north, other], [exp_south, exp_north, exp_other])
    print(f"  migration-window test: chi2={chi2b:.1f}, p={pb:.3f} "
          f"-> {'windows differ from chance' if pb < 0.05 else 'windows NOT better than chance'}")


def main():
    mishaps = load_mishaps()
    print(f"mishaps loaded: {len(mishaps)}")
    start = int(mishaps["mishap_date"].dt.year.min())
    print(f"fetching daily weather from {start} (cached to {CACHE.name})...")
    weather = fetch_daily_weather(start)
    if weather.empty:
        print("no weather available - skipping weather test")
    else:
        print(f"weather days: {len(weather)}")
        test_weather(mishaps, weather)
    test_birds(mishaps)


if __name__ == "__main__":
    main()
