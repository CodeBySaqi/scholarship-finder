/* ==========================================================================
   Data store.

   Two modes, same API for the rest of the server (db() / persist()):

   file      — data/db.json on disk. Used for local development and tests when
               no SUPABASE_URL is configured. Atomic writes, one process.

   supabase  — the same JSON document is kept in Postgres (Supabase) as a single
               row, and pushed after every change. This is what makes a deploy on
               a host with an ephemeral filesystem (Render, Fly, Cloud Run) safe:
               the container can be destroyed at any time, the data is not.

               Table it expects (see supabase/schema.sql):
                 create table app_state (
                   key        text primary key,
                   data       jsonb not null,
                   updated_at timestamptz not null default now()
                 );

   Why a document and not relational tables: the API is synchronous over an
   in-memory object graph, and this keeps that intact with no rewrite. It is a
   correct fit for one app instance and a data set of this size (a few hundred
   KB). Moving to real tables is a separate change — see DEPLOY.md.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(here, '..', '..', 'data');
export const DB_FILE = path.join(DATA_DIR, 'db.json');

const KEY = 'main';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const SYNC_MS = Number(process.env.STORE_SYNC_DEBOUNCE_MS || 300);

let cache = null;
let writeTimer = null;
let syncTimer = null;
let mode = 'file';
let lastSync = null;          /* { at, ok, error } */
let syncChain = Promise.resolve();

export const storeInfo = () => ({
  mode,
  key: KEY,
  lastSync,
  file: DB_FILE,
  supabase: SUPABASE_URL ? SUPABASE_URL.replace(/^https?:\/\//, '') : null
});

const headers = () => ({
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json'
});

async function fetchRow() {
  const url = `${SUPABASE_URL}/rest/v1/app_state?key=eq.${KEY}&select=key,data`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) throw new Error('read failed: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0].data : null;
}

async function writeRow(doc) {
  const url = `${SUPABASE_URL}/rest/v1/app_state`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key: KEY, data: doc, updated_at: new Date().toISOString() }])
  });
  if (!r.ok) throw new Error('write failed: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

/* ---------------------------------------------------------------- local file */
function readFile() {
  if (!fs.existsSync(DB_FILE)) return null;
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeFile(doc) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 1));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    /* a read-only filesystem on a host that keeps data in Supabase is fine */
    if (mode === 'file') throw e;
  }
}

/* -------------------------------------------------------------------- init */
export async function initStore() {
  if (SUPABASE_URL && SUPABASE_KEY) {
    mode = 'supabase';
    try {
      const remote = await fetchRow();
      if (remote) {
        cache = remote;
        writeFile(remote);                 /* warm local copy for `npm run seed` parity */
        lastSync = { at: new Date().toISOString(), ok: true, error: null };
        return storeInfo();
      }
      /* no row yet: publish whatever exists locally (first deploy after seeding) */
      const local = readFile();
      if (local) {
        cache = local;
        await writeRow(local);
        lastSync = { at: new Date().toISOString(), ok: true, error: null };
      }
    } catch (e) {
      /* Never start with an empty database because a network call failed: fall back
         to the local file and keep trying to sync on the next write. */
      console.error('[store] Supabase read failed, falling back to the local file:', e.message);
      lastSync = { at: new Date().toISOString(), ok: false, error: e.message };
      mode = 'file';
    }
  }
  return storeInfo();
}

/* ---------------------------------------------------------------- main API */
export function db() {
  if (cache) return cache;
  const local = readFile();
  if (!local) throw new Error('No data yet - run `npm run seed` first, or set SUPABASE_URL to use the hosted database');
  cache = local;
  return cache;
}

export function persist() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => { try { flush(); } catch (e) { console.error('[store]', e.message); } }, 30);

  if (mode === 'supabase') {
    /* debounce, then push once; writes are serialised so the newest document wins */
    clearTimeout(syncTimer);
    syncTimer = setTimeout(pushToSupabase, SYNC_MS);
  }
}

export function flush() {
  if (!cache) return;
  writeFile(cache);
}

async function pushToSupabase() {
  if (!cache) return;
  const snapshot = cache;
  syncChain = syncChain.then(async () => {
    try {
      await writeRow(snapshot);
      lastSync = { at: new Date().toISOString(), ok: true, error: null };
    } catch (e) {
      lastSync = { at: new Date().toISOString(), ok: false, error: e.message };
      console.error('[store] Supabase write failed:', e.message);
      mode = 'file';                        /* keep serving; retry on next write */
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => { mode = 'supabase'; pushToSupabase(); }, 5000);
    }
  }).catch(() => {});
  return syncChain;
}

/* Push a document straight to the hosted database (used by `npm run seed:remote`).
   Throws with a readable message when Supabase is not configured. */
export async function pushDocument(doc) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to seed the hosted database');
  }
  await writeRow(doc);
  lastSync = { at: new Date().toISOString(), ok: true, error: null };
  mode = 'supabase';
  cache = doc;
  return { pushed: true, target: SUPABASE_URL.replace(/^https?:\/\//, '') };
}

/* called on shutdown so the last debounced write is not lost */
export async function closeStore() {
  clearTimeout(writeTimer); clearTimeout(syncTimer);
  flush();
  if (mode === 'supabase' || SUPABASE_URL) {
    try { await pushToSupabase(); } catch { /* already logged */ }
  }
}

export function nextId(prefix, list) {
  let n = list.length + 1;
  const ids = new Set(list.map(x => x.id));
  while (ids.has(prefix + n)) n++;
  return prefix + n;
}

export function log(action, { adminId, entityType, entityId, detail }) {
  const d = db();
  const entry = {
    id: nextId('l', d.logs),
    adminId, action, entityType, entityId,
    detail: detail || {}, createdAt: new Date().toISOString()
  };
  d.logs.unshift(entry);          // append-only: never updated, never deleted
  persist();
  return entry;
}
