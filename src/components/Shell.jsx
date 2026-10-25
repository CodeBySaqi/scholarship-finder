import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Btn, Avatar } from './ui.jsx';
import SiteFooter from './SiteFooter.jsx';
import { useAuth } from '../auth.jsx';
import { applyTheme, readTheme } from './theme.js';
import { NotificationBell, useNotifications } from './notifications.jsx';

const STUDENT_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/matches', label: 'Matches', icon: 'target' },
  { to: '/scholarships', label: 'Scholarships', icon: 'search' },
  { to: '/programs', label: 'German programs', icon: 'school' },
  { to: '/saved', label: 'Saved', icon: 'bookmark' }
];
const ACCOUNT_NAV = [
  { to: '/notifications', label: 'Notifications', icon: 'bell', badge: 'unread' },
  { to: '/profile', label: 'Profile', icon: 'person' },
  { to: '/settings', label: 'Settings', icon: 'settings' }
];
const ADMIN_GROUPS = [
  ['Overview', [
    { to: '/admin', label: 'Dashboard', icon: 'grid', end: true },
    { to: '/admin/queue', label: 'Review queue', icon: 'clock' },
    { to: '/admin/errors', label: 'Error reports', icon: 'flag' }
  ]],
  ['Content', [
    { to: '/admin/listings', label: 'Scholarships & programs', icon: 'list' },
    { to: '/admin/universities', label: 'Universities', icon: 'building' },
    { to: '/admin/research', label: 'AI research', icon: 'sparkle' }
  ]],
  ['People', [
    { to: '/admin/users', label: 'Users & roles', icon: 'users' },
    { to: '/admin/broadcast', label: 'Broadcast', icon: 'mail' },
    { to: '/admin/logs', label: 'Audit log', icon: 'file' }
  ]],
  ['You', [
    { to: '/notifications', label: 'Notifications', icon: 'bell', badge: 'unread' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
    { to: '/', label: 'Public site', icon: 'globe' }
  ]]
];

function useShell(mode, page) {
  useEffect(() => {
    document.body.dataset.shell = mode;
    document.body.dataset.page = page || '';
  }, [mode, page]);
}

/* The sidebar has two states: a drawer under 1024px, a column that collapses
   above it. State is resolved against a live media-query listener rather than a
   one-off matchMedia() at click time, so a resize or a rotation can never leave
   the drawer half-open. The two states are mutually exclusive. */
function useSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sf.sidebar') === 'collapsed'; } catch { return false; }
  });
  const [drawer, setDrawer] = useState(false);
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  const location = useLocation();

  /* track the breakpoint continuously */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = (e) => setWide(e.matches);
    setWide(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', sync);
    else if (mq.addListener) mq.addListener(sync);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', sync);
      else if (mq.removeListener) mq.removeListener(sync);
    };
  }, []);

  /* a drawer is a phone thing: at desktop width it must never stay open */
  useEffect(() => { if (wide) setDrawer(false); }, [wide]);

  /* navigating always closes the drawer */
  useEffect(() => { setDrawer(false); }, [location.pathname]);

  /* escape closes it, like every other overlay */
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  useEffect(() => {
    document.body.classList.toggle('is-collapsed', collapsed && wide);
    try { localStorage.setItem('sf.sidebar', collapsed ? 'collapsed' : 'open'); } catch { /* private mode */ }
    return () => document.body.classList.remove('is-collapsed');
  }, [collapsed, wide]);

  /* the bottom bar steps aside while the drawer is open */
  useEffect(() => {
    document.body.classList.toggle('drawer-open', drawer && !wide);
    return () => document.body.classList.remove('drawer-open');
  }, [drawer, wide]);

  return {
    collapsed: collapsed && wide,
    drawer: drawer && !wide,
    wide,
    setDrawer,
    toggle: () => {
      if (wide) { setDrawer(false); setCollapsed(c => !c); }
      else { setCollapsed(false); setDrawer(d => !d); }
    }
  };
}

/* --------------------------------------------------------------- dark mode */
function ThemeToggle() {
  const [theme, setTheme] = useState(readTheme());
  const dark = theme === 'dark' || (theme === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <button className="iconbtn" type="button" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'} aria-pressed={dark}
      onClick={() => { const next = dark ? 'light' : 'dark'; setTheme(next); applyTheme(next); }}>
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  );
}

/* ------------------------------------------------------------------ search */
function HeaderSearch({ target = '/scholarships', placeholder = 'Search scholarships and programs' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const input = useRef(null);
  const wrap = useRef(null);

  useEffect(() => {
    if (open && input.current) input.current.focus();
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDoc = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDoc); };
  }, [open]);

  const submit = (e) => {
    e.preventDefault();
    nav(target + (q.trim() ? '?q=' + encodeURIComponent(q.trim()) : ''));
    setOpen(false);
  };

  return (
    <div className={'hsearch' + (open ? ' is-open' : '')} ref={wrap}>
      <button className="iconbtn hsearch__toggle" type="button" aria-label="Search" aria-expanded={open}
        onClick={() => setOpen(o => !o)}><Icon name={open ? 'close' : 'search'} /></button>
      <form className="searchpill searchpill--form" role="search" onSubmit={submit}>
        <Icon name="search" />
        <input ref={input} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
          aria-label={placeholder} enterKeyHint="search" />
        {q && <button type="button" className="searchpill__clear" aria-label="Clear search" onClick={() => setQ('')}><Icon name="close" /></button>}
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ sidebar */
function Sidebar({ mode, counts, drawer, collapsed, onClose }) {
  const { user, logout } = useAuth();
  const { unread } = useNotifications();
  const location = useLocation();
  const nav = useNavigate();

  const groups = mode === 'admin' ? ADMIN_GROUPS : [
    ['Menu', STUDENT_NAV.map(n => (n.to === '/saved' ? { ...n, count: counts.saved } : n))],
    ['Account', ACCOUNT_NAV],
    ...(user && (user.role === 'admin' || user.role === 'contributor')
      ? [['Editorial', [{ to: '/admin', label: 'Admin console', icon: 'shield' }]]] : []),
    ['System', [{ to: '/', label: 'Public site', icon: 'globe' }]]
  ];

  const isCur = (n) => (n.end ? location.pathname === n.to : location.pathname === n.to || location.pathname.startsWith(n.to + '/'));

  return (
    <>
      <aside className={'side' + (drawer ? ' is-open' : '') + (collapsed ? ' is-collapsed' : '')}
        id="sidebar" aria-label="Main navigation" aria-hidden={collapsed ? 'true' : undefined}>
        <Link className="side__brand" to={mode === 'admin' ? '/admin' : '/dashboard'} onClick={onClose}>
          <span className="side__mark"><Icon name={mode === 'admin' ? 'shield' : 'cap'} /></span>
          <span className="grow">
            <span className="side__name">{mode === 'admin' ? 'Admin console' : 'Scholarship Finder'}</span>
            <span className="side__sub">{mode === 'admin' ? 'Editorial operations' : 'Pakistan → Germany'}</span>
          </span>
        </Link>
        <div className="side__scroll">
          {groups.map(([label, items]) => (
            <div className="side__group" key={label}>
              <div className="eyebrow" style={{ padding: '0 12px 8px' }}>{label}</div>
              {items.map(n => {
                const badge = n.badge === 'unread' ? unread : n.count;
                return (
                  <Link key={n.to + n.label} className="side__link" to={n.to} onClick={onClose}
                    aria-current={isCur(n) ? 'page' : undefined}>
                    <Icon name={n.icon} /><span className="grow">{n.label}</span>
                    {badge ? <span className="side__badge">{badge}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div className="side__foot">
          <div className="side__user">
            <Avatar className="avatar" aria-hidden="true" size="sm" radius="full" color="primary"
              name={(user?.displayName || 'A')[0].toUpperCase()} />
            <span className="meta">
              <b>{user ? user.displayName : 'Guest'}</b>
              <span>{user ? user.role : 'signed out'}</span>
            </span>
            <Btn isIconOnly aria-label="Sign out" title="Sign out"
              onClick={async () => { await logout(); nav('/'); }}><Icon name="logout2" /></Btn>
          </div>
        </div>
      </aside>
      {drawer ? <div className="scrim side-scrim is-open" onClick={onClose} aria-hidden="true" /> : null}
    </>
  );
}

function MenuButton({ onToggle, collapsed }) {
  return (
    <button className="iconbtn js-menu" type="button" aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-controls="sidebar" aria-expanded={!collapsed}
      style={{ display: 'grid' }} onClick={onToggle}><Icon name="menu" /></button>
  );
}

/* -------------------------------------------------------------------- shells */

function AdminBottomNav() {
  const items = [
    { to: '/admin', label: 'Overview', icon: 'grid', end: true },
    { to: '/admin/queue', label: 'Queue', icon: 'clock' },
    { to: '/admin/listings', label: 'Listings', icon: 'list' },
    { to: '/admin/broadcast', label: 'Send', icon: 'mail' },
    { to: '/notifications', label: 'Alerts', icon: 'bell' }
  ];
  return (
    <nav className="bottomnav" aria-label="Admin shortcuts">
      {items.map(n => <NavLink key={n.to} to={n.to} end={n.end}><Icon name={n.icon} />{n.label}</NavLink>)}
    </nav>
  );
}

const find = (nav, to) => nav.find(n => n.to === to) || { to, label: to, icon: 'list' };
const BOTTOM_ROUTES = [
  find(STUDENT_NAV, '/dashboard'),
  find(STUDENT_NAV, '/matches'),
  find(STUDENT_NAV, '/scholarships'),
  find(STUDENT_NAV, '/saved'),
  { to: '/notifications', label: 'Alerts', icon: 'bell' }
];

export function AppShell({ page, children, counts = {} }) {
  useShell('app', page);
  const { user } = useAuth();
  const { unread } = useNotifications();
  const side = useSidebar();

  return (
    <>
      <Sidebar mode="app" counts={counts} drawer={side.drawer} collapsed={side.collapsed} onClose={() => side.setDrawer(false)} />
      <header className="topbar">
        <div className="topbar__in">
          <MenuButton onToggle={side.toggle} collapsed={side.collapsed} />
          <div className="greeting grow">
            <span className="h2">Hi, {(user?.displayName || 'there').split(' ')[0]}</span>
            <span className="cap">{unread ? unread + ' unread notification' + (unread === 1 ? '' : 's') : (counts.summary || 'Your saved list and matches')}</span>
          </div>
          <HeaderSearch />
          <ThemeToggle />
          <NotificationBell />
          <Link className="iconbtn hide-sm" to="/settings" aria-label="Settings"><Icon name="settings" /></Link>
          <Link className="avatar" to="/profile" aria-label="Your profile">
            <Avatar size="sm" radius="full" color="primary" name={(user?.displayName || 'A')[0].toUpperCase()} />
          </Link>
        </div>
      </header>
      <main className="page" id="page">{children}</main>
      {/* five tabs, chosen by route rather than by array position: inserting a
          sidebar entry must never silently change what the phone bar shows */}
      <nav className="bottomnav">
        {[BOTTOM_ROUTES].flat().map(n => (
          <NavLink key={n.to} to={n.to}><Icon name={n.icon} />{n.label}</NavLink>
        ))}
      </nav>
    </>
  );
}

export function AdminShell({ page, children }) {
  useShell('admin', page);
  const { user } = useAuth();
  const { unread } = useNotifications();
  const side = useSidebar();

  return (
    <>
      <Sidebar mode="admin" counts={{}} drawer={side.drawer} collapsed={side.collapsed} onClose={() => side.setDrawer(false)} />
      <header className="topbar">
        <div className="topbar__in">
          <MenuButton onToggle={side.toggle} collapsed={side.collapsed} />
          <Link className="brand" to="/admin"><span className="brand__mark"><Icon name="shield" /></span>
            <span className="brand__name hide-sm">Admin console</span></Link>
          <div className="grow" />
          <HeaderSearch target="/admin/listings" placeholder="Search listings" />
          <span className="role-pill hide-sm" data-role={user?.role}>{user?.role || 'guest'}</span>
          <ThemeToggle />
          <NotificationBell />
          <Link className="avatar" to="/admin/users" aria-label="Your account">
            <Avatar size="sm" radius="full" color="primary" name={(user?.displayName || 'A')[0].toUpperCase()} />
          </Link>
          {unread > 0 && <span className="sr-only">{unread} unread notifications</span>}
        </div>
      </header>
      <main className="page" id="page">{children}</main>
      <AdminBottomNav />
    </>
  );
}

export function PublicShell({ page, children, minimal, footer = true }) {
  useShell(minimal ? 'auth' : 'public', page);
  const { user } = useAuth();
  return (
    <>
      <header className="pubhead">
        <div className="pubhead__in">
          <Link className="brand" to="/"><span className="brand__mark"><Icon name="cap" /></span>
            <span className="brand__name"><span className="hide-sm">Scholarship Finder</span></span></Link>
          {minimal ? null : (
            <nav aria-label="Main">
              <Link to="/scholarships">Scholarships</Link>
              <Link to="/programs">German programs</Link>
              <Link to="/#how">How it works</Link>
            </nav>
          )}
          <div className="actions">
            <ThemeToggle />
            {user
              ? <Btn variant="filled" size="sm" to={user.role === 'admin' || user.role === 'contributor' ? '/admin' : '/dashboard'}>Open app</Btn>
              : <>
                  <Btn variant="text" size="sm" to="/login">Log in</Btn>
                  <Btn variant="filled" size="sm" to="/signup">Get started</Btn>
                </>}
          </div>
        </div>
      </header>
      <main className={minimal ? 'page page--narrow' : 'page'} id="page">{children}</main>
      {!minimal && footer ? <SiteFooter compact /> : null}
    </>
  );
}

export function BareShell({ page, children }) {
  useShell('none', page);
  return <main id="page">{children}</main>;
}
