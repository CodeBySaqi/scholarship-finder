/* Audit suite — run against a live server: PORT=8000 node server/index.js
   Playwright is expected at $PW (default /tmp/node_modules/playwright-core/index.mjs)
   and Chromium at $CHROME. See ../AUDIT.md for what each suite proves. */
/* Identity × endpoint matrix + cross-user isolation invariants. */
const BASE = 'http://localhost:8000';
const results = [];
const push = (ok, name, detail) => results.push({ ok, name, detail: detail === undefined ? '' : String(detail) });

/* ---- tiny cookie jar client ---- */
function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual'
    });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    for (const c of sc) { const kv = c.split(';')[0]; if (kv.startsWith('sf_session=')) cookie = kv; }
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json, headers: r.headers };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b),
    put: (p, b) => call('PUT', p, b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p) => call('DELETE', p),
    get cookie() { return cookie; },
    set cookie(v) { cookie = v; }
  };
}
async function login(email, password = 'demo1234') {
  const c = client();
  const r = await c.post('/api/auth/login', { email, password });
  if (r.status !== 200) throw new Error('login failed for ' + email + ': ' + r.status + ' ' + JSON.stringify(r.json));
  return c;
}

const anon = client();
const ayesha = await login('ayesha@example.com');
const bilal = await login('bilal@example.com');
const sana = await login('sana@example.com');
const contrib = await login('contributor@example.com');
const admin = await login('admin@example.com');

/* ============ 1. anonymous: only public surface ============ */
const anonExpect = [
  ['GET', '/api/public/stats', 200], ['GET', '/api/listings', 200], ['GET', '/api/listings/S1', 200],
  ['GET', '/api/auth/me', 200],
  ['GET', '/api/profile', 401], ['GET', '/api/matches', 401], ['GET', '/api/saved', 401],
  ['GET', '/api/settings', 401], ['POST', '/api/saved', 401], ['POST', '/api/reports', 401],
  ['GET', '/api/admin/overview', 401], ['GET', '/api/admin/listings', 401], ['GET', '/api/admin/users', 401],
  ['GET', '/api/admin/logs', 401], ['POST', '/api/admin/listings', 401], ['POST', '/api/admin/ai-draft', 401]
];
for (const [m, p, want] of anonExpect) {
  const r = await anon[m.toLowerCase()](p);
  push(r.status === want, `anon ${m} ${p} → ${r.status}`, `expected ${want}`);
}
push((await anon.get('/api/auth/me')).json?.user === null, 'anon /auth/me returns null user');

/* ============ 2. student: own data only, no admin surface ============ */
for (const [m, p] of [['post', '/api/admin/listings'], ['post', '/api/admin/listings/S7/publish'], ['post', '/api/admin/ai-draft'], ['post', '/api/admin/run-stale-job'], ['get', '/api/admin/users'], ['get', '/api/admin/queue'], ['get', '/api/admin/errors'], ['put', '/api/admin/users/u-bilal'], ['post', '/api/admin/universities'], ['post', '/api/admin/listings/S7/mark-verified']]) {
  const r = await ayesha[m](p, { title: 'x', url: 'https://x.test', snapshot: 'x'.repeat(60), gate: { display: true, eligibility: true, provenance: true }, role: 'admin', name: 'Hack', city: 'X' });
  push(r.status === 403, `student ${m.toUpperCase()} ${p} → ${r.status}`, 'expected 403');
}
for (const p of ['/api/profile', '/api/matches', '/api/saved', '/api/settings', '/api/auth/me']) {
  const r = await ayesha.get(p);
  push(r.status === 200, `student GET ${p} → ${r.status}`, 'expected 200');
}

/* ============ 3. saved-list isolation ============ */
{
  await bilal.del('/api/saved/S2');
  await ayesha.post('/api/saved', { listingId: 'S2' });
  const aList = (await ayesha.get('/api/saved')).json.saved;
  const bList = (await bilal.get('/api/saved')).json.saved;
  push(aList.some(r => r.listingId === 'S2'), 'Ayesha sees her own save (S2)');
  push(!bList.some(r => r.listingId === 'S2' && r.userId.includes('ayesha')), 'Bilal does not see Ayesha save');
  push(bList.every(r => !/ayesha/.test(r.userId)), 'Bilal saved rows carry no Ayesha userId');

  await ayesha.patch('/api/saved/S2', { note: 'Ayesha private note' });
  await bilal.post('/api/saved', { listingId: 'S2' });
  await bilal.patch('/api/saved/S2', { note: 'Bilal private note' });
  const aNote = (await ayesha.get('/api/saved')).json.saved.find(r => r.listingId === 'S2')?.note;
  const bNote = (await bilal.get('/api/saved')).json.saved.find(r => r.listingId === 'S2')?.note;
  push(aNote === 'Ayesha private note', 'Ayesha note unchanged by Bilal write', aNote);
  push(bNote === 'Bilal private note', 'Bilal keeps his own note', bNote);

  /* Ayesha deleting must not delete Bilal's row */
  await ayesha.del('/api/saved/S2');
  const bAfter = (await bilal.get('/api/saved')).json.saved;
  push(bAfter.some(r => r.listingId === 'S2'), 'Ayesha delete leaves Bilal row intact');
  await bilal.del('/api/saved/S2');
}

/* ============ 4. profile isolation ============ */
{
  const bBefore = (await bilal.get('/api/profile')).json.profile;
  await ayesha.put('/api/profile', { profile: { city: 'Ayesha-City', whatsapp: '+92 300 1111111', completenessPct: 100 } });
  const bAfter = (await bilal.get('/api/profile')).json.profile;
  const aAfter = (await ayesha.get('/api/profile')).json.profile;
  push(bAfter.city === bBefore.city && bAfter.whatsapp === bBefore.whatsapp, 'Ayesha profile write does not touch Bilal');
  push(aAfter.city === 'Ayesha-City', 'Ayesha profile write applied to herself');
  const recomputed = aAfter.completenessPct;
  push(recomputed < 100, 'client cannot fake completenessPct', 'stored ' + recomputed);
  const b2 = (await bilal.get('/api/profile')).json.profile;
  push(!JSON.stringify(b2).includes('Ayesha-City'), 'Bilal profile JSON has no Ayesha data');
}

/* ============ 5. draft visibility (never leaks to students) ============ */
{
  const dAdmin = (await admin.get('/api/admin/listings/S7')).json.listing;
  push(!!dAdmin, 'admin can read draft S7');
  const sView = await ayesha.get('/api/listings/S7');
  push(sView.status === 404, 'student GET draft S7 → ' + sView.status, 'expected 404');
  const sList = (await ayesha.get('/api/listings')).json.listings;
  push(sList.every(l => l.status === 'verified'), 'student listing feed only shows verified');
  const cList = (await contrib.get('/api/listings')).json.listings;
  push(cList.some(l => l.status !== 'verified'), 'contributor feed includes drafts');

  /* can a student smuggle a draft into their saved list and read it there? */
  await ayesha.post('/api/saved', { listingId: 'S7' });
  const saved = (await ayesha.get('/api/saved')).json.saved;
  const leak = saved.find(r => r.listingId === 'S7');
  push(!leak, 'draft cannot be pulled into a student saved list', leak ? 'LEAKED ' + JSON.stringify(leak.listing && leak.listing.title) : '');
  await ayesha.del('/api/saved/S7');

  /* matches must not rank drafts */
  const m = (await ayesha.get('/api/matches')).json;
  const allIds = [...m.meets, ...m.almost, ...m.next_cycle].map(x => x.listingId);
  const draftIds = (await admin.get('/api/admin/listings')).json.listings.filter(l => l.status === 'draft').map(l => l.id);
  push(!allIds.some(id => draftIds.includes(id)), 'student matches never include drafts', allIds.filter(id => draftIds.includes(id)).join(','));

  /* reports on a draft */
  const rep = await ayesha.post('/api/reports', { listingId: 'S7', reason: 'wrong_deadline', note: 'probe' });
  push(rep.status === 404, 'student cannot report an unpublished draft → ' + rep.status);
}

/* ============ 6. author / verifier emails must not reach students ============ */
{
  const l = (await ayesha.get('/api/listings/S1')).json.listing;
  const bad = ['createdBy', 'verifiedBy', 'evidence', 'sourceSnapshot'].filter(k => l[k] !== undefined);
  push(bad.length === 0, 'student listing payload hides admin-only fields', bad.join(','));
  const feed = (await ayesha.get('/api/listings')).json.listings;
  const badFeed = [...new Set(feed.flatMap(l => ['createdBy', 'verifiedBy', 'evidence'].filter(k => l[k] !== undefined)))];
  push(badFeed.length === 0, 'student listing feed hides admin-only fields', badFeed.join(','));
  push(!JSON.stringify(feed).includes('@example.com'), 'student feed contains no account emails');
}

/* ============ 7. contributor: admin-lite but cannot publish / administer ============ */
{
  const r = await contrib.post('/api/admin/listings', { title: 'Contrib isolation probe', sourceUrl: 'https://example.org/probe' });
  push(r.status === 201, 'contributor can create a draft → ' + r.status);
  const id = r.json.listing.id;
  const gate = { display: true, eligibility: true, provenance: true };
  const pub = await contrib.post(`/api/admin/listings/${id}/publish`, { gate });
  push(pub.status === 403, 'contributor cannot publish own draft → ' + pub.status);
  const flip = await contrib.put(`/api/admin/listings/${id}`, { status: 'verified' });
  push(flip.status === 403, 'contributor cannot set status=verified through PUT → ' + flip.status);
  for (const [m, p, body] of [
    ['post', `/api/admin/listings/${id}/mark-verified`, {}],
    ['post', '/api/admin/run-stale-job', {}],
    ['post', '/api/admin/universities', { name: 'Probe Uni', city: 'Probe City' }],
    ['put', '/api/admin/users/u-ayesha', { role: 'admin' }]
  ]) {
    const x = await contrib[m](p, body);
    push(x.status === 403, `contributor ${m.toUpperCase()} ${p} → ${x.status}`, 'expected 403');
  }
  for (const p of ['/api/admin/overview', '/api/admin/queue', '/api/admin/errors', '/api/admin/listings', '/api/admin/logs']) {
    const x = await contrib.get(p);
    push(x.status === 200, `contributor can read ${p} → ${x.status}`);
  }

  /* admin publishes the contributor's draft; contributor cannot re-verify their own edit afterwards */
  const pub2 = await admin.post(`/api/admin/listings/${id}/publish`, { gate });
  push(pub2.status === 200 && pub2.json.listing.status === 'verified', 'admin publishes contributor draft → ' + pub2.status);
  push(pub2.json.listing.verifiedBy === 'admin@example.com', 'publish records the verifier');
  const again = await admin.post(`/api/admin/listings/${id}/publish`, { gate });
  push(again.status === 400, 'double publish rejected → ' + again.status);
  const noGate = await admin.post(`/api/admin/listings/${id}/publish`, { gate: { display: true } });
  push(noGate.status === 400, 'publish without all three groups rejected → ' + noGate.status);
}

/* ============ 8. four eyes for the admin's own listing ============ */
{
  const r = await admin.post('/api/admin/listings', { title: 'Admin own probe', sourceUrl: 'https://example.org/own' });
  const id = r.json.listing.id;
  const gate = { display: true, eligibility: true, provenance: true };
  const p = await admin.post(`/api/admin/listings/${id}/publish`, { gate });
  push(p.status === 403 && /four-eyes/i.test(p.json.error || ''), 'four-eyes blocks admin publishing own draft → ' + p.status, p.json && p.json.error);
  const verify = await admin.post(`/api/admin/listings/${id}/mark-verified`, {});
  push(verify.status === 400, 'mark-verified cannot publish a draft (no gate bypass) → ' + verify.status, JSON.stringify(verify.json && verify.json.error));
  const verifiedOne = (await admin.get('/api/admin/listings')).json.listings.find(x => x.status === 'verified');
  const refresh = await admin.post('/api/admin/listings/' + verifiedOne.id + '/mark-verified', {});
  push(refresh.status === 200, 'mark-verified refreshes an already published listing → ' + refresh.status);
}

/* ============ 9. users & roles administration ============ */
{
  const list = (await admin.get('/api/admin/users')).json.users;
  push(list.length >= 5, 'admin sees the user table (' + list.length + ')');
  push(list.every(u => !('passwordHash' in u) && !('resetToken' in u)), 'user table never exposes hashes or tokens');
  const self = await admin.put('/api/admin/users/u-admin', { role: 'student' });
  push(self.status >= 400, 'admin cannot demote the last admin → ' + self.status, JSON.stringify(self.json && self.json.error));
  if (self.status === 200) await admin.put('/api/admin/users/u-admin', { role: 'admin' });

  const promo = await ayesha.put('/api/admin/users/u-ayesha', { role: 'admin' });
  push(promo.status === 403, 'student cannot promote self → ' + promo.status);
  const after = (await ayesha.get('/api/auth/me')).json.user;
  push(after.role === 'student', 'student role unchanged after attempted promotion', after.role);

  /* deactivation must take effect immediately on an existing session */
  await admin.put('/api/admin/users/u-sana', { isActive: false });
  const sanaLive = await sana.get('/api/profile');
  push(sanaLive.status === 401, 'deactivated account loses its existing session → ' + sanaLive.status);
  const sanaLogin = await client().post('/api/auth/login', { email: 'sana@example.com', password: 'demo1234' });
  push(sanaLogin.status === 403, 'deactivated account cannot log back in → ' + sanaLogin.status);
  await admin.put('/api/admin/users/u-sana', { isActive: true });
  const sanaBack = await client().post('/api/auth/login', { email: 'sana@example.com', password: 'demo1234' });
  push(sanaBack.status === 200, 'reactivated account can log in again → ' + sanaBack.status);
}

/* ============ 10. session handling ============ */
{
  const c = await login('bilal@example.com');
  const good = c.cookie;
  const tampered = client(); tampered.cookie = good.slice(0, -2) + (good.endsWith('AA') ? 'BB' : 'AA');
  const t = await tampered.get('/api/profile');
  push(t.status === 401, 'tampered session cookie rejected → ' + t.status);

  /* forge a token for another user id using a guessed secret */
  const forged = client();
  const body = Buffer.from(JSON.stringify({ uid: 'u-admin', exp: Date.now() + 86400000 })).toString('base64url');
  forged.cookie = 'sf_session=' + body + '.' + 'x'.repeat(43);
  const f = await forged.get('/api/profile');
  push(f.status === 401, 'forged cookie rejected → ' + f.status);

  await c.post('/api/auth/logout');
  const replay = client(); replay.cookie = good;
  const rp = await replay.get('/api/profile');
  push(rp.status === 401, 'logout revokes the session token → ' + rp.status, rp.status === 200 ? 'token still accepted after logout' : '');
}

/* ============ 11. same user in two browsers sees the same data ============ */
{
  const again = await login('ayesha@example.com');
  const a = (await ayesha.get('/api/saved')).json.saved.map(r => r.listingId).sort();
  const b = (await again.get('/api/saved')).json.saved.map(r => r.listingId).sort();
  push(JSON.stringify(a) === JSON.stringify(b), 'same account, second session sees identical saved rows');
}

/* ---- report ---- */
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
if (fails.length) {
  console.log('\nFINDINGS');
  fails.forEach(f => console.log(' ✗ ' + f.name + (f.detail ? '  [' + f.detail + ']' : '')));
}
