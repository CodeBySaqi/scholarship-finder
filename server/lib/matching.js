/* Loads the shared matching engine (match.cjs, window.Match) and the reference
   data (reference.js, window.DB) inside Node, so the rules that power the API
   are the same ones the seed data was written against. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

const sandbox = { window: {} };
const referenceSrc = fs.readFileSync(path.join(here, 'reference.js'), 'utf8');
const matchSrc = fs.readFileSync(path.join(here, 'match.cjs'), 'utf8');

new Function('window', referenceSrc)(sandbox.window);
new Function('window', matchSrc)(sandbox.window);

export const REFERENCE = sandbox.window.DB;
export const Match = sandbox.window.Match;

/* completeness weights — same table as the prototype wizard */
export const CHECKLIST = [
  ['fullName', 8], ['dateOfBirth', 8], ['gender', 4], ['city', 3],
  ['currentLevel', 8], ['institution', 4], ['expectedCompletionYear', 5],
  ['matricPct', 5], ['interPct', 6], ['hsscGroup', 5], ['ibccStatus', 5],
  ['bachelorCgpa', 9], ['bachelorScale', 4],
  ['ielts', 10], ['germanLevel', 4],
  ['fundingNeed', 5], ['apsStatus', 6], ['documentsReady', 1]
];

export function completeness(p, targets) {
  let done = 0, total = 0;
  for (const [key, weight] of CHECKLIST) {
    total += weight;
    const v = p[key];
    if (key === 'ielts') { if (v && v.status) done += weight; }
    else if (key === 'documentsReady') { if (Array.isArray(v) && v.length) done += weight; }
    else if (v !== null && v !== undefined && v !== '' && v !== 'none') done += weight;
  }
  total += 12;
  if (targets && targets.length && targets.some(t => t.isPrimary)) done += 12;
  return Math.min(100, Math.round((done / total) * 100));
}

export function freshnessOf(listing, today) {
  return Match.freshness(listing.lastVerified, today);
}

/* compute the ranked, bucketed results for one profile + target set */
export function resultsFor(profile, targets, listings, today, kind) {
  const pool = listings.filter(l => l.kind === kind);
  const raw = Match.visible(Match.matchAll(profile, targets, pool, today));
  const ranked = Match.rank(raw, pool, targets);
  return {
    meets: ranked.filter(r => r.bucket === 'meets'),
    almost: ranked.filter(r => r.bucket === 'almost'),
    next_cycle: ranked.filter(r => r.bucket === 'next_cycle'),
    all: ranked
  };
}

/* ---------------------------------------------------------------------------
   Guard rails around the prototype engine. A malformed profile must never take
   out /matches or a listing page: the engine throws, we fall back to a neutral
   result and the rest of the page keeps working. */
const NEUTRAL = (listingId) => ({
  listingId, bucket: 'hidden', provisional: true, reasons: [], gaps: ['Profile data could not be read'],
  badges: [], matchedTargets: []
});

export function safeResultsFor(profile, targets, listings, today, kind) {
  try {
    return resultsFor(profile, targets, listings, today, kind);
  } catch (e) {
    console.error('[matching] resultsFor failed:', e.message);
    return { meets: [], almost: [], next_cycle: [], all: [], degraded: true };
  }
}

export function safeMatchOne(profile, targets, listing, today) {
  try {
    return matchOne(profile, targets, listing, today);
  } catch (e) {
    console.error('[matching] matchOne failed for ' + (listing && listing.id) + ':', e.message);
    return NEUTRAL(listing && listing.id);
  }
}

export function matchOne(profile, targets, listing, today) {
  if (!targets.length) return Match.match(profile, { degree: 'master', fields: [], intakeYear: 2027, isPrimary: true }, listing, today);
  const per = targets.map(t => Match.match(profile, t, listing, today));
  return per.sort((a, b) => Match.BUCKET_ORDER[a.bucket] - Match.BUCKET_ORDER[b.bucket])[0];
}
