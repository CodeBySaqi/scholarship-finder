/* Audit suite — failure modes. Run against a live server: PORT=8000 node server/index.js
   Playwright at $PW (default /tmp/pw/node_modules/playwright-core/index.mjs), Chromium at $CHROME.

   Proves the rule that matters most for trust: NO page may ever go blank or show the error
   boundary because a request failed. Every one of them must render a card that says what
   happened and offers a way forward.

   Three passes:
     1. each page's own endpoint returns 500   → inline card + "Try again", rest of the shell intact
     2. each page's own endpoint is unreachable → same, worded as a connection problem
     3. the whole API is down before boot      → one "Cannot reach the server" screen with a retry
   Plus: a wrong listing id is "not found", and an expired session asks you to sign in again. */
const { chromium } = await import(process.env.PW || '/tmp/pw/node_modules/playwright-core/index.mjs');
const CHROME = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1134/chrome-linux/chrome';
const BASE = process.env.BASE || 'http://localhost:8000';

const res = [];
const check = (ok, name, detail = '') => res.push({ ok, name, detail: String(detail) });

const STUDENT = [
  ['/dashboard', '/api/profile'],
  ['/matches', '/api/matches'],
  ['/scholarships', '/api/listings'],
  ['/programs', '/api/listings'],
  ['/saved', '/api/saved'],
  ['/profile', '/api/profile'],
  ['/wizard', '/api/profile'],
  ['/settings', '/api/profile'],
  ['/scholarship/S1', '/api/listings/S1']
];
const ADMIN = [
  ['/admin', '/api/admin/overview'],
  ['/admin/listings', '/api/admin/listings'],
  ['/admin/listings/S1', '/api/admin/listings/S1'],
  ['/admin/queue', '/api/admin/queue'],
  ['/admin/errors', '/api/admin/errors'],
  ['/admin/users', '/api/admin/users'],
  ['/admin/logs', '/api/admin/logs'],
  ['/admin/universities', '/api/admin/universities'],
  ['/admin/ai-draft?id=S7', '/api/admin/listings/S7']
];
const PUBLIC = [['/', '/api/public/stats']];

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

async function session(kind) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  if (kind) {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.click(`button:has-text("Continue as demo ${kind}")`);
    await page.waitForTimeout(1500);
  }
  return { ctx, page, errors };
}

const body = (page) => page.locator('body').innerText().catch(() => '');
const crashed = (t) => /This page could not be shown/i.test(t);

async function sweep(kind, routes, mode) {
  const { ctx, page, errors } = await session(kind);
  for (const [route, endpoint] of routes) {
    const handler = mode === 'offline'
      ? (r) => r.abort('failed')
      : (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"simulated failure"}' });
    await page.route('**' + endpoint + '*', handler);
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);            /* covers the silent retry (~700 ms) + render */
    const t = await body(page);
    const label = `${mode} ${route}`;
    check(!crashed(t), `${label} does not hit the error boundary`, crashed(t) ? t.slice(0, 80) : '');
    check(t.length > 60, `${label} still renders a page`, t.length + ' chars');
    check(/Try again/i.test(t), `${label} offers a retry`, '');
    await page.unroute('**' + endpoint + '*');
  }
  check(errors.length === 0, `${mode} sweep as ${kind || 'visitor'}: no uncaught page errors`, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* 1 + 2 — a single failing endpoint on every page */
await sweep('student', STUDENT, '500');
await sweep('admin', ADMIN, '500');
await sweep(null, PUBLIC, '500');
await sweep('student', [STUDENT[0]], 'offline');
await sweep('admin', [ADMIN[0]], 'offline');

/* 3 — the whole API down before the app boots */
{
  const { ctx, page } = await session(null);
  await page.route('**/api/**', r => r.abort('failed'));
  await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const t = await body(page);
  check(/Cannot reach the server/i.test(t), 'API down at boot shows the connection screen', t.slice(0, 80));
  check(/Try again/i.test(t), 'the connection screen offers a retry');
  check(!crashed(t), 'API down at boot never shows the error boundary');
  await ctx.close();
}

/* 4 — a wrong id is "not found", not a failure */
{
  const { ctx, page } = await session('admin');
  await page.goto(BASE + '/admin/listings/S9999', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const t = await body(page);
  check(/not found/i.test(t), 'a missing listing id says "Listing not found"', t.slice(0, 90));
  check(!crashed(t), 'a missing listing id does not hit the error boundary');
  await ctx.close();
}

/* 5 — an expired session asks for a sign-in instead of showing an error */
{
  const { ctx, page } = await session('admin');
  await ctx.clearCookies();
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  const url = new URL(page.url());
  check(url.pathname === '/login', 'an expired session lands on /login', page.url().replace(BASE, ''));
  check(url.searchParams.get('next') === '/admin/users', 'and remembers where you were going', url.search);
  await ctx.close();
}

await browser.close();

const bad = res.filter(r => !r.ok);
console.log(`\n${res.length - bad.length}/${res.length} failure-mode checks passed`);
if (bad.length) {
  console.log('\nFINDINGS');
  for (const b of bad) console.log(` ✗ ${b.name}  [${b.detail}]`);
  process.exit(1);
}
