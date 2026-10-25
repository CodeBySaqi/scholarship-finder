# ScholarPath — test report

Two suites. Nothing here is aspirational: every line below is a check that ran.

- **Engine** — `node audit/path-tests.mjs` (pure functions, fixtures)
- **Pages** — `bash audit/run-dom.sh path` (real React app, real API, happy-dom)

## The eight required cases

| # | Case | Result |
|---|---|---|
| 1 | 180 ECTS + no GRE student: a 210-ECTS programme is Not eligible (gap named); a GRE-gated programme is Not eligible | ✅ pass (4 assertions) |
| 2 | MOI yes, no IELTS: an MOI-rejecting programme must NOT become eligible | ✅ pass (3 assertions) |
| 3 | HSSC only, no undergrad year / Studienkolleg / test: a Bachelor requiring Abitur equivalence is never silently Eligible | ✅ pass (2 assertions) |
| 4 | Programme with IELTS, GPA, ECTS all unstated = Check manually with the missing fields listed | ✅ pass (3 assertions) |
| 5 | Budget €0: a Baden-Württemberg €1,500/semester programme is not free and not Eligible | ✅ pass (3 assertions) |
| 6 | Full-funding need: a tuition-only scholarship does not show as fully covering | ✅ pass (4 assertions) |
| 7 | German GPA: 1.9 vs threshold 2.5 must PASS (lower is better) | ✅ pass (5 assertions) |
| 8 | Step-1-only profile still returns rough matches and shows which checks are pending | ✅ pass (5 assertions) |

Each case is several assertions; the detail is below.

## Engine suite
```
— case 1: 180 ECTS, no GRE —————————————————————————
✅ PASS 1a. 210-ECTS programme is Not eligible — not_eligible
✅ PASS 1b. the gap is named in words — Needs 210 ECTS, you have 180 (a 4-year Pakistani BS is normally about 180 ECTS)
✅ PASS 1c. GRE-gated programme with no GRE is Not eligible — not_eligible
✅ PASS 1d. it says which GRE sections are missing — GRE quant 164 required, you have no quant score; GRE aw 4 required, you have no aw score
— case 2: MOI yes, no IELTS ————————————————————————
✅ PASS 2a. MOI-rejecting programme is NOT eligible
✅ PASS 2b. MOI-accepting programme may pass English
✅ PASS 2c. programme silent on MOI is Check manually, not Eligible — check_manually
— case 3: HSSC only, no route ————————————————————
✅ PASS 3a. Abitur-equivalence programme is never silently Eligible — not_eligible
✅ PASS 3b. the route is explained — An HSSC is not the Abitur. Your routes: one year of a Pakistani bachelor in the same field, a Studienkolleg (T-Kurs) with the Feststellungsprüfung, or A-Levels/IB
— case 4: nothing stated ——————————————————————————
✅ PASS 4a. a programme with IELTS, GPA, ECTS unstated is Check manually — check_manually
✅ PASS 4b. it lists the missing fields — Field, Teaching language, Tuition, Intake, Deadline
✅ PASS 4c. it never becomes Eligible
— case 5: budget €0 vs Baden-Württemberg ———————————
✅ PASS 5a. €1,500/sem programme is Not eligible on a €0 budget — not_eligible
✅ PASS 5b. it is never described as free — Charges €1500/semester for non-EU students; your budget is €0
✅ PASS 5c. unknown tuition is Check manually, never "free"
— case 6: full-funding need vs tuition-only ——————————
✅ PASS 6a. tuition-only scholarship does not satisfy full need — not_eligible
✅ PASS 6b. it says what the scholarship actually covers — You need a full scholarship; this covers tuition only
✅ PASS 6c. a full scholarship passes
✅ PASS 6d. unstated coverage is Check manually
— case 7: German GPA direction ————————————————————
✅ PASS 7a. 1.9 passes a 2.5 threshold
✅ PASS 7b. 3.1 fails a 2.5 threshold
✅ PASS 7c. converted 3.65/4 ≈ 1.4 passes 2.5 — gpa 1.5
✅ PASS 7d. converted 2.2/4 ≈ 3.4 fails 2.5 — gpa 3.7
✅ PASS 7e. the Modified Bavarian Formula is shown as working — 1 + 3 × (4 − 3.4) / (4 − 2) = 1.9
— case 8: Step-1-only profile ————————————————————
✅ PASS 8a. Step-1-only still returns results, not zero — 2 results
✅ PASS 8b. none of them claims Eligible — check_manually, check_manually
✅ PASS 8c. pending checks are marked, not silently ignored — Field, Tuition, Semester contribution
✅ PASS 8d. completeness is reported per step — total 27%, step1 100%
✅ PASS 8e. a Step-1 profile counts as step-1 complete
— extra: traps from the brief ————————————————————
✅ PASS deadline in the past is Not eligible — The non-EU deadline was 2025-01-15 — 648 days ago
✅ PASS subject-ECTS shortfall is Not eligible and named — needs 120 ECTS in cs, you have 90
✅ PASS German-taught + no German level is Check manually — check_manually
✅ PASS German-taught with only B1 is Not eligible — Needs German C1 (DSH-2), you have B1
✅ PASS GRE 165 meets a 164 gate
✅ PASS results sort eligible → check manually → not eligible — emn
✅ PASS no verdict is ever returned without reasons
✅ PASS daysToDeadline counts from today — 10
37/37 engine checks passed
```

## Page suite
```
✅ PASS path: the page renders its three steps
✅ PASS path: completion is shown — 17%
✅ PASS path: step 1 asks for target level
✅ PASS path: no input asks for a passport, CNIC, IBAN or account number
✅ PASS path: the page says outright that it does not ask for them
✅ PASS path: step 1 accepts level, language, intake and nationality
✅ PASS path: saving step 1 moves to step 2
✅ PASS path: step 1 was stored on the server — {"level":"master","language":"english","intake":"winter_2029"}
✅ PASS path: completeness moved and is per step — {"pct":37,"steps":{"1":100,"2":19,"3":0},"step1Complete":true}
✅ PASS path: step 2 asks for the bachelor field (no target field)
✅ PASS path: the German-grade conversion is shown with its working — 1 + 3 × (4 − 3.4) / (4 − 2) = 1
✅ PASS path: step 2 saves and moves to step 3
✅ PASS path: the server stores the converted German grade — 1.9
✅ PASS path: the results page opens
✅ PASS path: three verdict groups are shown — 5Eligible | 1Check manually | 5Not eligible
✅ PASS path: every result carries its verdict — 11 cards
✅ PASS path: reasons are printed in plain words — German — German C1 (DSH-2) required — you have recorded no German level
✅ PASS path: the screening-only disclaimer is on the page
✅ PASS path: no admission is claimed as guaranteed
✅ PASS path: the eligible group is populated for a complete profile — 5 eligible — M.Sc. Computer Science, M.Sc. Computer Science
✅ PASS path: not-eligible results are shown, not hidden — 5 not eligible
✅ PASS path: a manual-check card says what is not stated — M.Sc. InformaticsLudwig-Maximilians-Universität München (LMU) · Munichcheck manuallyNot st
✅ PASS path: the tally filters the list — 5 cards after filtering
✅ PASS path: scholarship results render — 3 scholarship cards
✅ PASS path: a tuition-only scholarship is not shown as covering a full need
✅ PASS path: an incomplete profile warns that checks are pending — Still pending: GPA, Bachelor ECTS, Subject credits, English score
✅ PASS path: with a short profile nothing is claimed Eligible — 0 eligible
27/27 page checks passed
```

## What the page suite actually does

It signs in as a student, clears the ScholarPath profile, drives all three steps through the real React forms (chips, numbers, the GPA conversion), saves through the API, then reads the results page: verdict groups, per-card reasons, the screening-only disclaimer, the tally filter, the scholarship tab, and the "Still pending" banner after the profile is deliberately emptied again.

It also asserts that **no input on the profile page asks for a passport, CNIC, IBAN or account number**.

