/* Seed data/db.json from the reference data (server/lib/reference.js).
   Run with `npm run seed` — it resets the store to a known state.
   Add `--remote` (npm run seed:remote) to also push the result to Supabase. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFERENCE, completeness } from './lib/matching.js';
import { hashPassword } from './lib/auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(here, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const PASSWORD = 'demo1234';
const now = new Date().toISOString();
const hash = hashPassword(PASSWORD);

const profileKeys = ['ayesha', 'bilal', 'sana'];
const users = [
  ...profileKeys.map(key => {
    const p = REFERENCE.profiles[key];
    return {
      id: 'u-' + key,
      email: p.email,
      displayName: p.fullName,
      role: 'student',
      isActive: true,
      emailVerified: true,
      passwordHash: hash,
      createdAt: now,
      lastLogin: null
    };
  }),
  { id: 'u-contributor', email: 'contributor@example.com', displayName: 'Contributor', role: 'contributor', isActive: true, emailVerified: true, passwordHash: hash, createdAt: now, lastLogin: null },
  { id: 'u-admin', email: 'admin@example.com', displayName: 'Editor Admin', role: 'admin', isActive: true, emailVerified: true, passwordHash: hash, createdAt: now, lastLogin: null }
];

const profiles = {};
profileKeys.forEach(key => {
  profiles['u-' + key] = Object.assign({}, REFERENCE.profiles[key], { targets: REFERENCE.targets[key] || [] });
});

/* a contributor/admin also gets a blank profile so the app never crashes */
profiles['u-contributor'] = { fullName: 'Contributor', firstName: 'Contributor', completenessPct: 0, targets: [] };
profiles['u-admin'] = { fullName: 'Editor Admin', firstName: 'Editor', completenessPct: 0, targets: [] };
Object.keys(profiles).forEach(uid => {
  profiles[uid].completenessPct = completeness(profiles[uid], profiles[uid].targets || []);
});

const saved = [];
for (const key of profileKeys) {
  (REFERENCE.savedItems[key] || []).forEach(s => {
    saved.push({
      id: 'sv-' + key + '-' + s.id,
      userId: 'u-' + key,
      listingId: s.id,
      kind: s.kind,
      note: s.note || '',
      createdAt: s.createdAt || now
    });
  });
}

/* The audit log and the seeded reports use short handles ("admin", "contributor").
   Store the account identities so the log, the four-eyes rule and the user table
   all talk about the same actor. */
const HANDLE = { admin: 'admin@example.com', contributor: 'contributor@example.com', system: 'system' };
const asActor = (v) => (v ? (HANDLE[v] || v) : v);

const listings = REFERENCE.listings.map(l => Object.assign({}, l, {
  evidence: l.evidence || {},
  createdBy: asActor(l.createdBy),
  verifiedBy: asActor(l.verifiedBy),
  updatedAt: now
}));

const universities = REFERENCE.universities.map(u => Object.assign({}, u, { updatedAt: now }));

const db = {
  meta: { seededAt: now, today: REFERENCE.today, password: PASSWORD, version: 1 },
  users,
  profiles,
  listings,
  universities,
  saved,
  errorReports: REFERENCE.errorReports.map(r => Object.assign({}, r, {
    /* every report comes from a signed-in account; seed handle → email */
    userId: r.userId ? (HANDLE[r.userId] || (r.userId.includes('@') ? r.userId : r.userId + '@example.com')) : null
  })),
  logs: REFERENCE.adminLogs.map(l => Object.assign({}, l))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
  settings: {},
  sessions: {}
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1));

console.log('seeded', DB_FILE);
if (process.argv.includes('--remote')) {
  try {
    const { pushDocument } = await import('./lib/store.js');
    const r = await pushDocument(db);
    console.log('pushed to Supabase →', r.target);
  } catch (e) {
    console.error('could not push to Supabase:', e.message);
    process.exit(1);
  }
}
console.log(' users:', users.length, '| listings:', listings.length, '| saved:', saved.length);
console.log(' demo password:', PASSWORD);
console.log(' accounts:', users.map(u => u.email + ' (' + u.role + ')').join(', '));
