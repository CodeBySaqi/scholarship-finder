# ScholarPath — test report

Two suites. Every line below is a check that ran, on this commit, against the
running app.

- **Engine** — `node audit/path-tests.mjs` (pure functions, fixtures) — **73/73**
- **UI** — `bash audit/run-dom.sh path` (real React app, real API, happy-dom) — **50/50**

## Where the feature lives

The fields are on `/profile`, entered in six numbered steps, and the verdict
appears on the programmes themselves. There is no separate "find my path" page —
the suite asserts that, so it cannot creep back.

## The eight required cases

| # | Case | Result |
|---|---|---|
| 1 | 180 ECTS + no GRE student: a 210-ECTS programme is Not eligible (gap named); a GRE-gated programme is Not eligible | ✅ pass (4 assertions) |
| 2 | MOI yes, no IELTS: an MOI-rejecting programme must NOT become eligible | ✅ pass (3 assertions) |
| 3 | HSSC only: a Bachelor requiring Abitur equivalence is never silently Eligible | ✅ pass (2 assertions) |
| 4 | Programme with IELTS, GPA, ECTS all unstated = Check manually with the missing fields listed | ✅ pass (3 assertions) |
| 5 | Budget €0: a Baden-Württemberg €1,500/semester programme is not free and not Eligible | ✅ pass (3 assertions) |
| 6 | Full-funding need: a tuition-only scholarship does not show as fully covering | ✅ pass (5 assertions) |
| 7 | German GPA: 1.9 vs threshold 2.5 must PASS (lower is better) | ✅ pass (5 assertions) |
| 8 | Step-1-only profile still returns rough matches and shows which checks are pending | ✅ pass (5 assertions) |

## Cases added for the education / anabin rules

| # | Rule | Result |
|---|---|---|
| 9 | Years of education: 12 → no bachelor, 13 (2 semesters) → bachelor, 15 (3-year degree) → no master, 16 → master, master holder → both, A-Levels at 12 → bachelor, ECTS never asked of a bachelor applicant | ✅ pass (17 assertions) |
| 10 | anabin: H+ needs no ZAB, H+/- is conditional, H- requires a Zeugnisbewertung, no record is unknown — never H+ | ✅ pass (7 assertions) |
| 11 | PTE, GMAT, and the admin-filled requirement row: a complete admin row makes a listing Eligible, a missing row is Check manually | ✅ pass (8 assertions) |

## Engine suite — 73/73
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
✅ 3b. the route is explained — A German bachelor needs at least 13 years of education — two semesters of a Pakistani bachelor after your HSSC. You have 12. Your routes to a German bachelor: one year of a Pakistani bachelor in the same field, a Studienkolleg (T-Kurs) with the Feststellungsprüfung, or A-Levels/IB
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
✅ 8c. pending checks are marked, not silently ignored — Education, Field, Tuition, Semester contribution
✅ 8d. completeness is reported per step — total 16%, step1 100%
✅ 8e. a Step-1 profile counts as step-1 complete
— extra: traps from the brief ————————————————————
✅ deadline in the past is Not eligible — The non-EU deadline was 2025-01-15 — 648 days ago
✅ subject-ECTS shortfall is Not eligible and named — needs 120 ECTS in cs, you have 90
✅ German-taught + no German level is Check manually — check_manually
✅ German-taught with only B1 is Not eligible — Needs German C1 (DSH-2), you have B1
✅ GRE 165 meets a 164 gate
✅ results sort eligible → check manually → not eligible — emn
✅ no verdict is ever returned without reasons
✅ an unset target level is Check manually, not Not eligible — check_manually / Waiting on your profile: Level, Education, Field, Tuition, Semester contribution
✅ a scholarship with no target level set is Check manually, not Not eligible — check_manually / Not stated: GPA, Deadline, Coverage
✅ a listing with no requirement row still gets a Check manually verdict — A,B / check_manually
✅ daysToDeadline counts from today — 10
— case 9: years of education decide bachelor / master —————
✅ 9a. HSSC alone is 12 years — 12
✅ 9b. 12 years is Not eligible for a bachelor — not_eligible
✅ 9c. the missing year is named — A German bachelor needs at least 13 years of education — two semesters of a Paki
✅ 9d. 2 semesters of a bachelor is 13 years — 13
✅ 9e. 13 years can apply for a bachelor
✅ 9f. the bachelor programme accepts 13 years — Waiting on your profile: Field
✅ 9g. 13 years cannot apply for a master
✅ 9h. a completed 3-year bachelor is 15 years — 15
✅ 9i. 15 years is Not eligible for a master (16 required) — not_eligible
✅ 9j. it says 16 years are needed — A master needs a completed four-year bachelor (16 years of education). You have 15 and a c
✅ 9k. a completed 4-year bachelor is 16 years — 16
✅ 9l. 16 years can apply for a master
✅ 9m. the master programme accepts 16 years
✅ 9n. a master holder can apply for a bachelor
✅ 9o. and for a master
✅ 9p. A-Levels at 12 years can apply for a bachelor
✅ 9q. subject ECTS are not checked for a bachelor target — Level,Education,anabin / ZAB,Field,Teaching language,Tuition,Semester contribution,Intake,Deadline
— case 10: anabin status decides the ZAB —————————————
✅ 10a. H+ needs no ZAB
✅ 10b. H+/- is conditional
✅ 10c. H- requires a ZAB statement
✅ 10d. an H+ institution passes the anabin check — Level:pass, Education:pass, anabin / ZAB:pass, Field:pass, Teaching language:pass, Tuition:pass, Semester contribution:pass, Intake:pass, Deadline:pass
✅ 10e. an H- institution is never silently fine — check_manually / Not stated: ZAB
✅ 10f. the ZAB is named as the thing to do, not hidden as a pass
✅ 10g. no anabin record is unknown, never H+ — Not stated: ZAB
— case 11: PTE, GMAT and admin-filled requirements ——————
✅ 11a. PTE satisfies a programme that accepts PTE — Meets every stated requirement
✅ 11b. GMAT gate with no score is Not eligible
✅ 11c. GMAT 640 meets a 600 gate
✅ 11d. the listing's match block becomes the requirement row — {"gpa":2.5,"level":"master","tuition":0}
✅ 11e. listing display fields fill the gaps (intake, deadline) — ["winter_2029"]
✅ 11f. a listing whose admin row is complete is Eligible — eligible / Meets every stated requirement
✅ an empty profile object is screened, not crashed — not_eligible
✅ 11g. a listing with no match block is Check manually
73/73 engine checks passed
```

## UI suite — 50/50
```
✅ no separate "find my path" page exists — route /path: no page
✅ the sidebar has no "Find my path" entry
✅ the profile page carries the matching fields
✅ it explains what these details decide
✅ the form is six steps — 6 steps
✅ the steps are numbered 1 to 6 in order — 1·What you are applying for | 2·Languages | 3·Education | 4·ECTS | 5·Test requirements | 6·Money
✅ step 1 is what you are applying for, step 2 languages, step 3 education — 1What you are applying for22% | 2Languages0% | 3Education0%
✅ nothing asks for a passport, CNIC, IBAN or account number
✅ step 1 shows which degrees you can apply for — Bachelor: not yet · Master: not yet · PhD: not yet
✅ languages: IELTS, TOEFL and PTE are all asked for — yes,yes,yes
✅ German level is asked for
✅ education: the add buttons cover matric, HSSC, bachelor and master — + Matric (10th) | + Intermediate / HSSC (12th) | + Bachelor | + Master
✅ education: it says years of education are what decide the level — 0 years, 13 years, 16 years
✅ 12 years of education is shown as 12 years — 12 years, 12 years, 12 years
✅ with only an HSSC a bachelor is not yet open — Bachelor: not yet
✅ typing a university searches the anabin list — National University of Sciences & TechnologyH+Islamabad
✅ each anabin result carries its status — National University of Sciences & TechnologyH+Islamabad
✅ choosing an institution stores its anabin status — anabin H+
✅ the ZAB question is answered from the status — anabin H+ — Your institution is H+ in anabin — recognised, no ZAB statement neededCheck liveStored status from
✅ a live anabin check button exists
✅ two semesters of a bachelor is 13 years — 13 years, 12 years, 12 years, 13 years
✅ 13 years opens the bachelor — Bachelor: you can apply
✅ 13 years still does not open a master — Master: not yet
✅ a completed four-year bachelor is 16 years — 16 years, 12 years, 12 years, 16 years
✅ 16 years opens the master — Master: you can apply
✅ the German-grade conversion is shown with its working — 1 + 3 × (4 − 3.4) / (4 − 2) = 1
✅ ECTS is asked of a master applicant — Total ECTS of your completed degreeA four-year Pak
✅ ECTS is skipped for a bachelor applicant — ECTS are not asked for a bachelor application — a school certificate has no ECTS.
✅ tests: GRE sections are separate and never a total
✅ tests: GMAT, SAT, ACT, TestAS and GATE are all offered — yyyyy
✅ there is one save button for the matching fields
✅ the education records are stored on the server — hssc:-, bachelor:8
✅ the anabin status is stored with the institution — hssc:-, bachelor:H+
✅ the German grade is converted server-side — 1.9
✅ completeness is reported per step, six of them — 92% {"1":100,"2":76,"3":100,"4":100,"5":100,"6":82}
✅ the programme list shows how many you can apply to — 2 you can apply to 
✅ every programme card carries a verdict badge — 7 badges: Check yourself, Eligible
✅ badges use the three honest verdicts only
✅ scholarship cards carry verdict badges too — 9 badges
✅ the programme page carries an eligibility panel
✅ the panel names the verdict
✅ the panel prints reasons — Requirements — The requirements for this programme have not been verified yet, so eligibility cannot be screened. Check the official page.
✅ the panel says screening is not admission
✅ the admin listing form carries the matching requirements section
✅ the admin form asks for the 13 hard fields — yyyy
✅ the admin form asks for the test gates separately (GRE sections, GMAT, TestAS, SAT, ACT)
✅ an admin can save requirements on a live listing
✅ the student verdict for that listing then comes from the admin row — eligible — Meets every stated requirement
✅ the GRE gate the admin added is enforced — Level:pass, Education:pass, anabin / ZAB:pass, Field:pass, Teaching language:pass, Bachelor ECTS:pass, GPA:pass, English:pass, GRE:pass, Tuition:pass, Semester contribution:pass, Intake:pass, Deadline:pass
✅ with an empty profile nothing is marked Eligible — Check yourself, Not eligible
```

## What the UI suite drives

1. Signs in as a student and clears the matching profile through the API, so
   every run starts blank.
2. Mounts `/path` and asserts there is **no such page**; then `/profile`, where
   it checks the six steps are **numbered 1 to 6 in order** and that no input in
   the card asks for a passport, CNIC, IBAN or account number.
3. **Step 1** — Master, English, Winter 2029, nationality PK; the card shows
   which degrees are open ("Bachelor: not yet · Master: not yet").
4. **Step 2** — IELTS, TOEFL **and PTE** are each asked for; MOI is recorded;
   German level and certificate are there.
5. **Step 3** — the **+** buttons add Matric / HSSC / Bachelor / Master. An HSSC
   alone reads 12 years and the card says a bachelor is not yet open. Adding a
   bachelor and typing “NUST” searches our anabin snapshot, the result carries
   **H+**, choosing it stores the status, and the ZAB line says *“recognised, no
   ZAB statement needed”*. Two semesters then reads **13 years** and opens the
   bachelor while the master stays closed; eight semesters with a CGPA reads
   **16 years**, opens the master, and prints the Bavarian working.
6. **Step 4** — the ECTS fields appear for a master applicant and are replaced by
   “ECTS are not asked for a bachelor application” when the target is switched.
7. **Step 5** — GRE sections separately (no GRE total anywhere), GMAT, SAT, ACT,
   TestAS, GATE all present. **Step 6** — budget, contribution, funding need.
8. Saves once, then reads the profile back from the API: two education records,
   the anabin status stored with the institution, `gpaGerman 1.9`, and
   completeness across six steps.
9. `/programs` and `/scholarships` carry verdict badges; a programme page shows
   the “Can I apply?” panel with named reasons and the “not an offer of
   admission” line.
10. The **admin** listing form carries the “Matching requirements” section with
    the 13 hard fields and the separate test gates; an admin save then changes
    the verdict a student sees, and the suite restores the seed afterwards.

## Deliberate non-assertions

The suite never asserts that a Check-manually result is absent from a list —
it must never be absent — and it never asserts a match percentage: the app shows
reasons, and any score is secondary to them.
