import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Btn, Chip, Icon } from '../ui.jsx';
import { COPY } from '../../lib.jsx';

/* ==========================================================================
   Ten footer candidates for the review lab at /footers.

   Every one is built the same way the rest of the site is built: HeroUI
   buttons, chips and inputs, the app's radius/shadow scale, the app canvas.
   What differs is composition — density, contrast, where the call to action
   sits, how much of the honesty copy is shown.

   They are deliberately kept pure (no page chrome, no picker) so the same
   component can be dropped into SiteFooter once one is chosen.
   ========================================================================== */

const LINKS = {
  find: [
    { to: '/scholarships', label: 'Scholarships' },
    { to: '/programs', label: 'German programmes' },
    { to: '/matches', label: 'Matches' },
    { to: '/saved', label: 'Saved list' }
  ],
  account: [
    { to: '/signup', label: 'Create account' },
    { to: '/login', label: 'Log in' },
    { to: '/profile', label: 'Profile' },
    { to: '/settings', label: 'Settings' }
  ],
  about: [
    { to: '/how-it-works', label: 'How it works' },
    { to: '/privacy', label: 'Privacy' },
    { to: '/terms', label: 'Terms' }
  ]
};

const Mark = ({ size = 38 }) => (
  <span className="fl-mark" style={{ width: size, height: size, borderRadius: Math.round(size / 3) }}>
    <Icon name="cap" />
  </span>
);

const Brand = ({ dark }) => (
  <Link className={'fl-brand' + (dark ? ' fl-brand--dark' : '')} to="/">
    <Mark />
    <span className="fl-brand__name">Scholarship Finder</span>
  </Link>
);

const Ledger = ({ notes = true }) => (
  <p className="fl-lede">
    Built for Pakistani students applying to Germany: every published minimum — CGPA, IELTS, degree route,
    age, APS — checked against your profile, with the gaps named and the check date on every card.
  </p>
);

const Legal = ({ dark, centered }) => (
  <p className={'fl-legal' + (dark ? ' fl-legal--dark' : '') + (centered ? ' fl-legal--center' : '')}>
    {COPY.disclaimer}
  </p>
);

const Top = ({ dark }) => (
  <button
    type="button"
    className={'fl-top' + (dark ? ' fl-top--dark' : '')}
    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
  >
    Back to top <Icon name="chevron" size={12} />
  </button>
);

const Links = ({ group, title, dark }) => (
  <nav className={'fl-col' + (dark ? ' fl-col--dark' : '')} aria-label={title}>
    <b className="fl-col__title">{title}</b>
    {LINKS[group].map((l) => (
      <Link key={l.to} className="fl-link" to={l.to}>{l.label}</Link>
    ))}
  </nav>
);

/* 1 — the dark card that is live today */
function V1({ counts }) {
  return (
    <footer className="flv flv1">
      <div className="flv1__card">
        <span className="flv1__glow" aria-hidden="true" />
        <div className="flv1__top">
          <div>
            <Brand dark />
            <Ledger />
            <div className="flv1__pills">
              <span className="fl-pill fl-pill--dark"><i className="fl-dot" />Checked by hand</span>
              <span className="fl-pill fl-pill--dark">Pakistan → Germany</span>
              <span className="fl-pill fl-pill--dark">Free · no paid ranking</span>
            </div>
          </div>
          <div className="flv1__cta">
            <span className="flv1__kicker">Five minutes, no documents</span>
            <h2 className="flv1__h">Build your shortlist.</h2>
            <div className="flv1__actions">
              <Btn variant="filled" to="/signup">Create your profile</Btn>
              <Btn variant="outlined" className="fl-btn-dark" to="/login">Log in</Btn>
            </div>
          </div>
        </div>
        <div className="flv1__cols">
          <Links group="find" title="Find" dark />
          <Links group="account" title="Account" dark />
          <Links group="about" title="About" dark />
        </div>
        <div className="flv1__rule" />
        <div className="flv1__bottom">
          <Legal dark />
          <div className="flv1__meta"><span>© 2026 Scholarship Finder</span><Top dark /></div>
        </div>
        <svg className="flv1__wordmark" viewBox="0 0 1000 132" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
          <defs>
            <linearGradient id="flWord1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.17" />
              <stop offset="78%" stopColor="#fff" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <text x="500" y="124" textAnchor="middle" textLength="1000" lengthAdjust="spacingAndGlyphs"
            fill="url(#flWord1)" stroke="rgba(255,255,255,.07)" strokeWidth="1.5"
            style={{ fontSize: '132px', fontWeight: 800, letterSpacing: '-.055em' }}>ScholarPath</text>
        </svg>
      </div>
    </footer>
  );
}

/* 2 — light editorial: one big line, four quiet columns */
function V2() {
  return (
    <footer className="flv flv2">
      <div className="flv2__card">
        <p className="flv2__kicker">Screening, not admission</p>
        <h2 className="flv2__h">Know where you stand, before you pay a single fee.</h2>
        <div className="flv2__cols">
          <Links group="find" title="Find" />
          <Links group="account" title="Account" />
          <Links group="about" title="About" />
          <div className="fl-col">
            <b className="fl-col__title">Start</b>
            <Btn variant="filled" size="sm" to="/signup">Create your profile</Btn>
            <Btn variant="text" size="sm" to="/login">Log in</Btn>
          </div>
        </div>
        <div className="flv2__rule" />
        <div className="flv2__bottom">
          <div className="flv2__brandrow"><Brand /><span className="flv2__year">© 2026</span></div>
          <Legal />
          <Top />
        </div>
      </div>
    </footer>
  );
}

/* 3 — slim bar: one row, hairline, almost nothing */
function V3() {
  return (
    <footer className="flv flv3">
      <div className="flv3__row">
        <Brand />
        <nav className="flv3__nav" aria-label="Footer">
          {[...LINKS.find, ...LINKS.about].map((l) => (
            <Link key={l.to} className="fl-link fl-link--plain" to={l.to}>{l.label}</Link>
          ))}
          <Link className="fl-link fl-link--plain" to="/login">Log in</Link>
        </nav>
        <div className="flv3__end">
          <Btn variant="filled" size="sm" to="/signup">Create profile</Btn>
          <Top />
        </div>
      </div>
      <div className="flv3__foot">
        <Legal />
        <span className="flv3__year">© 2026 Scholarship Finder</span>
      </div>
    </footer>
  );
}

/* 4 — mega: brand column + four link columns + tinted legal bar */
function V4() {
  return (
    <footer className="flv flv4">
      <div className="flv4__card">
        <div className="flv4__grid">
          <div className="flv4__brand">
            <Brand />
            <Ledger />
            <div className="flv4__actions">
              <Btn variant="filled" to="/signup">Create your profile</Btn>
              <Btn variant="text" to="/login">Log in</Btn>
            </div>
          </div>
          <Links group="find" title="Find" />
          <Links group="account" title="Account" />
          <Links group="about" title="About" />
          <nav className="fl-col" aria-label="Trust">
            <b className="fl-col__title">Trust</b>
            <span className="flv4__fact"><Icon name="check" size={13} />Three verdicts, never a score</span>
            <span className="flv4__fact"><Icon name="clock" size={13} />90-day recheck window</span>
            <span className="flv4__fact"><Icon name="shield" size={13} />No passport or bank data</span>
          </nav>
        </div>
        <div className="flv4__bar">
          <Legal />
          <div className="flv4__barright">
            <span>© 2026 Scholarship Finder</span>
            <Top />
          </div>
        </div>
      </div>
    </footer>
  );
}

/* 5 — newsletter band over a plain link grid */
function V5() {
  const [email, setEmail] = useState('');
  return (
    <footer className="flv flv5">
      <div className="flv5__band">
        <div>
          <h2 className="flv5__h">Deadline reminders, nothing else.</h2>
          <p className="flv5__sub">One message when a saved listing is 14 days from closing. No ranking, no adverts.</p>
        </div>
        <form className="flv5__form" onSubmit={(e) => e.preventDefault()}>
          <input
            className="flv5__input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
          />
          <Btn variant="filled" type="submit">Notify me</Btn>
        </form>
      </div>
      <div className="flv5__grid">
        <div className="flv5__brand">
          <Brand />
          <Ledger />
        </div>
        <Links group="find" title="Find" />
        <Links group="account" title="Account" />
        <Links group="about" title="About" />
      </div>
      <div className="flv5__rule" />
      <div className="flv5__bottom">
        <Legal />
        <div className="flv5__meta"><span>© 2026 · Free, no paid ranking</span><Top /></div>
      </div>
    </footer>
  );
}

/* 6 — split prose: statement left, chevroned link lists right */
function V6() {
  return (
    <footer className="flv flv6">
      <div className="flv6__card">
        <div className="flv6__left">
          <Brand />
          <h2 className="flv6__h">Three honest answers, with the reasons attached.</h2>
          <p className="flv6__p">
            Every listing we publish is checked against the provider's own page and dated. Where a page does not
            say enough to screen you, we say so instead of guessing.
          </p>
          <div className="flv6__chips">
            <span className="fl-pill fl-pill--ok"><Icon name="check" size={12} />Eligible</span>
            <span className="fl-pill fl-pill--no"><Icon name="close" size={12} />Not eligible</span>
            <span className="fl-pill fl-pill--maybe"><Icon name="clock" size={12} />Check manually</span>
          </div>
          <Btn variant="filled" to="/signup" className="flv6__cta">Create your profile</Btn>
        </div>
        <div className="flv6__right">
          {Object.entries({ Find: 'find', Account: 'account', About: 'about' }).map(([title, group]) => (
            <nav key={group} className="flv6__list" aria-label={title}>
              <b className="fl-col__title">{title}</b>
              {LINKS[group].map((l) => (
                <Link key={l.to} className="flv6__item" to={l.to}>{l.label}<Icon name="chevron" size={12} /></Link>
              ))}
            </nav>
          ))}
        </div>
      </div>
      <div className="flv6__bottom">
        <Legal />
        <div className="flv6__meta"><span>© 2026 Scholarship Finder</span><Top /></div>
      </div>
    </footer>
  );
}

/* 7 — command bar: search-first dark footer */
function V7() {
  return (
    <footer className="flv flv7">
      <div className="flv7__card">
        <span className="flv7__glow" aria-hidden="true" />
        <div className="flv7__top">
          <Brand dark />
          <div className="flv7__search">
            <Icon name="search" size={16} />
            <input aria-label="Search scholarships" placeholder="Search scholarships, programmes, universities" />
            <Btn variant="filled" size="sm" to="/scholarships">Search</Btn>
          </div>
        </div>
        <div className="flv7__chips">
          {['DAAD', 'TUM', 'RWTH Aachen', 'Master', 'PhD', 'Fully funded'].map((c) => (
            <span key={c} className="fl-pill fl-pill--dark">{c}</span>
          ))}
        </div>
        <div className="flv7__cols">
          <Links group="find" title="Find" dark />
          <Links group="account" title="Account" dark />
          <Links group="about" title="About" dark />
          <nav className="fl-col fl-col--dark" aria-label="Status">
            <b className="fl-col__title">Status</b>
            <span className="fl-pill fl-pill--dark flv7__live"><i className="fl-dot" />Hand-checked</span>
            <span className="flv7__small">No paid ranking · no adverts</span>
          </nav>
        </div>
        <div className="flv7__rule" />
        <div className="flv7__bottom">
          <Legal dark />
          <div className="flv7__meta"><span>© 2026 Scholarship Finder</span><Top dark /></div>
        </div>
      </div>
    </footer>
  );
}

/* 8 — stat strip: live numbers on top, links under */
function V8({ counts }) {
  const tiles = [
    { icon: 'cap', n: counts?.scholarships, label: 'scholarships verified' },
    { icon: 'school', n: counts?.programs, label: 'German programmes' },
    { icon: 'clock', n: '90d', label: 'recheck window' }
  ];
  return (
    <footer className="flv flv8">
      <div className="flv8__card">
        <div className="flv8__stats">
          {tiles.map((t) => (
            <div key={t.label} className="flv8__stat">
              <span className="flv8__icon"><Icon name={t.icon} size={16} /></span>
              <div>
                <b>{t.n ?? '—'}</b>
                <span>{t.label}</span>
              </div>
            </div>
          ))}
          <div className="flv8__cta">
            <Btn variant="filled" to="/signup">Create your profile</Btn>
          </div>
        </div>
        <div className="flv8__grid">
          <div className="flv8__brand"><Brand /><Ledger /></div>
          <Links group="find" title="Find" />
          <Links group="account" title="Account" />
          <Links group="about" title="About" />
        </div>
        <div className="flv8__rule" />
        <div className="flv8__bottom">
          <Legal />
          <div className="flv8__meta"><span>© 2026 Scholarship Finder</span><Top /></div>
        </div>
      </div>
    </footer>
  );
}

/* 9 — bento: linked mini-cards */
function V9() {
  return (
    <footer className="flv flv9">
      <div className="flv9__grid">
        <div className="flv9__brand">
          <Brand />
          <h2 className="flv9__h">Start with what you already have.</h2>
          <p className="flv9__p">Degree, CGPA, English, age, intake. Five minutes, no uploads.</p>
          <Btn variant="filled" to="/signup">Create your profile</Btn>
          <div className="flv9__pills">
            <span className="fl-pill"><i className="fl-dot" />Checked by hand</span>
            <span className="fl-pill">Free</span>
          </div>
        </div>
        {[['find', 'cap', 'Browse'], ['account', 'person', 'Your account'], ['about', 'shield', 'How it works']].map(([group, icon, title]) => (
          <nav key={group} className="flv9__tile" aria-label={title}>
            <span className="flv9__tileicon"><Icon name={icon} size={16} /></span>
            <b>{title}</b>
            {LINKS[group].map((l) => (
              <Link key={l.to} className="fl-link" to={l.to}>{l.label}</Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="flv9__bottom">
        <Legal />
        <div className="flv9__meta"><span>© 2026 Scholarship Finder</span><Top /></div>
      </div>
    </footer>
  );
}

/* 10 — minimal: one thin row, one huge wordmark */
function V10() {
  return (
    <footer className="flv flv10">
      <div className="flv10__row">
        <Brand />
        <nav className="flv10__nav" aria-label="Footer">
          {[...LINKS.find, ...LINKS.about].map((l) => (
            <Link key={l.to} className="fl-link fl-link--plain" to={l.to}>{l.label}</Link>
          ))}
        </nav>
        <div className="flv10__end">
          <Btn variant="filled" size="sm" to="/signup">Create your profile</Btn>
          <Top />
        </div>
      </div>
      <svg className="flv10__mark" viewBox="0 0 1000 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="flWord10" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1B84FF" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#7C5CFF" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <text x="500" y="120" textAnchor="middle" textLength="1000" lengthAdjust="spacingAndGlyphs"
          fill="url(#flWord10)" style={{ fontSize: '150px', fontWeight: 800, letterSpacing: '-.05em' }}>ScholarPath</text>
      </svg>
      <div className="flv10__foot">
        <Legal centered />
        <span className="flv10__year">© 2026 Scholarship Finder · screening is not admission</span>
      </div>
    </footer>
  );
}

export const FOOTERS = [
  { n: 1, slug: 'dark-card', name: 'Dark card', idea: 'The footer that is live now: dark card, glow, CTA right, three link columns, oversized wordmark.', tags: ['Dark', 'Balanced'] },
  { n: 2, slug: 'editorial', name: 'Editorial light', idea: 'White card, one big statement line, four quiet columns, brand row at the bottom.', tags: ['Light', 'Calm'] },
  { n: 3, slug: 'slim-bar', name: 'Slim bar', idea: 'A single hairline row: brand, every link inline, one chip. Nearly invisible.', tags: ['Light', 'Compact'] },
  { n: 4, slug: 'mega', name: 'Mega columns', idea: 'Brand column, three link columns and a trust column, closed by a tinted legal bar.', tags: ['Light', 'Corporate'] },
  { n: 5, slug: 'newsletter', name: 'Newsletter band', idea: 'Tinted band with an email field and a real link grid underneath. Product-marketing feel.', tags: ['Light', 'Lead-gen'] },
  { n: 6, slug: 'split-prose', name: 'Split prose', idea: 'A statement and the three verdicts on the left, chevroned link lists on the right.', tags: ['Light', 'Editorial'] },
  { n: 7, slug: 'command', name: 'Command bar', idea: 'Dark, search-first: a search pill, quick chips, then four quiet columns.', tags: ['Dark', 'Product'] },
  { n: 8, slug: 'stat-strip', name: 'Stat strip', idea: 'Live numbers on top (scholarships, programmes, recheck window), links below.', tags: ['Light', 'Data'] },
  { n: 9, slug: 'bento', name: 'Bento tiles', idea: 'Brand panel plus three bordered link tiles. Playful, very HeroUI.', tags: ['Light', 'Cards'] },
  { n: 10, slug: 'minimal-mark', name: 'Minimal + wordmark', idea: 'One thin link row, a gradient ScholarPath wordmark, the legal line under it.', tags: ['Light', 'Minimal'] }
];

export const FOOTER_BY_N = Object.fromEntries(FOOTERS.map((f) => [f.n, f]));

export const FOOTER_COMPONENTS = { 1: V1, 2: V2, 3: V3, 4: V4, 5: V5, 6: V6, 7: V7, 8: V8, 9: V9, 10: V10 };
