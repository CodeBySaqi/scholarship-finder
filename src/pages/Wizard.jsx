import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AppShell } from '../components/Shell.jsx';
import { Icon, Loader, Notice, useAsync, useToast, LoadError } from '../components/ui.jsx';
import { api } from '../api.js';
import { COPY } from '../lib.jsx';

const STEPS = [
  { n: 1, title: 'About you', sub: 'Only what matching needs.' },
  { n: 2, title: 'Your education', sub: 'Board, percentage or CGPA - whichever you have.' },
  { n: 3, title: 'Scores and tests', sub: 'You can leave a test as planned.' },
  { n: 4, title: 'Your targets', sub: 'Up to three. One is primary.' },
  { n: 5, title: 'Funding and extras', sub: 'Documents, APS and income.' }
];
const CHECKLIST = [
  ['fullName', 8], ['dateOfBirth', 8], ['gender', 4], ['city', 3],
  ['currentLevel', 8], ['institution', 4], ['expectedCompletionYear', 5],
  ['matricPct', 5], ['interPct', 6], ['hsscGroup', 5], ['ibccStatus', 5],
  ['bachelorCgpa', 9], ['bachelorScale', 4],
  ['ielts', 10], ['germanLevel', 4],
  ['fundingNeed', 5], ['apsStatus', 6], ['documentsReady', 1]
];
function completeness(p, targets) {
  let done = 0, total = 0;
  CHECKLIST.forEach(([key, w]) => {
    total += w;
    const v = p[key];
    if (key === 'ielts') { if (v && v.status) done += w; }
    else if (key === 'documentsReady') { if (Array.isArray(v) && v.length) done += w; }
    else if (v !== null && v !== undefined && v !== '' && v !== 'none') done += w;
  });
  total += 12;
  if (targets && targets.length && targets.some(t => t.isPrimary)) done += 12;
  return Math.min(100, Math.round((done / total) * 100));
}

const PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad', 'Azad Kashmir', 'Gilgit-Baltistan'];
const DOCS = [
  { id: 'transcripts', label: 'Transcripts' }, { id: 'degree', label: 'Degree / HSSC certificate' },
  { id: 'cv', label: 'CV' }, { id: 'ielts', label: 'IELTS or TOEFL certificate' },
  { id: 'motivation', label: 'Motivation letter' }, { id: 'references', label: 'Reference letters' },
  { id: 'aps', label: 'APS certificate' }, { id: 'ibcc', label: 'IBCC equivalence' }
];
const GL = ['none', 'A1', 'A2', 'B1', 'B2', 'C1'];

function Field({ label, help, children, id }) {
  return (
    <div className="field">
      {label ? <label htmlFor={id}>{label}</label> : <span className="lbl">{label}</span>}
      {children}
      {help && <span className="help">{help}</span>}
    </div>
  );
}
function Chips({ value, options, multi, onChange }) {
  const arr = multi ? (value || []) : [value];
  return (
    <div className="chips">
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
const Sw = ({ on, onChange, label }) => (
  <button className="switch" type="button" role="switch" aria-checked={!!on} aria-label={label} onClick={() => onChange(!on)} />
);

export default function Wizard() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const step = Math.min(5, Math.max(1, Number(params.get('step') || 1)));
  const { data, loading, error, reload } = useAsync(() => api.get('/profile'), []);
  const [form, setForm] = useState(null);
  const [targets, setTargets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [ieltsError, setIeltsError] = useState(false);

  useEffect(() => {
    if (data) { setForm({ ...data.profile }); setTargets((data.targets || []).map(t => ({ ...t }))); }
  }, [data]);

  if (loading) return <AppShell page="profile"><div className="card"><Loader /></div></AppShell>;
  if (error || !form) return <AppShell page="profile"><LoadError error={error} onRetry={reload} what="wizard" /></AppShell>;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const live = completeness({ ...form, ielts: form.ielts }, targets);

  async function save(advance) {
    if (step === 3 && form.ielts && form.ielts.overall != null && (form.ielts.overall < 1 || form.ielts.overall > 9)) {
      setIeltsError(true); toast('Fix the highlighted field first'); return;
    }
    if (step === 4 && (!targets.length || !targets.some(t => t.isPrimary))) { toast('Mark one target as primary'); return; }
    setSaving(true);
    try {
      const body = { profile: form, targets };
      if (!form.firstName && form.fullName) body.profile.firstName = form.fullName.split(' ')[0];
      const r = await api.put('/profile', body);
      setForm({ ...r.profile });
      toast(advance ? 'Saved. Profile ' + r.profile.completenessPct + '% complete' : 'Profile saved - ' + r.profile.completenessPct + '% complete');
      if (advance) {
        if (step === 5) { nav('/dashboard'); return; }
        setParams({ step: String(step + 1) });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else nav('/dashboard');
    } catch (e) { toast(e.message); } finally { setSaving(false); }
  }

  const p = form;

  function renderStep() {
    if (step === 1) {
      return (
        <>
          <div className="g2">
            <Field label="Full name" id="fullName" help="As printed on your documents. Used only on your profile.">
              <input className="input" id="fullName" autoComplete="name" value={p.fullName || ''} onChange={e => set('fullName', e.target.value)} />
            </Field>
            <Field label="Date of birth" id="dateOfBirth" help="Some scholarships have an age limit. We check your age at the deadline, not today.">
              <input className="input" id="dateOfBirth" type="date" value={(p.dateOfBirth || '').slice(0, 10)} onChange={e => set('dateOfBirth', e.target.value)} />
            </Field>
          </div>
          <Field label="Gender" help="Only used for gender-restricted listings. Most listings ignore it.">
            <Chips value={p.gender || ''} onChange={v => set('gender', v)} options={[
              { id: 'female', label: 'Female' }, { id: 'male', label: 'Male' },
              { id: 'other', label: 'Other' }, { id: 'prefer_not_to_say', label: 'Prefer not to say' }]} />
          </Field>
          <div className="g2">
            <Field label="City" id="city">
              <select className="select" id="city" value={p.city || ''} onChange={e => set('city', e.target.value)}>
                {['Lahore', 'Karachi', 'Islamabad', 'Multan', 'Peshawar', 'Quetta', 'Bahawalpur', 'Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Province" id="province">
              <select className="select" id="province" value={p.province || ''} onChange={e => set('province', e.target.value)}>
                {PROVINCES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="WhatsApp number (optional)" id="whatsapp" help="Only used if you switch on WhatsApp reminders in Settings.">
            <input className="input" id="whatsapp" inputMode="tel" placeholder="+92 3xx xxxxxxx" value={p.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} />
          </Field>
          <Notice tone="info" icon="shield">We never ask for CNIC, passport number or bank details. No uploads at this stage.</Notice>
        </>
      );
    }

    if (step === 2) {
      const hssc = p.currentLevel === 'matric' || p.currentLevel === 'intermediate';
      return (
        <>
          <div className="field">
            <span className="lbl">Where are you now?</span>
            <div className="radios">
              {[
                { id: 'matric', label: 'Matric', sub: 'Grade 9-10' },
                { id: 'intermediate', label: 'Intermediate / HSSC', sub: 'Grade 11-12' },
                { id: 'bachelor', label: 'Bachelor in progress', sub: 'Applying for a master' },
                { id: 'master', label: 'Master completed', sub: 'Applying for a PhD' },
                { id: 'phd', label: 'PhD' }
              ].map(o => (
                <label className="radio-card" key={o.id}>
                  <input type="radio" name="currentLevel" value={o.id} checked={p.currentLevel === o.id} onChange={() => set('currentLevel', o.id)} />
                  <span className="t"><span className="h3">{o.label}</span>{o.sub && <span className="cap">{o.sub}</span>}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="g2">
            <Field label="Institution" id="institution"><input className="input" id="institution" value={p.institution || ''} onChange={e => set('institution', e.target.value)} /></Field>
            <Field label="Expected completion year" id="year">
              <select className="select" id="year" value={p.expectedCompletionYear || 2026} onChange={e => set('expectedCompletionYear', Number(e.target.value))}>
                {['2026', '2027', '2028', '2029', '2030'].map(y => <option key={y}>{y}</option>)}
              </select>
            </Field>
          </div>

          <div className="card card--flat" style={{ background: 'var(--chip)', border: 0 }}>
            <span className="h3">HSSC details</span>
            <div className="g2">
              <Field label="Matric percentage" id="matricPct"><input className="input" id="matricPct" type="number" min="0" max="100" step="0.01" value={p.matricPct ?? ''} onChange={e => set('matricPct', e.target.value === '' ? null : Number(e.target.value))} /></Field>
              <Field label="Intermediate percentage" id="interPct"><input className="input" id="interPct" type="number" min="0" max="100" step="0.01" value={p.interPct ?? ''} onChange={e => set('interPct', e.target.value === '' ? null : Number(e.target.value))} /></Field>
            </div>
            <Field label="Board" id="hsscBoard"><input className="input" id="hsscBoard" value={p.hsscBoard || ''} onChange={e => set('hsscBoard', e.target.value)} /></Field>
            <Field label="Group" help="Some German bachelor programs accept only certain groups.">
              <Chips value={p.hsscGroup || ''} onChange={v => set('hsscGroup', v)} options={[
                { id: 'pre_engineering', label: 'Pre-engineering' }, { id: 'pre_medical', label: 'Pre-medical' },
                { id: 'ics', label: 'ICS' }, { id: 'commerce', label: 'Commerce' },
                { id: 'arts', label: 'Arts' }, { id: 'other', label: 'Other' }]} />
            </Field>
            <Field label="IBCC equivalence" help="Needed for the bachelor route with an HSSC certificate.">
              <Chips value={p.ibccStatus || ''} onChange={v => set('ibccStatus', v)} options={[
                { id: 'not_needed', label: 'Not needed for me' }, { id: 'planned', label: 'Planned' },
                { id: 'applied', label: 'Applied' }, { id: 'done', label: 'Done' }]} />
            </Field>
          </div>

          <div className="card card--flat" style={{ background: 'var(--chip)', border: 0 }}>
            <span className="h3">Bachelor details</span>
            <p className="cap">Used for master and PhD matching. Numbers only.</p>
            <div className="g3">
              <Field label="CGPA" id="bachelorCgpa"><input className="input" id="bachelorCgpa" type="number" min="0" max="5" step="0.01" value={p.bachelorCgpa ?? ''} onChange={e => set('bachelorCgpa', e.target.value === '' ? null : Number(e.target.value))} /></Field>
              <Field label="Scale" id="scale">
                <select className="select" id="scale" value={p.bachelorScale || 4} onChange={e => set('bachelorScale', Number(e.target.value))}>
                  <option value="4">4</option><option value="5">5</option>
                </select>
              </Field>
              <Field label="Pass mark" id="passMark"><input className="input" id="passMark" type="number" min="0" max="4" step="0.01" value={p.passMark ?? ''} onChange={e => set('passMark', e.target.value === '' ? null : Number(e.target.value))} /></Field>
            </div>
            <Field label="Bachelor percentage" id="bachelorPct"><input className="input" id="bachelorPct" type="number" min="0" max="100" step="0.01" value={p.bachelorPct ?? ''} onChange={e => set('bachelorPct', e.target.value === '' ? null : Number(e.target.value))} /></Field>
            <Field label="Bachelor field" id="bachelorField">
              <select className="select" id="bachelorField" value={p.bachelorField || 'cs'} onChange={e => set('bachelorField', e.target.value)}>
                {[['cs', 'Computer Science'], ['ai', 'AI / Data'], ['software', 'Software Engineering'], ['data', 'Data Science'],
                  ['engineering', 'Engineering'], ['business', 'Business'], ['science', 'Science']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            {hssc && <Notice tone="info">You entered HSSC and no bachelor CGPA yet - that is fine. Bachelor targets use your intermediate percentage and entry route instead.</Notice>}
          </div>
        </>
      );
    }

    if (step === 3) {
      const ielts = p.ielts || { status: 'not_taken', overall: null, date: null };
      return (
        <>
          <div className="field">
            <span className="lbl">IELTS</span>
            <Chips value={ielts.status || ''} onChange={v => set('ielts', { ...ielts, status: v })} options={[
              { id: 'taken', label: 'Taken' }, { id: 'planned', label: 'Planned' }, { id: 'not_taken', label: 'Not taken' }]} />
          </div>
          <div className="g2">
            <Field label="Overall band" id="ieltsOverall" help="Between 1 and 9.">
              <input className={'input' + (ieltsError ? ' input--error' : '')} id="ieltsOverall" type="number" min="1" max="9" step="0.5"
                aria-invalid={ieltsError} value={ielts.overall ?? ''} onChange={e => {
                  const v = e.target.value === '' ? null : Number(e.target.value);
                  setIeltsError(v != null && (v < 1 || v > 9));
                  set('ielts', { ...ielts, overall: v });
                }} />
              {ieltsError && <span className="err"><Icon name="alert" size={13} />Enter a band between 1 and 9.</span>}
            </Field>
            <Field label="Test date" id="ieltsDate" help="We check that it is still valid two years later, at the deadline.">
              <input className="input" id="ieltsDate" type="date" value={(ielts.date || '').slice(0, 10)} onChange={e => set('ielts', { ...ielts, date: e.target.value || null })} />
            </Field>
          </div>
          <Notice tone="info">IELTS is ignored completely for listings that do not require it. A missing band never hides an unrelated listing.</Notice>
          <Field label="TOEFL score (optional)" id="toeflScore">
            <input className="input" id="toeflScore" type="number" min="0" max="120" value={p.toeflScore ?? ''} onChange={e => set('toeflScore', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
          <div className="divider-v" style={{ height: 1, width: 'auto' }} />
          <Field label="German level" help="German-taught programs are strict about this; scholarships usually are not.">
            <Chips value={p.germanLevel || 'none'} onChange={v => set('germanLevel', v)} options={GL.map(g => ({ id: g, label: g === 'none' ? 'None' : g }))} />
          </Field>
          <p className="cap">Saving step 3 gives you an interim count, labelled “Provisional”, because later steps can still change it.</p>
        </>
      );
    }

    if (step === 4) {
      return (
        <>
          {targets.map((t, i) => (
            <div className="card card--flat" key={i}>
              <div className="row sp">
                <span className="h3">Target {i + 1}</span>
                <div className="row" style={{ gap: 4 }}>
                  {t.isPrimary ? <span className="tag tag--pr">Primary</span>
                    : <button className="btn btn--text btn--sm" type="button" onClick={() => setTargets(list => list.map((x, j) => ({ ...x, isPrimary: j === i, label: (j === i ? 'Primary: ' : 'Backup: ') + ((x.fields || [])[0] || 'target').toUpperCase() })))}>Make primary</button>}
                  {targets.length > 1 && <button className="btn btn--icon" type="button" aria-label="Remove target" onClick={() => setTargets(list => {
                    const wasPrimary = list[i].isPrimary;
                    const next = list.filter((_, j) => j !== i);
                    if (wasPrimary && next.length) next[0] = { ...next[0], isPrimary: true };
                    return next;
                  })}><Icon name="close" /></button>}
                </div>
              </div>
              <div className="g2">
                <Field label="Degree" id={'deg' + i}>
                  <select className="select" id={'deg' + i} value={t.degree} onChange={e => setTargets(list => list.map((x, j) => j === i ? { ...x, degree: e.target.value } : x))}>
                    <option value="bachelor">Bachelor</option><option value="master">Master</option><option value="phd">PhD</option>
                  </select>
                </Field>
                <Field label="Intake year" id={'year' + i}>
                  <select className="select" id={'year' + i} value={t.intakeYear} onChange={e => setTargets(list => list.map((x, j) => j === i ? { ...x, intakeYear: Number(e.target.value) } : x))}>
                    {['2027', '2028', '2029'].map(y => <option key={y}>{y}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Fields">
                <Chips multi value={t.fields} onChange={v => setTargets(list => list.map((x, j) => j === i ? {
                  ...x, fields: v,
                  label: (x.isPrimary ? 'Primary: ' : 'Backup: ') + ((v[0] || 'target').toUpperCase())
                } : x))} options={[
                  { id: 'ai', label: 'AI' }, { id: 'data', label: 'Data' }, { id: 'software', label: 'Software' },
                  { id: 'engineering', label: 'Engineering' }, { id: 'business', label: 'Business' }, { id: 'science', label: 'Science' }]} />
              </Field>
              <Field label="Language preference">
                <Chips value={t.languagePref || 'both'} onChange={v => setTargets(list => list.map((x, j) => j === i ? { ...x, languagePref: v } : x))} options={[
                  { id: 'english', label: 'English' }, { id: 'german', label: 'German' }, { id: 'both', label: 'Both' }]} />
              </Field>
            </div>
          ))}
          <button className="btn btn--outlined btn--block" type="button" aria-disabled={targets.length >= 3}
            onClick={() => {
              if (targets.length >= 3) return toast('Three targets is the maximum');
              setTargets(list => [...list, { degree: 'master', fields: ['ai'], intakeYear: 2027, languagePref: 'both', isPrimary: false, label: 'Backup: AI' }]);
            }}>
            <Icon name="plus" />{targets.length >= 3 ? 'Three targets is the maximum' : 'Add another target'}
          </button>
          <p className="cap">One target must be primary. Matching runs every listing against all three, then shows the best result once.</p>
        </>
      );
    }

    return (
      <>
        <div className="field">
          <span className="lbl">How much funding do you need?</span>
          <div className="radios">
            <label className="radio-card">
              <input type="radio" name="fundingNeed" value="full_only" checked={p.fundingNeed === 'full_only'} onChange={() => set('fundingNeed', 'full_only')} />
              <span className="t"><span className="h3">Fully funded only</span><span className="cap">Programs that charge tuition are removed from my list</span></span>
            </label>
            <label className="radio-card">
              <input type="radio" name="fundingNeed" value="partial_ok" checked={p.fundingNeed === 'partial_ok'} onChange={() => set('fundingNeed', 'partial_ok')} />
              <span className="t"><span className="h3">Partial is fine</span><span className="cap">Show tuition-charging programs with a warning tag</span></span>
            </label>
          </div>
        </div>

        <div className="switch-row">
          <span className="t"><span className="h3">Prefer not to share income</span><span className="cap">Need-based scholarships will ask you to confirm instead</span></span>
          <Sw on={p.incomeBracket === 'prefer_not_to_say'} label="Prefer not to share income"
            onChange={on => set('incomeBracket', on ? 'prefer_not_to_say' : null)} />
        </div>
        {p.incomeBracket !== 'prefer_not_to_say' && (
          <Field label="Household income bracket" help="Only used for need-based listings. Field is optional.">
            <Chips value={p.incomeBracket || ''} onChange={v => set('incomeBracket', v)} options={[
              { id: 'low', label: 'Low' }, { id: 'lower_mid', label: 'Lower middle' },
              { id: 'mid', label: 'Middle' }, { id: 'high', label: 'High' }]} />
          </Field>
        )}

        <div className="divider-v" style={{ height: 1, width: 'auto' }} />
        <Field label="APS certificate" help="Most German programs ask for it. Starting early matters: it takes weeks.">
          <Chips value={p.apsStatus || ''} onChange={v => set('apsStatus', v)} options={[
            { id: 'not_started', label: 'Not started' }, { id: 'applied', label: 'Applied' },
            { id: 'certificate_ready', label: 'Certificate ready' }]} />
        </Field>
        <Field label="HEC degree attestation">
          <Chips value={p.hecStatus || ''} onChange={v => set('hecStatus', v)} options={[
            { id: 'not_needed', label: 'Not needed' }, { id: 'planned', label: 'Planned' },
            { id: 'applied', label: 'Applied' }, { id: 'done', label: 'Done' }]} />
        </Field>
        <div className="switch-row">
          <span className="t"><span className="h3">Blocked account arranged</span><span className="cap">Usually needed for the visa, after admission</span></span>
          <Sw on={p.blockedAccountReady} label="Blocked account arranged" onChange={v => set('blockedAccountReady', v)} />
        </div>
        <div className="switch-row">
          <span className="t"><span className="h3">I have an ECTS module breakdown</span><span className="cap">Some master programs need subject credits confirmed</span></span>
          <Sw on={p.hasEctsBreakdown} label="ECTS module breakdown" onChange={v => set('hasEctsBreakdown', v)} />
        </div>
        <Field label="Work experience (months)" id="workExpMonths" help="Some scholarships require professional experience.">
          <input className="input" id="workExpMonths" type="number" min="0" max="240" step="1" value={p.workExpMonths ?? 0} onChange={e => set('workExpMonths', e.target.value === '' ? 0 : Number(e.target.value))} />
        </Field>
        <div className="field">
          <span className="lbl">Documents ready</span>
          <Chips multi value={p.documentsReady} onChange={v => set('documentsReady', v)} options={DOCS} />
          <span className="help">We do not store the files. This is only a checklist for you.</span>
        </div>
      </>
    );
  }

  return (
    <AppShell page="profile">
      <div className="page--narrow" style={{ maxWidth: 780, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        <div>
          <div className="row sp"><span className="cap">Step {step} of 5</span><span className="cap">{Math.round((step / 5) * 100)}% of the wizard</span></div>
          <div className="seg seg--wizard" style={{ margin: '6px 0 10px' }}>
            {STEPS.map(x => <i key={x.n} style={{ flex: 1, background: x.n <= step ? 'var(--primary)' : 'var(--chip)' }} />)}
          </div>
          <h1 className="h1">{STEPS[step - 1].title}</h1><p className="cap">{STEPS[step - 1].sub}</p>
          <div className="row wr" style={{ gap: 6, marginTop: 4 }}>
            <span className="tag tag--out">Profile {Math.max(live, form.completenessPct || 0)}% complete</span>
            {live < 80 && <span className="tag tag--wn">{COPY.provisional}</span>}
          </div>
        </div>

        <div className="card card--pad-l">{renderStep()}</div>

        <div className="card" style={{ position: 'sticky', bottom: 64, zIndex: 15 }}>
          <div className="row sp wr" style={{ gap: 8 }}>
            {step > 1
              ? <button className="btn btn--text" type="button" onClick={() => { setParams({ step: String(step - 1) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Icon name="back" />Back</button>
              : <span />}
            <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
              <Link className="btn btn--text" to="/dashboard">Finish later</Link>
              <button className="btn btn--filled" type="button" disabled={saving} onClick={() => save(true)}>
                {saving ? 'Saving…' : step === 5 ? 'Save and finish' : 'Save and continue'}
              </button>
            </div>
          </div>
        </div>
        <p className="cap">Your answers save as you go. Nothing is uploaded and no CNIC, passport or bank details are ever requested.</p>
      </div>
    </AppShell>
  );
}
