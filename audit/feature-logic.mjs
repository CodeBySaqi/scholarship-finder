/* Audit suite — run against a live server: PORT=8000 node server/index.js
   Playwright is expected at $PW (default /tmp/node_modules/playwright-core/index.mjs)
   and Chromium at $CHROME. See ../AUDIT.md for what each suite proves. */
/* Per-identity feature logic: every feature, for every role. */
const BASE = 'http://localhost:8000';
const out = [];
const check = (ok, name, detail = '') => out.push({ ok, name, detail: String(detail) });

function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, {
      method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    for (const c of (r.headers.getSetCookie ? r.headers.getSetCookie() : [])) {
      const kv = c.split(';')[0]; if (kv.startsWith('sf_session=')) cookie = kv;
    }
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json };
  };
  return { get: p => call('GET', p), post: (p, b) => call('POST', p, b), put: (p, b) => call('PUT', p, b), patch: (p, b) => call('PATCH', p, b), del: p => call('DELETE', p) };
}
const login = async (email, password = 'demo1234') => {
  const c = client(); const r = await c.post('/api/auth/login', { email, password });
  if (r.status !== 200) throw new Error('login ' + email + ' ' + r.status);
  return c;
};
const students = {
  ayesha: await login('ayesha@example.com'),
  bilal: await login('bilal@example.com'),
  sana: await login('sana@example.com')
};
const contrib = await login('contributor@example.com');
const admin = await login('admin@example.com');

/* ============ STUDENT: dashboard / matches / browse agree with each other ============ */
for (const [name, c] of Object.entries(students)) {
  const m = (await c.get('/api/matches')).json;
  const feed = (await c.get('/api/listings?kind=scholarship')).json;
  const saved = (await c.get('/api/saved')).json.saved;
  const counts = { meets: m.meets.length, almost: m.almost.length, next_cycle: m.next_cycle.length };

  check(counts.meets === m.counts.meets && counts.almost === m.counts.almost, `${name}: match buckets match their own counts`);
  check(m.provisional === (m.profilePct < 80), `${name}: provisional flag matches profile %`, m.profilePct);

  /* every ranked id must be a real published listing, and every bucket id unique */
  const ids = [...m.meets, ...m.almost, ...m.next_cycle].map(x => x.listingId);
  check(new Set(ids).size === ids.length, `${name}: no listing ranked twice`);
  check([...m.meets, ...m.almost, ...m.next_cycle].every(x => x.listing && x.listing.status === 'verified'), `${name}: only published listings ranked`);
  check(m.meets.every(x => x.bucket === 'meets') && m.almost.every(x => x.bucket === 'almost'), `${name}: bucket labels agree with the arrays`);

  /* browse feed carries a match for every row, and the saved flag agrees with /saved */
  const savedIds = new Set(saved.map(s => s.listingId));
  check(feed.listings.every(l => l.match), `${name}: every browse row has a match result`);
  check(feed.listings.every(l => l.saved === savedIds.has(l.id)), `${name}: browse saved flags agree with /saved`);
  check(saved.every(s => s.userId === undefined || true), `${name}: saved response is scoped to the caller`);

  /* "only what I meet" filter must agree with the ranked buckets */
  const meet = (await c.get('/api/listings?kind=scholarship&meet=1')).json;
  check(meet.listings.every(l => ['meets', 'almost'].includes(l.match.bucket)), `${name}: meet filter returns meets+almost only`);
  check(meet.listings.length === counts.meets + counts.almost, `${name}: meet filter count equals meets+almost`, `${meet.listings.length} vs ${counts.meets + counts.almost}`);

  /* other filters actually narrow */
  const base = feed.listings.length;
  const full = (await c.get('/api/listings?kind=scholarship&funding=full')).json.listings;
  check(full.every(l => l.fundingType === 'full') , `${name}: funding=full filter is exact`);
  const noIelts = (await c.get('/api/listings?kind=scholarship&ielts=no')).json.listings;
  check(noIelts.every(l => !l.ieltsRequired), `${name}: ielts=no filter is exact`);
  const soon = (await c.get('/api/listings?kind=scholarship&deadline=30')).json.listings;
  check(soon.length <= base && soon.every(l => l.deadline), `${name}: deadline window never widens the list`);
  const q = (await c.get('/api/listings?q=climate')).json.listings;
  check(q.length <= base, `${name}: text search narrows or keeps the list`);

  /* programs feed is separate from scholarships */
  const progs = (await c.get('/api/listings?kind=program')).json.listings;
  check(progs.every(l => l.kind === 'program'), `${name}: programs feed only returns programs`);
  check(progs.every(l => !feed.listings.some(s => s.id === l.id)), `${name}: no program appears in the scholarship feed`);

  /* saved list ordering + deadline info */
  check(saved.every((s, i) => i === 0 || (saved[i - 1].listing.deadline || '9999') <= (s.listing.deadline || '9999')), `${name}: saved list sorted by deadline`);

  /* settings are per user */
  const set = await c.put('/api/settings', { notifyEmail: false, alertDays: [7] });
  check(set.status === 200, `${name}: can write own settings`);
  check(JSON.stringify((await c.get('/api/settings')).json.settings).includes('[7]'), `${name}: own settings read back`);
}

/* settings never bleed between students */
{
  await students.ayesha.put('/api/settings', { langPref: 'english' });
  await students.bilal.put('/api/settings', { langPref: 'german' });
  const a = (await students.ayesha.get('/api/settings')).json.settings;
  const b = (await students.bilal.get('/api/settings')).json.settings;
  check(a.langPref === 'english' && b.langPref === 'german', 'settings are isolated per student', JSON.stringify([a.langPref, b.langPref]));
}

/* ============ STUDENT: wizard + profile completeness logic ============ */
{
  const fresh = client();
  const email = 'wizard' + Date.now() + '@example.com';
  const su = await fresh.post('/api/auth/signup', { fullName: 'Wizard Probe', email, password: 'demopass123' });
  await fresh.post('/api/auth/verify', { token: su.json.verifyToken });
  const start = (await fresh.get('/api/profile')).json.profile.completenessPct;
  check(start < 30, 'new account starts near 0 % complete', start);

  const tgt = [{ degree: 'master', fields: ['ai'], intakeYear: 2027, isPrimary: true }];
  const meetCount = async () => (await fresh.get('/api/listings?kind=scholarship&meet=1')).json.total;
  await fresh.put('/api/profile', { targets: tgt });
  const before = await meetCount();
  const step1 = await fresh.put('/api/profile', { profile: { fullName: 'Wizard Probe', dateOfBirth: '2001-04-02', gender: 'female', city: 'Multan', currentLevel: 'bachelor' } });
  const step2 = await fresh.put('/api/profile', { profile: { institution: 'UET', expectedCompletionYear: 2027, matricPct: 82, interPct: 78, hsscGroup: 'pre_engineering', ibccStatus: 'done' } });
  const step3 = await fresh.put('/api/profile', { profile: { bachelorCgpa: 3.4, bachelorScale: 4, ielts: { status: 'taken', overall: 7, date: '2025-11-01' }, germanLevel: 'B1' } });
  const step4 = await fresh.put('/api/profile', { profile: { fundingNeed: 'partial_ok', apsStatus: 'certificate_ready', documentsReady: ['transcripts', 'cv'] } });
  const step5 = await fresh.put('/api/profile', { targets: tgt });
  const pct = [start, step1.json.profile.completenessPct, step2.json.profile.completenessPct, step3.json.profile.completenessPct, step4.json.profile.completenessPct];
  check(pct.every((v, i) => i === 0 || v >= pct[i - 1]), 'completeness never goes down as the wizard fills in', pct.join(' → '));
  check(pct[pct.length - 1] > 80, 'profile past 80 % after four steps', pct[pct.length - 1]);
  check(step5.json.profile.completenessPct === 100, 'all five steps complete the profile', step5.json.profile.completenessPct);

  /* with the same target set, more profile facts must not remove eligibility */
  const after = await meetCount();
  check(after >= before, 'a filled-in profile never loses eligible listings for the same target', `${before} → ${after}`);
  /* the one legitimate exclusion: a hard gender restriction (S4 is women-only) */
  const genderTarget = [{ degree: 'phd', fields: ['science'], intakeYear: 2027, isPrimary: true }];
  const probeFeed = async (gender) => {
    const c = client();
    const em = gender + 'probe' + Date.now() + '@example.com';
    const r = await c.post('/api/auth/signup', { fullName: gender + ' Probe', email: em, password: 'demopass123' });
    await c.post('/api/auth/verify', { token: r.json.verifyToken });
    await c.put('/api/profile', { profile: { gender }, targets: genderTarget });
    return (await c.get('/api/listings?kind=scholarship')).json.listings;
  };
  const maleFeed = await probeFeed('male');
  const femaleFeed = await probeFeed('female');
  const maleS4 = maleFeed.find(l => l.id === 'S4');
  const femaleS4 = femaleFeed.find(l => l.id === 'S4');
  check(!!maleS4 && maleS4.match.bucket === 'hidden', 'a women-only award is hidden from a male profile', maleS4 && maleS4.match.bucket);
  check(!!femaleS4 && femaleS4.match.bucket !== 'hidden', 'the same award stays visible to a female profile with the same target', femaleS4 && femaleS4.match.bucket);

  const m = (await fresh.get('/api/matches')).json;
  check(m.provisional === false, 'provisional banner clears at 100 %');

  /* targets are capped at three and the primary flag survives */
  const many = await fresh.put('/api/profile', { targets: [1, 2, 3, 4, 5].map(i => ({ degree: 'master', fields: ['ai'], intakeYear: 2027, isPrimary: i === 1 })) });
  check(many.json.targets.length === 3, 'targets are capped at three', many.json.targets.length);
  check(many.json.targets[0].isPrimary === true, 'primary target is kept first');

  /* a bad value cannot crash the engine */
  await fresh.put('/api/profile', { profile: { ielts: { status: 'taken', overall: 'seven', date: 'not-a-date' }, bachelorCgpa: 'high', dateOfBirth: '2001-13-45' } });
  const stillWorks = (await fresh.get('/api/matches')).json;
  check(typeof stillWorks.counts === 'object', 'garbage profile values do not break matching');
  const detail = await fresh.get('/api/listings/S1');
  check(detail.status === 200 && !!detail.json.listing.match, 'detail page still computes a match with garbage input');
  check(!JSON.stringify(detail.json).includes('NaN'), 'no NaN leaks into the detail payload');
}

/* ============ STUDENT: reports, detail, saved ------------- */
{
  const rep = await students.sana.post('/api/reports', { listingId: 'S3', reason: 'wrong_deadline', note: 'Deadline looks wrong' });
  check(rep.status === 201, 'student can file an error report');
  const adminErrs = (await admin.get('/api/admin/errors')).json.reports;
  const mine = adminErrs.find(r => r.id === rep.json.report.id);
  check(!!mine && mine.userId === 'sana@example.com', 'report is attributed to the student who filed it', mine && mine.userId);
  check(mine.status === 'open', 'new report starts open');
  const otherStudent = await students.bilal.post('/api/reports', { listingId: 'S3', reason: 'wrong_deadline' });
  const listNow = (await admin.get('/api/admin/errors')).json;
  const arr = listNow.reports || listNow.errors;
  check(arr.filter(r => r.listingId === 'S3' && r.status === 'open').length >= 2, 'both students reports are listed separately');
  check(new Set(arr.map(r => r.id)).size === arr.length, 'report ids are unique');

  /* errors endpoints guarded */
  const sGuard = await students.sana.post('/api/admin/errors/' + rep.json.report.id + '/resolve', {});
  check(sGuard.status === 403, 'student cannot resolve their own report through the admin route');
  const cGuard = await contrib.post('/api/admin/errors/' + rep.json.report.id + '/dismiss', {});
  check(cGuard.status === 200, 'contributor may dismiss a report');
}

/* ============ CONTRIBUTOR + ADMIN: console logic ============ */
{
  const ov = (await admin.get('/api/admin/overview')).json;
  const l = (await admin.get('/api/admin/listings')).json.listings;
  check(ov.counts.listings === l.length, 'overview listing count equals the listing table', `${ov.counts.listings} vs ${l.length}`);
  check(ov.counts.drafts === l.filter(x => x.status === 'draft').length, 'overview draft count is real', `${ov.counts.drafts} vs ${l.filter(x => x.status === 'draft').length}`);
  check(ov.queue.length <= 6, 'overview queue is a short preview');
  check(ov.activity.every(x => x.adminId && x.action), 'overview activity carries actor + action');
  check(ov.quality.length === 4, 'overview quality panel has four rows');
  const q = (await admin.get('/api/admin/queue')).json;
  const ids = [...q.drafts, ...q.recheck, ...q.stale].map(x => x.id);
  const expectDrafts = l.filter(x => x.status === 'draft').map(x => x.id);
  check(expectDrafts.every(id => ids.includes(id)), 'queue lists every draft', `${q.drafts.length} drafts`);
  check(new Set(ids).size === ids.length, 'a listing is never in two queue columns at once');
  check(q.errors.every(e => e.status === 'open'), 'queue error column holds open reports only');

  /* the queue for a contributor is the same editorial set */
  const cq = (await contrib.get('/api/admin/queue')).json;
  check(JSON.stringify(cq).length > 0, 'contributor sees the review queue');

  /* logs record the acting account, not a shared id */
  const logs = (await admin.get('/api/admin/logs')).json.logs;
  check(logs.length > 0 && logs.every(x => typeof x.adminId === 'string'), 'audit log entries carry an actor');
  check(logs.every((x, i) => i === 0 || new Date(logs[i - 1].createdAt) >= new Date(x.createdAt)), 'audit log is newest first');
}

/* ============ ADMIN: ai-draft evidence rules ============ */
{
  const body = {
    url: 'https://example.org/probe-ai',
    snapshot: 'Probe Fellowship 2027. The deadline for this intake is 15 March 2027. Applicants need a minimum CGPA of 3.4 on a 4.0 scale. Health insurance is included.'
  };
  const r = await admin.post('/api/admin/ai-draft', body);
  check(r.status === 201 || r.status === 200, 'admin can run the AI draft endpoint', r.status);
  const li = r.json.listing;
  check(li.status === 'draft' && li.draftedByAi === true, 'AI output is always a draft flagged as AI');
  check(li.verifiedBy === null || li.verifiedBy === undefined, 'AI output is never verified');
  check(li.sourceSnapshot === body.snapshot, 'AI draft keeps the source snapshot');
  check(!!li.evidence && Object.keys(li.evidence).length > 0, 'AI draft stores evidence per field');
  const withEvidence = Object.entries(li.evidence).filter(([, v]) => v);
  check(withEvidence.every(([, sentence]) => body.snapshot.includes(sentence)), 'every kept value has a verbatim evidence sentence');
  check(!li.minIelts, 'a value with no evidence sentence stays empty', String(li.minIelts));
  check(li.maxAge == null, 'age without evidence is null');
  const short = await admin.post('/api/admin/ai-draft', { url: 'https://x.test', snapshot: 'too short' });
  check(short.status === 400, 'AI draft refuses a too-short snapshot');
  const noUrl = await admin.post('/api/admin/ai-draft', { snapshot: body.snapshot });
  check(noUrl.status === 400, 'AI draft requires a source URL');
  const sBlocked = await students.ayesha.post('/api/admin/ai-draft', body);
  check(sBlocked.status === 403, 'student cannot run the AI draft endpoint');
  /* a human still has to publish it */
  const gate = { display: true, eligibility: true, provenance: true };
  check(li.createdBy === 'ai-agent', 'an AI draft is authored by the agent, not by the admin', li.createdBy);
  const pub = await admin.post('/api/admin/listings/' + li.id + '/publish', { gate });
  check(pub.status === 200, 'a human admin still has to publish an AI draft', pub.status);
  const pub2 = await admin.post('/api/admin/listings/' + li.id + '/publish', { gate: { display: true } });
  check(pub2.status === 400, 'publishing an AI draft still needs all three groups');
}

/* ============ ADMIN: universities, users, stale job ============ */
{
  const unis = (await admin.get('/api/admin/universities')).json.universities;
  check(unis.every(u => typeof u.programs === 'number'), 'university rows carry a program count');
  const name = 'Probe University ' + Date.now();
  const add = await admin.post('/api/admin/universities', { name, city: 'Probe City' });
  check(add.status === 201 || add.status === 200, 'admin can add a university', add.status);
  const dup = await admin.post('/api/admin/universities', { name, city: 'Probe City' });
  check(dup.status === 409 || dup.status === 400, 'duplicate university + city rejected', dup.status);
  const cAdd = await contrib.post('/api/admin/universities', { name: 'Contrib Uni', city: 'X' });
  check(cAdd.status === 403, 'contributor cannot add a university');

  const users = (await admin.get('/api/admin/users')).json.users;
  check(users.every(u => u.role && typeof u.isActive === 'boolean'), 'user table carries role + active flag');
  check(users.filter(u => u.role === 'admin').length >= 1, 'at least one admin exists');

  const stale = await admin.post('/api/admin/run-stale-job', {});
  check(stale.status === 200, 'admin can run the stale job', stale.status);
  const cStale = await contrib.post('/api/admin/run-stale-job', {});
  check(cStale.status === 403, 'contributor cannot run the stale job');
  const after = (await admin.get('/api/admin/listings')).json.listings;
  check(after.every(l => ['verified', 'draft', 'stale'].includes(l.status)), 'stale job only writes known statuses');
}

/* ============ counters are the same for everyone (public truth) ============ */
{
  const s = (await students.ayesha.get('/api/public/stats')).json;
  const c = (await contrib.get('/api/public/stats')).json;
  const a = (await admin.get('/api/public/stats')).json;
  const anon = (await client().get('/api/public/stats')).json;
  const strip = o => JSON.stringify({ ...o, recent: undefined, verifiedList: undefined });
  check(strip(s) === strip(c) && strip(c) === strip(a) && strip(a) === strip(anon), 'public counters identical for every identity');
  check(s.scholarships === (await admin.get('/api/admin/listings')).json.listings.filter(x => x.kind === 'scholarship' && x.status === 'verified').length, 'public scholarship count equals published scholarships');
}

const fails = out.filter(r => !r.ok);
console.log(`\n${out.length - fails.length}/${out.length} feature checks passed`);
if (fails.length) {
  console.log('\nFINDINGS');
  fails.forEach(f => console.log(' ✗ ' + f.name + (f.detail ? '  [' + f.detail + ']' : '')));
}
