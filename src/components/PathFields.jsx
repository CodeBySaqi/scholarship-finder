import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Field, Notice, Progress, Icon, useToast } from './ui.jsx';
import { api } from '../api.js';
import { germanGpa } from '../path/engine.js';

/* ==========================================================================
   ScholarPath, embedded in the pages students already use.

   There is no separate "find my path" page. The fields live on /profile, the
   verdict appears on each programme card and in full on the programme page.
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
          {' '}<Link to="/profile#match-fields">Add these</Link> and the verdict can move.
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
        <Link className="btn btn--text btn--sm" to="/profile#match-fields">Update my details</Link>
      </div>

      <p className="cap" style={{ marginTop: 6 }}>
        Screening only — meeting every stated requirement is not an offer of admission.
        {result.verified === false && ' The requirements for this listing have not been verified yet.'}
      </p>
    </section>
  );
}

/* --------------------------------------------------------------- the fields
   Only what can change a verdict. Grouped in the order the engine reads them. */
const LEVELS = [{ id: 'bachelor', label: 'Bachelor' }, { id: 'master', label: 'Master' }, { id: 'phd', label: 'PhD' }];
const LANGS = [{ id: 'english', label: 'English only' }, { id: 'german', label: 'German only' }, { id: 'either', label: 'Either' }];
const INTAKES = [
  { id: 'winter_2029', label: 'Winter 2029' }, { id: 'summer_2029', label: 'Summer 2029' },
  { id: 'winter_2030', label: 'Winter 2030' }, { id: 'summer_2030', label: 'Summer 2030' },
  { id: 'flexible', label: 'Flexible' }
];
const GERMAN = ['none', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
const FUNDING = [
  { id: 'full', label: 'Full scholarship needed' },
  { id: 'partial', label: 'Partial is enough' },
  { id: 'self', label: 'I can self-fund' }
];
const SCHOOL = [{ id: 'hssc', label: 'HSSC / FSc' }, { id: 'a_levels', label: 'A-Levels' }, { id: 'ib', label: 'IB' }];

const Chips = ({ value, onChange, options, aria }) => (
  <div className="chips" role="group" aria-label={aria}>
    {options.map(o => (
      <button key={o.id} type="button" className={'chip' + (value === o.id ? ' is-on' : '')}
        aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
    ))}
  </div>
);

const Num = ({ label, help, value, onChange, min = 0, max = 1000, step = 0.01, placeholder }) => (
  <Field label={label} help={help}>
    <input className="input" type="number" inputMode="decimal" min={min} max={max} step={step}
      placeholder={placeholder} value={value == null ? '' : value}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} />
  </Field>
);

const YesNo = ({ label, help, value, onChange }) => (
  <Field label={label} help={help}>
    <Chips aria={label} value={value === true ? 'yes' : value === false ? 'no' : null}
      onChange={v => onChange(v === 'yes')} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} />
  </Field>
);

const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setIn = (o, path, value) => {
  const keys = path.split('.');
  const out = { ...o };
  let cur = out;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = value;
    else { cur[k] = { ...(cur[k] || {}) }; cur = cur[k]; }
  });
  return out;
};

export function MatchFieldsCard({ counts }) {
  const toast = useToast();
  const [draft, setDraft] = useState(null);
  const [meta, setMeta] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [openStep, setOpenStep] = useState(1);

  useEffect(() => {
    let alive = true;
    api.get('/path/profile').then(r => {
      if (!alive) return;
      setDraft(r.profile || {});
      setMeta(r.completeness);
      setLoaded(true);
    }).catch(e => { if (alive) { toast(e.message); setLoaded(true); } });
    return () => { alive = false; };
  }, []);

  const conversion = useMemo(() => {
    const a = (draft && draft.academics) || {};
    if (a.gpaOriginal == null) return null;
    return germanGpa(a.gpaOriginal, { scaleMax: a.gpaScaleMax == null ? 4 : a.gpaScaleMax, passMark: a.gpaPassMark == null ? 2 : a.gpaPassMark });
  }, [draft]);

  if (!loaded || !draft || !meta) {
    return <section className="card" id="match-fields"><h2 className="h2">Programme matching</h2>
      <p className="cap">Loading your matching details…</p></section>;
  }

  const set = (path, value) => setDraft(d => setIn(d || {}, path, value));
  const level = get(draft, 'target.level');

  async function save() {
    setSaving(true);
    try {
      const r = await api.put('/path/profile', { profile: draft });
      setDraft(r.profile);
      setMeta(r.completeness);
      toast('Matching details saved');
    } catch (e) { toast(e.message); } finally { setSaving(false); }
  }

  const steps = [
    { n: 1, title: 'What you are applying for', pct: meta.steps['1'] },
    { n: 2, title: 'Academics and scores', pct: meta.steps['2'] },
    { n: 3, title: 'Money', pct: meta.steps['3'] }
  ];

  return (
    <section className="card" id="match-fields">
      <div className="row sp wr" style={{ gap: 10 }}>
        <div>
          <h2 className="h2">Programme matching</h2>
          <p className="cap">These details decide the Eligible / Check yourself / Not eligible verdict on every programme.</p>
        </div>
        <div className="path-pct">
          <span className="path-pct__n">{meta.pct}%</span>
          <span className="cap">complete</span>
        </div>
      </div>
      <div style={{ marginTop: 6 }}><Progress value={meta.pct} /></div>

      {counts && (
        <p className="cap" style={{ marginTop: 6 }}>
          Right now: <b className="w500">{counts.eligible || 0}</b> eligible ·
          {' '}{counts.check_manually || 0} to check · {counts.not_eligible || 0} not eligible.
          {' '}<Link to="/programs">See the programmes</Link>
        </p>
      )}

      <div className="path-steps" style={{ marginTop: 10 }}>
        {steps.map(s => (
          <button key={s.n} type="button" className={'path-step' + (openStep === s.n ? ' is-on' : '') + (s.pct === 100 ? ' is-done' : '')}
            onClick={() => setOpenStep(openStep === s.n ? 0 : s.n)}>
            <span className="path-step__n">{s.pct === 100 ? <Icon name="check" size={13} /> : s.n}</span>
            <span className="path-step__t">{s.title}</span>
            <span className="cap">{s.pct}%</span>
          </button>
        ))}
      </div>

      {openStep === 1 && (
        <div className="path-fields">
          <Field label="Target level">
            <Chips aria="Target level" value={level} onChange={v => set('target.level', v)} options={LEVELS} />
          </Field>
          <Field label="Teaching language" help="A German-taught programme needs German whatever you prefer here.">
            <Chips aria="Teaching language" value={get(draft, 'target.language')} onChange={v => set('target.language', v)} options={LANGS} />
          </Field>
          <Field label="Intended intake">
            <Chips aria="Intended intake" value={get(draft, 'target.intake')} onChange={v => set('target.intake', v)} options={INTAKES} />
          </Field>
          <Field label="Nationality" help="Non-EU tuition and deadlines depend on this.">
            <input className="input" list="country-list" placeholder="PK" maxLength={2}
              value={get(draft, 'nationality.nationality') || ''}
              onChange={e => set('nationality.nationality', e.target.value.toUpperCase())} />
            <datalist id="country-list">
              {['PK', 'IN', 'BD', 'NG', 'EG', 'CN', 'VN', 'ID', 'DE'].map(x => <option key={x} value={x} />)}
            </datalist>
          </Field>
        </div>
      )}

      {openStep === 2 && (
        <div className="path-fields">
          {level === 'bachelor' && (
            <>
              <Field label="School qualification">
                <Chips aria="School qualification" value={get(draft, 'academics.schoolQualification')}
                  onChange={v => set('academics.schoolQualification', v)} options={SCHOOL} />
              </Field>
              <Notice tone="warning">
                An HSSC is not the Abitur. The routes are one year of a Pakistani bachelor in the same field,
                a Studienkolleg with the Feststellungsprüfung, or A-Levels/IB.
              </Notice>
              <YesNo label="One year of university completed?" value={get(draft, 'academics.undergradYearDone')}
                onChange={v => set('academics.undergradYearDone', v)} />
              {get(draft, 'academics.undergradYearDone') === true && (
                <YesNo label="…in the same field as the programme?" value={get(draft, 'academics.undergradYearSameField')}
                  onChange={v => set('academics.undergradYearSameField', v)} />
              )}
              <YesNo label="Studienkolleg + Feststellungsprüfung done?" value={get(draft, 'academics.studienkolleg')}
                onChange={v => set('academics.studienkolleg', v)} />
              <div className="g2">
                <Num label="TestAS score" value={get(draft, 'tests.testas')} onChange={v => set('tests.testas', v)} max={200} />
                <Num label="SAT total" value={get(draft, 'tests.sat')} onChange={v => set('tests.sat', v)} max={1600} />
              </div>
              <Num label="ACT composite" value={get(draft, 'tests.act')} onChange={v => set('tests.act', v)} max={36} />
            </>
          )}

          {(level === 'master' || level === 'phd') && (
            <>
              <Field label={level === 'phd' ? 'Master field' : 'Bachelor field'} help="This is what field fit is derived from.">
                <input className="input" placeholder="computer_science"
                  value={get(draft, level === 'phd' ? 'academics.masterField' : 'academics.bachelorField') || ''}
                  onChange={e => set(level === 'phd' ? 'academics.masterField' : 'academics.bachelorField', e.target.value)} />
              </Field>
              {level === 'master' && (
                <div className="g2">
                  <Num label="Bachelor total ECTS" help="A 4-year Pakistani BS is usually about 180." value={get(draft, 'academics.bachelorEcts')}
                    onChange={v => set('academics.bachelorEcts', v)} max={400} step={1} />
                  <Num label="ECTS in computer science" value={get(draft, 'academics.subjectEcts.cs')}
                    onChange={v => set('academics.subjectEcts.cs', v)} max={400} step={1} />
                </div>
              )}
              <div className="g2">
                <Num label="ECTS in mathematics" value={get(draft, 'academics.subjectEcts.maths')}
                  onChange={v => set('academics.subjectEcts.maths', v)} max={400} step={1} />
                <Num label="ECTS in statistics" value={get(draft, 'academics.subjectEcts.stats')}
                  onChange={v => set('academics.subjectEcts.stats', v)} max={400} step={1} />
              </div>
            </>
          )}

          <div className="g3">
            <Num label="GPA (your scale)" value={get(draft, 'academics.gpaOriginal')} onChange={v => set('academics.gpaOriginal', v)} max={10} />
            <Num label="Scale maximum" value={get(draft, 'academics.gpaScaleMax')} onChange={v => set('academics.gpaScaleMax', v)} max={10} step={0.5} placeholder="4" />
            <Num label="Lowest passing grade" value={get(draft, 'academics.gpaPassMark')} onChange={v => set('academics.gpaPassMark', v)} max={10} step={0.5} placeholder="2" />
          </div>
          {conversion && (
            <div className="path-conv">
              <div><b className="w500">German grade {conversion.value}</b> <span className="cap">(1.0 best, 4.0 pass)</span></div>
              <code className="path-conv__work">{conversion.working}</code>
              <p className="cap">Modified Bavarian Formula. A university may use its own table.</p>
            </div>
          )}

          <div className="g2">
            <Num label="IELTS Academic" value={get(draft, 'language.ielts')} onChange={v => set('language.ielts', v)} max={9} step={0.5} />
            <Num label="TOEFL iBT" value={get(draft, 'language.toefl')} onChange={v => set('language.toefl', v)} max={120} step={1} />
          </div>
          <YesNo label="Was your degree taught in English?" help="Recorded, but it never waives a test on its own — some programmes reject MOI outright."
            value={get(draft, 'language.englishMediumDegree')} onChange={v => set('language.englishMediumDegree', v)} />
          <Field label="German level">
            <Chips aria="German level" value={get(draft, 'language.germanLevel')} onChange={v => set('language.germanLevel', v)}
              options={GERMAN.map(g => ({ id: g, label: g === 'none' ? 'None' : g.toUpperCase() }))} />
          </Field>
          <Field label="German test, if taken">
            <input className="input" placeholder="TestDaF 4 / DSH-2 / Goethe C1 / Telc C1" value={get(draft, 'language.germanTest') || ''}
              onChange={e => set('language.germanTest', e.target.value)} />
          </Field>

          <h3 className="h3">GRE — sections separately</h3>
          <div className="g3">
            <Num label="Quantitative" value={get(draft, 'tests.gre.quant')} onChange={v => set('tests.gre.quant', v)} max={170} step={1} />
            <Num label="Verbal" value={get(draft, 'tests.gre.verbal')} onChange={v => set('tests.gre.verbal', v)} max={170} step={1} />
            <Num label="Analytical writing" value={get(draft, 'tests.gre.aw')} onChange={v => set('tests.gre.aw', v)} max={6} step={0.5} />
          </div>
          <Num label="GATE score (if applicable)" value={get(draft, 'tests.gate')} onChange={v => set('tests.gate', v)} max={1000} step={1} />
        </div>
      )}

      {openStep === 3 && (
        <div className="path-fields">
          <div className="g2">
            <Num label="Max tuition per semester (€)" help="0 means free or public universities only. Baden-Württemberg charges non-EU €1,500; TUM €6,000."
              value={get(draft, 'money.maxTuitionPerSemester')} onChange={v => set('money.maxTuitionPerSemester', v)} max={20000} step={50} />
            <Num label="Max semester contribution (€)" value={get(draft, 'money.maxSemesterContribution')}
              onChange={v => set('money.maxSemesterContribution', v)} max={2000} step={10} />
          </div>
          <Field label="Funding need" help="A tuition-only scholarship does not satisfy a full-funding need.">
            <Chips aria="Funding need" value={get(draft, 'money.fundingNeed')} onChange={v => set('money.fundingNeed', v)} options={FUNDING} />
          </Field>
          <Field label="Can you fund the blocked account (about €11,904 a year)?">
            <Chips aria="Blocked account" value={get(draft, 'money.blockedAccount')} onChange={v => set('money.blockedAccount', v)}
              options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'unsure', label: 'Not sure' }]} />
          </Field>
          <Field label="Date of birth" help="Used only for scholarships with an age limit.">
            <input className="input" type="date" value={(get(draft, 'scholarshipExtras.dateOfBirth') || '').slice(0, 10)}
              onChange={e => set('scholarshipExtras.dateOfBirth', e.target.value || null)} />
          </Field>
        </div>
      )}

      <div className="row wr" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn btn--filled btn--sm" type="button" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save matching details'}
        </button>
        <Link className="btn btn--text btn--sm" to="/programs">See what I can apply to</Link>
      </div>
    </section>
  );
}
