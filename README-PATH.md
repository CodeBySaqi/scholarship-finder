# ScholarPath — how the matching works

A module inside the existing app — **there is no separate "find my path" page.**
The matching fields are entered where a student already is, on `/profile`
(card `#match-fields`), and the verdict then appears on the listings themselves:
a badge on every programme/scholarship card, a count line and a
"Can I apply first" sort on the listing page, and the full reasoning panel on
each programme page. It does not modify the data of the legacy `/matches`,
`/scholarships` or `/programs` pages; it only adds the verdict to their cards.

- Profile store: `db.pathProfiles[userId]` (`GET`/`PUT /api/path/profile`)
- Engine: `src/path/engine.js`; years-of-education + anabin rules: `src/path/education.js`
- Requirements live on the listing itself: `listing.match`, edited by an admin in
  **Admin → Listing → Matching requirements**
- Verdicts for live listings: `GET /api/path/verdicts?kind=program|scholarships`
- anabin: `GET /api/anabin/institutions?q=` (our snapshot) and
  `POST /api/anabin/live` (one institution, read from anabin.kmk.org, stored with its date)
- Embedded UI: `src/components/PathFields.jsx` (`EligibilityBadge`,
  `EligibilityPanel`, `MatchFieldsCard`)

**Rule for the whole build: only what changes a match decision is built.**
Display fields (city, duration, DAAD link) never decide anything, and the profile
never asks for data the engine ignores.

---

## 1. German GPA conversion — Modified Bavarian Formula

German grades run **1.0 (best) to 4.0 (pass)**. A Pakistani CGPA runs the other
way, so every comparison has to be converted first.

```
N = 1 + 3 × (Nmax − Nd) / (Nmax − Nmin)

Nmax = best possible grade on the original scale   (e.g. 4.0)
Nd   = the grade earned                            (e.g. 3.4)
Nmin = lowest passing grade                        (e.g. 2.0)
```

Worked example, 3.4/4.0 with a pass mark of 2.0:

```
N = 1 + 3 × (4.0 − 3.4) / (4.0 − 2.0)
  = 1 + 3 × 0.6 / 2.0
  = 1.9
```

So **3.4/4.0 ≈ 1.9**, which passes a 2.5 threshold. A perfect record maps to 1.0
and a bare pass maps to 4.0. The result is rounded to one decimal and clamped to
`[1.0, 4.0]`, so a mistaken scale entry cannot produce 5.3.

Both numbers are stored (`academics.gpaOriginal` and `academics.gpaGerman`) and
the working is shown in the form and kept in `gpaConverted.working`. The
comparison itself goes through one function, `gpaPasses(yours, required)`, which
is `yours <= required` — **lower is better**, asserted by test 7.

A university may apply its own table, so the estimate is labelled as an estimate
everywhere it appears.

---

## 2. How "Check manually" is decided

Every hard requirement ends in exactly one of four states:

| State | Meaning | Effect on the verdict |
|---|---|---|
| `pass` | requirement stated, and you meet it | none |
| `fail` | requirement stated, and you do not meet it | **Not eligible** |
| `unknown` | the *programme* never states this requirement | **Check manually** |
| `pending` | the *profile* does not carry the value needed to test it | **Check manually** |

```js
if (any fail)          → not_eligible     // named on the card
else if (any unknown
      || any pending)  → check_manually   // the missing checks are listed
else                   → eligible
```

Three consequences, all deliberate:

1. **A missing value is UNKNOWN, never "no requirement".** A programme that
   states no IELTS score does not mean IELTS is unnecessary — it means we do not
   know. It goes to Check manually with `English` in the missing list.
2. **A pending check is not a passed check.** If you have not entered a GPA, a
   programme with a GPA bar cannot be Eligible. This is what stops a Step-1-only
   profile from showing green results it has not earned (test 8).
3. **Check-manually results are never hidden and never promoted.** They sort
   between Eligible and Not eligible, and the card carries `Not stated: …` or
   `Waiting on your profile: …`.
4. **A live listing with no verified requirement row is a manual check.** It is
   never eligible-by-default and never filtered out; the panel says the
   requirements have not been verified yet and links the official page.

The same four states govern the scholarship rule set (level, nationality, field,
GPA, language, age, deadline, coverage). There, `null` means *we did not verify
it* — `fields: []` records a call that is open to all disciplines,
`germanReq: false` a call that needs no German certificate. Without those
explicit values the verdict stays Check manually: today that is what the four
catalogue rows say ("Not stated: GPA, IELTS, German"), which is the truth about
what has been read from the calls so far.

### The traps, encoded once

- **APS is not required for Pakistan.** APS is China/India/Vietnam only. The
  Pakistani route is HEC attestation (+ IBCC for HSSC). The engine has no APS
  gate at all, by design.
- **180 vs 210 ECTS.** A 4-year Pakistani BS is normally ~180 ECTS. A programme
  needing 210 fails with the gap in words: *"Needs 210 ECTS, you have 180"*.
- **MOI never auto-waives.** `englishOther` is `moi_accepted` (satisfies),
  `moi_rejected` (hard fail) or absent (Check manually). There is no global
  "MOI = waived" branch anywhere in the file.
- **GRE/GATE/TestAS/SAT/ACT gates are hard.** A stated gate with no score is a
  fail, not an unknown — *"No GRE + required GRE = Not eligible"*.
- **HSSC is not the Abitur.** For a bachelor target, the accepted routes are
  one year of university in the same field, a Studienkolleg with the
  Feststellungsprüfung, or A-Levels/IB. Anything else fails with all three
  routes spelled out.
- **Unknown tuition is never "free".** A null `tuitionPerSemester` produces a
  manual check that says the state may charge; Baden-Württemberg (€1,500) and
  TUM (€6,000) are stored as real numbers and fail a €0 budget.

---

## 3. Years of education, anabin and the ZAB

The education section is a list of records, not a pile of booleans:

| Record | Years of education |
|---|---|
| Matric / SSC | 10 |
| Intermediate / HSSC, A-Levels, IB | 12 |
| Bachelor | 12 + 0.5 × semesters completed |
| Master | 16 + 0.5 × semesters completed |

So two semesters of a Pakistani bachelor is **13 years**, four is 14, and a
completed four-year (8-semester) BS is **16**.

| Target | Rule | Under it |
|---|---|---|
| Bachelor | ≥ 13 years, or A-Levels/IB (Abitur-equivalent) | Not eligible, with all three routes named |
| Master | a completed four-year bachelor = 16 years | Not eligible; a 3-year (15-year) bachelor is named as short |
| PhD | a completed master = 18 years | Not eligible |

Under the threshold is **arithmetic**, so it is a hard fail with the number
shown ("A master needs a completed four-year bachelor (16 years). You have 15")
— not a "check manually". A student who already holds a master keeps the
bachelor option open: years only ever add up.

**anabin decides the ZAB, not APS.** Every education record stores the
institution and its anabin status (H+, H+/- or H-), which the student picks from
our own snapshot of the official anabin database (232 Pakistani institutions,
`data/anabin-institutions.json`, refreshable with `node tools/anabin-refresh.mjs`).
The **Check live** button re-reads that one institution from anabin.kmk.org on
the server and stores the fresh status with its date; if anabin cannot be
reached the endpoint says so and the stored value stays visible.

| anabin | ZAB statement | Verdict effect |
|---|---|---|
| H+ | not needed | pass |
| H+/- | **conditional** — may be required | pass, with the condition on the card |
| H- | **required** (Zeugnisbewertung) | Check manually, ZAB named |
| no record | unknown | Check manually, "check anabin" named |

APS is never part of this: Pakistan is not an APS country (China, India,
Vietnam, Mongolia). The note is printed next to the education section so the
rule cannot drift.

---

## 4. What is asked, and what is not

The form is numbered 1 → 6 and answered in that order:

1. **What you are applying for** — degree, teaching language, intake, nationality
2. **Languages** — IELTS, TOEFL iBT, PTE Academic, MOI (recorded, never auto-waiving), German level + certificate
3. **Education** — records with a **+** button (Matric / HSSC / Bachelor / Master), the anabin list, semesters completed, CGPA + scale + pass mark
4. **ECTS** — total and subject breakdown, for a master/PhD target only; a bachelor applicant is told plainly that ECTS do not apply
5. **Test requirements** — GRE sections separately (never a total), GMAT, GATE, TestAS, SAT, ACT, work experience, or "I have not taken any of these"
6. **Money** — tuition budget, semester contribution, funding need, blocked account

Profile groups stored: `target`, `nationality`, `academics`, `language`,
`tests`, `education`, `money`, `scholarshipExtras`, `documents`, `preferences`.
The server derives `academics.*` (field, GPA, HSSC group) from the education
records, so there is one place a degree is typed.
The API whitelists them (`PATH_PROFILE_SHAPE`), so a field the engine never reads
cannot be stored by accident.

There is **no `target_field`**. Field fit is derived: bachelor field (or master
field / research areas for PhD, or school subjects for a bachelor target).

Never collected: passport numbers, CNIC, IBAN, bank details, ID scans.

---

## 5. Where the requirements live now

`listing.match` on the programme listing, filled by an admin against the
university page — the 13 hard fields in one section of the listing form
(level, teaching language, accepted fields, German grade, bachelor ECTS, subject
ECTS, IELTS, TOEFL, PTE, MOI accepted/rejected + the quoted sentence, German
level + certificate, Abitur equivalence, the test gates, tuition, semester
contribution, intakes, deadline, requirements page).

`data/path-programmes.json` is only the **seed** for those values (and still the
source for scholarship rows). What an admin saves on a live listing wins, and a
field left empty is *unknown* — Check manually — never "no requirement".

## 6. Data honesty

`data/path-programmes.json` holds the catalogue. Every programme carries a
`source` string naming the page the values came from, and **anything not verified
is `null`** — which produces Check manually rather than an invented requirement.

The file currently holds 11 programmes and 4 scholarships, deliberately small:
a bigger catalogue should be imported from DAAD with the same schema, and any
row that cannot be sourced should keep its `null`s. Fixtures used by the tests
(`audit/path-tests.mjs`) are allowed to contain invented numbers because they
exist to prove a rule; the catalogue is not.

---

## 7. Running it

```bash
npm run build                 # client
node audit/path-tests.mjs     # engine: 73 checks incl. the 8 required cases
bash audit/run-dom.sh path    # UI: 50 checks against the real app + API
                              #     (needs `npm install --no-save happy-dom`)
node tools/anabin-refresh.mjs # re-read the anabin list for Pakistan
```

Full results, case by case, are in `PATH-TEST-REPORT.md`.

---

## 8. Scope, stated plainly

Matching is **eligibility screening only**. Meeting every stated requirement is
not an offer of admission, and that sentence is printed in the panel on every
programme page (and in the scholarship panel) — nowhere does the app promise
admission, and no percentage is shown without the reasons behind it.
