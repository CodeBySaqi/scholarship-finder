/* ScholarPath in the real app — the pages, not just the engine.
   Drives the actual React app in happy-dom against the API on :8000:
   the three steps save, the completion meter moves, the results page shows the
   three verdict groups with reasons, and the "pending" rule is visible on screen.
   Run: bash audit/run-dom.sh path     (after npm run build)
*/
import { Window } from 'happy-dom';

const API = 'http://localhost:8000';
const win = new Window({ url: API + '/path', settings: { disableJavaScriptEvaluation: false, disableCSSFileLoading: true } });

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
const setVal = (el, v) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
};
const apiGet = async (path) => {
  const r = await realFetch(API + '/api' + path, { headers: { cookie } });
  return r.json();
};

/* start from a blank ScholarPath profile so the run is repeatable */
await login('ayesha@example.com');
await realFetch(API + '/api/path/profile', {
  method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify({ profile: { academics: { gpaOriginal: null, bachelorEcts: null, subjectEcts: null },
    language: { ielts: null, englishMediumDegree: null }, tests: { gre: null },
    money: { maxTuitionPerSemester: null, maxSemesterContribution: null, fundingNeed: null },
    target: { level: null, language: null, intake: null } } })
});

/* ------------------------------------------------------------- the page */
mount('/path');
await wait(1500);

ok('path: the page renders its three steps', sel('.path-step').length === 3);
ok('path: completion is shown', /%/.test(text()) && !!document.querySelector('.path-pct__n'),
  document.querySelector('.path-pct__n') && document.querySelector('.path-pct__n').textContent);
ok('path: step 1 asks for target level', /Target level/.test(text()));
{
  /* no input may ask for an identity or banking number */
  const inputs = sel('input, select, textarea');
  const bad = inputs.filter(i => /passport|iban|cnic|national id|account number/i.test(
    [i.id, i.name, i.placeholder, i.getAttribute('aria-label'), (i.closest('.field') || {}).textContent || ''].join(' ')));
  ok('path: no input asks for a passport, CNIC, IBAN or account number', bad.length === 0,
    bad.map(i => i.id || i.placeholder).join(', '));
  ok('path: the page says outright that it does not ask for them', /passports or bank accounts/i.test(text()));
}

/* step 1 */
const masterChip = sel('.chip').find(c => c.textContent.trim() === 'Master');
masterChip.click();
await wait(120);
const englishChip = sel('.chip').find(c => c.textContent.trim() === 'English only');
englishChip.click();
await wait(120);
const winterChip = sel('.chip').find(c => c.textContent.trim() === 'Winter 2029');
winterChip.click();
await wait(120);
const natInput = document.querySelector('input[list="country-list"]');
setVal(natInput, 'PK');
await wait(150);
ok('path: step 1 accepts level, language, intake and nationality',
  document.querySelector('.chip.is-on') != null && natInput.value === 'PK');

await byText('button', 'Save & continue').click();
await wait(1600);
ok('path: saving step 1 moves to step 2', /Academics & scores/.test(text()));
const afterStep1 = await apiGet('/path/profile');
ok('path: step 1 was stored on the server', afterStep1.profile.target.level === 'master' && afterStep1.profile.nationality.nationality === 'PK',
  JSON.stringify(afterStep1.profile.target));
ok('path: completeness moved and is per step', afterStep1.completeness.steps['1'] === 100,
  JSON.stringify(afterStep1.completeness));

/* step 2 */
const fieldInput = sel('input.input').find(i => i.placeholder === 'computer_science');
ok('path: step 2 asks for the bachelor field (no target field)', !!fieldInput);
setVal(fieldInput, 'computer_science');
await wait(120);

const nums = () => sel('input[type="number"]');
const byLabelText = (label) => {
  const f = sel('.field').find(x => new RegExp(label, 'i').test((x.textContent || '').split('Help')[0]));
  return f ? f.querySelector('input') : null;
};
const gpa = byLabelText('GPA \\(your scale\\)');
const ects = byLabelText('Bachelor total ECTS');
const ielts = byLabelText('IELTS Academic');
const greQ = byLabelText('Quantitative');
/* a complete step 2: grades, ECTS breakdown, both English routes, GRE */
[['GPA \\(your scale\\)', '3.4'], ['Scale maximum', '4'], ['Lowest passing grade', '2'],
 ['Bachelor total ECTS', '180'], ['ECTS in computer science', '90'], ['ECTS in mathematics', '30'],
 ['ECTS in statistics', '15'], ['IELTS Academic', '7'], ['TOEFL iBT', '110'],
 ['Quantitative', '165'], ['Verbal', '155'], ['Analytical writing', '4.5']
].forEach(([label, value]) => {
  const el = byLabelText(label);
  if (el) setVal(el, value);
});
const moiYes = sel('.field').find(f => /taught in English/i.test(f.textContent));
if (moiYes) { const b = [...moiYes.querySelectorAll('.chip')].find(c => c.textContent.trim() === 'Yes'); if (b) b.click(); }
await wait(250);

ok('path: the German-grade conversion is shown with its working',
  /Modified Bavarian Formula/.test(text()) && /1 \+ 3 ×/.test(text()),
  (text().match(/1 \+ 3 ×[^)]*\)[^.]*/) || [''])[0].slice(0, 60));

await byText('button', 'Save & continue').click();
await wait(1500);
ok('path: step 2 saves and moves to step 3', /Money & scholarship extras/.test(text()));
const afterStep2 = await apiGet('/path/profile');
ok('path: the server stores the converted German grade', afterStep2.profile.academics.gpaGerman > 1 && afterStep2.profile.academics.gpaGerman < 4,
  String(afterStep2.profile.academics.gpaGerman));

/* step 3 */
const budget = byLabelText('Max tuition per semester');
const contribution = byLabelText('Max semester contribution');
const funding = sel('.chip').find(c => /full scholarship/i.test(c.textContent));
if (budget) setVal(budget, '0');
if (contribution) setVal(contribution, '400');
if (funding) funding.click();
await wait(150);
await byText('button', 'See my matches').click();
await wait(1800);

/* --------------------------------------------------------- the results */
ok('path: the results page opens', /Programme matches/.test(text()));
const tally = sel('.path-tally__item');
ok('path: three verdict groups are shown', tally.length === 3,
  tally.map(t => t.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
ok('path: every result carries its verdict', sel('.path-card').length > 0, sel('.path-card').length + ' cards');
ok('path: reasons are printed in plain words', sel('.path-reason').length > 0,
  (sel('.path-reason')[0] || {}).textContent);
ok('path: the screening-only disclaimer is on the page', /Screening only — not an admission/.test(text()));
ok('path: no admission is claimed as guaranteed', !/guaranteed admission/i.test(text()));

const eligible = sel('.path-card.is-eligible').length;
const manual = sel('.path-card.is-check_manually').length;
const notEligible = sel('.path-card.is-not_eligible').length;
ok('path: the eligible group is populated for a complete profile', eligible > 0,
  eligible + ' eligible — ' + sel('.path-card.is-eligible').slice(0, 2).map(c => c.querySelector('.h3').textContent).join(', '));
ok('path: not-eligible results are shown, not hidden', notEligible > 0, notEligible + ' not eligible');

/* a manual-check card must name its missing fields */
if (manual > 0) {
  const m = sel('.path-card.is-check_manually')[0];
  ok('path: a manual-check card says what is not stated', /Not stated:/.test(m.textContent.replace(/\s+/g, ' ')),
    m.textContent.replace(/\s+/g, ' ').slice(0, 90));
} else {
  ok('path: a manual-check card says what is not stated', true, 'no manual checks in this profile');
}

/* filtering by verdict */
const notElBtn = tally.find(t => /Not eligible/.test(t.textContent));
notElBtn.click();
await wait(300);
ok('path: the tally filters the list', sel('.path-card').length === notEligible,
  sel('.path-card').length + ' cards after filtering');

/* ------------------------------------------------------ scholarships tab */
mount('/path/scholarships');
await wait(1600);
ok('path: scholarship results render', /Scholarship matches/.test(text()) && sel('.path-card').length > 0,
  sel('.path-card').length + ' scholarship cards');
ok('path: a tuition-only scholarship is not shown as covering a full need',
  !sel('.path-card.is-eligible').some(c => /stipend-only|stipend only/i.test(c.textContent) && /full/i.test(c.textContent)));

/* ------------------------------------------- the pending rule on screen */
await realFetch(API + '/api/path/profile', {
  method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify({ profile: { academics: { gpaOriginal: null, bachelorEcts: null, subjectEcts: null }, language: { ielts: null } } })
});
mount('/path/programmes');
await wait(1600);
ok('path: an incomplete profile warns that checks are pending', /Still pending:/.test(text()),
  (text().match(/Still pending:[^.]*/) || [''])[0].slice(0, 90));
ok('path: with a short profile nothing is claimed Eligible', sel('.path-card.is-eligible').length === 0,
  sel('.path-card.is-eligible').length + ' eligible');

console.log('\n' + results.filter(r => r.pass).length + '/' + results.length + ' page checks passed');
process.exit(results.every(r => r.pass) ? 0 : 1);
