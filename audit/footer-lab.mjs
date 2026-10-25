/* The footer lab at /footers.
   Ten candidate footers, all built from real components: each has to carry the
   whole link set, a way into sign-up, the honest legal line, its own heading,
   and a pick that persists. Run: bash audit/run-dom.sh footers */
import { Window } from 'happy-dom';
const API = 'http://localhost:8000';
const win = new Window({ url: API + '/footers', settings: { disableJavaScriptEvaluation: false, disableCSSFileLoading: true } });
for (const k of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLButtonElement','HTMLSelectElement','HTMLTextAreaElement','HTMLAnchorElement','Element','Node','NodeList','Event','MouseEvent','KeyboardEvent','PointerEvent','FocusEvent','CustomEvent','SVGElement','SVGSVGElement','DocumentFragment','localStorage','CSS','MutationObserver','ResizeObserver','IntersectionObserver']) {
  if (win[k] !== undefined) globalThis[k] = win[k];
}
globalThis.window = win; globalThis.document = win.document;
globalThis.getComputedStyle = win.getComputedStyle.bind(win);
globalThis.self = win;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
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
const text = () => (document.querySelector('#page')?.textContent || '').replace(/\s+/g, ' ').trim();

mount('/footers'); await wait(1800);
const sections = [...document.querySelectorAll('section.flab')];
ok('the lab lists ten footers', sections.length === 10, sections.length + ' sections');
ok('every footer has a jump link', document.querySelectorAll('.flab-jump').length === 10);
ok('pages do not get a second footer from the shell', document.querySelectorAll('#page > footer.sfoot').length === 0);

const NAMES = ['Dark card','Editorial light','Slim bar','Mega columns','Newsletter band','Split prose','Command bar','Stat strip','Bento tiles','Minimal + wordmark'];
for (let i = 0; i < sections.length; i++) {
  const s = sections[i];
  const n = i + 1;
  const t = (s.textContent || '').replace(/\s+/g, ' ');
  const links = [...s.querySelectorAll('footer a[href^="/"]')].map(a => a.getAttribute('href'));
  ok('footer ' + n + ': labelled ' + NAMES[i], (s.querySelector('.flab__name')?.textContent || '').includes(NAMES[i]));
  ok('footer ' + n + ': carries the full link set',
    ['/scholarships', '/programs', '/privacy', '/terms'].every(h => links.includes(h)), links.length + ' links');
  ok('footer ' + n + ': offers a way into sign-up or login', links.includes('/signup') || links.includes('/login'));
  ok('footer ' + n + ': keeps the screening disclaimer', /does not guarantee selection/i.test(t));
  ok('footer ' + n + ': no invented numbers', !/€\s?\d|100\s?%|guaranteed admission/i.test(t));
  ok('footer ' + n + ': has its own pick button', !!s.querySelector('.flab__head button'));
}

/* picking */
const first = document.querySelectorAll('.flab')[0].querySelector('.flab__head button');
const before = document.querySelectorAll('.flab-picked').length;
first.click(); await wait(300);
let stored = null; try { stored = localStorage.getItem('sf.footer-choice'); } catch { /* private */ }
ok('pick: the choice is stored', stored === '1', 'stored=' + stored);
ok('pick: the marked banner appears', document.querySelectorAll('.flab-picked').length === (before || 1));
ok('pick: the button confirms the selection', /Selected/i.test(first.textContent));

/* the live footer is untouched by the lab */
mount('/'); await wait(1400);
ok('the live home page still has exactly one footer', document.querySelectorAll('footer.sfoot').length === 1);
ok('the live footer is the simple clean one', !!document.querySelector('footer.sfoot .sfoot__nav') && !document.querySelector('footer.sfoot .sfoot__wordmark'));

console.log('\n' + pass + '/' + (pass + fail) + ' footer-lab checks passed' + (fail ? ' — ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
