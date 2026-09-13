"""
Evidence-based feature selection for the weekly forecast.

Builds the weekly flight panel, then walk-forward validates several candidate
feature sets and reports AUC and Brier skill against the honest baseline
(always predict the base rate). Whatever wins is what the model should use.

    python compare_models.py
"""
import sqlite3
from datetime import datetime
from io import StringIO
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve().parent
DB = HERE.parent / "database" / "database.sqlite"
CACHE = HERE / "metar_daily_cache.csv"

ISO = lambda s: pd.to_datetime(s).dt.to_period("W-SUN").apply(lambda p: p.start_time.date())


def fetch_oni():
    url = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
    center = {"DJF": 1, "JFM": 2, "FMA": 3, "MAM": 4, "AMJ": 5, "MJJ": 6,
              "JJA": 7, "JAS": 8, "ASO": 9, "SON": 10, "OND": 11, "NDJ": 12}
    out = {}
    try:
        for line in requests.get(url, timeout=60).text.splitlines()[1:]:
            p = line.split()
            if len(p) >= 4 and p[0] in center:
                out[(int(p[1]), center[p[0]])] = float(p[3])
    except Exception as e:
        print("ONI fetch failed:", e)
    return out


def build_panel():
    con = sqlite3.connect(DB)
    mis = pd.read_sql_query(
        "SELECT mishap_date, environment FROM mishaps", con, parse_dates=["mishap_date"])
    con.close()
    mis = mis[mis.environment == "flight"].copy()
    mis["week"] = ISO(mis["mishap_date"])

    weeks = [p.start_time.date() for p in
             pd.period_range(mis["mishap_date"].min(), pd.Timestamp.now(), freq="W-SUN")]
    panel = pd.DataFrame({"week": weeks})
    counts = mis.groupby("week").size().rename("mishaps")
    panel = panel.merge(counts, on="week", how="left").fillna({"mishaps": 0})
    panel["mishaps"] = panel["mishaps"].astype(int)

    dt = pd.to_datetime(panel["week"])
    panel["month"] = dt.dt.month
    panel["year"] = dt.dt.year
    oni = fetch_oni()
    last = oni[max(oni)] if oni else 0.0
    panel["oni"] = [oni.get((y, m), last) for y, m in zip(panel.year, panel.month)]
    panel["el_nino"] = (panel["oni"] >= 0.5).astype(int)
    panel["southwest_monsoon"] = panel["month"].isin([6, 7, 8, 9]).astype(int)
    panel["northeast_monsoon"] = panel["month"].isin([11, 12, 1, 2]).astype(int)
    panel["pre_monsoon"] = panel["month"].isin([3, 4, 5]).astype(int)
    panel["bird_south"] = panel["month"].isin([9, 10, 11]).astype(int)
    panel["bird_north"] = panel["month"].isin([2, 3, 4, 5]).astype(int)
    panel = panel.sort_values("week")
    panel["recent_mishaps"] = (panel["mishaps"].shift(1)
                               .rolling(4, min_periods=1).sum().fillna(0))

    if CACHE.exists():
        w = pd.read_csv(CACHE, parse_dates=["date"])
        w["week"] = ISO(w["date"])
        wk = w.groupby("week").agg(vsby_min=("vsby_min", "min"),
                                   wind_max=("wind_max", "max"),
                                   haze_hours=("haze_hours", "sum"),
                                   ts_hours=("ts_hours", "sum"),
                                   rain_hours=("rain_hours", "sum")).reset_index()
        panel = panel.merge(wk, on="week", how="left")
    for c in ["vsby_min", "wind_max", "haze_hours", "ts_hours", "rain_hours"]:
        if c not in panel:
            panel[c] = np.nan
        panel[c] = panel[c].fillna(panel[c].median())
    return panel


def walk_forward(X, y, min_train=150):
    oof = np.full(len(y), np.nan)
    for i in range(min_train, len(y)):
        if len(np.unique(y[:i])) < 2:
            continue
        mdl = make_pipeline(StandardScaler(),
                            LogisticRegression(C=0.3, max_iter=2000))
        oof[i] = mdl.fit(X[:i], y[:i]).predict_proba(X[i:i + 1])[0, 1]
    return oof


SETS = {
    "baseline (base rate only)": [],
    "recent activity only": ["recent_mishaps"],
    "season only": ["southwest_monsoon", "northeast_monsoon", "pre_monsoon"],
    "ENSO only": ["oni", "el_nino"],
    "bird windows only": ["bird_south", "bird_north"],
    "weather only": ["vsby_min", "wind_max", "haze_hours", "ts_hours", "rain_hours"],
    "season + ENSO": ["southwest_monsoon", "northeast_monsoon", "pre_monsoon", "oni", "el_nino"],
    "FULL (current model)": ["oni", "el_nino", "southwest_monsoon", "northeast_monsoon",
                             "pre_monsoon", "bird_south", "bird_north", "recent_mishaps",
                             "vsby_min", "haze_hours", "ts_hours", "wind_max"],
}


def main():
    panel = build_panel()
    y_all = (panel["mishaps"] > 0).astype(int).to_numpy()
    print(f"weeks: {len(panel)} | mishap-weeks: {y_all.sum()} "
          f"({y_all.mean():.1%} base rate)\n")
    print(f"{'feature set':<28}{'AUC':>7}{'Brier':>9}{'skill':>9}   verdict")
    print("-" * 66)

    # reference: predict the base rate every week
    ref_mask = np.zeros(len(y_all), bool)
    ref_mask[150:] = True
    base = y_all[ref_mask].mean()
    brier_base = brier_score_loss(y_all[ref_mask], np.full(ref_mask.sum(), base))
    print(f"{'baseline (base rate only)':<28}{'--':>7}{brier_base:>9.4f}{0.0:>8.1f}%   reference")

    for name, feats in SETS.items():
        if not feats:
            continue
        X = panel[feats].to_numpy(dtype=float)
        oof = walk_forward(X, y_all)
        m = ~np.isnan(oof)
        auc = roc_auc_score(y_all[m], oof[m]) if len(np.unique(y_all[m])) > 1 else np.nan
        brier = brier_score_loss(y_all[m], oof[m])
        skill = (1 - brier / brier_base) * 100
        verdict = "BEATS baseline" if skill > 0 else "worse than baseline"
        print(f"{name:<28}{auc:>7.3f}{brier:>9.4f}{skill:>8.1f}%   {verdict}")


if __name__ == "__main__":
    main()
