import React, { useMemo, useState } from 'react';
import { AdminShell } from '../../components/Shell.jsx';
import { Icon, Btn, Field, Loader, Notice, LoadError, useAsync, useToast } from '../../components/ui.jsx';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useNotifications } from '../../components/notifications.jsx';

const LINKS = [
  { value: '', label: 'No link' },
  { value: '/dashboard', label: 'Dashboard' },
  { value: '/saved', label: 'Saved list' },
  { value: '/scholarships', label: 'Scholarships' },
  { value: '/programs', label: 'German programs' },
  { value: '/matches', label: 'Matches' },
  { value: '/wizard', label: 'Profile wizard' }
];

export default function Broadcast() {
  const { user } = useAuth();
  const toast = useToast();
  const { reload: reloadBell } = useNotifications();
  const { data, loading, reload, error } = useAsync(() => api.get('/admin/notifications'), []);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [audience, setAudience] = useState('all');
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const users = (data && data.users) || [];
  const sends = (data && data.sends) || [];
  const isAdmin = user?.role === 'admin';

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = users.filter(u => u.isActive);
    return q ? list.filter(u => (u.displayName + ' ' + u.email).toLowerCase().includes(q)) : list;
  }, [users, filter]);

  const recipients = audience === 'all'
    ? users.filter(u => u.isActive)
    : users.filter(u => selected.includes(u.id));

  const toggle = (id) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  async function send() {
    setBusy(true);
    try {
      const r = await api.post('/admin/notifications/broadcast', {
        title, body, audience, userIds: audience === 'selected' ? selected : [], link: link || null
      });
      toast('Sent to ' + r.send.recipients + ' ' + (r.send.recipients === 1 ? 'person' : 'people'));
      setTitle(''); setBody(''); setLink(''); setSelected([]); setAudience('all');
      reload(); reloadBell();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  }

  const canSend = title.trim() && body.trim() && recipients.length > 0 && isAdmin && !busy;

  if (error) return <AdminShell page="admin-broadcast"><LoadError error={error} onRetry={reload} what="broadcast tools" /></AdminShell>;

  return (
    <AdminShell page="admin-broadcast">
      <div className="phead">
        <div className="row sp wr">
          <div>
            <h1 className="h1">Broadcast</h1>
            <p className="cap">Send a notification to everyone, to one person, or to a hand-picked group. It lands in their bell and on their Notifications page.</p>
          </div>
          <span className="tag tag--out">{recipients.length} recipient{recipients.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="split">
        <section className="card card--pad-l">
          <h2 className="h2">New message</h2>
          <Field label="Title" htmlFor="bc-title" help="Shown in the bell popup — keep it under 60 characters.">
            <input className="input" id="bc-title" value={title} maxLength={120} onChange={e => setTitle(e.target.value)}
              placeholder="Three scholarships close this month" />
          </Field>
          <Field label="Message" htmlFor="bc-body" help="Body text. Plain sentences, no markup.">
            <textarea className="input" id="bc-body" rows={5} value={body} maxLength={1200}
              onChange={e => setBody(e.target.value)} placeholder="What changed, and what the reader should do about it." />
          </Field>
          <Field label="Link (optional)" htmlFor="bc-link">
            <select className="select" id="bc-link" value={link} onChange={e => setLink(e.target.value)}>
              {LINKS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </Field>

          <div className="field">
            <span className="lbl">Who receives it</span>
            <div className="radios">
              {[['all', 'Everyone active', 'Every account that can sign in right now'],
                ['selected', 'Selected people', 'Pick one or more accounts below']].map(([id, label, sub]) => (
                <label className="radio-card" key={id}>
                  <input type="radio" name="audience" value={id} checked={audience === id} onChange={() => setAudience(id)} />
                  <span className="t"><span className="h3">{label}</span><span className="cap">{sub}</span></span>
                </label>
              ))}
            </div>
          </div>

          {audience === 'selected' && (
            <div className="card card--flat" style={{ gap: 8 }}>
              <div className="row sp wr" style={{ gap: 8 }}>
                <input className="input" type="search" placeholder="Filter by name or email" value={filter}
                  onChange={e => setFilter(e.target.value)} style={{ maxWidth: 280 }} aria-label="Filter recipients" />
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn--text btn--sm" type="button" onClick={() => setSelected(shown.map(u => u.id))}>Select all shown</button>
                  <button className="btn btn--text btn--sm" type="button" onClick={() => setSelected([])}>Clear</button>
                </div>
              </div>
              <div className="picklist">
                {shown.map(u => (
                  <label className="check" key={u.id}>
                    <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
                    <span className="grow">
                      <b className="w500">{u.displayName}</b>
                      <span className="cap"> {u.email} · {u.role}</span>
                    </span>
                  </label>
                ))}
                {shown.length === 0 && <p className="cap">No active account matches that filter.</p>}
              </div>
            </div>
          )}

          {!isAdmin && <Notice tone="warning" icon="shield">Only an admin can send a broadcast. Contributors can read this page but not send.</Notice>}

          <div className="row sp wr" style={{ gap: 8 }}>
            <span className="cap">{recipients.length} {recipients.length === 1 ? 'person will' : 'people will'} get this notification.</span>
            <div className="row" style={{ gap: 8 }}>
              <Btn variant="text" size="sm" onClick={() => { setTitle(''); setBody(''); setLink(''); setSelected([]); }}>Reset</Btn>
              <button className="btn btn--filled" type="button" disabled={!canSend} onClick={send}>
                <Icon name="send" />{busy ? 'Sending…' : 'Send notification'}
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="row sp">
            <div><h2 className="h2">Sent</h2><p className="cap">The last broadcasts, newest first.</p></div>
            <span className="tag tag--out">{sends.length}</span>
          </div>
          {loading ? <Loader /> : sends.length === 0 ? (
            <p className="cap">Nothing sent yet. The first one you send appears here with its recipient count.</p>
          ) : (
            <div className="rows">
              {sends.map(s => (
                <div className="row sp" key={s.id} style={{ alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="h3">{s.title}</div>
                    <div className="cap">{s.body.length > 110 ? s.body.slice(0, 110) + '…' : s.body}</div>
                    <div className="cap">{s.sentBy} · {(s.sentAt || '').slice(0, 10)} · {s.audience === 'all' ? 'everyone' : 'selected'}</div>
                  </div>
                  <span className="tag tag--pr nowrap">{s.recipients} sent</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
