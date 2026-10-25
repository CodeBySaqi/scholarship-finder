# ScholarPath — test report

Two suites. Nothing here is aspirational: every line below is a check that ran,
on this commit, against the running app.

- **Engine** — `node audit/path-tests.mjs` (pure functions, fixtures)
- **UI** — `bash audit/run-dom.sh path` (real React app, real API, happy-dom)

## Where the feature lives (the shape these tests pin down)

There is **no separate "find my path" page**: the fields are entered on
`/profile` and the verdict appears on the programmes themselves. The UI suite
asserts that shape first — no `/path` route, no sidebar entry, fields present on
`/profile` — and then asserts the verdicts on the real listing cards and the real
programme page.

## The eight required cases

| # | Case | Result |
|---|---|---|
| 1 | 180 ECTS + no GRE student: a 210-ECTS programme is Not eligible (gap named); a GRE-gated programme is Not eligible | ✅ pass (4 assertions) |
| 2 | MOI yes, no IELTS: an MOI-rejecting programme must NOT become eligible | ✅ pass (3 assertions) |
| 3 | HSSC only, no undergrad year / Studienkolleg / test: a Bachelor requiring Abitur equivalence is never silently Eligible | ✅ pass (2 assertions) |
| 4 | Programme with IELTS, GPA, ECTS all unstated = Check manually with the missing fields listed | ✅ pass (3 assertions) |
| 5 | Budget €0: a Baden-Württemberg €1,500/semester programme is not free and not Eligible | ✅ pass (3 assertions) |
| 6 | Full-funding need: a tuition-only scholarship does not show as fully covering | ✅ pass (5 assertions) |
| 7 | German GPA: 1.9 vs threshold 2.5 must PASS (lower is better) | ✅ pass (5 assertions) |
| 8 | Step-1-only profile still returns rough matches and shows which checks are pending | ✅ pass (5 assertions) |

## Engine suite — 41/41
```
— case 1: 180 ECTS, no GRE —————————————————————————
✅ 1a. 210-ECTS programme is Not eligible — not_eligible
✅ 1b. the gap is named in words — Needs 210 ECTS, you have 180 (a 4-year Pakistani BS is normally about 180 ECTS)
✅ 1c. GRE-gated programme with no GRE is Not eligible — not_eligible
✅ 1d. it says which GRE sections are missing — GRE quant 164 required, you have no quant score; GRE aw 4 required, you have no aw score
— case 2: MOI yes, no IELTS ————————————————————————
✅ 2a. MOI-rejecting programme is NOT eligible
✅ 2b. MOI-accepting programme may pass English
✅ 2c. programme silent on MOI is Check manually, not Eligible — check_manually
— case 3: HSSC only, no route ————————————————————
✅ 3a. Abitur-equivalence programme is never silently Eligible — not_eligible
✅ 3b. the route is explained — An HSSC is not the Abitur. Your routes: one year of a Pakistani bachelor in the same field, a Studienkolleg (T-Kurs) with the Feststellungsprüfung, or A-Levels/IB
— case 4: nothing stated ——————————————————————————
✅ 4a. a programme with IELTS, GPA, ECTS unstated is Check manually — check_manually
✅ 4b. it lists the missing fields — Field, Teaching language, Tuition, Intake, Deadline
✅ 4c. it never becomes Eligible
— case 5: budget €0 vs Baden-Württemberg ———————————
✅ 5a. €1,500/sem programme is Not eligible on a €0 budget — not_eligible
✅ 5b. it is never described as free — Charges €1500/semester for non-EU students; your budget is €0
✅ 5c. unknown tuition is Check manually, never "free"
— case 6: full-funding need vs tuition-only ——————————
✅ 6a. tuition-only scholarship does not satisfy full need — not_eligible
✅ 6b. it says what the scholarship actually covers — You need a full scholarship; this covers tuition only
✅ 6c. a full scholarship passes
✅ 6d. unstated coverage is Check manually
✅ 6e. an unstated English requirement is never silently waived — check_manually / Not stated: IELTS
— case 7: German GPA direction ————————————————————
✅ 7a. 1.9 passes a 2.5 threshold
✅ 7b. 3.1 fails a 2.5 threshold
✅ 7c. converted 3.65/4 ≈ 1.4 passes 2.5 — gpa 1.5
✅ 7d. converted 2.2/4 ≈ 3.4 fails 2.5 — gpa 3.7
✅ 7e. the Modified Bavarian Formula is shown as working — 1 + 3 × (4 − 3.4) / (4 − 2) = 1.9
— case 8: Step-1-only profile ————————————————————
✅ 8a. Step-1-only still returns results, not zero — 2 results
✅ 8b. none of them claims Eligible — check_manually, check_manually
✅ 8c. pending checks are marked, not silently ignored — Field, Tuition, Semester contribution
✅ 8d. completeness is reported per step — total 27%, step1 100%
✅ 8e. a Step-1 profile counts as step-1 complete
— extra: traps from the brief ————————————————————
✅ deadline in the past is Not eligible — The non-EU deadline was 2025-01-15 — 648 days ago
✅ subject-ECTS shortfall is Not eligible and named — needs 120 ECTS in cs, you have 90
✅ German-taught + no German level is Check manually — check_manually
✅ German-taught with only B1 is Not eligible — Needs German C1 (DSH-2), you have B1
✅ GRE 165 meets a 164 gate
✅ results sort eligible → check manually → not eligible — emn
✅ no verdict is ever returned without reasons
✅ an unset target level is Check manually, not Not eligible — check_manually / Waiting on your profile: Level, Field, Tuition, Semester contribution
✅ a scholarship with no target level set is Check manually, not Not eligible — check_manually / Not stated: GPA, Deadline, Coverage
✅ a listing with no requirement row still gets a Check manually verdict — A,B / check_manually
✅ daysToDeadline counts from today — 10
41/41 engine checks passed
```

Three checks were added after the live run of the verdict endpoint:

1. **An unset target level is missing data, not a failure.** An empty profile used
   to produce `not_eligible` with the reason *"This is a master programme; you are
   applying for null"* on every programme and *"Open to master only"* on every
   scholarship. Both now report `pending`, so a blank profile sees Check manually.
2. **A live listing with no requirement row still gets a verdict** — Check
   manually, never omitted, never eligible.
3. **An unstated scholarship requirement is never silently waived.** The
   scholarship rule set now treats `null` as unknown for field, minimum grade,
   IELTS and German, exactly as the programme rules do; `fields: []` /
   `germanReq: false` are how a call records "open to all fields" / "no German
   certificate required".

## UI suite — 22/22
```
✅ no separate "find my path" page exists — route /path: undefined
✅ the sidebar has no "Find my path" entry
✅ the profile page carries the matching fields
✅ it explains what these details decide
✅ it shows a completion meter — 11%
✅ nothing asks for a passport, CNIC, IBAN or account number
✅ the German-grade conversion is shown with its working — 1 + 3 × (4 − 3.4) / (4 − 2) = 1
✅ there is one save button for the matching fields
✅ the details are stored on the server — {"level":"master","ects":180}
✅ the German grade is converted server-side — 1.9
✅ the programme list shows how many you can apply to — 1 you can apply to 
✅ every programme card carries a verdict badge — 7 badges: Check yourself, Eligible, Not eligible
✅ badges use the three honest verdicts only
✅ no badge claims eligibility without data
✅ scholarship cards carry verdict badges too — 11 badges: Not eligible, Check yourself
✅ the scholarship list counts what you can apply to — 0 you can apply to 
✅ the programme page carries an eligibility panel — Can I apply?
✅ the panel names the verdict
✅ the panel prints reasons — Requirements — The requirements for this programme have not been verified yet, so eligibility cannot be screened. Check the official page.
✅ the panel says screening is not admission
✅ it offers the way back to the fields
✅ with an empty profile nothing is marked Eligible — Check yourself, Not eligible
```

## What the UI suite actually does

1. Signs in as a student and clears the ScholarPath profile through the API, so
   every run starts blank.
2. Mounts `/path` and asserts there is **no such page** and no "Find my path"
   sidebar entry — the design decision, pinned as a test so it cannot creep back.
3. Mounts `/profile`, finds `#match-fields`, checks the completion meter, and
   scans every input, placeholder and label in the card for
   `passport / CNIC / IBAN / account number` — none may exist.
4. Drives all three steps through the real React controls (chips for level,
   language, intake, nationality; numbers for GPA, ECTS, IELTS, TOEFL, GRE
   sections — never a GRE total), and asserts the Modified Bavarian working is
   printed live: `1 + 3 × (4 − 3.4) / (4 − 2) = 1.9`.
5. Saves with the one "Save matching details" button and reads the profile back
   from the API — level `master`, 180 ECTS, **`gpaGerman 1.9` converted on the
   server**.
6. Mounts `/programs`: the "N you can apply to" count line, a badge on every card,
   badge text restricted to the three honest verdicts, and nothing marked
   Eligible while the stored profile has no target level.
7. Mounts `/scholarships`: the same, which is what caught the route saying
   `/scholarships` while the listing rows say `scholarship`.
8. Opens the first programme page and checks the "Can I apply?" panel: verdict
   named, reasons in plain words, the "not an offer of admission" disclaimer, and
   the link back to the fields.
9. Empties the profile and asserts nothing on the list is marked Eligible.

## Deliberate non-assertions

The suite never asserts that a Check-manually result is absent from a list,
because it must never be absent, and it never asserts a match percentage: the app
shows reasons, and any score is secondary to them.
