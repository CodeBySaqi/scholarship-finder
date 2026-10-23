import React, { useState } from 'react';
import { AdminShell } from '../../components/Shell.jsx';
import { Loader, Btn, Field, useAsync, useToast, LoadError } from '../../components/ui.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';

const TYPES = { university: 'University', uas: 'Applied sciences', tu: 'Technical university' };

export default function AdminUniversities() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, reload, error } = useAsync(() => api.get('/admin/universities'), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', state: '', type: 'university', websiteUrl: '', uniAssistMember: false });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const unis = (data && data.universities) || [];

  async function save() {
    try {
      await api.post('/admin/universities', form);
      setOpen(false);
      setForm({ name: '', city: '', state: '', type: 'university', websiteUrl: '', uniAssistMember: false });
      toast('University added and logged');
      reload();
    } catch (e) { toast(e.message); }
  }

  if (error) return <AdminShell page="admin-universities"><LoadError error={error} onRetry={reload} what="universities" /></AdminShell>;
  return (
    <AdminShell page="admin-universities">
      <div className="phead">
        <div className="row sp wr">
          <div>
            <h1 className="h1">Universities</h1>
            <p className="cap">Programs point at a university record, so the name and city are entered once.</p>
          </div>
          {user?.role === 'admin'
            ? <Btn variant="filled" size="sm" onClick={() => setOpen(true)}>Add university</Btn>
            : <Btn variant="outlined" size="sm" disabled title="Only an admin can add a university">Add university</Btn>}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>University</th><th>City</th><th>Type</th><th>Funding</th><th>uni-assist</th><th>Programs</th><th>Website</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7}><Loader /></td></tr>}
              {unis.map(u => (
                <tr key={u.id}>
                  <td className="t-title">{u.name}<div className="cap">{u.state}</div></td>
                  <td>{u.city}</td>
                  <td className="cap">{TYPES[u.type] || u.type}</td>
                  <td className="cap">{u.isPublic ? 'Public' : 'Private'}</td>
                  <td>{u.uniAssistMember ? <span className="tag tag--ok">member</span> : <span className="tag tag--out">direct</span>}</td>
                  <td className="cap">{u.programs ?? 0}</td>
                  <td><a className="btn btn--text btn--sm" href={u.websiteUrl} target="_blank" rel="noopener">Open</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cap">Name and city must be unique together, so duplicate records fail at the database level.</p>
      </div>

      <Sheet open={open} title="Add a university" onClose={() => setOpen(false)}
        footer={<div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button className="btn btn--text" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn--filled" type="button" onClick={save} disabled={user?.role !== 'admin'}>Save university</button>
        </div>}>
        <Field label="Name" htmlFor="u-name"><input className="input" id="u-name" value={form.name} onChange={e => set('name', e.target.value)} /></Field>
        <div className="g2">
          <Field label="City" htmlFor="u-city"><input className="input" id="u-city" value={form.city} onChange={e => set('city', e.target.value)} /></Field>
          <Field label="State" htmlFor="u-state"><input className="input" id="u-state" value={form.state} onChange={e => set('state', e.target.value)} /></Field>
        </div>
        <Field label="Type" htmlFor="u-type">
          <select className="select" id="u-type" value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="university">University</option><option value="uas">Applied sciences</option><option value="tu">Technical university</option>
          </select>
        </Field>
        <Field label="Website" htmlFor="u-web"><input className="input" id="u-web" type="url" placeholder="https://" value={form.websiteUrl} onChange={e => set('websiteUrl', e.target.value)} /></Field>
        <div className="switch-row">
          <span className="t"><span className="h3">uni-assist member</span><span className="cap">Applications go through uni-assist</span></span>
          <button className="switch" type="button" role="switch" aria-checked={form.uniAssistMember} aria-label="uni-assist member"
            onClick={() => set('uniAssistMember', !form.uniAssistMember)} />
        </div>
        <p className="cap">Adding a university is an admin action and is written to the audit log.</p>
      </Sheet>
    </AdminShell>
  );
}
