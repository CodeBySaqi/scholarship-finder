/* Audit suite — every page, every role. Run against a live server.
   Playwright at $PW, Chromium at $CHROME. See ../AUDIT.md. */
/* Full page audit: runtime errors, bad values in the DOM, dead controls,
   broken internal links, layout overflow at three widths, and empty states. */
const { chromium } = await import(process.env.PW || '/tmp/pw/node_modules/playwright-core/index.mjs');
const BASE = 'http://localhost:8000';
const CHROME = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1134/chrome-linux/chrome';

const routes = [
  ['/', 'public'], ['/terms', 'public'], ['/privacy', 'public'],
  ['/login', 'public'], ['/signup', 'public'], ['/verify-email', 'public'], ['/forgot-password', 'public'],
  ['/reset-sent', 'public'], ['/reset-password', 'public'],
  ['/dashboard', 'student'], ['/matches', 'student'], ['/scholarships', 'student'], ['/programs', 'student'],
  ['/scholarship/S1', 'student'], ['/scholarship/S4', 'student'], ['/scholarship/S6', 'student'], ['/scholarship/S3', 'student'],
  ['/program/P1', 'student'], ['/program/P4', 'student'], ['/program/P7', 'student'],
  ['/saved', 'student'], ['/profile', 'student'], ['/wizard', 'student'],
  ['/wizard?step=2', 'student'], ['/wizard?step=3', 'student'], ['/wizard?step=4', 'student'], ['/wizard?step=5', 'student'],
  ['/settings', 'student'], ['/settings?tab=alerts', 'student'], ['/settings?tab=account', 'student'], ['/settings?tab=privacy', 'student'],
  ['/admin', 'admin'], ['/admin/listings', 'admin'], ['/admin/listings/S1', 'admin'], ['/admin/listings/new', 'admin'],
  ['/admin/queue', 'admin'], ['/admin/errors', 'admin'], ['/admin/ai-draft', 'admin'], ['/admin/ai-draft?id=S7', 'admin'],
  ['/admin/universities', 'admin'], ['/admin/users', 'admin'], ['/admin/logs', 'admin'],
  ['/nope', 'any']
];

const BAD = [/\bundefined\b/, /\bNaN\b/, /Invalid Date/, /\[object Object\]/, />null</, /\bTODO\b/, /\bFIXME\b/, /lorem ipsum/i, /\$\{/];
const findings = [];
const add = (kind, route, detail) => findings.push({ kind, route, detail: String(detail).slice(0, 300) });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

async function signIn(page, who) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  if (who === 'student') await page.click('button:has-text("Continue as demo student")');
  else if (who === 'admin') await page.click('button:has-text("Continue as demo admin")');
  else if (who === 'contributor') await page.click('button:has-text("Continue as demo contributor")');
  await page.waitForTimeout(1400);
}
const newPage = async (ctx) => {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  page.on('response', r => { if (r.status() >= 400 && r.url().includes('/api/')) errs.push('HTTP ' + r.status() + ' ' + r.url().replace(BASE, '')); });
  return { page, errs };
};

/* ---------------- pass 1: runtime + content + layout, per viewport ---------------- */
const contexts = {};
for (const who of ['public', 'student', 'admin']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const { page, errs } = await newPage(ctx);
  if (who !== 'public') await signIn(page, who);
  contexts[who] = { ctx, page, errs };
}

for (const [route, who] of routes) {
  const actual = who === 'any' ? 'student' : who;
  const { page, errs } = contexts[actual];
  errs.length = 0;
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  if (errs.length) errs.forEach(e => add('runtime', route, e));

  const info = await page.evaluate(() => {
    const main = document.querySelector('#page') || document.querySelector('main');
    const text = main ? main.innerText : '';
    const anchors = [...document.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href'), text: a.innerText.trim().slice(0, 40), target: a.target }));
    const buttons = [...document.querySelectorAll('button')].filter(b => !b.closest('.demo-panel'));
    return {
      textLength: text.length,
      text: text.slice(0, 400),
      anchors,
      buttons: buttons.length,
      disabledButtons: buttons.filter(b => b.disabled).length,
      html: main ? main.innerHTML : '',
      title: document.title,
      h1: [...document.querySelectorAll('h1')].map(h => h.innerText.trim()),
      imgs: [...document.querySelectorAll('img')].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src),
      emptyState: /nothing|no results|empty/i.test(text)
    };
  });

  if (info.textLength < 60) add('empty', route, info.textLength + ' chars: ' + info.text.replace(/\n+/g, ' | '));
  for (const re of BAD) { const m = info.html.match(re); if (m) add('badvalue', route, re + ' → ' + info.html.slice(Math.max(0, m.index - 80), m.index + 120).replace(/\s+/g, ' ')); }
  if (info.h1.length > 1) add('headings', route, info.h1.length + ' h1s: ' + info.h1.join(' / '));
  if (info.imgs.length) add('image', route, 'broken <img>: ' + info.imgs.join(', '));

  /* overflow at three widths */
  for (const w of [1280, 768, 375]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) add('overflow', route + ' @' + w, over + 'px');
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  /* every internal link must resolve to a real route */
  for (const a of info.anchors) {
    if (!a.href || a.href.startsWith('http') || a.href.startsWith('mailto') || a.href.startsWith('#')) continue;
    const path = a.href.split('#')[0];
    if (!path) continue;
    const known = await page.evaluate(async (p) => {
      try { const r = await fetch(p, { method: 'GET', headers: { accept: 'text/html' } }); return r.status; } catch { return 0; }
    }, path);
    if (known !== 200) add('link', route, `"${a.text}" → ${path} (${known})`);
  }
}

for (const k of Object.keys(contexts)) await contexts[k].ctx.close();

/* ---------------- pass 2: contributor view of every page ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const { page, errs } = await newPage(ctx);
  await signIn(page, 'contributor');
  for (const [route] of routes.filter(([, w]) => w !== 'public')) {
    errs.length = 0;
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    if (errs.length) errs.forEach(e => add('runtime:contributor', route, e));
    const len = await page.evaluate(() => ((document.querySelector('#page') || document.querySelector('main')) || {}).innerText?.length || 0);
    if (len < 60) add('empty:contributor', route, len + ' chars');
  }
  await ctx.close();
}

/* ---------------- pass 3: dark theme sweep ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const { page, errs } = await newPage(ctx);
  await signIn(page, 'student');
  await page.evaluate(() => { localStorage.setItem('sf-theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); });
  for (const [route] of routes) {
    errs.length = 0;
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    if (errs.length) errs.forEach(e => add('runtime:dark', route, e));
    const invisible = await page.evaluate(() => {
      const out = [];
      const dark = getComputedStyle(document.body).backgroundColor;
      document.querySelectorAll('#page .card, #page .tag, #page .btn, #page h1, #page .cap').forEach(el => {
        const cs = getComputedStyle(el);
        const c = cs.color;
        if (c === dark) out.push(el.className + ' text=' + c);
      });
      return out.slice(0, 3);
    });
    if (invisible.length) add('contrast:dark', route, invisible.join(' | '));
  }
  await ctx.close();
}

await browser.close();
const byKind = findings.reduce((m, f) => (m[f.kind] = (m[f.kind] || 0) + 1, m), {});
console.log('pages visited:', routes.length, '| viewports:', 3, '| findings:', findings.length, JSON.stringify(byKind));
for (const f of findings) console.log(`[${f.kind}] ${f.route} — ${f.detail}`);
