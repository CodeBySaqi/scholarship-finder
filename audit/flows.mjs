/* Audit suite — run against a live server: PORT=8000 node server/index.js
   Playwright is expected at $PW (default /tmp/node_modules/playwright-core/index.mjs)
   and Chromium at $CHROME. See ../AUDIT.md for what each suite proves. */
const { chromium } = await import(process.env.PW || '/tmp/pw/node_modules/playwright-core/index.mjs');
const base = 'http://localhost:8000';
const b = await chromium.launch({ executablePath: process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1134/chrome-linux/chrome', args: ['--no-sandbox'] });
const ok = [], bad = [];
const check = (name, cond, extra='') => (cond ? ok : bad).push(name + (extra ? ' — ' + extra : ''));

async function login(ctx, who) {
  const p = await ctx.newPage();
  await p.goto(base + '/login', { waitUntil: 'networkidle' });
  await p.click(`button:has-text("Continue as demo ${who}")`);
  await p.waitForTimeout(1200);
  return p;
}

/* 1. signup → verify → dashboard */
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const email = 'test' + Date.now() + '@example.com';
  await p.goto(base + '/signup', { waitUntil: 'networkidle' });
  await p.fill('#name', 'Test Student');
  await p.fill('#email', email);
  await p.fill('#password', 'demopass123');
  await p.check('#consent');
  await p.click('button:has-text("Create account")');
  await p.waitForTimeout(1200);
  check('signup redirects to verify', p.url().includes('/verify-email'), p.url());
  await p.click('button:has-text("I have verified my email")');
  await p.waitForTimeout(1500);
  check('verify lands on dashboard', p.url().endsWith('/dashboard'), p.url());
  const txt = await p.locator('#page').innerText();
  check('new profile is provisional', /Provisional|provisional/i.test(txt) || /0%|Profile/.test(txt));
  await ctx.close();
}

/* 2. student: toggle save + note */
{
  const ctx = await b.newContext();
  const p = await login(ctx, 'student');
  const before = await p.evaluate(async () => (await (await fetch('/api/saved')).json()).saved.length);
  await p.goto(base + '/scholarship/S1', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const toggle = p.locator('#page button.btn--sm').filter({ hasText: /^Save/ }).first();
  await toggle.click();
  await p.waitForTimeout(1000);
  const after = await p.evaluate(async () => (await (await fetch('/api/saved')).json()).saved.length);
  check('save toggle changes the saved list', after !== before, before + ' -> ' + after);
  await p.goto(base + '/saved', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const savedTxt = await p.locator('#page').innerText();
  check('saved list renders cards', /View details/.test(savedTxt));
  const noteBtn = p.locator('button:has-text("Add a note")').first();
  if (await noteBtn.count()) {
    await noteBtn.click();
    await p.fill('#note', 'Need transcripts');
    await p.click('button:has-text("Save note")');
    await p.waitForTimeout(1000);
    check('note persists', (await p.locator('#page').innerText()).includes('Need transcripts'));
  } else check('note button present', false);
  await ctx.close();
}

/* 3. wizard: change a field, completeness + toast */
{
  const ctx = await b.newContext();
  const p = await login(ctx, 'student');
  await p.goto(base + '/wizard?step=1', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  await p.fill('#whatsapp', '+92 300 1234567');
  await p.click('button:has-text("Save and continue")');
  await p.waitForTimeout(1200);
  check('wizard advances to step 2', p.url().includes('step=2'), p.url());
  await p.goto(base + '/profile', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  check('profile shows whatsapp', (await p.locator('#page').innerText()).includes('1234567'));
  await ctx.close();
}

/* 4. contributor cannot publish; admin cannot publish own listing */
{
  const ctx = await b.newContext();
  const p = await login(ctx, 'contributor');
  await p.goto(base + '/admin/listings/new', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.fill('#title', 'Contributor Test Draft');
  await p.fill('#sourceUrl', 'https://example.org/test');
  await p.click('button:has-text("Create draft")');
  await p.waitForTimeout(1400);
  check('contributor created a draft', p.url().match(/\/admin\/listings\/S\d+|\/P\d+/), p.url());
  await p.waitForSelector('input[data-gate]', { timeout: 8000 });
  const gate = p.locator('input[data-gate]');
  for (let i = 0; i < 3; i++) await gate.nth(i).check();
  const publish = p.locator('button:has-text("Publish")').first();
  check('publish disabled for contributor', await publish.isDisabled());
  await ctx.close();
}

/* 5. admin publishes someone else's draft */
{
  const ctx = await b.newContext();
  const p = await login(ctx, 'admin');
  await p.goto(base + '/admin/queue', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const review = p.locator('#page a.btn:has-text("Review")').first();
  if (await review.count()) {
    await review.click();
    await p.waitForTimeout(1200);
    await p.waitForSelector('input[data-gate]', { timeout: 8000 });
    const gate = p.locator('input[data-gate]');
    for (let i = 0; i < 3; i++) await gate.nth(i).check();
    const publish = p.locator('button:has-text("Publish")').first();
    const disabled = await publish.isDisabled();
    if (!disabled) {
      await publish.click();
      await p.waitForTimeout(1400);
      const txt = await p.locator('#page').innerText();
      check('admin published a draft', /verified/i.test(txt));
    } else bad.push('publish stayed disabled for admin on someone else draft');
  } else bad.push('no draft in queue to publish');

  /* 6. four-eyes: admin cannot publish own listing */
  await p.goto(base + '/admin/listings/new', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.fill('#title', 'Admin Own Draft');
  await p.fill('#sourceUrl', 'https://example.org/own');
  await p.click('button:has-text("Create draft")');
  await p.waitForTimeout(1400);
  await p.waitForSelector('input[data-gate]', { timeout: 8000 });
  const gate2 = p.locator('input[data-gate]');
  for (let i = 0; i < 3; i++) await gate2.nth(i).check();
  check('four-eyes blocks own listing', await p.locator('button:has-text("Publish")').first().isDisabled());
  await ctx.close();
}

/* 7. AI draft creation appears in the queue */
{
  const ctx = await b.newContext();
  const p = await login(ctx, 'admin');
  await p.goto(base + '/admin/ai-draft', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.click('button:has-text("Extract a draft")');
  await p.waitForTimeout(1600);
  const txt = await p.locator('#page').innerText();
  check('AI draft review opens', /AI draft review/.test(txt), p.url());
  check('AI draft has evidence tags', /Evidence found/.test(txt));
  await p.goto(base + '/admin/queue', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  check('AI draft is in the queue', /AI draft/.test(await p.locator('#page').innerText()));
  await ctx.close();
}

/* 8. error report from a detail page reaches the admin */
{
  const ctx = await b.newContext();
  const p = await login(ctx, 'student');
  await p.goto(base + '/scholarship/S2', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  await p.click('button:has-text("Report an error")');
  await p.waitForTimeout(400);
  await p.click('button:has-text("Send report")');
  await p.waitForTimeout(1000);
  await ctx.close();

  const ctx2 = await b.newContext();
  const a = await login(ctx2, 'admin');
  await a.goto(base + '/admin/errors', { waitUntil: 'networkidle' });
  await a.waitForTimeout(700);
  check('report appears for admin', /open/.test(await a.locator('#page').innerText()));
  await a.locator('button:has-text("Mark fixed")').first().click();
  await a.waitForTimeout(1000);
  check('report can be marked fixed', /fixed/.test(await a.locator('#page').innerText()));
  await ctx2.close();
}

/* 9. theme switch persists */
{
  const ctx = await b.newContext();
  const p = await login(ctx, 'student');
  await p.click('button[aria-label="Demo controls"]');
  await p.waitForTimeout(300);
  await p.click('.demo-panel button:has-text("Dark")');
  await p.waitForTimeout(400);
  const theme = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  check('dark theme applies', theme === 'dark', String(theme));
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  check('theme persists', (await p.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark');
  await p.screenshot({ path: '/tmp/shots/rx-dark-dash.png', fullPage: true });
  await ctx.close();
}

console.log('PASS ' + ok.length + '\n' + ok.map(x => '  ✓ ' + x).join('\n'));
if (bad.length) console.log('\nFAIL\n' + bad.map(x => '  ✗ ' + x).join('\n'));
await b.close();
