import React, { useState } from 'react';
import { AdminShell } from '../../components/Shell.jsx';
import { Icon, Loader, Btn, Field, Notice, useAsync, useToast, LoadError } from '../../components/ui.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';

const TYPES = { university: 'University', uas: 'Applied sciences', tu: 'Technical university' };

export default function AdminUniversities() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, reload, error } = useAsync(() => api.get('/admin/universities'), []);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const blank = { name: '', city: '', state: '', type: 'university', websiteUrl: '', uniAssistMember: false };
  const [form, setForm] = useState(blank);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const unis = (data && data.universities) || [];
  const isAdmin = user?.role === 'admin';

  async function save() {
    setBusy(true);
    try {
      if (editId) {
        await api.put('/admin/universities/' + editId, form);
        toast('University updated');
      } else {
        await api.post('/admin/universities', form);
        toast('University added and logged');
      }
      setOpen(false); setEditId(null); setForm(blank);
      reload();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  }
  function openEdit(u) {
    setEditId(u.id);
    setForm({ name: u.name, city: u.city, state: u.state === '—' ? '' : u.state, type: u.type, websiteUrl: u.websiteUrl, uniAssistMember: !!u.uniAssistMember });
    setOpen(true);
  }
  async function remove(u) {
    setBusy(true);
    try {
      await api.del('/admin/universities/' + u.id);
      toast(u.name + ' deleted');
      setConfirmDelete(null);
      reload();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
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
            <thead><tr><th>University</th><th>City</th><th>Type</th><th>Funding</th><th>uni-assist</th><th>Programs</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
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
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
                      <a className="iconbtn" href={u.websiteUrl} target="_blank" rel="noopener" aria-label={'Open the website of ' + u.name} title="Open website"><Icon name="external" /></a>
                      {isAdmin && <button className="iconbtn" type="button" aria-label={'Edit ' + u.name} title="Edit" onClick={() => openEdit(u)}><Icon name="edit" /></button>}
                      {isAdmin && <button className="iconbtn" type="button" aria-label={'Delete ' + u.name} title="Delete" style={{ color: 'var(--on-danger)' }}
                        onClick={() => setConfirmDelete(u)}><Icon name="trash" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cap">Name and city must be unique together, so duplicate records fail at the database level.</p>
      </div>

      <Sheet open={open} title={editId ? 'Edit university' : 'Add a university'} onClose={() => { setOpen(false); setEditId(null); }}
        footer={<div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button className="btn btn--text" type="button" onClick={() => { setOpen(false); setEditId(null); }}>Cancel</button>
          <button className="btn btn--filled" type="button" onClick={save} disabled={user?.role !== 'admin' || busy}>{busy ? 'Saving…' : 'Save university'}</button>
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

      <Sheet open={!!confirmDelete} title="Delete this university?" onClose={() => setConfirmDelete(null)}
        footer={<div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn btn--text" type="button" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="btn btn--danger" type="button" disabled={busy} onClick={() => remove(confirmDelete)}>{busy ? 'Deleting…' : 'Delete'}</button>
        </div>}>
        {confirmDelete && (
          <div className="col" style={{ gap: 10 }}>
            <Notice tone="danger" icon="alert">
              <b>{confirmDelete.name}</b> in {confirmDelete.city} will be removed.
            </Notice>
            <p className="cap">
              {(confirmDelete.programs || 0) > 0
                ? 'This university still has ' + confirmDelete.programs + ' program(s) pointing at it. Move or delete those first — the server refuses to orphan them.'
                : 'Nothing points at this record, so it can go.'}
            </p>
          </div>
        )}
      </Sheet>
    </AdminShell>
  );
}
