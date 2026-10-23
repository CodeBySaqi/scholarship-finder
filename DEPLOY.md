# Deploy — push to `main`, production updates itself

**Short answer: Render (free) + Supabase (free).**
Render gives you exactly what Railway used to: connect the GitHub repo, and every push
to `main` builds and goes live. Supabase holds the data, so a container that is thrown
away and rebuilt never loses anything. Total: **$0**.

- Railway is not free any more: after the 30-day / $5 trial it drops to a plan with **$1 of
  credit per month** and 0.5 GB RAM per service, which does not run a Node server 24/7.
  Hobby is $5/month. ([railway.com/pricing](https://railway.com/pricing),
  [docs.railway.com/pricing/plans](https://docs.railway.com/pricing/plans))
- Koyeb removed its card-free plan in February 2026 (Pro from $29/month).
  ([snapdeploy.dev/state-of-free-hosting](https://snapdeploy.dev/state-of-free-hosting))
- Vercel Hobby is free but **for non-commercial personal use**, and it is serverless — your
  Express process and its filesystem do not exist there.
- Cloudflare Workers free is excellent for static + edge functions, but it is not a Node
  process: Express, `fs` and the JSON store would need a rewrite.

Render free is a real container: Node 20, `npm run build`, `node server/index.js`, your
existing code, git-push deploys.
([render.com/docs/free](https://render.com/docs/free))

---

## This deployment (already done)

| Piece | Value |
| --- | --- |
| Live URL | https://scholarship-finder-5g4o.onrender.com |
| Render service | `scholarship-finder` · `srv-dbdk3559fdbs73bdghrg` · free · frankfurt · autoDeploy on |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `node server/index.js` |
| Health check | `/api/health` (503 if the store is unusable) |
| GitHub repo | `CodeBySaqi/scholarship-finder`, branch `main` |
| Supabase | project `mbxsfcvrbthbgkujlqal`, `https://mbxsfcvrbthbgkujlqal.supabase.co` |
| Env vars | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SF_SECRET`, `NODE_VERSION=20`, `NODE_ENV=production` |

Verified on the live service: login, save, delete, and admin endpoints all round-trip through
Postgres (row `key = main`, `updated_at` moves on every write), and `/api/health` reports
`store.mode: "supabase"` with 17 listings.

### Auto-deploy on push — working now

`autoDeploy` is set to `yes` / `On Commit`, but a Render service created through the **API**
has no GitHub connection behind that switch, so on its own it never fires. Verified on
2026-10-23: a push to `main` (`ff35a6d`) sat for two minutes with **no** deploy, and every
deploy in the service history showed `trigger: api` or `trigger: deploy_hook` — never a push.

Push-to-deploy now works through a **GitHub push webhook that points at the service's Render
Deploy Hook**:

| | |
| --- | --- |
| Webhook | `CodeBySaqi/scholarship-finder` → Settings → Webhooks → id `702097316` |
| Events | `push` (any branch; Render builds its tracked branch, `main`) |
| Target | `https://api.render.com/deploy/srv-dbdk3559fdbs73bdghrg?key=…` |
| Proof | a `ping` delivery returned **200 OK** and immediately triggered a build of `main` |

So `git push origin main` → GitHub POSTs the deploy hook → Render builds and promotes the
commit. No GitHub Actions, no secrets, nothing to click.

Caveats worth knowing:

- The hook URL is a credential. It lives in GitHub's webhook config (visible to repo admins,
  not to the public) and is deliberately **not** in this repo. Regenerating it in Render means
  updating the webhook URL too.
- If Render ever disables the hook, GitHub disables the webhook after repeated failures;
  check Settings → Webhooks → Recent Deliveries.
- The native alternative is Render → `scholarship-finder` → **Settings → Build & Deploy →
  Connect Repo**. That installs Render's own GitHub App and makes `autoDeploy` do the work
  directly; the webhook above then becomes redundant and can be deleted.

---

## What it costs you (and the one trade-off)

| | Free tier | Catch |
| --- | --- | --- |
| **Render web service** | 750 instance-hours/month, no card, custom domain, TLS, preview per PR | sleeps after **15 min** idle; first request after that takes ~1 min |
| **Supabase Postgres** | 500 MB DB, 5 GB egress, 2 projects, no card | a free project **pauses after 7 days with no database activity** |

Two facts that make the combination work:

1. One service running 24/7 is **730 hours** — inside the 750-hour allowance. The problem is
   not the quota, it is the 15-minute sleep.
2. Supabase counts "a few database requests a day" as active, and this app's
   `/api/health` **reads the store**, so a single 10-minute ping keeps *both* awake.

So: point a free uptime pinger (cron-job.org, UptimeRobot, or a GitHub Actions schedule) at
`https://your-app.onrender.com/api/health` every 10 minutes. That keeps Render warm and
Supabase unpaused, and stays inside both free tiers. If the ping ever stops, nothing breaks —
the first visitor waits ~1 minute and the app comes back.

When you want no cold start at all, Render Starter is **$7/month** and the rest of the setup
does not change.

---

## Do it once, in this order

### 1. Supabase — the database (~4 minutes)

1. [supabase.com](https://supabase.com) → New project. Pick the region closest to your users
   (`eu-central-1` for Germany/Pakistan). Save the database password somewhere safe.
2. **SQL Editor → New query** → paste [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   That creates `app_state` (one row holding the app document), turns on RLS and revokes all
   access from `anon`/`authenticated`, so only your server can read it.
3. **Project Settings → API**. Copy two values:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret → `SUPABASE_SERVICE_ROLE_KEY`
     (the service-role key, *not* the `anon` key — it must never reach the browser)

### 2. GitHub — the repo

```bash
cd scholarship-platform-app
git init && git add -A && git commit -m "Scholarship Finder"
git branch -M main
git remote add origin git@github.com:<you>/scholarship-finder.git
git push -u origin main
```

`.gitignore` already keeps `node_modules/`, `dist/` and `.env` out.

### 3. Render — the auto-deploying service (~3 minutes)

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → pick the repo.
   Render reads [`render.yaml`](render.yaml) and proposes the `scholarship-finder` service.
2. It asks for the two secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — paste them.
   `SF_SECRET` (cookie signing) is generated for you.
3. **Apply**. First build ~2 minutes, then you have
   `https://scholarship-finder-xxxx.onrender.com`.

From that moment: **push to `main` → Render builds → production is updated.** Pull requests
get their own preview URL, and every deploy can be rolled back from the dashboard.

### Build note (this bit fails if you skip it)

`NODE_ENV=production` makes `npm ci` skip **devDependencies**, and `vite` is a devDependency —
so the build command must be `npm ci --include=dev && npm run build`. Without `--include=dev`
the deploy fails with `sh: 1: vite: not found`. `render.yaml` and `tools/deploy-render.sh` both
use the correct command.

### 4. First data load

The database starts empty, and the app refuses to seed itself in production (that would
overwrite live edits). Load the real listings once, from your machine:

```bash
# locally, with the Supabase values in .env
npm run seed:remote        # seeds data/db.json, then pushes it to Supabase
```

Then open `https://your-app.onrender.com/api/health` — you want
`store.mode: "supabase"` and `listings: 17`.

### 5. Keep it awake (recommended, free)

cron-job.org or UptimeRobot → HTTP GET `https://your-app.onrender.com/api/health`
every 10 minutes. Success = `200` and a JSON body.

### 6. Your own domain

Render → your service → **Settings → Custom Domain** → add `scholarshipfinder.pk`, then add
the CNAME Render shows at your registrar. TLS is issued automatically. Two custom domains are
free.

---

## How the data survives a redeploy

A free Render container has an **ephemeral filesystem**: every deploy, restart or spin-down
erases it. That is why `data/db.json` alone cannot be the production database.

`server/lib/store.js` now has two modes with one API:

| Mode | When | Where data lives |
| --- | --- | --- |
| `file` | no `SUPABASE_URL` (local dev, audits) | `data/db.json`, as before |
| `supabase` | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set | a single `app_state` row in Postgres |

- Boot: read the row → if it is empty on the first deploy, push the local `db.json` up.
- Every change: debounced 300 ms, then upserted; writes are serialised so the newest wins.
- Shutdown (`SIGTERM`): the last pending write is flushed before the container stops.
- If Supabase is unreachable at boot, the app **falls back to the local file and keeps
  serving** instead of starting empty; a failed write flips it to file mode and retries every
  5 seconds.
- `/api/health` returns **503** when the store is unusable, so Render keeps the previous
  deploy instead of routing traffic to a broken one.

**Verified, not assumed** — against a stand-in PostgREST server: an empty remote received the
seed on boot; a save written after boot was still there after the local file was deleted and
the process restarted, with `store.mode: "supabase"`; a dead Supabase URL fell back to the
file; with no local file either, `/api/health` returned 503. The identity suites still pass in
file mode (83 + 114 + 20).

### When to move to real tables

The document-in-one-row design is right for one app instance and a data set of a few hundred
KB — it is what lets the synchronous API stay unchanged. Move to proper tables when you get
any of these: more than one instance writing, reporting queries over listings, or per-user
row permissions in the database. `supabase/schema.sql` ends with a commented-out relational
schema (listings, universities, profiles, saved items, error reports, audit log, plus indexes
and an append-only rule on the audit log) as the starting point.

---

## Local vs production

```bash
# local, file store, nothing to configure
./up.sh

# local against the hosted database (same data as production)
cp .env.example .env      # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
node server/index.js      # health shows store.mode: "supabase"
```

`.env` is loaded by Node 20's `--env-file` when you use `npm run start:env`, or export the
variables yourself. It is gitignored.

## If you outgrow the free tier

| Need | Move to | Cost |
| --- | --- | --- |
| No cold starts | Render Starter | $7/mo |
| Never-paused database, backups, point-in-time recovery | Supabase Pro | $25/mo |
| Both, plus a second instance | Render Starter ×2 + Supabase Pro | ~$39/mo |

Nothing in the code changes for any of those — same `render.yaml`, same env vars.

## Checklist for every future change

1. `git push` to `main`.
2. Render builds automatically; watch the deploy log in the dashboard.
3. `GET /api/health` → `200`, `store.mode` as expected.
4. Optional but worth it: run the audit suites against the deployed URL before you announce a
   big change — `BASE=https://your-app.onrender.com node audit/failure-modes.mjs`.
