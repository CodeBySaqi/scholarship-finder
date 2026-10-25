import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, Btn, Badge } from './ui.jsx';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

/* ==========================================================================
   One notification system for every role.

   The bell, the unread count and the /notifications page read from the same
   provider, so marking something read in the popup is already read on the page
   and in the sidebar badge. Polling is deliberately slow (60s): this is a
   notification list, not a chat.
   ========================================================================== */

const Ctx = createContext({
  items: [], unread: 0, total: 0, loading: true, error: null,
  reload: () => {}, markRead: async () => {}, markAll: async () => {}, remove: async () => {}
});

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({ items: [], unread: 0, total: 0, loading: true, error: null });

  const load = useCallback(async () => {
    if (!user) {
      setState({ items: [], unread: 0, total: 0, loading: false, error: null });
      return;
    }
    try {
      const d = await api.get('/notifications');
      setState({ items: d.notifications || [], unread: d.unread || 0, total: d.total || 0, loading: false, error: null });
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e.message }));
    }
  }, [user]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const markRead = useCallback(async (id) => {
    let wasUnread = false;
    setState(s => ({
      ...s,
      items: s.items.map(n => {
        if (n.id !== id) return n;
        wasUnread = !n.readAt;
        return { ...n, readAt: n.readAt || new Date().toISOString() };
      }),
      unread: Math.max(0, s.unread - (wasUnread ? 1 : 0))
    }));
    try { await api.post('/notifications/' + id + '/read', {}); }
    catch { load(); }
  }, [load]);

  const markAll = useCallback(async () => {
    setState(s => ({ ...s, items: s.items.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })), unread: 0 }));
    try { await api.post('/notifications/read-all', {}); }
    finally { load(); }
  }, [load]);

  const remove = useCallback(async (id) => {
    setState(s => {
      const gone = s.items.find(n => n.id === id);
      return { ...s, items: s.items.filter(n => n.id !== id), unread: Math.max(0, s.unread - (gone && !gone.readAt ? 1 : 0)) };
    });
    try { await api.del('/notifications/' + id); } finally { load(); }
  }, [load]);

  return (
    <Ctx.Provider value={{ ...state, reload: load, markRead, markAll, remove }}>
      {children}
    </Ctx.Provider>
  );
}

export const useNotifications = () => useContext(Ctx);

const timeAgo = (iso) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
  const days = Math.round(hrs / 24);
  if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const TONE = { broadcast: 'tone-blue', deadline: 'tone-amber', account: 'tone-purple', content: 'tone-green', system: 'tone-blue' };
const ICON = { broadcast: 'bell', deadline: 'clock', account: 'person', content: 'file', system: 'info' };

export function NotificationIcon({ category }) {
  return <span className={'statcard__icon ' + (TONE[category] || 'tone-blue')} style={{ width: 36, height: 36, borderRadius: 11 }}>
    <Icon name={ICON[category] || 'bell'} />
  </span>;
}

/* ------------------------------------------------------------------- bell */
export function NotificationBell({ label = 'Notifications' }) {
  const { items, unread, markAll, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const preview = items.slice(0, 6);

  return (
    <div className="notif" ref={wrap}>
      <Badge content={unread > 9 ? '9+' : unread} isInvisible={!(unread > 0)} color="danger" size="sm"
        shape="circle" placement="top-right" classNames={{ badge: 'notif__count' }}>
        <Btn isIconOnly variant="text" className="iconbtn notif__btn"
          aria-label={label + (unread ? ', ' + unread + ' unread' : '')}
          aria-expanded={open} aria-haspopup="dialog" title={unread ? unread + ' unread notifications' : 'Notifications'}
          onClick={() => setOpen(o => !o)}>
          <Icon name="bell" />
        </Btn>
      </Badge>

      {open && (
        <div className="notif__pop" role="dialog" aria-label="Notifications">
          <div className="notif__head">
            <div>
              <b>Notifications</b>
              <span className="cap">{unread > 0 ? unread + ' unread' : 'You are all caught up'}</span>
            </div>
            {unread > 0 && <Btn variant="text" size="sm" onClick={markAll}>Mark all read</Btn>}
          </div>

          {preview.length === 0 ? (
            <div className="notif__empty">
              <Icon name="bell" />
              <span className="cap">Nothing here yet. Deadline reminders and admin messages arrive here.</span>
            </div>
          ) : (
            <ul className="notif__list">
              {preview.map(n => (
                <li key={n.id}>
                  <button className={'notif__item' + (n.readAt ? '' : ' is-unread')} type="button"
                    onClick={async () => {
                      await markRead(n.id);
                      setOpen(false);
                      nav(n.link || '/notifications');
                    }}>
                    <NotificationIcon category={n.category} />
                    <span className="notif__text">
                      <span className="notif__title">{n.title}</span>
                      <span className="cap">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span className="notif__dot" aria-label="Unread" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link className="notif__all" to="/notifications" onClick={() => setOpen(false)}>
            See all notifications <Icon name="chevron" />
          </Link>
        </div>
      )}
    </div>
  );
}
