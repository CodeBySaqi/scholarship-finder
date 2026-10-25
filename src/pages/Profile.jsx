import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/Shell.jsx';
import { Card, Icon, Loader, Btn, useAsync, useToast, Field, LoadError, Input } from '../components/ui.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, Disclaimer } from '../lib.jsx';
import { MatchSummary } from '../components/PathFields.jsx';

const L = {
  gender: { female: 'Female', male: 'Male', other: 'Other', prefer_not_to_say: 'Prefer not to say' },
  currentLevel: { matric: 'Matric', intermediate: 'Intermediate / HSSC', bachelor: 'Bachelor in progress', master: 'Master completed', phd: 'PhD' },
  hsscGroup: { pre_engineering: 'Pre-engineering', pre_medical: 'Pre-medical', ics: 'ICS', commerce: 'Commerce', arts: 'Arts', other: 'Other' },
  ibccStatus: { not_needed: 'Not needed', planned: 'Planned', applied: 'Applied', done: 'Done' },
  hecStatus: { not_needed: 'Not needed', planned: 'Planned', applied: 'Applied', done: 'Done' },
  bachelorField: { cs: 'Computer Science', ai: 'AI / Data', software: 'Software Engineering', data: 'Data Science', engineering: 'Engineering', business: 'Business', science: 'Science' },
  ielts: { taken: 'Taken', planned: 'Planned', not_taken: 'Not taken' },
  fundingNeed: { full_only: 'Fully funded only', partial_ok: 'Partial is fine' },
  incomeBracket: { low: 'Low', lower_mid: 'Lower middle', mid: 'Middle', high: 'High', prefer_not_to_say: 'Prefer not to say' },
  apsStatus: { not_started: 'Not started', applied: 'Applied', certificate_ready: 'Certificate ready' }
};
const DOCMAP = {
  transcripts: 'Transcripts', degree: 'Degree / HSSC', cv: 'CV', ielts: 'IELTS / TOEFL',
  motivation: 'Motivation letter', references: 'References', aps: 'APS certificate', ibcc: 'IBCC equivalence'
};
const lbl = (v, map) => (v == null || v === '' ? null : (map[v] || v));
const germanGrade = (cgpa, scale, pass) => Math.round(Math.min(4, Math.max(1, 1 + (3 * (scale - cgpa)) / (scale - (pass == null ? scale / 2 : pass)))) * 10 + 1e-9) / 10;

export function CompletenessBar({ pct }) {
  const COLS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853'];
  const filled = Math.round((pct / 100) * 20);
  return (
    <div className="gbar" role="img" aria-label={'Profile ' + pct + '% complete'}>
      {Array.from({ length: 20 }, (_, i) => (
        <i key={i} style={{ flex: 1, background: i < filled ? COLS[Math.floor(i / 5)] : 'var(--chip)' }} />
      ))}
    </div>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [del, setDel] = useState(false);
  const [confirm, setConfirm] = useState('');
  const { data, loading, error, reload } = useAsync(() => api.get('/profile'), []);
  const matching = useAsync(() => api.get('/path/profile'), []);
  const verdicts = useAsync(() => api.get('/path/verdicts?kind=program'), []);
  const p = data ? data.profile : null;
  const targets = (data && data.targets) || [];

  if (loading) return <AppShell page="profile"><Card><Loader /></Card></AppShell>;
  if (error || !p) return <AppShell page="profile"><LoadError error={error} onRetry={reload} what="profile" /></AppShell>;

  const row = (label, value, note) => (
    <tr key={label}><th>{label}{note ? <><br /><span className="cap">{note}</span></> : null}</th>
      <td>{value || <span className="cap">Not added</span>}</td></tr>
  );
  const est = p.bachelorCgpa != null && p.bachelorScale ? germanGrade(p.bachelorCgpa, p.bachelorScale, p.passMark) : null;

  return (
    <AppShell page="profile">
      <Card className="card card--pad-l">
        <div className="row wr sp" style={{ gap: 12 }}>
          <div className="avatar-row">
            <span className="avatar avatar--lg">{(p.firstName || 'A')[0]}</span>
            <div>
              <h1 className="h1">{p.fullName}</h1>
              <p className="cap">{p.email}</p>
              <div className="row wr" style={{ gap: 6, marginTop: 4 }}>
                <span className="tag tag--pr">{user?.role === 'admin' ? 'Admin' : user?.role === 'contributor' ? 'Contributor' : 'Student'}</span>
                <span className="tag tag--out">Profile {p.completenessPct}%</span>
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Btn variant="outlined" size="sm" to="/settings">Settings</Btn>
            <Btn variant="filled" size="sm" to="/wizard?step=1">Edit profile</Btn>
          </div>
        </div>
        <div style={{ marginTop: 6 }}><CompletenessBar pct={p.completenessPct} /></div>
        <div className="row sp wr">
          <p className="cap">{p.completenessPct >= 100 ? 'Everything is filled in. Keep IELTS and APS dates current.' : 'Add the missing items to remove the “Provisional” label from your counts.'}</p>
          <Link className="link-quiet" to="/wizard">Resume where you left off</Link>
        </div>
      </Card>

      <div className="dash-grid">
        <div className="dash-main">
          <MatchSummary profile={matching.data && matching.data.profile}
            completeness={matching.data && matching.data.completeness}
            counts={verdicts.data && verdicts.data.counts} />
          <Card>
            <div className="row sp"><h2 className="h2">Personal</h2><Link className="link-quiet" to="/wizard?step=1">Edit</Link></div>
            <table className="kv"><tbody>
              {row('Date of birth', fmtDate(p.dateOfBirth), 'Age is checked at each deadline')}
              {row('Gender', lbl(p.gender, L.gender))}
              {row('City', p.city)}
              {row('Province', p.province)}
              {row('Nationality', 'Pakistan', 'Used for listings restricted to certain countries')}
              {row('WhatsApp', p.whatsapp || null, 'Optional, for reminders')}
            </tbody></table>
          </Card>

        </div>

        <div className="dash-side">
          <Card>
            <h2 className="h2">Documents ready</h2>
            <div className="chips">
              {Object.keys(DOCMAP).map(k => {
                const on = (p.documentsReady || []).includes(k);
                return <span key={k} className={'chip chip--sm' + (on ? ' is-on' : '')}>{on ? '✓ ' : ''}{DOCMAP[k]}</span>;
              })}
            </div>
            <p className="cap">A checklist for you only. No files are uploaded or stored.</p>
          </Card>

          <Card className="card card--tone">
            <div className="row" style={{ gap: 8 }}>
              <Icon name="shield" style={{ flex: 'none' }} />
              <h2 className="h2" style={{ color: 'inherit' }}>What we never ask for</h2>
            </div>
            <div className="col-4" style={{ color: 'inherit', fontSize: 13 }}>
              <span>CNIC or passport number</span>
              <span>Bank details or statements</span>
              <span>Uploaded documents</span>
              <span>Your password in plain text</span>
            </div>
            <Btn variant="outlined" size="sm" block to="/privacy">Read the privacy policy</Btn>
          </Card>

          <Card>
            <h2 className="h2">Account</h2>
            <Link className="row sp" to="/settings" style={{ color: 'inherit', textDecoration: 'none', padding: '6px 0' }}>
              <span className="h3">Settings and alerts</span><Icon name="chevron" size={18} />
            </Link>
            <Link className="row sp" to="/privacy" style={{ color: 'inherit', textDecoration: 'none', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span className="h3">Privacy and my data</span><Icon name="chevron" size={18} />
            </Link>
            <button className="row sp" type="button" style={{ width: '100%', color: 'var(--on-primary-container)', padding: '6px 0', borderTop: '1px solid var(--border)' }}
              onClick={async () => { await logout(); nav('/'); }}>
              <span className="h3">Log out</span><Icon name="logout2" size={18} />
            </button>
            <button className="row sp" type="button" style={{ width: '100%', color: 'var(--on-danger)', padding: '6px 0', borderTop: '1px solid var(--border)' }}
              onClick={() => setDel(true)}>
              <span className="h3">Delete my account</span><Icon name="trash" size={18} />
            </button>
          </Card>
        </div>
      </div>

      <Disclaimer />

      <Sheet open={del} title="Delete your account?" onClose={() => setDel(false)}
        footer={<div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <Btn variant="text" onClick={() => setDel(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={() => {
            if (confirm.trim().toUpperCase() !== 'DELETE') return toast('Type DELETE to confirm');
            setDel(false); toast('Account deletion is disabled in this build'); setConfirm('');
          }}>Delete account</Btn>
        </div>}>
        <p className="cap" style={{ marginBottom: 10 }}>This removes your profile, targets, saved list and notes. Once deleted it cannot be restored. Your match history and error reports stay anonymous.</p>
        <Field label="Type DELETE to confirm" htmlFor="confirm">
          <Input id="confirm" placeholder="DELETE" value={confirm} onChange={e => setConfirm(e.target.value)} className="input" />
        </Field>
      </Sheet>
    </AppShell>
  );
}
