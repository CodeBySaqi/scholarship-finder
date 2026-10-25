import React from 'react';
import { Link } from 'react-router-dom';
import { Btn, Icon } from './ui.jsx';
import { COPY } from '../lib.jsx';

/* ==========================================================================
   Site footer — one component, every public page.

   Structure kept from the old footer (brand + blurb, three link columns,
   legal note) so nothing that linked to it breaks; what changed is the paint:
   a single dark card on the light canvas, gradient glow, pill links, a live
   status row, the two real calls to action and an oversized wordmark closing
   the page. HeroUI supplies the buttons; the card follows the same radius /
   shadow scale as the rest of the app.
   ========================================================================== */

const COLS = [
  {
    title: 'Find',
    links: [
      { to: '/scholarships', label: 'Scholarships' },
      { to: '/programs', label: 'German programmes' },
      { to: '/matches', label: 'Matches' },
      { to: '/saved', label: 'Saved list' }
    ]
  },
  {
    title: 'Account',
    links: [
      { to: '/signup', label: 'Create account' },
      { to: '/login', label: 'Log in' },
      { to: '/profile', label: 'Profile' },
      { to: '/settings', label: 'Settings' }
    ]
  },
  {
    title: 'About',
    links: [
      { to: '/privacy', label: 'Privacy' },
      { to: '/terms', label: 'Terms' },
      { to: '/how-it-works', label: 'How it works' }
    ]
  }
];

export default function SiteFooter({ compact = false }) {
  const toTop = (e) => {
    if (typeof window === 'undefined') return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className={'sfoot' + (compact ? ' sfoot--compact' : '')}>
      <div className="sfoot__card">
        <span className="sfoot__glow" aria-hidden="true" />
        <span className="sfoot__grid-lines" aria-hidden="true" />

        <div className="sfoot__top">
          <div className="sfoot__brand">
            <Link className="sfoot__logo" to="/">
              <span className="sfoot__mark"><Icon name="cap" /></span>
              <span className="sfoot__name">Scholarship Finder</span>
            </Link>
            <p className="sfoot__lede">
              Built for Pakistani students applying to Germany: we check every published minimum — CGPA, IELTS,
              degree route, age, APS — against your profile, name what is still missing, and show the date each
              listing was last verified against the provider's own page.
            </p>
            <div className="sfoot__pills">
              <span className="sfoot__pill"><i className="sfoot__dot" />Checked by hand</span>
              <span className="sfoot__pill">Pakistan → Germany</span>
              <span className="sfoot__pill">Free · no paid ranking</span>
            </div>
          </div>

          <div className="sfoot__cta">
            <span className="sfoot__kicker">Five minutes, no documents</span>
            <h2 className="sfoot__h">Build your shortlist.</h2>
            <p className="sfoot__sub">Three honest verdicts on every listing, with the reasons attached.</p>
            <div className="sfoot__actions">
              <Btn variant="filled" to="/signup">Create your profile</Btn>
              <Btn variant="outlined" to="/login">Log in</Btn>
            </div>
            <span className="sfoot__fine">Already have an account? <Link className="sfoot__fine-link" to="/login">Log in</Link> · no passport or bank details, ever.</span>
          </div>
        </div>

        <div className="sfoot__cols">
          {COLS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <b className="sfoot__coltitle">{c.title}</b>
              {c.links.map((l) => (
                <Link key={l.to + l.label} className="sfoot__link" to={l.to}>{l.label}</Link>
              ))}
            </nav>
          ))}
        </div>

        <div className="sfoot__rule" />

        <div className="sfoot__bottom">
          <p className="sfoot__disc">{COPY.disclaimer}</p>
          <div className="sfoot__meta">
            <span>© 2026 Scholarship Finder</span>
            <button type="button" className="sfoot__totop" onClick={toTop}>
              Back to top <Icon name="chevron" size={13} />
            </button>
          </div>
        </div>

        <svg className="sfoot__wordmark" viewBox="0 0 1000 132" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="sfootWord" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.17" />
              <stop offset="78%" stopColor="#ffffff" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <text x="500" y="124" textAnchor="middle" textLength="1000" lengthAdjust="spacingAndGlyphs"
                fill="url(#sfootWord)" stroke="rgba(255,255,255,.07)" strokeWidth="1.5"
                style={{ fontSize: '132px', fontWeight: 800, letterSpacing: '-.055em' }}>ScholarPath</text>
        </svg>
      </div>
    </footer>
  );
}
