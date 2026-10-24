/* AI research feature — end-to-end probe against a running server.
   Checks the paths the UI suite never touches:
     1. auth (student / contributor / anonymous must be refused)
     2. extract mode from pasted notes
     3. extract mode from a REAL url fetch (network + HTML strip)
     4. provider mode with no key configured
     5. provider mode with a bad key — must fall back, not 500
     6. save-as-draft can never publish, and lands in the queue
     7. settings: the key is masked, admin-only, and never echoed
   Run: node audit/research-check.mjs [baseUrl]
*/
const API = process.argv[2] || 'http://localhost:8000';

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
};

const jar = {};
async function call(path, { method = 'GET', body, as, raw = false } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (as && jar[as]) headers.cookie = jar[as];
  const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  for (const c of sc) { const kv = c.split(';')[0]; if (kv.startsWith('sf_session=')) jar[as] = kv; }
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html or empty */ }
  return { status: r.status, json, text, raw };
}

async function login(who, email) {
  const r = await call('/api/auth/login', { method: 'POST', body: { email, password: 'demo1234' }, as: who });
  return r.status === 200;
}

await login('admin', 'admin@example.com');
await login('student', 'ayesha@example.com');
await login('contributor', 'contributor@example.com');

/* ---------------------------------------------------------------- 1. auth */
{
  const anon = await call('/api/admin/research', { method: 'POST', body: { kind: 'scholarship', notes: 'x' } });
  ok('anonymous cannot run research', anon.status === 401, 'HTTP ' + anon.status);
  const stud = await call('/api/admin/research', { method: 'POST', body: { kind: 'scholarship', notes: 'x' }, as: 'student' });
  ok('a student is refused (403)', stud.status === 403, 'HTTP ' + stud.status);
  /* policy: contributors curate listings and the admin nav shows them AI research,
     so running it is allowed — but they must never see the key (checked below). */
  const contr = await call('/api/admin/research', { method: 'POST', body: { kind: 'scholarship', notes: 'The Contributor Test Fund closes on 2 February 2028.' }, as: 'contributor' });
  ok('a contributor may run research (allowed by design)', contr.status === 200, 'HTTP ' + contr.status);
  const cs = await call('/api/admin/settings', { as: 'contributor' });
  const cset = (cs.json || {}).settings || {};
  ok('but a contributor never sees the key, its state or its hint',
    !cset.aiApiKey && !cset.aiApiKeyHint && cset.aiApiKeySet === false,
    'set=' + cset.aiApiKeySet + ' hint="' + cset.aiApiKeyHint + '"');
  const sett = await call('/api/admin/settings', { as: 'student' });
  ok('the AI key is invisible to students (403 on settings)', sett.status === 403, 'HTTP ' + sett.status);
}

/* ------------------------------------------------- 2. extract from notes */
let notesRun;
{
  notesRun = await call('/api/admin/research', {
    method: 'POST', as: 'admin',
    body: {
      kind: 'scholarship',
      notes: 'The Example Foundation scholarship is fully funded. The application deadline is 30 September 2027. ' +
        'A minimum CGPA of 3.2/4 is required and IELTS 6.5 overall is required. Applicants must be under 30.'
    }
  });
  const f = notesRun.json && notesRun.json.fields;
  ok('extract: notes run succeeds', notesRun.status === 200, 'HTTP ' + notesRun.status);
  ok('extract: reports which engine ran', !!(notesRun.json && notesRun.json.provider), notesRun.json && notesRun.json.provider);
  ok('extract: deadline parsed', f && f.deadline === '2027-09-30', f && f.deadline);
  ok('extract: minCgpa parsed', f && f.minCgpa === 3.2, f && String(f.minCgpa));
  ok('extract: minIelts parsed', f && f.minIelts === 6.5, f && String(f.minIelts));
  ok('extract: maxAge parsed', f && f.maxAge === 30, f && String(f.maxAge));
  ok('extract: evidence kept for the fields it filled',
    !!(notesRun.json && notesRun.json.evidence), notesRun.json && Object.keys(notesRun.json.evidence || {}).join(', '));
  ok('extract: warnings tell the admin what to check',
    !!(notesRun.json && Array.isArray(notesRun.json.warnings)), notesRun.json && (notesRun.json.warnings || []).length + ' warnings');
}

/* --------------------------------------------------- 3. extract from a URL */
{
  const run = await call('/api/admin/research', {
    method: 'POST', as: 'admin',
    body: { kind: 'scholarship', url: 'https://www.daad.de/en/study-and-research-in-germany/scholarships/' }
  });
  const j = run.json || {};
  ok('url: a real page is fetched without crashing', run.status === 200, 'HTTP ' + run.status);
  ok('url: the engine says what it used', !!j.provider, j.provider);
  ok('url: the fetch either produced fields or explained itself',
    Object.keys(j.fields || {}).length > 0 || (j.warnings || []).length > 0,
    'fields=' + Object.keys(j.fields || {}).length + ' warnings=' + (j.warnings || []).length);
  console.log('     ↳ url mode detail:', String((j.warnings || [])[0] || 'no warnings').slice(0, 140));
}

/* ------------------------------------------------ 4. no key configured */
const settingsBody = (await call('/api/admin/settings', { as: 'admin' })).json;
const before = settingsBody.settings || settingsBody;
ok('settings: key state is reported, the key itself is not', before.aiApiKeySet === false || before.aiApiKeySet === true,
  'aiApiKeySet=' + before.aiApiKeySet + ' hint="' + before.aiApiKeyHint + '" raw="' + before.aiApiKey + '"');
ok('settings: the raw key is never sent to the browser', !before.aiApiKey, JSON.stringify(before.aiApiKey));
ok('settings: research can be switched on and off', typeof before.researchEnabled === 'boolean', String(before.researchEnabled));

/* ------------------------------------- 5. a bad key must fall back, not 500 */
{
  await call('/api/admin/settings', {
    method: 'PUT', as: 'admin',
    body: { aiApiKey: 'sk-invalid-key-for-the-fallback-test', aiProvider: 'openai', aiBaseUrl: 'https://api.openai.com/v1' }
  });
  const masked = (await call('/api/admin/settings', { as: 'admin' })).json;
  const s = masked.settings || masked;
  ok('a stored key comes back masked', s.aiApiKeySet === true && /…/.test(s.aiApiKeyHint) && !s.aiApiKey,
    s.aiApiKeyHint);

  const run = await call('/api/admin/research', {
    method: 'POST', as: 'admin',
    body: {
      kind: 'scholarship',
      notes: 'The Bad Key Foundation scholarship pays 900 EUR per month. The deadline is 15 January 2028. IELTS 6.0 is required.'
    }
  });
  const j = run.json || {};
  ok('a failing provider does not 500 the request', run.status === 200, 'HTTP ' + run.status);
  ok('it falls back to the deterministic extractor', /extract/.test(String(j.provider)), j.provider);
  ok('the admin is told the provider failed and why',
    (j.warnings || []).some(w => /provider failed/i.test(w)), (j.warnings || [])[0]);
  ok('the fallback still returns usable fields', j.fields && j.fields.deadline === '2028-01-15', j.fields && j.fields.deadline);

  /* restore: forget the test key */
  const cleared = await call('/api/admin/settings', { method: 'PUT', as: 'admin', body: { aiApiKey: null } });
  const c = (cleared.json && cleared.json.settings) || cleared.json || {};
  ok('the test key can be removed again', c.aiApiKeySet === false, String(c.aiApiKeySet));
}

/* ------------------------------------------- 6. save as draft, never publish */
{
  const run = await call('/api/admin/research', {
    method: 'POST', as: 'admin',
    body: { kind: 'program', notes: 'M.Sc. Data Engineering at Example University is taught in English. The deadline is 31 May 2027. There is no tuition fee.' }
  });
  const save = await call('/api/admin/research/save', { method: 'POST', as: 'admin', body: { kind: 'program', fields: run.json.fields, provider: run.json.provider } });
  const j = save.json || {};
  ok('save: a researched listing is created', save.status === 200 || save.status === 201, 'HTTP ' + save.status);
  ok('save: it is a draft, never published', j.listing && j.listing.status === 'draft', j.listing && j.listing.status);
  ok('save: it is tagged as AI-drafted', j.listing && j.listing.draftedByAi === true, String(j.listing && j.listing.draftedByAi));

  const all = (await call('/api/admin/listings', { as: 'admin' })).json.listings;
  const draft = all.find(l => l.id === (j.listing && j.listing.id));
  ok('save: it appears in the listing queue as a draft', !!draft && draft.status === 'draft', draft && draft.id + ' / ' + draft.status);
  const visible = (await call('/api/listings?kind=program')).json;
  const pub = (visible.listings || visible).some(l => l.id === (j.listing && j.listing.id));
  ok('save: students cannot see it before approval', !pub, pub ? 'LEAKED' : 'not public');

  /* try to sneak it in as published */
  const sneaky = await call('/api/admin/research/save', {
    method: 'POST', as: 'admin',
    body: { kind: 'program', fields: { ...run.json.fields, status: 'verified' }, provider: run.json.provider }
  });
  const sl = sneaky.json && sneaky.json.listing;
  ok('save: a status sent by the client is ignored (stays draft)', sl && sl.status === 'draft', sl && sl.status);
}

/* ------------------------------- 6a. the phrasings official pages really use
   Every one of these failed before the extractor was widened: the verb "close"
   without the -s, a single-digit day, "not BE older than", "30 or under". */
{
  const cases = [
    ['Applications close on 2 February 2028. Candidates must not be older than 28.', '2028-02-02', 28],
    ['Applications close on 15 January 2028. Candidates must not be older than 28.', '2028-01-15', 28],
    ['Applications are accepted until 31 May 2027. Applicants must be 30 or under.', '2027-05-31', 30],
    ['Submit by 1 March 2028. Maximum age of 32 applies.', '2028-03-01', 32],
    ['The closing date is 15 July 2027. Candidates aged 25-30 qualify.', '2027-07-15', 30]
  ];
  for (const [text, deadline, age] of cases) {
    const r = await call('/api/admin/research', { method: 'POST', as: 'admin', body: { kind: 'scholarship', notes: text } });
    const f = (r.json || {}).fields || {};
    ok('extract: ' + JSON.stringify(text.slice(0, 44)) + '…',
      f.deadline === deadline && f.maxAge === age,
      'deadline=' + f.deadline + ' maxAge=' + f.maxAge);
  }
}

/* ------------------------------- 6b. the key hint is admin-only, by role */
{
  const asContributor = await call('/api/admin/settings', { as: 'contributor' });
  const cs = (asContributor.json || {}).settings || {};
  ok('a contributor gets no key state and no hint',
    cs.aiApiKeySet === false && !cs.aiApiKeyHint && !cs.aiApiKey,
    'aiApiKeySet=' + cs.aiApiKeySet + ' hint="' + cs.aiApiKeyHint + '"');
  ok('a contributor still reads the site name', typeof cs.siteName === 'string' && cs.siteName.length > 0, cs.siteName);
  ok('a contributor cannot change settings (403 on PUT)',
    (await call('/api/admin/settings', { method: 'PUT', as: 'contributor', body: { siteName: 'Hacked' } })).status === 403);
}

/* --------------------------------------------------------- 7. audit trail */
{
  const logs = (await call('/api/admin/logs', { as: 'admin' })).json.logs || [];
  ok('audit: research runs are logged', logs.some(l => /research run/.test(l.action)), logs.slice(0, 3).map(l => l.action).join(', '));
  ok('audit: draft inserts are logged', logs.some(l => l.action === 'insert_draft'), logs.filter(l => l.action === 'insert_draft').length + ' entries');
}

console.log('\n' + results.filter(r => r.pass).length + '/' + results.length + ' research checks passed');
process.exit(results.every(r => r.pass) ? 0 : 1);
