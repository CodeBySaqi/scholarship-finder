import React from 'react';
import { Link } from 'react-router-dom';
import { Btn, Icon } from './ui.jsx';
import { COPY } from '../lib.jsx';

/* ==========================================================================
   Site footer — plain, quiet, one line of links.

   No card, no glow, no oversize wordmark: a hairline, the brand, the links
   people actually use, one button, and the honest small print underneath.
   It renders on every public page through PublicShell.
   ========================================================================== */

const NAV = [
  { to: '/scholarships', label: 'Scholarships' },
  { to: '/programs', label: 'Programmes' },
  { to: '/matches', label: 'Matches' },
  { to: '/saved', label: 'Saved' },
  { to: '/how-it-works', label: 'How it works' }
];

const META = [
  { to: '/login', label: 'Log in' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' }
];

export default function SiteFooter() {
  return (
    <footer className="sfoot sfoot--clean">
      <div className="sfoot__in">
        <div className="sfoot__top">
          <Link className="sfoot__brand" to="/">
            <span className="sfoot__mark"><Icon name="cap" /></span>
            <span className="sfoot__name">Scholarship Finder</span>
          </Link>

          <nav className="sfoot__nav" aria-label="Footer">
            {NAV.map((l) => <Link key={l.to} className="sfoot__link" to={l.to}>{l.label}</Link>)}
            {META.map((l) => <Link key={l.to} className="sfoot__link sfoot__link--muted" to={l.to}>{l.label}</Link>)}
          </nav>

          <Btn variant="filled" size="sm" to="/signup">Create your profile</Btn>
        </div>

        <div className="sfoot__rule" />

        <div className="sfoot__bottom">
          <p className="sfoot__note">
            Built for Pakistani students applying to Germany. Every published minimum is checked against your
            profile, the gaps are named, and each listing shows the date it was last verified.
          </p>
          <p className="sfoot__disc">{COPY.disclaimer}</p>
          <div className="sfoot__end">
            <span>© 2026 Scholarship Finder</span>
            <button
              type="button"
              className="sfoot__totop"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Back to top <Icon name="chevron" size={12} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
