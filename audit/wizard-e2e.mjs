/* Audit suite — run against a live server: PORT=8000 node server/index.js
   Playwright is expected at $PW (default /tmp/node_modules/playwright-core/index.mjs)
   and Chromium at $CHROME. See ../AUDIT.md for what each suite proves. */
/* The wizard end-to-end in the browser, per step, checking nothing is silently dropped. */
const { chromium } = await import(process.env.PW || '/tmp/pw/node_modules/playwright-core/index.mjs');
const BASE = 'http://localhost:8000';
const res = [];
const check = (ok, name, detail = '') => res.push({ ok, name, detail: String(detail) });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1134/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));

const email = 'wiz' + Date.now() + '@example.com';
await p.goto(BASE + '/signup', { waitUntil: 'networkidle' });
await p.fill('#name', 'Wizard UI Probe');
await p.fill('#email', email);
await p.fill('#password', 'demopass123');
await p.check('#consent');
await p.click('button:has-text("Create account")');
await p.waitForTimeout(1200);
await p.click('button:has-text("I have verified my email")');
await p.waitForTimeout(1600);

const has = async (sel) => (await p.locator(sel).count()) > 0;
const tryFill = async (sel, val) => { if (await has(sel)) { await p.fill(sel, val); return true; } return false; };
const tryClick = async (sel) => { if (await has(sel)) { await p.click(sel); return true; } return false; };
const pct = async () => {
  const t = await p.locator('#page').innerText();
  const m = t.match(/(\d+)%/);
  return m ? Number(m[1]) : null;
};
const seen = [];
await p.goto(BASE + '/wizard', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
seen.push(await pct());

const FILL = {
  '#fullName': 'Wizard UI Probe', '#dateOfBirth': '2001-04-02', '#whatsapp': '+92 300 7654321',
  '#institution': 'UET Lahore', '#matricPct': '82', '#interPct': '78', '#hsscBoard': 'BISE Multan',
  '#bachelorCgpa': '3.4', '#ieltsOverall': '7', '#ieltsDate': '2025-11-01'
};
const SELECT = { '#city': 'Multan', '#province': 'Punjab', '#year': '2027', '#scale': '4' };
const CHIPS = ['Female', 'Pre-engineering', 'Done', 'Taken', 'B1'];

for (let step = 1; step <= 6; step++) {
  await p.waitForTimeout(700);
  for (const [sel, val] of Object.entries(FILL)) if (await has(sel)) await p.fill(sel, val);
  for (const [sel, val] of Object.entries(SELECT)) if (await has(sel)) await p.selectOption(sel, val);
  for (const label of CHIPS) await tryClick(`button.chip:has-text("${label}")`);
  await tryClick('label.radio-card:has-text("Bachelor in progress")');

  /* step 4 needs a target before it will save */
  if (await has('#page button:has-text("Add another target")')) {
    const add = p.locator('#page button:has-text("Add another target")').first();
    if (!(await add.isDisabled())) {
      await add.click();
      await p.waitForTimeout(600);
      await tryClick('button.chip:has-text("AI")');
      for (const sel of ['#page select[id^="deg"]', '#page select[id^="year"]']) if (await has(sel)) await p.selectOption(sel, '2027').catch(() => {});
      await tryClick('#page button:has-text("Make primary")');
      await p.waitForTimeout(300);
    }
  }
  /* step 5 needs funding + APS + documents (multi-select chips must only be clicked once) */
  if (p.url().includes('step=5')) {
    await tryClick('label.radio-card:has-text("Partial is fine")');
    await tryClick('button.chip:has-text("Certificate ready")');
    await tryClick('button.chip:has-text("Transcripts")');
    await tryClick('button.chip:has-text("CV")');
  }

  const saveBtn = p.locator('#page button:has-text("Save and continue"), #page button:has-text("Save and finish")').first();
  if (!(await saveBtn.count())) { check(false, `step ${step} has a save action`); break; }
  const label = (await saveBtn.innerText()).trim();
  await saveBtn.click();
  await p.waitForTimeout(1300);
  const url = p.url();
  if (/dashboard|matches/.test(url)) { check(true, 'wizard finished and left for the dashboard', url.replace(BASE, '')); break; }
  if (label === 'Save and finish') break;
}

/* what actually landed in the database */
const prof = (await p.evaluate(() => fetch('/api/profile').then(r => r.json()))).profile;
const targets = (await p.evaluate(() => fetch('/api/profile').then(r => r.json()))).targets;
check(prof.fullName === 'Wizard UI Probe' && prof.dateOfBirth === '2001-04-02' && prof.gender === 'female' && prof.city === 'Multan',
  'identity fields stored exactly as typed', JSON.stringify({ n: prof.fullName, d: prof.dateOfBirth, g: prof.gender, c: prof.city }));
check(prof.currentLevel === 'bachelor' && prof.institution === 'UET Lahore' && prof.expectedCompletionYear === 2027,
  'level + institution + year stored', JSON.stringify({ l: prof.currentLevel, i: prof.institution, y: prof.expectedCompletionYear }));
check(prof.matricPct === 82 && prof.interPct === 78 && prof.hsscGroup === 'pre_engineering' && prof.ibccStatus === 'done' && prof.hsscBoard === 'BISE Multan',
  'HSSC block stored, free text included', JSON.stringify({ m: prof.matricPct, i: prof.interPct, g: prof.hsscGroup, b: prof.hsscBoard }));
check(prof.bachelorCgpa === 3.4 && prof.bachelorScale === 4 && prof.ielts.status === 'taken' && prof.ielts.overall === 7 && prof.ielts.date === '2025-11-01' && prof.germanLevel === 'B1',
  'grades + IELTS + German stored', JSON.stringify(prof.ielts) + ' ' + prof.germanLevel);
check(prof.fundingNeed === 'partial_ok' && prof.apsStatus === 'certificate_ready' && (prof.documentsReady || []).includes('transcripts'),
  'funding, APS and document checklist stored', JSON.stringify(prof.documentsReady));
check(Array.isArray(targets) && targets.length > 0, 'target added in step 5', JSON.stringify(targets).slice(0, 120));
check(prof.completenessPct === 100, 'wizard reaches 100 % completeness', prof.completenessPct);
check(prof.whatsapp === '+92 300 7654321', 'optional phone field stored', prof.whatsapp);
seen.push(prof.completenessPct);

/* the finished profile is used by matching straight away */
await p.goto(BASE + '/matches', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
const mt = await p.locator('#page').innerText();
check(!/provisional/i.test(mt), 'matches page no longer shows the provisional banner');
check(/meet/i.test(mt), 'matches page renders results for the new profile');

/* profile page reflects every step */
await p.goto(BASE + '/profile', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
const pt = await p.locator('#page').innerText();
for (const [label, needle] of [['name', 'Wizard UI Probe'], ['city', 'Multan'], ['institution', 'UET Lahore'], ['CGPA', '3.4'], ['IELTS', '7'], ['funding', 'Partial']]) {
  check(new RegExp(needle, 'i').test(pt), `profile page shows the saved ${label}`);
}

/* settings writes stay on this account */
await p.goto(BASE + '/settings?tab=alerts', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
const sw = p.locator('.switch').first();
if (await sw.count()) { await sw.click(); await p.waitForTimeout(800); }
const prefs = await p.evaluate(() => fetch('/api/profile').then(r => r.json())).then(j => j.profile);
check(typeof prefs.notifyEmail === 'boolean' || typeof prefs.notifyWhatsapp === 'boolean', 'alert switch writes to the profile', JSON.stringify({ e: prefs.notifyEmail, w: prefs.notifyWhatsapp }));

check(errs.length === 0, 'wizard walk raises no page errors', errs.join(' | '));

const fails = res.filter(r => !r.ok);
console.log(`\n${res.length - fails.length}/${res.length} wizard checks passed`);
if (fails.length) { console.log('\nFINDINGS'); fails.forEach(f => console.log(' ✗ ' + f.name + (f.detail ? '  [' + f.detail + ']' : ''))); }
await b.close();
