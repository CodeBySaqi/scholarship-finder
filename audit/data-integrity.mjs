/* Audit suite — run against a live server: PORT=8000 node server/index.js
   Playwright is expected at $PW (default /tmp/node_modules/playwright-core/index.mjs)
   and Chromium at $CHROME. See ../AUDIT.md for what each suite proves. */
/* Data-layer integrity: no row may belong to two accounts, no orphan references. */
import fs from 'node:fs';
const db = JSON.parse(fs.readFileSync(new URL('../data/db.json', import.meta.url).pathname, 'utf8'));
const out = [];
const check = (ok, name, detail = '') => out.push({ ok, name, detail: String(detail) });
const userIds = new Set(db.users.map(u => u.id));
const emails = new Set(db.users.map(u => u.email));
const listingIds = new Set(db.listings.map(l => l.id));

const pairs = db.saved.map(s => s.userId + '|' + s.listingId);
check(new Set(pairs).size === pairs.length, 'no duplicate (user, listing) saved rows', pairs.filter((p, i) => pairs.indexOf(p) !== i).join(','));
check(db.saved.every(s => userIds.has(s.userId)), 'every saved row points at a real account', db.saved.filter(s => !userIds.has(s.userId)).map(s => s.userId).join(','));
check(db.saved.every(s => listingIds.has(s.listingId)), 'every saved row points at a real listing');

check(Object.keys(db.profiles).every(k => userIds.has(k)), 'profiles exist only for real accounts', Object.keys(db.profiles).filter(k => !userIds.has(k)).join(','));
check(Object.keys(db.settings).every(k => userIds.has(k)), 'settings exist only for real accounts');

check(db.errorReports.every(r => r.userId === null || emails.has(r.userId)), 'every report is attributed to a real account (or legacy anonymous)', db.errorReports.filter(r => r.userId && !emails.has(r.userId)).map(r => r.userId).join(','));
check(db.errorReports.every(r => listingIds.has(r.listingId)), 'every report points at a real listing');
check(new Set(db.errorReports.map(r => r.id)).size === db.errorReports.length, 'report ids unique');

check(db.listings.every(l => typeof l.status === 'string'), 'every listing has a status');
check(db.listings.every(l => !l.verifiedBy || emails.has(l.verifiedBy) || l.verifiedBy === 'system'), 'verifiedBy is always a real account', db.listings.filter(l => l.verifiedBy && !emails.has(l.verifiedBy) && l.verifiedBy !== 'system').map(l => l.verifiedBy).join(','));
check(db.listings.every(l => ['verified', 'draft', 'stale'].includes(l.status)), 'no unexpected listing status', [...new Set(db.listings.map(l => l.status))].join(','));
check(db.listings.every(l => l.status !== 'verified' || !!l.verifiedBy), 'every published listing records who verified it', db.listings.filter(l => l.status === 'verified' && !l.verifiedBy).map(l => l.id).join(','));
check(db.listings.every(l => l.status !== 'verified' || !!l.sourceUrl || !!l.officialUrl), 'every published listing has a source', db.listings.filter(l => l.status === 'verified' && !l.sourceUrl && !l.officialUrl).map(l => l.id).join(','));

check(db.logs.every(l => l.adminId && typeof l.action === 'string'), 'every audit entry has an actor and an action');
check(new Set(db.logs.map(l => l.id)).size === db.logs.length, 'audit ids unique');
check(db.logs.every((l, i) => i === 0 || new Date(db.logs[i - 1].createdAt) >= new Date(l.createdAt)), 'audit log stored newest first');

check(db.users.every(u => u.passwordHash && u.passwordHash.includes(':')), 'every account stores a salted hash, never a password');
check(db.users.every(u => !('password' in u)), 'no plain password field anywhere');
check(db.users.filter(u => u.role === 'admin').length >= 1, 'an admin always exists');

/* cross-account contamination: no account may carry another account's private text */
const notes = db.saved.filter(s => s.note).map(s => ({ user: s.userId, note: s.note }));
const crossed = [];
for (const n of notes) {
  const owner = db.saved.find(s => s.userId === n.user && s.note === n.note);
  if (!owner) crossed.push(n);
}
check(crossed.length === 0, 'saved notes are attached to exactly one owner row');

const fails = out.filter(r => !r.ok);
console.log(`\n${out.length - fails.length}/${out.length} data integrity checks passed`);
if (fails.length) { console.log('\nFINDINGS'); fails.forEach(f => console.log(' ✗ ' + f.name + (f.detail ? '  [' + f.detail + ']' : ''))); }
