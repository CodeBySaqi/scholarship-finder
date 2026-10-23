# Scholarship Finder (scholarpath)

**Live: https://scholarship-finder-5g4o.onrender.com** — deployed 2026-10-23, running against a
real Supabase Postgres database. Every push to `main` on
[CodeBySaqi/scholarship-finder](https://github.com/CodeBySaqi/scholarship-finder) rebuilds and
redeploys it automatically.

| | |
| --- | --- |
| App | https://scholarship-finder-5g4o.onrender.com |
| Health | [`/api/health`](https://scholarship-finder-5g4o.onrender.com/api/health) → `store.mode: supabase` |
| Repo | https://github.com/CodeBySaqi/scholarship-finder (public, `main`) |
| Database | Supabase project `mbxsfcvrbthbgkujlqal`, region eu-central-1, table `app_state` |
| Host | Render free web service `scholarship-finder` (`srv-dbdk3559fdbs73bdghrg`), Frankfurt |
| Demo logins | `admin@example.com` / `demo1234` · `ayesha@example.com` / `demo1234` |

First request after 15 idle minutes takes ~1 min (free tier cold start). A daily
`.github/workflows/keepalive.yml` job pings `/api/health` so neither the Render service nor the
Supabase project falls asleep.


## What is in this build

**For students.** Profile wizard, matched scholarships and German programs (only the ones you
meet, or nearly meet), saved list with deadlines, a notification inbox, light/dark theme, and a
header search that filters the catalogue from anywhere in the app.

**Notifications — one system for every role.** A bell in the top bar with an unread count, a
popup with the newest items, and `/notifications` for the full list with an unread filter.
Opening a notification marks it read; "mark all read" clears the badge. The same component
serves students, contributors and admins.

**Admin console.**

| Page | What it does |
| --- | --- |
| Dashboard / queue / errors | Review state, stale listings, open error reports |
| Scholarships & programs | Table with view-all (eye), edit, public page and delete per row |
| Universities | Add, edit, delete (delete refuses while programs point at it) |
| AI research | Pick scholarship / program / university, give a URL or pasted text, get a filled form, save it as a draft |
| Users & roles | View every detail of an account, edit name/email/role/status, ban, unban, delete |
| Broadcast | Send a notification to everyone, to one person, or to a hand-picked group |
| Audit log | Append-only record of every editorial action |

**Settings → Site & AI (admins only).** Site name, tagline, support email, the AI provider,
model, base URL and API key, and the on/off switch for the research agent. The key is stored
server-side, returned masked, and never reaches a contributor or a student.

**Safety rails that the server enforces**, not just the UI: you cannot ban or delete yourself,
delete the last active admin, delete a university that still has programs, publish your own
listing (four-eyes rule), or save a research result as anything other than a draft.

## Testing

```bash
# API + logic, against a server on :8000
node audit/api-matrix.mjs        # 83 identity × endpoint checks
node audit/feature-logic.mjs     # 114 matching / publish-gate checks
node audit/data-integrity.mjs    #  20 data-set checks

# Browser-free UI suites (happy-dom drives the real React app)
npm install --no-save happy-dom
./audit/run-dom.sh smoke         # every route × student / admin / contributor
./audit/run-dom.sh features      # notifications, admin CRUD, broadcast, research, search
```

The Playwright suites (`ui-roles`, `wizard-e2e`, `flows`, `failure-modes`, `page-crawl`) need a
Chromium binary and system libraries; run them where those exist.

## Responsive design

One layout, four ranges, all driven from `src/styles/react.css`. Nothing in `tokens.css` or
`app.css` was restyled to get there — the responsive layer is additive.

| Width | Layout |
| --- | --- |
| ≤ 399 px | compact top bar; greeting truncates instead of pushing icons off; stacked admin rows |
| 400–767 px | **phone**: off-canvas sidebar drawer, bottom tab bar, stacked admin tables, sheets slide up from the bottom, header search expands on tap |
| 768–1023 px | **tablet**: inline header search, two-up cards, real table columns, centred modal sheets |
| ≥ 1024 px | **desktop**: persistent sidebar (collapsible), full tables, three-up grids |

Details that matter on a real phone:

- Admin tables become **cards**: below 720 px each row is a bordered block and every cell carries
  its column name through `data-label`, so a seven-column table stays readable instead of
  scrolling sideways.
- The **drawer** under 1024px is driven by a live media-query listener, so it can never be
  half-open after a resize or a rotation; `Escape`, the scrim, or picking any option closes it.
  It sits above its own scrim (45 > 44) — the sheet-elevation rule is scoped
  `:not(.side-scrim)` so it cannot cover the menu.
- The app and the console each get a **bottom tab bar** (the console: Overview, Queue, Listings,
  Send, Alerts). While the drawer is open the bar steps aside (`body.drawer-open`) and returns
  the moment it closes. It is `position: fixed` on phones only — it stays on the glass while the page
  scrolls, the page reserves its height so nothing hides behind it, and it disappears entirely
  from 768 px up. The sidebar opens as a drawer with a tap-to-close scrim.
- **Every** admin table stacks on a phone: users, listings, universities, error reports and the
  audit log. No table scrolls sideways.
- **Header search** collapses to an icon and expands into a full-width field under the bar.
- Inputs are 16 px below 640 px so iOS does not zoom on focus; hit targets are 44 px on coarse
  pointers; the drawer never exceeds `100vw - 32px`; safe-area insets are respected.
- `overflow-x: clip` (with a `hidden` fallback) stops sideways scroll without breaking the sticky
  top bar.

`./audit/run-dom.sh responsive` checks the phone and tablet behaviour — drawer vs column,
search expansion, stacked labels, bottom bars, sheet content — **39 checks**.
`node audit/responsive-css.mjs` checks the built stylesheet itself: that the fixed bar lives in
the phone breakpoint, that it is declared after the sticky rule, that it is hidden from 768 px,
and that the page reserves its height — **17 checks**.

## Run it

```bash
cd scholarship-platform-app
./up.sh                # install if needed, build if needed, serve on :8000
```

or step by step:

```bash
npm install            # dependencies
npm run build          # vite build → dist/
npm run seed           # optional: reset data/db.json to the shipped data set
npm run seed:remote    # same, and push it to Supabase (needs SUPABASE_URL + service key)
PORT=8000 npm start    # Express serves /api and dist/ (SPA fallback) on 0.0.0.0:8000
```

`./up.sh --rebuild` forces a fresh client build. `node_modules/` and `dist/` are build
artefacts and are not part of the repository — `up.sh` recreates them when they are missing.

Development with hot reload:

```bash
PORT=8000 node server/index.js   # API on :8000
npm run dev                      # Vite on :5173, proxies /api → :8000
```

`data/db.json` is the database (users, profiles, listings, saved rows, reports, settings,
audit log). Delete it and run `npm run seed` to start over — **stop the server first**, the
store keeps the file in memory and would write its cached copy back over the fresh seed.

## The data set

`server/lib/reference.js` holds the shipped records. Every listing is a real German
scholarship or degree programme, read from the provider's own page:

| ID | Record | Source |
| --- | --- | --- |
| S1 | DAAD study scholarships, master studies, all disciplines (deadline 16 Nov 2026) | `daad.de` scholarship database, detail 50026200 |
| S2 | Heinrich Böll Foundation study scholarships (1 Mar 2027) | `boell.de/en/application` |
| S3 | DAAD Helmut-Schmidt-Programme / PPGG (end of July) | `daad.pk` scholarship programmes page |
| S4 | Christiane Nüsslein-Volhard Foundation, women with children (30 Nov 2026) | `cnv-stiftung.de/scholarships` |
| S5 | Deutschlandstipendium, TU Dresden (1–15 Jul 2027) | `tu-dresden.de` |
| S6 | Deutschlandstipendium, FAU Erlangen-Nürnberg (closed, annual) | `fau.eu` |
| S7 | MSc Environmental Governance, Freiburg — AI draft, never published | `daad.pk` EPOS announcement |
| S8 | DAAD architecture scholarships — last verified Feb 2026, hidden as stale | `daad.pk` |
| S9 | Deutschlandstipendium, HU Berlin (9 Nov – 6 Dec 2026) | `deutschlandstipendium.hu-berlin.de` |
| P1 | M.Sc. Informatics, TUM (1 Feb – 31 May 2027) | `cit.tum.de` |
| P2 | M.Sc. Information Systems, TUM (GRE/GATE for Pakistani degrees) | `cit.tum.de` |
| P3 | M.Sc. Computer Science, RWTH Aachen (non-EU deadline 1 Mar 2027) | `rwth-aachen.de` |
| P4 | B.Sc. Informatik, TU Berlin (Studienkolleg route, German C1) | `tu.berlin` |
| P5 | M.Sc. Computer Science, Ruhr-Universität Bochum (15 Dec 2026) | `informatik.rub.de` |
| P6 | M.Sc. Software Systems Engineering, RWTH (GRE above the 75th percentile) | `sc.informatik.rwth-aachen.de` |
| P7 | M.Sc. Data Engineering and Analytics, TUM | `cit.tum.de` |
| P8 | B.Sc. Physics, LMU — AI draft, never published | `lmu.de` |

Each record carries `sourceUrl` (the page it was read from), `lastVerified` (the day an
editor last checked it) and, for the two AI drafts, the `sourceSnapshot` plus the evidence
sentence for every extracted field. Where an official page does not state a number — a
semester contribution, an IELTS band — the field stays empty and the UI says "not stated"
instead of inventing one. `lastVerified` older than 180 days (S8) hides the record from
students until an editor rechecks it.

## Deploy — push to `main`, production updates itself

**Render (free) + Supabase (free).** Render deploys on every push to `main` (pull requests get
preview URLs); Supabase holds the data so a rebuilt container loses nothing. Full walkthrough,
limits and trade-offs: **[DEPLOY.md](DEPLOY.md)**.

```bash
npm run seed:remote     # seed data/db.json, then push it to the hosted database (once)
```

| File | What it is |
| --- | --- |
| `render.yaml` | Render blueprint: free Node service, `autoDeploy: true`, health check, env vars |
| `supabase/schema.sql` | the table, RLS, and a commented-out relational schema for later |
| `.env.example` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SF_SECRET` |
| `server/lib/store.js` | one API, two modes: `file` locally, `supabase` in production |

The free tier sleeps after 15 minutes idle and a free Supabase project pauses after a week
without queries — one 10-minute ping to `/api/health` prevents both, because that endpoint
reads the store. `/api/health` returns 503 when the store is unusable, so a bad deploy is never
promoted.

## Demo accounts — password `demo1234`

| Email | Role | Notes |
| --- | --- | --- |
| `ayesha@example.com` | student | full profile (96 %), saved rows, reports |
| `bilal@example.com` | student | mid-completion profile |
| `sana@example.com` | student | thin profile, triggers the provisional banner |
| `contributor@example.com` | contributor | can draft listings, cannot publish |
| `admin@example.com` | admin | two-person publish gate, full console |

The login screen also has one-tap "Continue as demo …" buttons. Signing up creates a real
account with a verification token; "I have verified my email" completes it.

## Routes

Public: `/`, `/scholarships`, `/programs`, `/terms`, `/privacy`, `/login`, `/signup`,
`/verify-email`, `/forgot-password`, `/reset-sent`, `/reset-password`, `*` → 404.

Student (auth required): `/dashboard`, `/matches`, `/scholarships`, `/programs`,
`/scholarship/:id`, `/program/:id`, `/saved`, `/profile`, `/wizard?step=1..5`, `/settings?tab=`.

Admin (`/admin`, admin or contributor; publishing needs admin): `/admin`,
`/admin/listings`, `/admin/listings/new`, `/admin/listings/:id`, `/admin/queue`,
`/admin/ai-draft` (create) and `/admin/ai-draft?id=…` (evidence review), `/admin/errors`,
`/admin/universities`, `/admin/users`, `/admin/logs`.

A signed-out visitor is sent to `/login?next=…` and returned there after login. A student
opening `/admin/*` stays on the URL and gets an **Admin access required** card that names
their role and offers "Back to your dashboard" and "Sign in as someone else" — never a blank
screen. If the API cannot be reached at start-up the app shows a **Cannot reach the server**
card with a retry button; if a single page's data fails to load, that page keeps its shell and
shows a **This could not load** card with **Try again** (the request is retried once
automatically first, so a restarting server usually recovers on its own); an expired session
is sent to `/login?next=…`; and a failing render is caught by an error boundary that shows
the message plus a reload link. The design-system (`/components`) and states (`/states`) pages of
the prototype are gone.

## What is real

- **Auth** — signed HTTP-only session cookie, scrypt-hashed passwords, email verification
  tokens, password reset tokens (`/forgot-password` → `/reset-sent`), role checks on every
  admin route, `requireUser` / `requireAdmin` / `requireContributor` middleware.
- **Profile + wizard** — 5-step wizard writing to the profile; completeness is computed from
  the same weights the server uses for matching (the progress bar, the dashboard card and the
  provisional-listing rules all read the one number).
- **Matching engine** — `server/lib/match.cjs` (the prototype's rules, unchanged) ranks every
  listing into *meets / almost / next cycle / hidden*, produces per-listing reasons, gap lists,
  IELTS expiry rules, age-at-deadline, grade conversion, and a "freshness" state
  (verified / needs recheck / stale). Browse, detail pages, Dashboard, Matches and Saved all
  read these results; nothing is hard-coded in the UI.
- **Browse + filters** — search, degree level, funding, deadline window, "IELTS not required",
  "verified in last 30 days", "only what I meet"; sort by deadline / recently verified / best
  fit. Filters live in the URL, so they are shareable and survive reload.
- **Saved list** — add/remove anywhere, private notes per row, deadline tracking.
- **Error reports** — students file a report from a listing; two open reports add the
  "2 open reports" tag for everyone and push the listing into the admin queue.
- **Admin console** — overview KPIs, listing table with status/freshness, the full 3-group
  listing editor, publish gate (three group confirmations **and** admin **and** a different
  person from the author), review queue, error reports (resolve / dismiss), universities
  (add + program counts), users & roles (role change, deactivate, invite), audit log with
  action filters.
- **AI draft** — `POST /admin/ai-draft` accepts a source URL + page text and extracts title,
  provider, deadline, minimum CGPA, minimum IELTS and maximum age. A field is kept **only**
  when its evidence sentence appears verbatim in the pasted text; everything else is left
  null and shown as "no evidence". The result is always a `draft` flagged `draftedByAi`,
  carrying its `sourceSnapshot`; it can never publish itself. The reviewer page shows the
  evidence beside each field and lets a human accept or drop fields.
- **Audit log** — every write appends `{adminId, action, entityType, entityId, detail}`.

## Rules the server enforces (not just the UI)

- **One visibility rule** — `canSeeListing()`: a listing is readable when it is published, or when the
  caller is admin/contributor. It guards the feed, the detail page, matches, saved rows and error
  reports, so a draft can never be pulled into a student's list.
- **Public payloads are filtered** — `createdBy`, `verifiedBy`, `evidence`, `sourceSnapshot` and
  `draftedByAi` are stripped for non-staff; students never see an account email.
- **Four eyes, alias-aware** — publishing needs admin, all three review groups, and a *different*
  person from `createdBy`. `"admin"` and `"admin@example.com"` compare as the same actor.
- **No publishing shortcut** — `mark-verified` only refreshes freshness on an already-published
  listing; drafts and stale content go through the publish gate.
- **Profile writes are validated** — `sanitizeProfile()` coerces numbers, ISO dates, enums and arrays
  and drops anything else, so bad input cannot reach the matching engine. `safeMatchOne` /
  `safeResultsFor` degrade to a neutral result instead of throwing.
- **Sessions** — HMAC-signed cookie; sign-out revokes that token, a password reset invalidates every
  session for the account, and deactivating a user ends their live sessions immediately.

`AUDIT.md` records the full multi-user audit (451 checks across ten suites) and the defects
it found and fixed. One suite exists for one promise: **no page ever blanks out** —
`audit/failure-modes.mjs` fails every page's endpoint on purpose and checks that a card with
a retry appears instead of an error screen.

## Deliberate limits

- No e-mail is sent: verification and reset tokens are returned in the API response and shown
  on screen (and printed by the server console) so the flows are testable offline.
- Uploads (documents) are stored as the checklist state only, not as files.
- The store is single-process and synchronous. In production it keeps the document in one
  Postgres row (Supabase) and writes it after every change, which is what makes redeploys
  safe; it is a document, not relational tables, so several instances writing at once would
  need the relational schema at the end of `supabase/schema.sql`.
- The one-tap demo logins and the demo-profile rows stay for now; the data itself is real.
- The six home-page design variants live in the static prototype folder; the React app ships
  the chosen landing page.
