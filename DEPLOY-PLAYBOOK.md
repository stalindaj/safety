# DEPLOY PLAYBOOK — 15SW Mishap Records

Deploying to cPanel shared hosting with **no SSH, no Composer, no Node** on the
server. Everything here was learned the hard way on a previous deploy; follow
the order and you will not repeat it.

---

## 0. The constraints that shape everything

| Constraint | Consequence |
| --- | --- |
| No shell on the server | `vendor/` and `public/build` are **committed to the repo**. Build locally, push, pull. |
| No Composer/Node on the server | Never run install/build remotely. It cannot work. |
| PHP version is account-wide only | Per-domain overrides are impossible on this host. Target whatever the account is set to. |
| Document roots forced under `public_html` | The whole repo — including `.env` — sits in the web tree. The root `.htaccess` is load-bearing. |
| Server clock is UTC | App timezone is pinned to `Asia/Manila`. Logs stay UTC; that is expected. |

Do not try to work around the PHP version. We already tried every door:
CloudLinux PHP Selector (per-domain locked by the server admin), MultiPHP
Manager (not installed), `.htaccess AddHandler` (ignored — PHP files download
as plain text), CGI wrapper (execution disabled). The account-wide version is
the only one you get.

---

## 1. Before you push anything (local)

```bash
npm run build
```

Then confirm the tree is clean and that these are **staged, not ignored**:

- `vendor/`
- `public/build/`

`.gitignore` documents why. If you ever "clean up" by ignoring them, the
deploy stops working with no obvious error.

Pin Composer to the host's PHP version so it never resolves a dependency that
needs something newer:

```bash
composer config platform.php 8.3.0
```

> Check the account's actual version in cPanel → **Select PHP Version** first.
> If it is not 8.3, change the pin to match and run `composer update`.

---

## 2. Go-live order

Work top to bottom. Each step assumes the previous one succeeded.

### 2.1 Create the database

cPanel → **MySQL® Databases**

1. Create the database, e.g. `cpaneluser_mishaps`.
2. Create the user, e.g. `cpaneluser_mishaps`.
3. Add the user to the database with **ALL PRIVILEGES**.
4. **Save the password now.** You cannot read it back later.

### 2.2 GitHub access token

Create a **fine-grained personal access token**: read-only, scoped to this
single repository. cPanel's Git client only needs to pull.

### 2.3 Clone the repo

cPanel → **Git™ Version Control** → Create

- Clone URL: `https://<token>@github.com/<you>/<repo>.git`
- Repository path: `public_html/mishaps`

### 2.4 Point a subdomain at `public/`

cPanel → **Domains** → Create a domain

- Domain: `mishaps.yourdomain.com`
- Document Root: `public_html/mishaps/public`

The document root must be the `public/` directory — never the repo root.

### 2.5 Confirm PHP version

cPanel → **Select PHP Version**. Note the version. It must satisfy the
`"php"` constraint in `composer.json` (`^8.3`). If it does not, fix the pin
locally, `composer update`, rebuild, commit, push, pull — then continue.

### 2.6 Create `.env`

cPanel → **File Manager** → `public_html/mishaps/.env`

Copy `.env.example` and set:

```dotenv
APP_NAME="15SW Mishap Records"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://mishaps.yourdomain.com
APP_TIMEZONE=Asia/Manila

APP_KEY=

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=cpaneluser_mishaps
DB_USERNAME=cpaneluser_mishaps
DB_PASSWORD="the-password-you-saved"
DB_ENGINE=InnoDB

SETUP_TOKEN=paste-a-long-random-string-here

FORCE_HTTPS=false
SESSION_SECURE_COOKIE=false
```

Two traps:

- **Wrap `DB_PASSWORD` in double quotes.** A `#` anywhere in a generated
  password silently truncates the value, and you get an auth error that looks
  like the wrong password.
- **`APP_KEY` must be set.** There is no shell to run `key:generate`, so
  generate one locally with `php artisan key:generate --show` and paste the
  whole `base64:...` string.

### 2.7 Run the installer

Visit:

```
https://mishaps.yourdomain.com/setup/<SETUP_TOKEN>
```

It runs `migrate --force`, seeds the **clean production baseline**, and rebuilds
the config and route caches. Output is plain text — read it.

The baseline seeds:

- the superadmin login account,
- the CY 2016–2026 historical mishap record (imported from the Wing's
  workbook — real reference data, not samples).

From there, staff add new mishaps through the UI.

> **Re-seeding later:** the installer auto-seeds only a virgin install (no
> users yet). After that, append `?seed=1` to reseed. Re-seeding never
> duplicates — every seeder is idempotent (keyed on date + location +
> description for mishaps, on email for the account). `?demo=1` loads the same
> baseline via `DatabaseSeeder`.

**Then blank `SETUP_TOKEN` in `.env` immediately.** An empty token makes the
route 404 for everyone, including you.

### 2.8 Issue the certificate

cPanel → **SSL/TLS Status** → select the subdomain → **Run AutoSSL**

Wait for the certificate to be issued and confirm `https://` loads clean.

### 2.9 Turn on HTTPS enforcement

Only after 2.8 succeeds, edit `.env`:

```dotenv
FORCE_HTTPS=true
SESSION_SECURE_COOKIE=true
```

Doing this before the certificate exists locks you out — the secure cookie is
never sent over plain HTTP, so login silently fails.

### 2.10 (optional) PHP limits

This app has no file uploads, so the stock cPanel PHP limits are fine. No
MultiPHP INI changes are required.

---

## 3. Every deploy after the first

```bash
# local
npm run build
git add -A && git commit -m "..." && git push
```

Then cPanel → **Git™ Version Control** → **Manage** → **Pull or Deploy** →
**Update from Remote**.

If you changed anything in `config/` or `routes/`, visit `/setup/<token>`
again with the token temporarily restored — it rebuilds the caches — or delete
`bootstrap/cache/config.php` and `bootstrap/cache/routes-v7.php` in File
Manager.

---

## 4. Debugging on a host with no terminal

You get "500 Server Error" and nothing else while `APP_DEBUG=false`.

1. File Manager → `storage/logs/laravel.log`. **Timestamps are UTC**, not
   Manila — an entry that looks 8 hours stale is probably the one you want.
2. If the log is empty, temporarily set `APP_DEBUG=true`, reload, read the
   real exception, then **set it back to `false` immediately**. Leaving it on
   exposes `.env` values in the stack trace.

### Symptom → cause

| Symptom | Cause |
| --- | --- |
| `Specified key was too long; max key length is 1000 bytes` | MySQL fell back to MyISAM. Confirm `DB_ENGINE=InnoDB` in `.env`. |
| PHP files download as text | `.htaccess AddHandler` was added. Remove it; it does not work here. |
| Login redirects back to the form, no error | `SESSION_SECURE_COOKIE=true` without a valid certificate. |
| `/setup/...` returns 404 | `SETUP_TOKEN` is blank (correct after install) or does not match. |
| Dates land on the wrong day | `APP_TIMEZONE` missing. Should be `Asia/Manila`. |
| Anyone can fetch `/.env` | The repo-root `.htaccess` was deleted. Restore it. |
| Assets 404 | `public/build` was not committed, or `npm run build` was skipped. |

---

## 5. Security checklist before you call it live

- [ ] `APP_DEBUG=false`
- [ ] `APP_ENV=production`
- [ ] `SETUP_TOKEN` blank
- [ ] Certificate issued, `FORCE_HTTPS=true`, `SESSION_SECURE_COOKIE=true`
- [ ] `https://yourdomain.com/mishaps/.env` returns 403
- [ ] Superadmin password changed from `ChangeMe!2026`
- [ ] Database user has privileges on this database only

### Seeded account

| Email | Role | Password |
| --- | --- | --- |
| `superadmin@15sw.paf.mil.ph` | admin | `ChangeMe!2026` |

Change it on day one. It exists only so you can get in after the installer runs.
