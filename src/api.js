const json = (r) => r.json().catch(() => ({}));

/* Every request is bounded: a dead API shows an error instead of a blank page. */
const TIMEOUT_MS = 15000;

async function req(path, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch('/api' + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  } catch (e) {
    const err = new Error(e.name === 'AbortError' ? 'The server took too long to answer' : 'Cannot reach the server');
    err.offline = true;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const data = await json(res);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    /* The session ended (sign-out elsewhere, password reset, deactivated account).
       Tell the app once; every page then stops showing an error and asks to sign in. */
    try { window.dispatchEvent(new CustomEvent('sf:unauthorized')); } catch { /* no window */ }
  }
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => req(p),
  post: (p, body) => req(p, { method: 'POST', body }),
  put: (p, body) => req(p, { method: 'PUT', body }),
  patch: (p, body) => req(p, { method: 'PATCH', body }),
  del: (p) => req(p, { method: 'DELETE' })
};

export const fmtDate = (iso) => {
  if (!iso) return 'No deadline stated';
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = iso.slice(0, 10).split('-');
  return Number(d) + ' ' + M[Number(m) - 1] + ' ' + y;
};
export const daysTo = (iso, today) => {
  if (!iso) return null;
  const a = new Date((today || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
  const b = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
};
export const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
export const money = (n) => (n == null ? '—' : '€' + Number(n).toLocaleString('en-US'));
