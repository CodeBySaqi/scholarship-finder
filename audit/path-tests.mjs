/* ScholarPath engine tests — the 8 required cases plus the unit checks behind
   them. Fixtures only: a fixture is allowed to hold an invented requirement
   because it exists to prove a rule; the real catalogue never contains invented
   values (see data/path-programmes.json).
   Run: node audit/path-tests.mjs
*/
import {
  evaluateProgramme, evaluateScholarship, matchProgrammes, germanGpa, gpaPasses,
  completeness, VERDICT, daysToDeadline, matchListings, requirementFromListing
} from '../src/path/engine.js';
import { educationSummary, entryYears, zabRule } from '../src/path/education.js';

const TODAY = '2026-10-25';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
};

/* ---------------------------------------------------------------- profiles */
/* The education model: entries, not a pile of booleans. A completed four-year
   Pakistani BS is 8 semesters = 16 years of education. */
const hsscEntry = {
  id: 'e0', level: 'hssc', school: 'hssc', institution: 'Government College, Faisalabad',
  field: 'pre_engineering', percentage: 88
};
const bachelorEntry = {
  id: 'e1', level: 'bachelor', institution: 'National University of Sciences and Technology (NUST)',
  anabinStatus: 'H+', field: 'computer_science', cgpa: 3.4, scaleMax: 4, passMark: 2,
  semestersDone: 8, totalSemesters: 8, completed: true, startYear: 2021, endYear: 2025
};
const masterEntry = {
  id: 'e2', level: 'master', institution: 'University of the Punjab', anabinStatus: 'H+',
  field: 'computer_science', cgpa: 3.6, scaleMax: 4, passMark: 2,
  semestersDone: 4, totalSemesters: 4, completed: true
};

const masterBase = {
  target: { level: 'master', language: 'english', intake: 'winter_2029' },
  nationality: { nationality: 'PK', residence: 'PK', lastDegreeCountry: 'PK' },
  academics: {
    bachelorField: 'computer_science', bachelorEcts: 180,
    gpaOriginal: 3.4, gpaScaleMax: 4, gpaPassMark: 2,
    subjectEcts: { cs: 90, maths: 30, stats: 15 }
  },
  language: { ielts: 7.0, englishMediumDegree: true },
  education: { entries: [hsscEntry, bachelorEntry] },
  tests: {},
  money: { maxTuitionPerSemester: 0, maxSemesterContribution: 500, fundingNeed: 'full', blockedAccount: 'unsure' },
  scholarshipExtras: {},
  documents: {}
};
const withGpa = (p) => ({ ...p, academics: { ...p.academics, gpaGerman: germanGpa(p.academics.gpaOriginal, { scaleMax: 4, passMark: 2 }).value } });

const prog = (over = {}) => ({
  id: 'X1', title: 'Fixture programme', university: 'Fixture University', level: 'master',
  teachingLanguages: ['english'], acceptedFields: ['computer_science'],
  tuitionPerSemester: 0, semesterContribution: 150,
  intake: 'winter_2029', deadlineNonEu: '2029-01-15',
  ...over
});

console.log('\n— case 1: 180 ECTS, no GRE —————————————————————————');
{
  const p = withGpa(masterBase);
  const p210 = prog({ id: 'P210', title: 'Needs 210 ECTS', bachelorEctsRequired: 210 });
  const r = evaluateProgramme(p, p210, TODAY);
  ok('1a. 210-ECTS programme is Not eligible', r.verdict === VERDICT.NOT_ELIGIBLE, r.verdict);
  ok('1b. the gap is named in words', /Needs 210 ECTS, you have 180/.test(r.headline), r.headline);

  const pGre = prog({ id: 'PGRE', title: 'GRE gated', otherRequirements: { gre: { quant: 164, aw: 4.0 } } });
  const r2 = evaluateProgramme(p, pGre, TODAY);
  ok('1c. GRE-gated programme with no GRE is Not eligible', r2.verdict === VERDICT.NOT_ELIGIBLE, r2.verdict);
  ok('1d. it says which GRE sections are missing', /GRE quant 164/.test(r2.headline), r2.headline);
}

console.log('\n— case 2: MOI yes, no IELTS ————————————————————————');
{
  const p = withGpa({ ...masterBase, language: { ielts: null, englishMediumDegree: true } });
  const rejected = prog({ id: 'MOI-NO', ieltsReq: 6.5, englishOther: 'moi_rejected', englishOtherText: 'MOI not accepted' });
  ok('2a. MOI-rejecting programme is NOT eligible', evaluateProgramme(p, rejected, TODAY).verdict === VERDICT.NOT_ELIGIBLE);
  const accepted = prog({ id: 'MOI-YES', ieltsReq: 6.5, englishOther: 'moi_accepted' });
  ok('2b. MOI-accepting programme may pass English', !evaluateProgramme(p, accepted, TODAY).failed.some(f => f.check === 'English'));
  const silent = prog({ id: 'MOI-?', ieltsReq: 6.5 });
  ok('2c. programme silent on MOI is Check manually, not Eligible',
    evaluateProgramme(p, silent, TODAY).verdict === VERDICT.CHECK_MANUALLY,
    evaluateProgramme(p, silent, TODAY).verdict);
}

console.log('\n— case 3: HSSC only, no route ————————————————————');
{
  const p = {
    target: { level: 'bachelor', language: 'english', intake: 'winter_2029' },
    nationality: { nationality: 'PK' },
    academics: { hsscGroup: 'pre_engineering' },
    education: { entries: [hsscEntry] },
    language: { ielts: 6.5 }, tests: {}, money: {}, scholarshipExtras: {}, documents: {}
  };
  const abitur = prog({
    id: 'B1', level: 'bachelor', acceptedFields: ['pre_engineering'],
    bachelorEctsRequired: null, otherRequirements: {}, deadlineNonEu: '2029-07-15',
    requiresAbiturEquivalent: true
  });
  const r = evaluateProgramme(p, abitur, TODAY);
  ok('3a. Abitur-equivalence programme is never silently Eligible', r.verdict !== VERDICT.ELIGIBLE, r.verdict);
  ok('3b. the route is explained', r.reasons.some(x => /Abitur|Studienkolleg|1 year/i.test(x.text)) ||
    r.missing.length > 0 || r.failed.length > 0, r.headline);
}

console.log('\n— case 4: nothing stated ——————————————————————————');
{
  const p = withGpa(masterBase);
  const blank = {
    id: 'BLANK', title: 'Bare programme', university: 'U', level: 'master',
    teachingLanguages: null, acceptedFields: null, tuitionPerSemester: null,
    intake: null, deadlineNonEu: null, semesterContribution: null
  };
  const r = evaluateProgramme(p, blank, TODAY);
  ok('4a. a programme with IELTS, GPA, ECTS unstated is Check manually', r.verdict === VERDICT.CHECK_MANUALLY, r.verdict);
  ok('4b. it lists the missing fields', r.missing.length > 0, r.missing.map(m => m.check).join(', '));
  ok('4c. it never becomes Eligible', r.verdict !== VERDICT.ELIGIBLE);
}

console.log('\n— case 5: budget €0 vs Baden-Württemberg ———————————');
{
  const p = withGpa(masterBase);  // maxTuitionPerSemester: 0
  const bw = prog({ id: 'BW', state: 'Baden-Württemberg', tuitionPerSemester: 1500, semesterContribution: 180 });
  const r = evaluateProgramme(p, bw, TODAY);
  ok('5a. €1,500/sem programme is Not eligible on a €0 budget', r.verdict === VERDICT.NOT_ELIGIBLE, r.verdict);
  ok('5b. it is never described as free', !/free/i.test(r.headline) && /€1500/.test(r.headline.replace(/\s/g, '')), r.headline);
  const unknownTuition = prog({ id: 'BW?', state: 'Baden-Württemberg', tuitionPerSemester: null });
  ok('5c. unknown tuition is Check manually, never "free"',
    evaluateProgramme(p, unknownTuition, TODAY).verdict === VERDICT.CHECK_MANUALLY);
}

console.log('\n— case 6: full-funding need vs tuition-only ——————————');
{
  const p = { ...withGpa(masterBase), money: { ...masterBase.money, fundingNeed: 'full' } };
  /* fields: [] is a stated "all disciplines"; an unstated value would be unknown */
  const tuitionOnly = {
    id: 'S1', title: 'Tuition waiver', provider: 'X', levels: ['master'],
    nationalities: ['PK'], fields: [], minGpaGerman: 2.5, ieltsReq: 6.5, germanReq: false,
    covers: 'tuition_only', deadline: '2027-03-01', link: 'https://x'
  };
  const r = evaluateScholarship(p, tuitionOnly, TODAY);
  ok('6a. tuition-only scholarship does not satisfy full need', r.verdict === VERDICT.NOT_ELIGIBLE, r.verdict);
  ok('6b. it says what the scholarship actually covers', /tuition only/.test(r.headline), r.headline);
  const full = { ...tuitionOnly, id: 'S2', covers: 'full' };
  ok('6c. a full scholarship passes', evaluateScholarship(p, full, TODAY).verdict === VERDICT.ELIGIBLE);
  const unknown = { ...tuitionOnly, id: 'S3', covers: null };
  ok('6d. unstated coverage is Check manually', evaluateScholarship(p, unknown, TODAY).verdict === VERDICT.CHECK_MANUALLY);
  /* a requirement we never verified is not a requirement that passed */
  const unverified = { ...full, id: 'S4', ieltsReq: null };
  const un = evaluateScholarship(p, unverified, TODAY);
  ok('6e. an unstated English requirement is never silently waived',
    un.verdict === VERDICT.CHECK_MANUALLY && un.missing.some(m => /IELTS/i.test(m.check)),
    un.verdict + ' / ' + un.headline);
}

console.log('\n— case 7: German GPA direction ————————————————————');
{
  ok('7a. 1.9 passes a 2.5 threshold', gpaPasses(1.9, 2.5) === true);
  ok('7b. 3.1 fails a 2.5 threshold', gpaPasses(3.1, 2.5) === false);
  const p = withGpa({ ...masterBase, academics: { ...masterBase.academics, gpaOriginal: 3.65 } });
  const r = evaluateProgramme(p, prog({ minGpaGerman: 2.5 }), TODAY);
  ok('7c. converted 3.65/4 ≈ 1.4 passes 2.5', r.verdict === VERDICT.ELIGIBLE && !r.failed.length, 'gpa ' + p.academics.gpaGerman);
  const low = withGpa({ ...masterBase, academics: { ...masterBase.academics, gpaOriginal: 2.2 } });
  const r2 = evaluateProgramme(low, prog({ minGpaGerman: 2.5 }), TODAY);
  ok('7d. converted 2.2/4 ≈ 3.4 fails 2.5', r2.verdict === VERDICT.NOT_ELIGIBLE, 'gpa ' + low.academics.gpaGerman);
  const formula = germanGpa(3.4, { scaleMax: 4, passMark: 2 });
  ok('7e. the Modified Bavarian Formula is shown as working', /1 \+ 3 × \(4 − 3\.4\) \/ \(4 − 2\)/.test(formula.working), formula.working);
}

console.log('\n— case 8: Step-1-only profile ————————————————————');
{
  const step1 = {
    target: { level: 'master', language: 'english', intake: 'winter_2029' },
    nationality: { nationality: 'PK' },
    academics: {}, language: {}, tests: {}, money: {}, scholarshipExtras: {}, documents: {}
  };
  const list = [
    prog({ id: 'A', tuitionPerSemester: 0, acceptedFields: ['computer_science'] }),
    prog({ id: 'B', tuitionPerSemester: 1500, acceptedFields: ['computer_science'] })
  ];
  const out = matchProgrammes(step1, list, TODAY);
  ok('8a. Step-1-only still returns results, not zero', out.length === 2, out.length + ' results');
  ok('8b. none of them claims Eligible', out.every(r => r.verdict !== VERDICT.ELIGIBLE), out.map(r => r.verdict).join(', '));
  ok('8c. pending checks are marked, not silently ignored',
    out.some(r => r.reasons.some(x => x.status === 'pending')),
    out[0].reasons.filter(x => x.status === 'pending').map(x => x.check).join(', '));
  const c = completeness(step1);
  ok('8d. completeness is reported per step', c.pct > 0 && c.steps[1] === 100, 'total ' + c.pct + '%, step1 ' + c.steps[1] + '%');
  ok('8e. a Step-1 profile counts as step-1 complete', c.step1Complete === true);
}

console.log('\n— extra: traps from the brief ————————————————————');
{
  /* non-EU deadline that has passed */
  const p = withGpa(masterBase);
  const closed = prog({ deadlineNonEu: '2025-01-15' });
  const r = evaluateProgramme(p, closed, TODAY);
  ok('deadline in the past is Not eligible', r.verdict === VERDICT.NOT_ELIGIBLE && /days ago/.test(r.headline), r.headline);

  /* subject ECTS shortfall */
  const ects = prog({ subjectEcts: { cs: 120 } });
  const r2 = evaluateProgramme(p, ects, TODAY);
  ok('subject-ECTS shortfall is Not eligible and named',
    r2.verdict === VERDICT.NOT_ELIGIBLE && /needs 120 ECTS in cs, you have 90/.test(r2.headline), r2.headline);

  /* German-taught with no German */
  const germanTaught = prog({ teachingLanguages: ['german'], germanReq: { level: 'c1', test: 'DSH-2' } });
  const r3 = evaluateProgramme({ ...p, target: { ...p.target, language: 'either' } }, germanTaught, TODAY);
  ok('German-taught + no German level is Check manually', r3.verdict === VERDICT.CHECK_MANUALLY, r3.verdict);
  const r4 = evaluateProgramme({ ...p, target: { ...p.target, language: 'either' }, language: { ...p.language, germanLevel: 'b1' } }, germanTaught, TODAY);
  ok('German-taught with only B1 is Not eligible', r4.verdict === VERDICT.NOT_ELIGIBLE, r4.headline);

  /* GRE pass */
  const withGre = { ...p, tests: { gre: { quant: 165, verbal: 155, aw: 4.0 } } };
  ok('GRE 165 meets a 164 gate',
    !evaluateProgramme(withGre, prog({ otherRequirements: { gre: { quant: 164 } } }), TODAY).failed.length);

  /* sort order: eligible, manual, not eligible */
  const sorted = matchProgrammes(p, [
    prog({ id: 'n', tuitionPerSemester: 1500 }),
    prog({ id: 'm', tuitionPerSemester: null }),
    prog({ id: 'e', tuitionPerSemester: 0 })
  ], TODAY).map(r => r.id).join('');
  ok('results sort eligible → check manually → not eligible', sorted === 'emn', sorted);

  /* every result keeps its reasons */
  ok('no verdict is ever returned without reasons',
    matchProgrammes(p, [prog({ id: 'x' })], TODAY).every(r => r.reasons.length > 0));

  /* an unset target level is missing data, never a failure */
  const noLevel = evaluateProgramme({ target: {}, academics: {}, language: {}, tests: {}, money: {} },
    prog({ level: 'master', tuitionPerSemester: 0 }), TODAY);
  ok('an unset target level is Check manually, not Not eligible',
    noLevel.verdict === 'check_manually' && noLevel.pending.includes('Level') && noLevel.missing.length === 0,
    noLevel.verdict + ' / ' + noLevel.headline);

  /* a scholarship that names its levels, screened against a profile with no level */
  const noLevelSch = evaluateScholarship({ target: {}, academics: {}, language: {}, tests: {}, money: {} },
    { id: 'SX', title: 'Fixture scholarship', levels: ['master'], coverage: 'tuition' }, TODAY);
  ok('a scholarship with no target level set is Check manually, not Not eligible',
    noLevelSch.verdict === 'check_manually' && noLevelSch.pending.includes('Level'),
    noLevelSch.verdict + ' / ' + noLevelSch.headline);

  /* every live listing gets a verdict, matched or not */
  const listings = [{ id: 'A', title: 'a', provider: 'p', kind: 'program' },
                    { id: 'B', title: 'b', provider: 'p', kind: 'program' }];
  const listed = matchListings(p, listings, { A: prog({ id: 'A' }) }, TODAY);
  ok('a listing with no requirement row still gets a Check manually verdict',
    Object.keys(listed).length === 2 && listed.B.verdict === VERDICT.CHECK_MANUALLY,
    Object.keys(listed).join(',') + ' / ' + listed.B.verdict);

  /* deadline maths */
  ok('daysToDeadline counts from today', daysToDeadline('2026-11-04', TODAY) === 10, String(daysToDeadline('2026-11-04', TODAY)));
}


console.log('\n— case 9: years of education decide bachelor / master —————');
{
  const level = (entries, target) => ({
    target: { level: target, language: 'english', intake: 'winter_2029' },
    nationality: { nationality: 'PK' },
    academics: { fieldNote: 'x' }, education: { entries },
    language: { ielts: 7 }, tests: {}, money: { maxTuitionPerSemester: 0, maxSemesterContribution: 500, fundingNeed: 'self' }
  });
  const bachProg = prog({ id: 'B', level: 'bachelor', acceptedFields: ['pre_engineering'],
    requiresAbiturEquivalent: true, tuitionPerSemester: 0 });
  const mastProg = prog({ id: 'M', level: 'master' });

  /* 12 years — HSSC only */
  ok('9a. HSSC alone is 12 years', entryYears(hsscEntry) === 12, String(entryYears(hsscEntry)));
  const hsscOnly = level([hsscEntry], 'bachelor');
  const r12 = evaluateProgramme(hsscOnly, bachProg, TODAY);
  ok('9b. 12 years is Not eligible for a bachelor', r12.verdict === VERDICT.NOT_ELIGIBLE, r12.verdict);
  ok('9c. the missing year is named', /at least 13 years/.test(r12.headline) && /You have 12/.test(r12.headline), r12.headline.slice(0, 80));

  /* 13 years — two semesters of a bachelor */
  const twoSem = { ...bachelorEntry, id: 'e-half', semestersDone: 2, completed: false, anabinStatus: 'H+' };
  const p13 = level([hsscEntry, twoSem], 'bachelor');
  ok('9d. 2 semesters of a bachelor is 13 years', educationSummary(p13).years === 13, String(educationSummary(p13).years));
  ok('9e. 13 years can apply for a bachelor', educationSummary(p13).canApply.bachelor === true);
  ok('9f. the bachelor programme accepts 13 years',
    !evaluateProgramme(p13, bachProg, TODAY).failed.some(f => f.check === 'Education'),
    evaluateProgramme(p13, bachProg, TODAY).headline);
  ok('9g. 13 years cannot apply for a master', educationSummary(p13).canApply.master === false);

  /* 15 years — a completed three-year bachelor */
  const threeYear = { ...bachelorEntry, id: 'e15', semestersDone: 6, completed: true };
  const p15 = level([hsscEntry, threeYear], 'master');
  const r15 = evaluateProgramme(p15, mastProg, TODAY);
  ok('9h. a completed 3-year bachelor is 15 years', educationSummary(p15).years === 15, String(educationSummary(p15).years));
  ok('9i. 15 years is Not eligible for a master (16 required)', r15.verdict === VERDICT.NOT_ELIGIBLE, r15.verdict);
  ok('9j. it says 16 years are needed', /16 years/.test(r15.headline), r15.headline.slice(0, 90));

  /* 16 years — a completed four-year bachelor */
  const p16 = level([hsscEntry, bachelorEntry], 'master');
  ok('9k. a completed 4-year bachelor is 16 years', educationSummary(p16).years === 16, String(educationSummary(p16).years));
  ok('9l. 16 years can apply for a master', educationSummary(p16).canApply.master === true);
  ok('9m. the master programme accepts 16 years',
    !evaluateProgramme(p16, mastProg, TODAY).failed.some(f => f.check === 'Education'));

  /* a master holder may still apply for a bachelor */
  const pMaster = level([hsscEntry, bachelorEntry, masterEntry], 'bachelor');
  ok('9n. a master holder can apply for a bachelor', educationSummary(pMaster).canApply.bachelor === true);
  ok('9o. and for a master', educationSummary(pMaster).canApply.master === true);

  /* A-Levels are Abitur-equivalent, so 12 years is enough */
  const aLevels = { ...hsscEntry, id: 'e-al', school: 'a_levels', percentage: 85 };
  ok('9p. A-Levels at 12 years can apply for a bachelor',
    educationSummary(level([aLevels], 'bachelor')).canApply.bachelor === true);

  /* ECTS are never asked of a bachelor applicant */
  const rEcts = evaluateProgramme(p13, prog({ level: 'bachelor', acceptedFields: ['pre_engineering'],
    requiresAbiturEquivalent: true, subjectEcts: { maths: 30 }, tuitionPerSemester: 0 }), TODAY);
  ok('9q. subject ECTS are not checked for a bachelor target',
    !rEcts.reasons.some(x => x.check === 'Subject credits'),
    rEcts.reasons.map(x => x.check).join(','));
}

console.log('\n— case 10: anabin status decides the ZAB —————————————');
{
  const withStatus = (status) => ({
    target: { level: 'master', language: 'english', intake: 'winter_2029' },
    nationality: { nationality: 'PK' },
    academics: { bachelorField: 'computer_science', bachelorEcts: 180, gpaOriginal: 3.4, gpaScaleMax: 4, gpaPassMark: 2,
      subjectEcts: { cs: 90 } },
    education: { entries: [hsscEntry, { ...bachelorEntry, anabinStatus: status }] },
    language: { ielts: 7 }, tests: {},
    money: { maxTuitionPerSemester: 0, maxSemesterContribution: 500, fundingNeed: 'self' }
  });
  ok('10a. H+ needs no ZAB', zabRule('H+').zabRequired === false);
  ok('10b. H+/- is conditional', zabRule('H+/-').conditional === true && zabRule('H+/-').zabRequired === false);
  ok('10c. H- requires a ZAB statement', zabRule('H-').zabRequired === true);

  const hPlus = evaluateProgramme(withStatus('H+'), prog({}), TODAY);
  ok('10d. an H+ institution passes the anabin check',
    hPlus.reasons.some(x => x.check === 'anabin / ZAB' && x.status === 'pass'),
    hPlus.reasons.map(x => x.check + ':' + x.status).join(', '));

  const hMinus = evaluateProgramme(withStatus('H-'), prog({}), TODAY);
  ok('10e. an H- institution is never silently fine',
    hMinus.verdict === VERDICT.CHECK_MANUALLY && hMinus.reasons.some(x => x.check === 'ZAB' && /Zeugnisbewertung/.test(x.text)),
    hMinus.verdict + ' / ' + hMinus.headline);
  ok('10f. the ZAB is named as the thing to do, not hidden as a pass',
    hMinus.reasons.some(x => x.status === 'unknown' && /ZAB/.test(x.text)));

  const noRecord = evaluateProgramme(withStatus(null), prog({}), TODAY);
  ok('10g. no anabin record is unknown, never H+',
    noRecord.reasons.some(x => x.check === 'ZAB' && x.status === 'unknown'),
    noRecord.headline);
}

console.log('\n— case 11: PTE, GMAT and admin-filled requirements ——————');
{
  const p = withGpa({ ...masterBase, language: { ielts: null, pte: 68, englishMediumDegree: false } });
  const pteProg = prog({ id: 'PTE', pteReq: 62, ieltsReq: 6.5 });
  const r = evaluateProgramme(p, pteProg, TODAY);
  ok('11a. PTE satisfies a programme that accepts PTE',
    !r.failed.some(f => f.check === 'English'), r.headline);

  const gmatProg = prog({ id: 'GMAT', otherRequirements: { gmat: 600 } });
  ok('11b. GMAT gate with no score is Not eligible',
    evaluateProgramme({ ...withGpa(masterBase), tests: {} }, gmatProg, TODAY).verdict === VERDICT.NOT_ELIGIBLE);
  ok('11c. GMAT 640 meets a 600 gate',
    !evaluateProgramme({ ...withGpa(masterBase), tests: { gmat: 640 } }, gmatProg, TODAY).failed.some(f => f.check === 'GMAT'));

  /* the admin-filled block on the listing is what the engine reads */
  const listing = {
    id: 'L1', title: 'M.Sc. Test', provider: 'Test University', degreeLevels: ['master'],
    languageMode: 'english', tuitionPerSemester: 0, semesterFee: 150, deadline: '2029-01-15',
    intakes: ['WS'], officialUrl: 'https://example.test',
    match: { minGpaGerman: 2.5, ieltsReq: 6.5, acceptedFields: ['computer_science'], bachelorEctsRequired: 180 }
  };
  const req = requirementFromListing(listing);
  ok('11d. the listing\'s match block becomes the requirement row',
    req.minGpaGerman === 2.5 && req.level === 'master' && req.tuitionPerSemester === 0,
    JSON.stringify({ gpa: req.minGpaGerman, level: req.level, tuition: req.tuitionPerSemester }));
  ok('11e. listing display fields fill the gaps (intake, deadline)',
    req.deadlineNonEu === '2029-01-15' && Array.isArray(req.intake), JSON.stringify(req.intake));
  const verdicts = matchListings(withGpa(masterBase), [listing], {}, TODAY);
  ok('11f. a listing whose admin row is complete is Eligible',
    verdicts.L1.verdict === VERDICT.ELIGIBLE,
    verdicts.L1.verdict + ' / ' + (verdicts.L1.headline || ''));
  /* nobody signed in / no profile at all must not crash the endpoint */
  const anon = matchListings({}, [{ id: 'L0', title: 'x', provider: 'p', degreeLevels: ['master'],
    match: { level: 'master', ieltsReq: 6.5, tuitionPerSemester: 0 } }], {}, TODAY);
  ok('an empty profile object is screened, not crashed',
    anon.L0 && anon.L0.verdict === VERDICT.NOT_ELIGIBLE, anon.L0 ? anon.L0.verdict : 'missing');

  const blank = { id: 'L2', title: 'No row', provider: 'X', degreeLevels: ['master'] };
  ok('11g. a listing with no match block is Check manually',
    matchListings(withGpa(masterBase), [blank], {}, TODAY).L2.verdict === VERDICT.CHECK_MANUALLY);
}

console.log('\n' + results.filter(r => r.pass).length + '/' + results.length + ' engine checks passed');
process.exit(results.every(r => r.pass) ? 0 : 1);
