# ScholarPath — test report

- **Engine** — `node audit/path-tests.mjs` (pure functions, fixtures) — **73/73**
- **UI** — `bash audit/run-dom.sh path` (real React app, real API, happy-dom) — **59/59**

## Where the fields live

They are **steps of the profile edit flow**: `/wizard`, numbered 1 → 7, opened by
Profile → Edit profile. `/profile` is a read-only summary whose every line links
into the exact step. There is no separate "find my path" page and no separate
matching card — the suite asserts both.

| Step | What it asks | Saved to |
|---|---|---|
| 1 | About you — name, date of birth, city, IBCC/HEC | the profile the rest of the app reads |
| 2 | What you are applying for — degree, language, intake, nationality | matching profile |
| 3 | Languages — IELTS, TOEFL iBT, PTE Academic, MOI, German level + certificate | matching profile |
| 4 | Education — records via **+**, semesters, CGPA, anabin status, ZAB, years | matching profile |
| 5 | ECTS — total + subject breakdown (master/PhD only) | matching profile |
| 6 | Test requirements — GRE sections separately, GMAT, GATE, TestAS, SAT, ACT | matching profile |
| 7 | Money — budget, funding need, blocked account — plus the documents checklist | both |

## The eight required cases

| # | Case | Result |
|---|---|---|
| 1 | 180 ECTS + no GRE: a 210-ECTS programme is Not eligible (gap named); a GRE gate with no GRE is Not eligible | ✅ pass |
| 2 | MOI yes, no IELTS: an MOI-rejecting programme must NOT become eligible | ✅ pass |
| 3 | HSSC only: a Bachelor requiring Abitur equivalence is never silently Eligible | ✅ pass |
| 4 | Programme with IELTS, GPA, ECTS unstated = Check manually with the fields listed | ✅ pass |
| 5 | Budget €0 vs Baden-Württemberg €1,500/semester — not free, not Eligible | ✅ pass |
| 6 | Full-funding need vs a tuition-only scholarship | ✅ pass |
| 7 | German GPA direction — 1.9 passes 2.5, 3.1 fails | ✅ pass |
| 8 | A Step-1-only profile still returns results, never Eligible, pending named | ✅ pass |

Plus case 9 (years of education: 12/13/15/16, A-Levels, ECTS skipped for a
bachelor target), case 10 (anabin H+/H+/-/H- and the ZAB) and case 11 (PTE, GMAT,
and the admin-filled requirement row).

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

## UI suite — 59/59
```
✅ the profile page carries a summary of the matching details
✅ it is a summary, not a form — no text inputs to type matching data into — 0 inputs
✅ every summary line links into the profile edit flow — /programs:See the programmes, /wizard?step=2:Add, /wizard?step=2:Edit, /wizard?step=3:Add, /wizard?step=3:Add, /wizard?step=5:Add, /wizard?step=6:Add, /wizard?step=7:Add, /wizard?step=4:Add, /wizard?s
✅ nothing on the profile page is called "Programme matching" as a separate card
✅ no separate "find my path" page exists — route /path: no page
✅ the sidebar has no "Find my path" entry
✅ the profile edit flow starts at step 1, not in the middle — Step 1 of 714
✅ step 1 is the personal details — About you
✅ the flow lists all seven steps — 1. About you | 2. What you are applying for | 3. Languages | 4. Education | 5. ECTS | 6. Test requirements | 7. Money and documents
✅ the steps are numbered 1 to 7 in order — 1. About you | 2. What you are applying for | 3. Languages | 4. Education | 5. ECTS | 6. Test requirements | 7. Money and documents
✅ matching steps are 2 target, 3 languages, 4 education, 5 ECTS, 6 tests, 7 money — 1. About you | 2. What you are applying for | 3. Languages | 4. Education | 5. ECTS | 6. Test requirements | 7. Money and documents
✅ nothing asks for a passport, CNIC, IBAN or account number
✅ step 2 shows which degrees you can apply for — Bachelor: not yet · Master: not yet · PhD: not yet
✅ step 2 saves with the flow's own button
✅ languages: IELTS, TOEFL and PTE are all asked for — yes,yes,yes
✅ German level is asked for
✅ step 3 saves — languages stored
✅ education: the add buttons cover matric, HSSC, bachelor and master — + Matric (10th) | + Intermediate / HSSC (12th) | + Bachelor | + Master
✅ education: it says years of education are what decide the level — 0 years, 0 years, 13 years, 16 years
✅ 12 years of education is shown as 12 years — 12 years, 12 years, 12 years, 12 years
✅ with only an HSSC a bachelor is not yet open — Bachelor: not yet
✅ typing a university searches the anabin list — National University of Sciences & TechnologyH+Islamabad
✅ each anabin result carries its status — National University of Sciences & TechnologyH+Islamabad
✅ choosing an institution stores its anabin status — anabin H+
✅ the ZAB question is answered from the status — anabin H+ — Your institution is H+ in anabin — recognised, no ZAB statement neededCheck liveStored status from
✅ a live anabin check button exists
✅ two semesters of a bachelor is 13 years — 13 years, 13 years, 12 years, 12 years
✅ 13 years opens the bachelor — Bachelor: you can apply
✅ 13 years still does not open a master — Master: not yet
✅ a completed four-year bachelor is 16 years — 16 years, 16 years, 12 years, 12 years
✅ 16 years opens the master — Master: you can apply
✅ the German-grade conversion is shown with its working — 1 + 3 × (4 − 3.4) / (4 − 2) = 1
✅ step 4 saves the records — education stored
✅ ECTS is asked of a master applicant — Total ECTS of your completed degreeA four-year Pak
✅ step 5 saves the ECTS — ects stored
✅ ECTS is skipped for a bachelor applicant — ECTSOnly for a master or PhD target — a school certificate has no ECTS.
✅ tests: GRE sections are separate and never a total
✅ tests: GMAT, SAT, ACT, TestAS and GATE are all offered — yyyyy
✅ step 6 saves
✅ the last step saves with one button — Save and finish
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

1. Signs in as a student and clears the matching profile, so every run starts blank.
2. Asserts `/profile` now carries a **summary** (no inputs to type matching data
   into) whose lines link into the wizard, that the words "Programme matching"
   are gone as a card, and that `/path` still does not exist.
3. Opens `/wizard?step=1` and asserts it reads **Step 1 of 7**, that the flow
   lists all seven steps numbered in order, and that nothing asks for a passport,
   CNIC, IBAN or account number.
4. Drives each step through the real controls and **saves with the flow's own
   button** each time, exactly as a student would: target, languages (IELTS +
   TOEFL + PTE), education (add HSSC → 12 years, bachelor → search "NUST" →
   anabin H+ stored → ZAB line → 2 semesters = 13 years → bachelor opens,
   master stays shut → 8 semesters = 16 years → master opens), ECTS (asked for a
   master, "not asked for a bachelor" when the target is switched), tests
   (GRE sections separate, GMAT/SAT/ACT/TestAS/GATE present), money.
5. Reads the profile back from the API: two education records, the anabin status
   stored with the institution, `gpaGerman 1.9`, and completeness across six
   matching groups.
6. Checks the verdict badges on `/programs` and `/scholarships`, the reasoning
   panel on a programme page, and that an **admin** can fill the 13 hard fields
   on a listing and change what the student sees — then restores the seed.
