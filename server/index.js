/* ==========================================================================
   Scholarship Finder — Node + Express API
   Serves the built React app and a real JSON-backed API.
   Rules enforced here (not just in the UI): publish gate, roles, AI drafts,
   append-only audit log, freshness, matching.
   ========================================================================== */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, persist, nextId, log, initStore, storeInfo, closeStore } from './lib/store.js';
import { hashPassword, verifyPassword, signToken, readToken, parseCookies, COOKIE } from './lib/auth.js';
import { Match, resultsFor, matchOne, safeMatchOne, safeResultsFor, completeness } from './lib/matching.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '1mb' }));

/* ------------------------------------------------------------------ helpers */
const today = () => db().meta.today || new Date().toISOString().slice(0, 10);
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const pub = (u) => u && ({ id: u.id, email: u.email, displayName: u.displayName, role: u.role, emailVerified: u.emailVerified, isActive: u.isActive });

function currentUser(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  const payload = readToken(token);
  if (!payload) return null;
  const d = db();
  /* signed-out tokens are revoked one by one; a password reset bumps the epoch */
  if (Array.isArray(d.revokedTokens) && d.revokedTokens.some(t => t.sig === payload.sig && t.exp > Date.now())) return null;
  const user = d.users.find(u => u.id === payload.uid);
  if (!user || !user.isActive) return null;
  if ((payload.ep || 0) !== (user.sessionEpoch || 0)) return null;
  return user;
}
function requireUser(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Sign in to continue' });
  req.user = u; next();
}
function requireAdmin(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Sign in to continue' });
  if (u.role !== 'admin' && u.role !== 'contributor') return res.status(403).json({ error: 'Admins and contributors only' });
  req.user = u; next();
}
function requireStrictAdmin(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Sign in to continue' });
  if (u.role !== 'admin') return res.status(403).json({ error: 'Only an admin can do that' });
  req.user = u; next();
}
function setSession(res, user) {
  const token = signToken({ uid: user.id, ep: user.sessionEpoch || 0, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 });
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`);
}
/* Structural shape only — every *answer* starts empty so completeness is honest
   (a brand-new account must not look 37 % done because of prefilled defaults). */
const PROFILE_DEFAULTS = {
  fullName: '', firstName: '', city: '', province: '', nationality: 'PK',
  currentLevel: null, institution: '', bachelorScale: null, passMark: null,
  ielts: { status: null, overall: null, date: null },
  germanLevel: null, fundingNeed: null, apsStatus: null,
  documentsReady: [], targets: [], completenessPct: 0
};
/* ---------------------------------------------------------------- validation
   The wizard is the only writer, but the API is public surface: coerce and drop
   anything the engine cannot reason about instead of storing it. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const asDate = (v) => {
  if (v === null || v === '' || v === undefined) return null;
  const s = String(v).slice(0, 10);
  if (!ISO_DATE.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== s) return null;   /* rejects 2026-02-31 */
  return s;
};
const asNum = (v, min, max) => {
  if (v === null || v === '' || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
};
const asText = (v, max = 120) => (v === null || v === undefined ? null : String(v).trim().slice(0, max) || null);
const asEnum = (v, allowed) => (allowed.includes(v) ? v : null);
const asList = (v, max = 20) => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, max) : []);
const LEVELS = ['matric', 'intermediate', 'bachelor', 'master', 'phd'];
const GERMAN = ['none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const GENDERS = ['female', 'male', 'other', 'prefer_not_to_say'];
const FUNDING = ['full_only', 'partial_ok'];
const APS = ['not_started', 'applied', 'certificate_ready'];
const IBCC = ['not_done', 'planned', 'applied', 'done', 'not_needed'];
const IELTS_STATUS = ['taken', 'planned', 'not_taken'];

const PROFILE_RULES = {
  fullName: v => asText(v, 80), firstName: v => asText(v, 40), city: v => asText(v, 60),
  province: v => asText(v, 60), institution: v => asText(v, 120), whatsapp: v => asText(v, 30),
  hsscBoard: v => asText(v, 80), gender: v => asEnum(v, GENDERS),
  currentLevel: v => asEnum(v, LEVELS),
  germanLevel: v => {   /* the wizard uses A1…C1, people type a1 */
    if (v === null || v === undefined) return null;
    const raw = String(v).trim();
    if (/^none$/i.test(raw)) return 'none';
    const up = raw.toUpperCase();
    return GERMAN.includes(up) ? up : null;
  },
  fundingNeed: v => asEnum(v, FUNDING), apsStatus: v => asEnum(v, APS),
  ibccStatus: v => asEnum(v, IBCC), hsscGroup: v => asText(v, 40),
  incomeBracket: v => asEnum(v, ['low', 'lower_mid', 'mid', 'high', 'prefer_not_to_say']),
  hecStatus: v => asEnum(v, IBCC), dateOfBirth: asDate, ieltsDate: asDate,
  bachelorCgpa: v => asNum(v, 0, 10), bachelorScale: v => asNum(v, 1, 10),
  passMark: v => asNum(v, 0, 10), matricPct: v => asNum(v, 0, 100), interPct: v => asNum(v, 0, 100),
  expectedCompletionYear: v => asNum(v, 1990, 2100),
  documentsReady: v => asList(v, 20), hsscGroups: v => asList(v, 10),
  blockedAccountReady: v => (v === undefined ? undefined : !!v),
  studienkollegOk: v => (v === undefined ? undefined : !!v)
};
function sanitizeProfile(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.entries(raw).forEach(([k, v]) => {
    if (k === 'completenessPct' || k === 'key' || k === 'email') return;      /* server owns these */
    if (k === 'ielts') {
      const cur = v && typeof v === 'object' ? v : {};
      out.ielts = {
        status: asEnum(cur.status, IELTS_STATUS),
        overall: asNum(cur.overall, 0, 9),
        date: asDate(cur.date)
      };
      return;
    }
    const rule = PROFILE_RULES[k];
    out[k] = rule ? rule(v) : (typeof v === 'string' ? v.slice(0, 200) : v);
  });
  return out;
}
function sanitizeTargets(raw) {
  if (!Array.isArray(raw)) return null;
  return raw.slice(0, 3).filter(t => t && typeof t === 'object').map(t => ({
    degree: asEnum(t.degree, ['bachelor', 'master', 'phd']) || 'master',
    fields: asList(t.fields, 5).map(f => String(f).toLowerCase()),
    intakeYear: asNum(t.intakeYear, 1990, 2100) || 2027,
    isPrimary: !!t.isPrimary
  }));
}

function profileOf(userId) {
  const d = db();
  if (!d.profiles[userId]) d.profiles[userId] = {};
  const p = d.profiles[userId];
  let dirty = false;
  Object.keys(PROFILE_DEFAULTS).forEach(k => {
    if (p[k] === undefined) { p[k] = JSON.parse(JSON.stringify(PROFILE_DEFAULTS[k])); dirty = true; }
  });
  if (!p.ielts || typeof p.ielts !== 'object') { p.ielts = { status: null, overall: null, date: null }; dirty = true; }
  if (!Array.isArray(p.documentsReady)) { p.documentsReady = []; dirty = true; }
  if (!Array.isArray(p.targets)) { p.targets = []; dirty = true; }
  if (!p.firstName && p.fullName) { p.firstName = String(p.fullName).split(' ')[0]; dirty = true; }
  if (dirty) persist();
  return p;
}
function profileView(user) {
  const p = profileOf(user.id);
  const pct = completeness(p, p.targets || []);
  if (pct !== p.completenessPct) { p.completenessPct = pct; persist(); }
  return p;
}
const listingById = (id) => db().listings.find(l => l.id === id);
/* One person, one identity: compare accounts by every handle we might have stored
   (email, local part, id, display name) so "admin" and "admin@example.com" are the
   same actor for the four-eyes rule. */
function actorAliases(user) {
  const set = new Set();
  if (!user) return set;
  [user.email, user.id, user.displayName].filter(Boolean).forEach(v => set.add(String(v).toLowerCase()));
  if (user.email && user.email.includes('@')) set.add(user.email.split('@')[0].toLowerCase());
  return set;
}
const sameActor = (user, actor) => !!actor && actorAliases(user).has(String(actor).toLowerCase());
const isStaff = (user) => !!user && (user.role === 'admin' || user.role === 'contributor');
/* one rule for "may this identity see this listing at all" — used by every read path */
const isStale = (l) => !!l && Match.freshness(l.lastVerified, today()).state === 'stale';
/* published *and* not stale — a listing unverified for 180+ days leaves the student app */
const canSeeListing = (user, l) => !!l && ((l.status === 'verified' && !isStale(l)) || isStaff(user));
/* fields that only the editorial side may read (author, verifier, evidence trail) */
const ADMIN_ONLY_FIELDS = ['createdBy', 'verifiedBy', 'evidence', 'sourceSnapshot', 'draftedByAi'];
function publicListing(user, l) {
  if (!l) return l;
  if (isStaff(user)) return l;
  const out = { ...l };
  ADMIN_ONLY_FIELDS.forEach(k => { delete out[k]; });
  return out;
}

/* =================================================================== AUTH */
app.post('/api/auth/signup', (req, res) => {
  const { fullName, email, password } = req.body || {};
  if (!fullName || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (!EMAIL_RE.test(String(email).trim())) return res.status(400).json({ error: 'That email address is not valid' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Use at least 8 characters' });
  const d = db();
  if (d.users.some(u => u.email.toLowerCase() === String(email).toLowerCase()))
    return res.status(409).json({ error: 'That email already has an account' });
  const user = {
    id: nextId('u-', d.users),
    email: String(email).trim(),
    displayName: String(fullName).trim(),
    role: 'student',
    isActive: true,
    emailVerified: false,
    verifyToken: 'v' + Math.random().toString(36).slice(2, 10),
    passwordHash: hashPassword(String(password)),
    createdAt: new Date().toISOString(),
    lastLogin: null
  };
  d.users.push(user);
  d.profiles[user.id] = {
    fullName: user.displayName, firstName: user.displayName.split(' ')[0],
    email: user.email, nationality: 'PK', completenessPct: 0, targets: []
  };
  persist();
  // the prototype has no mail server: the verify link is returned so the flow is walkable
  res.json({ user: pub(user), verifyToken: user.verifyToken, verifyUrl: '/verify-email?token=' + user.verifyToken });
});

app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body || {};
  const d = db();
  const user = d.users.find(u => u.verifyToken && u.verifyToken === token);
  if (!user) return res.status(400).json({ error: 'That link is not valid any more' });
  user.emailVerified = true;
  delete user.verifyToken;
  persist();
  setSession(res, user);
  res.json({ user: pub(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const d = db();
  const user = d.users.find(u => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !verifyPassword(String(password || ''), user.passwordHash))
    return res.status(401).json({ error: 'Email or password is not correct' });
  if (!user.isActive) return res.status(403).json({ error: 'That account is deactivated' });
  if (!user.emailVerified) return res.status(403).json({ error: 'Verify your email first', verifyToken: user.verifyToken });
  user.lastLogin = new Date().toISOString();
  persist();
  setSession(res, user);
  res.json({ user: pub(user) });
});

app.post('/api/auth/logout', (req, res) => {
  const d = db();
  const token = parseCookies(req.headers.cookie)[COOKIE];
  const payload = readToken(token);
  if (payload) {
    if (!Array.isArray(d.revokedTokens)) d.revokedTokens = [];
    d.revokedTokens = d.revokedTokens.filter(t => t.exp > Date.now());
    d.revokedTokens.push({ sig: payload.sig, exp: payload.exp || Date.now() + 1000 * 60 * 60 * 24 * 14 });
    persist();
  }
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const u = currentUser(req);
  res.json({ user: u ? pub(u) : null });
});

app.post('/api/auth/forgot', (req, res) => {
  const d = db();
  const user = d.users.find(u => u.email.toLowerCase() === String((req.body || {}).email || '').toLowerCase());
  const token = 'r' + Math.random().toString(36).slice(2, 10);
  if (user) { user.resetToken = token; persist(); }
  res.json({ ok: true, resetUrl: user ? '/reset-password?token=' + token : null });
});

app.post('/api/auth/reset', (req, res) => {
  const { token, password } = req.body || {};
  if (String(password || '').length < 8) return res.status(400).json({ error: 'Use at least 8 characters' });
  const d = db();
  const user = d.users.find(u => u.resetToken && u.resetToken === token);
  if (!user) return res.status(400).json({ error: 'That reset link is not valid any more' });
  user.passwordHash = hashPassword(String(password));
  user.sessionEpoch = (user.sessionEpoch || 0) + 1; /* every old session stops working */
  delete user.resetToken;
  persist();
  res.json({ ok: true });
});

/* ================================================================ PROFILE */
app.get('/api/profile', requireUser, (req, res) => {
  res.json({ profile: profileView(req.user), targets: profileOf(req.user.id).targets || [] });
});

app.put('/api/profile', requireUser, (req, res) => {
  const p = profileOf(req.user.id);
  const raw = req.body && req.body.profile ? req.body.profile : (req.body || {});
  const patch = sanitizeProfile(raw);
  Object.assign(p, patch);
  if (!Array.isArray(p.targets)) p.targets = [];
  const targets = sanitizeTargets(req.body && req.body.targets);
  if (targets) p.targets = targets;
  p.completenessPct = completeness(p, p.targets);
  persist();
  res.json({ profile: p, targets: p.targets });
});

/* =============================================================== LISTINGS */
app.get('/api/listings', (req, res) => {
  const d = db();
  const { kind, q, degree, funding, deadline, ielts, verified, meet } = req.query;
  let list = d.listings.slice();
  if (kind) list = list.filter(l => l.kind === kind);

  const user = currentUser(req);
  /* one visibility rule for the feed too: published and not stale, or staff */
  if (!isStaff(user)) list = list.filter(l => canSeeListing(user, l));

  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter(l => [l.title, l.provider, l.fieldCategory, l.city, ...(l.degreeLevels || [])]
      .filter(Boolean).join(' ').toLowerCase().includes(needle));
  }
  if (degree) list = list.filter(l => (l.degreeLevels || []).includes(degree));
  if (funding === 'full') list = list.filter(l => l.fundingType === 'full');
  if (funding === 'partial') list = list.filter(l => l.fundingType !== 'full');
  if (ielts === 'no') list = list.filter(l => !l.ieltsRequired);
  if (verified === '1') list = list.filter(l => Match.freshness(l.lastVerified, today()).state === 'fresh');
  if (deadline) {
    const cap = Number(deadline);
    list = list.filter(l => {
      const days = Match.daysBetween(today(), l.deadline);
      return days >= 0 && days <= cap;
    });
  }
  const profile = user ? profileView(user) : null;
  const targets = user ? (profileOf(user.id).targets || []) : [];
  const savedIds = user ? db().saved.filter(s => s.userId === user.id).map(s => s.listingId) : [];
  let withMatch = list.map(l => ({
    ...publicListing(user, l),
    freshness: Match.freshness(l.lastVerified, today()),
    saved: savedIds.includes(l.id),
    ...(profile ? { match: safeMatchOne(profile, targets, l, today()) } : {})
  }));
  if (meet === '1' && profile) {
    withMatch = withMatch
      .filter(l => l.match && (l.match.bucket === 'meets' || l.match.bucket === 'almost'))
      .map(l => ({ ...l, matchBucket: l.match.bucket }));
  }
  const buckets = { meets: 0, almost: 0, next_cycle: 0 };
  withMatch.forEach(l => { if (l.matchBucket && buckets[l.matchBucket] !== undefined) buckets[l.matchBucket]++; });
  res.json({ listings: withMatch, total: withMatch.length, buckets });
});

app.get('/api/listings/:id', (req, res) => {
  const l = listingById(req.params.id);
  if (!l) return res.status(404).json({ error: 'Listing not found' });
  const user = currentUser(req);
  if (!canSeeListing(user, l)) return res.status(404).json({ error: 'Listing not found' });
  const uni = l.universityId ? db().universities.find(u => u.id === l.universityId) : null;
  const out = {
    ...publicListing(user, l),
    freshness: Match.freshness(l.lastVerified, today()),
    universityName: uni ? uni.name : null,
    universityCity: uni ? uni.city : null
  };
  if (user) {
    const p = profileView(user), t = profileOf(user.id).targets || [];
    out.match = safeMatchOne(p, t, l, today());
    out.saved = db().saved.some(s => s.userId === user.id && s.listingId === l.id);
  }
  res.json({ listing: out });
});

/* ================================================================ MATCHES */
app.get('/api/matches', requireUser, (req, res) => {
  const user = req.user;
  const p = profileView(user);
  const t = profileOf(user.id).targets || [];
  const kind = req.query.kind === 'programs' ? 'program' : 'scholarship';
  /* students are ranked against published listings only — drafts stay in the console */
  const pool = db().listings.filter(l => canSeeListing(user, l));
  const r = safeResultsFor(p, t, pool, today(), kind);
  const withListings = (arr) => arr.map(x => ({ ...x, listing: publicListing(user, listingById(x.listingId)) }));
  res.json({
    provisional: p.completenessPct < 80,
    profilePct: p.completenessPct,
    targets: t,
    meets: withListings(r.meets),
    almost: withListings(r.almost),
    next_cycle: withListings(r.next_cycle),
    counts: { meets: r.meets.length, almost: r.almost.length, next_cycle: r.next_cycle.length }
  });
});

/* ================================================================== SAVED */
app.get('/api/saved', requireUser, (req, res) => {
  const d = db();
  const rows = d.saved.filter(s => s.userId === req.user.id).map(s => ({
    ...s,
    listing: publicListing(req.user, listingById(s.listingId)),
    freshness: listingById(s.listingId) ? Match.freshness(listingById(s.listingId).lastVerified, today()) : null
  })).filter(r => r.listing && canSeeListing(req.user, r.listing))
    .sort((a, b) => (a.listing.deadline || '').localeCompare(b.listing.deadline || ''));
  res.json({ saved: rows });
});

app.post('/api/saved', requireUser, (req, res) => {
  const d = db();
  const { listingId, note } = req.body || {};
  const l = listingById(listingId);
  if (!canSeeListing(req.user, l)) return res.status(404).json({ error: 'Listing not found' });
  let row = d.saved.find(s => s.userId === req.user.id && s.listingId === listingId);
  if (row) { row.note = note || row.note; persist(); return res.json({ saved: row }); }
  row = { id: nextId('sv-', d.saved), userId: req.user.id, listingId, kind: l.kind, note: note || '', createdAt: new Date().toISOString() };
  d.saved.push(row); persist();
  res.status(201).json({ saved: row });
});

app.delete('/api/saved/:listingId', requireUser, (req, res) => {
  const d = db();
  const before = d.saved.length;
  d.saved = d.saved.filter(s => !(s.userId === req.user.id && s.listingId === req.params.listingId));
  persist();
  res.json({ removed: before - d.saved.length });
});

app.patch('/api/saved/:listingId', requireUser, (req, res) => {
  const d = db();
  const row = d.saved.find(s => s.userId === req.user.id && s.listingId === req.params.listingId);
  if (!row || !canSeeListing(req.user, listingById(req.params.listingId))) return res.status(404).json({ error: 'Not saved' });
  row.note = String((req.body || {}).note || '');
  persist();
  res.json({ saved: row });
});

/* =============================================================== SETTINGS */
app.get('/api/settings', requireUser, (req, res) => {
  const d = db();
  res.json({ settings: d.settings[req.user.id] || {} });
});
app.put('/api/settings', requireUser, (req, res) => {
  const d = db();
  d.settings[req.user.id] = Object.assign({}, d.settings[req.user.id] || {}, req.body || {});
  persist();
  res.json({ settings: d.settings[req.user.id] });
});

/* ================================================================ REPORTS */
app.post('/api/reports', requireUser, (req, res) => {
  const d = db();
  const { listingId, reason, note } = req.body || {};
  const l = listingById(listingId);
  if (!canSeeListing(req.user, l)) return res.status(404).json({ error: 'Listing not found' });
  if (!reason) return res.status(400).json({ error: 'Pick a reason' });
  const report = {
    id: nextId('er', d.errorReports), listingType: l.kind, listingId, reason,
    note: note || '', userId: req.user.email, status: 'open', createdAt: new Date().toISOString()
  };
  d.errorReports.unshift(report);
  l.openErrorReports = (l.openErrorReports || 0) + 1;
  persist();
  res.status(201).json({ report });
});

/* ================================================================== ADMIN */
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  const d = db();
  const t = today();
  const fresh = d.listings.filter(l => Match.freshness(l.lastVerified, t).state === 'fresh').length;
  const recheck = d.listings.filter(l => Match.freshness(l.lastVerified, t).state === 'recheck');
  const stale = d.listings.filter(l => Match.freshness(l.lastVerified, t).state === 'stale');
  const drafts = d.listings.filter(l => l.status === 'draft');
  const openReports = d.errorReports.filter(r => r.status === 'open');
  res.json({
    counts: {
      drafts: drafts.length, recheck: recheck.length, stale: stale.length,
      openReports: openReports.length, listings: d.listings.length, fresh
    },
    queue: drafts.concat(recheck, stale).slice(0, 6).map(l => ({
      id: l.id, title: l.title, status: l.status, createdBy: l.createdBy,
      age: Match.daysBetween(l.lastVerified, t), draftedByAi: !!l.draftedByAi
    })),
    activity: d.logs.slice(0, 6),
    quality: [
      { key: 'Verified in the last 30 days', value: fresh + ' of ' + d.listings.length },
      { key: 'Listings missing an apply URL', value: d.listings.filter(l => !l.applyUrl).length },
      { key: 'Listings with 2+ open reports', value: d.listings.filter(l => (l.openErrorReports || 0) >= 2).length },
      { key: 'AI drafts awaiting human review', value: d.listings.filter(l => l.draftedByAi && l.status === 'draft').length }
    ]
  });
});

app.get('/api/admin/listings', requireAdmin, (req, res) => {
  const d = db();
  const { q, status, kind } = req.query;
  let list = d.listings.slice();
  if (q) {
    const n = String(q).toLowerCase();
    list = list.filter(l => (l.title + ' ' + l.provider).toLowerCase().includes(n));
  }
  if (status) list = list.filter(l => l.status === status);
  if (kind) list = list.filter(l => l.kind === kind);
  res.json({
    listings: list.map(l => ({
      id: l.id, title: l.title, provider: l.provider, kind: l.kind,
      /* a published listing that has not been rechecked for 180+ days is stale, not "verified" */
      status: l.status === 'verified' && isStale(l) ? 'stale' : l.status,
      statusRaw: l.status,
      lastVerified: l.lastVerified, deadline: l.deadline, createdBy: l.createdBy,
      verifiedBy: l.verifiedBy, draftedByAi: !!l.draftedByAi, openErrorReports: l.openErrorReports || 0,
      freshness: Match.freshness(l.lastVerified, today())
    }))
  });
});

app.get('/api/admin/listings/:id', requireAdmin, (req, res) => {
  const l = listingById(req.params.id);
  if (!l) return res.status(404).json({ error: 'Listing not found' });
  res.json({ listing: l });
});

const EDITABLE = ['title', 'provider', 'kind', 'status', 'degreeLevels', 'fundingType', 'deadline', 'opensDate',
  'isAnnual', 'minCgpa', 'minPercentage', 'germanGradeCutoff', 'ieltsRequired', 'minIelts', 'maxAge',
  'allowedCountries', 'genderRestriction', 'maxIncomeBracket', 'minWorkExpMonths', 'requiredPriorFields',
  'requiredEcts', 'hsscEntryRoute', 'hsscGroups', 'applyUrl', 'officialUrl', 'sourceUrl', 'lastVerified',
  'apsRequired', 'minGermanLevel', 'tuitionPerSemester', 'semesterFee', 'languageMode', 'coverage',
  'description', 'applySteps', 'documents', 'evidence', 'fieldEvidence'];

app.post('/api/admin/listings', requireAdmin, (req, res) => {
  const d = db();
  const body = req.body || {};
  if (!body.title) return res.status(400).json({ error: 'A title is required' });
  const listing = {
    id: nextId(body.kind === 'program' ? 'P' : 'S', d.listings),
    kind: body.kind === 'program' ? 'program' : 'scholarship',
    status: 'draft',
    title: body.title,
    provider: body.provider || '',
    hostCountry: 'Germany',
    degreeLevels: body.degreeLevels || ['master'],
    fundingType: body.fundingType || 'full',
    lastVerified: today(),
    deadline: body.deadline || null,
    createdBy: req.user.email,
    verifiedBy: null,
    openErrorReports: 0,
    draftedByAi: false,
    evidence: body.evidence || {},
    updatedAt: new Date().toISOString()
  };
  EDITABLE.forEach(k => { if (body[k] !== undefined && listing[k] === undefined) listing[k] = body[k]; });
  d.listings.unshift(listing);
  log('insert_draft', { adminId: req.user.email, entityType: listing.kind, entityId: listing.id, detail: {} });
  persist();
  res.status(201).json({ listing });
});

app.put('/api/admin/listings/:id', requireAdmin, (req, res) => {
  const l = listingById(req.params.id);
  if (!l) return res.status(404).json({ error: 'Listing not found' });
  const body = req.body || {};
  // a contributor may not flip a listing to verified, and nothing may leave verified silently
  if (req.user.role !== 'admin' && body.status === 'verified' && l.status !== 'verified')
    return res.status(403).json({ error: 'Contributors cannot publish. Ask an admin.' });
  EDITABLE.forEach(k => { if (body[k] !== undefined) l[k] = body[k]; });
  l.updatedAt = new Date().toISOString();
  log('update', { adminId: req.user.email, entityType: l.kind, entityId: l.id, detail: { fields: Object.keys(body) } });
  persist();
  res.json({ listing: l });
});

/* Publish gate — three groups, admin role, four-eyes rule. Enforced server-side. */
app.post('/api/admin/listings/:id/publish', requireAdmin, (req, res) => {
  const l = listingById(req.params.id);
  if (!l) return res.status(404).json({ error: 'Listing not found' });
  const gate = (req.body || {}).gate || {};
  const groups = ['display', 'eligibility', 'provenance'];
  const missing = groups.filter(g => !gate[g]);
  if (missing.length) return res.status(400).json({ error: 'Review every group first (' + missing.join(', ') + ')' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only an admin can publish' });
  if (sameActor(req.user, l.createdBy)) return res.status(403).json({ error: 'Four-eyes rule: someone other than the creator must publish' });
  if (l.status === 'verified') return res.status(400).json({ error: 'Already published' });
  /* provenance: nothing reaches students without a title and the page it was read from */
  const noTitle = !l.title || !String(l.title).trim();
  const noSource = !l.sourceUrl && !l.officialUrl;
  if (noTitle || noSource) {
    return res.status(400).json({
      error: 'Cannot publish without ' + [noTitle && 'a title', noSource && 'a source URL'].filter(Boolean).join(' and ')
    });
  }
  l.status = 'verified';
  l.verifiedBy = req.user.email;
  l.lastVerified = today();
  l.draftedByAi = false;
  log('publish', { adminId: req.user.email, entityType: l.kind, entityId: l.id, detail: { gate } });
  persist();
  res.json({ listing: l });
});

/* AI draft: creates a DRAFT only. Never verifies, never sets status. */
app.post('/api/admin/ai-draft', requireAdmin, (req, res) => {
  const d = db();
  const { url, snapshot } = req.body || {};
  if (!url) return res.status(400).json({ error: 'A source URL is required' });
  const text = String(snapshot || '');
  if (text.length < 40) return res.status(400).json({ error: 'Paste the page text so every field can be tied to evidence' });
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const find = (re) => sentences.find(s => re.test(s)) || null;
  const ev = {
    title: find(/scholarship|grant|fellowship|programme|program/i),
    deadline: find(/deadline|closes|apply by/i),
    cgpa: find(/CGPA|GPA|grade point/i),
    ielts: find(/IELTS|English/i),
    age: find(/age|years old|younger than/i)
  };
  const pickNumber = (s, re) => { if (!s) return null; const m = s.match(re); return m ? Number(m[1].replace(',', '.')) : null; };
  const deadlineMatch = ev.deadline && ev.deadline.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const iso = deadlineMatch
    ? deadlineMatch[3] + '-' + String(MONTHS.indexOf(deadlineMatch[2].toLowerCase()) + 1).padStart(2, '0') + '-' + deadlineMatch[1].padStart(2, '0')
    : null;

  /* a field is only kept when its evidence sentence really is in the pasted text */
  const evidenceOk = (sentence) => sentence && text.includes(sentence);
  const listing = {
    id: nextId('S', d.listings),
    kind: 'scholarship',
    status: 'draft',
    title: (ev.title ? ev.title.replace(/[.!?]$/, '') : 'Untitled draft').slice(0, 90),
    provider: 'Extracted from ' + (() => { try { return new URL(url).hostname; } catch { return 'the source page'; } })(),
    hostCountry: 'Germany',
    degreeLevels: ['master'],
    fundingType: 'full',
    deadline: iso,
    lastVerified: today(),
    createdBy: 'ai-agent',
    verifiedBy: null,
    draftedByAi: true,
    openErrorReports: 0,
    applyUrl: url,
    officialUrl: url,
    sourceUrl: url,
    description: 'Draft created by the extraction agent. A human must check every field against the source before publishing.',
    minCgpa: evidenceOk(ev.cgpa) ? pickNumber(ev.cgpa, /(\d(?:\.\d+)?)\s*(?:\/\s*4|\s*CGPA)/i) : null,
    minIelts: evidenceOk(ev.ielts) ? pickNumber(ev.ielts, /(\d(?:\.\d)?)/) : null,
    maxAge: evidenceOk(ev.age) ? pickNumber(ev.age, /(\d{1,2})/) : null,
    sourceSnapshot: text.slice(0, 20000),
    evidence: Object.fromEntries(Object.entries(ev).filter(([, v]) => evidenceOk(v))),
    droppedFields: Object.entries(ev).filter(([, v]) => !evidenceOk(v)).map(([k]) => k),
    updatedAt: new Date().toISOString()
  };
  listing.ieltsRequired = listing.minIelts != null;
  d.listings.unshift(listing);
  log('insert_draft', { adminId: req.user.email, entityType: listing.kind, entityId: listing.id, detail: { via: 'ai_draft', url } });
  persist();
  res.status(201).json({ listing });
});

app.get('/api/admin/queue', requireAdmin, (req, res) => {
  const d = db();
  const t = today();
  res.json({
    drafts: d.listings.filter(l => l.status === 'draft').map(l => ({
      id: l.id, title: l.title, kind: l.kind, createdBy: l.createdBy, draftedByAi: !!l.draftedByAi,
      age: Match.daysBetween(l.lastVerified, t)
    })),
    recheck: d.listings.filter(l => Match.freshness(l.lastVerified, t).state === 'recheck').map(l => ({
      id: l.id, title: l.title, kind: l.kind, age: Match.daysBetween(l.lastVerified, t), openErrorReports: l.openErrorReports || 0
    })),
    stale: d.listings.filter(l => Match.freshness(l.lastVerified, t).state === 'stale').map(l => ({
      id: l.id, title: l.title, kind: l.kind, age: Match.daysBetween(l.lastVerified, t), status: l.status
    })),
    errors: d.errorReports.filter(r => r.status === 'open').map(r => ({
      ...r, listingTitle: (listingById(r.listingId) || {}).title || r.listingId
    }))
  });
});

app.post('/api/admin/listings/:id/mark-verified', requireStrictAdmin, (req, res) => {
  const l = listingById(req.params.id);
  if (!l) return res.status(404).json({ error: 'Listing not found' });
  /* A freshness refresh, not a publishing shortcut: anything that is not already
     published has to go through the publish gate (three groups + four eyes). */
  if (l.status === 'draft') {
    return res.status(400).json({ error: 'Drafts publish through the gate, not from here' });
  }
  if (!l.verifiedBy) {
    return res.status(400).json({ error: 'This listing has never been published - use the publish gate' });
  }
  const was = l.status;
  l.lastVerified = today();
  if (l.status === 'stale') l.status = 'verified';
  log('verify', { adminId: req.user.email, entityType: l.kind, entityId: l.id, detail: { from: was, to: l.status } });
  persist();
  res.json({ listing: l });
});

/* nightly-style job: 180+ days back to draft */
app.post('/api/admin/run-stale-job', requireStrictAdmin, (req, res) => {
  const d = db();
  const t = today();
  let moved = 0;
  d.listings.forEach(l => {
    if (Match.freshness(l.lastVerified, t).state === 'stale' && l.status === 'verified') {
      l.status = 'stale'; moved++;
      log('stale to draft', { adminId: 'system', entityType: l.kind, entityId: l.id, detail: {} });
    }
  });
  persist();
  res.json({ moved });
});

app.get('/api/admin/errors', requireAdmin, (req, res) => {
  const d = db();
  res.json({
    reports: d.errorReports.map(r => ({ ...r, listingTitle: (listingById(r.listingId) || {}).title || r.listingId }))
  });
});

app.post('/api/admin/errors/:id/dismiss', requireAdmin, (req, res) => {
  const d = db();
  const r = d.errorReports.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Report not found' });
  r.status = 'dismissed';
  r.resolvedBy = req.user.email;
  log('report dismissed', { adminId: req.user.email, entityType: 'error_report', entityId: r.id, detail: { listingId: r.listingId } });
  persist();
  res.json({ report: r });
});

app.post('/api/admin/errors/:id/resolve', requireAdmin, (req, res) => {
  const d = db();
  const r = d.errorReports.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Report not found' });
  r.status = 'fixed';
  r.resolvedBy = req.user.email;
  const l = listingById(r.listingId);
  if (l) l.openErrorReports = Math.max(0, (l.openErrorReports || 1) - 1);
  log('report fixed', { adminId: req.user.email, entityType: 'error_report', entityId: r.id, detail: { listingId: r.listingId } });
  persist();
  res.json({ report: r });
});

app.get('/api/admin/universities', requireAdmin, (req, res) => {
  const d = db();
  res.json({
    universities: d.universities.map(u => ({
      ...u,
      programs: d.listings.filter(l => l.universityId === u.id).length
    }))
  });
});

app.post('/api/admin/universities', requireStrictAdmin, (req, res) => {
  const d = db();
  const { name, city } = req.body || {};
  if (!name || !city) return res.status(400).json({ error: 'Name and city are required' });
  if (d.universities.some(u => u.name.toLowerCase() === String(name).toLowerCase() && u.city.toLowerCase() === String(city).toLowerCase()))
    return res.status(409).json({ error: 'That university and city already exist' });
  const u = {
    id: nextId('u', d.universities), name, city,
    state: (req.body || {}).state || '—',
    type: (req.body || {}).type || 'university',
    isPublic: true,
    websiteUrl: (req.body || {}).websiteUrl || 'https://example.edu',
    uniAssistMember: !!(req.body || {}).uniAssistMember,
    notes: (req.body || {}).notes || ''
  };
  d.universities.push(u);
  log('insert_university', { adminId: req.user.email, entityType: 'university', entityId: u.id, detail: { name, city } });
  persist();
  res.status(201).json({ university: u });
});
app.put('/api/admin/universities/:id', requireStrictAdmin, (req, res) => {
  const u = db().universities.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'University not found' });
  ['name', 'city', 'state', 'uniAssistMember', 'notes', 'websiteUrl'].forEach(k => {
    if (req.body[k] !== undefined) u[k] = req.body[k];
  });
  log('university update', { adminId: req.user.email, entityType: 'university', entityId: u.id, detail: {} });
  persist();
  res.json({ university: u });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const d = db();
  res.json({
    users: d.users.map(u => {
      const p = d.profiles[u.id] || {};
      return { ...pub(u), profilePct: u.role === 'student' ? completeness(p, p.targets || []) : null, createdAt: u.createdAt, lastLogin: u.lastLogin };
    })
  });
});
app.put('/api/admin/users/:id', requireStrictAdmin, (req, res) => {
  const d = db();
  const u = d.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const activeAdmins = () => d.users.filter(x => x.role === 'admin' && x.isActive);
  if (u.id === req.user.id && req.body.role && req.body.role !== 'admin')
    return res.status(400).json({ error: 'You cannot remove your own admin role' });
  /* locking yourself out is never what anyone means to do */
  if (u.id === req.user.id && req.body.isActive === false)
    return res.status(400).json({ error: 'You cannot deactivate your own account' });
  /* and the console must always keep one way back in */
  const losesAdmin = (req.body.role && req.body.role !== 'admin' && u.role === 'admin')
    || (req.body.isActive === false && u.role === 'admin' && u.isActive);
  if (losesAdmin && activeAdmins().length <= 1)
    return res.status(400).json({ error: 'Keep at least one active admin' });
  if (req.body.role) u.role = req.body.role;
  if (req.body.isActive !== undefined) u.isActive = !!req.body.isActive;
  log('role change', { adminId: req.user.email, entityType: 'user', entityId: u.id, detail: { role: u.role, isActive: u.isActive } });
  persist();
  res.json({ user: pub(u) });
});

app.get('/api/admin/logs', requireAdmin, (req, res) => {
  const logs = db().logs.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ logs });
});

/* ================================================================= PUBLIC */
app.get('/api/public/stats', (req, res) => {
  const d = db();
  const t = today();
  /* count what a student can actually see: published and not stale */
  const verified = d.listings.filter(l => canSeeListing(null, l));
  res.json({
    today: t,
    scholarships: verified.filter(l => l.kind === 'scholarship').length,
    programs: verified.filter(l => l.kind === 'program').length,
    universities: d.universities.length,
    recent: verified.slice().sort((a, b) => String(b.lastVerified || '').localeCompare(String(a.lastVerified || ''))).slice(0, 4)
      .map(l => ({ id: l.id, kind: l.kind, title: l.title, provider: l.provider, deadline: l.deadline, lastVerified: l.lastVerified, fundingType: l.fundingType, tuitionPerSemester: l.tuitionPerSemester, freshness: Match.freshness(l.lastVerified, t) })),
    verifiedList: verified.map(l => ({ id: l.id, kind: l.kind, deadline: l.deadline, minCgpa: l.minCgpa, ieltsRequired: l.ieltsRequired, degreeLevels: l.degreeLevels, maxAge: l.maxAge, allowedCountries: l.allowedCountries, lastVerified: l.lastVerified }))
  });
});

/* ================================================================ STATIC */
const dist = path.join(here, '..', 'dist');
if (fs.existsSync(dist)) {
/* Health check for the host (Render pings this) and for an uptime monitor.
   It reads the store, so it also counts as real activity for Supabase, which
   pauses free projects after a week without database requests. */
app.get('/api/health', (req, res) => {
  const t = Date.now();
  let store = storeInfo();
  let listings = null;
  let storeError = null;
  try { listings = db().listings.length; } catch (e) { storeError = e.message; }
  /* 503 when the data store is unusable: a host health check then keeps the last
     good deploy instead of routing traffic to an instance that cannot serve. */
  res.status(listings === null ? 503 : 200).json({
    ok: listings !== null,
    uptimeSeconds: Math.round(process.uptime()),
    store: { mode: store.mode, supabase: store.supabase, lastSync: store.lastSync, error: storeError },
    listings,
    responseMs: Date.now() - t
  });
});

  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.send('API is running. Build the client with `npm run build`.'));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 8000;

/* Load the data first: from Supabase when it is configured, otherwise from
   data/db.json. A failure here is logged, never fatal — the API still starts. */
const info = await initStore();
if (info.mode === 'supabase') console.log('[store] Supabase connected →', info.supabase);
else console.log('[store] local file →', info.file);

app.listen(PORT, '0.0.0.0', () => {
  console.log('Scholarship Finder API + client on http://0.0.0.0:' + PORT);
});

/* flush the last debounced write before the platform stops the container */
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => { try { await closeStore(); } finally { process.exit(0); } });
}
