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
const text = () => document.body.textContent.replace(/\s+/g, ' ');
const sel = (s) => [...document.querySelectorAll(s)];
const byText = (s, t) => sel(s).find(el => (el.textContent || '').includes(t));
const click = async (el, ms = 250) => { if (!el) throw new Error('element not found'); el.click(); await wait(ms); };
/* React tracks input values itself: set through the native setter so onChange fires */
const setVal = (el, v) => {
  const proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
};

async function login(email) {
  const r = await realFetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' })
  });
  const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  for (const c of set) { const kv = c.split(';')[0]; if (kv.startsWith('sf_session=')) cookie = kv; }
  return r.status;
}
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

/* ------------------------------------------------------------------ landing */
cookie = '';
await mount('/');
await wait(900);
ok('landing: "Every screen in this app" removed', !text().includes('Every screen in this app') && document.querySelector('#pages') === null);
ok('landing: footer description rewritten', /Pakistani students applying to Germany/.test(text()));
ok('landing: footer has no Admin console link', !sel('footer a').some(a => a.textContent.includes('Admin console')));
ok('landing: no demo panel markup', document.querySelector('.demo-panel') === null);
ok('landing: public header has no "All pages"', !sel('header a').some(a => a.textContent.includes('All pages')));
ok('landing: theme switch button present', sel('button[aria-label*="mode"]').length > 0);

/* --------------------------------------------------------------- as student */
await login('ayesha@example.com');
await mount('/notifications');
await wait(1200);
ok('student: notifications page renders', !!byText('.h1', 'Notifications'));
const rows = sel('.notif-row');
ok('student: seeded notifications listed', rows.length >= 3, rows.length + ' rows');
ok('student: unread rows marked', sel('.notif-row.is-unread').length > 0, sel('.notif-row.is-unread').length + ' unread');
const beforeUnread = (await api('/api/notifications')).body.unread;
/* the list is newest-first, so the top row may already be read — open an unread one */
const unreadRow = document.querySelector('.notif-row.is-unread') || rows[0];
await click(unreadRow, 700);
ok('student: clicking a row opens the detail sheet', !!document.querySelector('.sheet'));
const sheetLen = (document.querySelector('.sheet') || {}).textContent?.length || 0;
ok('student: detail shows the full body', sheetLen > 120, 'sheet chars: ' + sheetLen);
const afterUnread = (await api('/api/notifications')).body.unread;
ok('student: opening marked it read on the server', afterUnread === beforeUnread - 1, beforeUnread + ' → ' + afterUnread);
ok('student: bell badge reflects the count', !!document.querySelector('.notif__count') || afterUnread === 0, 'badge: ' + (document.querySelector('.notif__count') ? document.querySelector('.notif__count').textContent : 'none'));

const bellBtn = document.querySelector('.notif__btn');
await click(bellBtn, 400);
ok('student: bell opens the popup', !!document.querySelector('.notif__pop'));
ok('student: popup has a "See all notifications" link', /See all notifications/.test((document.querySelector('.notif__all') || {}).textContent || ''));
ok('student: popup links to /notifications', (document.querySelector('.notif__all') || {}).getAttribute?.('href') === '/notifications');
const markAll = byText('.notif__pop button', 'Mark all read');
if (markAll) { await click(markAll, 900); }
ok('student: mark all read clears the badge', (await api('/api/notifications')).body.unread === 0);

/* --------------------------------------------------------------- dark mode */
const themeBtn = sel('button[aria-label*="mode"]')[0];
await click(themeBtn, 200);
const t1 = document.documentElement.getAttribute('data-theme');
await click(sel('button[aria-label*="mode"]')[0], 200);
const t2 = document.documentElement.getAttribute('data-theme');
ok('dark mode: toggles between dark and light', t1 === 'dark' && t2 === 'light', t1 + ' → ' + t2);

/* ---------------------------------------------------------- sidebar collapse */
const menu = document.querySelector('header .js-menu');
ok('sidebar: collapse button exists in the top bar', !!menu);
win.innerWidth = 1280;
win.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
await click(menu, 300);
ok('sidebar: collapse sets the body class', document.body.classList.contains('is-collapsed'));
await click(document.querySelector('header .js-menu'), 300);
ok('sidebar: second click expands again', !document.body.classList.contains('is-collapsed'));

/* ---------------------------------------------------------- student settings */
await mount('/settings?tab=site');
await wait(900);
ok('student: no Site & AI tab', !sel('.tabs button').some(b => b.textContent.includes('Site & AI')));
ok('student: theme copy no longer mentions the demo panel', !text().includes('demo panel'));

/* ---------------------------------------------------------------- as admin */
await login('admin@example.com');
await mount('/admin/users');
await wait(1400);
ok('admin: users table loads', sel('table tbody tr').length >= 4, sel('table tbody tr').length + ' rows');
ok('admin: eye icon per row', sel('button[aria-label^="View all details"]').length >= 4);
ok('admin: edit / ban / delete icons', sel('button[aria-label^="Edit "]').length >= 4 &&
  sel('button[aria-label^="Ban "], button[aria-label^="Unban "]').length >= 3 &&
  sel('button[aria-label^="Delete "]').length >= 3);

await click(sel('button[aria-label^="View all details"]')[0], 900);
const detailText = (document.querySelector('.sheet') || {}).textContent || '';
ok('admin: user detail sheet opens', !!document.querySelector('.sheet'));
ok('admin: detail shows identity, profile, activity', /User id/.test(detailText) && /Notifications/.test(detailText) && /Saved listings/.test(detailText) && /CGPA/.test(detailText));
ok('admin: detail lists audit actions', /Recent actions/.test(detailText));
await click(document.querySelector('.sheet .iconbtn[aria-label="Close"]'), 300);

/* edit */
await click(sel('button[aria-label^="Edit "]')[0], 400);
const nameInput = document.querySelector('#eu-name');
ok('admin: edit form prefilled', !!nameInput && nameInput.value.length > 0, nameInput ? nameInput.value : '');
ok('admin: edit form exposes email/role/status', !!document.querySelector('#eu-email') && !!document.querySelector('#eu-role') &&
  !!byText('.switch-row', 'Account active'));
const newName = 'Renamed By Test';
setVal(nameInput, newName);
await wait(150);
await click(byText('.sheet button', 'Save changes'), 1200);
const usersApi = await api('/api/admin/users');
ok('admin: edit saved to the server', usersApi.body.users.some(u => u.displayName === newName), usersApi.body.users.map(u => u.displayName).join(', '));

/* ban / unban through the API contract the button uses */
const victim = usersApi.body.users.find(u => u.role === 'student');
await api('/api/admin/users/' + victim.id, { method: 'PUT', body: JSON.stringify({ isActive: false }) });
let banned = (await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: victim.email, password: 'demo1234' }) })).status;
ok('admin: banned user cannot sign in', banned === 401 || banned === 403, 'login ' + banned);
await api('/api/admin/users/' + victim.id, { method: 'PUT', body: JSON.stringify({ isActive: true }) });
ok('admin: unban restores sign-in', (await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: victim.email, password: 'demo1234' }) })).status === 200);
const notifForVictim = (await api('/api/notifications')).body;
ok('admin: status change notifies the account', notifForVictim.notifications.some(n => /Account updated/.test(n.title)));

/* the ban probe above signed in as the student and replaced the cookie: back to admin */
await login('admin@example.com');
await mount('/admin/listings');
await wait(1300);
ok('admin: listings table loads', sel('table tbody tr').length >= 10, sel('table tbody tr').length + ' rows :: ' + text().slice(0, 160));
ok('admin: listing eye icon', sel('button[aria-label^="View all details"]').length >= 10);
ok('admin: listing delete icon (admin only)', sel('button[aria-label^="Delete "]').length >= 10);
await click(sel('button[aria-label^="View all details"]')[0], 1000);
const lsheet = (document.querySelector('.sheet') || {}).textContent || '';
ok('admin: listing detail shows the full record', /Deadline/.test(lsheet) && /Official page/.test(lsheet) && /Created by/.test(lsheet) && lsheet.length > 400);
await click(document.querySelector('.sheet .iconbtn[aria-label="Close"]'), 300);

/* ---------------------------------------------------------- admin universities */
await login('admin@example.com');
await mount('/admin/universities');
await wait(1000);
ok('admin: university edit + delete icons', sel('button[aria-label^="Edit "]').length >= 5 && sel('button[aria-label^="Delete "]').length >= 5);
await click(sel('button[aria-label^="Edit "]')[0], 500);
ok('admin: university edit prefilled', (document.querySelector('#u-name') || {}).value?.length > 0 &&
  /Edit university/.test((document.querySelector('.sheet') || {}).textContent || ''));
await click(document.querySelector('.sheet .iconbtn[aria-label="Close"]'), 300);

/* ----------------------------------------------------------------- broadcast */
await mount('/admin/broadcast');
await wait(1200);
ok('broadcast: composer + history render', !!document.querySelector('#bc-title') && /Sent/.test(text()));
const titleEl = document.querySelector('#bc-title');
setVal(titleEl, 'Happy DOM broadcast');
const bodyEl = document.querySelector('#bc-body');
setVal(bodyEl, 'Sent from the DOM harness to prove the audience picker works end to end.');
await wait(200);
const selRadio = sel('input[name="audience"]').find(i => i.value === 'selected');
selRadio.click();
await wait(400);
ok('broadcast: recipient picker appears', sel('.picklist input[type=checkbox]').length > 0, sel('.picklist input[type=checkbox]').length + ' people');
sel('.picklist input[type=checkbox]')[0].click();
await wait(300);
ok('broadcast: recipient count updates to 1', /1 recipient/.test(text()));
const sendBtn = byText('button', 'Send notification');
ok('broadcast: send button enables with a title, body and recipient', !sendBtn.disabled);
await click(sendBtn, 1500);
const sends = (await api('/api/admin/notifications')).body.sends;
ok('broadcast: recorded in send history', sends.some(s => s.title === 'Happy DOM broadcast' && s.recipients === 1), sends.slice(0, 2).map(s => s.title + ':' + s.recipients).join(', '));

/* ------------------------------------------------------------------ research */
await login('admin@example.com');
await mount('/admin/research');
await wait(1200);
ok('research: three research kinds offered', sel('input[name="research-kind"]').length === 3);
ok('research: key status shown', /AI key|extractor/.test(text()));
const notesEl = document.querySelector('#res-notes');
setVal(notesEl, 'The Example Foundation scholarship is fully funded. The application deadline is 30 September 2027. A minimum CGPA of 3.2/4 is required and IELTS 6.5 overall is required.');
await wait(200);
await click(byText('button', 'Run research'), 2600);
ok('research: fields appear after the run', !!document.querySelector('#rf-title'));
ok('research: provider badge shown', /extract|ai:/.test(text()));
ok('research: title filled from the text', (document.querySelector('#rf-title') || {}).value?.length > 5, (document.querySelector('#rf-title') || {}).value);
ok('research: deadline parsed', (document.querySelector('#rf-deadline') || {}).value === '2027-09-30', (document.querySelector('#rf-deadline') || {}).value);
ok('research: CGPA + IELTS parsed', (document.querySelector('#rf-minCgpa') || {}).value === '3.2' && (document.querySelector('#rf-minIelts') || {}).value === '6.5');
ok('research: warnings explain what to check', /Check these before saving|AI key/.test(text()));
const saveBtn = byText('button', 'Save as draft');
ok('research: save-as-draft available', !!saveBtn && !saveBtn.disabled);
await click(saveBtn, 1800);
const drafts = (await api('/api/admin/listings')).body.listings.filter(l => l.draftedByAi && l.status === 'draft');
ok('research: saved an AI draft (unpublished)', drafts.length > 0, drafts.map(d => d.id).join(', '));

/* ------------------------------------------------------ settings (admin) AI */
await mount('/settings?tab=site');
await wait(1400);
ok('admin: Site & AI tab visible', sel('.tabs button').some(b => b.textContent.includes('Site & AI')));
ok('admin: API key field is masked', (document.querySelector('#ai-key') || {}).type === 'password');
ok('admin: provider + model + base url fields', !!document.querySelector('#ai-provider') && !!document.querySelector('#ai-model') && !!document.querySelector('#ai-base'));
const keyEl = document.querySelector('#ai-key');
setVal(keyEl, 'sk-dom-harness-key-12345');
await wait(200);
await click(byText('button', 'Save settings'), 1400);
const s = (await api('/api/admin/settings')).body.settings;
ok('admin: key stored but never returned raw', s.aiApiKeySet === true && s.aiApiKey === '', 'hint ' + s.aiApiKeyHint);
ok('admin: input cleared after save', (document.querySelector('#ai-key') || {}).value === '');

/* ------------------------------------------------------------- contributor */
await login('contributor@example.com');
await mount('/admin/broadcast');
await wait(1200);
ok('contributor: can open the broadcast page', !!document.querySelector('#bc-title'));
ok('contributor: told they cannot send', /Only an admin can send/i.test(text()));
ok('contributor: send button disabled', byText('button', 'Send notification').disabled);
await mount('/settings?tab=site');
await wait(1000);
ok('contributor: no Site & AI tab', !sel('.tabs button').some(b => b.textContent.includes('Site & AI')));

/* --------------------------------------------------------- header search UI */
await login('ayesha@example.com');
await mount('/scholarships?q=DAAD');
await wait(1500);
ok('search: results header names the query', /Results for/.test(text()) && /DAAD/.test(text()));
ok('search: matching listings returned', sel('a[href^="/scholarship/"], a[href^="/program/"]').length > 0,
  sel('a[href^="/scholarship/"], a[href^="/program/"]').length + ' cards');
ok('search: offers the other collection', /Search programs instead|Search scholarships instead/.test(text()));
await mount('/programs?q=informatics');
await wait(1400);
ok('search: works on programs too', /Results for/.test(text()) && /informatics/i.test(text()));

console.log('\n' + results.filter(r => r.pass).length + '/' + results.length + ' checks passed');
const failed = results.filter(r => !r.pass);
if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log(' - ' + f.name + ' :: ' + f.detail)); process.exitCode = 1; }

process.exit(results.some(r => !r.pass) ? 1 : 0);
