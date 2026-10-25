import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Field, Notice, Icon } from './ui.jsx';
import { api } from '../api.js';
import { germanGpa } from '../path/engine.js';
import { educationSummary, zabRule, EDU_LABEL, entryYears, APS_NOTE } from '../path/education.js';

/* ==========================================================================
   The matching fields, as the editable steps of the PROFILE EDIT flow.

   They are not a separate card and not a separate page: they are steps of
   /wizard (Profile → Edit profile), numbered in the order the student answers
   them, and /profile shows the saved values with an Edit link back here.

     2  What you are applying for
     3  Languages
     4  Education      (records, anabin status, ZAB, years of education)
     5  ECTS           (master and above only — never asked of a bachelor target)
     6  Test requirements
     7  Money

   (Step 1 of the wizard is the personal details, which live in the legacy
   profile because the rest of the app reads them.)
   ========================================================================== */

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
const SCHOOLS = [{ id: 'hssc', label: 'HSSC / FSc / FA' }, { id: 'a_levels', label: 'A-Levels' }, { id: 'ib', label: 'IB' }];
export const EDU_ADD = [
  { level: 'matric', label: '+ Matric (10th)' },
  { level: 'hssc', label: '+ Intermediate / HSSC (12th)' },
  { level: 'bachelor', label: '+ Bachelor' },
  { level: 'master', label: '+ Master' }
];

export const Chips = ({ value, onChange, options, aria }) => (
  <div className="chips" role="group" aria-label={aria}>
    {options.map(o => (
      <button key={o.id} type="button" className={'chip' + (value === o.id ? ' is-on' : '')}
        aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
    ))}
  </div>
);

export const Num = ({ label, help, value, onChange, min = 0, max = 1000, step = 0.01, placeholder, id }) => (
  <Field label={label} help={help} htmlFor={id}>
    <input className="input" id={id} type="number" inputMode="decimal" min={min} max={max} step={step}
      placeholder={placeholder} value={value == null ? '' : value}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} />
  </Field>
);

export const YesNo = ({ label, help, value, onChange }) => (
  <Field label={label} help={help}>
    <Chips aria={label} value={value === true ? 'yes' : value === false ? 'no' : null}
      onChange={v => onChange(v === 'yes')} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} />
  </Field>
);

export const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export const setIn = (o, path, value) => {
  const keys = path.split('.');
  const out = { ...o };
  let cur = out;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = value;
    else { cur[k] = { ...(cur[k] || {}) }; cur = cur[k]; }
  });
  return out;
};

/* Education list helpers, shared by the wizard step and the summary. */
export function addEducationEntry(draft, level) {
  const id = 'e' + Math.random().toString(36).slice(2, 8);
  const base = { id, level, completed: level === 'matric' || level === 'hssc' };
  if (level === 'matric' || level === 'hssc') base.school = 'hssc';
  if (level === 'bachelor') base.totalSemesters = 8;
  if (level === 'master') base.totalSemesters = 4;
  return { ...draft, education: { ...(draft.education || {}), entries: [...((draft.education || {}).entries || []), base] } };
}
export function updateEducationEntry(draft, id, patch) {
  const list = ((draft.education || {}).entries || []).map(e => (e.id === id ? { ...e, ...patch } : e));
  return { ...draft, education: { ...(draft.education || {}), entries: list } };
}
export function removeEducationEntry(draft, id) {
  return { ...draft, education: { ...(draft.education || {}), entries: ((draft.education || {}).entries || []).filter(e => e.id !== id) } };
}

/* ==========================================================================
   The editable step body. `id` is one of: target | language | education |
   ects | tests | money. The wizard owns the draft and the save button.
   ========================================================================== */
export function PathStepFields({ id, draft, setDraft }) {
  const set = (path, value) => setDraft(d => setIn(d || {}, path, value));
  const level = get(draft, 'target.level');
  const edu = useMemo(() => educationSummary(draft || {}), [draft]);

  if (id === 'target') {
    const levelLine = (lvl) => {
      const ok = edu.canApply[lvl];
      return (
        <span key={lvl} className={'path-can ' + (ok ? 'is-yes' : 'is-no')}>
          <Icon name={ok ? 'check' : 'close'} size={12} />
          {lvl === 'phd' ? 'PhD' : lvl[0].toUpperCase() + lvl.slice(1)}: {ok ? 'you can apply' : 'not yet'}
        </span>
      );
    };
    return (
      <div className="path-fields">
        <Field label="Which degree are you applying for?">
          <Chips aria="Target level" value={level} onChange={v => set('target.level', v)} options={LEVELS} />
        </Field>
        <Field label="Teaching language you want" help="A German-taught programme needs German whatever you prefer here.">
          <Chips aria="Teaching language" value={get(draft, 'target.language')} onChange={v => set('target.language', v)} options={LANGS} />
        </Field>
        <Field label="Intended intake">
          <Chips aria="Intended intake" value={get(draft, 'target.intake')} onChange={v => set('target.intake', v)} options={INTAKES} />
        </Field>
        <Field label="Nationality" help="Non-EU tuition and deadlines depend on this. APS is never required for Pakistan.">
          <input className="input" list="country-list" placeholder="PK" maxLength={2}
            value={get(draft, 'nationality.nationality') || ''}
            onChange={e => set('nationality.nationality', e.target.value.toUpperCase())} />
          <datalist id="country-list">
            {['PK', 'IN', 'BD', 'NG', 'EG', 'CN', 'VN', 'ID', 'DE'].map(x => <option key={x} value={x} />)}
          </datalist>
        </Field>
        <div className="row wr" style={{ gap: 6 }}>{['bachelor', 'master', 'phd'].map(levelLine)}</div>
        <p className="cap">This is worked out from your education records in step 4, so fill that in next if you can.</p>
      </div>
    );
  }

  if (id === 'language') {
    return (
      <div className="path-fields">
        <h3 className="h3">English</h3>
        <div className="g3">
          <Num id="ielts" label="IELTS Academic" value={get(draft, 'language.ielts')} onChange={v => set('language.ielts', v)} max={9} step={0.5} />
          <Num id="toefl" label="TOEFL iBT" value={get(draft, 'language.toefl')} onChange={v => set('language.toefl', v)} max={120} step={1} />
          <Num id="pte" label="PTE Academic" value={get(draft, 'language.pte')} onChange={v => set('language.pte', v)} max={90} step={1} />
        </div>
        <YesNo label="Was your degree taught in English?" help="Recorded, but it never waives a test on its own — some programmes reject an English-medium degree outright."
          value={get(draft, 'language.englishMediumDegree')} onChange={v => set('language.englishMediumDegree', v)} />
        <h3 className="h3">German</h3>
        <Field label="German level">
          <Chips aria="German level" value={get(draft, 'language.germanLevel')} onChange={v => set('language.germanLevel', v)}
            options={GERMAN.map(g => ({ id: g, label: g === 'none' ? 'None' : g.toUpperCase() }))} />
        </Field>
        <Field label="German test, if taken">
          <input className="input" placeholder="TestDaF 4 / DSH-2 / Goethe C1 / Telc C1" value={get(draft, 'language.germanTest') || ''}
            onChange={e => set('language.germanTest', e.target.value)} />
        </Field>
        <p className="cap">A score is only ever compared with what a programme states. Nothing here is assumed.</p>
      </div>
    );
  }

  if (id === 'education') {
    return <EducationStep draft={draft} setDraft={setDraft} edu={edu} />;
  }

  if (id === 'ects') {
    if (level === 'bachelor' || !level) {
      return (
        <div className="path-fields">
          <Notice tone="info">
            {level === 'bachelor'
              ? 'ECTS are not asked for a bachelor application — a school certificate has no ECTS. This step is skipped for you.'
              : 'Choose a degree in step 2 first. ECTS only matter for a master or a PhD.'}
          </Notice>
        </div>
      );
    }
    return (
      <div className="path-fields">
        <p className="cap">ECTS of your completed degree. A programme states a minimum, and often a minimum in specific subjects — that is the single most common reason a Pakistani application is rejected.</p>
        <Num id="ects-total" label="Total ECTS of your completed degree" help="A four-year Pakistani BS is usually about 180 ECTS."
          value={get(draft, 'academics.bachelorEcts')} onChange={v => set('academics.bachelorEcts', v)} max={400} step={1} />
        <div className="g3">
          <Num label="ECTS in computer science" value={get(draft, 'academics.subjectEcts.cs')} onChange={v => set('academics.subjectEcts.cs', v)} max={400} step={1} />
          <Num label="ECTS in mathematics" value={get(draft, 'academics.subjectEcts.maths')} onChange={v => set('academics.subjectEcts.maths', v)} max={400} step={1} />
          <Num label="ECTS in statistics" value={get(draft, 'academics.subjectEcts.stats')} onChange={v => set('academics.subjectEcts.stats', v)} max={400} step={1} />
        </div>
      </div>
    );
  }

  if (id === 'tests') {
    return (
      <div className="path-fields">
        <p className="cap">Only a test a programme explicitly requires can change a verdict. Fill in what you have; skip what you have not taken.</p>
        <YesNo label="I have not taken any of these tests" value={get(draft, 'tests.noneTaken')} onChange={v => set('tests.noneTaken', v)} />
        <h3 className="h3">GRE — sections separately, never a total</h3>
        <div className="g3">
          <Num label="Quantitative" value={get(draft, 'tests.gre.quant')} onChange={v => set('tests.gre.quant', v)} max={170} step={1} />
          <Num label="Verbal" value={get(draft, 'tests.gre.verbal')} onChange={v => set('tests.gre.verbal', v)} max={170} step={1} />
          <Num label="Analytical writing" value={get(draft, 'tests.gre.aw')} onChange={v => set('tests.gre.aw', v)} max={6} step={0.5} />
        </div>
        <div className="g3">
          <Num label="GMAT total" help="Business and management programmes." value={get(draft, 'tests.gmat')} onChange={v => set('tests.gmat', v)} max={800} step={10} />
          <Num label="GATE score" value={get(draft, 'tests.gate')} onChange={v => set('tests.gate', v)} max={1000} step={1} />
          <Num label="TestAS score" help="German bachelor programmes; 100 is an average core score." value={get(draft, 'tests.testas')} onChange={v => set('tests.testas', v)} max={200} step={1} />
        </div>
        <div className="g3">
          <Num label="SAT total" value={get(draft, 'tests.sat')} onChange={v => set('tests.sat', v)} max={1600} step={10} />
          <Num label="ACT composite" value={get(draft, 'tests.act')} onChange={v => set('tests.act', v)} max={36} step={1} />
          <Num label="Work experience (months)" value={get(draft, 'academics.workExperienceMonths')} onChange={v => set('academics.workExperienceMonths', v)} max={600} step={1} />
        </div>
      </div>
    );
  }

  /* money */
  return (
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
  );
}

/* ------------------------------------------------------------------ step 4 */
function EducationStep({ draft, setDraft, edu }) {
  const entries = (get(draft, 'education.entries') || []);
  const [search, setSearch] = useState({ q: '', rows: [], loading: false, error: null });
  const [live, setLive] = useState({});
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const setEntry = (id, patch) => setDraft(d => updateEducationEntry(d, id, patch));

  function searchAnabin(q) {
    setSearch(s => ({ ...s, q, loading: true, error: null }));
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await api.get('/anabin/institutions?q=' + encodeURIComponent(q));
        setSearch(s => ({ ...s, rows: r.institutions || [], loading: false }));
      } catch (e) { setSearch(s => ({ ...s, loading: false, error: e.message })); }
    }, 220);
  }

  async function checkLive(entry) {
    setLive(s => ({ ...s, [entry.id]: { busy: true } }));
    try {
      const r = await api.post('/anabin/live', { anabinId: entry.anabinId, institution: entry.institution });
      setLive(s => ({
        ...s,
        [entry.id]: {
          busy: false, ok: r.ok,
          text: r.ok
            ? 'anabin confirms ' + r.institution.status + (r.live ? ' (live just now)' : ' (checked a moment ago)')
            : r.error
        }
      }));
      if (r.ok && r.institution) setEntry(entry.id, { anabinStatus: r.institution.status, anabinCheckedAt: r.institution.checkedAt });
    } catch (e) {
      setLive(s => ({ ...s, [entry.id]: { busy: false, ok: false, text: e.message } }));
    }
  }

  const levelLine = (lvl) => {
    const ok = edu.canApply[lvl];
    return (
      <span key={lvl} className={'path-can ' + (ok ? 'is-yes' : 'is-no')}>
        <Icon name={ok ? 'check' : 'close'} size={12} />
        {lvl === 'phd' ? 'PhD' : lvl[0].toUpperCase() + lvl.slice(1)}: {ok ? 'you can apply' : 'not yet'}
      </span>
    );
  };

  return (
    <div className="path-fields">
      <div className="path-edu-summary">
        <div>
          <div className="path-edu-summary__n">{edu.years} years</div>
          <p className="cap">of education, from your records below</p>
        </div>
        <div className="row wr" style={{ gap: 6 }}>{['bachelor', 'master', 'phd'].map(levelLine)}</div>
      </div>

      {entries.length === 0 && (
        <Notice tone="info">
          Add your school certificate and your bachelor record. Two semesters of a bachelor is the minimum for a German bachelor (13 years);
          a completed four-year bachelor (16 years) is the minimum for a master.
        </Notice>
      )}

      {entries.map((e) => (
        <div className="path-edu" key={e.id}>
          <div className="path-edu__head">
            <b className="w500">{EDU_LABEL[e.level] || e.level}{e.institution ? ' · ' + e.institution : ''}</b>
            <span className="row" style={{ gap: 6 }}>
              <span className="cap">{entryYears(e)} years</span>
              <button className="btn btn--text btn--sm" type="button" onClick={() => setDraft(d => removeEducationEntry(d, e.id))}>Remove</button>
            </span>
          </div>

          {(e.level === 'matric' || e.level === 'hssc') && (
            <div className="g2">
              <Field label={e.level === 'hssc' ? 'School / college' : 'School'}>
                <input className="input" value={e.institution || ''} onChange={ev => setEntry(e.id, { institution: ev.target.value })} />
              </Field>
              <Num label="Percentage" value={e.percentage} onChange={v => setEntry(e.id, { percentage: v })} max={100} step={0.1} />
              {e.level === 'hssc' && (
                <Field label="Certificate">
                  <Chips aria="School certificate" value={e.school} onChange={v => setEntry(e.id, { school: v })} options={SCHOOLS} />
                </Field>
              )}
              <Field label="Group / subjects">
                <input className="input" placeholder="pre_engineering" value={e.field || ''} onChange={ev => setEntry(e.id, { field: ev.target.value })} />
              </Field>
            </div>
          )}

          {(e.level === 'bachelor' || e.level === 'master') && (
            <>
              <Field label="University" help="Type to search the anabin list of Pakistani institutions.">
                <input className="input" value={e.institution || ''}
                  onChange={ev => { setEntry(e.id, { institution: ev.target.value, anabinId: null, anabinStatus: null }); searchAnabin(ev.target.value); }} />
              </Field>
              {search.q && search.q === e.institution && search.rows.length > 0 && (
                <div className="path-anabin-list">
                  {search.rows.map(r => (
                    <button key={r.id} type="button" className="path-anabin-opt"
                      onClick={() => {
                        setEntry(e.id, { institution: r.name, anabinId: r.anabinId, anabinStatus: r.status, anabinCheckedAt: r.checkedAt });
                        setSearch(s => ({ ...s, q: '', rows: [] }));
                      }}>
                      <span>{r.name}</span>
                      <span className={'anabin-tag is-' + (r.status || 'none').replace(/[+/]/g, '')}>{r.status || 'no record'}</span>
                      <span className="cap">{r.city || ''}</span>
                    </button>
                  ))}
                </div>
              )}
              {search.error && <p className="cap">Institution search failed: {search.error}</p>}

              {e.anabinStatus && (
                <div className={'path-anabin is-' + (e.anabinStatus || 'none').replace(/[+/]/g, '')}>
                  <div className="row sp wr" style={{ gap: 8 }}>
                    <span><b className="w500">anabin {e.anabinStatus}</b> — {zabRule(e.anabinStatus).text}</span>
                    <button className="btn btn--outlined btn--sm" type="button" disabled={!!(live[e.id] || {}).busy}
                      onClick={() => checkLive(e)}>
                      {(live[e.id] || {}).busy ? 'Checking…' : 'Check live'}
                    </button>
                  </div>
                  {e.anabinCheckedAt && <span className="cap">Stored status from {String(e.anabinCheckedAt).slice(0, 10)}</span>}
                  {(live[e.id] || {}).text && <span className="cap">{live[e.id].text}</span>}
                </div>
              )}
              {!e.anabinStatus && e.institution && !search.rows.length && (
                <p className="cap">No anabin record picked yet — search above and choose your university. Without it the ZAB question is answered as “check anabin”.</p>
              )}

              <div className="g3">
                <Num label="CGPA" value={e.cgpa} onChange={v => setEntry(e.id, { cgpa: v })} max={10} step={0.01} />
                <Num label="Scale maximum" value={e.scaleMax} onChange={v => setEntry(e.id, { scaleMax: v })} max={10} step={0.5} placeholder="4" />
                <Num label="Lowest passing grade" value={e.passMark} onChange={v => setEntry(e.id, { passMark: v })} max={10} step={0.5} placeholder="2" />
              </div>
              {e.cgpa != null && (() => {
                const c = germanGpa(e.cgpa, { scaleMax: e.scaleMax == null ? 4 : e.scaleMax, passMark: e.passMark == null ? 2 : e.passMark });
                return c ? (
                  <div className="path-conv">
                    <div><b className="w500">German grade {c.value}</b> <span className="cap">(1.0 best, 4.0 pass)</span></div>
                    <code className="path-conv__work">{c.working}</code>
                    <p className="cap">Modified Bavarian Formula. A university may use its own table.</p>
                  </div>
                ) : null;
              })()}

              <div className="g3">
                <Field label="Field of study" help="This is what field fit is derived from.">
                  <input className="input" placeholder="computer_science" value={e.field || ''} onChange={ev => setEntry(e.id, { field: ev.target.value })} />
                </Field>
                <Num label="Semesters completed" help="Half a year each." value={e.semestersDone} onChange={v => setEntry(e.id, { semestersDone: v })} max={12} step={1} />
                <Num label="Semesters in total" value={e.totalSemesters} onChange={v => setEntry(e.id, { totalSemesters: v })} max={12} step={1} />
              </div>
              <YesNo label="Degree completed?" value={e.completed} onChange={v => setEntry(e.id, { completed: v })} />
            </>
          )}
        </div>
      ))}

      <div className="row wr" style={{ gap: 6 }}>
        {EDU_ADD.map(s => (
          <button key={s.level} type="button" className="btn btn--outlined btn--sm"
            onClick={() => setDraft(d => addEducationEntry(d, s.level))}>{s.label}</button>
        ))}
      </div>
      <p className="cap">{APS_NOTE}</p>
    </div>
  );
}
