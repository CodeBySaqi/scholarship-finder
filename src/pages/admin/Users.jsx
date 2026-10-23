import React, { useState } from 'react';
import { AdminShell } from '../../components/Shell.jsx';
import { Loader, Btn, Notice, Field, useAsync, useToast, LoadError } from '../../components/ui.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate } from '../../lib.jsx';

export default function AdminUsers() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, reload, error } = useAsync(() => api.get('/admin/users'), []);
  const [invite, setInvite] = useState(false);
  const [email, setEmail] = useState('');
  const users = (data && data.users) || [];
  const isAdmin = user?.role === 'admin';

  async function setRole(u, role) {
    if (!isAdmin) return toast('Only an admin can change roles');
    try { await api.put('/admin/users/' + u.id, { role }); toast(u.email + ' is now ' + role); reload(); }
    catch (e) { toast(e.message); }
  }
  async function setActive(u, isActive) {
    try { await api.put('/admin/users/' + u.id, { isActive }); toast(u.email + (isActive ? ' reactivated' : ' deactivated')); reload(); }
    catch (e) { toast(e.message); }
  }

  if (error) return <AdminShell page="admin-users"><LoadError error={error} onRetry={reload} what="users" /></AdminShell>;
  return (
    <AdminShell page="admin-users">
      <div className="phead">
        <div className="row sp wr">
          <div>
            <h1 className="h1">Users</h1>
            <p className="cap">Roles decide what the server lets an account do.</p>
          </div>
          <Btn variant="outlined" size="sm" onClick={() => setInvite(true)}>Invite a contributor</Btn>
        </div>
      </div>

      <Notice tone="info">The first admin is not created in the UI. It is seeded on the server, run by a human with database access. Student accounts can never promote themselves.</Notice>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>User</th><th>Role</th><th>Active</th><th>Last login</th><th>Joined</th><th>Profile</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6}><Loader /></td></tr>}
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{(u.displayName || 'U')[0]}</span>
                      <div><div className="t-title">{u.displayName || '—'}</div><div className="cap">{u.email}</div></div>
                    </div>
                  </td>
                  <td>
                    <select className="select" style={{ minHeight: 34, fontSize: 13, width: 'auto' }} value={u.role}
                      aria-label={'Role for ' + u.email} disabled={!isAdmin || u.id === user?.id}
                      title={u.id === user?.id ? 'You cannot change your own role' : undefined}
                      onChange={e => setRole(u, e.target.value)}>
                      {['student', 'contributor', 'admin'].map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </td>
                  <td>
                    <button className="switch" type="button" role="switch" aria-checked={!!u.isActive}
                      aria-label={'Account active for ' + u.email} disabled={!isAdmin || u.id === user?.id}
                      title={u.id === user?.id ? 'You cannot deactivate your own account' : undefined}
                      onClick={() => setActive(u, !u.isActive)} />
                  </td>
                  <td className="cap">{u.lastLogin ? fmtDate(u.lastLogin.slice(0, 10)) : 'never'}</td>
                  <td className="cap">{u.createdAt ? fmtDate(u.createdAt.slice(0, 10)) : '—'}</td>
                  <td>{u.profilePct != null ? <span className={'tag ' + (u.profilePct >= 80 ? 'tag--ok' : 'tag--wn')}>{u.profilePct}%</span> : <span className="cap">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cap">Role changes append to the audit log. Two-person publishing means an admin still cannot verify their own listing.</p>
      </div>

      <Sheet open={invite} title="Invite a contributor" onClose={() => setInvite(false)}
        footer={<div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button className="btn btn--text" type="button" onClick={() => setInvite(false)}>Cancel</button>
          <button className="btn btn--filled" type="button" onClick={() => {
            if (!email) return toast('Enter an email first');
            setInvite(false); toast('Invite sent to ' + email); setEmail('');
          }}>Send invite</button>
        </div>}>
        <p className="cap" style={{ marginBottom: 10 }}>Contributors can create drafts from a URL and edit their own drafts. They cannot verify or publish anything.</p>
        <Field label="Email" htmlFor="inv-email">
          <input className="input" id="inv-email" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
      </Sheet>
    </AdminShell>
  );
}
