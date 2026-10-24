/* Profile-vs-matching audit.
   Answers two questions with data rather than opinion:
     1. Which requirement fields does the engine read, and does the profile carry them?
     2. Which fields does the seed never fill, so the rule can never fire?
   Run: node audit/profile-gap.mjs
*/
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const sandbox = { window: {} };
new Function('window', fs.readFileSync(path.join(root, 'server/lib/reference.js'), 'utf8'))(sandbox.window);
new Function('window', fs.readFileSync(path.join(root, 'server/lib/match.cjs'), 'utf8'))(sandbox.window);
const Match = sandbox.window.Match;

const db = JSON.parse(fs.readFileSync(path.join(root, 'data/db.json'), 'utf8'));
const listings = db.listings;
const profiles = db.profiles;
const TODAY = '2026-10-23';

/* ---- 1. every predicate the engine evaluates against the profile -------- */
const PROFILE_FIELDS = [
  ['nationality', 'Nationality restrictions'],
  ['dateOfBirth', 'Age at deadline'],
  ['currentLevel', 'Bachelor entry route (HSSC vs degree)'],
  ['expectedCompletionYear', 'Graduation timing'],
  ['bachelorCgpa', 'CGPA'],
  ['bachelorScale', 'CGPA'],
  ['passMark', 'German grade estimate'],
  ['interPct', 'Percentage (bachelor entry)'],
  ['bachelorPct', 'Percentage (master entry)'],
  ['bachelorField', 'Prior field'],
  ['germanLevel', 'German level'],
  ['ielts.status', 'IELTS'],
  ['ielts.overall', 'IELTS band'],
  ['ielts.date', 'IELTS validity (2 years)'],
  ['fundingNeed', 'Tuition tolerance'],
  ['hsscGroup', 'HSSC subject group'],
  ['ibccStatus', 'IBCC equivalence'],
  ['studienkollegOk', 'Studienkolleg willingness'],
  ['apsStatus', 'APS certificate'],
  ['incomeBracket', 'Income-restricted awards'],
  ['gender', 'Gender-restricted awards'],
  ['workExpMonths', 'Work experience'],
  ['hasEctsBreakdown', 'Subject credits (ECTS)']
];

/* ---- 2. requirement fields the engine reads off a listing --------------- */
const LISTING_FIELDS = [
  'minCgpa', 'germanGradeCutoff', 'minPercentage', 'minIelts', 'ieltsRequired',
  'minGermanLevel', 'requiredPriorFields', 'requiredEcts', 'maxAge',
  'allowedCountries', 'genderRestriction', 'maxIncomeBracket', 'minWorkExpMonths',
  'hsscEntryRoute', 'hsscGroups', 'apsRequired', 'tuitionPerSemester',
  'degreeLevels', 'fieldCategory', 'deadline', 'lastVerified', 'status'
];

const get = (o, key) => key.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

console.log('='.repeat(74));
console.log('1. PROFILE COVERAGE — which fields the seeded students actually carry');
console.log('='.repeat(74));
const students = Object.entries(profiles);
for (const [id, p] of students) {
  const missing = PROFILE_FIELDS.filter(([f]) => {
    const v = get(p, f);
    return v === null || v === undefined || v === '';
  }).map(([f]) => f);
  console.log(`\n${p.fullName} (${id}) — completeness ${p.completenessPct}%`);
  console.log('  missing:', missing.length ? missing.join(', ') : 'none');
}

console.log('\n' + '='.repeat(74));
console.log('2. LISTING FIELD COVERAGE — rules that can never fire on this data');
console.log('='.repeat(74));
for (const f of LISTING_FIELDS) {
  const filled = listings.filter(l => l[f] !== undefined && l[f] !== null && l[f] !== '' &&
    !(Array.isArray(l[f]) && l[f].length === 0)).length;
  const flag = filled === 0 ? '  <-- NEVER SET' : '';
  console.log(`${f.padEnd(22)} ${String(filled).padStart(2)}/${listings.length}${flag}`);
}

console.log('\n' + '='.repeat(74));
console.log('3. MATCH RUN — the bucket each student gets, and why');
console.log('='.repeat(74));
const byCheck = new Map();
for (const [id, p] of students) {
  const targets = p.targets || [];
  for (const kind of ['scholarship', 'program']) {
    const pool = listings.filter(l => l.kind === kind);
    const res = Match.rank(Match.visible(Match.matchAll(p, targets, pool, TODAY)), pool, targets);
    const counts = { meets: 0, almost: 0, next_cycle: 0 };
    res.forEach(r => { counts[r.bucket] = (counts[r.bucket] || 0) + 1; });
    console.log(`\n${p.fullName} · ${kind}: meets ${counts.meets}, almost ${counts.almost}, next-cycle ${counts.next_cycle}, hidden ${pool.length - res.length}`);
    for (const r of res) {
      for (const reason of r.reasons) {
        if (reason.status !== 'gap' && reason.status !== 'fail') continue;
        const key = `${reason.status}|${reason.check}`;
        byCheck.set(key, (byCheck.get(key) || 0) + 1);
      }
    }
  }
}

console.log('\n' + '='.repeat(74));
console.log('4. WHICH CHECK DECIDES THE OUTCOME (largest first)');
console.log('='.repeat(74));
[...byCheck.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
  const [status, check] = k.split('|');
  console.log(`${String(n).padStart(3)}  ${status.padEnd(4)}  ${check}`);
});

/* ---- 5. requirements from the Germany checklist that the engine has no field for ---- */
console.log('\n' + '='.repeat(74));
console.log('5. REQUIREMENTS WITH NO HOME IN THE SCHEMA');
console.log('='.repeat(74));
const absent = [
  ['English proof other than IELTS', 'TOEFL / PTE / Duolingo / English-medium instruction — engine only reads ielts.status'],
  ['Subject ECTS breakdown', 'hasEctsBreakdown is one boolean; requiredEcts needs per-subject credits to be checkable'],
  ['Bachelor length / total ECTS', '3-year (180) vs 4-year (240) decides master eligibility'],
  ['GRE / GMAT', 'no profile or listing field'],
  ['Portfolio / aptitude test / interview', 'no field on either side'],
  ['Letters of recommendation', 'no field'],
  ['Research proposal', 'no field'],
  ['Vorpraktikum / internship weeks', 'no field (workExpMonths is employment, not a required pre-study internship)'],
  ['uni-assist route / VPD status', 'applyRoute exists on the listing, nothing on the profile'],
  ['Blocked account readiness', 'profile has blockedAccountReady but the engine never reads it'],
  ['Health insurance', 'no field anywhere'],
  ['Application / visa budget', 'no field'],
  ['Programme language of instruction', 'listing has languageMode, engine never checks it against the profile'],
  ['Semester number / study gap', 'currentSemester exists, unused']
];
absent.forEach(([a, b]) => console.log(`- ${a}: ${b}`));
