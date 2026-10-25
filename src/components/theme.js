const KEY = 'sf.theme';

/* The app paints itself from `data-theme` on <html> (see tokens.css). HeroUI
   switches its own theme on a `.dark` class by default, so the same call sets
   both: one switch, no chance of the two drifting apart. */
function paint(el, dark) {
  el.classList.toggle('dark', !!dark);
}

export function applyTheme(t) {
  const el = document.documentElement;
  const auto = !t || t === 'auto';
  if (auto) el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t);
  const dark = auto
    ? (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    : t === 'dark';
  paint(el, dark);
  try { localStorage.setItem(KEY, t || 'auto'); } catch {}
}

export function readTheme() {
  try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; }
}

/* Following the system theme means reacting to it changing while the page is open. */
export function watchTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const sync = () => { if (readTheme() === 'auto') applyTheme('auto'); };
  if (mq.addEventListener) mq.addEventListener('change', sync);
  else if (mq.addListener) mq.addListener(sync);
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', sync);
    else if (mq.removeListener) mq.removeListener(sync);
  };
}
