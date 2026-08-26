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

## NOT done yet / next steps
1. **Go live on cPanel** — prepared but not executed. Plan uses subdomain/folder/
   DB all named **`safety`**. Steps: GitHub token → MySQL DB (`youruser_safety`)
   → Git clone into `public_html/safety` → subdomain doc root `…/safety/public`
   → paste `.env` → `/setup/{TOKEN}` → blank token → AutoSSL → set
   `FORCE_HTTPS=true` + `SESSION_SECURE_COOKIE=true`. Full detail in
   [DEPLOY-PLAYBOOK.md](DEPLOY-PLAYBOOK.md). Production secrets were generated in
   chat (APP_KEY + SETUP_TOKEN) — regenerate if lost: `php artisan key:generate
   --show` and `php -r "echo bin2hex(random_bytes(24));"`. Do NOT commit secrets.
2. **AI "Generate with AI" button** (corrective action + lesson learned) — still
   a disabled placeholder in the mishap form. Decision pending (see below).
3. **Corrective Action Plans (CAPS)** — see next section; the real format to build
   toward.
4. **More Safety modules** under the umbrella (analytics/input is just the first).

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
tracking view ("what's Complied vs Ongoing"). The AI button, if built, should
draft rows in THIS shape, not a single paragraph.

## AI generation — open decision
Discussed at length. Constraints: only runs when a report is created (occasional);
shared cPanel can't host a local model (no daemon, no GPU, low RAM). Options:
- **Template-based "smart draft"** (recommended for now): pure PHP, keyed on the
  cause + DOTMPLF, tailored with record specifics. Free, private, runs on cPanel,
  no dependency. Somewhat repetitive but it's a draft the officer edits.
- **Small online LLM** (e.g. Claude Haiku): better/varied drafts, ~fractions of a
  cent per click, but data leaves the network + needs a key.
- **Local model (Ollama)**: free + private but needs a VPS/office machine with
  ≥8 GB RAM — NOT possible on the shared cPanel host.
User leaning: small-scale/online, possibly just "tailor a generic response"
(= the template approach). Nothing wired yet, per user's instruction.

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
