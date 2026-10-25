/* ScholarPath where the student actually is: the numbered matching profile on
   /profile and the verdicts on the programme cards — no separate page.
   Run: bash audit/run-dom.sh path
*/
import { Window } from 'happy-dom';

const API = 'http://localhost:8000';
const win = new Window({ url: API + '/profile', settings: { disableJavaScriptEvaluation: false, disableCSSFileLoading: true } });

globalThis.window = win;
globalThis.document = win.document;
globalThis.navigator = win.navigator;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;
globalThis.Node = win.Node;
globalThis.Event = win.Event;
globalThis.MouseEvent = win.MouseEvent;
globalThis.KeyboardEvent = win.KeyboardEvent;
globalThis.getComputedStyle = win.getComputedStyle.bind(win);
globalThis.localStorage = win.localStorage;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
win.matchMedia = globalThis.matchMedia;

const realFetch = globalThis.fetch;
let cookie = '';
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const target = url.startsWith('/') ? API + url : url;
  const headers = { ...(init.headers || {}) };
  if (cookie && target.startsWith(API)) headers.cookie = cookie;
  const r = await realFetch(target, { ...init, headers });
  for (const c of (r.headers.getSetCookie ? r.headers.getSetCookie() : [])) {
    const kv = c.split(';')[0];
    if (kv.startsWith('sf_session=')) cookie = kv;
  }
  return r;
};
win.fetch = globalThis.fetch;

document.body.innerHTML = '<div id="root"></div>';
const { mount } = await import('/tmp/sf-dom/bundle.mjs');

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
};
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const sel = (s) => [...document.querySelectorAll(s)];
const text = () => document.body.textContent.replace(/\s+/g, ' ');
const byText = (tag, t) => sel(tag).find(e => e.textContent.replace(/\s+/g, ' ').trim().startsWith(t));
const setVal = (el, v) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
};
const byLabel = (label) => {
  const f = sel('#match-fields .field').find(x => new RegExp(label, 'i').test((x.textContent || '').split(/Help|This is|Half a year/)[0]));
  return f ? f.querySelector('input') : null;
};
const chipIn = (scope, label) => {
  const root = typeof scope === 'string' ? document.querySelector(scope) : scope;
  return root ? [...root.querySelectorAll('.chip')].find(c => c.textContent.trim() === label) : null;
};

async function login(email) {
  const r = await realFetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' })
  });
  for (const c of (r.headers.getSetCookie?.() || [])) {
    const kv = c.split(';')[0];
    if (kv.startsWith('sf_session=')) cookie = kv;
  }
}

await login('ayesha@example.com');
/* start blank so the run is repeatable */
await realFetch(API + '/api/path/profile', {
  method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify({ profile: {
    target: { level: null, language: null, intake: null },
    language: { ielts: null, toefl: null, pte: null, englishMediumDegree: null, germanLevel: null },
    education: { entries: [] },
    academics: { bachelorEcts: null, subjectEcts: null, gpaOriginal: null },
    tests: { gre: null, gmat: null }, money: { maxTuitionPerSemester: null, fundingNeed: null }
  } })
});

/* ------------------------------------------------ there is no separate page */
mount('/path');
await wait(1200);
ok('no separate "find my path" page exists', !/Find my path/i.test(text()),
  'route /path: ' + ((document.querySelector('.h1') || {}).textContent || 'no page'));
ok('the sidebar has no "Find my path" entry', !sel('.side__link').some(a => /Find my path/i.test(a.textContent)),
  sel('.side__link').map(a => a.textContent.trim()).join(' · ').slice(0, 110));

/* --------------------------------------------- the fields live in /profile */
mount('/profile');
await wait(1600);
const card = document.querySelector('#match-fields');
ok('the profile page carries the matching fields', !!card);
ok('it explains what these details decide', /Eligible|verdict/i.test(card.textContent));

/* --- numbered 1..6, in order --- */
const stepButtons = [...card.querySelectorAll('.path-step')];
ok('the form is six steps', stepButtons.length === 6, stepButtons.length + ' steps');
ok('the steps are numbered 1 to 6 in order', stepButtons.every((b, i) =>
  b.querySelector('.path-step__n').textContent.trim() === String(i + 1)),
  stepButtons.map(b => b.querySelector('.path-step__n').textContent.trim() + '·' + b.querySelector('.path-step__t').textContent).join(' | '));
ok('step 1 is what you are applying for, step 2 languages, step 3 education',
  /applying/i.test(stepButtons[0].textContent) && /language/i.test(stepButtons[1].textContent) && /education/i.test(stepButtons[2].textContent),
  stepButtons.slice(0, 3).map(b => b.textContent.replace(/\s+/g, ' ').trim()).join(' | '));

const inputs = sel('#match-fields input, #match-fields select, #match-fields textarea');
const bad = inputs.filter(i => /passport|iban|cnic|national id|account number/i.test(
  [i.id, i.name, i.placeholder, i.getAttribute('aria-label'), (i.closest('.field') || {}).textContent || ''].join(' ')));
ok('nothing asks for a passport, CNIC, IBAN or account number', bad.length === 0, bad.map(i => i.id).join(', '));

/* -------------------------------------------------- step 1: the target */
chipIn(card, 'Master').click();
await wait(120);
chipIn(card, 'English only').click();
await wait(120);
chipIn(card, 'Winter 2029').click();
await wait(150);
setVal(card.querySelector('input[list="country-list"]'), 'PK');
await wait(150);
ok('step 1 shows which degrees you can apply for', /you can apply|not yet/i.test(card.textContent),
  (card.textContent.match(/(Bachelor|Master|PhD): (you can apply|not yet)/g) || []).join(' · '));

/* ------------------------------------------------ step 2: the languages */
[...card.querySelectorAll('.path-step')][1].click();
await wait(300);
ok('languages: IELTS, TOEFL and PTE are all asked for',
  !!byLabel('IELTS') && !!byLabel('TOEFL') && !!byLabel('PTE'),
  ['IELTS', 'TOEFL', 'PTE'].map(l => (byLabel(l) ? 'yes' : 'no')).join(','));
setVal(byLabel('IELTS'), '7');
await wait(100);
setVal(byLabel('TOEFL'), '110');
await wait(100);
setVal(byLabel('PTE'), '70');
await wait(100);
const moi = sel('#match-fields .field').find(f => /taught in English/i.test(f.textContent));
if (moi) { const b = [...moi.querySelectorAll('.chip')].find(c => c.textContent.trim() === 'Yes'); if (b) b.click(); }
await wait(150);
ok('German level is asked for', /German level/i.test(card.textContent));

/* ------------------------------------------------ step 3: the education */
[...card.querySelectorAll('.path-step')][2].click();
await wait(300);
ok('education: the add buttons cover matric, HSSC, bachelor and master',
  ['+ Matric (10th)', '+ Intermediate / HSSC (12th)', '+ Bachelor', '+ Master']
    .every(t => [...card.querySelectorAll('button')].some(b => b.textContent.trim() === t)),
  [...card.querySelectorAll('.path-fields .btn')].map(b => b.textContent.trim()).slice(0, 6).join(' | '));
ok('education: it says years of education are what decide the level', /years/i.test(card.textContent) && /13 years|16 years/i.test(card.textContent),
  (card.textContent.match(/\d+(\.\d)? years/g) || []).join(', '));

/* HSSC first — 12 years, so a bachelor is still out of reach */
[...card.querySelectorAll('button')].find(b => b.textContent.trim() === '+ Intermediate / HSSC (12th)').click();
await wait(300);
const hsscBlock = sel('#match-fields .path-edu').slice(-1)[0];
setVal(hsscBlock.querySelector('input'), 'Government College, Faisalabad');
await wait(100);
setVal(hsscBlock.querySelector('input[type="number"]'), '88');
await wait(200);
ok('12 years of education is shown as 12 years', /12 years/.test(card.textContent),
  (card.textContent.match(/\d+(\.\d)? years/g) || []).slice(0, 4).join(', '));
ok('with only an HSSC a bachelor is not yet open', /Bachelor: not yet/.test(card.textContent),
  (card.textContent.match(/Bachelor: [a-z ]+/g) || [''])[0]);

/* now a bachelor, two semesters — 200-level */
[...card.querySelectorAll('button')].find(b => b.textContent.trim() === '+ Bachelor').click();
await wait(300);
const bBlock = sel('#match-fields .path-edu').slice(-1)[0];
const uniInput = bBlock.querySelector('input');
setVal(uniInput, 'NUST');
await wait(700);
const opts = sel('#match-fields .path-anabin-opt');
ok('typing a university searches the anabin list', opts.length > 0,
  opts.slice(0, 2).map(o => o.textContent.replace(/\s+/g, ' ').trim()).join(' || '));
ok('each anabin result carries its status', opts.some(o => /H\+|H-\/|H-\+/.test(o.textContent)),
  (opts[0] ? opts[0].textContent.replace(/\s+/g, ' ') : ''));
opts[0].click();
await wait(400);
ok('choosing an institution stores its anabin status', /anabin H\+/.test(card.textContent),
  (card.textContent.match(/anabin H[+\-/]*/g) || [''])[0]);
ok('the ZAB question is answered from the status', /no ZAB statement needed|ZAB statement/i.test(card.textContent),
  (card.textContent.match(/[^.]*ZAB[^.]*\./) || [''])[0].slice(0, 110));
ok('a live anabin check button exists', [...card.querySelectorAll('button')].some(b => /Check live/i.test(b.textContent)));

setVal(byLabel('Semesters completed'), '2');
await wait(300);
ok('two semesters of a bachelor is 13 years', /13 years/.test(card.textContent),
  (card.textContent.match(/\d+(\.\d)? years/g) || []).slice(0, 4).join(', '));
ok('13 years opens the bachelor', /Bachelor: you can apply/.test(card.textContent),
  (card.textContent.match(/Bachelor: [a-z ]+/g) || [''])[0]);
ok('13 years still does not open a master', /Master: not yet/.test(card.textContent),
  (card.textContent.match(/Master: [a-z ]+/g) || [''])[0]);

/* finish the bachelor: 4 years, CGPA, field */
setVal(byLabel('Semesters completed'), '8');
await wait(200);
setVal(byLabel('CGPA'), '3.4');
await wait(100);
setVal(byLabel('Scale maximum'), '4');
await wait(100);
setVal(byLabel('Lowest passing grade'), '2');
await wait(150);
setVal(byLabel('Field of study'), 'computer_science');
await wait(200);
const doneYes = [...sel('#match-fields .path-edu').slice(-1)[0].querySelectorAll('.chip')].find(c => c.textContent.trim() === 'Yes');
if (doneYes) doneYes.click();
await wait(250);
ok('a completed four-year bachelor is 16 years', /16 years/.test(card.textContent),
  (card.textContent.match(/\d+(\.\d)? years/g) || []).slice(0, 4).join(', '));
ok('16 years opens the master', /Master: you can apply/.test(card.textContent),
  (card.textContent.match(/Master: [a-z ]+/g) || [''])[0]);
ok('the German-grade conversion is shown with its working', /Modified Bavarian Formula/.test(card.textContent) && /1 \+ 3 ×/.test(card.textContent),
  (card.textContent.match(/1 \+ 3 ×[^)]*\)[^.]*/) || [''])[0].slice(0, 50));

/* ------------------------------------------------------ step 4: the ECTS */
[...card.querySelectorAll('.path-step')][3].click();
await wait(300);
ok('ECTS is asked of a master applicant', !!byLabel('Total ECTS'), (card.textContent.match(/Total ECTS[^.]{0,40}/) || [''])[0]);
setVal(byLabel('Total ECTS'), '180');
await wait(100);
setVal(byLabel('ECTS in computer science'), '90');
await wait(100);
setVal(byLabel('ECTS in mathematics'), '30');
await wait(150);
[...card.querySelectorAll('.path-step')][0].click();
await wait(200);
chipIn(card, 'Bachelor').click();
await wait(300);
[...card.querySelectorAll('.path-step')][3].click();
await wait(300);
ok('ECTS is skipped for a bachelor applicant', /not asked for a bachelor/i.test(card.textContent),
  (card.textContent.match(/ECTS[^.]{0,80}\./) || [''])[0]);
[...card.querySelectorAll('.path-step')][0].click();
await wait(200);
chipIn(card, 'Master').click();
await wait(250);

/* ----------------------------------------------------- step 5: the tests */
[...card.querySelectorAll('.path-step')][4].click();
await wait(300);
ok('tests: GRE sections are separate and never a total',
  !!byLabel('Quantitative') && !!byLabel('Verbal') && !!byLabel('Analytical writing') && !/GRE total/i.test(card.textContent));
ok('tests: GMAT, SAT, ACT, TestAS and GATE are all offered',
  ['GMAT total', 'SAT total', 'ACT composite', 'TestAS score', 'GATE score'].every(l => !!byLabel(l)),
  ['GMAT total', 'SAT total', 'ACT composite', 'TestAS score', 'GATE score'].map(l => (byLabel(l) ? 'y' : 'n')).join(''));
setVal(byLabel('Quantitative'), '165');
await wait(100);
setVal(byLabel('Verbal'), '155');
await wait(100);
setVal(byLabel('Analytical writing'), '4.5');
await wait(150);

/* ----------------------------------------------------- step 6: the money */
[...card.querySelectorAll('.path-step')][5].click();
await wait(300);
setVal(byLabel('Max tuition per semester'), '0');
await wait(100);
setVal(byLabel('Max semester contribution'), '400');
await wait(100);
[...card.querySelectorAll('.path-fields .chip')].find(c => /I can self-fund/i.test(c.textContent))?.click();
await wait(200);

/* ---------------------------------------------------------------- saving */
const saveBtn = byText('button', 'Save matching details');
ok('there is one save button for the matching fields', !!saveBtn);
saveBtn.click();
await wait(1800);

const stored = await (await realFetch(API + '/api/path/profile', { headers: { cookie } })).json();
const entries = (stored.profile.education || {}).entries || [];
ok('the education records are stored on the server',
  entries.length === 2 && entries.some(e => e.level === 'bachelor' && e.semestersDone === 8),
  entries.map(e => e.level + ':' + (e.semestersDone ?? '-')).join(', '));
ok('the anabin status is stored with the institution',
  entries.some(e => e.level === 'bachelor' && e.anabinStatus === 'H+'),
  entries.map(e => e.level + ':' + (e.anabinStatus || '-')).join(', '));
ok('the German grade is converted server-side', stored.profile.academics.gpaGerman === 1.9,
  String(stored.profile.academics.gpaGerman));
ok('completeness is reported per step, six of them',
  Object.keys(stored.completeness.steps).length === 6 && stored.completeness.pct > 60,
  stored.completeness.pct + '% ' + JSON.stringify(stored.completeness.steps));

/* ------------------------------------------- verdicts on the programme list */
mount('/programs');
await wait(2200);
ok('the programme list shows how many you can apply to', /you can apply to/i.test(text()),
  (text().match(/\d+ you can apply to[^·]*/) || [''])[0]);
const badges = sel('.path-badge');
ok('every programme card carries a verdict badge', badges.length >= 4, badges.length + ' badges: ' +
  [...new Set(badges.map(b => b.textContent.trim()))].join(', '));
ok('badges use the three honest verdicts only',
  badges.every(b => /Eligible|Check yourself|Not eligible/.test(b.textContent)));

mount('/scholarships');
await wait(2000);
ok('scholarship cards carry verdict badges too', sel('.path-badge').length >= 3,
  sel('.path-badge').length + ' badges');

/* the programme page explains the verdict in full */
mount('/programs');
await wait(1800);
const firstLink = sel('.cards-2 h2 a')[0];
const href = firstLink.getAttribute('href');
mount(href);
await wait(2000);
const panel = document.querySelector('.path-panel');
ok('the programme page carries an eligibility panel', !!panel, (panel && panel.textContent || '').slice(0, 0));
ok('the panel names the verdict', !!panel && /Eligible|Check yourself|Not eligible/.test(panel.textContent));
ok('the panel prints reasons', sel('.path-reason').length > 0, (sel('.path-reason')[0] || {}).textContent || '');
ok('the panel says screening is not admission', !!panel && /not an offer of admission/i.test(panel.textContent));

/* ------------------------- the admin writes the requirements on the listing */
const adminLogin = await realFetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'admin@example.com', password: 'demo1234' })
});
const adminCookie = (adminLogin.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).find(c => c.startsWith('sf_session='));
/* the DOM keeps the student session until we swap it, so the admin page needs it */
cookie = adminCookie;
mount('/admin/listings/P3');
await wait(1800);
const adminForm = document.querySelector('#match-requirements');
ok('the admin listing form carries the matching requirements section', !!adminForm);
ok('the admin form asks for the 13 hard fields',
  ['m-level', 'm-acceptedFields', 'm-minGpa', 'm-bachelorEcts', 'm-subjectEcts', 'm-ielts', 'm-toefl', 'm-pte',
    'm-englishOther', 'm-germanLevel', 'm-abitur', 'm-intake', 'm-semesterFee']
    .every(id => !!document.getElementById(id)),
  ['m-level', 'm-minGpa', 'm-ielts', 'm-abitur'].map(id => (document.getElementById(id) ? 'y' : 'n')).join(''));
ok('the admin form asks for the test gates separately (GRE sections, GMAT, TestAS, SAT, ACT)',
  ['m-gre-quant', 'm-gre-verbal', 'm-gre-aw', 'm-gmat', 'm-testas', 'm-sat', 'm-act'].every(id => !!document.getElementById(id)));

/* an admin edit changes the verdict a student sees.
   The original values are captured first, so the suite leaves the seed exactly
   as it found it (other suites assert on P4's deadline). */
const before = await (await realFetch(API + '/api/admin/listings/P4', { headers: { cookie: adminCookie } })).json();
const original = { match: before.listing.match ?? null, intakes: before.listing.intakes ?? null,
  semesterFee: before.listing.semesterFee ?? null, deadline: before.listing.deadline ?? null };
const put = await realFetch(API + '/api/admin/listings/P4', {
  method: 'PUT', headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ match: { level: 'master', teachingLanguages: ['english'], acceptedFields: ['computer_science'],
    minGpaGerman: 2.5, ieltsReq: 6.5, bachelorEctsRequired: 180,
    otherRequirements: { gre: { quant: 150, aw: 3.5 } }, intake: ['winter_2029'] },
    intakes: ['WS'], semesterFee: 150, deadline: '2029-01-15' })
});
ok('an admin can save requirements on a live listing', put.status === 200);
/* the student's own profile is what decides this, so ask as the student */
await login('ayesha@example.com');
const studentCookie = cookie;
const after = await (await realFetch(API + '/api/path/verdicts?kind=program', { headers: { cookie: studentCookie } })).json();
ok('the student verdict for that listing then comes from the admin row',
  after.byListing.P4.verified === true && after.byListing.P4.verdict !== 'check_manually',
  after.byListing.P4.verdict + ' — ' + after.byListing.P4.headline);
ok('the GRE gate the admin added is enforced',
  after.byListing.P4.reasons.some(r => r.check === 'GRE' && r.status === 'pass'),
  after.byListing.P4.reasons.map(r => r.check + ':' + r.status).join(', '));

/* restore exactly what was there before */
await realFetch(API + '/api/admin/listings/P4', {
  method: 'PUT', headers: { cookie: adminCookie, 'content-type': 'application/json' },
  body: JSON.stringify(original)
});

/* ------------------------------------- an empty profile is never "Eligible" */
await realFetch(API + '/api/path/profile', {
  method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify({ profile: { target: { level: null }, language: { ielts: null, toefl: null, pte: null },
    education: { entries: [] }, academics: { gpaOriginal: null, bachelorEcts: null } } })
});
mount('/programs');
await wait(2200);
ok('with an empty profile nothing is marked Eligible',
  sel('.path-badge').length > 0 && !sel('.path-badge').some(b => /^Eligible$/.test(b.textContent.trim())),
  [...new Set(sel('.path-badge').map(b => b.textContent.trim()))].join(', '));

console.log('\n' + results.filter(r => r.pass).length + '/' + results.length + ' page checks passed');
process.exit(results.every(r => r.pass) ? 0 : 1);
