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


/* ------------------------------------------------------- notifications
   Real, dated messages about real listings in the seed: a deadline that is
   actually close, a broadcast about a recheck, and one account note. No lorem. */
const day = (offset) => {
  const d = new Date(Date.parse(REFERENCE.today + 'T09:00:00Z') + offset * 86400000);
  return d.toISOString();
};
const savedTitles = (key) => (REFERENCE.savedItems[key] || []).map(s => {
  const l = REFERENCE.listings.find(x => x.id === s.id);
  return l ? { id: l.id, title: l.title, deadline: l.deadline, provider: l.provider } : null;
}).filter(Boolean);

const notifications = [];
let nseq = 0;
const pushNotif = (row) => { nseq += 1; notifications.push({ id: 'nt-' + nseq, readAt: null, createdBy: 'system', link: null, category: 'system', ...row }); };

profileKeys.forEach(key => {
  const uid = 'u-' + key;
  pushNotif({
    userId: uid, category: 'system', createdAt: day(-21),
    title: 'Welcome to Scholarship Finder',
    body: 'Your account is ready. Complete your profile and every listing will show the requirements you meet and the ones you still need.',
    link: '/wizard'
  });
  const next = savedTitles(key).filter(s => s.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  if (next) {
    const days = Math.round((Date.parse(next.deadline + 'T00:00:00Z') - Date.parse(REFERENCE.today + 'T00:00:00Z')) / 86400000);
    if (days >= 0) {
      pushNotif({
        userId: uid, category: 'deadline', createdAt: day(-2), readAt: day(-1),
        title: next.title + ' closes in ' + days + ' days',
        body: 'You saved this one. Deadline ' + next.deadline + '. ' + next.provider + '. Check the documents list before you start the application.',
        link: '/saved'
      });
    }
  }
});

/* a broadcast that went to everyone, so the admin send history has a real row */
const broadcastRow = {
  title: 'Three listings were rechecked this week',
  body: 'DAAD Study Scholarships, TUM Informatics and RWTH Computer Science were checked against their official pages. If you saved one of them, the deadline on your card has been refreshed.',
  audience: 'all', link: '/scholarships'
};
users.filter(u => u.role === 'student').forEach(u => pushNotif({
  userId: u.id, category: 'broadcast', createdAt: day(-5), readAt: null,
  ...broadcastRow, createdBy: 'admin@example.com'
}));

pushNotif({
  userId: 'u-admin', category: 'system', createdAt: day(-1),
  title: '3 listings are waiting for review',
  body: 'Two AI drafts and one listing that has not been rechecked in 254 days. Open the review queue before the next publish.',
  link: '/admin/queue'
});
pushNotif({
  userId: 'u-contributor', category: 'system', createdAt: day(-3),
  title: 'Your draft S7 needs a source URL',
  body: 'MSc Environmental Governance has no apply URL yet, so it cannot pass the provenance check. Add the official page and send it for review.',
  link: '/admin/listings'
});

const notificationSends = [{
  id: 'bc-seed-1',
  title: broadcastRow.title,
  body: broadcastRow.body,
  audience: 'all',
  recipients: users.filter(u => u.role === 'student').length,
  recipientIds: users.filter(u => u.role === 'student').map(u => u.id),
  link: broadcastRow.link,
  sentBy: 'admin@example.com',
  sentAt: day(-5)
}];

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
  sessions: {},
  notifications,
  notificationSends,
  siteSettings: {
    siteName: 'Scholarship Finder',
    tagline: 'Scholarships and German programs, checked against the official page',
    supportEmail: 'support@scholarshipfinder.app',
    aiProvider: 'openai',
    aiApiKey: '',
    aiModel: 'gpt-4o-mini',
    aiBaseUrl: 'https://api.openai.com/v1',
    researchEnabled: true
  }
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
console.log(' users:', users.length, '| listings:', listings.length, '| saved:', saved.length, '| notifications:', notifications.length);
console.log(' demo password:', PASSWORD);
console.log(' accounts:', users.map(u => u.email + ' (' + u.role + ')').join(', '));
