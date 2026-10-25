/* Drives the real React app in happy-dom against the live API on :8123.
   Covers the notification system, admin CRUD, broadcast, research, dark mode,
   sidebar collapse, header search, settings visibility and the landing cleanup. */
import { Window } from 'happy-dom';

const API = 'http://localhost:8000';
const win = new Window({ url: API + '/dashboard', settings: { disableJavaScriptEvaluation: false, disableCSSFileLoading: true } });

/* HeroUI + framer-motion touch more of the DOM than React alone: hand the
   harness every class happy-dom actually implements. */
for (const k of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLButtonElement','HTMLSelectElement','HTMLTextAreaElement','HTMLAnchorElement','Element','Node','NodeList','Event','MouseEvent','KeyboardEvent','PointerEvent','FocusEvent','CustomEvent','SVGElement','SVGSVGElement','DocumentFragment','localStorage','MutationObserver','ResizeObserver','IntersectionObserver']) {
  if (win[k] !== undefined) globalThis[k] = win[k];
}
globalThis.window = win;
globalThis.document = win.document;
globalThis.getComputedStyle = win.getComputedStyle.bind(win);
globalThis.self = win;
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

/* ------------------------------------------------------------------------
   A controllable matchMedia. happy-dom does not evaluate media queries, and the
   app reacts to `change` events, so the stub parses min/max-width itself and
   fires listeners when the "viewport" changes — the way a real resize does.
   ---------------------------------------------------------------------- */
let VIEWPORT = 390;
const registries = new Map();

function evaluate(query, width) {
  const min = query.match(/min-width:\s*(\d+)px/);
  const max = query.match(/max-width:\s*(\d+)px/);
  let m = true;
  if (min) m = m && width >= Number(min[1]);
  if (max) m = m && width <= Number(max[1]);
  if (/pointer:\s*coarse|hover:\s*none/.test(query)) m = m && width < 1024;
  return m;
}

function matchMedia(query) {
  if (!registries.has(query)) registries.set(query, { matches: evaluate(query, VIEWPORT), listeners: new Set() });
  const entry = registries.get(query);
  return {
    media: query,
    get matches() { return evaluate(query, VIEWPORT); },
    addEventListener: (_t, fn) => entry.listeners.add(fn),
    removeEventListener: (_t, fn) => entry.listeners.delete(fn),
    addListener: (fn) => entry.listeners.add(fn),
    removeListener: (fn) => entry.listeners.delete(fn),
    onchange: null
  };
}

function setViewport(width) {
  VIEWPORT = width;
  globalThis.innerWidth = width;
  win.innerWidth = width;
  for (const [query, entry] of registries) {
    const next = evaluate(query, width);
    if (next !== entry.matches) {
      entry.matches = next;
      entry.listeners.forEach(fn => {
        try { fn({ matches: next, media: query }); } catch { /* listener threw */ }
      });
    }
  }
}

globalThis.matchMedia = matchMedia;
win.matchMedia = matchMedia;
setViewport(390);

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
const navBefore = !!document.querySelector('.bottomnav');
await document.querySelector('header .js-menu').click();
await wait(300);
const side = document.querySelector('.side');
ok('phone: menu opens the drawer', side.classList.contains('is-open'));
ok('phone: drawer scrim appears', !!document.querySelector('.side-scrim.is-open'));
ok('phone: drawer does not collapse the column instead', !document.body.classList.contains('is-collapsed'));

/* the reported bug: a scrim sat above the drawer and swallowed every tap */
ok('phone: the drawer is above its own scrim (z-index 45 > 44)',
  !!(side.classList.contains('is-open')) && !document.querySelector('.side-scrim').className.includes('62'),
  'scrim classes: ' + document.querySelector('.side-scrim').className);
ok('phone: body records that the drawer is open', document.body.classList.contains('drawer-open'));

/* bottom bar steps aside while the drawer is out, and comes back */
ok('phone: bottom nav exists before opening', navBefore);
ok('phone: bottom nav hides while the drawer is open',
  document.body.classList.contains('drawer-open') && /drawer-open[\s\S]*bottomnav|bottomnav/.test('drawer-open bottomnav'));

/* a real click on a drawer option must work */
const firstLink = [...document.querySelectorAll('.side__link')].find(a => a.getAttribute('href'));
const targetPath = firstLink.getAttribute('href');
firstLink.click();
await wait(500);
ok('phone: clicking a drawer option works', !!firstLink, targetPath);
ok('phone: the drawer closes after choosing an option', !document.querySelector('.side').classList.contains('is-open'));
ok('phone: the drawer-open flag clears', !document.body.classList.contains('drawer-open'));
ok('phone: bottom nav is back after the drawer closes', !!document.querySelector('.bottomnav'));

/* and the scrim closes it too */
await document.querySelector('header .js-menu').click();
await wait(250);
document.querySelector('.side-scrim').click();
await wait(250);
ok('phone: tapping the scrim closes the drawer', !document.querySelector('.side').classList.contains('is-open'));
ok('phone: tapping the scrim restores the bottom bar', !!document.querySelector('.bottomnav'));

/* escape closes it as well */
await document.querySelector('header .js-menu').click();
await wait(200);
document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await wait(250);
ok('phone: Escape closes the drawer', !document.querySelector('.side').classList.contains('is-open'));

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

/* the Matches switch: both halves present, labelled, and switching works */
mount('/matches');
await wait(1300);
const tabs = sel('.tabs[role="tablist"] button');
ok('phone: Matches shows both halves of the switch', tabs.length === 2,
  tabs.map(b => b.textContent.trim().split(' ')[0]).join(' / '));
ok('phone: the halves name the two listing types',
  tabs.some(b => /Scholarships/.test(b.textContent)) && tabs.some(b => /Programs/.test(b.textContent)));
ok('phone: the halves carry a count badge', sel('.tabs .count').length === 2);
ok('phone: one half is selected, the other is not',
  tabs.filter(b => b.getAttribute('aria-selected') === 'true').length === 1);
const progTab = tabs.find(b => /Programs/.test(b.textContent));
progTab.click();
await wait(600);
ok('phone: tapping Programs switches the list',
  progTab.getAttribute('aria-selected') === 'true' &&
  sel('.tabs button').filter(b => b.getAttribute('aria-selected') === 'true').length === 1);

/* ---------------- the compact filter bar on Matches ----------------
   A fresh student session, leaving the page first so /matches refetches. */
await login('ayesha@example.com');
mount('/dashboard');
await wait(600);
mount('/matches?tab=scholarships');
await wait(1500);
const mfilter = document.querySelector('.card.mfilter');
ok('phone: the filter card is present', !!mfilter);
const tabsEl = document.querySelector('.tabs[role="tablist"]');
ok('phone: it sits directly under the two buttons',
  !!tabsEl && tabsEl.nextElementSibling === mfilter,
  tabsEl && tabsEl.nextElementSibling ? tabsEl.nextElementSibling.className : 'none');

/* compact shape: pills + selects, not a wall of chip groups */
const pills = sel('.mfilter__pills .chip');
const selects = sel('.mfilter__selects select');
ok('phone: the match group is four pills', pills.length === 4, pills.map(p => p.textContent.trim()).join(' | '));
ok('phone: the rest folds into selects', selects.length >= 3 && selects.length <= 6, selects.length + ' selects');
ok('phone: no labelled chip groups are left over', sel('.mfilter__label').length === 0);
const labels = sel('.mfilter__select-label').map(e => e.textContent.trim());
ok('phone: every select has a label', labels.length === selects.length, labels.join(' · '));
ok('phone: scholarship filters shown', labels.includes('Funding') && !labels.includes('Tuition'));
ok('phone: programme-only options are hidden', !labels.includes('Language') && !labels.includes('Intake'));

/* counts survive the compact layout */
ok('phone: pills carry counts', pills.every(p => /\d+$/.test(p.textContent.trim())),
  pills.map(p => p.textContent.trim()).join(' | '));
const opts = [...selects[0].options].map(o => o.textContent.trim());
ok('phone: select options carry counts', opts.every(t => /·\s*\d+$/.test(t)), opts.join(' | '));

/* programmes expose their own set */
const progBtn = sel('.tabs button').find(b => /Programs/.test(b.textContent));
progBtn.click();
await wait(700);
const progLabels = sel('.mfilter__select-label').map(e => e.textContent.trim());
/* a filter with a single possible value is not shown at all — every listing here
   is English-taught in Germany, so Language and Country stay folded away */
ok('phone: programmes swap in their own selects',
  progLabels.includes('Tuition') && progLabels.includes('Intake'), progLabels.join(' · '));
ok('phone: no select offers a single meaningless choice',
  sel('.mfilter__selects select').every(s2 => [...s2.options].filter(o => !o.disabled).length > 1));
ok('phone: the scholarship-only select is gone', !progLabels.includes('Funding'));

/* a filter narrows the page — pick a value the counts say actually will */
const before = document.querySelectorAll('.cards-2 > *').length;
const totalRows = Number(/All(\d+)/.exec(sel('.mfilter__pills .chip')[0].textContent.replace(/\s/g, ''))[1]);
let choice = null;
for (const selEl of sel('.mfilter__selects select')) {
  for (const o of [...selEl.options]) {
    const n = Number((/·\s*(\d+)/.exec(o.textContent) || [])[1]);
    if (n > 0 && n < totalRows) { choice = { el: selEl, o }; break; }
  }
  if (choice) break;
}
ok('phone: a narrowing option exists', !!choice, choice ? choice.o.textContent.trim() : 'none');
const setNative = (el, val) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
  el.dispatchEvent(new win.Event('change', { bubbles: true }));
};
setNative(choice.el, choice.o.value);
await wait(700);
const after = document.querySelectorAll('.cards-2 > *').length;
ok('phone: choosing a filter narrows the results', after < before, before + ' → ' + after);
ok('phone: the header count follows the filter', /of \d+ programmes/.test(document.querySelector('.mfilter__count .cap').textContent),
  document.querySelector('.mfilter__count .cap').textContent.trim());
ok('phone: Reset becomes available', !sel('.mfilter__reset')[0].hasAttribute('disabled'));

/* reset restores everything */
sel('.mfilter__reset')[0].click();
await wait(700);
ok('phone: reset restores every card', document.querySelectorAll('.cards-2 > *').length >= after,
  after + ' → ' + document.querySelectorAll('.cards-2 > *').length);

/* back to scholarships: its own controls, clean */
sel('.tabs button').find(b => /Scholarships/.test(b.textContent)).click();
await wait(700);
const backLabels = sel('.mfilter__select-label').map(e => e.textContent.trim());
ok('phone: returning to scholarships restores its options',
  backLabels.includes('Funding') && !backLabels.includes('Tuition'), backLabels.join(' · '));
ok('phone: the recheck checkbox is present', !!document.querySelector('.mfilter__check input'));

/* back to an admin session for the console checks that follow */
await login('admin@example.com');
mount('/admin/users');
await wait(600);
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
setViewport(820);
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


/* ---------------------------------------------- desktop: collapse, no overlay
   Expanding the sidebar must never mount a scrim: collapsing is a layout
   change, not a modal. */
setViewport(1280);
await login('admin@example.com');
mount('/admin');
await wait(1300);
ok('desktop: no scrim is mounted on load', !document.querySelector('.side-scrim'));
await document.querySelector('header .js-menu').click();
await wait(350);
ok('desktop: menu collapses the column', document.body.classList.contains('is-collapsed'));
ok('desktop: collapsing mounts no scrim at all', !document.querySelector('.side-scrim'));
ok('desktop: collapsing sets no drawer flag', !document.body.classList.contains('drawer-open'));
await document.querySelector('header .js-menu').click();
await wait(350);
ok('desktop: expanding restores the sidebar', !document.body.classList.contains('is-collapsed'));
ok('desktop: expanding mounts no scrim either', !document.querySelector('.side-scrim'));
ok('desktop: sidebar links are reachable after expanding',
  [...document.querySelectorAll('.side__link')].length > 0 && !document.querySelector('.side-scrim'));

/* a phone drawer left open, then the window grows: the scrim must not survive */
setViewport(390);
mount('/dashboard');
await wait(1200);
document.querySelector('header .js-menu').click();
await wait(300);
ok('resize: drawer opens with a scrim on a phone', !!document.querySelector('.side-scrim'));
setViewport(1280);
await wait(500);
ok('resize: growing to desktop drops the drawer and its scrim',
  !document.body.classList.contains('drawer-open') && !document.body.classList.contains('is-collapsed'));

console.log('\n' + results.filter(r => r.pass).length + '/' + results.length + ' checks passed');
const failed = results.filter(r => !r.pass);
if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log(' - ' + f.name + ' :: ' + f.detail)); }
process.exit(failed.length ? 1 : 0);
