import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Notice, Progress, Icon } from './ui.jsx';
import { educationSummary, zabRule, EDU_LABEL, entryYears } from '../path/education.js';

/* ==========================================================================
   ScholarPath, embedded in the pages students already use.

   There is no separate "find my path" page and no separate card: the fields are
   steps of the profile EDIT flow (/wizard), /profile shows what is saved with a
   link back into the right step, and the verdict appears on the programmes
   themselves.

   The form is numbered 1 → 6 in the order the student answers it:

     1  What you are applying for
     2  Languages
     3  Education      (records + anabin status + ZAB)
     4  ECTS           (master and above only)
     5  Test requirements
     6  Money occasion — budget, funding need, blocked account

   Nothing here asks for a passport or bank number, and nothing is kept that the
   engine never reads.
   ========================================================================== */

export const VERDICT_META = {
  eligible: { label: 'Eligible', tone: 'ok', icon: 'check' },
  check_manually: { label: 'Check yourself', tone: 'wn', icon: 'alert' },
  not_eligible: { label: 'Not eligible', tone: 'er', icon: 'close' }
};

const STATUS_ICON = { pass: 'check', fail: 'close', unknown: 'alert', pending: 'clock' };

export function EligibilityBadge({ result, compact }) {
  if (!result) return null;
  const m = VERDICT_META[result.verdict] || VERDICT_META.check_manually;
  return (
    <span className={'path-badge is-' + result.verdict + (compact ? ' is-compact' : '')}
      title={result.headline || m.label}>
      <Icon name={m.icon} size={12} />
      {m.label}
    </span>
  );
}

/* The full explanation: every check, pass or not, plus what is missing. */
export function EligibilityPanel({ result, kind = 'programme' }) {
  const [open, setOpen] = useState(false);
  if (!result) return null;
  const shown = open ? result.reasons : result.reasons.filter(r => r.status !== 'pass');
  const hiddenCount = result.reasons.length - shown.length;
  const meta = VERDICT_META[result.verdict] || VERDICT_META.check_manually;

  return (
    <section className={'card path-panel is-' + result.verdict} aria-label="Your eligibility">
      <div className="path-panel__head">
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className={'tag tag--' + meta.tone}>{meta.label}</span>
          <h2 className="h2">{kind === 'programme' ? 'Can I apply?' : 'Am I eligible?'}</h2>
        </div>
      </div>
      <p className={'path-panel__headline' + (result.verdict === 'not_eligible' ? ' is-fail' : '')}>{result.headline}</p>

      {result.pending && result.pending.length > 0 && (
        <Notice tone="info">
          <b className="w500">Waiting on your profile:</b> {result.pending.join(', ')}.
          {' '}<Link to="/wizard?step=2">Add these in your profile</Link> and the verdict can move.
        </Notice>
      )}

      <ul className="path-reasons">
        {shown.map((x, i) => (
          <li key={i} className={'path-reason is-' + x.status}>
            <span className="path-reason__ic"><Icon name={STATUS_ICON[x.status] || 'info'} size={13} /></span>
            <span><b className="w500">{x.check}</b> — {x.text}</span>
          </li>
        ))}
        {!shown.length && <li className="path-reason is-pass"><span className="path-reason__ic"><Icon name="check" size={13} /></span>
          <span>Every stated requirement passes.</span></li>}
      </ul>

      <div className="row wr" style={{ gap: 8, marginTop: 4 }}>
        {hiddenCount > 0 && (
          <button className="btn btn--text btn--sm" type="button" onClick={() => setOpen(!open)}>
            {open ? 'Hide the checks I pass' : 'Show all ' + result.reasons.length + ' checks'}
          </button>
        )}
        <span className="grow" />
        <Link className="btn btn--text btn--sm" to="/wizard?step=2">Update my details</Link>
      </div>

      <p className="cap" style={{ marginTop: 6 }}>
        Screening only — meeting every stated requirement is not an offer of admission.
        {result.verified === false && ' The requirements for this listing have not been verified yet.'}
      </p>
    </section>
  );
}

/* ==========================================================================
   The summary /profile shows. It is read-only on purpose: the only place a
   student types anything is the profile edit flow, and every line here links to
   the exact step that fills it.
   ========================================================================== */
const ROW = (label, value, step, note) => ({ label, value, step, note });

export function MatchSummary({ profile, completeness, counts }) {
  const edu = useMemo(() => educationSummary(profile || {}), [profile]);
  const p = profile || {};
  const t = p.target || {};
  const lang = p.language || {};
  const tests = p.tests || {};
  const money = p.money || {};
  const acad = p.academics || {};
  const pct = (completeness && completeness.pct) || 0;
  const steps = (completeness && completeness.steps) || {};

  const lvl = (v) => (v ? v[0].toUpperCase() + v.slice(1) : null);
  const testBits = [
    tests.gre && Object.values(tests.gre).some(x => x != null)
      ? 'GRE ' + [['quant', 'Q'], ['verbal', 'V'], ['aw', 'AW']].filter(([k]) => tests.gre[k] != null).map(([k, l]) => l + ' ' + tests.gre[k]).join(' / ')
      : null,
    tests.gmat != null ? 'GMAT ' + tests.gmat : null,
    tests.gate != null ? 'GATE ' + tests.gate : null,
    tests.testas != null ? 'TestAS ' + tests.testas : null,
    tests.sat != null ? 'SAT ' + tests.sat : null,
    tests.act != null ? 'ACT ' + tests.act : null,
    tests.noneTaken === true ? 'none taken' : null
  ].filter(Boolean);

  const rows = [
    ROW('Target', [lvl(t.level), t.language ? t.language + '-taught' : null, t.intake ? t.intake.replace('_', ' ') : null].filter(Boolean).join(' · '), 2),
    ROW('Nationality', p.nationality && p.nationality.nationality, 2),
    ROW('English', [lang.ielts != null ? 'IELTS ' + lang.ielts : null, lang.toefl != null ? 'TOEFL ' + lang.toefl : null,
      lang.pte != null ? 'PTE ' + lang.pte : null, lang.englishMediumDegree === true ? 'degree taught in English' : null]
      .filter(Boolean).join(' · '), 3),
    ROW('German', [lang.germanLevel ? String(lang.germanLevel).toUpperCase() : null, lang.germanTest || null].filter(Boolean).join(' · '), 3),
    ROW('ECTS', [acad.bachelorEcts != null ? acad.bachelorEcts + ' total' : null,
      acad.subjectEcts && Object.keys(acad.subjectEcts).length
        ? Object.entries(acad.subjectEcts).map(([k, v]) => v + ' ' + k).join(' / ') : null].filter(Boolean).join(' · '), 5),
    ROW('Tests', testBits.join(' · '), 6),
    ROW('Money', [money.maxTuitionPerSemester != null ? 'tuition up to €' + money.maxTuitionPerSemester : null,
      money.fundingNeed ? money.fundingNeed + ' funding' : null,
      money.blockedAccount ? 'blocked account: ' + money.blockedAccount : null].filter(Boolean).join(' · '), 7)
  ];

  return (
    <section className="card" id="match-fields">
      <div className="row sp wr" style={{ gap: 10 }}>
        <div>
          <h2 className="h2">Your details for matching</h2>
          <p className="cap">These decide the Eligible / Check yourself / Not eligible verdict on every programme. Edit them in your profile.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="path-pct">
            <span className="path-pct__n">{pct}%</span>
            <span className="cap">complete</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 6 }}><Progress value={pct} /></div>

      {counts && (
        <p className="cap" style={{ marginTop: 6 }}>
          Right now: <b className="w500">{counts.eligible || 0}</b> eligible ·
          {' '}{counts.check_manually || 0} to check · {counts.not_eligible || 0} not eligible.
          {' '}<Link to="/programs">See the programmes</Link>
        </p>
      )}

      <table className="kv" style={{ marginTop: 8 }}><tbody>
        {rows.map(r => (
          <tr key={r.label}>
            <th>{r.label}</th>
            <td>{r.value || <span className="cap">Not added</span>}</td>
            <td style={{ width: 1, whiteSpace: 'nowrap' }}>
              <Link className="link-quiet" to={'/wizard?step=' + r.step}>{r.value ? 'Edit' : 'Add'}</Link>
            </td>
          </tr>
        ))}
        <tr>
          <th>Education</th>
          <td>
            {edu.entries.length
              ? <>
                <b className="w500">{edu.years} years of education</b>
                {edu.entries.map(e => (
                  <div className="cap" key={e.id}>
                    {EDU_LABEL[e.level] || e.level}{e.institution ? ' · ' + e.institution : ''} · {entryYears(e)} years
                    {e.anabinStatus ? ' · anabin ' + e.anabinStatus : ''}
                    {e.gpaGerman != null ? ' · German grade ' + e.gpaGerman : ''}
                  </div>
                ))}
                <div className="row wr" style={{ gap: 6, marginTop: 4 }}>
                  {['bachelor', 'master', 'phd'].map(l => (
                    <span key={l} className={'path-can ' + (edu.canApply[l] ? 'is-yes' : 'is-no')}>
                      <Icon name={edu.canApply[l] ? 'check' : 'close'} size={12} />
                      {l === 'phd' ? 'PhD' : lvl(l)}: {edu.canApply[l] ? 'you can apply' : 'not yet'}
                    </span>
                  ))}
                </div>
                {edu.anabinStatus && <p className="cap" style={{ marginTop: 4 }}>{zabRule(edu.anabinStatus).text}</p>}
              </>
              : <span className="cap">Not added</span>}
          </td>
          <td style={{ width: 1, whiteSpace: 'nowrap' }}>
            <Link className="link-quiet" to="/wizard?step=4">{edu.entries.length ? 'Edit' : 'Add'}</Link>
          </td>
        </tr>
      </tbody></table>

      {pct < 100 && (
        <Notice tone="info">
          <b className="w500">Still to fill in:</b> {Object.entries(steps).filter(([, v]) => v < 100).length
            ? 'steps ' + Object.entries(steps).filter(([, v]) => v < 100).map(([k]) => k).join(', ')
            : 'nothing'}.
          {' '}<Link to={'/wizard?step=' + (Object.entries(steps).find(([, v]) => v < 100) || ['2'])[0]}>Continue where you left off</Link>
        </Notice>
      )}

      <div className="row wr" style={{ gap: 8, marginTop: 10 }}>
        <Link className="btn btn--filled btn--sm" to="/wizard?step=2">Edit my details</Link>
        <Link className="btn btn--text btn--sm" to="/programs">See what I can apply to</Link>
      </div>
    </section>
  );
}
