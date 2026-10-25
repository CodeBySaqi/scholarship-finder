# Multi-user audit — every role, every feature, no overlaps

Date: 2026-10-22 · against the running app (`PORT=8000 node server/index.js`),
seeded from the real data set (`server/lib/reference.js`), fresh browser contexts per identity.

**Result: 451 automated checks, all green** (376 before the failure-mode suite was added).

| Suite | What it proves | Checks |
| --- | --- | --- |
| `audit/api-matrix.mjs` — identity × endpoint matrix | anonymous / student / contributor / admin see exactly what they should at the API | 83 / 83 |
| `audit/feature-logic.mjs` — feature logic per role | each feature computes the right answer for each account | 114 / 114 |
| `audit/data-integrity.mjs` — data integrity | no row is shared, orphaned or attributed to a stranger | 20 / 20 |
| `audit/ui-roles.mjs` — per-role browser matrix | every route opens for the role that owns it and bounces the rest | 93 / 93 |
| `audit/wizard-e2e.mjs` — wizard end-to-end | all five steps save exactly what was typed, to 100 % | 19 / 19 |
| `audit/flows.mjs` — core flows | signup → verify → dashboard, save/note, publish, AI draft, reports, dark theme | 19 / 19 |
| `audit/failure-modes.mjs` — no blank pages | every page with its own endpoint failing (500 and unreachable), API down at boot, missing id, expired session | 75 / 75 |

## Round 3 — notifications, admin CRUD, research, dark mode (2026-10-23)

Added: a notification system shared by every role, full admin management of users / listings /
universities, a broadcast composer, an AI research agent with admin-only settings, a working
sidebar collapse, a working header search, and the removal of the demo controller, the
"every screen in this app" sitemap and the admin-console footer link.

| Suite | What it proves | Result |
| --- | --- | --- |
| `audit/api-matrix.mjs` | identity × endpoint matrix still holds | 83 / 83 |
| `audit/feature-logic.mjs` | matching, publish gate, freshness unchanged | 114 / 114 |
| `audit/data-integrity.mjs` | no shared, orphaned or misattributed rows | 20 / 20 |
| `audit/dom-smoke.mjs` | 37 route × role combinations render without crashing | 37 / 37 |
| `audit/features-admin.mjs` | notifications, admin CRUD, broadcast, research, settings visibility, search | 69 / 69 |

Run them with `./audit/run-dom.sh smoke` and `./audit/run-dom.sh features` (needs `happy-dom`;
the harness bundles the real components, so it exercises React, the router and the live API).

What the new suites check, in plain terms:

- a notification opens, shows its full body, and is marked read **on the server**, not just in the list
- the bell badge matches the server's unread count, and "mark all read" clears it
- a banned account is refused at sign-in and gets an "Account updated" notification when the ban is lifted
- an admin edit reaches the database; a student and a contributor never see the Site & AI tab
- the broadcast composer refuses an empty title, an empty body, or no recipients, and records who received it
- the research agent fills a form from pasted text (title, deadline, CGPA, IELTS) and saves it as an
  unpublished draft; the provider badge says `extract` when no key is configured and names the model when one is
- the header search filters the catalogue at `/scholarships?q=` / `/programs?q=` and offers the other collection


## Round 4 — responsive audit (2026-10-23)

Phone (390 px), tablet (768–820 px) and desktop (1024 px) are checked by
`audit/responsive.mjs` — **36 / 36**. It drives the real components at each width:

- the menu button opens the *drawer* on a phone and the *collapse* on desktop — never the wrong one
- the header search is hidden behind a toggle on a phone, opens on tap, submits, and closes
- every cell of the three admin tables carries a `data-label`, and the label count equals the
  header column count (so nothing renders an unlabelled card row)
- the student and admin bottom bars each have five working destinations
- sheets, the broadcast recipient picker and the research form all render at 390 px
- at 820 px the table keeps its real header row and the search field is inline

The bottom bar is `position: fixed` **only below 768 px**: it no longer scrolls away with a long
list. `audit/responsive-css.mjs` proves it from the built stylesheet — the rule sits in the phone
breakpoint, is declared after the sticky base rule (so it wins), the bar is `display:none` from
768 px up, the page reserves `84px + safe-area` underneath, toasts clear it and an open sheet
covers it (**17/17**). Error reports and the audit log were also converted to stacked cards, so
**every** admin table stacks on a phone (asserted: zero plain tables).

**Round 4b — the grey-overlay regression.** A rule added for sheets
(`.scrim.is-open { z-index: 62 }`) also matched the *sidebar* scrim, lifting it above the drawer
(45) so the menu looked grey and no option could be tapped. Fixed by scoping the elevation rule to
`:not(.side-scrim)`, mounting the sidebar scrim only while the drawer is open, driving `wide` from
a live media-query listener, and making collapse/drawer mutually exclusive. The bottom bar now
hides while the drawer is open (`body.drawer-open`) and returns when it closes.

The test harness grew a real `matchMedia` stub that parses min/max-width and fires `change` on
resize, so a phone → desktop resize is an actual test rather than an assumption.

**Round 4c — the Matches switch looked shrunken.** `app.css` carries
`@media (max-width:560px) { .tabs button { padding: 0 9px; font-size: 12px } }`, so the
Scholarships / Programs switch was *smaller* on a phone than on tablet (13px) or desktop. The phone
layer now sets 46px height, 14px text, 14px padding and equal-width halves — bigger, not smaller —
with a 399px trim that keeps the height. A CSS-order assertion proves the override wins.

**Round 4d — contextual filters on Matches, then made compact.** The three switches that used to
live in the right rail were replaced by a filter card directly under the Scholarship / Program
switch. The first version listed every group as its own labelled chip row — seven groups on a
programme tab — which read as a wall of controls. It is now two rows: four match pills and a row of
selects, with a quiet footer. Options stay per tab (scholarship: Funding, Degree; programme:
Tuition, Language, Degree, Intake; shared: Country, Deadline, Hide needs-recheck), each option
carries its count, impossible options are disabled, a group with a single possible value is dropped
entirely, and counts for the Match group are computed inside the bucket so "Almost there" no longer
reports the total. Layout: auto-fit across one line on a laptop, three per row on a tablet, two on a
phone, one below 400px; selects are 42px and 16px on phones so the native picker does not zoom.

**Round 6 — ScholarPath module (2026-10-25).** A second matching module built to a
"matters-only" brief: 13 hard programme fields, a 3-step profile, three verdicts
(Eligible / Check manually / Not eligible) and no target field. Engine in
`src/path/engine.js` (pure, shared by client and server), catalogue in
`data/path-programmes.json` (evidence-only, `null` where unverified), profile in
`db.pathProfiles`, API under `/api/path/*`.
New suites: `audit/path-tests.mjs` **41/41** (all eight required cases) and
`audit/path-pages.mjs` **22/22** (fields on `/profile`, badges on the real cards,
the reason panel on a live programme page).

The first design gave ScholarPath its own `/path` pages. That was scrapped: the
student enters the fields on `/profile` and the verdict has to appear on the
programmes themselves. The routes, the nav entry and both page components were
deleted; `/api/path/catalogue` and `/api/path/matches` were replaced by one
`GET /api/path/verdicts?kind=`, computed server-side for the live listings, so a
listing with no verified requirement row is a **manual check** rather than
eligible-by-default. Two defects came out of the live run of that endpoint: the
route says `/scholarships` but the listing rows say `scholarship`, so the
scholarship page was served programme verdicts (now normalised in one place, and
pinned by a UI check), and an unset target level was being reported as
*Not eligible* with the reason "you are applying for null" — on both the
programme and the scholarship path it is now `pending`, i.e. Check manually. Deleting the pages also removed the positional tab-bar
hazard, and `responsive` stayed **83/83**.
Two defects it caught in the legacy shell: adding a sidebar item silently
rewrote the phone tab bar (it indexes `STUDENT_NAV` positionally — now pinned by
route), and a "check manually" card could read "Meets every stated requirement"
when the cause was a pending profile value (headline now says which).

Regression suites re-run after the change: api-matrix 83/83, feature-logic 114/114,
data-integrity 20/20, dom-smoke 37/37, features-admin 69/69, **responsive 83/83**,
**responsive-css 34/34**, **research 41/41**.

**Round 5 — the AI research agent, audited (2026-10-24).** `audit/research-check.mjs`
(new) drives the whole feature: 41/41. It found and fixed three defects:
(1) age limits and deadlines written the way official pages actually write them were
missed: the verb "close" without the -s ("Applications close on 2 February 2028"), a
single-digit day, "must not BE older than 28", "30 or under", "aged 25-30". `pickAge()`
now reads every form and the deadline line finder accepts close/close[sd]/applications are
accepted until/submit by. (2) The AI key hint (first/last four characters) was
returned to **contributors**; the key state and hint are now admin-only, contributors get
the site name and nothing about the key. (3) `/api/health` was registered *inside* the
`if (dist exists)` block, so a deploy whose client build failed answered 404 instead of
503; it now answers regardless of the build. Confirmed working: extract from pasted notes
and from a real URL fetch, graceful fallback when the provider 401s (with the reason shown
to the admin), save-as-draft that cannot be published even if the client sends
`status: verified`, and the audit trail. **No AI key is configured on the deployment**, so
the provider path is dormant there and every run reports "extract".

## Identities exercised

| Identity | Reaches | Must never reach |
| --- | --- | --- |
| anonymous | landing, `/scholarships`, `/programs`, `/terms`, `/privacy`, login, signup, published listings, `/api/public/stats` | everything behind the login (redirected to `/login?next=…`) |
| Ayesha (student) | dashboard, matches, browse, detail, saved, profile, wizard, settings | `/admin/*` (access card, no admin data), drafts, other students' data |
| Bilal (student) | same as Ayesha, his own rows only | Ayesha's saved list, notes, profile |
| Sana (student) | same, thin profile → provisional states | everything above |
| contributor | every student page **and** the admin console, drafts | publishing, `status=verified`, universities write, roles, stale job |
| admin | everything, including publish | publishing a listing they created (four eyes), demoting the last admin |

## What the audit found, and what was fixed

1. **A draft could be pulled into a student's saved list.** `POST /api/saved` only checked that the
   listing existed, so `POST {listingId:"S7"}` then `GET /api/saved` returned an unpublished draft in
   full. One visibility rule now guards every read and write path:
   `canSeeListing(user, listing)` — published, or staff.
2. **Drafts leaked into match results.** `/api/matches` ranked the whole table. It now ranks only what
   the caller may see. (A draft with a future deadline really did appear as “meets”.)
3. **Editorial fields reached students.** `createdBy`, `verifiedBy`, `evidence`, `sourceSnapshot` and
   `draftedByAi` were in the public listing payload. A `publicListing()` serializer strips them for
   non-staff on the feed, the detail page, saved rows and matches. The feed now contains no account
   emails at all.
4. **Students could report unpublished drafts.** Reports (and saved rows) now 404 on anything the
   reporter cannot see.
5. **Logout did not revoke the session token.** The cookie was cleared but the signed token stayed
   valid for 14 days. Sign-out now blacklists that token; a password reset bumps a per-account
   session epoch, which kills every outstanding session for that account.
6. **A malformed profile could 500 the whole matching API.** A bad IELTS date (`RangeError: Invalid
   time value`) or a missing `ielts` object broke `/matches`, the feed and every listing page for that
   account. Two layers now: `sanitizeProfile()` coerces and drops anything the engine cannot reason
   about on write (numbers, ISO dates, enums, arrays, ≤3 targets), and `safeMatchOne` /`safeResultsFor`
   degrade to a neutral result instead of throwing.
7. **Completeness started at 37 % for a brand-new account** because pre-filled defaults
   (`currentLevel`, `bachelorScale`, `fundingNeed`, `apsStatus`, `ielts.status`) counted as answers.
   Defaults are now empty, so a fresh account starts near 0 %, the provisional banner is honest, and
   the bar only moves when the student actually answers.
8. **The wizard crashed on step 4.** Clicking “Make primary” on a target with no field selected threw
   `Cannot read properties of undefined (reading 'toUpperCase')` and blanked the page. Guarded, plus
   the same pattern on the profile page.
9. **`mark-verified` was a publishing shortcut.** It could flip `stale → verified` with no gate, no
   groups and no four eyes — so an admin could re-publish their own listing. It now only refreshes
   freshness on an already-published listing; drafts and stale content go through the publish gate.
   Four-eyes comparison is also alias-aware (`"admin"` and `"admin@example.com"` are the same actor),
   and the seed stores real account identities instead of short handles so the audit log, the user
   table and the rule all name the same person.

## Cross-account isolation — what is guaranteed

- **Saved list**: rows are keyed by `(userId, listingId)`. Ayesha's note “Ayesha private note” is
  invisible to Bilal even for the same listing, and her delete leaves his row intact.
- **Profile**: writes are scoped to the caller; a client-supplied `completenessPct`, `key` or `email`
  is ignored. Nothing Ayesha writes can appear in Bilal's profile JSON.
- **Settings**: stored per account (`langPref` english vs german read back independently).
- **Reports**: attributed to the reporter's account; two students filing on the same listing produce
  two separate rows; a student cannot resolve/dismiss through the admin route.
- **Sessions**: same account in two browsers sees the same data; a tampered or forged cookie is
  rejected (HMAC verification); deactivating an account kills its live sessions on the next request
  and blocks re-login until reactivated.
- **UI**: neither student's name, email or note text appears anywhere in the other's pages; the
  student sidebar has no admin section; `/admin/*` typed by hand redirects to `/dashboard`.

## Intended sharing (not a leak)

- Admins see every account in `Users & roles` and every report with its reporter — that is the job.
- Contributors see the whole editorial table (including authors) but cannot publish or administer.
- `GET /api/public/stats` is identical for every identity: it is published, aggregate data only.

## Known limits (by design, not defects)

- No mail server: verification and reset tokens are returned in the API response for offline testing.
- Uploads are a checklist, not files.
- The JSON store is single-process, so `npm run seed` must run with the server stopped.
- A signed-out token is revoked, but an attacker who already has the token *and* never triggers
  sign-out keeps it until it expires (14 days) — normal for stateless sessions; shorten
  `signToken`'s `exp` for production.

Re-run everything:

```bash
PORT=8000 node server/index.js          # terminal 1 (seed first, with the server stopped)

node audit/api-matrix.mjs               # 83  identity × endpoint
node audit/feature-logic.mjs            # 113 feature logic per role
node audit/data-integrity.mjs           # 20  data layer
node audit/ui-roles.mjs                 # 93  browser matrix per role
node audit/wizard-e2e.mjs               # 19  wizard end-to-end
node audit/flows.mjs                    # 19  core flows
node audit/page-crawl.mjs               # 43  routes × 3 widths, content + links + overflow
node audit/a11y.mjs                     # 40  routes, labelling and focus audit
node audit/empty-states.mjs             # 28  empty states and form validation
node audit/failure-modes.mjs            # 75  no page may blank out when a request fails
```

The browser suites need Playwright: `PW=/path/to/playwright-core/index.mjs` and
`CHROME=/path/to/chrome` (defaults point at this workspace's copies). Re-seed afterwards —
the suites create listings, reports and saves as they go.

---

# Page-by-page sweep (all 43 pages, every role)

Separate from the identity audit above: this one walks **every route** as public / student /
contributor / admin, at 1280, 768 and 375 px, plus a dark-theme pass, and checks content,
not just permissions.

| Suite | Covers | Result |
| --- | --- | --- |
| `audit/page-crawl.mjs` | 43 routes × 3 viewports: runtime errors, `undefined`/`NaN`/`Invalid Date`/`[object Object]` text, >1 `<h1>`, broken `<img>`, horizontal overflow, every internal link resolves | 0 findings |
| `audit/a11y.mjs` | duplicate ids, unlabelled inputs, nameless buttons/links, `tabindex > 0`, images without alt | 0 findings |
| `audit/empty-states.mjs` | brand-new account on every student page, signup/login/reset validation, listing-form validation, publish-without-source | 28 / 28 |

## What this sweep found, and what was fixed

1. **An admin could lock everyone out.** Deactivating the admin account (including their own) left no
   active admin, so nobody could reach the console again. The server now refuses self-deactivation and
   refuses any change that would leave zero active admins; the UI disables your own role select and
   active switch, and each `<select>` finally has an accessible name.
2. **Stale listings were still student-visible.** A listing published 180+ days ago was still served on
   its detail page, in the feed and through `/api/public/stats` — the very rule the copy promises
   ("180 days and it leaves the results") only existed inside the matching engine. Detail page now shows
   the "not available" state, the feed and public counters skip stale rows, and the admin table reports
   them as **stale** instead of `verified`.
3. **`1 days ago` / `1 days old`** on the queue, overview, AI-draft list and listings table. All four now
   use the shared `plural()` helper.
4. **Landing copy contradicted itself.** "What every card checks" showed a `6 checks` donut whose legend
   was listing counts (8, 7, 16, 1, 2, 14) under a "14" badge. It now reads "Six kinds of check, and how
   many listings publish each one", counts visible listings, and the donut centre says `16 listings`.
5. **Two checkboxes had no accessible name** (`#remember` on login, `#consent` on signup — the text was in
   a `<span>`). Now real `<label htmlFor>` elements, styled identically via `react.css`.
6. **`notanemail` was accepted at signup.** The API now validates the email shape (the browser's
   `type=email` was the only guard).
7. **A listing could be published with no source URL.** The gate checked the three ticks, the role and
   four eyes, but not provenance. Publishing now requires a title and a source (or official) URL, which
   is what the form's helper text promises.

Every fix is covered by the suites above and by the identity suites, which were all re-run green
(83 + 113 + 20 + 93 + 19 + 19 checks).


---

# From prototype to platform (2026-10-22)

Three changes at the end of the build, all covered by the suites above.

## 1. The console can no longer fail silently

The reported "blank white screen" on `/admin` was not reproducible — all nine admin routes
rendered with zero console errors against a running API. It was the silent-failure path:
when `/api` was unreachable the boot request threw, the session was cleared, and the guard
redirected to `/login` (or, worse, rendered nothing). Fixed at the root:

- **`src/api.js`** — every request has a 15 s `AbortController`. A network failure or a
  timeout throws with `err.offline = true` and a readable message.
- **`src/auth.jsx`** — a failed boot keeps a `bootError` state (`offline` / `server` /
  `unknown`) and offers `retryBoot()`, instead of quietly logging the user out.
- **`src/main.jsx`** — three explicit pages: `BootError` (offline vs 5xx, with **Try again**),
  `NoAdminAccess` (names the signed-in role, "Back to your dashboard", "Sign in as someone
  else"), and an `ErrorBoundary` around the whole tree (message, **Reload**, dashboard link,
  component stack to the console).
- **`audit/ui-roles.mjs`** now asserts the student `/admin/*` case as "stays on the URL and
  gets the access card" instead of "redirected to `/dashboard`".

Verified in a browser with the API aborted and with the API returning 503: both render a
card with a retry button, never a white page.

## 2. The data is real

`server/lib/fixtures.js` is gone; `server/lib/reference.js` (loaded by
`server/lib/matching.js` as `REFERENCE`) now holds nine scholarships and eight programmes
read from official pages — DAAD, Heinrich Böll, Christiane Nüsslein-Volhard, the
Deutschlandstipendium at TU Dresden / FAU / HU Berlin, and TUM, RWTH Aachen, TU Berlin,
Ruhr-Universität Bochum and LMU programmes. Every record carries the `sourceUrl` it was read
from and a `lastVerified` date; the two AI drafts (S7, P8) additionally carry the
`sourceSnapshot` and the verbatim evidence sentence per field, so the AI-draft review page
now shows matched evidence instead of "0 sentences matched".

Numbers the official pages do not publish (semester contribution, an IELTS band on some
programmes) are left empty and render as "not stated". The student demo rows keep their
`@example.com` addresses and real Pakistani institutions (UET Lahore, BZU Multan, Sadiq
College Bahawalpur).

Consequences the suites picked up: `feature-logic` needed a real gender-restricted record
(S4 is now the CNV Foundation, women only), and the check became a proper two-sided test —
hidden for a male profile, visible for a female profile with the same target.

## 3. The demo scaffolding is out

`src/pages/Components.jsx` (design system) and `src/pages/States.jsx` were deleted, together
with their routes, their sidebar entries and the landing-page links to them. Three further
pieces of invented content went with them:

- the landing hero card now renders the newest real listing from `/api/public/stats` (title,
  provider, published minimums, deadline countdown, "Verified today") instead of
  "Example Master's Scholarship / Example Foundation · 3.70 · needs 3.3";
- the Settings alert preview renders the next deadline on *your* saved list instead of a
  fake email;
- the AI-draft sample text is the real HU Berlin Deutschlandstipendium page, and the
  "Verified 0 days ago" tag now reads "Verified today".

The one-tap demo logins and the demo profiles stay, as agreed.

Final state: **83 + 114 + 20 + 93 + 19 + 19 = 348 identity checks**, page crawl
43 routes × 3 viewports = 0 findings, a11y 0 findings, empty states 28/28.


---

# No page may blank out (2026-10-23)

Reported: opening the admin console showed **"This page could not be shown — Cannot read
properties of null (reading 'counts')"**.

## What actually happened

`useAsync` (the one data hook every page uses) sets `data: null` whenever a request fails.
`src/pages/admin/Overview.jsx` rendered `data.counts.drafts` as soon as `loading` was false,
so a single failed `/api/admin/overview` — a restarting server, a dropped request, an
expired session — dereferenced `null` and the error boundary caught it. The page was fine;
the *contract* between the hook and the pages was not.

The same class of bug existed in three other shapes across the app:

| Shape | Where | What the user saw |
| --- | --- | --- |
| dereference of `null` | `admin/Overview.jsx` (`data.counts`) | error boundary |
| spinner forever | `Profile`, `Settings`, `Wizard` (`if (loading \|\| !p)`) | endless "Loading…" |
| silently empty table | `admin/Listings`, `Users`, `Errors`, `Logs`, `Universities`, `Queue`, `Browse`, `Saved` | "no rows" when the request had failed |

## The fix

1. **`useAsync` hardened** (`src/components/ui.jsx`) — it now returns `error` *and* `errorObj`,
   retries a dropped request or a 5xx **once** after 700 ms (a restarting server should not
   become an error page), and fails immediately on a 4xx.
2. **`LoadError` card** — one shared component: what failed, whether it was the connection or
   the server, plus **Try again** and **Go to dashboard**. Used by all 14 data pages.
3. **Every page guards its own render** — `Overview`, `Listings`, `Users`, `Errors`, `Logs`,
   `Universities`, `Queue`, `ListingForm`, `AiDraft`, `Browse`, `Detail`, `Matches`,
   `Dashboard`, `Profile`, `Settings`, `Wizard`, `Saved`, and the landing page (which now
   shows **—** and an inline retry instead of printing `0` listings).
4. **Expired session ≠ error** — `api.js` broadcasts `sf:unauthorized` on any 401;
   `auth.jsx` clears the user, so the guard sends you to `/login?next=…` instead of showing
   "could not load".
5. **A wrong id is not a failure** — `/admin/listings/S9999` says "Listing not found" with a
   link back to the list, and a 404 on a detail page still shows the intended
   "This listing is not available" state.
6. **`ListingForm` never returns `null`** — the empty-render path (`if (!form) return null`)
   is gone.

## The suite that keeps it fixed

New `audit/failure-modes.mjs`, 75 checks: for **all 19 data pages** it fails that page's own
endpoint (500, then unreachable) and asserts the page still renders, shows a retry, and never
reaches the error boundary; then the API down at boot, a missing id, and an expired session.

It earned its place immediately: the first run caught that `ListingForm` used `LoadError`
without importing it (my patch had missed that import line), which is exactly the
blank-screen class of bug this suite exists to catch.

Final state: **83 + 114 + 20 + 93 + 19 + 19 = 348 identity checks**, failure modes 75/75,
page crawl 43 routes × 3 viewports = 0 findings, a11y 0 findings, empty states 28/28 —
**451 automated checks, all green.**
