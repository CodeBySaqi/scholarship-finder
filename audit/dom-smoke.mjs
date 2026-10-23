import { Window } from 'happy-dom';
const API = 'http://localhost:8000';
const win = new Window({ url: API + '/' });
for (const k of ['window','document','navigator','HTMLElement','Element','Node','Event','MouseEvent','KeyboardEvent','localStorage']) globalThis[k] = win[k] ?? win;
globalThis.getComputedStyle = win.getComputedStyle.bind(win);
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
async function login(email) {
  const r = await rf(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) });
  for (const c of (r.headers.getSetCookie?.() || [])) { const kv = c.split(';')[0]; if (kv.startsWith('sf_session=')) cookie = kv; }
}
const STUDENT = ['/dashboard','/matches','/scholarships','/programs','/saved','/profile','/settings','/notifications','/wizard','/scholarship/S1','/program/P1'];
const ADMIN = ['/admin','/admin/queue','/admin/errors','/admin/logs','/admin/users','/admin/listings','/admin/listings/new','/admin/listings/S1','/admin/universities','/admin/ai-draft','/admin/broadcast','/admin/research','/settings?tab=site'];
let fail = 0;
for (const [role, email, routes] of [['student','ayesha@example.com',STUDENT],['admin','admin@example.com',ADMIN],['contributor','contributor@example.com',ADMIN]]) {
  await login(email);
  for (const route of routes) {
    mount(route);
    await new Promise(r => setTimeout(r, 1100));
    const page = document.querySelector('#page');
    const t = (page?.textContent || '').replace(/\s+/g, ' ').trim();
    const crashed = /This page could not be shown|Cannot read properties|undefined is not/.test(document.body.textContent);
    const empty = t.length < 40;
    const ok = !crashed && !empty;
    if (!ok) { fail++; console.log('FAIL', role, route, '::', t.slice(0, 120)); }
  }
  console.log(role + ': ' + (routes.length - routes.filter((r,i)=>false).length) + ' routes checked');
}
console.log(fail === 0 ? 'ALL ROUTES RENDERED CLEANLY' : fail + ' ROUTE FAILURES');
process.exit(fail ? 1 : 0);
