/* ScholarPath engine tests — the 8 required cases plus the unit checks behind
   them. Fixtures only: a fixture is allowed to hold an invented requirement
   because it exists to prove a rule; the real catalogue never contains invented
   values (see data/path-programmes.json).
   Run: node audit/path-tests.mjs
*/
import {
  evaluateProgramme, evaluateScholarship, matchProgrammes, germanGpa, gpaPasses,
  completeness, VERDICT, daysToDeadline, matchListings
} from '../src/path/engine.js';

const TODAY = '2026-10-25';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
};

/* ---------------------------------------------------------------- profiles */
const masterBase = {
  target: { level: 'master', language: 'english', intake: 'winter_2029' },
  nationality: { nationality: 'PK', residence: 'PK', lastDegreeCountry: 'PK' },
  academics: {
    bachelorField: 'computer_science', bachelorEcts: 180,
    gpaOriginal: 3.4, gpaScaleMax: 4, gpaPassMark: 2,
    subjectEcts: { cs: 90, maths: 30, stats: 15 }
  },
  language: { ielts: 7.0, englishMediumDegree: true },
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
    academics: { sscPct: 88, hsscGroup: 'pre_engineering', undergradYearDone: false, studienkolleg: false },
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

console.log('\n' + results.filter(r => r.pass).length + '/' + results.length + ' engine checks passed');
process.exit(results.every(r => r.pass) ? 0 : 1);
