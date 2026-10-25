import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AppShell } from '../components/Shell.jsx';
import { Icon, Loader, Notice, useAsync, useToast, LoadError, Progress } from '../components/ui.jsx';
import { api } from '../api.js';
import { PathStepFields, get } from '../components/pathSteps.jsx';
import { educationSummary } from '../path/education.js';

/* ==========================================================================
   Profile edit — the one place a student fills anything in.

   The matching fields are steps of THIS flow, not a separate card and not a
   separate page: step 1 is the personal details the rest of the app reads, and
   steps 2–7 are what the eligibility engine reads. They are numbered 1 → 7 in
   the order a student answers them, and the step count never starts in the
   middle.
   ========================================================================== */
const STEPS = [
  { n: 1, title: 'About you', sub: 'Only what the rest of the app needs. No CNIC, passport or bank details, ever.' },
  { n: 2, title: 'What you are applying for', sub: 'Degree, teaching language, intake. Enough for a rough verdict on its own.' },
  { n: 3, title: 'Languages', sub: 'IELTS, TOEFL, PTE and German. A test score is only compared with what a programme states.' },
  { n: 4, title: 'Education', sub: 'Your records, semesters and the anabin status of each university.' },
  { n: 5, title: 'ECTS', sub: 'Only for a master or PhD target — a school certificate has no ECTS.' },
  { n: 6, title: 'Test requirements', sub: 'GRE sections separately, GMAT, GATE, TestAS, SAT, ACT — or none.' },
  { n: 7, title: 'Money and documents', sub: 'Budget, funding need, blocked account, and a document checklist for you.' }
];
const LAST = STEPS.length;

const PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad', 'Azad Kashmir', 'Gilgit-Baltistan'];
const DOCS = [
  { id: 'transcripts', label: 'Transcripts' }, { id: 'degree', label: 'Degree / HSSC certificate' },
  { id: 'cv', label: 'CV' }, { id: 'ielts', label: 'IELTS or TOEFL certificate' },
  { id: 'motivation', label: 'Motivation letter' }, { id: 'references', label: 'Reference letters' },
  { id: 'aps', label: 'APS certificate' }, { id: 'ibcc', label: 'IBCC equivalence' }
];
const GENDERS = [{ id: 'female', label: 'Female' }, { id: 'male', label: 'Male' }, { id: 'other', label: 'Other' }, { id: 'prefer_not_to_say', label: 'Prefer not to say' }];
const IBCC = [{ id: 'not_needed', label: 'Not needed' }, { id: 'planned', label: 'Planned' }, { id: 'applied', label: 'Applied' }, { id: 'done', label: 'Done' }];
const HEC = [{ id: 'not_needed', label: 'Not needed' }, { id: 'planned', label: 'Planned' }, { id: 'applied', label: 'Applied' }, { id: 'done', label: 'Done' }];

function Field({ label, help, children, id }) {
  return (
    <div className="field">
      {label ? <label htmlFor={id}>{label}</label> : null}
      {children}
      {help && <span className="help">{help}</span>}
    </div>
  );
}
function Chips({ value, options, multi, onChange, aria }) {
  const arr = multi ? (value || []) : [value];
  return (
    <div className="chips" role="group" aria-label={aria}>
      {options.map(o => {
        const id = typeof o === 'string' ? o : o.id;
        const label = typeof o === 'string' ? o : o.label;
        const on = multi ? arr.includes(id) : String(value) === String(id);
        return (
          <button key={id} type="button" className={'chip' + (on ? ' is-on' : '')} aria-pressed={on}
            onClick={() => multi
              ? onChange(on ? arr.filter(v => v !== id) : [...arr, id])
              : onChange(id)}>{label}</button>
        );
      })}
    </div>
  );
}

export default function Wizard() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const step = Math.min(LAST, Math.max(1, Number(params.get('step') || 1)));
  const personal = useAsync(() => api.get('/profile'), []);
  const matching = useAsync(() => api.get('/path/profile'), []);
  const [form, setForm] = useState(null);
  const [draft, setDraft] = useState(null);
  const [meta, setMeta] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (personal.data) setForm({ ...personal.data.profile }); }, [personal.data]);
  useEffect(() => {
    if (matching.data) { setDraft(matching.data.profile || {}); setMeta(matching.data.completeness || null); }
  }, [matching.data]);

  if (personal.loading || matching.loading) return <AppShell page="profile"><div className="card"><Loader /></div></AppShell>;
  if (personal.error || matching.error) {
    return <AppShell page="profile">
      <LoadError error={personal.error || matching.error} onRetry={() => { personal.reload(); matching.reload(); }} what="your profile" />
    </AppShell>;
  }
  if (!form || !draft) return <AppShell page="profile"><div className="card"><Loader /></div></AppShell>;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const pct = (meta && meta.pct) || 0;
  const edu = educationSummary(draft);

  const goto = (n) => { setParams({ step: String(n) }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  async function save(advance) {
    if (step === 3) {
      const ielts = get(draft, 'language.ielts');
      if (ielts != null && (ielts < 1 || ielts > 9)) { toast('IELTS is a band from 1 to 9'); return; }
    }
    setSaving(true);
    try {
      /* personal details go to the profile the rest of the app reads; the
         matching answers go to the matching profile. One button, both saved. */
      const body = { profile: form };
      if (!form.firstName && form.fullName) body.profile.firstName = form.fullName.split(' ')[0];
      const [pr, mr] = await Promise.all([
        api.put('/profile', body),
        api.put('/path/profile', { profile: draft })
      ]);
      setForm({ ...pr.profile });
      setDraft(mr.profile);
      setMeta(mr.completeness);
      toast('Saved — matching details ' + mr.completeness.pct + '% complete');
      if (advance) {
        if (step === LAST) { nav('/profile'); return; }
        goto(step + 1);
      } else nav('/profile');
    } catch (e) { toast(e.message); } finally { setSaving(false); }
  }

  function renderStep() {
    if (step === 1) {
      return (
        <>
          <div className="g2">
            <Field label="Full name" id="fullName" help="As printed on your documents. Used only on your profile.">
              <input className="input" id="fullName" autoComplete="name" value={form.fullName || ''} onChange={e => set('fullName', e.target.value)} />
            </Field>
            <Field label="Date of birth" id="dateOfBirth" help="Some scholarships have an age limit. We check your age at the deadline, not today.">
              <input className="input" id="dateOfBirth" type="date" value={(form.dateOfBirth || '').slice(0, 10)} onChange={e => set('dateOfBirth', e.target.value)} />
            </Field>
            <Field label="Gender" id="gender">
              <Chips aria="Gender" value={form.gender} options={GENDERS} onChange={v => set('gender', v)} />
            </Field>
            <Field label="City" id="city">
              <input className="input" id="city" value={form.city || ''} onChange={e => set('city', e.target.value)} />
            </Field>
            <Field label="Province" id="province">
              <select className="select" id="province" value={form.province || ''} onChange={e => set('province', e.target.value)}>
                <option value="">Not added</option>
                {PROVINCES.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="WhatsApp number" id="whatsapp" help="Optional, for deadline reminders. Never shown publicly.">
              <input className="input" id="whatsapp" value={form.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} />
            </Field>
          </div>
          <div className="g2">
            <Field label="IBCC equivalence" id="ibccStatus" help="Needed to certify a Pakistani school certificate.">
              <Chips aria="IBCC equivalence" value={form.ibccStatus} options={IBCC} onChange={v => set('ibccStatus', v)} />
            </Field>
            <Field label="HEC attestation" id="hecStatus" help="The Pakistani route — an APS certificate is not required for Pakistan.">
              <Chips aria="HEC attestation" value={form.hecStatus} options={HEC} onChange={v => set('hecStatus', v)} />
            </Field>
          </div>
          <p className="cap">Nationality and the degree you are applying for are asked in step 2, because they decide the verdicts.</p>
        </>
      );
    }

    if (step === 7) {
      return (
        <>
          <PathStepFields id="money" draft={draft} setDraft={setDraft} />
          <div className="field" style={{ marginTop: 8 }}>
            <span className="lbl">Documents ready</span>
            <Chips multi aria="Documents ready" value={form.documentsReady} options={DOCS} onChange={v => set('documentsReady', v)} />
            <span className="help">We do not store the files. This is only a checklist for you.</span>
          </div>
        </>
      );
    }

    const ids = { 2: 'target', 3: 'language', 4: 'education', 5: 'ects', 6: 'tests' };
    return <PathStepFields id={ids[step]} draft={draft} setDraft={setDraft} />;
  }

  return (
    <AppShell page="profile">
      <div className="page--narrow" style={{ maxWidth: 780, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        <div>
          <div className="row sp">
            <span className="cap">Step {step} of {LAST}</span>
            <span className="cap">{Math.round((step / LAST) * 100)}% through the form</span>
          </div>
          <div className="seg seg--wizard" style={{ margin: '6px 0 10px' }}>
            {STEPS.map(x => <i key={x.n} style={{ flex: 1, background: x.n <= step ? 'var(--primary)' : 'var(--chip)' }} />)}
          </div>
          <h1 className="h1">{STEPS[step - 1].title}</h1><p className="cap">{STEPS[step - 1].sub}</p>
          <div className="row wr" style={{ gap: 6, marginTop: 4 }}>
            <span className="tag tag--out">Matching details {pct}% complete</span>
            {step >= 4 && <span className="tag tag--out">{edu.years} years of education</span>}
          </div>
          <div style={{ marginTop: 8 }}><Progress value={pct} /></div>
        </div>

        <div className="card card--pad-l">{renderStep()}</div>

        <div className="card" style={{ position: 'sticky', bottom: 64, zIndex: 15 }}>
          <div className="row sp wr" style={{ gap: 8 }}>
            {step > 1
              ? <button className="btn btn--text" type="button" onClick={() => goto(step - 1)}><Icon name="back" />Back</button>
              : <span />}
            <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
              <Link className="btn btn--text" to="/profile">Finish later</Link>
              <button className="btn btn--filled" type="button" disabled={saving} onClick={() => save(true)}>
                {saving ? 'Saving…' : step === LAST ? 'Save and finish' : 'Save and continue'}
              </button>
            </div>
          </div>
        </div>

        <div className="row wr" style={{ gap: 6 }}>
          {STEPS.map(x => (
            <button key={x.n} type="button" className={'chip chip--sm' + (x.n === step ? ' is-on' : '')} onClick={() => goto(x.n)}>
              {x.n}. {x.title}
            </button>
          ))}
        </div>
        <p className="cap">Your answers save as you go. Nothing is uploaded and no CNIC, passport or bank details are ever requested.</p>
        {step === 2 && (
          <Notice tone="info">
            Two steps are enough for a first verdict: this one and <button className="btn btn--text btn--sm" type="button" onClick={() => goto(4)}>Education</button>.
            Languages and money sharpen it.
          </Notice>
        )}
      </div>
    </AppShell>
  );
}
