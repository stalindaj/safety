# 15SW Safety — Progress & Handoff

> Living status file so work can continue in a new chat (or a new laptop)
> without losing context. Last updated: 2026-08-26.

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

## NOT done yet / next steps
1. **Go live on cPanel** — prepared but not executed. Plan uses subdomain/folder/
   DB all named **`safety`**. Steps: GitHub token → MySQL DB (`youruser_safety`)
   → Git clone into `public_html/safety` → subdomain doc root `…/safety/public`
   → paste `.env` → `/setup/{TOKEN}` → blank token → AutoSSL → set
   `FORCE_HTTPS=true` + `SESSION_SECURE_COOKIE=true`. Full detail in
   [DEPLOY-PLAYBOOK.md](DEPLOY-PLAYBOOK.md). Production secrets were generated in
   chat (APP_KEY + SETUP_TOKEN) — regenerate if lost: `php artisan key:generate
   --show` and `php -r "echo bin2hex(random_bytes(24));"`. Do NOT commit secrets.
1b. **Redesign — BI/army look (IN PROGRESS, top priority).** Make the whole UI a
   simple, professional **BI dashboard**, military/realistic, colors from the
   Safety Office seal (navy + gold), header logo = the seal. Model the analytics
   on the **"Weekly Safety Analytics" PPT** (`Downloads/EDITED Weekly_Safety_
   Forecast_29_March_-_04_April_2026.pptx`, 30 slides): its core is a WEEKLY
   FORECAST — for the upcoming week, list the mishaps that historically occurred
   that same calendar week (flight vs ground) + a likelihood % (e.g. "4.5% chance
   of a flight incident this week"); plus a year-by-year breakdown table
   (year × incident/accident × ground/flight). Keep it simple.
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
