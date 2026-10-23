import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Icon, useToast } from './ui.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { applyTheme, readTheme } from './theme.js';

const STUDENT_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/matches', label: 'Matches', icon: 'target' },
  { to: '/scholarships', label: 'Scholarships', icon: 'search' },
  { to: '/programs', label: 'German programs', icon: 'school' },
  { to: '/saved', label: 'Saved', icon: 'bookmark' }
];
const ACCOUNT_NAV = [
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
    { to: '/admin/universities', label: 'Universities', icon: 'building' }
  ]],
  ['People', [
    { to: '/admin/users', label: 'Users & roles', icon: 'users' },
    { to: '/admin/logs', label: 'Audit log', icon: 'file' }
  ]],
  ['System', [
    { to: '/dashboard', label: 'Student app', icon: 'home' },
    { to: '/', label: 'Public site', icon: 'globe' }
  ]]
];

function useShell(mode, page) {
  useEffect(() => {
    document.body.dataset.shell = mode;
    document.body.dataset.page = page || '';
  }, [mode, page]);
}

/* --------------------------------------------------------------- demo panel */
const DEMO = [
  { email: 'ayesha@example.com', label: 'Ayesha (student)' },
  { email: 'bilal@example.com', label: 'Bilal (new student)' },
  { email: 'contributor@example.com', label: 'Contributor' },
  { email: 'admin@example.com', label: 'Admin' }
];

function DemoPanel() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(readTheme());
  const { user, login, logout } = useAuth();
  const toast = useToast();
  return (
    <>
      <button className="iconbtn" type="button" aria-label="Demo controls" title="Demo controls"
        aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name="tune" /></button>
      <div className={'demo-panel' + (open ? ' is-open' : '')}>
        <div className="grp"><b>Theme</b>
          <div className="opts">
            {['auto', 'light', 'dark'].map(t => (
              <button key={t} type="button" aria-pressed={theme === t}
                onClick={() => { setTheme(t); applyTheme(t); }}>{t === 'auto' ? 'System' : t[0].toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
        </div>
        <div className="grp"><b>Demo accounts</b>
          <div className="opts">
            {DEMO.map(d => (
              <button key={d.email} type="button" disabled={!!user && user.email === d.email}
                aria-pressed={!!user && user.email === d.email}
                onClick={async () => {
                  try {
                    if (user) await logout();
                    await login(d.email, 'demo1234');
                    toast('Signed in as ' + d.label);
                    setOpen(false);
                  } catch (e) { toast(e.message); }
                }}>{d.label}</button>
            ))}
          </div>
        </div>
        <p className="cap" style={{ margin: 0 }}>Everything here is a real request to the local API — publishing, saving and matching all persist in <code>data/db.json</code>.</p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ sidebar */
function Sidebar({ mode, counts }) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const groups = mode === 'admin' ? ADMIN_GROUPS : [
    ['Menu', STUDENT_NAV.map(n => n.to === '/saved' ? { ...n, count: counts.saved } : n)],
    ['Account', ACCOUNT_NAV],
    ...(user && (user.role === 'admin' || user.role === 'contributor')
      ? [['Admin', [{ to: '/admin', label: 'Admin console', icon: 'shield' }]]] : []),
    ['System', [
      { to: '/', label: 'Public site', icon: 'globe' }
    ]]
  ];

  const isCur = (n) => n.end ? location.pathname === n.to : location.pathname === n.to || location.pathname.startsWith(n.to + '/');

  return (
    <>
      <aside className={'side' + (open ? ' is-open' : '')} aria-label="Main navigation">
        <Link className="side__brand" to={mode === 'admin' ? '/admin' : '/dashboard'}>
          <span className="side__mark"><Icon name={mode === 'admin' ? 'shield' : 'cap'} /></span>
          <span className="grow">
            <span className="side__name">{mode === 'admin' ? 'Admin console' : 'Scholarship Finder'}</span>
            <span className="side__sub">{mode === 'admin' ? 'Two-person publish gate' : 'Pakistan → Germany'}</span>
          </span>
        </Link>
        <div className="side__scroll">
          {groups.map(([label, items]) => (
            <div className="side__group" key={label}>
              <div className="eyebrow" style={{ padding: '0 12px 8px' }}>{label}</div>
              {items.map(n => (
                <Link key={n.to + n.label} className="side__link" to={n.to} aria-current={isCur(n) ? 'page' : undefined}>
                  <Icon name={n.icon} /><span className="grow">{n.label}</span>
                  {n.count ? <span className="side__badge">{n.count}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="side__foot">
          <div className="side__user">
            <span className="avatar" aria-hidden="true">{(user?.displayName || 'A')[0]}</span>
            <span className="meta">
              <b>{user ? user.displayName : 'Guest'}</b>
              <span>{user ? user.role : 'signed out'}</span>
            </span>
            <button className="btn btn--icon btn--outlined" type="button" aria-label="Sign out" title="Sign out"
              onClick={async () => { await logout(); nav('/'); }}><Icon name="logout2" /></button>
          </div>
        </div>
      </aside>
      <div className={'scrim side-scrim' + (open ? ' is-open' : '')} onClick={() => setOpen(false)} />
    </>
  );
}

/* -------------------------------------------------------------------- shells */
export function AppShell({ page, children, counts = {} }) {
  useShell('app', page);
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Sidebar mode="app" counts={counts} />
      <header className="topbar">
        <div className="topbar__in">
          <button className="iconbtn js-menu" type="button" aria-label="Open menu" aria-controls="sidebar"
            style={{ display: 'grid' }} onClick={() => {
              const s = document.querySelector('.side'); const sc = document.querySelector('.side-scrim');
              const open = !s.classList.contains('is-open');
              s.classList.toggle('is-open', open); sc.classList.toggle('is-open', open);
            }}><Icon name="menu" /></button>
          <div className="greeting grow">
            <span className="h2">Hi, {(user?.displayName || 'there').split(' ')[0]}</span>
            <span className="cap">{counts.summary || 'Your saved list and matches'}</span>
          </div>
          <Link className="searchpill" to="/scholarships"><Icon name="search" />Search scholarships and programs</Link>
          <DemoPanel />
          {user && (user.role === 'admin' || user.role === 'contributor')
            ? <Link className="iconbtn hide-sm" to="/admin/queue" aria-label="Review queue" title="Review queue" style={{ position: 'relative' }}>
                <Icon name="bell" /><span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: '50%', background: 'var(--on-warning)' }} />
              </Link> : null}
          <Link className="iconbtn hide-sm" to="/settings" aria-label="Settings"><Icon name="settings" /></Link>
          <Link className="avatar" to="/profile" aria-label="Your profile">{(user?.displayName || 'A')[0]}</Link>
        </div>
      </header>
      <main className="page" id="page">{children}</main>
      <nav className="bottomnav">
        {[STUDENT_NAV[0], STUDENT_NAV[1], STUDENT_NAV[2], STUDENT_NAV[4], ACCOUNT_NAV[0]].map(n => (
          <NavLink key={n.to} to={n.to}>{<Icon name={n.icon} />}{n.label === 'Scholarships' ? 'Browse' : n.label}</NavLink>
        ))}
      </nav>
    </>
  );
}

export function AdminShell({ page, children }) {
  useShell('admin', page);
  const { user } = useAuth();
  return (
    <>
      <Sidebar mode="admin" counts={{}} />
      <header className="topbar">
        <div className="topbar__in">
          <button className="iconbtn js-menu" type="button" aria-label="Open menu" aria-controls="sidebar"
            style={{ display: 'grid' }} onClick={() => {
              const s = document.querySelector('.side'); const sc = document.querySelector('.side-scrim');
              const open = !s.classList.contains('is-open');
              s.classList.toggle('is-open', open); sc.classList.toggle('is-open', open);
            }}><Icon name="menu" /></button>
          <Link className="brand" to="/admin"><span className="brand__mark"><Icon name="shield" /></span>
            <span className="brand__name hide-sm">Admin console</span></Link>
          <div className="grow" />
          <span className="role-pill hide-sm" data-role={user?.role}>{user?.role || 'guest'}</span>
          <DemoPanel />
          <Link className="btn btn--outlined btn--sm hide-sm" to="/dashboard"><Icon name="back" />Student app</Link>
          <Link className="avatar" to="/profile" aria-label="Your account">{(user?.displayName || 'A')[0]}</Link>
        </div>
      </header>
      <main className="page" id="page">{children}</main>
    </>
  );
}

export function PublicShell({ page, children, minimal }) {
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
              <Link to="/#pages">All pages</Link>
            </nav>
          )}
          <div className="actions">
            <DemoPanel />
            {user
              ? <Link className="btn btn--filled btn--sm" to="/dashboard">Open app</Link>
              : <>
                  <Link className="btn btn--text btn--sm" to="/login">Log in</Link>
                  <Link className="btn btn--filled btn--sm" to="/signup">Get started</Link>
                </>}
          </div>
        </div>
      </header>
      <main className={minimal ? 'page page--narrow' : 'page'} id="page">{children}</main>
    </>
  );
}

export function BareShell({ page, children }) {
  useShell('none', page);
  return <main id="page">{children}</main>;
}
