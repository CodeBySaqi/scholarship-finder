/* The five candidate home pages at /design.
   Every one of them has to be a real page: one h1, working calls to action, the
   public header and footer, the picker, an honest verdict vocabulary, and a
   working "use this design" selection. Run: bash audit/run-dom.sh design */
import { Window } from 'happy-dom';
const API = 'http://localhost:8000';
const win = new Window({ url: API + '/design', settings: { disableJavaScriptEvaluation: false, disableCSSFileLoading: true } });
for (const k of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLButtonElement','HTMLSelectElement','HTMLTextAreaElement','HTMLAnchorElement','Element','Node','NodeList','Event','MouseEvent','KeyboardEvent','PointerEvent','FocusEvent','CustomEvent','SVGElement','SVGSVGElement','DocumentFragment','localStorage','CSS','MutationObserver','ResizeObserver','IntersectionObserver']) {
  if (win[k] !== undefined) globalThis[k] = win[k];
}
globalThis.window = win;
globalThis.document = win.document;
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
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const text = () => (document.querySelector('#page')?.textContent || '').replace(/\s+/g, ' ').trim();

const SLUGS = ['split', 'bento', 'aurora', 'app', 'minimal'];
const NAMES = ['Split editorial', 'Bento grid', 'Dark aurora', 'Product preview', 'Minimal type'];

/* ------------------------------------------------------------------ index */
mount('/design'); await wait(1500);
const idx = text();
ok('index: the gallery renders', idx.length > 200, idx.slice(0, 48));
ok('index: all five designs are listed', NAMES.every(n => idx.includes(n)), NAMES.filter(n => !idx.includes(n)).join(',') || 'all five');
ok('index: each card opens its own preview', SLUGS.every(s => !!document.querySelector('a[href="/design/' + s + '"]')));
ok('index: it says nothing here is public yet', /Nothing here is public yet/i.test(idx));
ok('index: it offers the way back to the live home page', !!document.querySelector('a[href="/"]'));
ok('index: each design has a screenshot-like thumbnail', $$('.lvthumb').length === 5, $$('.lvthumb').length + ' thumbnails');

/* ------------------------------------------------------------- each design */
for (let i = 0; i < SLUGS.length; i++) {
  const slug = SLUGS[i];
  mount('/design/' + slug); await wait(1700);
  const t = text();
  const h1s = $$('#page h1');
  ok(slug + ': renders content', t.length > 400, t.length + ' chars');
  ok(slug + ': exactly one h1', h1s.length === 1, h1s.length + ' h1');
  ok(slug + ': has a call to action into signup', !!document.querySelector('#page a[href="/signup"]'));
  ok(slug + ': keeps the public header nav', ['/scholarships', '/programs'].every(h => !!document.querySelector('header a[href="' + h + '"]')));
  ok(slug + ': keeps the footer with the legal links', !!document.querySelector('#page a[href="/privacy"]') && !!document.querySelector('#page a[href="/terms"]'));
  ok(slug + ': carries the screening disclaimer', /not an offer of admission|does not guarantee selection|Screening is not admission/i.test(t));
  ok(slug + ': uses the three honest verdicts', /Eligible/.test(t) && /Not eligible|not eligible/.test(t) && /Check manually|check manually/i.test(t));
  ok(slug + ': no match percentage is promised', !/\d+\s*%\s*match/i.test(t));
  ok(slug + ': shows the live counts from the API', /\b\d+\b/.test(t));
  const bar = $('.lvd-bar');
  ok(slug + ': the design bar is present with five switches', !!bar && $$('.lvd-dot').length === 5);
  ok(slug + ': the bar names this design', !!bar && (bar.textContent || '').includes(NAMES[i]));
  ok(slug + ': this design is marked current in the bar',
    !!document.querySelector('.lvd-dot[aria-current="true"]') &&
    document.querySelector('.lvd-dot[aria-current="true"]').textContent.trim() === String(i + 1));
  ok(slug + ': the bar offers a way to compare all five', !!document.querySelector('.lvd-bar a[href="/design"]'));
}

/* --------------------------------------------------------------- picking */
mount('/design/minimal'); await wait(1700);
try { localStorage.removeItem('sf.landing-choice'); } catch { /* private mode */ }
const pickBtn = $$('.lvd-bar button').find(b => /Use this design/i.test(b.textContent));
ok('pick: the "use this design" button exists', !!pickBtn);
if (pickBtn) {
  pickBtn.click(); await wait(300);
  let stored = null;
  try { stored = localStorage.getItem('sf.landing-choice'); } catch { /* private */ }
  ok('pick: it stores the choice', stored === '5', 'stored=' + stored);
  ok('pick: the button confirms the selection', /Selected/i.test(pickBtn.textContent));
}

/* --------------------------------------------------------------- routing */
mount('/design/not-a-design'); await wait(900);
ok('routing: an unknown design goes back to the gallery', /Five home pages/i.test(text()), text().slice(0, 40));

/* ------------------------------------------------------- the live page is safe */
mount('/'); await wait(1500);
const live = text();
ok('the live home page at / is untouched', !/Five home pages/i.test(live) && live.length > 300);
ok('the live home page has no design picker', $$('.lvd-bar').length === 0);

console.log('\n' + pass + '/' + (pass + fail) + ' design-page checks passed' + (fail ? ' — ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
