/* ==========================================================================
   MATCHING ENGINE — faithful JS port of src/matching/match.ts (Rules 1-17)
   Pure functions. `today` is always passed in. Never call new Date() here.
   In the real build this file is NOT duplicated: it is the same module,
   compiled from src/matching/. Kept identical here so the prototype computes
   every card, gap and reason for real.
   ========================================================================== */
window.Match = (function () {

  const GL = ['none', 'A1', 'A2', 'B1', 'B2', 'C1'];
  const INCOME = ['low', 'lower_mid', 'mid', 'high'];
  const BUCKET_ORDER = { meets: 0, almost: 1, next_cycle: 2, hidden: 3 };

  /* ---------- date helpers ---------- */
  const d = (s) => new Date(s + 'T00:00:00Z');
  const daysBetween = (a, b) => Math.round((d(b).getTime() - d(a).getTime()) / 86400000);
  function addYears(s, n) {
    const x = d(s); x.setUTCFullYear(x.getUTCFullYear() + n); return x.toISOString().slice(0, 10);
  }
  function ageAt(dob, at) {
    const b = d(dob), a = d(at);
    let age = a.getUTCFullYear() - b.getUTCFullYear();
    const m = a.getUTCMonth() - b.getUTCMonth();
    if (m < 0 || (m === 0 && a.getUTCDate() < b.getUTCDate())) age--;
    return age;
  }

  /* ---------- grade helpers (Rule 1: always an ESTIMATE) ---------- */
  function estimateGermanGrade(cgpa, scale, passMark) {
    const g = 1 + (3 * (scale - cgpa)) / (scale - passMark);
    const clamped = Math.min(4, Math.max(1, g));
    return Math.round(clamped * 10 + 1e-9) / 10;
  }
  const cgpaTo4 = (cgpa, scale) => (cgpa * 4) / scale;

  /* ---------- freshness (Rule 17) ---------- */
  function freshness(lastVerified, today) {
    const days = daysBetween(lastVerified, today);
    const state = days >= 180 ? 'stale' : days >= 90 ? 'recheck' : days <= 30 ? 'fresh' : 'ok';
    return { days, state };
  }

  /* ---------- the matcher ---------- */
  function match(p, t, l, today) {
    const provisional = p.completenessPct < 80;   // Rule 12
    const reasons = [];
    const gaps = [];
    const badges = [];
    let failed = false;
    let graduationBlocked = false;

    const pass = (check, required, yours) => reasons.push({ check, required, yours, status: 'pass' });
    const info = (check, required, yours) => reasons.push({ check, required, yours, status: 'info' });
    const fail = (check, required, yours) => { failed = true; reasons.push({ check, required, yours, status: 'fail' }); };
    const gap = (check, required, yours, msg) => { gaps.push(msg); reasons.push({ check, required, yours, status: 'gap' }); };

    const done = (bucket) => ({
      listingId: l.id, bucket, provisional, reasons, gaps, badges,
      matchedTargets: bucket === 'hidden' ? [] : [t.label || (t.isPrimary ? 'Primary' : 'Backup')]
    });

    /* listing must be live and fresh (Rule 17) */
    const fr = freshness(l.lastVerified, today);
    if (l.status !== 'verified' || fr.state === 'stale') return done('hidden');
    if (fr.state === 'fresh') badges.push('fresh');
    if (fr.state === 'recheck' || (l.openErrorReports || 0) >= 2) badges.push('recheck');

    /* degree */
    if (!l.degreeLevels.includes(t.degree)) { fail('Degree level', l.degreeLevels.join('/'), t.degree); return done('hidden'); }
    pass('Degree level', l.degreeLevels.join('/'), t.degree);

    /* nationality */
    if (l.allowedCountries && l.allowedCountries.length) {
      if (!l.allowedCountries.includes(p.nationality)) fail('Nationality', l.allowedCountries.join(', '), p.nationality);
      else pass('Nationality', l.allowedCountries.join(', '), p.nationality);
    }

    /* age at deadline (Rule 5) */
    if (l.maxAge != null && l.deadline) {
      const age = ageAt(p.dateOfBirth, l.deadline);
      if (age == null || Number.isNaN(age)) gap('Age at deadline', '<= ' + l.maxAge, 'not provided', 'Add your date of birth');
      else if (age > l.maxAge) fail('Age at deadline', '<= ' + l.maxAge, String(age));
      else pass('Age at deadline', '<= ' + l.maxAge, String(age));
    }

    /* graduation timing (Rule 7) */
    if (t.degree === 'master' && p.currentLevel === 'bachelor' && p.expectedCompletionYear != null) {
      if (p.expectedCompletionYear > t.intakeYear) {
        graduationBlocked = true;
        reasons.push({ check: 'Graduation timing', required: 'finish by ' + t.intakeYear, yours: String(p.expectedCompletionYear), status: 'fail' });
      } else pass('Graduation timing', 'finish by ' + t.intakeYear, String(p.expectedCompletionYear));
    }

    /* CGPA (Rules 1-2) */
    if (l.minCgpa != null && t.degree !== 'bachelor') {
      if (p.bachelorCgpa == null || p.bachelorScale == null) gap('CGPA', '>= ' + l.minCgpa + '/4.0', 'not provided', 'Add your CGPA and scale');
      else {
        const c4 = cgpaTo4(p.bachelorCgpa, p.bachelorScale);
        if (c4 < l.minCgpa) fail('CGPA', '>= ' + l.minCgpa + '/4.0', c4.toFixed(2) + '/4.0');
        else pass('CGPA', '>= ' + l.minCgpa + '/4.0', c4.toFixed(2) + '/4.0');
      }
    }
    if (l.germanGradeCutoff != null && t.degree !== 'bachelor') {
      if (p.bachelorCgpa == null || p.bachelorScale == null) gap('German grade (estimate)', '<= ' + l.germanGradeCutoff, 'not provided', 'Add your CGPA and scale');
      else {
        const est = estimateGermanGrade(p.bachelorCgpa, p.bachelorScale, p.passMark == null ? p.bachelorScale / 2 : p.passMark);
        const diff = Math.round((est - l.germanGradeCutoff) * 10) / 10;
        const yours = '~' + est.toFixed(1) + " (estimate - the university's own conversion decides)";
        if (diff <= 0) { pass('German grade (estimate)', '<= ' + l.germanGradeCutoff, yours); if (diff >= -0.2) badges.push('borderline_estimate'); }
        else if (diff <= 0.2) gap('German grade (estimate)', '<= ' + l.germanGradeCutoff, yours, 'Borderline - confirm with the university');
        else fail('German grade (estimate)', '<= ' + l.germanGradeCutoff, yours);
      }
    }
    if (l.minPercentage != null) {
      const pct = t.degree === 'bachelor' ? p.interPct : p.bachelorPct;
      if (pct == null) gap('Percentage', '>= ' + l.minPercentage + '%', 'not provided', 'Add your marks scale');
      else if (pct < l.minPercentage) fail('Percentage', '>= ' + l.minPercentage + '%', pct + '%');
      else pass('Percentage', '>= ' + l.minPercentage + '%', pct + '%');
    }

    /* prior field */
    if (l.requiredPriorFields && l.requiredPriorFields.length) {
      if (!p.bachelorField) gap('Prior field', l.requiredPriorFields.join('/'), 'not provided', 'Add your Bachelor field');
      else if (!l.requiredPriorFields.map(x => x.toLowerCase()).includes(p.bachelorField.toLowerCase())) fail('Prior field', l.requiredPriorFields.join('/'), p.bachelorField);
      else pass('Prior field', l.requiredPriorFields.join('/'), p.bachelorField);
    }

    /* German (Rule 8): hard for programs, soft for scholarships */
    if (l.minGermanLevel && l.minGermanLevel !== 'none') {
      const need = GL.indexOf(l.minGermanLevel);
      const have = p.germanLevel == null ? (provisional ? null : 0) : GL.indexOf(p.germanLevel);
      const label = 'German ' + l.minGermanLevel;
      if (have == null) gap(label, l.minGermanLevel, 'not provided', 'Add your German level');
      else if (have >= need) pass(label, l.minGermanLevel, p.germanLevel || 'none');
      else if (l.kind === 'program') {
        if (need - have === 1 && l.deadline && daysBetween(today, l.deadline) >= 182)
          gap(label, l.minGermanLevel, p.germanLevel || 'none', 'Reachable with one more German level');
        else fail(label, l.minGermanLevel, p.germanLevel || 'none');
      } else gap(label, l.minGermanLevel, p.germanLevel || 'none', 'Needs German ' + l.minGermanLevel);
    }

    /* funding need vs tuition (Rule 10) */
    if (l.kind === 'program' && (l.tuitionPerSemester || 0) > 0) {
      if (p.fundingNeed === 'full_only') fail('Tuition', 'none', l.tuitionPerSemester + '/semester');
      else badges.push('tuition');
    }

    /* Bachelor entry route for HSSC holders (Rule 13) */
    const hsscHolder = p.currentLevel === 'matric' || p.currentLevel === 'intermediate';
    if (l.kind === 'program' && t.degree === 'bachelor' && hsscHolder) {
      switch (l.hsscEntryRoute || 'unknown') {
        case 'direct': pass('Entry route', 'HSSC accepted directly', 'HSSC'); break;
        case 'studienkolleg_required':
          if (p.studienkollegOk === false) fail('Entry route', 'Studienkolleg first', 'not willing');
          else gap('Entry route', 'Studienkolleg first', 'HSSC only', 'Needs Studienkolleg (entrance exam) first');
          break;
        case 'one_year_university_required':
          gap('Entry route', '1 year of university first', 'HSSC only', 'Needs 1 year of university study first'); break;
        default:
          gap('Entry route', 'unknown', 'HSSC only', 'Confirm entry route for Pakistani HSSC on the official page');
      }
      if (l.hsscGroups && p.hsscGroup && !l.hsscGroups.includes(p.hsscGroup))
        gap('HSSC group', l.hsscGroups.join('/'), p.hsscGroup, 'Subject group may not fit - confirm');
      if (p.ibccStatus !== 'done' && p.ibccStatus !== 'not_needed')
        gap('IBCC equivalence', 'done', p.ibccStatus || 'not provided', 'Complete IBCC equivalence');
    }

    /* APS (Rule 14): soft, 90-day window */
    if (l.apsRequired === 'yes' && p.apsStatus !== 'certificate_ready') {
      if (l.deadline && daysBetween(today, l.deadline) <= 90)
        gap('APS certificate', 'required', p.apsStatus || 'not started', 'APS certificate needed before you apply - start now');
      else info('APS certificate', 'required', p.apsStatus || 'not started');
    }

    /* income (Rule 16) */
    if (l.maxIncomeBracket) {
      if (!p.incomeBracket || p.incomeBracket === 'prefer_not_to_say') gap('Income bracket', '<= ' + l.maxIncomeBracket, 'not provided', 'Income bracket not provided (optional)');
      else if (INCOME.indexOf(p.incomeBracket) > INCOME.indexOf(l.maxIncomeBracket)) fail('Income bracket', '<= ' + l.maxIncomeBracket, p.incomeBracket);
      else pass('Income bracket', '<= ' + l.maxIncomeBracket, p.incomeBracket);
    }

    /* gender, work experience */
    if (l.genderRestriction) {
      if (!p.gender || p.gender === 'prefer_not_to_say') gap('Gender', l.genderRestriction, 'not provided', 'Gender-restricted - add gender to confirm');
      else if (p.gender !== l.genderRestriction) fail('Gender', l.genderRestriction, p.gender);
      else pass('Gender', l.genderRestriction, p.gender);
    }
    if (l.minWorkExpMonths) {
      const w = p.workExpMonths || 0;
      if (w < l.minWorkExpMonths) gap('Work experience', l.minWorkExpMonths + ' months', w + ' months', 'Needs ' + l.minWorkExpMonths + ' months of experience');
      else pass('Work experience', l.minWorkExpMonths + ' months', w + ' months');
    }

    /* IELTS (Rules 3-4): ignored completely when not required */
    if (l.ieltsRequired) {
      const need = l.minIelts != null ? 'IELTS ' + l.minIelts : 'IELTS';
      if (p.ielts.status !== 'taken') {
        gap(need, need, p.ielts.status || 'not taken', 'Needs ' + need + ' - you have: ' + (p.ielts.status === 'planned' ? 'planned' : 'not taken'));
      } else {
        const expired = !!(p.ielts.date && l.deadline && addYears(p.ielts.date, 2) < l.deadline);
        if (expired) gap(need, need, 'expired (' + p.ielts.date + ')', 'IELTS expired / retake needed');
        else if (l.minIelts != null && (p.ielts.overall || 0) < l.minIelts) gap(need, need, String(p.ielts.overall), 'IELTS ' + p.ielts.overall + ' is below ' + l.minIelts);
        else pass(need, need, String(p.ielts.overall));
      }
    }

    /* ECTS (Rule 6) */
    if (l.requiredEcts && !p.hasEctsBreakdown) gap('Subject credits', JSON.stringify(l.requiredEcts), 'not entered', 'Confirm subject credits');

    /* ---------- decide bucket ---------- */
    const passed = !!l.deadline && l.deadline < today;
    if (failed) return done('hidden');
    if (graduationBlocked) return done(l.isAnnual ? 'next_cycle' : 'hidden');
    if (passed) return done(l.isAnnual ? 'next_cycle' : 'hidden');
    return done(gaps.length === 0 ? 'meets' : 'almost');
  }

  /* ---------- multi-target aggregation (Rule 15) ---------- */
  function matchAll(p, targets, listings, today) {
    const out = [];
    for (const l of listings) {
      const per = targets.map(t => match(p, t, l, today));
      if (!per.length) continue;
      const best = per.slice().sort((a, b) => BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket])[0];
      out.push(Object.assign({}, best, { matchedTargets: per.filter(r => r.bucket !== 'hidden').flatMap(r => r.matchedTargets) }));
    }
    return out;
  }
  const visible = (rs) => rs.filter(r => r.bucket !== 'hidden');

  /* ---------- ranking ---------- */
  function rank(results, listings, targets) {
    const byId = new Map(listings.map(l => [l.id, l]));
    const wanted = new Set(targets.flatMap(t => t.fields.map(f => f.toLowerCase())));
    const key = (r) => {
      const l = byId.get(r.listingId);
      const funding = l.fundingType === 'full' || (l.kind === 'program' && !(l.tuitionPerSemester || 0)) ? 0 : 1;
      const field = l.fieldCategory && wanted.has(l.fieldCategory.toLowerCase()) ? 0 : 1;
      const fresh = r.badges.includes('recheck') ? 1 : 0;
      return [BUCKET_ORDER[r.bucket], l.deadline || '9999-12-31', funding, field, fresh];
    };
    return results.slice().sort((a, b) => {
      const ka = key(a), kb = key(b);
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
      return 0;
    });
  }

  return {
    GL, INCOME, BUCKET_ORDER,
    daysBetween, addYears, ageAt, estimateGermanGrade, cgpaTo4,
    freshness, match, matchAll, visible, rank
  };
})();
