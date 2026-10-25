import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/Shell.jsx';
import { Card, Icon, Btn, Loader, Empty, useToast } from '../components/ui.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { useNotifications, NotificationIcon } from '../components/notifications.jsx';

const FILTERS = [['all', 'All'], ['unread', 'Unread']];

const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function Notifications() {
  const { items, unread, total, loading, error, markRead, markAll, remove, reload } = useNotifications();
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const toast = useToast();

  const rows = useMemo(() => (filter === 'unread' ? items.filter(n => !n.readAt) : items), [items, filter]);
  const open = items.find(n => n.id === openId) || null;

  /* opening a notification is what reads it — the same rule the popup uses */
  function openOne(n) {
    setOpenId(n.id);
    if (!n.readAt) markRead(n.id);
  }

  return (
    <AppShell page="notifications" counts={{ summary: unread ? unread + ' unread' : 'No unread notifications' }}>
      <div className="phead">
        <div className="row sp wr">
          <div>
            <h1 className="h1">Notifications</h1>
            <p className="cap">Deadline reminders, account changes and messages from the editors. Opening one marks it read.</p>
          </div>
          <div className="row wr" style={{ gap: 8 }}>
            {unread > 0 && <Btn variant="outlined" size="sm" onClick={async () => { await markAll(); toast('All notifications marked as read'); }}>Mark all read</Btn>}
            <Btn variant="text" size="sm" onClick={reload}>Refresh</Btn>
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {FILTERS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>
            {label}{k === 'unread' && unread > 0 ? ' · ' + unread : ''}
          </button>
        ))}
      </div>

      {error && (
        <Card>
          <div className="row" style={{ gap: 10 }}>
            <span className="statcard__icon tone-amber"><Icon name="alert" /></span>
            <div><div className="h3">Notifications could not load</div><p className="cap">{error}</p></div>
          </div>
          <Btn variant="filled" size="sm" onClick={reload} style={{ alignSelf: 'flex-start', marginTop: 12 }}>Try again</Btn>
        </Card>
      )}

      {loading && !items.length ? <Card><Loader label="Loading notifications" /></Card> : (
        <Card>
          <div className="row sp">
            <div className="h2">Inbox</div>
            <span className="tag tag--out">{total} total · {unread} unread</span>
          </div>

          {rows.length === 0 ? (
            <Empty icon="bell" title={filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}
              text={filter === 'unread' ? 'You have read everything. Switch to All to look back.' : 'When a saved deadline gets close, or an editor sends an update, it appears here.'} />
          ) : (
            <ul className="notif-page">
              {rows.map(n => (
                <li key={n.id}>
                  <button className={'notif-row' + (n.readAt ? '' : ' is-unread')} type="button" onClick={() => openOne(n)}>
                    <NotificationIcon category={n.category} />
                    <span className="notif-row__main">
                      <span className="notif-row__title">{n.title}</span>
                      <span className="cap notif-row__body">{n.body}</span>
                    </span>
                    <span className="notif-row__meta">
                      <span className="cap nowrap">{when(n.createdAt)}</span>
                      {n.readAt
                        ? <span className="tag tag--out">read</span>
                        : <span className="tag tag--pr">unread</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Sheet open={!!open} title={open ? open.title : ''} onClose={() => setOpenId(null)}
        footer={open && (
          <div className="row sp wr" style={{ gap: 8, marginTop: 14 }}>
            <Btn variant="text" size="sm" onClick={async () => { await remove(open.id); setOpenId(null); toast('Notification removed'); }}>Delete</Btn>
            <div className="row" style={{ gap: 8 }}>
              {open.link && <Btn variant="filled" size="sm" to={open.link} onClick={() => setOpenId(null)}>Open the page <Icon name="chevron" /></Btn>}
              <Btn size="sm" onClick={() => setOpenId(null)}>Close</Btn>
            </div>
          </div>
        )}>
        {open && (
          <div className="col" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 10 }}>
              <NotificationIcon category={open.category} />
              <div>
                <div className="cap">{when(open.createdAt)} · from {open.createdBy || 'system'}</div>
                <div className="cap">{open.readAt ? 'Read' : 'Unread until you opened this'}</div>
              </div>
            </div>
            <p className="src">{open.body}</p>
            {open.link && <p className="cap">Link: <Link className="link-quiet" to={open.link} onClick={() => setOpenId(null)}>{open.link}</Link></p>}
          </div>
        )}
      </Sheet>
    </AppShell>
  );
}
