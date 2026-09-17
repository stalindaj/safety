# 15SW Safety — Progress & Handoff

> Living status file so work can continue in a new chat (or a new laptop)
> without losing context. Last updated: 2026-09-13.

## What this is
**15SW Safety** — the 15th Strike Wing Wing Safety Office platform. The app is
the umbrella ("15SW Safety"); **Mishap Records** is its first module. More
safety modules are planned. Repo: <https://github.com/stalindaj/safety> (branch
`main`). Local path: `C:\Users\User\Desktop\safety`.

## Stack & deploy model
- PHP 8.3 · Laravel 13 · Inertia + React 18 · Tailwind 4 · Vite 7 · Recharts.
- SQLite (local) / MySQL InnoDB (prod). Same shell-less cPanel model as the
  sibling apps (hasdp, 19thctts): **`vendor/` and `public/build/` are committed**;
  deploy by pushing, cPanel pulls, then hit `/setup/{token}` to migrate + seed.
- **Toolchain:** PHP 8.4 + Composer are on the **PowerShell** PATH (Laravel Herd),
  NOT Git Bash. Node/npm are on both. Run `php artisan` / `composer` via PowerShell.
- Local run: `php artisan serve` + `npm run dev` (or `npm run build`). Login
  `superadmin@15sw.paf.mil.ph` / `ChangeMe!2026`.

## Continuing on a NEW laptop (fresh setup)
`.env` and the local SQLite DB are gitignored, so a fresh clone needs a few
steps. Prereqs: install **Laravel Herd** (bundles PHP 8.3+ & Composer) and
**Node.js**. Run php/composer from **PowerShell** (Herd's PATH), not Git Bash.

```powershell
git clone https://github.com/stalindaj/safety.git
cd safety
Copy-Item .env.example .env          # create env file
php artisan key:generate             # vendor/ is committed, so artisan runs w/o composer install
New-Item -ItemType File database\database.sqlite   # local DB (gitignored)
php artisan migrate --seed           # schema + 128 mishaps + superadmin account
npm install                          # only if you'll edit the UI (node_modules is gitignored)
php artisan serve                    # http://localhost:8000  (add: npm run dev  for hot reload)
```

Notes: the committed `public/build/` means the app renders even without
`npm install`; run `npm run build` only after editing the frontend, and commit
the rebuilt assets. If `php`/`composer` aren't found, they're on the PowerShell
PATH via Herd (`~/.config/herd/bin`), not Git Bash.

## Done so far
- **Mishap Records** (`/mishaps`): searchable/filterable table + add/edit/delete
  modal. Fields: date, location, **type** (accident/incident), **environment**
  (ground/flight), **cause** (11 categories), description, corrective_action,
  lesson_learned. Seeded with **128 historical records** (CY 2016–2026) from
  *15SW Historical Record of Mishaps.xlsx*.
- **Cause** is a real stored field: chosen on the form or auto-inferred from the
  description via `app/Support/HazardClassifier.php`; historical rows backfilled.
- **Safety Dashboard** (`/`) for non-analysts: plain-language Key Findings,
  this-year-vs-last tiles, **Top Causes** ranked bars, a **Philippines map** of
  locations (marker size = count; click a marker → details modal), plus trend/
  pie/monthly charts.
- **Account** screen (`/account`) to change the password (needed since the host
  is shell-less).
- **Theme sampled from the Safety Office seal** — shield navy-blue + command
  gold, on white. Palette lives in `resources/css/app.css` (scales are named
  `navy`/`gold`). Seal image: `public/img/safety-seal.jpg`, shown on the login.
- Footer credits: "Developed by the Office of the Directorate of Personnel,
  15th Strike Wing."
- 7/7 PHPUnit tests pass.

## Corrective Action Plan module — Slice 1 DONE (2026-08-26)
- `corrective_actions` table (belongs to mishap): latent_condition, category
  (DOTMPLF), cause_factor, opr, corrective_action, staff_action, status, remarks,
  sort_order. Model `CorrectiveAction`; `Mishap::correctiveActions()`.
- `CorrectiveActionSeeder` imported the CAPS.xlsx plans: **5 of 6 attached** to
  their existing mishaps (28 actions); the **MPV vehicular skipped** (not a
  record yet — has no date in the sheet; add that mishap then re-seed to attach).
- **Mishap count unchanged (128)** — analysis untouched.
- UI: `/mishaps/{id}/plan` (`Mishaps/Plan.jsx`, `CorrectiveActionController`) —
  per-mishap plan with status summary + add/edit/delete rows; "Plan (N)" link in
  the records table. **Slice 2 (status tracking board across all plans) not built.**

## CAPS follow-up + proof — DONE (2026-09-13)
Workflow (per the user): mishap happens → safety board investigates (outside
the app) → record entered → board's report goes to higher office → it returns
recommendations = CAPS rows → staff act on them → proof → Complied.
- Each CAP row now has a **follow-up person** under OPR/UPR (rank + name,
  contact number, email) and a **Proof / Intervention** section (what was done
  + up to **3 photos**).
- **Complied needs proof:** the server rejects `status=complied` unless at least
  one photo is on file (also blocks removing the last photo of a complied row).
  Older rows that were already Complied show a "No proof on file" badge.
- Photos: shrunk in the browser to ≤1600px JPEG, max 5 MB server-side, stored on
  the private disk (`storage/app/private/caps/{id}/`), served only to signed-in
  users via `/cap-proofs/{id}`. Deleting a CAP row or mishap deletes its photos.
- Table `corrective_action_proofs`; model `CorrectiveActionProof`.

## Forecast notebook online (Google Colab) — DONE (2026-09-13)
- The app exposes a token-protected link: `GET /api/model/data` (mishap dates,
  type, environment, category, aircraft + sortie dates — no descriptions,
  names or crew) and `POST /api/model/forecasts` (upserts the weekly rows).
  Guard: `MODEL_API_TOKEN` in `.env` (blank = link off), throttled 30/min.
- `notebooks/safety_forecast.ipynb` was rebuilt around **one button cell**,
  "▶ Update the 15SW Safety app" (Colab form: code hidden, dropdowns for the
  base-rate period — default **Last 5 years** — El Niño status and weeks ahead).
  One press: read records → base rate + conditions → save to the app. It runs
  **online** when `APP_URL` + `MODEL_API_TOKEN` are set (Colab Secrets or env
  vars), otherwise **offline** against local SQLite. It saves every week of the
  current year **plus up to 12 weeks ahead** (calendar-known conditions only),
  so the dashboard still has "this week" if an update is missed. Optional cells
  below: base rate by year, and the walk-forward model check.
- Free Colab can't run on a timer — someone presses ▶ weekly. Fully automatic
  needs Colab Pro+ (scheduled notebooks) or Colab Enterprise (Google Cloud
  schedules; pass APP_URL/MODEL_API_TOKEN as env vars there).
- Colab can only reach the **live cPanel site**, not localhost. On production:
  add `MODEL_API_TOKEN` to `.env`, then rebuild the config + route caches
  (visit `/setup/{token}` with the token restored, or delete
  `bootstrap/cache/config.php` and `routes-v7.php`).
- `parse_schedule.py` (Flight Order PDFs) still runs on the laptop.
- The **night / pre-dawn departure** flag was removed at the user's request from
  the notebook's weekly conditions. The link sends sortie dates only.
- The **Daily Flight Brief** page and its nav link were removed at the user's
  request (2026-09-13). The `flight_schedules` table, `FlightSchedule` model and
  `parse_schedule.py` stay — the notebook still counts sorties per week.
- Local dev: `AppServiceProvider` passes TEMP/TMP through `php artisan serve`
  (Windows strips them, which silently broke uploads and large POSTs).

## Predictive Safety Forecast panel (under the SPI) — DONE (2026-09-14)
Titled "Predictive Safety Forecast", badged **Experimental**, no intro text (the
user found it hard to read). Leads with chance tiles from the Wing's own record,
last 5 years: flight mishap this week (~10%), any mishap this week (~17%),
bird / wildlife strike this week (seasonal when in a migration window). A
"flight mishap in the next 30 days" tile (~31%) was removed — it read as alarming
for reporting and repeated the weekly figure. Note for reporting: 28 of the last
30 flight mishaps were incidents; the flight-accident chance is ~0.8% a week.
Season rows show "X% a week · usual Y%" with a
verdict: higher / lower / same as usual (gap < 2 pts), or "too few to tell"
(< 5 events). Season badges follow the verdict (Brief only when higher).
Originally built as "Early Warning"; details below still apply.

## Early Warning panel (under the SPI) — DONE (2026-09-14)
The SPI is lagging (moves only after a 15SW mishap). The Early Warning panel adds
leading signals, Mindanao first. **Advisories only — never counted in the SPI
or base rate.** Levels: Brief crews / Be aware / No hazards / For information.
- **Live airfield weather** (`app/Support/AirfieldWeather.php`): METAR (now) +
  TAF (~24 h) from NOAA's aviationweather.gov public API for RPMZ Zamboanga,
  RPMR General Santos, RPMD Davao, RPVM Mactan-Cebu, RPLL Manila; cached 30 min
  (15 min after a failure). Brief = thunderstorm/lightning, gusts ≥ 25 kt,
  visibility < ~5 km; Be aware = CB cloud, haze, rain, wind ≥ 20 kt. Routine
  "TEMPO … CB" in forecasts is only "Be aware" (it's in most tropical TAFs).
  Lumbia/CDO (TOG 10, LAB) have no report in this feed — the panel says so.
- **Season** (`app/Support/EarlyWarning.php`): bird-migration windows with the
  Wing's own bird-strike counts (11 of 23 in Feb–May, 7 in Sep–Nov), monsoon
  phase, and El Niño from the weekly notebook row.
- **Outside occurrences** (`external_occurrences` table, logged by staff from the
  panel): auto-flagged "Our aircraft type" / "Mindanao" / "One of our top
  causes"; 2+ matches = Brief crews. Shown for 30 days by default.
- Needs outbound HTTPS from the host to aviationweather.gov; if blocked, the
  panel shows "couldn't be reached — not an all-clear".

## Watcher step 1: weather at the time — DONE locally (2026-09-17)
Parked in a git stash on 2026-09-15, resumed and finished 2026-09-17. Not pushed yet.
- Optional **Time** field on mishaps (`mishap_time`, "HH:MM" PH time). Tables
  `mishap_weather` (one row per mishap) + `watcher_reports` (one summary per kind).
- `notebooks/safety_watcher.ipynb`: matches each Location to a place (PLACES
  cell), picks the nearest airfield with a METAR archive (Iowa State). An airfield
  within 50 km counts as **observed**; otherwise it uses an ERA5 model **estimate** (Open-Meteo)
  that is not counted in the comparison. It compares hazard rates on mishap days
  with all days at the same airfields (binomial test, under 10 days = too few). It saves
  via `POST /api/model/weather-links` (online) or straight into the local SQLite.
- Shown in the Predictive Safety Forecast panel (Forecast page): verdict
  sentence, Flight / Flight + ground table, weather at the 6 latest mishaps.
- **First result (128 mishaps, 95 observed):** bad weather on 26% of flight
  mishap days vs 30% of ordinary days. Every hazard is "same as usual". Likely
  because flying stops in bad weather (no exposure data to correct for this).
- Prod needs: pull, `/setup` (new migration), then run the notebook in Colab.

## Conditions contribute to the chances — DONE locally (2026-09-17)
- `app/Support/ChanceModel.php`: the 3 tiles (flight / any / bird, base = last
  5 years) are adjusted as base odds × factor × factor…
  - Factors: time of year (monsoon phase; migration window for birds), El Niño /
    La Niña (NOAA ONI via `app/Support/Enso.php`, live), airfield weather now /
    next 24 h (likelihood ratio from the weather-watcher notebook; not used for
    birds), and outside occurrences.
  - Each factor is measured from the Wing's record, then shrunk toward ×1
    (52 average weeks / 50 days of prior). The total is capped at ×0.5–×2.
  - Outside occurrences don't count until 26 weeks of watcher history exist.
- First result (17 Sep 2026): flight 10.3 → 8.2%, any 16.5 → 12.2%, bird
  4.2 → 3.3%. El Niño weeks and bad-weather days have had FEWER mishaps in the
  record (likely less flying). The page says so, and advises briefing the hazard anyway.
- The El Niño season row now reads NOAA directly (ONI +1.8 Jun–Aug 2026, strong);
  the notebook row is the fallback.

## Watcher step 2: news watcher (automatic, trusted sources) + pattern alerts — DONE locally (2026-09-17)
- **Sources** (`app/Support/News/Sources.php`):
  - 9 Google News searches, plus direct RSS from CAAP, Inquirer, GMA, Philstar
    and Rappler.
  - **Only trusted outlets count**, in 3 tiers: official (CAAP, PNA, PIA, PAF,
    AFP, DOTr, PCG, NTSB…), aviation safety (Aviation Herald, ASN, FlightGlobal,
    AeroTime…), and major news (PH national newsrooms + regional wires).
    Everything else (Facebook, Daily Mail, tabloids) is skipped.
  - PNA, PIA and ASN block robots, and the Aviation Herald's robots.txt
    disallows all robots, so those arrive only through Google News (not scraped).
- `NewsReader` keeps only flying occurrences, using keyword rules: kind, place →
  region (airline names aren't places), fleet type, military, category.
  `quotesOfficial()` spots "PAF: …", "…, CAAP says" and "… – Caap".
- Articles are grouped into one `news_detections` row per event: up to 10 days
  apart for crashes, 3 days otherwise.
- **Decided automatically** (`NewsWatcher::decide`):
  - **Verified** = 1 official or aviation-safety source, a newsroom quoting an
    official body, or 2 independent newsrooms.
  - Verified and relevant (score ≥ 2, and not a plain disruption unless in
    Mindanao) → **logged as an outside occurrence** (`created_by` null, summary
    ends "logged automatically from …").
  - Verified but not relevant → `info`.
  - 1 newsroom only → `waiting`, which becomes `info` after 7 days.
- Scoring: our type +3, Mindanao +2, PH +1, military +1, top cause +1, crash +1.
  A nearby country adds 0.
- Staff override: Undo (removes the automatic log), Log anyway (the form),
  Remove on the Outside list, Give back to watcher. These set `auto=false`.
- `RelevanceModel` (naive Bayes) trains **only on staff decisions** (5 of each
  to start). It can hand a case to a person (`pending`) but never logs or
  removes anything itself.
- `EarlyWarning::patterns()`: 2+ similar occurrences (same category or fleet
  type; Wing flight mishaps + outside occurrences) within 14 days.
- Runs: `php artisan safety:watch-news` (hourly), the Check now button, and
  after the Forecast page loads if the last check is 90+ min old (`NEWS_WATCH_AUTO`).
- First sweep (45 days): 557 articles, 194 untrusted skipped, 13 events, 2
  logged automatically (Butuan runway excursion, PAF FA-50 generator issue).
- **Prod needs:** pull → `/setup` (2 new migrations) → cPanel **Cron Jobs**:
  `0 * * * * /usr/local/bin/php /home/<user>/public_html/<folder>/artisan safety:watch-news`
  (check the PHP path in cPanel). The host must reach news.google.com and the feeds.
- Not started: storm (GDACS) watcher.

## NOT done yet / next steps
1. **Go live on cPanel** — prepared but not executed. Plan uses subdomain/folder/
   DB all named **`safety`**. Steps: GitHub token → MySQL DB (`youruser_safety`)
   → Git clone into `public_html/safety` → subdomain doc root `…/safety/public`
   → paste `.env` → `/setup/{TOKEN}` → blank token → AutoSSL → set
   `FORCE_HTTPS=true` + `SESSION_SECURE_COOKIE=true`. Full detail in
   [DEPLOY-PLAYBOOK.md](DEPLOY-PLAYBOOK.md). Production secrets were generated in
   chat (APP_KEY + SETUP_TOKEN) — regenerate if lost: `php artisan key:generate
   --show` and `php -r "echo bin2hex(random_bytes(24));"`. Do NOT commit secrets.
1b. **Dashboard BI redesign — DONE (2026-08-26).** `DashboardController` now
   sends raw records; `Dashboard.jsx` computes everything client-side so it's a
   real BI view. Header logo = Safety Office seal. Built from the "Weekly Safety
   Analytics" PPT (`Downloads/EDITED Weekly_Safety_Forecast_...pptx`):
   - **Slice A** — BI reskin: filter bar, KPI tiles, navy/gold, simple.
   - **Slice B** — "This Week — Safety Forecast": mishaps in the current
     calendar week (next 7 days) across all years, flight/ground split +
     likelihood % (= share of years that saw one that week).
   - **Slice C** — year breakdown table (year × incident/accident × ground/flight).
   - **Click-to-filter**: Type (accident/incident) + Environment (ground/flight)
     chips cross-filter the whole dashboard instantly. Monthly chart has a year
     selector. Map click → location detail modal (respects filter).
   Remaining polish idea: the other pages (records/plan/account) inherit the
   palette but could get the same BI tightening if wanted.
2. **Attendance feature** — PARKED (meeting badge-QR check-in). Spec + standalone
   HTML tools in `Desktop/attendance` (jsQR downloaded); resume later.
3. **CAPS Slice 2** — status tracking board across all plans (complied vs ongoing
   by unit/OPR) + a dashboard tile.
4. **More Safety modules** under the umbrella.

Note: AI/auto-generation has been **descoped** — see "Auto-generation — DESCOPED".

## CAPS.xlsx — the corrective-action blueprint
The user's `CAPS.xlsx` (Downloads) is one sheet per mishap, each a formal
**Corrective Action Plan** table with columns:
`TYPE OF INCIDENT/ACCIDENT | LATENT CONDITION (GAPS) | CATEGORY (DOTMPLF) |
RISK CLARIFICATION | OPR/UPR | CAUSE FACTOR | CORRECTIVE ACTIONS/MILESTONE |
STAFF ACTION | REMARKS`. Cause factor is Human/Organizational/Environmental/
Material × Primary/Contributory; DOTMPLF = Doctrine/Organization/Training/
Materiel/Personnel/Leadership/Facilities; REMARKS holds status (Complied,
Ongoing, ETOC, Approved…).

**Implication:** "corrective action" is not one text box — it's a structured,
multi-row plan per mishap with an OPR and a tracked status. The natural next
feature is a **CAP sub-record** attached to a mishap (rows of gap → cause factor
→ corrective action → OPR → staff action → status), which also becomes the
tracking view ("what's Complied vs Ongoing"). These are entered/edited by staff.

## Auto-generation — DESCOPED (2026-08-26)
AI/auto-generation of corrective actions is **out of scope** — removed from the
app entirely (no "Generate" button, no AI code or config). Reason: truly private
+ online + capable-at-novel-cases requires self-hosted model hardware, which is
an infrastructure/policy decision above this project. Focus is **input + data
analysis** (and, next, the attendance feature). The `corrective_action` /
`lesson_learned` fields remain as plain manual inputs. Do not re-add AI unless
the user explicitly asks.

## Key files
- `app/Http/Controllers/` — `DashboardController` (findings/hazards/comparison/
  map data), `MishapController` (CRUD + cause auto-fill), `ProfileController`
  (password), `SetupController` (`/setup` installer), `Auth/SessionController`.
- `app/Support/HazardClassifier.php` — description → one cause (+ CATEGORIES list).
- `app/Models/Mishap.php`; migrations in `database/migrations/`; seeders
  (`MishapSeeder` = 128 records, `UserSeeder` = superadmin).
- `resources/js/Pages/` — `Dashboard.jsx`, `Mishaps/Index.jsx`, `Account/Edit.jsx`,
  `Auth/Login.jsx`. `Components/PhilippinesMap.jsx` (geocoded map; `GEOCODE` object
  holds per-location lat/lng). `Layouts/AppLayout.jsx`. `Components/Ui.jsx`.
- `resources/css/app.css` — theme palette (navy/gold from the seal).
- `DEPLOY-PLAYBOOK.md` — full cPanel deploy guide.
