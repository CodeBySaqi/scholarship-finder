import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AdminShell } from '../../components/Shell.jsx';
import { Card, Icon, Btn, Field, Loader, Notice, useAsync, useToast, LoadError, Input, Textarea, Switch } from '../../components/ui.jsx';
import { api } from '../../api.js';
import { fmtDate } from '../../lib.jsx';

/* ==========================================================================
   The research agent.

   Pick what you are adding, give it a page (or paste the text), and it returns
   a filled form. Every field it fills is editable here, and the result is only
   ever saved as a DRAFT — publishing still goes through the gate with a second
   person. The badge tells you whether an AI model or the built-in extractor
   produced the values, because those are not equally reliable.
   ========================================================================== */

const KINDS = [
  { id: 'scholarship', label: 'Scholarship', icon: 'cap', tone: 'tone-green', hint: 'Funding, eligibility, deadline' },
  { id: 'program', label: 'German program', icon: 'school', tone: 'tone-blue', hint: 'Degree, tuition, language' },
  { id: 'university', label: 'University', icon: 'building', tone: 'tone-purple', hint: 'Name, city, uni-assist' }
];

const FIELDS = {
  scholarship: [
    ['title', 'Title', 'text'], ['provider', 'Provider', 'text'],
    ['deadline', 'Deadline', 'date'], ['fundingType', 'Funding type', 'select', ['full', 'partial', 'tuition_only', 'none']],
    ['minCgpa', 'Minimum CGPA (/4)', 'number'], ['minIelts', 'Minimum IELTS', 'number'],
    ['ieltsRequired', 'IELTS required', 'bool'], ['maxAge', 'Maximum age', 'number'],
    ['degreeLevels', 'Degree levels', 'list'], ['allowedCountries', 'Allowed countries (ISO)', 'list'],
    ['applyUrl', 'Apply page', 'text'], ['officialUrl', 'Official page', 'text'], ['sourceUrl', 'Where it was read', 'text'],
    ['description', 'Description', 'textarea']
  ],
  program: [
    ['title', 'Title', 'text'], ['provider', 'University / provider', 'text'],
    ['deadline', 'Deadline', 'date'], ['tuitionPerSemester', 'Tuition per semester (EUR)', 'number'],
    ['semesterFee', 'Semester fee (EUR)', 'number'], ['languageMode', 'Language', 'select', ['english', 'german', 'mixed']],
    ['minGermanLevel', 'Minimum German', 'select', ['none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']],
    ['minIelts', 'Minimum IELTS', 'number'], ['ieltsRequired', 'IELTS required', 'bool'],
    ['fieldCategory', 'Field', 'select', ['ai', 'data', 'software', 'engineering', 'business', 'science']],
    ['degreeLevels', 'Degree levels', 'list'], ['applyUrl', 'Apply page', 'text'],
    ['officialUrl', 'Official page', 'text'], ['sourceUrl', 'Where it was read', 'text'], ['description', 'Description', 'textarea']
  ],
  university: [
    ['name', 'Name', 'text'], ['city', 'City', 'text'], ['state', 'State', 'text'],
    ['type', 'Type', 'select', ['university', 'uas', 'tu']], ['websiteUrl', 'Website', 'text'],
    ['uniAssistMember', 'uni-assist member', 'bool'], ['notes', 'Notes', 'textarea']
  ]
};

const asList = (v) => (Array.isArray(v) ? v.join(', ') : v || '');

export default function Research() {
  const toast = useToast();
  const nav = useNavigate();
  const settings = useAsync(() => api.get('/admin/settings'), []);
  const [kind, setKind] = useState('scholarship');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => { setResult(null); setForm({}); setError(null); }, [kind]);

  async function run() {
    setBusy(true); setError(null);
    try {
      const r = await api.post('/admin/research', { kind, url: url.trim(), notes });
      setResult(r);
      const next = {};
      FIELDS[kind].forEach(([key, , type]) => {
        const v = r.fields[key];
        next[key] = type === 'list' ? asList(v) : (v === null || v === undefined ? '' : v);
      });
      setForm(next);
      toast('Research finished — review every field');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function save() {
    setSaving(true);
    try {
      const fields = { ...form };
      FIELDS[kind].forEach(([key, , type]) => {
        if (type === 'list') fields[key] = String(fields[key] || '').split(',').map(s => s.trim()).filter(Boolean);
        if (type === 'number') fields[key] = fields[key] === '' ? null : Number(fields[key]);
      });
      const r = await api.post('/admin/research/save', {
        kind, fields, provider: result ? result.provider : 'manual', sourceUrl: result && result.source ? result.source.url : url || null
      });
      toast('Saved as a draft — it is not published');
      nav(kind === 'university' ? '/admin/universities' : '/admin/listings/' + r.listing.id);
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  }

  const s = settings.data && settings.data.settings;
  const keyReady = !!(s && s.aiApiKeySet);
  const kindMeta = KINDS.find(k => k.id === kind);
  const warnings = result ? result.warnings || [] : [];

  return (
    <AdminShell page="admin-research">
      <div className="phead">
        <div className="row sp wr">
          <div>
            <h1 className="h1">AI research</h1>
            <p className="cap">Point the agent at an official page. It fills the entry form, you check it, and it lands as a draft.</p>
          </div>
          <span className={'tag ' + (keyReady ? 'tag--ok' : 'tag--wn')}>
            <Icon name={keyReady ? 'checkCircle' : 'alert'} />{keyReady ? 'AI key configured' : 'No AI key — extractor only'}
          </span>
        </div>
      </div>

      <div className="split">
        <Card className="card card--pad-l">
          <h2 className="h2">1. What are you adding?</h2>
          <div className="radios">
            {KINDS.map(k => (
              <label className="radio-card" key={k.id}>
                <input type="radio" name="research-kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} />
                <span className="t"><span className="h3">{k.label}</span><span className="cap">{k.hint}</span></span>
              </label>
            ))}
          </div>

          <h2 className="h2">2. Where should it look?</h2>
          <Field label="Official page URL" htmlFor="res-url" help="The page you would cite. The agent reads it and keeps the URL as the source.">
            <Input id="res-url" type="url" placeholder="https://www.daad.de/en/…" value={url} onChange={e => setUrl(e.target.value)} className="input" />
          </Field>
          <Field label="Extra notes or pasted text (optional)" htmlFor="res-notes"
            help="Needed when the page is behind a script or a login. Paste the text you can see and the agent works from that.">
            <Textarea id="res-notes" rows={5} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={'Deadline: 16 November 2026\nMinimum CGPA 3.0/4, IELTS 6.5'} className="input" />
          </Field>

          <div className="row sp wr" style={{ gap: 8 }}>
            <span className="cap">
              {keyReady ? 'Using your configured model for extraction.' : 'The built-in extractor will run. Add a key in Settings → AI research for better coverage.'}
            </span>
            <Btn variant="filled" onClick={run} disabled={busy || (!url.trim() && !notes.trim())}>
              <Icon name="sparkle" />{busy ? 'Researching…' : 'Run research'}
            </Btn>
          </div>

          {error && <Notice tone="danger" icon="alert">{error}</Notice>}

          {result && (
            <div className="stack-10" style={{ marginTop: 4 }}>
              <div className="row sp wr" style={{ gap: 8 }}>
                <span className="tag tag--pr"><Icon name="sparkle" />{result.provider}</span>
                {result.source && result.source.url && (
                  <a className="cap" href={result.source.url} target="_blank" rel="noopener">read {result.source.chars} characters</a>
                )}
              </div>
              {warnings.length > 0 && (
                <Notice tone="warning" icon="alert">
                  <b>Check these before saving:</b>
                  <ul style={{ margin: '6px 0 0 16px' }}>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </Notice>
              )}
            </div>
          )}
        </Card>

        <Card>
          <div className="row sp">
            <div><h2 className="h2">3. Confirm the fields</h2><p className="cap">Everything here is editable. Nothing is published.</p></div>
            <span className={'statcard__icon ' + kindMeta.tone} style={{ width: 38, height: 38, borderRadius: 11 }}><Icon name={kindMeta.icon} /></span>
          </div>

          {!result ? (
            <div className="empty">
              <Icon name="sparkle" />
              <h2 className="h2">Nothing researched yet</h2>
              <p className="cap">Run the agent and the fields for a {kindMeta.label.toLowerCase()} appear here, filled from the page, with the sentence each value came from.</p>
            </div>
          ) : (
            <>
              <div className="col" style={{ gap: 10 }}>
                {FIELDS[kind].map(([key, label, type, options]) => {
                  const evidenceKey = result.evidence && result.evidence[key];
                  return (
                    <div key={key}>
                      <Field label={label} htmlFor={'rf-' + key}>
                        {type === 'textarea' ? (
                          <Textarea id={'rf-' + key} rows={3} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="input" />
                        ) : type === 'select' ? (
                          <select className="select" id={'rf-' + key} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
                            <option value="">— not stated —</option>
                            {options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : type === 'bool' ? (
                          <div className="switch-row">
                            <span className="cap">{form[key] ? 'Yes' : 'No'}</span>
                            <Switch checked={!!form[key]} label={label}
                              onChange={v => setForm(f => ({ ...f, [key]: v }))} />
                          </div>
                        ) : (
                          <Input id={'rf-' + key} type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="input" />
                        )}
                      </Field>
                      {evidenceKey && <p className="cap" style={{ marginTop: -4 }}>“{String(evidenceKey).slice(0, 160)}”</p>}
                    </div>
                  );
                })}
              </div>

              <div className="row sp wr" style={{ gap: 8, marginTop: 12 }}>
                <span className="cap">Saving creates a <b className="w500">draft</b>. A second admin still has to publish it.</span>
                <Btn variant="filled" onClick={save} disabled={saving || !(form.title || form.name)}>
                  {saving ? 'Saving…' : 'Save as draft'}
                </Btn>
              </div>
            </>
          )}
        </Card>
      </div>

      <Card>
        <div className="row sp wr" style={{ gap: 10 }}>
          <div>
            <div className="h3">Model and key</div>
            <p className="cap">
              {keyReady
                ? 'A key is stored on the server (' + (s.aiApiKeyHint || '') + '). Only admins can see or change it — it is never returned to the browser.'
                : 'No key configured, so the deterministic extractor runs: it only keeps values it can quote from the page.'}
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Btn variant="outlined" size="sm" to="/settings?tab=site">Site settings</Btn>
            <Btn variant="text" size="sm" to="/admin/listings/new">Enter a listing by hand</Btn>
          </div>
        </div>
      </Card>
    </AdminShell>
  );
}
