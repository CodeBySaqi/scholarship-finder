/* Refresh data/anabin-institutions.json from the official anabin database
   (KMK / Zentralstelle für ausländisches Bildungswesen).

     node tools/anabin-refresh.mjs            # Pakistan (the only country we seed)
     node tools/anabin-refresh.mjs --country=IN

   anabin is the authority on whether a Pakistani institution is H+, H+/- or H-,
   and that status decides whether a ZAB statement (Zeugnisbewertung) is needed.
   Nothing here is guessed: every row keeps the anabin id it came from, and the
   file records the date it was read. If anabin cannot be reached the script
   exits non-zero and leaves the existing file untouched.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '..', 'data', 'anabin-institutions.json');
const API = 'https://anabin.kmk.org/api/public';
const COUNTRY = (process.argv.find(a => a.startsWith('--country=')) || '--country=PAK').split('=')[1];

const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const status = (s) => {
  if (!s) return null;
  const c = String(s).replace(/\s+/g, '');
  return ['H+', 'H+/-', 'H-'].includes(c) ? c : String(s);
};

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(url + ' → ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

const countries = await get(API + '/country?filter=' + encodeURIComponent(JSON.stringify({ isoCode: COUNTRY })));
const country = (countries || [])[0];
if (!country) {
  console.error('anabin has no country with isoCode ' + COUNTRY);
  process.exit(1);
}

const all = [];
for (let offset = 0; ; offset += 200) {
  const page = await get(API + '/institution?filter=' + encodeURIComponent(JSON.stringify({ country: country._id })) +
    '&limit=200&offset=' + offset);
  if (!Array.isArray(page) || !page.length) break;
  all.push(...page);
  if (page.length < 200) break;
}

const rows = all.map(x => {
  const type = x.institutionType || {};
  const aliases = [...(x.aliasNames || []), ...(x.alternativeNames || []), ...(x.outdatedNames || [])]
    .map(a => (typeof a === 'string' ? a : a && a.nameShort)).filter(Boolean);
  return {
    id: 'anabin-' + String(x._id || '').slice(-8),
    anabinId: x._id,
    name: strip(x.nameShort),
    nameGerman: x.nameGerman || null,
    abbr: x.abbreviation || null,
    city: (x.location || {}).originName || null,
    type: type.nameShort || null,
    status: status((type.status || {}).nameShort),
    aliases: [...new Set(aliases)],
    website: x.homepage || null,
    note: strip(x.description).slice(0, 200) || null
  };
}).filter(r => r.name);

const doc = {
  _readme: [
    'anabin institution status for Pakistani higher-education institutions, read from the',
    'official anabin database (KMK / Zentralstelle fuer auslaendisches Bildungswesen).',
    'H+ the institution is recognised, H+/- recognition is conditional, H- it is not recognised.',
    'Pakistani applicants never need APS (that is China/India/Vietnam/Mongolia). Where a degree',
    'comes from an H- or H+/- institution a ZAB statement (Zeugnisbewertung) is what settles it.',
    'Refresh with: node tools/anabin-refresh.mjs  — or the "Check live" button in the profile,',
    'which re-reads one institution and stores the fresh status with its date.'
  ],
  country: { iso: country.isoCode, name: country.nameShort, anabinId: country._id },
  source: API + '/institution?filter={"country":"' + country._id + '"}',
  checkedAt: new Date().toISOString().slice(0, 10),
  institutions: rows.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
};

fs.writeFileSync(FILE, JSON.stringify(doc, null, 1) + '\n');
const counts = rows.reduce((acc, r) => { acc[r.status || 'none'] = (acc[r.status || 'none'] || 0) + 1; return acc; }, {});
console.log('wrote', rows.length, 'institutions for', country.nameShort, JSON.stringify(counts));
