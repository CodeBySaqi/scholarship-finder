/* ==========================================================================
   Site settings + the research agent.

   Settings live in the same JSON document (db.siteSettings) and are readable by
   admins only. The AI key never leaves the server except to the provider: the
   API returns it masked, and writes only replace it when a new value is sent.

   The research agent has two modes:

     provider  an OpenAI-compatible endpoint answers with strict JSON. Used when
               an API key is configured in Settings.

     extract   no key, or the provider failed. A deterministic reader pulls what
               it can prove out of the page text, and every field it keeps is
               tied to the sentence it came from. It refuses to guess.

   Both modes return the same shape, so the UI does not care which ran — it only
   shows a badge saying which one did. Nothing here ever publishes: the caller
   stores a draft.
   ========================================================================== */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const SETTINGS_DEFAULTS = {
  siteName: 'Scholarship Finder',
  tagline: 'Scholarships and German programs, checked against the official page',
  supportEmail: 'support@scholarshipfinder.app',
  aiProvider: 'openai',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  aiBaseUrl: 'https://api.openai.com/v1',
  researchEnabled: true
};

export function readSettings(d) {
  const s = d.siteSettings || {};
  return { ...SETTINGS_DEFAULTS, ...s };
}

/* What a browser may see. The key is never echoed; the hint (first/last four
   characters) is for admins only, because a hint is still part of the key. */
export function publicSettings(d, { includeHint = true } = {}) {
  const s = readSettings(d);
  const key = String(s.aiApiKey || '');
  const admin = includeHint;
  return {
    ...s,
    aiApiKey: '',
    aiApiKeySet: admin && key.length > 0,
    aiApiKeyHint: admin && key ? key.slice(0, 4) + '…' + key.slice(-4) : ''
  };
}

export function writeSettings(d, patch) {
  const cur = readSettings(d);
  const out = { ...cur };
  const text = (v, max = 120) => (v === null || v === undefined ? out : String(v).trim().slice(0, max));
  if (patch.siteName !== undefined) out.siteName = text(patch.siteName, 80) || SETTINGS_DEFAULTS.siteName;
  if (patch.tagline !== undefined) out.tagline = text(patch.tagline, 160);
  if (patch.supportEmail !== undefined) out.supportEmail = text(patch.supportEmail, 120);
  if (patch.aiProvider !== undefined) out.aiProvider = ['openai', 'none'].includes(patch.aiProvider) ? patch.aiProvider : out.aiProvider;
  if (patch.aiModel !== undefined) out.aiModel = text(patch.aiModel, 60) || SETTINGS_DEFAULTS.aiModel;
  if (patch.aiBaseUrl !== undefined) out.aiBaseUrl = text(patch.aiBaseUrl, 200) || SETTINGS_DEFAULTS.aiBaseUrl;
  if (patch.researchEnabled !== undefined) out.researchEnabled = !!patch.researchEnabled;
  /* an empty string from the form means "leave the stored key alone";
     an explicit null means "forget it" */
  if (patch.aiApiKey === null) out.aiApiKey = '';
  else if (typeof patch.aiApiKey === 'string' && patch.aiApiKey.trim()) out.aiApiKey = patch.aiApiKey.trim().slice(0, 200);
  d.siteSettings = out;
  return publicSettings(d);
}

/* ------------------------------------------------------------------ helpers */
const sentences = (text) => String(text).split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 12);

function findSentence(lines, re) {
  return lines.find(s => re.test(s)) || null;
}

/* Age limits are written many ways: "under 30", "not older than 32",
   "maximum age of 30", "30 years or younger", "aged 25-30". Read them all. */
export function pickAge(line) {
  if (!line) return null;
  const s = String(line);
  const patterns = [
    /(?:under|below|younger than|not older than|no older than|at most|maximum(?: age)?(?: of)?|max\.?)\s*(\d{2})/i,
    /(\d{2})\s*(?:years)?\s*(?:old)?\s*(?:or (?:younger|less))/i,
    /(?:between|aged)\s*(\d{2})\s*(?:-|–|and|to)\s*(\d{2})/i
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      /* a range means the upper bound is the limit */
      const n = m[2] ? Number(m[2]) : Number(m[1]);
      if (Number.isFinite(n) && n >= 15 && n <= 60) return n;
    }
  }
  return null;
}

function pickNumber(s, re) {
  if (!s) return null;
  const m = s.match(re);
  if (!m) return null;
  const n = Number(String(m[1]).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function pickDate(s) {
  if (!s) return null;
  let m = s.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (m) {
    const iso = m[3] + '-' + String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0');
    return ISO_DATE.test(iso) ? iso : null;
  }
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m) {
    return m[3] + '-' + String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0');
  }
  return null;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

/* ------------------------------------------------------------------- fetch */
export async function fetchPage(url) {
  const target = new URL(url);
  if (!/^https?:$/.test(target.protocol)) throw new Error('Only http and https addresses can be read');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(target.toString(), {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'ScholarshipFinderResearch/1.0 (+admin research tool)',
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.8,text/plain;q=0.5'
      }
    });
    if (!r.ok) throw new Error('The page answered HTTP ' + r.status);
    const raw = await r.text();
    const text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim();
    const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return {
      url: target.toString(),
      title: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 200) : null,
      text: text.slice(0, 120000),
      chars: text.length,
      fetchedAt: new Date().toISOString()
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------- deterministic mode */
export function extractFields(kind, page, notes = '') {
  const text = (page && page.text ? page.text : '') + '\n' + String(notes || '');
  const lines = sentences(text);
  const evidence = {};
  const fields = {};
  const warnings = [];
  const keep = (field, sentence, value) => {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return;
    fields[field] = value;
    if (sentence) evidence[field] = sentence.slice(0, 300);
  };

  const deadlineLine = findSentence(lines, /deadline|closes|apply by|closing date|application period/i);
  const cgpaLine = findSentence(lines, /CGPA|GPA|grade point|minimum grade/i);
  const ieltsLine = findSentence(lines, /IELTS|TOEFL|English (language )?(proficiency|requirement)/i);
  const ageLine = findSentence(lines, /\bage\b|years old|younger than|older than|under \d{2}|born (after|before)|maximum age|at most \d{2}/i);
  const tuitionLine = findSentence(lines, /tuition|semester fee|fees of|EUR per semester/i);
  const fundingLine = findSentence(lines, /full(y)? funded|scholarship|stipend|monthly allowance|grant/i);
  const cityLine = findSentence(lines, /located in|in (Berlin|Munich|Cologne|Frankfurt|Hamburg|Freiburg|Tübingen|Dresden|Aachen|Heidelberg|Stuttgart|Bonn|Göttingen|Mannheim|Jena|Leipzig)/i);
  const titleLine = (page && page.title) ? page.title : findSentence(lines, /scholarship|programme|program|master|fellowship/i);

  if (kind === 'university') {
    keep('name', titleLine, (page && page.title ? page.title : null) || (titleLine ? titleLine.split(/[|–-]/)[0].trim().slice(0, 90) : null));
    const cityMatch = (cityLine || text).match(/in\s+([A-ZÄÖÜ][a-zäöüß-]+(?:\s[A-ZÄÖÜ][a-zäöüß-]+)?)/);
    keep('city', cityLine, cityMatch ? cityMatch[1] : null);
    keep('websiteUrl', null, page ? page.url : null);
    keep('uniAssistMember', findSentence(lines, /uni-assist/i), /uni-assist/i.test(text));
    const typeSentence = findSentence(lines, /technical university|university of applied sciences|Technische Universität|Fachhochschule/i);
    keep('type', typeSentence, /applied sciences|Fachhochschule/i.test(typeSentence || '') ? 'uas' : (/technical|Technische/i.test(typeSentence || '') ? 'tu' : 'university'));
    keep('notes', null, page ? 'Researched from ' + page.url + ' on ' + page.fetchedAt.slice(0, 10) + '. Verify before publishing.' : null);
    if (!fields.name) warnings.push('No university name could be read from the page title.');
    return { fields, evidence, warnings };
  }

  keep('title', titleLine, titleLine ? String(titleLine).replace(/[.!?]$/, '').slice(0, 120) : (page && page.title) || null);
  keep('provider', findSentence(lines, /DAAD|Deutschlandstipendium|foundation|Stiftung|university|Universität|ministry/i), null);
  keep('deadline', deadlineLine, pickDate(deadlineLine));
  keep('minCgpa', cgpaLine, pickNumber(cgpaLine, /(\d(?:[.,]\d+)?)\s*(?:\/\s*4(?:\.0)?|CGPA|GPA)/i));
  const ielts = pickNumber(ieltsLine, /IELTS[^0-9]{0,20}(\d(?:[.,]\d)?)/i) || pickNumber(ieltsLine, /(\d(?:[.,]\d)?)\s*(?:overall|band)?\s*IELTS/i);
  keep('minIelts', ieltsLine, ielts);
  if (ieltsLine) fields.ieltsRequired = !!ielts || /required/i.test(ieltsLine);
  keep('maxAge', ageLine, pickAge(ageLine));
  if (/fully funded|full funding|covers all|all expenses/i.test(text)) keep('fundingType', fundingLine, 'full');
  else if (/partially funded|partial funding|partial scholarship/i.test(text)) keep('fundingType', fundingLine, 'partial');
  keep('tuitionPerSemester', tuitionLine, pickNumber(tuitionLine, /(\d{3,5})\s*(?:EUR|€)/i));
  if (/english[- ]taught|taught in english|language of instruction:? english/i.test(text)) keep('languageMode', findSentence(lines, /english[- ]taught|language of instruction/i), 'english');
  else if (/taught in german|language of instruction:? german|deutschsprachig/i.test(text)) keep('languageMode', findSentence(lines, /german[- ]taught|deutschsprachig/i), 'german');
  const degree = /bachelor|undergraduate|B\.?Sc/i.test(text) && !/master|graduate/i.test(text) ? ['bachelor']
    : /phd|doctora/i.test(text) ? ['phd'] : ['master'];
  keep('degreeLevels', null, degree);
  keep('fieldCategory', findSentence(lines, /computer science|informatics|data science|engineering|business|economics|physics|chemistry|biology|architecture/i),
    (text.match(/\b(computer science|informatics|data science|engineering|business|economics|physics|chemistry|biology|architecture)\b/i) || [null])[0]);
  keep('applyUrl', null, page ? page.url : null);
  keep('officialUrl', null, page ? page.url : null);
  keep('sourceUrl', null, page ? page.url : null);
  keep('description', null, 'Researched from ' + (page ? page.url : 'the notes') + '. Every field must be checked against the source before publishing.');

  if (!fields.deadline) warnings.push('No deadline found in the text — check the page and fill it in by hand.');
  if (!fields.provider) warnings.push('The provider could not be identified with evidence.');
  if (!page) warnings.push('No page was read, so only the notes you pasted were used.');
  return { fields, evidence, warnings };
}

/* --------------------------------------------------------------- provider */
const KIND_FIELDS = {
  scholarship: 'title, provider, degreeLevels (array of bachelor|master|phd), fundingType (full|partial|tuition_only|none), deadline (YYYY-MM-DD or null), minCgpa (number out of 4 or null), minIelts (number or null), ieltsRequired (boolean), maxAge (number or null), allowedCountries (array of ISO-2 codes, empty means all), applyUrl, officialUrl, sourceUrl, description (2-3 sentences), coverage (array of strings), documents (array of strings), applySteps (array of strings)',
  program: 'title, provider, degreeLevels (array), deadline (YYYY-MM-DD or null), tuitionPerSemester (number in EUR or null), semesterFee (number or null), languageMode (english|german|mixed), minGermanLevel (none|A1|A2|B1|B2|C1|C2 or null), minIelts (number or null), ieltsRequired (boolean), fieldCategory (ai|data|software|engineering|business|science), applyUrl, officialUrl, sourceUrl, description',
  university: 'name, city, state, type (university|uas|tu), websiteUrl, uniAssistMember (boolean), notes'
};

async function askProvider(settings, kind, page, notes) {
  const base = String(settings.aiBaseUrl || SETTINGS_DEFAULTS.aiBaseUrl).replace(/\/+$/, '');
  const body = {
    model: settings.aiModel || SETTINGS_DEFAULTS.aiModel,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You extract facts for a scholarship database. Answer with one JSON object and nothing else. ' +
          'Use null for anything the source does not state. Never invent a deadline, a grade or a provider. ' +
          'Every value must be traceable to the source text.'
      },
      {
        role: 'user',
        content: 'Kind: ' + kind + '\nReturn these keys: ' + KIND_FIELDS[kind] +
          '\n\nAlso return "evidence": an object mapping each key you filled to the exact sentence from the source that supports it, and "warnings": an array of short strings for anything a human must check.\n\nSOURCE URL: ' + (page ? page.url : '(none)') +
          '\n\nSOURCE TEXT:\n' + ((page ? page.text : '') + '\n\nEDITOR NOTES:\n' + (notes || '')).slice(0, 24000)
      }
    ]
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(base + '/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + settings.aiApiKey },
      body: JSON.stringify(body)
    });
    const raw = await r.text();
    if (!r.ok) throw new Error('The AI provider answered HTTP ' + r.status + ': ' + raw.slice(0, 160));
    const data = JSON.parse(raw);
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error('The AI provider returned an empty answer');
    const json = JSON.parse(String(content).replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
    const { evidence, warnings, ...fields } = json;
    return { fields, evidence: evidence || {}, warnings: Array.isArray(warnings) ? warnings : [] };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------- the agent */
export async function runResearch({ kind, url, notes, settings }) {
  const cleanNotes = String(notes || '').slice(0, 8000);
  if (!url && !cleanNotes.trim()) throw new Error('Give the agent a page URL or paste some text to work from');
  if (kind === 'university' && !url && !cleanNotes.trim()) throw new Error('A university needs a page URL or pasted text');

  let page = null;
  let fetchError = null;
  if (url) {
    try { page = await fetchPage(url); }
    catch (e) { fetchError = e.message; }
  }

  const usingProvider = settings.aiProvider === 'openai' && !!settings.aiApiKey;
  let result = null;
  let provider = 'extract';
  let providerError = null;

  if (usingProvider && (page || cleanNotes.trim())) {
    try {
      const answer = await askProvider(settings, kind, page, cleanNotes);
      result = answer;
      provider = 'ai:' + (settings.aiModel || SETTINGS_DEFAULTS.aiModel);
    } catch (e) {
      providerError = e.message;
    }
  }
  if (!result) {
    result = extractFields(kind, page, cleanNotes);
    provider = usingProvider ? 'extract (provider failed)' : 'extract';
  }

  /* provenance is not optional: the draft always points at what was read */
  if (page) {
    result.fields.sourceUrl = result.fields.sourceUrl || page.url;
    result.fields.officialUrl = result.fields.officialUrl || page.url;
    if (kind !== 'university') result.fields.applyUrl = result.fields.applyUrl || page.url;
  }

  const warnings = [...(result.warnings || [])];
  if (fetchError) warnings.unshift('The page could not be read (' + fetchError + '). Nothing was extracted from it.');
  if (providerError) warnings.unshift('The AI provider failed (' + providerError + '). The built-in extractor ran instead.');
  if (!usingProvider) warnings.push('No AI key is configured, so the built-in extractor ran. Add a key in Settings → AI research for full extraction.');

  return {
    kind,
    provider,
    fields: result.fields,
    evidence: result.evidence || {},
    warnings,
    source: page ? { url: page.url, title: page.title, chars: page.chars, fetchedAt: page.fetchedAt } : (url ? { url, error: fetchError } : null),
    generatedAt: new Date().toISOString()
  };
}
