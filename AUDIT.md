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
