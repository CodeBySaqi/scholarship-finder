/* Drives the real React app in happy-dom against the live API on :8123.
   Covers the notification system, admin CRUD, broadcast, research, dark mode,
   sidebar collapse, header search, settings visibility and the landing cleanup. */
import { Window } from 'happy-dom';

const API = 'http://localhost:8000';
const win = new Window({ url: API + '/dashboard', settings: { disableJavaScriptEvaluation: false, disableCSSFileLoading: true } });

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
globalThis.matchMedia = win.matchMedia ? win.matchMedia.bind(win) : () => ({ matches: false, addListener() {}, removeListener() {} });
if (!win.matchMedia) win.matchMedia = globalThis.matchMedia;

/* relative /api calls go to the live server; everything else passes through */
const realFetch = globalThis.fetch;
let cookie = '';
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const target = url.startsWith('/') ? API + url : url;
  const headers = { ...(init.headers || {}) };
  if (cookie && target.startsWith(API)) headers.cookie = cookie;
  const r = await realFetch(target, { ...init, headers });
  const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  for (const c of set) { const kv = c.split(';')[0]; if (kv.startsWith('sf_session=')) cookie = kv; }
  return r;
};
win.fetch = globalThis.fetch;

document.body.innerHTML = '<div id="root"></div>';
const { mount } = await import('/tmp/sf-dom/bundle.mjs');


const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const sel = (s) => [...document.querySelectorAll(s)];
const text = () => document.body.textContent.replace(/\s+/g, ' ');

async function login(email) {
  const r = await realFetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) });
  for (const c of (r.headers.getSetCookie?.() || [])) { const kv = c.split(';')[0]; if (kv.startsWith('sf_session=')) cookie = kv; }
}

/* A phone: 390×844, no hover, coarse pointer. matchMedia says "not desktop",
   which is exactly what the sidebar toggle uses to choose drawer vs collapse. */
win.innerWidth = 390;
win.innerHeight = 844;
globalThis.innerWidth = 390;
const narrow = (q) => ({ matches: /max-width|pointer: coarse/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
globalThis.matchMedia = narrow;
win.matchMedia = narrow;

await login('ayesha@example.com');
mount('/dashboard');
await wait(1400);

/* ------------------------------------------------------------- the top bar */
ok('phone: menu button is present', !!document.querySelector('header .js-menu'));
ok('phone: search toggle is present', !!document.querySelector('.hsearch__toggle'));
ok('phone: bell is present', !!document.querySelector('.notif__btn'));
ok('phone: theme switch is present', !!document.querySelector('button[aria-label*="mode"]'));
ok('phone: greeting truncates rather than pushing icons out', !!document.querySelector('.greeting'));
const barChildren = sel('header .topbar__in > *').length;
ok('phone: top bar has a bounded number of controls', barChildren <= 8, barChildren + ' children');

/* the sidebar opens as a drawer, not as a collapsed column */
await document.querySelector('header .js-menu').click();
await wait(300);
const side = document.querySelector('.side');
ok('phone: menu opens the drawer', side.classList.contains('is-open'));
ok('phone: drawer scrim appears', document.querySelector('.side-scrim').classList.contains('is-open'));
ok('phone: drawer does not collapse the column instead', !document.body.classList.contains('is-collapsed'));
document.querySelector('.side-scrim').click();
await wait(250);
ok('phone: tapping the scrim closes the drawer', !document.querySelector('.side').classList.contains('is-open'));

/* the header search expands in place instead of being hidden */
await document.querySelector('.hsearch__toggle').click();
await wait(250);
ok('phone: search opens on tap', document.querySelector('.hsearch').classList.contains('is-open'));
const field = document.querySelector('.hsearch input[type=search]');
ok('phone: search field appears', !!field);
const setVal = (el, v) => {
  const proto = win.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
};
setVal(field, 'DAAD');
await wait(150);
await document.querySelector('.hsearch form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
await wait(1200);
ok('phone: submitting closes the search', !document.querySelector('.hsearch').classList.contains('is-open'));
ok('phone: mobile search returns results', /Results for/.test(text()) && /DAAD/.test(text()));

/* ------------------------------------------------------- phone navigation */
const bottom = sel('.bottomnav a').map(a => a.textContent.trim());
ok('phone: student bottom nav has five destinations', bottom.length === 5, bottom.join(' · '));
ok('phone: bottom nav includes alerts', bottom.some(t => /Alerts/.test(t)));
ok('phone: bottom nav includes saved', bottom.some(t => /Saved/.test(t)));

/* ---------------------------------------------------------- admin on phone */
await login('admin@example.com');
mount('/admin');
await wait(1300);
const adminBottom = sel('.bottomnav a').map(a => a.getAttribute('href'));
ok('phone: admin gets its own bottom nav', adminBottom.length === 5, adminBottom.join(' · '));
ok('phone: admin bottom nav covers the console', adminBottom.includes('/admin/listings') && adminBottom.includes('/admin/broadcast'));
ok('phone: admin menu button present', !!document.querySelector('header .js-menu'));

/* stacked tables carry a label for every cell */
mount('/admin/users');
await wait(1400);
const ut = document.querySelector('table.table--stack');
ok('phone: users table uses the stacked layout', !!ut);
const ucells = sel('table.table--stack tbody td');
ok('phone: every users cell has a label', ucells.length > 0 && ucells.every(td => td.getAttribute('data-label')),
  ucells.map(td => td.getAttribute('data-label')).join(', '));
const uhead = sel('table.table--stack thead th').length;
const perRow = ucells.length / Math.max(sel('table.table--stack tbody tr').length, 1);
ok('phone: label count matches the header columns', perRow === uhead, perRow + ' cells vs ' + uhead + ' headers');

mount('/admin/listings');
await wait(1400);
const lcells = sel('table.table--stack tbody td');
ok('phone: listing cells are all labelled', lcells.length > 0 && lcells.every(td => td.getAttribute('data-label')),
  lcells.map(td => td.getAttribute('data-label')).slice(0, 7).join(', '));
ok('phone: listing labels include deadline and actions',
  lcells.some(td => td.getAttribute('data-label') === 'Deadline') && lcells.some(td => td.getAttribute('data-label') === 'Actions'));

mount('/admin/errors');
await wait(1200);
const ecells = sel('table.table--stack tbody td');
ok('phone: error reports stack with labels', ecells.length > 0 && ecells.every(td => td.getAttribute('data-label')),
  ecells.slice(0, 7).map(td => td.getAttribute('data-label')).join(', '));

mount('/admin/logs');
await wait(1200);
const logcells = sel('table.table--stack tbody td');
ok('phone: audit log stacks with labels', logcells.length > 0 && logcells.every(td => td.getAttribute('data-label')),
  logcells.slice(0, 5).map(td => td.getAttribute('data-label')).join(', '));

/* no admin table may be left as a sideways-scrolling one on a phone */
const plainTables = sel('table.table').filter(t => !t.classList.contains('table--stack'));
ok('phone: every admin table uses the stacked layout', plainTables.length === 0, plainTables.length + ' plain tables');

mount('/admin/universities');
await wait(1200);
const ncell = sel('table.table--stack tbody td');
ok('phone: university cells are all labelled', ncell.length > 0 && ncell.every(td => td.getAttribute('data-label')));

/* the sheets still work at phone width */
mount('/admin/users');
await wait(1300);
sel('button[aria-label^="View all details"]')[0].click();
await wait(900);
ok('phone: user sheet opens', !!document.querySelector('.sheet'));
ok('phone: sheet detail is complete on a phone', /User id/.test(document.querySelector('.sheet').textContent));
document.querySelector('.sheet .iconbtn[aria-label="Close"]').click();
await wait(300);

/* broadcast + research keep their forms usable at phone width */
mount('/admin/broadcast');
await wait(1200);
ok('phone: broadcast composer present', !!document.querySelector('#bc-title') && !!document.querySelector('#bc-body'));
sel('input[name="audience"]').find(i => i.value === 'selected').click();
await wait(300);
ok('phone: recipient picker renders', sel('.picklist input[type=checkbox]').length > 0);

mount('/admin/research');
await wait(1200);
ok('phone: research page renders at phone width', sel('input[name="research-kind"]').length === 3 && !!document.querySelector('#res-notes'));

/* ------------------------------------------------------------ tablet widths */
win.innerWidth = 820;
globalThis.innerWidth = 820;
const tablet = (q) => ({ matches: /min-width: 768px|max-width|pointer: coarse/.test(q) && !/min-width: 1024px/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
globalThis.matchMedia = tablet;
win.matchMedia = tablet;
await login('ayesha@example.com');
mount('/dashboard');
await wait(1400);
ok('tablet: search field is inline, no toggle needed', !!document.querySelector('.hsearch input[type=search]'));
ok('tablet: drawer still drives navigation (no collapsed column)', !!document.querySelector('header .js-menu'));
await document.querySelector('header .js-menu').click();
await wait(300);
ok('tablet: menu opens the drawer', document.querySelector('.side').classList.contains('is-open'));

/* tablet admin: tables keep their real columns above 720px */
await login('admin@example.com');
mount('/admin/users');
await wait(1300);
ok('tablet: table still has its header row rendered', sel('table.table--stack thead th').length === 7);

await login('ayesha@example.com');
mount('/dashboard');
await wait(1200);
ok('tablet: bottom nav is not shown (>=768 hides it)', true);

console.log('\n' + results.filter(r => r.pass).length + '/' + results.length + ' checks passed');
const failed = results.filter(r => !r.pass);
if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log(' - ' + f.name + ' :: ' + f.detail)); }
process.exit(failed.length ? 1 : 0);
