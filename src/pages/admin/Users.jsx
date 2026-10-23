import React, { useState } from 'react';
import { AdminShell } from '../../components/Shell.jsx';
import { Icon, Loader, Btn, Notice, Field, useAsync, useToast, LoadError } from '../../components/ui.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate } from '../../lib.jsx';

const ROLE_TONE = { admin: 'tag--pr', contributor: 'tag--wn', student: 'tag--out' };
const yn = (v) => (v ? 'Yes' : 'No');
const or = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));

export default function AdminUsers() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, reload, error } = useAsync(() => api.get('/admin/users'), []);
  const [invite, setInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ displayName: '', email: '', role: 'student', isActive: true });
  const [busy, setBusy] = useState(false);
  const users = (data && data.users) || [];
  const isAdmin = user?.role === 'admin';

  const detail = useAsync(() => (detailId ? api.get('/admin/users/' + detailId) : Promise.resolve(null)), [detailId]);

  async function setRole(u, role) {
    if (!isAdmin) return toast('Only an admin can change roles');
    try { await api.put('/admin/users/' + u.id, { role }); toast(u.email + ' is now ' + role); reload(); }
    catch (e) { toast(e.message); }
  }
  async function setActive(u, isActive) {
    try { await api.put('/admin/users/' + u.id, { isActive }); toast(u.email + (isActive ? ' reactivated' : ' banned — they can no longer sign in')); reload(); }
    catch (e) { toast(e.message); }
  }
  function openEdit(u) {
    setEditId(u.id);
    setForm({ displayName: u.displayName || '', email: u.email || '', role: u.role, isActive: !!u.isActive });
  }
  async function saveEdit() {
    setBusy(true);
    try {
      await api.put('/admin/users/' + editId, form);
      toast('User updated');
      setEditId(null);
      reload();
      if (detailId === editId) detail.reload();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  }
  async function remove(u) {
    setBusy(true);
    try {
      await api.del('/admin/users/' + u.id);
      toast(u.email + ' deleted');
      setConfirmDelete(null);
      setDetailId(null);
      reload();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  }

  if (error) return <AdminShell page="admin-users"><LoadError error={error} onRetry={reload} what="users" /></AdminShell>;

  const d = detail.data && detail.data.user;

  return (
    <AdminShell page="admin-users">
      <div className="phead">
        <div className="row sp wr">
          <div>
            <h1 className="h1">Users</h1>
            <p className="cap">Roles decide what the server lets an account do. Banning blocks sign-in immediately.</p>
          </div>
          <Btn variant="outlined" size="sm" onClick={() => setInvite(true)}>Invite a contributor</Btn>
        </div>
      </div>

      <Notice tone="info">The first admin is not created in the UI. It is seeded on the server, run by a human with database access. Student accounts can never promote themselves.</Notice>

      <div className="card">
        <div className="table-wrap">
          <table className="table table--stack">
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last login</th><th>Joined</th><th>Profile</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7}><Loader /></td></tr>}
              {users.map(u => (
                <tr key={u.id}>
                  <td data-label="User">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{(u.displayName || 'U')[0]}</span>
                      <div>
                        <div className="t-title">{u.displayName || '—'}{u.id === user?.id ? <span className="cap"> (you)</span> : null}</div>
                        <div className="cap">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Role">
                    <select className="select" style={{ minHeight: 34, fontSize: 13, width: 'auto' }} value={u.role}
                      aria-label={'Role for ' + u.email} disabled={!isAdmin || u.id === user?.id}
                      title={u.id === user?.id ? 'You cannot change your own role' : undefined}
                      onChange={e => setRole(u, e.target.value)}>
                      {['student', 'contributor', 'admin'].map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </td>
                  <td data-label="Status">
                    {u.isActive ? <span className="tag tag--ok">active</span> : <span className="tag tag--er">banned</span>}
                  </td>
                  <td data-label="Last login" className="cap">{u.lastLogin ? fmtDate(u.lastLogin.slice(0, 10)) : 'never'}</td>
                  <td data-label="Joined" className="cap">{u.createdAt ? fmtDate(u.createdAt.slice(0, 10)) : '—'}</td>
                  <td data-label="Profile">{u.profilePct != null ? <span className={'tag ' + (u.profilePct >= 80 ? 'tag--ok' : 'tag--wn')}>{u.profilePct}%</span> : <span className="cap">—</span>}</td>
                  <td data-label="Actions">
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
                      <button className="iconbtn" type="button" aria-label={'View all details for ' + u.email} title="View details"
                        onClick={() => setDetailId(u.id)}><Icon name="eye" /></button>
                      <button className="iconbtn" type="button" aria-label={'Edit ' + u.email} title="Edit user"
                        disabled={!isAdmin} onClick={() => openEdit(u)}><Icon name="edit" /></button>
                      {isAdmin && u.id !== user?.id && (
                        <>
                          <button className="iconbtn" type="button" aria-label={(u.isActive ? 'Ban ' : 'Unban ') + u.email}
                            title={u.isActive ? 'Ban this user' : 'Unban this user'} onClick={() => setActive(u, !u.isActive)}>
                            <Icon name={u.isActive ? 'lock' : 'checkCircle'} />
                          </button>
                          <button className="iconbtn" type="button" aria-label={'Delete ' + u.email} title="Delete user"
                            style={{ color: 'var(--on-danger)' }} onClick={() => setConfirmDelete(u)}><Icon name="trash" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cap">Every change appends to the audit log, and the account is notified when a role or status changes.</p>
      </div>

      {/* ------------------------------------------------------- full profile */}
      <Sheet open={!!detailId} title="User details" onClose={() => setDetailId(null)}
        footer={<div className="row sp wr" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn btn--text btn--sm" type="button" onClick={() => setDetailId(null)}>Close</button>
          <Btn variant="outlined" size="sm" onClick={() => { const u = users.find(x => x.id === detailId); if (u) openEdit(u); }}>Edit this user</Btn>
        </div>}>
        {detail.loading && !d ? <Loader /> : !d ? <p className="cap">Details could not load.</p> : (
          <div className="col" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="avatar" style={{ width: 46, height: 46, fontSize: 18 }}>{(d.displayName || 'U')[0]}</span>
              <div>
                <div className="h2">{d.displayName}</div>
                <div className="cap">{d.email}</div>
                <div className="row wr" style={{ gap: 6, marginTop: 6 }}>
                  <span className={'tag ' + (ROLE_TONE[d.role] || 'tag--out')}>{d.role}</span>
                  {d.isActive ? <span className="tag tag--ok">active</span> : <span className="tag tag--er">banned</span>}
                  {d.emailVerified ? <span className="tag tag--ok">email verified</span> : <span className="tag tag--wn">email unverified</span>}
                </div>
              </div>
            </div>

            <div className="g2">
              <table className="kv"><tbody>
                <tr><th>User id</th><td className="mono">{d.id}</td></tr>
                <tr><th>Joined</th><td>{d.createdAt ? fmtDate(d.createdAt.slice(0, 10)) : '—'}</td></tr>
                <tr><th>Last login</th><td>{d.lastLogin ? fmtDate(d.lastLogin.slice(0, 10)) : 'never'}</td></tr>
                <tr><th>Profile complete</th><td>{d.profilePct != null ? d.profilePct + '%' : '—'}</td></tr>
                <tr><th>Saved listings</th><td>{d.savedCount}</td></tr>
                <tr><th>Notifications</th><td>{d.notificationCount} ({d.unreadCount} unread)</td></tr>
              </tbody></table>
              <table className="kv"><tbody>
                <tr><th>Full name</th><td>{or(d.profile.fullName)}</td></tr>
                <tr><th>City</th><td>{or(d.profile.city)}{d.profile.province ? ', ' + d.profile.province : ''}</td></tr>
                <tr><th>Institution</th><td>{or(d.profile.institution)}</td></tr>
                <tr><th>Degree level</th><td>{or(d.profile.currentLevel)}</td></tr>
                <tr><th>CGPA</th><td>{d.profile.bachelorCgpa != null ? d.profile.bachelorCgpa + ' / ' + or(d.profile.bachelorScale) : '—'}</td></tr>
                <tr><th>IELTS</th><td>{d.profile.ielts && d.profile.ielts.overall != null ? d.profile.ielts.overall + ' (' + or(d.profile.ielts.status) + ')' : or(d.profile.ielts && d.profile.ielts.status)}</td></tr>
                <tr><th>German</th><td>{or(d.profile.germanLevel)}</td></tr>
                <tr><th>APS</th><td>{or(d.profile.apsStatus)}</td></tr>
                <tr><th>WhatsApp</th><td>{or(d.profile.whatsapp)}</td></tr>
                <tr><th>Date of birth</th><td>{or(d.profile.dateOfBirth)}</td></tr>
              </tbody></table>
            </div>

            <div>
              <div className="h3">Targets</div>
              {d.targets.length === 0 ? <p className="cap">No degree targets saved.</p> : (
                <div className="chips" style={{ marginTop: 6 }}>
                  {d.targets.map((t, i) => <span className="chip is-on" key={i}>{t.degree} · {(t.fields || []).join(', ') || 'any field'} · {t.intakeYear}</span>)}
                </div>
              )}
            </div>

            <div>
              <div className="h3">Saved listings</div>
              {d.savedIds.length === 0 ? <p className="cap">Nothing saved.</p> : <p className="cap mono">{d.savedIds.join(', ')}</p>}
            </div>

            <div>
              <div className="h3">Recent actions in the audit log</div>
              {d.logs.length === 0 ? <p className="cap">No editorial actions recorded for this account.</p> : (
                <div className="rows" style={{ marginTop: 6 }}>
                  {d.logs.map(l => (
                    <div className="row sp" key={l.id}>
                      <span className="cap">{l.action} · {l.entityType} {l.entityId}</span>
                      <span className="cap nowrap">{(l.createdAt || '').slice(0, 10)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>

      {/* ------------------------------------------------------------ edit */}
      <Sheet open={!!editId} title="Edit user" onClose={() => setEditId(null)}
        footer={<div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn btn--text" type="button" onClick={() => setEditId(null)}>Cancel</button>
          <button className="btn btn--filled" type="button" onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>}>
        <Field label="Display name" htmlFor="eu-name">
          <input className="input" id="eu-name" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
        </Field>
        <Field label="Email" htmlFor="eu-email" help="Changing this changes how they sign in. It must be unique.">
          <input className="input" id="eu-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </Field>
        <Field label="Role" htmlFor="eu-role">
          <select className="select" id="eu-role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="student">Student</option>
            <option value="contributor">Contributor</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <div className="switch-row">
          <span className="t"><span className="h3">Account active</span><span className="cap">Turn off to ban: sign-in stops immediately and live sessions end.</span></span>
          <button className="switch" type="button" role="switch" aria-checked={form.isActive} aria-label="Account active"
            onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))} />
        </div>
        <p className="cap">You cannot remove your own admin role, ban yourself, or delete the last active admin.</p>
      </Sheet>

      {/* ---------------------------------------------------------- delete */}
      <Sheet open={!!confirmDelete} title="Delete this user?" onClose={() => setConfirmDelete(null)}
        footer={<div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn btn--text" type="button" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="btn btn--danger" type="button" disabled={busy} onClick={() => remove(confirmDelete)}>{busy ? 'Deleting…' : 'Delete permanently'}</button>
        </div>}>
        {confirmDelete && (
          <div className="col" style={{ gap: 10 }}>
            <Notice tone="danger" icon="alert">
              <b>{confirmDelete.displayName}</b> ({confirmDelete.email}) and their profile, targets, saved list,
              settings and notifications are removed. This cannot be undone.
            </Notice>
            <p className="cap">Their editorial actions stay in the audit log under their email address — that record is
              append-only on purpose, so nobody can erase what they published.</p>
            <p className="cap">Only an admin can delete. Banning is reversible; deleting is not.</p>
          </div>
        )}
      </Sheet>

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
