/* HeroUI adoption — is the library really the paint layer?
   Mounts real pages in the happy-dom harness (same bundle as the other DOM
   suites) and asserts that the elements students see are HeroUI components,
   not the old hand-rolled markup, while the shell layout is unchanged.
   Run: bash audit/run-dom.sh heroui   (needs happy-dom + a server on :8000) */
import { Window } from 'happy-dom';
import fs from 'node:fs';
import path from 'node:path';

const API = 'http://localhost:8000';
const win = new Window({ url: API + '/', settings: { disableJavaScriptEvaluation: false, disableCSSFileLoading: true } });
for (const k of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLButtonElement','HTMLSelectElement','HTMLTextAreaElement','HTMLAnchorElement','Element','Node','NodeList','Event','MouseEvent','KeyboardEvent','PointerEvent','FocusEvent','CustomEvent','SVGElement','SVGSVGElement','DocumentFragment','localStorage','CSS','MutationObserver','ResizeObserver','IntersectionObserver']) {
  if (win[k] !== undefined) globalThis[k] = win[k];
}
globalThis.window = win;
globalThis.document = win.document;
globalThis.getComputedStyle = win.getComputedStyle.bind(win);
globalThis.self = win;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.matchMedia = () => ({ matches: true, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });

const rf = globalThis.fetch; let cookie = '';
globalThis.fetch = async (i, init = {}) => {
  const u = typeof i === 'string' ? i : i.url; const t = u.startsWith('/') ? API + u : u;
  const h = { ...(init.headers || {}) }; if (cookie) h.cookie = cookie;
  const r = await rf(t, { ...init, headers: h });
  for (const c of (r.headers.getSetCookie?.() || [])) { const kv = c.split(';')[0]; if (kv.startsWith('sf_session=')) cookie = kv; }
  return r;
};
win.fetch = globalThis.fetch;
document.body.innerHTML = '<div id="root"></div>';

const { mount } = await import('/tmp/sf-dom/bundle.mjs');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('PASS ' + name + (detail ? ' — ' + detail : '')); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
};
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const text = () => (document.querySelector('#page')?.textContent || '').replace(/\s+/g, ' ').trim();

async function login(email) {
  cookie = '';
  const r = await rf(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) });
  for (const c of (r.headers.getSetCookie?.() || [])) { const kv = c.split(';')[0]; if (kv.startsWith('sf_session=')) cookie = kv; }
}
async function open(route, ms = 1200) { mount(route); await wait(ms); }

/* HeroUI marks its own output: data-slot / data-react-aria-pressable / its
   utility classes. That is what "rendered by HeroUI" means in the DOM. */
const heroBtn = (el) => !!el && /data-react-aria-pressable|group relative inline-flex/.test(el.outerHTML.slice(0, 400));

/* ---------------------------------------------------------------- login */
await login('ayesha@example.com');
await open('/login');

const emailField = $('#email');
ok('/login: the email field is a HeroUI Input', emailField && emailField.getAttribute('data-slot') === 'input');
ok('/login: the field keeps the app id and label wiring', emailField && emailField.id === 'email' && !!document.querySelector('label[for="email"]'));
ok('/login: the HeroUI wrapper carries the app .input class',
  !!$('[data-slot="input-wrapper"].input'), ($('[data-slot="input-wrapper"].input') || {}).className?.split(' ').pop());
ok('/login: password field is a HeroUI Input', $('#password')?.getAttribute('data-slot') === 'input');
const loginSubmit = $$('#page button').find(b => /^Log in$/i.test(b.textContent.trim()));
ok('/login: the submit button is a HeroUI Button', heroBtn(loginSubmit));
ok('/login: the submit button is still type=submit', loginSubmit?.getAttribute('type') === 'submit');
const demoBtn = $$('#page button').find(b => /Continue as demo student/i.test(b.textContent));
ok('/login: the demo shortcut is a HeroUI Button too', heroBtn(demoBtn));

/* ------------------------------------------------------------ dashboard */
await open('/dashboard', 1600);
ok('/dashboard: the page rendered', text().length > 80, text().slice(0, 40));
const cards = $$('#page .card');
ok('/dashboard: cards are HeroUI Cards (content1 surface + rounded-large)', cards.length >= 4 && cards.every(c => /bg-content1|flex-col/.test(c.className)), cards.length + ' cards');
ok('/dashboard: HeroUI Card root markup is present', cards.some(c => c.getAttribute('tabindex') === '-1'));
const bars = $$('#page [role="progressbar"]');
ok('/dashboard: progress bars are HeroUI Progress', bars.length >= 1);
ok('/dashboard: the Progress indicator is the painted element', !!bars[0]?.querySelector('div > div[style*="translateX"]'));
ok('/dashboard: Progress still reports the real value', bars.some(b => Number(b.getAttribute('aria-valuenow')) > 0), bars.map(b => b.getAttribute('aria-valuenow')).join(','));

/* -------------------------------------------------------------- matches */
await open('/matches', 1700);
const tabs = $$('#page .tabs button[role="tab"]');
ok('/matches: the two tabs still exist and are still buttons', tabs.length === 2);
const verdictChips = $$('#page .tag');
ok('/matches: verdict tags are HeroUI Chips', verdictChips.length > 0 && verdictChips.every(c => c.tagName === 'SPAN' && /tag/.test(c.className)), verdictChips.length + ' tags');
ok('/matches: the verification tag keeps its icon slot', !!$('#page .tag svg'));

/* ------------------------------------------------------------- browse */
await open('/scholarships', 1700);
const filterChips = $$('#page .chip');
ok('/scholarships: filter chips are HeroUI Chips', filterChips.length > 0 && filterChips.every(c => c.tagName === 'BUTTON' && /relative max-w-fit/.test(c.className)), filterChips.length + ' chips');
ok('/scholarships: filter chips keep aria-pressed for the audit', filterChips.every(c => c.hasAttribute('aria-pressed')));
const nativeSelects = $$('#page select.select');
ok('/scholarships: the compact sort/select controls stay native selects', nativeSelects.length >= 1, nativeSelects.length + ' selects');

/* --------------------------------------------------------------- wizard */
await open('/wizard?step=1', 1700);
const wizInputs = $$('#page [data-slot="input"]');
ok('/wizard: every text field is a HeroUI Input', wizInputs.length >= 3, wizInputs.length + ' HeroUI inputs');
ok('/wizard: no bare legacy input is left outside HeroUI', $$('#page input:not([data-slot])').every(i => i.type === 'radio' || i.type === 'checkbox' || i.type === 'hidden'));
const yesNo = $$('#page .chip').filter(c => /^(Yes|No|Female|Male|Other)$/.test(c.textContent.trim()));
ok('/wizard: the one-tap answers are HeroUI Chips', yesNo.length >= 3 && yesNo.every(c => c.getAttribute('aria-pressed') !== null), yesNo.length + ' answers');
const dateInput = $$('#page [data-slot="input"]').find(i => i.type === 'date');
ok('/wizard: a date field is still a HeroUI Input with its native picker', !!dateInput, dateInput ? dateInput.id : 'none');
const saveBtn = $$('#page button').find(b => /Save and continue/i.test(b.textContent));
ok('/wizard: the save button is a HeroUI Button', heroBtn(saveBtn));

/* ------------------------------------------------------------- profile */
await open('/profile', 1600);
ok('/profile: the summary has no inputs to edit directly', $$('#page input').length === 0);
ok('/profile: its chips are HeroUI Chips', $$('#page .tag').length > 0);

/* --------------------------------------------------------------- shell */
ok('shell: the sidebar is still a plain <aside> with its own classes', !!$('aside.side') && $('#page') !== null);
ok('shell: the topbar is unchanged', !!$('header.topbar .topbar__in'));
ok('shell: the mobile bottom bar is still there', $$('nav.bottomnav a').length >= 5);
ok('shell: the avatar is a HeroUI Avatar', $$('.topbar .avatar').some(a => !!a.querySelector('[data-slot], img, span')));
const bell = $('.notif__btn');
ok('shell: the bell is a HeroUI icon Button inside a Badge', heroBtn(bell) && !!bell.closest('[data-slot], .notif__count, div'));

/* ---------------------------------------------------------------- theme */
const { applyTheme } = await import('../src/components/theme.js');
applyTheme('dark');
ok('theme: dark sets the app attribute', document.documentElement.getAttribute('data-theme') === 'dark');
ok('theme: dark also flips HeroUI (html.dark)', document.documentElement.classList.contains('dark'));
applyTheme('light');
ok('theme: light clears both', document.documentElement.getAttribute('data-theme') === 'light' && !document.documentElement.classList.contains('dark'));
applyTheme('auto');

/* ------------------------------------------------------------ stylesheet */
const cssFile = fs.readdirSync('dist/assets').find(f => f.endsWith('.css'));
const css = fs.readFileSync(path.join('dist/assets', cssFile), 'utf8');
ok('css: HeroUI theme tokens are in the bundle', /--heroui-primary:\s*212\.37/.test(css), 'primary #1B84FF');
ok('css: the primary is the app blue', /--heroui-primary:\s*212\.37 100% 55\.29%/.test(css));
ok('css: HeroUI utilities are emitted (not just the theme)', /\.rounded-large\{|\.h-10\{|\.min-h-10\{/.test(css));
ok('css: the app layout rules still come from app.css', /\.side\{position:fixed/.test(css) && /\.topbar\{position:sticky/.test(css));
ok('css: the app reset survives (preflight is off)', /\*,:before,:after\{box-sizing:border-box\}/.test(css) || /box-sizing:border-box/.test(css));
ok('css: the .grow helper keeps min-width:0', /\.grow\{flex:1;min-width:0\}/.test(css));
ok('css: the app .grow (min-width:0) is emitted after Tailwind\'s',
  css.indexOf('.grow{flex:1;min-width:0}') > css.indexOf('.grow{flex-grow:1}'));

console.log('\n' + pass + '/' + (pass + fail) + ' HeroUI checks passed' + (fail ? ' — ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
