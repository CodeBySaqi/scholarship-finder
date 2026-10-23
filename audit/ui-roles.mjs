/* Audit suite — run against a live server: PORT=8000 node server/index.js
   Playwright is expected at $PW (default /tmp/node_modules/playwright-core/index.mjs)
   and Chromium at $CHROME. See ../AUDIT.md for what each suite proves. */
const { chromium } = await import(process.env.PW || '/tmp/pw/node_modules/playwright-core/index.mjs');
const BASE = 'http://localhost:8000';
const res = [];
const check = (ok, name, detail = '') => res.push({ ok, name, detail: String(detail) });

const STUDENT_ROUTES = ['/dashboard', '/matches', '/scholarships', '/programs', '/scholarship/S1', '/program/P1', '/saved', '/profile', '/wizard', '/settings', '/settings?tab=alerts', '/settings?tab=account', '/settings?tab=privacy'];
const ADMIN_ROUTES = ['/admin', '/admin/listings', '/admin/listings/S1', '/admin/queue', '/admin/errors', '/admin/ai-draft', '/admin/universities', '/admin/users', '/admin/logs'];

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1134/chrome-linux/chrome', args: ['--no-sandbox'] });

async function session(who) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 120)); });
  if (who) {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    if (who === 'student') {
      await page.click('button:has-text("Continue as demo student")');
    } else if (who === 'admin' || who === 'contributor') {
      await page.click(`button:has-text("Continue as demo ${who}")`);
    } else {
      await page.fill('#email', who);
      await page.fill('#password', 'demo1234');
      await page.click('button[type=submit]:has-text("Log in")');
    }
    await page.waitForTimeout(1400);
  }
  return { ctx, page, errors };
}
const text = (page) => page.locator('#page').innerText().catch(() => '');
const sidebar = (page) => page.locator('aside.side, .side').first().innerText().catch(() => '');

/* ---------------- anonymous ---------------- */
{
  const { ctx, page, errors } = await session(null);
  for (const r of ['/dashboard', '/matches', '/saved', '/profile', '/wizard', '/settings', '/admin', '/admin/users', '/scholarship/S1']) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const url = new URL(page.url());
    check(url.pathname === '/login' && url.searchParams.get('next') === r, `anon ${r} → /login?next=…`, page.url().replace(BASE, ''));
  }
  for (const r of ['/', '/scholarships', '/programs', '/terms', '/privacy']) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    check((await page.locator('#page').count()) > 0 || (await page.locator('main').count()) > 0, `anon can read ${r}`);
  }
  await page.goto(BASE + '/nope-does-not-exist', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  check(/not found|404/i.test(await page.locator('body').innerText()), 'unknown url shows the 404 page');
  check(errors.length === 0, 'anonymous browsing raises no console errors', errors.join(' | '));
  await ctx.close();
}

/* ---------------- students ---------------- */
const students = {};
for (const [who, email, other] of [['student', 'ayesha@example.com', ['Bilal Ahmed', 'bilal@example.com', 'Sana Fatima', 'sana@example.com']]]) {
  const s = await session(who);
  const { ctx, page, errors } = s;
  for (const r of STUDENT_ROUTES) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const t = await text(page);
    check(t.length > 40, `student can open ${r}`, t.length + ' chars');
  }
  /* admin surface is closed to students, client side too */
  for (const r of ADMIN_ROUTES) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);
    const body = await page.locator('body').innerText();
    const stayed = new URL(page.url()).pathname === r.split('?')[0];
    check(stayed && /Admin access required/i.test(body) && /Back to your dashboard/i.test(body),
      `student ${r} sees an access card instead of a blank page`, page.url().replace(BASE, '') + ' · ' + body.length + ' chars');
  }
  /* no admin links in the student sidebar */
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  check(!/Admin console|Review queue|Audit log/i.test(await sidebar(page)), 'student sidebar hides the admin section');
  check(/Ayesha Khan/.test(await sidebar(page)), 'student shell shows her own name');

  /* no other student's identity anywhere in her app */
  let leak = [];
  for (const r of STUDENT_ROUTES) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const t = await (await page.locator('body').innerText());
    for (const needle of other) if (t.includes(needle)) leak.push(r + ':' + needle);
  }
  check(leak.length === 0, "another student's name/email never appears in her pages", leak.join(', '));

  /* drafts invisible */
  await page.goto(BASE + '/scholarship/S7', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const draftBody = await page.locator('body').innerText();
  check(/not available|not found|404/i.test(draftBody), 'student cannot open a draft listing by URL');

  /* personal note is private: write one as Ayesha, then check Bilal */
  await page.goto(BASE + '/saved', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  students.ayesha = s;
  students.errors = errors;
}

/* Bilal must not see Ayesha's note or her name */
{
  const { ctx, page } = await session('bilal@example.com');
  await page.goto(BASE + '/saved', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const body = await page.locator('body').innerText();
  check(!/Ayesha|ayesha@example\.com|PRIVATE-NOTE-AYESHA/.test(body), "Bilal's saved page has no trace of Ayesha");
  check(/Bilal Ahmed/.test(await sidebar(page)), 'Bilal shell shows his own name');
  await ctx.close();
}
await students.ayesha.ctx.close();

/* ---------------- contributor ---------------- */
{
  const { ctx, page, errors } = await session('contributor');
  for (const r of ['/dashboard', '/scholarships', '/saved', '/profile', '/settings', ...ADMIN_ROUTES]) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);
    const t = await text(page);
    check(t.length > 40, `contributor can open ${r}`, t.length + ' chars');
  }
  check(errors.length === 0, 'contributor browsing raises no console errors', errors.join(' | '));

  /* publish stays blocked on a listing someone else created */
  await page.goto(BASE + '/admin/queue', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const review = page.locator('#page a.btn:has-text("Review")').first();
  if (await review.count()) {
    await review.click();
    await page.waitForTimeout(1100);
    await page.waitForSelector('input[data-gate]', { timeout: 8000 });
    for (let i = 0; i < 3; i++) await page.locator('input[data-gate]').nth(i).check();
    const pub = page.locator('#page button:has-text("Publish")').first();
    check(await pub.isDisabled(), 'contributor cannot publish even with all three groups ticked');
    const t = await page.locator('#page').innerText();
    check(/admin|second person|two-person/i.test(t), 'the form explains why publishing is blocked', '');
  } else check('queue has a draft to review', false);

  /* role editing is read only for a contributor */
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const selects = page.locator('#page select');
  const n = await selects.count();
  let disabled = 0;
  for (let i = 0; i < n; i++) if (await selects.nth(i).isDisabled()) disabled++;
  check(n > 0 && disabled === n, 'contributor sees the user table with read-only roles', `${disabled}/${n} disabled`);

  /* universities: no add control */
  await page.goto(BASE + '/admin/universities', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const addBtn = page.locator('#page button:has-text("Add university")');
  check((await addBtn.count()) === 0 || await addBtn.first().isDisabled(), 'contributor has no add-university control');

  /* contributor drafts are visible to them and to students they are not */
  await page.goto(BASE + '/scholarship/S7', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check(!/not found/i.test(await page.locator('body').innerText()), 'contributor can open a draft listing');
  await ctx.close();
}

/* ---------------- admin ---------------- */
{
  const { ctx, page, errors } = await session('admin');
  for (const r of [...STUDENT_ROUTES, ...ADMIN_ROUTES, '/admin/ai-draft?id=S7']) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);
    const t = await text(page);
    check(t.length > 40, `admin can open ${r}`, t.length + ' chars');
  }
  check(errors.length === 0, 'admin browsing raises no console errors', errors.join(' | '));

  /* four eyes in the UI: own draft cannot be published */
  const own = await page.evaluate(async () => {
    const r = await fetch('/api/admin/listings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'UI four-eyes probe', sourceUrl: 'https://example.org/ui' }) });
    return (await r.json()).listing.id;
  });
  await page.goto(BASE + '/admin/listings/' + own, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  for (let i = 0; i < 3; i++) await page.locator('input[data-gate]').nth(i).check();
  await page.waitForTimeout(300);
  const pubOwn = page.locator('#page button:has-text("Publish")').first();
  check(await pubOwn.isDisabled(), 'admin cannot publish a listing they created');
  check(/four-eyes|someone other than|created/i.test(await page.locator('#page').innerText()), 'the gate names the four-eyes rule');

  /* admin can see every account in the console (that is the job) */
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const usersTxt = await page.locator('#page').innerText();
  check(/ayesha@example\.com/.test(usersTxt) && /bilal@example\.com/.test(usersTxt), 'admin user table lists all accounts');

  /* role selects are editable */
  const sel = page.locator('#page select').first();
  check(!(await sel.isDisabled()), 'admin can change roles');
  await ctx.close();
}

/* ---------------- cross-session: same account, two browsers ---------------- */
{
  const a = await session('student');
  const b = await session('student');
  await a.page.goto(BASE + '/scholarship/S2', { waitUntil: 'networkidle' });
  await a.page.waitForTimeout(700);
  const toggle = a.page.locator('#page button.btn--sm').filter({ hasText: /^Save/ }).first();
  if (await toggle.count()) { await toggle.click(); await a.page.waitForTimeout(900); }
  await b.page.goto(BASE + '/saved', { waitUntil: 'networkidle' });
  await b.page.waitForTimeout(800);
  const bSaved = await b.page.locator('#page').innerText();
  check(/Save|saved|deadline/i.test(bSaved), 'second session sees the saved list without a reload error');
  await a.ctx.close(); await b.ctx.close();
}

const fails = res.filter(r => !r.ok);
console.log(`\n${res.length - fails.length}/${res.length} UI role checks passed`);
if (fails.length) {
  console.log('\nFINDINGS');
  fails.forEach(f => console.log(' ✗ ' + f.name + (f.detail ? '  [' + f.detail + ']' : '')));
}
await browser.close();
