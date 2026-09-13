"""
Parse a nightly 15SW Flight Order PDF into one row per AIRCRAFT-SORTIE and store
it in the app database (flight_schedules).

Why this matters: the risk model had no EXPOSURE term. Scheduled sorties tell us
how much flying is planned, on which tails, and at what time of day.

Usage:
    python parse_schedule.py <file.pdf | folder>
"""
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

import pdfplumber

SECTIONS = [
    (re.compile(r"\bA\.\s*DIRECTED", re.I), "directed"),
    (re.compile(r"\bB\.\s*TRAINING", re.I), "training"),
    (re.compile(r"\bC\.\s*NIGHT", re.I), "night"),
    (re.compile(r"\bD\.\s*MAINTENANCE", re.I), "maintenance"),
]

AIRCRAFT_CANON = [
    ("OV-10", r"OV-?10"),
    ("A-29B ST", r"A-?29B"),
    ("SF-260TP", r"SF-?260"),
    ("T-129 ATAK", r"T-?129"),
    ("AW-109", r"AW-?109"),
    ("MD-520MG", r"MD-?520"),
    ("MD-500ER", r"MD-?500"),
]

AC_RX = re.compile("|".join(p for _, p in AIRCRAFT_CANON), re.I)
# The '#' is required: without it the first 3-4 digit token in a segment is
# usually the ETD (0630), not a tail. Tails written bare are left blank and
# flagged rather than guessed.
TAIL_RX = re.compile(r"#\s*(\d{3,4}(?:\s*/\s*\d{3,4})*)")


def find_db():
    here = Path(__file__).resolve().parent
    for p in [Path("../database/database.sqlite"), Path("database/database.sqlite"),
              here.parent / "database/database.sqlite"]:
        if p.exists():
            return p.resolve()
    raise SystemExit("database.sqlite not found")


def canon_aircraft(text):
    if not text:
        return None
    for label, pattern in AIRCRAFT_CANON:
        if re.search(pattern, text, re.I):
            return label
    return None


def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()


def parse_date(text):
    m = re.search(r"(\d{1,2})\s+([A-Z]+)\s+(\d{4})", (text or "").upper())
    if not m:
        return None
    try:
        return datetime.strptime(
            f"{m.group(1)} {m.group(2)[:3].title()} {m.group(3)}", "%d %b %Y"
        ).date()
    except ValueError:
        return None


def etd_minutes(etd):
    if not etd or not re.fullmatch(r"\d{3,4}", etd):
        return None
    etd = etd.zfill(4)
    return int(etd[:2]) * 60 + int(etd[2:])


def sections_on_page(page):
    """Headings look like 'A. DIRECTED FLIGHT'. Requiring the A./B./C./D. prefix
    avoids matching the prose mention of those words in the letter header."""
    words = page.extract_words() or []
    heads = []
    for i in range(1, len(words)):
        prev = words[i - 1]["text"].strip().upper()
        cur = words[i]["text"].strip().upper()
        if re.fullmatch(r"[A-D]\.", prev):
            for _, name in SECTIONS:
                if cur.startswith(name[:4].upper()):
                    heads.append((words[i]["top"], name))
    return sorted(heads)


def parse_pdf(path):
    table_rows = []
    with pdfplumber.open(path) as pdf:
        full_text = "\n".join((pg.extract_text() or "") for pg in pdf.pages)
        m = re.search(r"scheduled\s+for\s+(.+?)[\.\n]", full_text, re.I)
        sched_date = parse_date(m.group(1)) if m else parse_date(path.stem)

        last_section = None
        for page in pdf.pages:
            heads = sections_on_page(page)
            for tbl in page.find_tables():
                top = tbl.bbox[1]
                section = last_section  # page 2 continues the previous section
                for y, name in heads:
                    if y <= top + 5:
                        section = name
                last_section = section or last_section
                for row in tbl.extract():
                    cells = [clean(c) for c in row]
                    if not any(cells) or cells[0].upper().startswith("A/C"):
                        continue
                    if set(filter(None, cells)) <= {"-"} or "ALERT" in cells[0].upper():
                        continue
                    if len(cells) == 4:          # some tables drop the A/C TYPE column
                        cells = [""] + cells
                    if len(cells) < 5:
                        continue
                    ac_cell, crew, etd, itin, mission = cells[:5]
                    if not re.fullmatch(r"\d{3,4}", etd or ""):
                        continue                  # not a sortie line
                    table_rows.append({
                        "section": section, "ac_cell": ac_cell, "crew": crew,
                        "etd": etd, "itin": itin, "mission": mission,
                    })

    # Pair each aircraft token with the tail(s) that follow it, up to the next
    # aircraft token. Scanning the segment AFTER the type token means the digits
    # inside the type name (SF-260TP, T-129) can never be mistaken for a tail,
    # and it tolerates tails written without the '#'.
    pairs = []
    ms = list(AC_RX.finditer(full_text))
    for i, mt in enumerate(ms):
        seg = full_text[mt.end(): ms[i + 1].start() if i + 1 < len(ms) else len(full_text)]
        tm = TAIL_RX.search(seg)
        tails = re.findall(r"\d{3,4}", tm.group(1)) if tm else []
        pairs.append((canon_aircraft(mt.group(0)), tails))

    ac_seq = [p[0] for p in pairs]
    tail_seq = [p[1] for p in pairs]
    aligned = len(pairs) == len(table_rows)
    if not aligned:
        print(f"   ! {path.name}: {len(pairs)} aircraft entries vs {len(table_rows)} "
              f"sortie rows - falling back to per-cell parsing (review advised)")

    rows = []
    for i, tr in enumerate(table_rows):
        if aligned:
            aircraft, tails = ac_seq[i], tail_seq[i]
        else:
            aircraft = canon_aircraft(tr["ac_cell"])
            part = tr["ac_cell"].split("#", 1)[1] if "#" in tr["ac_cell"] else ""
            tails = re.findall(r"\d{3,4}", part)
        for tail in (tails or [None]):
            rows.append({
                "flight_date": str(sched_date) if sched_date else None,
                "category": tr["section"] or "directed",
                "aircraft": aircraft,
                "tail": tail,
                "crew": tr["crew"] or None,
                "etd": tr["etd"],
                "etd_minutes": etd_minutes(tr["etd"]),
                "itinerary": tr["itin"] or None,
                "mission": tr["mission"] or None,
                "source_file": path.name,
            })
    return rows


def store(rows, db_path):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    con = sqlite3.connect(db_path)
    try:
        cur = con.cursor()
        for r in rows:
            cur.execute(
                "INSERT OR REPLACE INTO flight_schedules "
                "(flight_date, category, aircraft, tail, crew, etd, etd_minutes, "
                " itinerary, mission, source_file, created_at, updated_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (r["flight_date"], r["category"], r["aircraft"], r["tail"], r["crew"],
                 r["etd"], r["etd_minutes"], r["itinerary"], r["mission"],
                 r["source_file"], now, now))
        con.commit()
    finally:
        con.close()


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    target = Path(sys.argv[1])
    pdfs = sorted(target.glob("*.pdf")) if target.is_dir() else [target]
    db = find_db()
    total = 0
    for pdf in pdfs:
        rows = parse_pdf(pdf)
        store(rows, db)
        total += len(rows)
        print(f"{pdf.name}: {len(rows)} aircraft-sorties")
        for r in rows:
            print(f"   {r['flight_date']}  {r['category']:<12} {str(r['aircraft']):<11} "
                  f"#{str(r['tail'] or '-'):<6} {r['etd']}  "
                  f"{str(r['itinerary']):<12} {r['mission']}")
    print(f"\nstored {total} sorties into {db}")


if __name__ == "__main__":
    main()
