import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/Shell.jsx';
import { Field, Notice, Progress, Btn, LoadError, Loader, useAsync, useToast, Icon } from '../components/ui.jsx';
import { api } from '../api.js';
import { germanGpa } from '../path/engine.js';

const LEVELS = [{ id: 'bachelor', label: 'Bachelor' }, { id: 'master', label: 'Master' }, { id: 'phd', label: 'PhD' }];
const LANGS = [{ id: 'english', label: 'English only' }, { id: 'german', label: 'German only' }, { id: 'either', label: 'Either' }];
const INTAKES = [
  { id: 'winter_2029', label: 'Winter 2029' }, { id: 'summer_2029', label: 'Summer 2029' },
  { id: 'winter_2030', label: 'Winter 2030' }, { id: 'summer_2030', label: 'Summer 2030' },
  { id: 'flexible', label: 'Flexible' }
];
const GERMAN = ['none', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
const FUNDING = [
  { id: 'full', label: 'I need a full scholarship' },
  { id: 'partial', label: 'Partial is enough' },
  { id: 'self', label: 'I can self-fund' }
];
const SCHOOL = [
  { id: 'hssc', label: 'HSSC / FSc' }, { id: 'a_levels', label: 'A-Levels' }, { id: 'ib', label: 'IB' }
];

/* small local controls so the form stays readable */
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

export default function Path() {
  const toast = useToast();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const { data, loading, error, reload } = useAsync(() => api.get('/path/profile'), []);
  const counts = useAsync(() => api.get('/path/matches?kind=programmes'), []);

  useEffect(() => {
    if (data && !draft) { setDraft(data.profile || {}); setSaved(data.profile || {}); }
  }, [data, draft]);

  const conversion = useMemo(() => {
    const a = (draft && draft.academics) || {};
    if (a.gpaOriginal == null) return null;
    return germanGpa(a.gpaOriginal, { scaleMax: a.gpaScaleMax == null ? 4 : a.gpaScaleMax, passMark: a.gpaPassMark == null ? 2 : a.gpaPassMark });
  }, [draft]);

  const set = (path, value) => setDraft(d => setIn(d || {}, path, value));
  const level = get(draft || {}, 'target.level');

  async function save(next) {
    setSaving(true);
    try {
      const body = { profile: draft };
      const r = await api.put('/path/profile', body);
      setSaved(r.profile);
      setDraft(r.profile);
      counts.reload();
      if (next) setStep(next);
      return true;
    } catch (e) {
      toast(e.message);
      return false;
    } finally { setSaving(false); }
  }

  /* live preview: how many programmes each verdict has right now */
  const preview = counts.data ? counts.data.counts : null;
  const c = (data && data.completeness) || { pct: 0, steps: { 1: 0, 2: 0, 3: 0 } };

  if (error) return <AppShell page="path"><LoadError error={error} onRetry={reload} what="your path profile" /></AppShell>;
  if (loading || !draft) return <AppShell page="path"><div className="card"><Loader /></div></AppShell>;

  return (
    <AppShell page="path">
      <div className="phead">
        <div>
          <h1 className="h1">Find my path</h1>
          <p className="cap">Three steps. Only what changes a verdict is asked — nothing about passports or bank accounts.</p>
        </div>
        <div className="path-pct" title="Profile completeness">
          <span className="path-pct__n">{c.pct}%</span>
          <span className="cap">complete</span>
        </div>
      </div>

      <div className="card path-progress">
        <Progress value={c.pct} />
        <div className="path-steps">
          {[1, 2, 3].map(n => (
            <button key={n} type="button" className={'path-step' + (step === n ? ' is-on' : '') + (c.steps[n] === 100 ? ' is-done' : '')}
              onClick={() => setStep(n)}>
              <span className="path-step__n">{c.steps[n] === 100 ? <Icon name="check" size={13} /> : n}</span>
              <span className="path-step__t">{['Target', 'Academics & scores', 'Money & extras'][n - 1]}</span>
              <span className="cap">{c.steps[n]}%</span>
            </button>
          ))}
        </div>
        {preview && (
          <p className="cap path-preview">
            Right now: <b className="w500">{preview.eligible || 0}</b> eligible · {preview.check_manually || 0} need a manual check · {preview.not_eligible || 0} not eligible.
            {' '}<Link to="/path/programmes">See the programmes</Link>
          </p>
        )}
      </div>

      <div className="card">
        {step === 1 && (
          <>
            <h2 className="h2">What are you applying for?</h2>
            <Field label="Target level">
              <Chips aria="Target level" value={level} onChange={v => set('target.level', v)} options={LEVELS} />
            </Field>
            <Field label="Teaching language" help="A German-taught programme needs German whatever the language preference says.">
              <Chips aria="Teaching language" value={get(draft, 'target.language')} onChange={v => set('target.language', v)} options={LANGS} />
            </Field>
            <Field label="Intended intake">
              <Chips aria="Intended intake" value={get(draft, 'target.intake')} onChange={v => set('target.intake', v)} options={INTAKES} />
            </Field>
            <Field label="Nationality" help="Non-EU rules, tuition and deadlines depend on this.">
              <input className="input" list="country-list" placeholder="PK" maxLength={2}
                value={get(draft, 'nationality.nationality') || ''}
                onChange={e => set('nationality.nationality', e.target.value.toUpperCase())} />
              <datalist id="country-list">
                {['PK', 'IN', 'BD', 'NG', 'EG', 'CN', 'VN', 'ID', 'DE'].map(x => <option key={x} value={x} />)}
              </datalist>
            </Field>
            <p className="cap">Step 1 alone already returns rough matches. Everything it cannot check is listed as <b className="w500">pending</b>, never as passing.</p>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="h2">Academics & scores</h2>
            {level === 'bachelor' && (
              <>
                <Field label="School qualification">
                  <Chips aria="School qualification" value={get(draft, 'academics.schoolQualification')}
                    onChange={v => set('academics.schoolQualification', v)} options={SCHOOL} />
                </Field>
                <Notice tone="warning">
                  An HSSC is not the Abitur. The routes are: one year of a Pakistani bachelor in the same field,
                  a Studienkolleg with the Feststellungsprüfung, or A-Levels/IB. The engine will not mark an HSSC-only
                  applicant eligible for a programme that needs Abitur equivalence.
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
                <Field label={level === 'phd' ? 'Master field' : 'Bachelor field'} help="This is what field fit is derived from — there is no separate target field.">
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

            {level === 'phd' && (
              <>
                <Field label="Thesis topic">
                  <input className="input" value={get(draft, 'academics.thesisTopic') || ''}
                    onChange={e => set('academics.thesisTopic', e.target.value)} />
                </Field>
                <Num label="Publications" value={get(draft, 'academics.publications')} onChange={v => set('academics.publications', v)} max={50} step={1} />
                <YesNo label="Research proposal ready?" value={get(draft, 'academics.proposalReady')} onChange={v => set('academics.proposalReady', v)} />
              </>
            )}

            <div className="g2">
              <Num label="GPA (your scale)" value={get(draft, 'academics.gpaOriginal')} onChange={v => set('academics.gpaOriginal', v)} max={10} />
              <Num label="Scale maximum" value={get(draft, 'academics.gpaScaleMax')} onChange={v => set('academics.gpaScaleMax', v)} max={10} step={0.5} placeholder="4" />
              <Num label="Lowest passing grade" value={get(draft, 'academics.gpaPassMark')} onChange={v => set('academics.gpaPassMark', v)} max={10} step={0.5} placeholder="2" />
            </div>
            {conversion && (
              <div className="path-conv">
                <div><b className="w500">German grade {conversion.value}</b> <span className="cap">(1.0 best, 4.0 pass)</span></div>
                <code className="path-conv__work">{conversion.working}</code>
                <p className="cap">Modified Bavarian Formula. A university may use its own table; the estimate is shown so you can compare it with the programme page.</p>
              </div>
            )}

            <div className="g2">
              <Num label="IELTS Academic" value={get(draft, 'language.ielts')} onChange={v => set('language.ielts', v)} max={9} step={0.5} />
              <Num label="TOEFL iBT" value={get(draft, 'language.toefl')} onChange={v => set('language.toefl', v)} max={120} step={1} />
            </div>
            <YesNo label="Was your previous degree taught in English?" help="Recorded, but it never waives a test on its own. Some programmes reject MOI outright."
              value={get(draft, 'language.englishMediumDegree')} onChange={v => set('language.englishMediumDegree', v)} />
            <Field label="German level">
              <Chips aria="German level" value={get(draft, 'language.germanLevel')} onChange={v => set('language.germanLevel', v)}
                options={GERMAN.map(g => ({ id: g, label: g === 'none' ? 'None' : g.toUpperCase() }))} />
            </Field>
            <Field label="German test, if taken">
              <input className="input" placeholder="TestDaF 4 / DSH-2 / Goethe C1 / Telc C1" value={get(draft, 'language.germanTest') || ''}
                onChange={e => set('language.germanTest', e.target.value)} />
            </Field>

            <h3 className="h3" style={{ marginTop: 6 }}>GRE — sections separately</h3>
            <div className="g3">
              <Num label="Quantitative" value={get(draft, 'tests.gre.quant')} onChange={v => set('tests.gre.quant', v)} max={170} step={1} />
              <Num label="Verbal" value={get(draft, 'tests.gre.verbal')} onChange={v => set('tests.gre.verbal', v)} max={170} step={1} />
              <Num label="Analytical writing" value={get(draft, 'tests.gre.aw')} onChange={v => set('tests.gre.aw', v)} max={6} step={0.5} />
            </div>
            <Num label="GATE score (if applicable)" value={get(draft, 'tests.gate')} onChange={v => set('tests.gate', v)} max={1000} step={1} />
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="h2">Money & scholarship extras</h2>
            <div className="g2">
              <Num label="Max tuition per semester (€)" help="0 means free or public universities only. Baden-Württemberg charges non-EU €1,500; TUM charges €6,000."
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

            <h3 className="h3" style={{ marginTop: 6 }}>Scholarship extras (optional, private)</h3>
            <Field label="Date of birth" help="Used only for scholarships that set an age limit.">
              <input className="input" type="date" value={(get(draft, 'scholarshipExtras.dateOfBirth') || '').slice(0, 10)}
                onChange={e => set('scholarshipExtras.dateOfBirth', e.target.value || null)} />
            </Field>
            <Field label="Documents ready">
              <Chips aria="Documents" value={null} options={[]} onChange={() => {}} />
              <div className="path-docs">
                {[['passportValid', 'Passport valid'], ['hecAttested', 'HEC attestation'], ['transcriptsReady', 'Transcripts'],
                  ['motivationLetter', 'Motivation letter']].map(([k, label]) => (
                  <label key={k} className="path-doc">
                    <input type="checkbox" checked={get(draft, 'documents.' + k) === true}
                      onChange={e => set('documents.' + k, e.target.checked)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </Field>
          </>
        )}

        <div className="path-actions">
          <button className="btn btn--text" type="button" disabled={step === 1} onClick={() => setStep(s => Math.max(1, s - 1))}>Back</button>
          <span className="grow" />
          <button className="btn btn--outlined" type="button" disabled={saving} onClick={() => save()}>Save</button>
          {step < 3
            ? <button className="btn btn--filled" type="button" disabled={saving} onClick={() => save(step + 1)}>
              {saving ? 'Saving…' : 'Save & continue'}
            </button>
            : <button className="btn btn--filled" type="button" disabled={saving} onClick={async () => { if (await save()) nav('/path/programmes'); }}>
              {saving ? 'Saving…' : 'See my matches'}
            </button>}
        </div>
      </div>

      <p className="cap">
        Eligibility screening only — meeting every stated requirement is not an offer of admission.
        Where nothing is stated, you get a manual check with the missing fields named, never a silent pass.
      </p>
    </AppShell>
  );
}
