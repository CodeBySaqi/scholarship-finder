import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminShell } from '../../components/Shell.jsx';
import { Card, Icon, Loader, Empty, Btn, Notice, useAsync, useToast, LoadError, Input, Textarea } from '../../components/ui.jsx';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { FreshnessTag } from '../../lib.jsx';

const Field = ({ id, label, children, help, wide }) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    {children}
    {help && <span className="help">{help}</span>}
  </div>
);
const Num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const List = (v) => (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : []);

const BLANK = {
  kind: 'scholarship', status: 'draft', title: '', provider: '', hostCountry: 'Germany',
  degreeLevels: ['master'], fundingType: 'full', coverage: [], deadline: '', isAnnual: true,
  lastVerified: new Date().toISOString().slice(0, 10), sourceUrl: '', officialUrl: '', applyUrl: '',
  applySteps: [], documents: [], description: '', createdBy: '', verifiedBy: null, draftedByAi: false, evidence: {}
};

export default function ListingForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [form, setForm] = useState(isNew ? { ...BLANK, createdBy: user?.email || '' } : null);
  const [gate, setGate] = useState({ display: false, eligibility: false, provenance: false });
  const [session, setSession] = useState([]);
  const [busy, setBusy] = useState(false);
  const [coverage, setCoverage] = useState('');
  const [docs, setDocs] = useState('');
  const [countries, setCountries] = useState('');
  const [steps, setSteps] = useState('');
  const [priorFields, setPriorFields] = useState('');
  const [hsscGroups, setHsscGroups] = useState('');
  const [ects, setEcts] = useState('');

  const { data, loading, error, errorObj, reload } = useAsync(
    () => (isNew ? Promise.resolve({ listing: null }) : api.get('/admin/listings/' + id)),
    [id]
  );

  useEffect(() => {
    if (isNew || !data || !data.listing) return;
    const l = data.listing;
    setForm(l);
    setCoverage((l.coverage || []).join(', '));
    setDocs((l.documents || []).join(', '));
    setCountries((l.allowedCountries || []).join(', '));
    setSteps((l.applySteps || []).join('\n'));
    setPriorFields((l.requiredPriorFields || []).join(', '));
    setHsscGroups((l.hsscGroups || []).join(', '));
    setEcts(l.requiredEcts ? JSON.stringify(l.requiredEcts) : '');
  }, [data, isNew]);

  if (!isNew && loading) return <AdminShell page="admin-form"><Card><Loader /></Card></AdminShell>;
  if (!isNew && error) {
    /* a wrong or deleted id is "not found", not a server failure */
    if (errorObj && errorObj.status === 404) {
      return <AdminShell page="admin-form"><Card>
        <Empty icon="info" title="Listing not found" text="This id does not exist. It may have been deleted, or the link is wrong."
          action={<Btn variant="filled" size="sm" to="/admin/listings">All listings</Btn>} /></Card></AdminShell>;
    }
    return <AdminShell page="admin-form"><LoadError error={error} onRetry={reload} what="listing" /></AdminShell>;
  }
  if (!isNew && data && !data.listing) {
    return <AdminShell page="admin-form"><Card>
      <Empty icon="info" title="Listing not found" text="Check the id in the URL."
        action={<Btn variant="filled" size="sm" to="/admin/listings">All listings</Btn>} /></Card></AdminShell>;
  }
  if (!form) {
    return <AdminShell page="admin-form"><LoadError onRetry={reload} what="listing"
      title="The form could not be prepared" /></AdminShell>;
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /* ---- the 13 hard matching fields, stored on the listing itself ---- */
  const M = form.match || {};
  const setM = (k, v) => setForm(f => ({ ...f, match: { ...(f.match || {}), [k]: v } }));
  const setNum = (k, v) => setM(k, v === '' ? null : Number(v));
  const setIn = (k, sub, v) => setForm(f => ({ ...f, match: { ...(f.match || {}), [k]: { ...((f.match || {})[k] || {}), [sub]: v === '' ? null : Number(v) } } }));
  const setInRaw = (k, sub, v) => setForm(f => ({ ...f, match: { ...(f.match || {}), [k]: { ...((f.match || {})[k] || {}), [sub]: v } } }));
  const req = (M.otherRequirements || {});
  const setReq = (sub, v) => setForm(f => ({
    ...f,
    match: { ...(f.match || {}), otherRequirements: { ...((f.match || {}).otherRequirements || {}), [sub]: v === '' ? null : Number(v) } }
  }));
  const subjectEctsText = (M.subjectEcts && typeof M.subjectEcts === 'object')
    ? Object.entries(M.subjectEcts).map(([k, v]) => k + ':' + v).join(', ') : '';
  const setSubjectEcts = (text) => {
    const out = {};
    for (const part of String(text).split(',')) {
      const [k, v] = part.split(':').map(x => (x || '').trim());
      if (k && v && Number(v) > 0) out[k] = Number(v);
    }
    setM('subjectEcts', Object.keys(out).length ? out : null);
  };

  function collect() {
    return {
      ...form,
      match: form.match || null,
      coverage: List(coverage),
      documents: List(docs),
      allowedCountries: List(countries),
      applySteps: steps.split('\n').map(s => s.trim()).filter(Boolean),
      requiredPriorFields: List(priorFields),
      hsscGroups: List(hsscGroups),
      requiredEcts: ects ? (() => { try { return JSON.parse(ects); } catch { return null; } })() : null
    };
  }

  async function saveDraft() {
    setBusy(true);
    try {
      const body = collect();
      if (isNew) {
        const r = await api.post('/admin/listings', body);
        toast('Draft created and logged');
        nav('/admin/listings/' + r.listing.id, { replace: true });
      } else {
        const r = await api.put('/admin/listings/' + id, body);
        setForm(r.listing);
        setSession(s => [{ action: 'update_draft', at: new Date() }, ...s]);
        toast('Draft saved and logged');
      }
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  async function publish() {
    if (!form.title || !form.sourceUrl) return toast('Title and source URL are required before publishing');
    setBusy(true);
    try {
      await api.put('/admin/listings/' + id, collect());
      const r = await api.post('/admin/listings/' + id + '/publish', { gate });
      setForm(r.listing);
      setSession(s => [{ action: 'publish', at: new Date() }, ...s]);
      toast('Published — verified by ' + user.email);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast(e.message);
      setSession(s => [{ action: 'publish refused', at: new Date() }, ...s]);
    } finally { setBusy(false); }
  }

  const roleOk = user?.role === 'admin';
  const sameAuthor = form.createdBy === user?.email;
  const done = Object.values(gate).filter(Boolean).length;
  const alreadyVerified = form.status === 'verified';
  const canPublish = done === 3 && roleOk && !sameAuthor && !alreadyVerified;

  const note = !roleOk ? 'Contributors can save drafts and request verification, but only an admin publishes. The server refuses it too.'
    : sameAuthor ? 'Four-eyes rule: you created this listing, so someone else has to verify it. Ask a second reviewer to open it.'
      : alreadyVerified ? 'This listing is already published. Editing it does not unpublish it.'
        : done < 3 ? 'Tick each group after checking it against the source page.'
          : 'Ready. Publishing sets status to verified and stamps your id as the reviewer.';

  const statusTag = form.status === 'verified' ? 'tag--ok' : form.status === 'draft' ? 'tag--wn' : 'tag--er';

  return (
    <AdminShell page="admin-form">
      <div className="row sp wr" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <Btn variant="outlined" to="/admin/listings" aria-label="Back" icon="back" size="sm" />
          <div>
            <h1 className="h1">{isNew ? 'New listing' : 'Edit listing'}</h1>
            <p className="cap">{isNew ? 'Nothing is published until a second reviewer signs off.' : form.title || 'Untitled'}</p>
          </div>
        </div>
        <div className="row wr" style={{ gap: 6 }}>
          <span className={'tag ' + statusTag}>{form.status}</span>
          {form.draftedByAi && <span className="tag tag--wn"><Icon name="sparkle" />AI draft</span>}
          <span className="tag tag--out">id {form.id || 'new'}</span>
        </div>
      </div>

      <div className="edit-grid">
        <div className="col">
          {/* ---------------------------------------------------- display */}
          <Card>
            <div className="row sp"><h2 className="h2">Display</h2><span className="tag tag--out">group 1 of 3</span></div>
            <p className="cap">What a student reads. Nothing here changes matching.</p>
            <div className="g2">
              <Field id="title" label="Title" help="Sentence case, no marketing words.">
                <Input id="title" value={form.title} onChange={e => set('title', e.target.value)} className="input" />
              </Field>
              <Field id="provider" label="Provider">
                <Input id="provider" value={form.provider || ''} onChange={e => set('provider', e.target.value)} className="input" />
              </Field>
            </div>
            <div className="g3">
              <Field id="kind" label="Type">
                <select className="select" id="kind" value={form.kind} onChange={e => set('kind', e.target.value)}>
                  <option value="scholarship">Scholarship</option><option value="program">Program</option>
                </select>
              </Field>
              <Field id="hostCountry" label="Host country">
                <select className="select" id="hostCountry" value={form.hostCountry} onChange={e => set('hostCountry', e.target.value)}>
                  {['Germany', 'Austria', 'Switzerland', 'Netherlands'].map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field id="deadline" label="Deadline" help="Every card shows a countdown.">
                <Input id="deadline" type="date" value={(form.deadline || '').slice(0, 10)} onChange={e => set('deadline', e.target.value)} className="input" />
              </Field>
            </div>
            {form.kind === 'scholarship'
              ? <Field id="fundingType" label="Funding type">
                  <select className="select" id="fundingType" value={form.fundingType || 'full'} onChange={e => set('fundingType', e.target.value)}>
                    <option value="full">Fully funded</option><option value="partial">Partial</option><option value="tuition_only">Tuition only</option>
                  </select>
                </Field>
              : <div className="g2">
                  <Field id="tuitionPerSemester" label="Tuition per semester (EUR)" help="0 means no tuition fee.">
                    <Input id="tuitionPerSemester" type="number" min="0" step="50" value={form.tuitionPerSemester ?? 0} onChange={e => set('tuitionPerSemester', Num(e.target.value))} className="input" />
                  </Field>
                  <Field id="languageMode" label="Language">
                    <select className="select" id="languageMode" value={form.languageMode || 'english'} onChange={e => set('languageMode', e.target.value)}>
                      <option value="english">English</option><option value="german">German</option><option value="mixed">Mixed</option>
                    </select>
                  </Field>
                </div>}
            <Field id="coverage" label="Coverage items" help="Comma separated, shown on the detail page.">
              <Input id="coverage" value={coverage} onChange={e => setCoverage(e.target.value)} className="input" />
            </Field>
            <Field id="description" label="Description" help="Facts only. Do not add claims the source does not make.">
              <Textarea id="description" rows={3} value={form.description || ''} onChange={e => set('description', e.target.value)} className="input" />
            </Field>
            <div className="g2">
              <Field id="officialUrl" label="Official URL">
                <Input id="officialUrl" type="url" value={form.officialUrl || ''} onChange={e => set('officialUrl', e.target.value)} className="input" />
              </Field>
              <Field id="applyUrl" label="Apply URL">
                <Input id="applyUrl" type="url" value={form.applyUrl || ''} onChange={e => set('applyUrl', e.target.value)} className="input" />
              </Field>
            </div>
            <Field id="applySteps" label="How to apply (one step per line)">
              <Textarea id="applySteps" rows={4} value={steps} onChange={e => setSteps(e.target.value)} className="input" />
            </Field>
            <Field id="documents" label="Documents needed (comma separated)">
              <Input id="documents" value={docs} onChange={e => setDocs(e.target.value)} className="input" />
            </Field>
            <label className="check">
              <input type="checkbox" checked={!!form.isAnnual} onChange={e => set('isAnnual', e.target.checked)} />
              <span>Annual listing (returns next cycle instead of disappearing)</span>
            </label>
          </Card>

          {/* ------------------------------------------------ eligibility */}
          <Card>
            <div className="row sp"><h2 className="h2">Eligibility</h2><span className="tag tag--out">group 2 of 3</span></div>
            <p className="cap">Only what the official page states. Leave a field empty when no restriction is stated — never enter 0 for “none”.</p>
            <div className="g3">
              <Field id="minCgpa" label="Minimum CGPA (on 4.0)">
                <Input id="minCgpa" type="number" min="0" max="4" step="0.01" value={form.minCgpa ?? ''} onChange={e => set('minCgpa', Num(e.target.value))} className="input" />
              </Field>
              <Field id="germanGradeCutoff" label="German grade cut-off" help="Lower is better.">
                <Input id="germanGradeCutoff" type="number" min="1" max="4" step="0.1" value={form.germanGradeCutoff ?? ''} onChange={e => set('germanGradeCutoff', Num(e.target.value))} className="input" />
              </Field>
              <Field id="maxAge" label="Maximum age at deadline">
                <Input id="maxAge" type="number" min="0" max="99" value={form.maxAge ?? ''} onChange={e => set('maxAge', Num(e.target.value))} className="input" />
              </Field>
            </div>
            <div className="g3">
              <Field id="allowedCountries" label="Allowed countries" help="Blank means open to all.">
                <Input id="allowedCountries" value={countries} onChange={e => setCountries(e.target.value)} className="input" />
              </Field>
              <Field id="ieltsRequired" label="IELTS">
                <select className="select" id="ieltsRequired" value={form.ieltsRequired ? 'yes' : 'no'} onChange={e => set('ieltsRequired', e.target.value === 'yes')}>
                  <option value="no">Not required</option><option value="yes">Required</option>
                </select>
              </Field>
              <Field id="minIelts" label="Minimum IELTS band">
                <Input id="minIelts" type="number" min="1" max="9" step="0.5" value={form.minIelts ?? ''} onChange={e => set('minIelts', Num(e.target.value))} className="input" />
              </Field>
            </div>
            <div className="g3">
              <Field id="minGermanLevel" label="Minimum German level">
                <select className="select" id="minGermanLevel" value={form.minGermanLevel || ''} onChange={e => set('minGermanLevel', e.target.value || null)}>
                  {['', 'none', 'A1', 'A2', 'B1', 'B2', 'C1'].map(v => <option key={v} value={v}>{v || 'None stated'}</option>)}
                </select>
              </Field>
              <Field id="requiredPriorFields" label="Required prior fields">
                <Input id="requiredPriorFields" value={priorFields} onChange={e => setPriorFields(e.target.value)} className="input" />
              </Field>
              <Field id="apsRequired" label="APS required">
                <select className="select" id="apsRequired" value={form.apsRequired || 'unknown'} onChange={e => set('apsRequired', e.target.value)}>
                  <option value="unknown">Not confirmed</option><option value="yes">Yes</option><option value="no">No</option>
                </select>
              </Field>
            </div>
            <div className="g3">
              <Field id="hsscEntryRoute" label="HSSC entry route" help="Bachelor programs only.">
                <select className="select" id="hsscEntryRoute" value={form.hsscEntryRoute || 'unknown'} onChange={e => set('hsscEntryRoute', e.target.value)}>
                  <option value="unknown">Not confirmed</option><option value="direct">HSSC accepted directly</option>
                  <option value="studienkolleg_required">Studienkolleg required</option>
                  <option value="one_year_university_required">One year of university first</option>
                </select>
              </Field>
              <Field id="hsscGroups" label="Accepted HSSC groups">
                <Input id="hsscGroups" value={hsscGroups} onChange={e => setHsscGroups(e.target.value)} className="input" />
              </Field>
              <Field id="requiredEcts" label="Required ECTS (JSON)" help="Example: {“mathematics”:20}">
                <Input id="requiredEcts" value={ects} onChange={e => setEcts(e.target.value)} className="input" />
              </Field>
            </div>
            <Notice tone="info">A value only reaches students after this group is ticked as reviewed below and a second person publishes.</Notice>
          </Card>

          {/* --------------------------------------- matching requirements */}
          <Card  id="match-requirements">
            <div className="row sp"><h2 className="h2">Matching requirements</h2><span className="tag tag--out">ScholarPath</span></div>
            <p className="cap">
              The hard fields the eligibility engine reads, copied from the university page you have open.
              <b className="w500"> Leave a field empty when the page does not state it</b> — empty becomes “Check yourself” for the student,
              never “no requirement”. None of these values is guessed by the app.
            </p>

            <div className="g3">
              <Field id="m-level" label="Programme level">
                <select className="select" id="m-level" value={M.level || (form.degreeLevels || [])[0] || ''} onChange={e => setM('level', e.target.value || null)}>
                  {['', 'bachelor', 'master', 'phd'].map(v => <option key={v} value={v}>{v || 'Not stated'}</option>)}
                </select>
              </Field>
              <Field id="m-anyField" label="Accepted fields">
                <select className="select" id="m-anyField" value={M.anyField ? 'all' : 'some'} onChange={e => setM('anyField', e.target.value === 'all')}>
                  <option value="some">Restricted to listed fields</option>
                  <option value="all">Open to all fields</option>
                </select>
              </Field>
              <Field id="m-acceptedFields" label="Accepted fields (comma separated)" help="computer_science, informatics, software">
                <Input id="m-acceptedFields" value={(M.acceptedFields || []).join(', ')} onChange={e => setM('acceptedFields', e.target.value.split(',').map(x => x.trim()).filter(Boolean))} className="input" />
              </Field>
            </div>

            <div className="g3">
              <Field id="m-minGpa" label="Minimum German grade" help="1.0 best, 4.0 pass. Lower is better.">
                <Input id="m-minGpa" type="number" min="1" max="4" step="0.1" value={M.minGpaGerman ?? ''} onChange={e => setNum('minGpaGerman', e.target.value)} className="input" />
              </Field>
              <Field id="m-bachelorEcts" label="Bachelor ECTS required" help="Master programmes only.">
                <Input id="m-bachelorEcts" type="number" min="0" max="400" step="10" value={M.bachelorEctsRequired ?? ''} onChange={e => setNum('bachelorEctsRequired', e.target.value)} className="input" />
              </Field>
              <Field id="m-subjectEcts" label="Subject ECTS required" help="Example: cs:90, maths:30">
                <Input id="m-subjectEcts" value={subjectEctsText} onChange={e => setSubjectEcts(e.target.value)} className="input" />
              </Field>
            </div>

            <div className="g3">
              <Field id="m-ielts" label="IELTS Academic required">
                <Input id="m-ielts" type="number" min="0" max="9" step="0.5" value={M.ieltsReq ?? ''} onChange={e => setNum('ieltsReq', e.target.value)} className="input" />
              </Field>
              <Field id="m-toefl" label="TOEFL iBT required">
                <Input id="m-toefl" type="number" min="0" max="120" step="1" value={M.toeflReq ?? ''} onChange={e => setNum('toeflReq', e.target.value)} className="input" />
              </Field>
              <Field id="m-pte" label="PTE Academic required">
                <Input id="m-pte" type="number" min="0" max="90" step="1" value={M.pteReq ?? ''} onChange={e => setNum('pteReq', e.target.value)} className="input" />
              </Field>
            </div>

            <div className="g2">
              <Field id="m-englishOther" label="English-medium instruction (MOI)" help="Tübingen, RWTH and BTU reject MOI; FAU and TU Darmstadt accept it. Per programme — never a global rule.">
                <select className="select" id="m-englishOther" value={M.englishOther || ''} onChange={e => setM('englishOther', e.target.value || null)}>
                  <option value="">Not stated</option>
                  <option value="moi_accepted">MOI accepted instead of a test</option>
                  <option value="moi_rejected">MOI explicitly rejected</option>
                  <option value="other">Only an “other” note on the page</option>
                </select>
              </Field>
              <Field id="m-englishOtherText" label="Quote from the page" help="The sentence this choice came from.">
                <Input id="m-englishOtherText" value={M.englishOtherText || ''} onChange={e => setM('englishOtherText', e.target.value || null)} className="input" />
              </Field>
            </div>

            <div className="g3">
              <Field id="m-germanLevel" label="German level required">
                <select className="select" id="m-germanLevel" value={(M.germanReq || {}).level || ''} onChange={e => setInRaw('germanReq', 'level', e.target.value || null)}>
                  {['', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'].map(v => <option key={v} value={v}>{v ? v.toUpperCase() : 'None stated'}</option>)}
                </select>
              </Field>
              <Field id="m-germanTest" label="German certificate named">
                <Input id="m-germanTest" placeholder="DSH-2 / TestDaF 4" value={(M.germanReq || {}).test || ''} onChange={e => setInRaw('germanReq', 'test', e.target.value || null)} className="input" />
              </Field>
              <Field id="m-abitur" label="Abitur equivalence required?" help="Bachelor programmes: the school certificate must open a German bachelor.">
                <select className="select" id="m-abitur" value={M.requiresAbiturEquivalent === false ? 'no' : 'yes'}
                  onChange={e => setM('requiresAbiturEquivalent', e.target.value === 'yes')}>
                  <option value="yes">Yes — Abitur equivalent needed</option>
                  <option value="no">No — open entry route stated</option>
                </select>
              </Field>
            </div>

            <h3 className="h3">Test gates — only when the page names them</h3>
            <div className="g3">
              <Field id="m-gre-quant" label="GRE Quantitative">
                <Input id="m-gre-quant" type="number" min="130" max="170" value={(req.gre || {}).quant ?? ''} onChange={e => setIn('otherRequirements', 'gre', { ...(req.gre || {}), quant: e.target.value === '' ? null : Number(e.target.value) })} className="input" />
              </Field>
              <Field id="m-gre-verbal" label="GRE Verbal">
                <Input id="m-gre-verbal" type="number" min="130" max="170" value={(req.gre || {}).verbal ?? ''} onChange={e => setIn('otherRequirements', 'gre', { ...(req.gre || {}), verbal: e.target.value === '' ? null : Number(e.target.value) })} className="input" />
              </Field>
              <Field id="m-gre-aw" label="GRE Analytical writing">
                <Input id="m-gre-aw" type="number" min="0" max="6" step="0.5" value={(req.gre || {}).aw ?? ''} onChange={e => setIn('otherRequirements', 'gre', { ...(req.gre || {}), aw: e.target.value === '' ? null : Number(e.target.value) })} className="input" />
              </Field>
            </div>
            <div className="g3">
              <Field id="m-gmat" label="GMAT total"><Input id="m-gmat" type="number" min="0" max="800" step="10" value={req.gmat ?? ''} onChange={e => setReq('gmat', e.target.value)} className="input" /></Field>
              <Field id="m-gate" label="GATE score"><Input id="m-gate" type="number" min="0" max="1000" value={req.gate ?? ''} onChange={e => setReq('gate', e.target.value)} className="input" /></Field>
              <Field id="m-testas" label="TestAS score"><Input id="m-testas" type="number" min="0" max="200" value={req.testas ?? ''} onChange={e => setReq('testas', e.target.value)} className="input" /></Field>
            </div>
            <div className="g3">
              <Field id="m-sat" label="SAT total"><Input id="m-sat" type="number" min="400" max="1600" step="10" value={req.sat ?? ''} onChange={e => setReq('sat', e.target.value)} className="input" /></Field>
              <Field id="m-act" label="ACT composite"><Input id="m-act" type="number" min="1" max="36" value={req.act ?? ''} onChange={e => setReq('act', e.target.value)} className="input" /></Field>
              <Field id="m-work" label="Work experience (months)"><Input id="m-work" type="number" min="0" max="600" value={req.workExperienceMonths ?? ''} onChange={e => setReq('workExperienceMonths', e.target.value)} className="input" /></Field>
            </div>
            <div className="g3">
              <Field id="m-intake" label="Intake(s)" help="WS = winter, SS = summer.">
                <Input id="m-intake" placeholder="WS, SS" value={(form.intakes || []).join(', ')} onChange={e => set('intakes', e.target.value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean))} className="input" />
              </Field>
              <Field id="m-semesterFee" label="Semester contribution (EUR)" help="Not tuition. Most universities charge €120–460.">
                <Input id="m-semesterFee" type="number" min="0" max="2000" step="10" value={form.semesterFee ?? ''} onChange={e => set('semesterFee', Num(e.target.value))} className="input" />
              </Field>
              <Field id="m-source" label="Requirements page" help="Where these 13 fields were read from.">
                <Input id="m-source" type="url" value={M.sourceUrl || ''} onChange={e => setM('sourceUrl', e.target.value || null)} className="input" />
              </Field>
            </div>
            <Notice tone="info">
              A student sees Eligible only when every field above that the programme states is met. Empty means unknown: the verdict is
              “Check yourself”, with the missing fields listed by name. AI drafts may fill these, but a human must tick the eligibility group before publishing.
            </Notice>
          </Card>

          {/* ------------------------------------------------- provenance */}
          <Card>
            <div className="row sp"><h2 className="h2">Source and provenance</h2><span className="tag tag--out">group 3 of 3</span></div>
            <div className="g2">
              <Field id="sourceUrl" label="Source URL" help="The exact page this listing was read from.">
                <input className={'input' + (!form.sourceUrl ? ' input--error' : '')} id="sourceUrl" type="url" value={form.sourceUrl || ''} onChange={e => set('sourceUrl', e.target.value)} />
              </Field>
              <Field id="lastVerified" label="Last verified" help="Drives the freshness badge and the stale job.">
                <Input id="lastVerified" type="date" value={(form.lastVerified || '').slice(0, 10)} onChange={e => set('lastVerified', e.target.value)} className="input" />
              </Field>
            </div>
            <table className="kv"><tbody>
              <tr><th>Created by</th><td>{form.createdBy || 'unknown'}</td></tr>
              <tr><th>Verified by</th><td>{form.verifiedBy ? form.verifiedBy : <span className="tag tag--wn">nobody yet</span>}</td></tr>
              <tr><th>Drafted by AI</th><td>{form.draftedByAi ? 'Yes — needs human evidence review' : 'No'}</td></tr>
              <tr><th>Fields with stored evidence</th><td>{Object.keys(form.evidence || {}).length}</td></tr>
            </tbody></table>
            {Object.keys(form.evidence || {}).length > 0 && (
              <div className="col-8">
                <span className="cap w500">Evidence per field</span>
                {Object.keys(form.evidence).map(k => (
                  <div className="row-top" style={{ gap: 8 }} key={k}>
                    <span className="tag tag--out" style={{ flex: 'none' }}>{k}</span>
                    <span className="cap" style={{ flex: 1 }}>“{form.evidence[k]}”</span>
                  </div>
                ))}
              </div>
            )}
            {form.draftedByAi && <Btn variant="outlined" size="sm" to={'/admin/ai-draft?id=' + form.id} icon="sparkle" style={{ alignSelf: 'flex-start' }}>Open AI draft review</Btn>}
          </Card>
        </div>

        {/* ------------------------------------------------------ gate rail */}
        <aside className="rail rail-side rail-side--sticky">
          <Card className="card card--pad-l">
            <h2 className="h2">Publish gate</h2>
            <p className="cap">All three groups ticked by you, and a different person must be able to publish.</p>
            <div className="col-8">
              {[['display', 'Display group reviewed'], ['eligibility', 'Eligibility copied from the source'], ['provenance', 'Source URL and date confirmed']].map(([k, label]) => (
                <label className="check" style={{ minHeight: 36, padding: '4px 0' }} key={k}>
                  <input type="checkbox" data-gate={k} checked={gate[k]} onChange={e => setGate(g => ({ ...g, [k]: e.target.checked }))} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="divider-v" style={{ height: 1, width: 'auto' }} />
            <div className="col-4">
              <div className="row sp"><span className="cap">Groups reviewed</span><span className="tag tag--out">{done} of 3</span></div>
              <div className="row sp"><span className="cap">Your role</span><span className="role-pill" data-role={user?.role}>{user?.role}</span></div>
              <div className="row sp"><span className="cap">Created by</span><span className="cap">{form.createdBy || 'unknown'}</span></div>
            </div>
            <Btn variant="filled" block disabled={!canPublish || busy} onClick={publish}>
              {alreadyVerified ? 'Already published' : 'Publish'}
            </Btn>
            <Btn block disabled={busy} onClick={saveDraft}>{isNew ? 'Create draft' : 'Save draft'}</Btn>
            <p className="cap">{note}</p>
          </Card>

          <Card>
            <h2 className="h2">This session</h2>
            <div className="rows">
              {session.length ? session.map((s, i) => (
                <div className="row sp" key={i}><span className="cap">{s.action}</span><span className="cap">just now</span></div>
              )) : <p className="cap">No writes yet.</p>}
            </div>
            <p className="cap">Every write appends to the audit log with your id, the entity and the action.</p>
          </Card>

          <Card>
            <h2 className="h2">Freshness</h2>
            <div className="col-8">
              <FreshnessTag iso={form.lastVerified} />
              <p className="cap">Verified 0-30 days: green tag. 31-89: neutral date. 90-179: needs recheck. 180+: returned to draft by the nightly job.</p>
            </div>
          </Card>
        </aside>
      </div>
    </AdminShell>
  );
}
