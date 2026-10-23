const KEY = 'sf.theme';
export function applyTheme(t) {
  if (!t || t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(KEY, t || 'auto'); } catch {}
}
export function readTheme() {
  try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; }
}
