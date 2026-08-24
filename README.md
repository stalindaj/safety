# 15SW Mishap Records

**Mishap records & safety dashboard**
15th Strike Wing — Wing Safety Office, Philippine Air Force

Captures every reported mishap — its **accident/incident** classification and
**ground/flight** environment — in one searchable log, and rolls the history up
into a dashboard (yearly trend, ground-vs-flight split, monthly breakdown, top
locations). Ships seeded with the CY 2016–2026 historical record.

> **Planned:** AI-assisted drafting of *corrective action* and *lesson learned*
> from a mishap's description. The columns and form fields already exist (the
> "Generate with AI" button is a disabled placeholder); only the generator is
> still to be wired up.

---

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | PHP 8.3 (Composer pinned via `platform.php`) |
| Framework | Laravel 13 |
| Frontend | React 18 + Inertia.js, Tailwind CSS 4, Vite 7, Recharts |
| Database | SQLite locally, MySQL (InnoDB) in production |
| Tests | PHPUnit |

Same stack and deploy model as the sibling 15SW apps (ITMSMS, CivDir):
`vendor/` and `public/build/` are committed because the production host has no
SSH, Composer, or Node.

---

## Local setup

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
npm run build
php artisan serve
```

Then sign in at <http://localhost:8000/login>.

| Email | Password | Role |
| --- | --- | --- |
| `superadmin@15sw.paf.mil.ph` | `ChangeMe!2026` | admin |

Change it the moment you go live — sign in, click your name (top-right) to open
the **Account** screen, and set a new password.
For iterative work run `npm run dev` alongside `php artisan serve`.

---

## Screens

| Screen | Route | What it does |
| --- | --- | --- |
| Safety Dashboard | `/` | Totals, YTD stats, yearly trend, ground/flight pie, monthly bars, top-5 locations |
| Mishap Records | `/mishaps` | Searchable/filterable log; add, edit, delete records via modal |

### Data model — `mishaps`

| Field | Notes |
| --- | --- |
| `mishap_date` | date of the mishap |
| `location` | e.g. MDAAB, TOG 9, Cavite City (nullable) |
| `mishap_type` | `accident` \| `incident` |
| `environment` | `ground` \| `flight` |
| `description` | narrative |
| `corrective_action`, `lesson_learned` | nullable; filled post-investigation (AI drafting planned) |

---

## Seeding

Both seed profiles load the superadmin account plus the CY 2016–2026 historical
mishap record (real reference data, not throwaway samples), so the dashboard has
numbers on first boot.

| Seeder | Loads |
| --- | --- |
| `ProductionSeeder` (default on `/setup`) | superadmin + historical mishaps |
| `DatabaseSeeder` (`/setup?demo=1`, local `--seed`) | same baseline |

```bash
php artisan migrate:fresh --seed        # DatabaseSeeder
php artisan db:seed --class=MishapSeeder # re-import history only (idempotent)
```

Seeders are idempotent — re-running updates rather than duplicates. The historical
records were imported from *15SW Historical Record of Mishaps.xlsx* into
`database/seeders/MishapSeeder.php`.

---

## Testing

```bash
php artisan test
```

---

## Deployment

See **[DEPLOY-PLAYBOOK.md](DEPLOY-PLAYBOOK.md)**. The short version: the host has
no SSH/Composer/Node, so `vendor/` and `public/build` are committed, you build
locally and push, cPanel pulls, and `/setup/{token}` runs the migrations + seed
from the browser. Blank `SETUP_TOKEN` afterwards.

### Unit artwork

`public/img/wing-seal.png` already carries the wing seal used in the header and
login. Replace it to update the artwork everywhere.
