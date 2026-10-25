/* ==========================================================================
   ScholarPath — matters-only eligibility engine.

   One rule governs this file: ONLY a field that can change a match decision is
   read here. Display fields (city, duration, links, university type) never
   appear below, and the profile never asks for anything the engine ignores.

   Three verdicts, and they are not negotiable:

     eligible        every KNOWN hard requirement passes
     not_eligible    a KNOWN hard requirement fails — and it is named
     check_manually  no known requirement fails, but at least one hard
                     requirement is not stated for that programme

   A missing value is UNKNOWN, never "no requirement". This is the whole point:
   most programme data is incomplete, and silently treating "not stated" as "not
   required" would turn an unknown into a promise.

   Pure functions. `today` is always passed in; this file never reads the clock.
   ========================================================================== */

export const VERDICT = {
  ELIGIBLE: 'eligible',
  NOT_ELIGIBLE: 'not_eligible',
  CHECK_MANUALLY: 'check_manually'
};

/* Which way a verdict sorts on screen. */
export const VERDICT_ORDER = { eligible: 0, check_manually: 1, not_eligible: 2 };

const LEVELS = ['bachelor', 'master', 'phd'];

/* German scale: 1.0 is best, 4.0 is the pass mark. LOWER IS BETTER. Every
   comparison in this file goes through this helper so the direction can never
   be inverted by accident. */
export const gpaPasses = (yours, required) =>
  yours != null && required != null && Number(yours) <= Number(required) + 1e-9;

/* ------------------------------------------------------------------ date */
const d = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
export const daysBetween = (a, b) => Math.round((d(b).getTime() - d(a).getTime()) / 86400000);

/* Days until a deadline from `today`; negative means it has passed. */
export const daysToDeadline = (deadline, today) => (deadline ? daysBetween(today, deadline) : null);

/* ==========================================================================
   German GPA — the Modified Bavarian Formula

       N = 1 + 3 × (Nmax − Nd) / (Nmax − Nmin)

   Nmax is the best possible grade on the original scale, Nd the grade earned,
   Nmin the lowest passing grade. A perfect record maps to 1.0 and a bare pass
   maps to 4.0. We store BOTH the original and the conversion, and we show the
   arithmetic, because a university may apply its own table.

   Rounded to one decimal (the convention used on German transcripts), and
   clamped to [1.0, 4.0] so a bad scale entry cannot produce 5.3.
   ========================================================================== */
export function germanGpa(original, { scaleMax = 4, passMark = 2 } = {}) {
  if (original == null || !Number.isFinite(Number(original))) return null;
  if (!Number.isFinite(Number(scaleMax)) || !Number.isFinite(Number(passMark))) return null;
  if (Number(scaleMax) <= Number(passMark)) return null;
  const n = 1 + (3 * (Number(scaleMax) - Number(original))) / (Number(scaleMax) - Number(passMark));
  const clamped = Math.min(4, Math.max(1, n));
  return {
    value: Math.round(clamped * 10 + 1e-9) / 10,
    working: '1 + 3 × (' + scaleMax + ' − ' + original + ') / (' + scaleMax + ' − ' + passMark + ') = ' +
      (Math.round(n * 100) / 100) + (clamped !== n ? ' → clamped to ' + (Math.round(clamped * 10) / 10) : ''),
    formula: 'Modified Bavarian Formula'
  };
}

/* ==========================================================================
   Result helpers
   ========================================================================== */
function makeTrace() {
  const reasons = [];   // every check we could run, pass or fail
  const missing = [];   // hard requirements the programme never states
  const failed = [];    // hard requirements the user does not meet
  return {
    reasons, missing, failed,
    pass(check, text, detail) { reasons.push({ check, status: 'pass', text, ...detail }); },
    fail(check, text, detail) {
      reasons.push({ check, status: 'fail', text, ...detail });
      failed.push({ check, text });
    },
    unknown(check, text, field) {
      reasons.push({ check, status: 'unknown', text });
      missing.push({ check, text, field });
    },
    /* a check we simply cannot run because the PROFILE is short — the spec's
       "pending" state: it is not the programme's fault, so it is reported
       separately from the programme's own missing fields. */
    pending(check, text) { reasons.push({ check, status: 'pending', text }); }
  };
}

function verdictFor(t) {
  if (t.failed.length) return VERDICT.NOT_ELIGIBLE;
  /* A check we could not run is not a check that passed. If the programme never
     states a requirement OR the profile does not carry the value needed to test
     it, the honest verdict is "check manually" — never a clean Eligible. */
  const pending = t.reasons.some(r => r.status === 'pending');
  if (t.missing.length || pending) return VERDICT.CHECK_MANUALLY;
  return VERDICT.ELIGIBLE;
}

/* ==========================================================================
   Field fit — derived from Academics, never from a target_field
   (the profile deliberately has no target_field).
   ========================================================================== */
export function userFields(profile) {
  const a = profile.academics || {};
  const level = (profile.target || {}).level;
  if (level === 'phd') {
    /* research areas first, then the master field, then the thesis topic */
    return [
      ...(a.researchAreas || []),
      a.masterField,
      a.thesisTopic
    ].filter(Boolean).map(s => String(s).toLowerCase());
  }
  if (level === 'bachelor') {
    /* school subjects: a BSc AI hopeful with pre-engineering is a reasonable
       fit for engineering/CS programmes, and the engine says so once */
    return [
      ...(a.schoolSubjects || []),
      a.hsscGroup
    ].filter(Boolean).map(s => String(s).toLowerCase());
  }
  return [a.bachelorField, ...(a.bachelorSubjectAreas || [])].filter(Boolean).map(s => String(s).toLowerCase());
}

/* Does a programme accept any of the user's fields? `acceptsFields` is the
   programme's own list; `anyField: true` means it states no subject restriction. */
function fieldFit(profile, programme) {
  const theirs = (programme.acceptedFields || []).map(s => String(s).toLowerCase());
  if (programme.anyField === true) return { ok: true, reason: 'open to any field' };
  if (!theirs.length) return { ok: null };
  const mine = userFields(profile);
  if (!mine.length) return { ok: null, becauseProfile: true };
  const hit = mine.find(f => theirs.some(t => t === f || f.includes(t) || t.includes(f)));
  return hit ? { ok: true, reason: hit } : { ok: false, reason: mine.join(', ') };
}

/* ==========================================================================
   Language
   ========================================================================== */

/* Map a German level to a number once, so A1..C2 and C1 compare numerically. */
const GERMAN_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
const levelRank = (lvl) => {
  if (!lvl) return null;
  const i = GERMAN_LEVELS.indexOf(String(lvl).toLowerCase());
  return i < 0 ? null : i;
};

/* The MOI trap, encoded once:
   an English-medium degree NEVER waives a test by itself. It only satisfies an
   English requirement when the programme's own notes accept MOI. "moi_rejected"
   is a hard fail; "unknown" is a manual check. */
function englishStatus(profile, programme) {
  const lang = profile.language || {};
  const ieltsReq = programme.ieltsReq;
  const toeflReq = programme.toeflReq;
  const notes = programme.englishOther || null;      // 'moi_accepted' | 'moi_rejected' | 'other' | null
  const noteText = programme.englishOtherText || null;

  const myIelts = num(lang.ielts);
  const myToefl = num(lang.toefl);
  const moi = lang.englishMediumDegree === true;

  const wantsTest = ieltsReq != null || toeflReq != null || notes === 'moi_rejected';

  return { ieltsReq, toeflReq, notes, noteText, myIelts, myToefl, moi, wantsTest };
}

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

function checkEnglish(profile, programme, t) {
  const e = englishStatus(profile, programme);

  /* nothing stated about English at all */
  if (e.ieltsReq == null && e.toeflReq == null && !e.notes) {
    /* if the programme is not taught in English, there is nothing to check */
    return;
  }

  /* --- scored requirements: passing EITHER stated test is enough --------- */
  const parts = [];
  let satisfied = false;
  let stated = false;

  if (e.ieltsReq != null) {
    stated = true;
    if (e.myIelts == null) parts.push('IELTS ' + e.ieltsReq + ' required');
    else if (e.myIelts >= e.ieltsReq) { satisfied = true; parts.push('IELTS ' + e.myIelts + ' meets ' + e.ieltsReq); }
    else parts.push('IELTS ' + e.myIelts + ' is below ' + e.ieltsReq);
  }
  if (e.toeflReq != null) {
    stated = true;
    if (e.myToefl == null) parts.push('TOEFL iBT ' + e.toeflReq + ' required');
    else if (e.myToefl >= e.toeflReq) { satisfied = true; parts.push('TOEFL ' + e.myToefl + ' meets ' + e.toeflReq); }
    else parts.push('TOEFL ' + e.myToefl + ' is below ' + e.toeflReq);
  }

  if (satisfied) {
    t.pass('English', parts.join('; '));
    return;
  }

  /* --- the MOI path ------------------------------------------------------ */
  if (e.moi) {
    if (e.notes === 'moi_accepted') {
      t.pass('English', 'English-medium degree accepted by this programme' + (e.noteText ? ' — ' + e.noteText : ''));
      return;
    }
    if (e.notes === 'moi_rejected') {
      t.fail('English', 'This programme explicitly does not accept an English-medium degree' +
        (e.noteText ? ' (' + e.noteText + ')' : '') + (stated ? '; ' + parts.join('; ') : ''));
      return;
    }
    /* MOI held, no test, programme says nothing about MOI → manual */
    if (stated || e.notes === 'other') {
      t.unknown('English',
        'Your degree is English-medium but this programme does not say whether it accepts MOI' +
        (stated ? ' (' + parts.join('; ') + ')' : ''), 'englishOther');
      return;
    }
    t.pass('English', 'No English test stated for this programme');
    return;
  }

  /* --- no MOI, no passing score ----------------------------------------- */
  if (stated) {
    const hasAny = e.myIelts != null || e.myToefl != null;
    const text = parts.join('; ');
    if (!hasAny) t.fail('English', text + ' — you have not recorded a test score');
    else t.fail('English', text);
    return;
  }
  if (e.notes === 'other' && e.noteText) {
    t.unknown('English', 'Other English proof stated: "' + e.noteText + '" — check it covers you', 'englishOther');
    return;
  }
  /* taught in English, no score stated anywhere */
  t.unknown('English', 'Programme is taught in English but states no English score', 'ieltsReq');
}

function checkGerman(profile, programme, t) {
  const req = programme.germanReq;
  if (!req) return;
  const lang = profile.language || {};
  const mine = lang.germanLevel;
  const myTest = lang.germanTest || null;

  if (req.level) {
    const need = levelRank(req.level);
    const have = levelRank(mine);
    const label = 'German ' + String(req.level).toUpperCase() + (req.test ? ' (' + req.test + ')' : '');
    if (have == null) {
      t.unknown('German', label + ' required — you have recorded no German level', 'germanLevel');
    } else if (have >= need) {
      t.pass('German', (mine || '').toUpperCase() + ' meets ' + label);
    } else {
      t.fail('German', 'Needs ' + label + ', you have ' + String(mine).toUpperCase());
    }
    return;
  }
  if (req.test) {
    if (myTest && String(myTest).toLowerCase() === String(req.test).toLowerCase()) {
      t.pass('German', req.test + ' recorded');
    } else if (myTest) {
      t.pass('German', req.test + ' required; your ' + myTest + ' is listed — confirm equivalence');
    } else {
      t.unknown('German', req.test + ' required — no German test recorded', 'germanTest');
    }
  }
}

/* ==========================================================================
   Test gates inside "Other requirements" — GRE / GATE / TestAS / SAT / ACT /
   work experience / motivation letter / references. Nothing else in that block
   is allowed to decide eligibility.
   ========================================================================== */
function checkTests(profile, programme, t) {
  const other = programme.otherRequirements || {};
  const mine = profile.tests || {};

  if (other.gre) {
    const g = mine.gre || {};
    const need = other.gre;
    const fails = [];
    const unknown = [];
    for (const section of ['quant', 'verbal', 'aw']) {
      if (need[section] == null) continue;
      const have = num(g[section]);
      if (have == null) fails.push('GRE ' + section + ' ' + need[section] + ' required, you have no ' + section + ' score');
      else if (have < need[section]) fails.push('GRE ' + section + ' ' + have + ' is below ' + need[section]);
      else fails.length; // pass recorded below
    }
    const passes = ['quant', 'verbal', 'aw']
      .filter(s => need[s] != null && num(g[s]) != null && num(g[s]) >= need[s])
      .map(s => 'GRE ' + s + ' ' + num(g[s]) + ' meets ' + need[s]);

    if (fails.length) return t.fail('GRE', fails.concat(passes).join('; '));
    t.pass('GRE', passes.join('; ') || 'GRE requirements met');
  }

  if (other.gate) {
    const have = num(mine.gate);
    if (have == null) t.fail('GATE', 'GATE ' + other.gate + ' required — no GATE score recorded');
    else if (have >= other.gate) t.pass('GATE', 'GATE ' + have + ' meets ' + other.gate);
    else t.fail('GATE', 'GATE ' + have + ' is below ' + other.gate);
  }

  if (other.testas) {
    const have = num(mine.testas);
    if (have == null) t.fail('TestAS', 'TestAS ' + other.testas + ' required — none recorded');
    else if (have >= other.testas) t.pass('TestAS', 'TestAS ' + have + ' meets ' + other.testas);
    else t.fail('TestAS', 'TestAS ' + have + ' is below ' + other.testas);
  }

  if (other.sat) {
    const have = num(mine.sat);
    if (have == null) t.fail('SAT', 'SAT ' + other.sat + ' required — none recorded');
    else if (have >= other.sat) t.pass('SAT', 'SAT ' + have + ' meets ' + other.sat);
    else t.fail('SAT', 'SAT ' + have + ' is below ' + other.sat);
  }

  if (other.act) {
    const have = num(mine.act);
    if (have == null) t.fail('ACT', 'ACT ' + other.act + ' required — none recorded');
    else if (have >= other.act) t.pass('ACT', 'ACT ' + have + ' meets ' + other.act);
    else t.fail('ACT', 'ACT ' + have + ' is below ' + other.act);
  }

  if (other.workExperienceMonths != null) {
    const have = num((profile.academics || {}).workExperienceMonths) || 0;
    if (have >= other.workExperienceMonths) t.pass('Work experience', have + ' months meets ' + other.workExperienceMonths);
    else t.fail('Work experience', 'Needs ' + other.workExperienceMonths + ' months, you have ' + have);
  }

  if (other.motivationLetter) {
    const ready = (profile.documents || {}).motivationLetter === true;
    if (ready) t.pass('Motivation letter', 'marked ready');
    else t.unknown('Motivation letter', 'A motivation letter is required — not marked ready', 'motivationLetter');
  }

  if (other.references) {
    const have = num((profile.documents || {}).references) || 0;
    if (have >= other.references) t.pass('References', have + ' ready, ' + other.references + ' required');
    else t.unknown('References', other.references + ' reference(s) required — ' + have + ' marked ready', 'references');
  }
}

/* ==========================================================================
   One programme, one verdict.
   ========================================================================== */
export function evaluateProgramme(profile, programme, today = new Date().toISOString().slice(0, 10)) {
  const t = makeTrace();
  const target = profile.target || {};
  const acad = profile.academics || {};
  const money = profile.money || {};

  /* ---------- 1. level ---------------------------------------------- */
  if (programme.level) {
    if (programme.level === target.level) t.pass('Level', 'You are applying for ' + target.level);
    else {
      t.fail('Level', 'This is a ' + programme.level + ' programme; you are applying for ' + target.level);
      return finish(programme, t);
    }
  } else {
    t.unknown('Level', 'Programme level is not stated', 'level');
  }

  /* ---------- 2. field (derived from Academics) ---------------------- */
  {
    const fit = fieldFit(profile, programme);
    if (fit.ok === true) t.pass('Field', 'Your ' + fit.reason + ' fits this programme');
    else if (fit.ok === false) t.fail('Field', 'Open to ' + (programme.acceptedFields || []).join(', ') + '; you have ' + fit.reason);
    else if (fit.becauseProfile) t.pending('Field', 'Add your previous degree field to check this');
    else t.unknown('Field', 'Programme does not state which fields it accepts', 'acceptedFields');
  }

  /* ---------- 3. teaching language ----------------------------------- */
  {
    const taught = programme.teachingLanguages || [];
    if (taught.length) {
      const pref = target.language || 'either';
      const okLang = pref === 'either'
        ? taught.length > 0
        : taught.includes(pref === 'english' ? 'english' : 'german');
      if (!okLang && pref !== 'either') {
        t.fail('Teaching language', 'Taught in ' + taught.join('/') + '; you asked for ' + pref + ' only');
      } else if (taught.includes('german') && pref !== 'english') {
        /* German-taught study needs German even if not phrased as a requirement */
        t.pass('Teaching language', 'Taught in ' + taught.join('/'));
      } else {
        t.pass('Teaching language', 'Taught in ' + taught.join('/'));
      }
    } else {
      t.unknown('Teaching language', 'Programme does not state its teaching language', 'teachingLanguages');
    }
  }

  /* ---------- 3b. bachelor entry route (HSSC is not Abitur) ----------
     A Pakistani HSSC alone does not open a German bachelor. The recognised
     routes are: one year of university in the same field, a Studienkolleg with
     the Feststellungsprüfung, or A-Levels/IB. We encode the routes once and
     never let an HSSC-only applicant look Eligible. */
  if (profile.target.level === 'bachelor' && programme.requiresAbiturEquivalent !== false) {
    const school = (acad.schoolQualification || 'hssc');
    const hasAbiturEquivalent = school === 'a_levels' || school === 'ib';
    const oneYear = acad.undergradYearDone === true && acad.undergradYearSameField !== false;
    const kolleg = acad.studienkolleg === true;

    if (hasAbiturEquivalent) {
      t.pass('Entry route', (school === 'ib' ? 'IB' : 'A-Levels') + ' is accepted directly');
    } else if (oneYear) {
      t.pass('Entry route', 'One year of university study counts toward entry');
    } else if (kolleg) {
      t.pass('Entry route', 'Studienkolleg completed');
    } else if (acad.undergradYearDone === true && acad.undergradYearSameField === false) {
      t.fail('Entry route', 'Your one year of university was in a different field; the route needs the same field');
    } else {
      t.fail('Entry route',
        'An HSSC is not the Abitur. Your routes: one year of a Pakistani bachelor in the same field, ' +
        'a Studienkolleg (T-Kurs) with the Feststellungsprüfung, or A-Levels/IB');
    }
  }

  /* ---------- 4. subject ECTS (required background) ------------------ */
  if (programme.subjectEcts && Object.keys(programme.subjectEcts).length) {
    const mine = acad.subjectEcts || null;
    if (!mine) {
      t.pending('Subject credits', 'Add your ECTS breakdown to check ' +
        Object.entries(programme.subjectEcts).map(([k, v]) => v + ' in ' + k).join(', '));
    } else {
      const gaps = [];
      const oks = [];
      for (const [subject, need] of Object.entries(programme.subjectEcts)) {
        const have = num(mine[subject]) || 0;
        if (have >= need) oks.push(have + ' ECTS ' + subject + ' meets ' + need);
        else gaps.push('needs ' + need + ' ECTS in ' + subject + ', you have ' + have);
      }
      if (gaps.length) t.fail('Subject credits', gaps.join('; '));
      else t.pass('Subject credits', oks.join('; '));
    }
  }

  /* ---------- 5. bachelor ECTS (Master only) ------------------------- */
  if (profile.target.level === 'master' && programme.bachelorEctsRequired != null) {
    const have = num(acad.bachelorEcts);
    if (have == null) {
      t.pending('Bachelor ECTS', 'Add your bachelor total ECTS to check the ' + programme.bachelorEctsRequired + ' requirement');
    } else if (have >= programme.bachelorEctsRequired) {
      t.pass('Bachelor ECTS', 'You have ' + have + ' ECTS, programme needs ' + programme.bachelorEctsRequired);
    } else {
      t.fail('Bachelor ECTS', 'Needs ' + programme.bachelorEctsRequired + ' ECTS, you have ' + have +
        ' (a 4-year Pakistani BS is normally about 180 ECTS)' +
        (programme.bridgePossible ? ' — this programme offers a bridge semester' : ''));
    }
  }

  /* ---------- 6. minimum GPA (German scale, lower is better) --------- */
  if (programme.minGpaGerman != null) {
    const mine = acad.gpaGerman != null ? acad.gpaGerman : (acad.gpaConverted || {}).value;
    if (mine == null) {
      t.pending('GPA', 'Add your grades so the German-scale conversion can be checked against ' + programme.minGpaGerman);
    } else if (gpaPasses(mine, programme.minGpaGerman)) {
      t.pass('GPA', 'Your German grade ' + mine + ' meets ' + programme.minGpaGerman + ' (lower is better)');
    } else {
      t.fail('GPA', 'Needs ' + programme.minGpaGerman + ' or better on the German scale, you have ' + mine);
    }
  }

  /* ---------- 7-9. English (IELTS / TOEFL / MOI notes) ---------------- */
  checkEnglish(profile, programme, t);

  /* ---------- 10. German -------------------------------------------- */
  checkGerman(profile, programme, t);

  /* ---------- 11. other test gates ---------------------------------- */
  checkTests(profile, programme, t);

  /* ---------- 12. money --------------------------------------------- */
  {
    const tuition = programme.tuitionPerSemester;
    if (tuition == null) {
      /* An unknown tuition is NOT free. Baden-Württemberg and TUM both charge. */
      t.unknown('Tuition', 'Tuition for non-EU students is not stated — a public university in ' +
        (programme.state || 'Baden-Württemberg or Bavaria') + ' may charge', 'tuitionPerSemester');
    } else {
      const budget = num(money.maxTuitionPerSemester);
      if (budget == null) {
        t.pending('Tuition', 'Add your tuition budget to check €' + tuition + '/semester');
      } else if (tuition <= budget) {
        t.pass('Tuition', '€' + tuition + '/semester is within your €' + budget + ' budget');
      } else {
        t.fail('Tuition', 'Charges €' + tuition + '/semester for non-EU students; your budget is €' + budget);
      }
    }
    if (programme.semesterContribution != null) {
      const budget = num(money.maxSemesterContribution);
      if (budget == null) t.pending('Semester contribution', 'Add your contribution budget to check €' + programme.semesterContribution);
      else if (programme.semesterContribution <= budget) t.pass('Semester contribution', '€' + programme.semesterContribution + ' is within €' + budget);
      else t.fail('Semester contribution', '€' + programme.semesterContribution + ' exceeds your €' + budget);
    }
  }

  /* ---------- 13. intake + non-EU deadline -------------------------- */
  {
    const intake = programme.intake || programme.intakes || null;
    const wanted = target.intake || null;
    if (intake && wanted && wanted !== 'flexible') {
      const list = Array.isArray(intake) ? intake : [intake];
      if (list.includes(wanted)) t.pass('Intake', 'Offered for ' + wanted);
      else t.fail('Intake', 'Offered for ' + list.join(', ') + '; you want ' + wanted);
    } else if (!intake) {
      t.unknown('Intake', 'Programme does not state which intakes it offers', 'intake');
    }

    const deadline = programme.deadlineNonEu || null;
    if (!deadline) {
      t.unknown('Deadline', 'Non-EU application deadline is not stated', 'deadlineNonEu');
    } else {
      const days = daysToDeadline(deadline, today);
      if (days < 0) t.fail('Deadline', 'The non-EU deadline was ' + deadline + ' — ' + Math.abs(days) + ' days ago');
      else t.pass('Deadline', 'Non-EU deadline ' + deadline + ' is in ' + days + ' days');
    }
  }

  return finish(programme, t);
}

/* ==========================================================================
   Soft ranking — never a fail. Only nudges the order inside a verdict.
   ========================================================================== */
function softScore(profile, programme, t) {
  let score = 0;
  const tags = [];
  const acad = profile.academics || {};
  const money = profile.money || {};

  const mine = acad.gpaGerman != null ? acad.gpaGerman : (acad.gpaConverted || {}).value;
  if (programme.minGpaGerman != null && mine != null) {
    const margin = programme.minGpaGerman - mine;      // positive margin is good
    score += Math.max(0, Math.min(1, margin)) * 3;
    if (margin > 0.3) tags.push('comfortable GPA margin');
  }

  const ielts = num((profile.language || {}).ielts);
  if (programme.ieltsReq != null && ielts != null && ielts > programme.ieltsReq) {
    score += 1; tags.push('IELTS above the bar');
  }

  if (programme.tuitionPerSemester != null && num(money.maxTuitionPerSemester) != null) {
    const headroom = num(money.maxTuitionPerSemester) - programme.tuitionPerSemester;
    if (headroom > 0) { score += Math.min(2, headroom / 1000); tags.push('budget headroom €' + headroom); }
  }

  const days = daysToDeadline(programme.deadlineNonEu, new Date().toISOString().slice(0, 10));
  if (days != null && days >= 0 && days <= 60) { score += 1; tags.push('deadline in ' + days + ' days'); }

  if ((programme.city || '') && (profile.preferences || {}).cities) {
    if ((profile.preferences.cities || []).includes(programme.city)) { score += 2; tags.push('city you preferred'); }
  }

  return { score: Math.round(score * 10) / 10, tags };
}

function finish(programme, t) {
  const verdict = verdictFor(t);
  const pending = t.reasons.filter(r => r.status === 'pending').map(r => r.check);
  return {
    id: programme.id,
    verdict,
    title: programme.title,
    university: programme.university,
    city: programme.city,
    state: programme.state,
    level: programme.level,
    links: { programme: programme.link || null, university: programme.universityLink || null },
    reasons: t.reasons,
    failed: t.failed,
    missing: t.missing,
    /* the spec's promise: every result says why, in plain words */
    headline: t.failed.length
      ? t.failed[0].text
      : t.missing.length
        ? 'Not stated: ' + t.missing.map(m => m.check).join(', ')
        : pending.length
          ? 'Waiting on your profile: ' + pending.join(', ')
          : 'Meets every stated requirement',
    pending,
    provisional: pending.length > 0
  };
}

/* ==========================================================================
   Scholarships — the smaller, separate rule set.
   Hard filters: nationality, level, field, GPA, language, age, deadline not
   passed, and coverage vs the user's funding need.
   ========================================================================== */
export function evaluateScholarship(profile, s, today = new Date().toISOString().slice(0, 10)) {
  const t = makeTrace();
  const target = profile.target || {};
  const acad = profile.academics || {};
  const money = profile.money || {};
  const extras = profile.scholarshipExtras || {};

  /* level */
  if (s.levels && s.levels.length) {
    if (s.levels.includes(target.level)) t.pass('Level', 'Open to ' + target.level + ' students');
    else { t.fail('Level', 'Open to ' + s.levels.join('/') + ' only'); return finishScholarship(s, t); }
  } else t.unknown('Level', 'Eligible levels not stated', 'levels');

  /* nationality */
  if (s.nationalities && s.nationalities.length) {
    const nat = ((profile.nationality || {}).nationality || '').toUpperCase();
    if (!nat) t.pending('Nationality', 'Add your nationality to check eligibility');
    else if (s.nationalities.map(x => x.toUpperCase()).includes(nat)) t.pass('Nationality', nat + ' is eligible');
    else t.fail('Nationality', 'Open to ' + s.nationalities.join(', ') + ' only');
  } else if (s.nationalities === null) {
    t.unknown('Nationality', 'Eligible nationalities not stated', 'nationalities');
  } else {
    t.pass('Nationality', 'Open to all nationalities');
  }

  /* field */
  if (s.fields && s.fields.length) {
    const mine = userFields(profile);
    if (!mine.length) t.pending('Field', 'Add your degree field to check this');
    else if (mine.some(f => s.fields.some(x => x.toLowerCase() === f || f.includes(x.toLowerCase()) || x.toLowerCase().includes(f)))) {
      t.pass('Field', 'Your field is accepted');
    } else t.fail('Field', 'Open to ' + s.fields.join(', ') + ' only');
  }

  /* GPA */
  if (s.minGpaGerman != null) {
    const mine = acad.gpaGerman != null ? acad.gpaGerman : (acad.gpaConverted || {}).value;
    if (mine == null) t.pending('GPA', 'Add your grades to check the ' + s.minGpaGerman + ' requirement');
    else if (gpaPasses(mine, s.minGpaGerman)) t.pass('GPA', 'Your German grade ' + mine + ' meets ' + s.minGpaGerman);
    else t.fail('GPA', 'Needs ' + s.minGpaGerman + ' or better, you have ' + mine);
  }

  /* language */
  if (s.ieltsReq != null) {
    const mine = num((profile.language || {}).ielts);
    if (mine == null) t.unknown('IELTS', 'IELTS ' + s.ieltsReq + ' required — no score recorded', 'ielts');
    else if (mine >= s.ieltsReq) t.pass('IELTS', mine + ' meets ' + s.ieltsReq);
    else t.fail('IELTS', mine + ' is below ' + s.ieltsReq);
  }
  if (s.germanReq) {
    const need = levelRank(s.germanReq.level);
    const have = levelRank((profile.language || {}).germanLevel);
    if (have == null) t.unknown('German', 'German ' + s.germanReq.level + ' required', 'germanLevel');
    else if (have >= need) t.pass('German', 'Your German level meets ' + s.germanReq.level);
    else t.fail('German', 'Needs German ' + s.germanReq.level);
  }

  /* age limit — the only place a date of birth is used */
  if (s.maxAge != null) {
    const dob = (profile.scholarshipExtras || {}).dateOfBirth || (profile.personal || {}).dateOfBirth;
    if (!dob) t.pending('Age', 'Add your date of birth to check the age limit of ' + s.maxAge);
    else {
      const age = ageAt(dob, s.deadline || today);
      if (age == null) t.pending('Age', 'Date of birth could not be read');
      else if (age <= s.maxAge) t.pass('Age', age + ' at the deadline, limit is ' + s.maxAge);
      else t.fail('Age', 'You will be ' + age + ' at the deadline; the limit is ' + s.maxAge);
    }
  }

  /* deadline */
  if (s.deadline) {
    const days = daysToDeadline(s.deadline, today);
    if (days < 0) { t.fail('Deadline', 'Closed on ' + s.deadline); return finishScholarship(s, t); }
    t.pass('Deadline', 'Closes ' + s.deadline + ' (' + days + ' days)');
  } else t.unknown('Deadline', 'Deadline not stated', 'deadline');

  /* coverage vs funding need */
  {
    const need = money.fundingNeed || null;
    const covers = s.covers || null;   // 'full' | 'tuition_only' | 'partial' | 'stipend_only' | null
    if (!covers) t.unknown('Coverage', 'What the scholarship actually covers is not stated', 'covers');
    else if (need === 'full' && covers !== 'full') {
      t.fail('Coverage', 'You need a full scholarship; this covers ' + describeCoverage(covers));
    } else {
      t.pass('Coverage', 'Covers ' + describeCoverage(covers) + (need ? ' — matches your funding need' : ''));
    }
  }

  return finishScholarship(s, t);
}

function describeCoverage(c) {
  return ({
    full: 'tuition and living costs',
    tuition_only: 'tuition only',
    stipend_only: 'a monthly stipend only',
    partial: 'only part of the cost'
  })[c] || c;
}

function ageAt(dob, at) {
  const b = d(dob), a = d(at);
  if (Number.isNaN(b.getTime())) return null;
  let age = a.getUTCFullYear() - b.getUTCFullYear();
  const m = a.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && a.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

function finishScholarship(s, t) {
  const verdict = verdictFor(t);
  const pending = t.reasons.filter(r => r.status === 'pending').map(r => r.check);
  return {
    id: s.id,
    verdict,
    title: s.title,
    provider: s.provider,
    link: s.link || null,
    reasons: t.reasons,
    failed: t.failed,
    missing: t.missing,
    headline: t.failed.length ? t.failed[0].text
      : t.missing.length ? 'Not stated: ' + t.missing.map(m => m.check).join(', ')
        : pending.length ? 'Waiting on your profile: ' + pending.join(', ')
          : 'Meets every stated requirement',
    pending,
    provisional: pending.length > 0
  };
}

/* ==========================================================================
   Batch entry points
   ========================================================================== */
export function matchProgrammes(profile, programmes, today) {
  return programmes
    .map(p => {
      const r = evaluateProgramme(profile, p, today);
      const soft = softScore(profile, p, r.reasons);
      return { ...r, score: soft.score, tags: soft.tags };
    })
    .sort((a, b) => (VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict]) || (b.score - a.score));
}

export function matchScholarships(profile, scholarships, today) {
  return scholarships
    .map(s => evaluateScholarship(profile, s, today))
    .sort((a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict]);
}

/* ==========================================================================
   Profile completeness — weighted, and it counts only what the engine reads.
   Step 1 alone must already produce matches, so it is worth the most.
   ========================================================================== */
export const COMPLETENESS = [
  ['target.level', 10, 1], ['target.language', 5, 1], ['target.intake', 3, 1],
  ['nationality.nationality', 6, 1],
  ['academics.bachelorField', 9, 2], ['academics.gpaOriginal', 8, 2], ['academics.bachelorEcts', 6, 2],
  ['academics.subjectEcts', 6, 2],
  ['language.ielts', 8, 2], ['language.englishMediumDegree', 3, 2],
  ['tests.gre', 4, 2], ['language.germanLevel', 3, 2],
  ['money.maxTuitionPerSemester', 8, 3], ['money.fundingNeed', 6, 3], ['money.blockedAccount', 4, 3]
];

const pick = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

export function completeness(profile) {
  let done = 0, total = 0;
  const byStep = { 1: { done: 0, total: 0 }, 2: { done: 0, total: 0 }, 3: { done: 0, total: 0 } };
  for (const [path, weight, step] of COMPLETENESS) {
    total += weight;
    byStep[step].total += weight;
    const v = pick(profile, path);
    const filled = v !== null && v !== undefined && v !== '' &&
      !(typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(x => x == null));
    if (filled) { done += weight; byStep[step].done += weight; }
  }
  const pct = (o) => (o.total ? Math.round((o.done / o.total) * 100) : 0);
  return {
    pct: Math.round((done / total) * 100),
    steps: { 1: pct(byStep[1]), 2: pct(byStep[2]), 3: pct(byStep[3]) },
    step1Complete: byStep[1].done === byStep[1].total
  };
}

/* Which checks are still pending because the profile is short — shown on the
   results page so a Step-1-only user understands the verdicts they see. */
export function pendingChecks(profile) {
  const out = [];
  const a = profile.academics || {};
  const m = profile.money || {};
  if (a.gpaOriginal == null) out.push('GPA');
  if (a.bachelorEcts == null) out.push('Bachelor ECTS');
  if (a.subjectEcts == null) out.push('Subject credits');
  if (m.maxTuitionPerSemester == null) out.push('Tuition budget');
  if ((profile.language || {}).ielts == null) out.push('English score');
  return out;
}
