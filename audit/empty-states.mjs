/* Audit suite — every page, every role. Run against a live server.
   Playwright at $PW, Chromium at $CHROME. See ../AUDIT.md. */
/* Empty states for a brand-new account + form validation on the forms that matter. */
const { chromium } = await import(process.env.PW || '/tmp/pw/node_modules/playwright-core/index.mjs');
const BASE = 'http://localhost:8000';
const CHROME = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1134/chrome-linux/chrome';
const res = [];
const check = (ok, name, detail = '') => res.push({ ok, name, detail: String(detail) });
const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 120)); });

/* ---------- brand-new account ---------- */
const email = 'fresh' + Date.now() + '@example.com';
await p.goto(BASE + '/signup', { waitUntil: 'networkidle' });
await p.fill('#name', 'Fresh User');
await p.fill('#email', email);
await p.fill('#password', 'demopass123');
await p.check('#consent');
await p.click('button:has-text("Create account")');
await p.waitForTimeout(1200);
await p.click('button:has-text("I have verified my email")');
await p.waitForTimeout(1600);

for (const [route, expect] of [['/dashboard', /complete|provisional|profile/i], ['/matches', /nothing|no matches|provisional|start/i], ['/saved', /empty|nothing|tap save|no saved/i], ['/profile', /Fresh User/i], ['/settings', /theme|appearance/i]]) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const t = await p.locator('#page').innerText();
  check(t.length > 60, `new account: ${route} renders`, t.length + ' chars');
  check(expect.test(t), `new account: ${route} shows an empty/guide state`, t.replace(/\n+/g, ' | ').slice(0, 120));
  check(!/undefined|NaN|\[object/.test(t), `new account: ${route} has no bad values`);
}
check(errs.length === 0, 'new-account walk raises no errors', errs.join(' | '));

/* ---------- signup validation ---------- */
{
  await p.goto(BASE + '/signup', { waitUntil: 'networkidle' });
  await p.fill('#name', 'A');
  await p.fill('#email', 'a' + Date.now() + '@example.com');
  await p.fill('#password', 'short');
  await p.check('#consent');
  await p.click('button:has-text("Create account")');
  await p.waitForTimeout(900);
  const t = await p.locator('#page').innerText();
  check(/8 characters|at least 8/i.test(t), 'signup rejects a short password', t.replace(/\n+/g, ' | ').slice(0, 140));

  await p.goto(BASE + '/signup', { waitUntil: 'networkidle' });
  await p.fill('#name', 'B');
  await p.fill('#email', 'ayesha@example.com');
  await p.fill('#password', 'demopass123');
  await p.check('#consent');
  await p.click('button:has-text("Create account")');
  await p.waitForTimeout(900);
  check(/already has an account|already/i.test(await p.locator('#page').innerText()), 'signup rejects a duplicate email');

  await p.goto(BASE + '/signup', { waitUntil: 'networkidle' });
  await p.fill('#name', 'C');
  await p.fill('#email', 'notanemail');
  await p.fill('#password', 'demopass123');
  await p.check('#consent');
  await p.click('button:has-text("Create account")');
  await p.waitForTimeout(900);
  check(p.url().includes('verify-email') === false, 'signup rejects an invalid email address', p.url().replace(BASE, ''));
}

/* ---------- login validation ---------- */
{
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.fill('#email', 'ayesha@example.com');
  await p.fill('#password', 'wrongpass');
  await p.click('button[type=submit]');
  await p.waitForTimeout(900);
  check(/not correct|incorrect|wrong/i.test(await p.locator('#page').innerText()), 'login rejects a wrong password');
  await p.fill('#password', 'demo1234');
  await p.click('button[type=submit]');
  await p.waitForTimeout(1400);
  check(p.url().endsWith('/dashboard'), 'login with the right password lands on the dashboard', p.url().replace(BASE, ''));
}

/* ---------- forgot / reset flow ---------- */
{
  await p.goto(BASE + '/forgot-password', { waitUntil: 'networkidle' });
  await p.fill('#email', 'ayesha@example.com');
  await p.click('button:has-text("Send reset link")');
  await p.waitForTimeout(1000);
  check(p.url().includes('/reset-sent'), 'forgot password moves to the sent screen', p.url().replace(BASE, ''));
  const link = p.locator('#page a:has-text("Open the reset screen")');
  check(await link.count() > 0, 'reset screen is reachable from the sent page');
  if (await link.count()) {
    await link.click();
    await p.waitForTimeout(900);
    const fields = await p.locator('#page input[type=password]').count();
    check(fields >= 2, 'reset screen asks for the new password twice', fields);
  }
}

/* ---------- listing form validation (admin) ---------- */
{
  const actx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const ap = await actx.newPage();
  ap.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await ap.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await ap.click('button:has-text("Continue as demo admin")');
  await ap.waitForTimeout(1400);
  await ap.goto(BASE + '/admin/listings/new', { waitUntil: 'networkidle' });
  await ap.waitForTimeout(700);
  await ap.click('button:has-text("Create draft")');
  await ap.waitForTimeout(1000);
  check(ap.url().includes('/new'), 'listing form refuses an empty title', ap.url().replace(BASE, ''));
  const err1 = await ap.locator('.snackbar, .err, .form-error').innerText().catch(() => '');
  check(/title/i.test(err1), 'the empty-title refusal names the field', err1);

  await ap.goto(BASE + '/admin/listings/new', { waitUntil: 'networkidle' });
  await ap.waitForTimeout(700);
  await ap.fill('#title', 'Validation probe ' + Date.now());
  await ap.click('button:has-text("Create draft")');
  await ap.waitForTimeout(1400);
  /* a draft may exist without a source, but it must not be publishable */
  const id = (ap.url().match(/\/admin\/listings\/(S\d+|P\d+)/) || [])[1];
  check(!!id, 'a draft can be created as a stub', ap.url().replace(BASE, ''));
  if (id) {
    /* the four-eyes rule fires first for your own draft, so publish a contributor's stub */
    const r = await ap.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'contributor@example.com', password: 'demo1234' }) });
      const created = await fetch('/api/admin/listings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'No source stub ' + Date.now() }) });
      const listing = (await created.json()).listing;
      await fetch('/api/auth/logout', { method: 'POST' });
      await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password: 'demo1234' }) });
      const pub = await fetch('/api/admin/listings/' + listing.id + '/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gate: { display: true, eligibility: true, provenance: true } }) });
      return { id: listing.id, status: pub.status, body: await pub.json() };
    });
    check(r.status === 400 && /source/i.test(r.body.error || ''), 'publishing without a source URL is refused server-side', JSON.stringify(r));
  }
  await actx.close();
}

const fails = res.filter(r => !r.ok);
console.log(`\n${res.length - fails.length}/${res.length} empty-state + validation checks passed`);
if (fails.length) { console.log('\nFINDINGS'); fails.forEach(f => console.log(' ✗ ' + f.name + (f.detail ? ' [' + f.detail + ']' : ''))); }
await b.close();
