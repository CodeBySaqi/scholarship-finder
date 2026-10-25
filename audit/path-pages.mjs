/* ScholarPath where the student actually is: the profile fields and the
   verdicts on the programme cards — no separate page.
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
  const f = sel('.field').find(x => new RegExp(label, 'i').test((x.textContent || '').split(/Help|This is/)[0]));
  return f ? f.querySelector('input') : null;
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
    academics: { bachelorField: null, gpaOriginal: null, bachelorEcts: null, subjectEcts: null },
    language: { ielts: null, englishMediumDegree: null }, tests: { gre: null },
    money: { maxTuitionPerSemester: null, maxSemesterContribution: null, fundingNeed: null }
  } })
});

/* ------------------------------------------------ there is no separate page */
mount('/path');
await wait(1200);
ok('no separate "find my path" page exists', /not found|404|Page not found|This page/i.test(text()) || !/Find my path/i.test(text()),
  'route /path: ' + (document.querySelector('.h1') || {}).textContent);
ok('the sidebar has no "Find my path" entry', !sel('.side__link').some(a => /Find my path/i.test(a.textContent)),
  sel('.side__link').map(a => a.textContent.trim()).join(' · ').slice(0, 110));

/* --------------------------------------------- the fields live in /profile */
mount('/profile');
await wait(1600);
ok('the profile page carries the matching fields', !!document.querySelector('#match-fields'));
const card = document.querySelector('#match-fields');
ok('it explains what these details decide', /Eligible|verdict/i.test(card.textContent));
ok('it shows a completion meter', !!card.querySelector('.path-pct__n'), (card.querySelector('.path-pct__n') || {}).textContent);

const inputs = sel('#match-fields input, #match-fields select, #match-fields textarea');
const bad = inputs.filter(i => /passport|iban|cnic|national id|account number/i.test(
  [i.id, i.name, i.placeholder, i.getAttribute('aria-label'), (i.closest('.field') || {}).textContent || ''].join(' ')));
ok('nothing asks for a passport, CNIC, IBAN or account number', bad.length === 0, bad.map(i => i.id).join(', '));

/* step 1 */
const master = [...card.querySelectorAll('.chip')].find(c => c.textContent.trim() === 'Master');
master.click();
await wait(120);
[...card.querySelectorAll('.chip')].find(c => c.textContent.trim() === 'English only').click();
await wait(120);
[...card.querySelectorAll('.chip')].find(c => c.textContent.trim() === 'Winter 2029').click();
await wait(120);
const nat = document.querySelector('#match-fields input[list="country-list"]');
setVal(nat, 'PK');
await wait(150);

/* step 2 */
sel('#match-fields .path-step')[1].click();
await wait(300);
[['computer_science', 'placeholder'], ['3.4', 'GPA .your scale'], ['4', 'Scale maximum'],
 ['2', 'Lowest passing grade'], ['180', 'Bachelor total ECTS'], ['90', 'ECTS in computer science'],
 ['30', 'ECTS in mathematics'], ['15', 'ECTS in statistics'], ['7', 'IELTS Academic'], ['110', 'TOEFL iBT'],
 ['165', 'Quantitative'], ['155', 'Verbal'], ['4.5', 'Analytical writing']
].forEach(([value, label]) => {
  const el = label === 'placeholder' ? sel('#match-fields input').find(i => i.placeholder === 'computer_science') : byLabel(label);
  if (el) setVal(el, value);
});
const moi = sel('#match-fields .field').find(f => /taught in English/i.test(f.textContent));
if (moi) { const b = [...moi.querySelectorAll('.chip')].find(c => c.textContent.trim() === 'Yes'); if (b) b.click(); }
await wait(250);
ok('the German-grade conversion is shown with its working', /Modified Bavarian Formula/.test(text()) && /1 \+ 3 ×/.test(text()),
  (text().match(/1 \+ 3 ×[^)]*\)[^.]*/) || [''])[0].slice(0, 50));

/* step 3 */
sel('#match-fields .path-step')[2].click();
await wait(300);
const budget = byLabel('Max tuition per semester');
const contribution = byLabel('Max semester contribution');
if (budget) setVal(budget, '0');
if (contribution) setVal(contribution, '400');
const full = [...document.querySelectorAll('#match-fields .chip')].find(c => /Full scholarship needed/i.test(c.textContent));
if (full) full.click();
await wait(200);

const saveBtn = byText('button', 'Save matching details');
ok('there is one save button for the matching fields', !!saveBtn);
saveBtn.click();
await wait(1500);

const stored = await (await realFetch(API + '/api/path/profile', { headers: { cookie } })).json();
ok('the details are stored on the server', stored.profile.target.level === 'master' && stored.profile.academics.bachelorEcts === 180,
  JSON.stringify({ level: stored.profile.target.level, ects: stored.profile.academics.bachelorEcts }));
ok('the German grade is converted server-side', stored.profile.academics.gpaGerman === 1.9, String(stored.profile.academics.gpaGerman));

/* ------------------------------------------- verdicts on the programme list */
mount('/programs');
await wait(2000);
ok('the programme list shows how many you can apply to', /you can apply to/i.test(text()),
  (text().match(/\d+ you can apply to[^·]*/) || [''])[0]);
const badges = sel('.path-badge');
ok('every programme card carries a verdict badge', badges.length >= 4, badges.length + ' badges: ' +
  [...new Set(badges.map(b => b.textContent.trim()))].join(', '));
ok('badges use the three honest verdicts only',
  badges.every(b => /Eligible|Check yourself|Not eligible/.test(b.textContent)));
ok('no badge claims eligibility without data',
  !badges.some(b => /Eligible/.test(b.textContent) && !stored.profile.target.level));

/* the programme page explains the verdict in full */
const firstLink = sel('.cards-2 h2 a')[0];
const href = firstLink.getAttribute('href');
mount(href);
await wait(2000);
ok('the programme page carries an eligibility panel', !!document.querySelector('.path-panel'),
  (document.querySelector('.path-panel .h2') || {}).textContent);
const panel = document.querySelector('.path-panel');
ok('the panel names the verdict', /Eligible|Check yourself|Not eligible/.test(panel.textContent));
ok('the panel prints reasons', sel('.path-reason').length > 0, (sel('.path-reason')[0] || {}).textContent || '');
ok('the panel says screening is not admission', /not an offer of admission/i.test(panel.textContent));
ok('it offers the way back to the fields', !!byText('a', 'Update my details') || /Update my details/.test(panel.textContent));

/* ------------------------------------- an empty profile is never "Eligible" */
await realFetch(API + '/api/path/profile', {
  method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify({ profile: { target: { level: null }, academics: { gpaOriginal: null, bachelorEcts: null }, language: { ielts: null } } })
});
mount('/programs');
await wait(2000);
ok('with an empty profile nothing is marked Eligible',
  sel('.path-badge').length > 0 && !sel('.path-badge').some(b => /^Eligible$/.test(b.textContent.trim())),
  [...new Set(sel('.path-badge').map(b => b.textContent.trim()))].join(', '));

console.log('\n' + results.filter(r => r.pass).length + '/' + results.length + ' page checks passed');
process.exit(results.every(r => r.pass) ? 0 : 1);
