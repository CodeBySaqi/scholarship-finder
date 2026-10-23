/* Audit suite — every page, every role. Run against a live server.
   Playwright at $PW, Chromium at $CHROME. See ../AUDIT.md. */
const { chromium } = await import(process.env.PW || '/tmp/pw/node_modules/playwright-core/index.mjs');
const BASE = 'http://localhost:8000';
const CHROME = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1134/chrome-linux/chrome';
const routes = {
  public: ['/', '/terms', '/privacy', '/login', '/signup', '/verify-email', '/forgot-password', '/reset-sent', '/reset-password', '/nope'],
  student: ['/dashboard', '/matches', '/scholarships', '/programs', '/scholarship/S1', '/program/P1', '/saved', '/profile', '/wizard', '/wizard?step=2', '/wizard?step=3', '/wizard?step=4', '/wizard?step=5', '/settings', '/settings?tab=alerts', '/settings?tab=account', '/settings?tab=privacy'],
  admin: ['/admin', '/admin/listings', '/admin/listings/S1', '/admin/listings/new', '/admin/queue', '/admin/errors', '/admin/ai-draft', '/admin/universities', '/admin/users', '/admin/logs']
};
const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const findings = [];
for (const [role, list] of Object.entries(routes)) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  if (role !== 'public') {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.click(`button:has-text("Continue as demo ${role}")`);
    await page.waitForTimeout(1400);
  }
  for (const r of list) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const issues = await page.evaluate(() => {
      const out = [];
      /* duplicate ids */
      const seen = new Set();
      document.querySelectorAll('[id]').forEach(el => {
        if (seen.has(el.id)) out.push('dup-id:' + el.id); else seen.add(el.id);
      });
      /* form controls without an accessible name */
      document.querySelectorAll('input, select, textarea').forEach(el => {
        const id = el.id;
        const labelled = (id && document.querySelector(`label[for="${id}"]`)) || el.closest('label') || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('placeholder');
        if (!labelled) out.push('unlabelled:' + el.tagName.toLowerCase() + (id ? '#' + id : ''));
      });
      /* icon-only buttons with no name */
      document.querySelectorAll('button').forEach(el => {
        const name = (el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title');
        if (!name) out.push('nameless-button:' + (el.className || '').slice(0, 40));
      });
      /* links with no text */
      document.querySelectorAll('a').forEach(el => {
        const name = (el.innerText || '').trim() || el.getAttribute('aria-label') || el.querySelector('svg');
        if (!name) out.push('nameless-link:' + (el.getAttribute('href') || ''));
      });
      /* images without alt */
      document.querySelectorAll('img').forEach(el => { if (!el.hasAttribute('alt')) out.push('img-no-alt:' + el.src.slice(-40)); });
      /* tabbable check: any element with tabindex > 0 */
      document.querySelectorAll('[tabindex]').forEach(el => { if (Number(el.getAttribute('tabindex')) > 0) out.push('tabindex>0:' + el.className); });
      return [...new Set(out)];
    });
    issues.forEach(i => findings.push(`[${role}] ${r} — ${i}`));
  }
  await ctx.close();
}
await b.close();
console.log('a11y findings:', findings.length);
findings.slice(0, 60).forEach(f => console.log(f));
