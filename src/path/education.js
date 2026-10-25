/* ==========================================================================
   Education years, anabin status and the ZAB rule.

   A Pakistani school record is measured in YEARS OF EDUCATION, not in degrees:

       Matric / SSC              10 years
       Intermediate / HSSC       12 years   (A-Levels and IB also leave at 12)
       Bachelor                  12 + 0.5 × semesters completed
       Master                    16 + 0.5 × semesters completed

   So two semesters of a Pakistani bachelor is 13 years, four is 14, a completed
   four-year (8-semester) BS is 16. The thresholds the app enforces:

       Bachelor programme   at least 13 years   (2 semesters of a bachelor), or
                            an Abitur-equivalent school leaving certificate
                            (A-Levels / IB) which is accepted at 12
       Master programme     a completed four-year bachelor = 16 years
       PhD programme        a completed master = 18 years

   Under the threshold the result is Not eligible and the missing years are
   named. It is never softened into "check manually": the number is arithmetic.

   anabin (KMK / ZAB) rates an institution H+, H+/- or H-. For Pakistani
   applicants APS is never required — HEC attestation (and IBCC for HSSC) is the
   route. anabin does however decide the ZAB question:

       H+     recognition stated, no ZAB statement needed
       H+/-   conditional — a ZAB statement may be required
       H-     not recognised — a ZAB statement is required
       absent no anabin record — treat as unknown, never as H+

   Pure functions; nothing here reads the clock or the network.
   ========================================================================== */

export const EDU_LEVELS = ['matric', 'hssc', 'bachelor', 'master'];

export const EDU_LABEL = {
  matric: 'Matric / SSC (10 years)',
  hssc: 'Intermediate / HSSC (12 years)',
  bachelor: 'Bachelor',
  master: 'Master'
};

/* School-leaving certificates that are accepted in place of the Abitur. */
export const ABITUR_EQUIVALENT = ['a_levels', 'ib'];

export const SEMESTERS = { bachelor: 8, master: 4 };

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/* Years of education reached by a single entry. */
export function entryYears(entry) {
  if (!entry || !entry.level) return 0;
  const sem = num(entry.semestersDone);
  switch (entry.level) {
    case 'matric': return 10;
    case 'hssc': return 12;
    case 'bachelor': {
      const done = sem == null ? (entry.completed === true ? SEMESTERS.bachelor : 0) : Math.min(sem, 12);
      return 12 + done * 0.5;
    }
    case 'master': {
      const done = sem == null ? (entry.completed === true ? SEMESTERS.master : 0) : Math.min(sem, 8);
      return 16 + done * 0.5;
    }
    default: return 0;
  }
}

const best = (entries, level) => entries
  .filter(e => e && e.level === level)
  .sort((a, b) => entryYears(b) - entryYears(a))[0] || null;

/* ==========================================================================
   The one summary the UI, the engine and the server all read.
   ========================================================================== */
export function educationSummary(profile) {
  const entries = Array.isArray((profile.education || {}).entries) ? profile.education.entries : [];
  const matric = best(entries, 'matric');
  const hssc = best(entries, 'hssc');
  const bachelor = best(entries, 'bachelor');
  const master = best(entries, 'master');

  const years = Math.max(
    matric ? 10 : 0,
    hssc ? 12 : 0,
    bachelor ? entryYears(bachelor) : 0,
    master ? entryYears(master) : 0
  );

  const bachelorCompleted = !!(bachelor && (bachelor.completed === true || entryYears(bachelor) >= 16));
  const masterCompleted = !!(master && (master.completed === true || entryYears(master) >= 18));
  const abiturEquivalent = !!(hssc && ABITUR_EQUIVALENT.includes(hssc.school));

  /* The institution that has to be checked in anabin: the degree the applicant
     is entering with. Bachelor entry for a bachelor/master target, master entry
     for a PhD. */
  const entryDegree = master ? master : bachelor;
  const anabinStatus = entryDegree ? (entryDegree.anabinStatus || null) : null;

  const canApply = {
    bachelor: years >= 13 || abiturEquivalent,
    master: bachelorCompleted && years >= 16,
    phd: masterCompleted && years >= 18
  };

  const why = {
    bachelor: abiturEquivalent
      ? 'Your A-Levels/IB is accepted in place of the Abitur'
      : years >= 13
        ? years + ' years of education (the minimum is 13 — two semesters of a bachelor)'
        : 'A German bachelor needs at least 13 years of education — two semesters of a Pakistani bachelor after your HSSC. You have ' + years + '.',
    master: canApply.master
      ? 'A completed four-year bachelor (' + years + ' years of education)'
      : 'A master needs a completed four-year bachelor (16 years of education). You have ' + years + ' and ' + (bachelorCompleted ? 'a completed degree' : 'no completed bachelor') + '.',
    phd: canApply.phd
      ? 'A completed master (' + years + ' years of education)'
      : 'A PhD needs a completed master (18 years of education). You have ' + years + '.'
  };

  return {
    years,
    entries,
    matric, hssc, bachelor, master,
    bachelorCompleted, masterCompleted, abiturEquivalent,
    anabinStatus,
    canApply, why,
    /* what the profile still cannot answer */
    missing: [
      !hssc ? 'school certificate' : null,
      !bachelor ? 'bachelor record' : null
    ].filter(Boolean)
  };
}

/* ==========================================================================
   anabin → ZAB
   ========================================================================== */
export function zabRule(status) {
  const s = status == null ? null : String(status).replace(/\s+/g, '');
  if (s === 'H+') {
    return {
      status: 'H+', zabRequired: false, conditional: false,
      text: 'Your institution is H+ in anabin — recognised, no ZAB statement needed'
    };
  }
  if (s === 'H+/-' || s === 'H+-') {
    return {
      status: 'H+/-', zabRequired: false, conditional: true,
      text: 'Your institution is H+/- in anabin — recognition is conditional, a ZAB statement may be required. Confirm with the university'
    };
  }
  if (s === 'H-') {
    return {
      status: 'H-', zabRequired: true, conditional: false,
      text: 'Your institution is H- in anabin — not recognised. A ZAB statement (Zeugnisbewertung) is required'
    };
  }
  return {
    status: null, zabRequired: null, conditional: false,
    text: 'No anabin record found for your institution — a ZAB statement is the safe assumption. Check anabin before you apply'
  };
}

/* APS is never required for Pakistani applicants; the note is here so the rule
   is stated once and cannot drift. */
export const APS_NOTE = 'Pakistani applicants need HEC attestation (and IBCC for HSSC), not APS. APS is China, India, Vietnam and Mongolia.';
