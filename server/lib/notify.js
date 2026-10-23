/* ==========================================================================
   Notifications.

   One row per recipient. A broadcast to 500 students is 500 rows, which sounds
   wasteful until you need "read by this person, not that one" — which is the
   whole point of the feature. Rows are small and the store is a single
   document, so this stays simple and correct.

   Shape:
     { id, userId, title, body, category, link, createdAt, readAt, createdBy,
       broadcastId }

   category: 'system' | 'broadcast' | 'deadline' | 'account' | 'content'
   ========================================================================== */
import { nextId } from './store.js';

export const CATEGORIES = ['system', 'broadcast', 'deadline', 'account', 'content'];
const MAX_ROWS = 2000;

/* The store is a JSON document that has been through several versions. Any
   collection added later must be materialised before a read touches it. */
export function ensureCollections(d) {
  let changed = false;
  if (!Array.isArray(d.notifications)) { d.notifications = []; changed = true; }
  if (!d.siteSettings || typeof d.siteSettings !== 'object' || Array.isArray(d.siteSettings)) {
    d.siteSettings = {};
    changed = true;
  }
  if (!Array.isArray(d.notificationSends)) { d.notificationSends = []; changed = true; }
  return changed;
}

const clamp = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

export function addNotification(d, { userId, title, body, category = 'system', link = null, createdBy = 'system', broadcastId = null, createdAt = null }) {
  const row = {
    id: nextId('nt-', d.notifications),
    userId,
    title: clamp(title, 120),
    body: clamp(body, 1200),
    category: CATEGORIES.includes(category) ? category : 'system',
    link: link ? clamp(link, 200) : null,
    createdAt: createdAt || new Date().toISOString(),
    readAt: null,
    createdBy,
    broadcastId
  };
  d.notifications.push(row);
  /* keep the document bounded: drop the oldest rows once it grows */
  if (d.notifications.length > MAX_ROWS) {
    d.notifications.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    d.notifications = d.notifications.slice(d.notifications.length - MAX_ROWS);
  }
  return row;
}

/* to every active account, or to a list of ids */
export function notifyUsers(d, userIds, payload) {
  const ids = [...new Set(userIds)].filter(id => d.users.some(u => u.id === id));
  const broadcastId = 'bc-' + Date.now().toString(36);
  const rows = ids.map(userId => addNotification(d, { ...payload, userId, broadcastId }));
  return { broadcastId, rows, recipients: ids };
}

export function listFor(d, userId, { limit = 100 } = {}) {
  return d.notifications
    .filter(n => n.userId === userId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

export function unreadCount(d, userId) {
  return d.notifications.filter(n => n.userId === userId && !n.readAt).length;
}

export function summary(d, userId) {
  const rows = listFor(d, userId, { limit: 50 });
  return {
    notifications: rows.map(n => ({
      id: n.id, title: n.title, body: n.body, category: n.category, link: n.link,
      createdAt: n.createdAt, readAt: n.readAt, createdBy: n.createdBy
    })),
    unread: unreadCount(d, userId),
    total: d.notifications.filter(n => n.userId === userId).length
  };
}
