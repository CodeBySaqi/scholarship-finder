import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '../components/Shell.jsx';
import { Btn, useAsync } from '../components/ui.jsx';
import { api } from '../api.js';
import { FOOTERS, FOOTER_COMPONENTS } from '../components/footers/variants.jsx';

/* ==========================================================================
   /footers — the footer lab.

   Ten candidate footers stacked on the real canvas, each rendered from the
   component that would ship, over the same link set and the same live counts.
   Pick one here; the chosen number is stored locally and is what gets wired
   into SiteFooter (which every public page already uses).
   ========================================================================== */

const KEY = 'sf.footer-choice';

const read = () => {
  try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; }
};

export default function FooterLab() {
  const { data } = useAsync(() => api.get('/public/stats'), []);
  const counts = data
    ? { scholarships: data.scholarships, programs: data.programs, universities: data.universities }
    : null;
  const [picked, setPicked] = useState(read);

  const pick = (n) => {
    try { localStorage.setItem(KEY, String(n)); } catch { /* private mode */ }
    setPicked(n);
  };

  const chosen = FOOTERS.find((f) => f.n === picked);

  return (
    <PublicShell page="footers" footer={false}>
      <header className="flab-hero">
        <span className="flab-kicker">Footer review</span>
        <h1 className="flab-h1">Ten footers. Pick one.</h1>
        <p className="flab-lede">
          Same links, same honesty copy, same HeroUI components as the rest of the site — only the composition
          differs. Every footer below is the real component, not a picture. Press <b>Use this footer</b> on the one
          you want and it takes the place of the footer on every public page.
        </p>
        <nav className="flab-index" aria-label="Jump to a footer">
          {FOOTERS.map((f) => (
            <a key={f.n} className={'flab-jump' + (picked === f.n ? ' is-on' : '')} href={'#f' + f.n}>
              <b>{f.n}</b><span>{f.name}</span>
            </a>
          ))}
        </nav>
      </header>

      {chosen ? (
        <div className="flab-picked">
          <b>Marked: {chosen.n} · {chosen.name}</b>
          <span>
            Tell me “footer {chosen.n}” and it replaces the live footer on every public page.
            <Link to="/"> Back to the home page</Link>.
          </span>
          <Btn size="sm" variant="text" onClick={() => setPicked(0)}>Clear</Btn>
        </div>
      ) : null}

      {FOOTERS.map((f) => {
        const Comp = FOOTER_COMPONENTS[f.n];
        const on = picked === f.n;
        return (
          <section key={f.n} className={'flab' + (on ? ' is-picked' : '')} id={'f' + f.n}>
            <div className="flab__head">
              <span className="flab__num">{f.n}</span>
              <div className="flab__text">
                <h2 className="flab__name">{f.name}</h2>
                <p className="flab__idea">{f.idea}</p>
              </div>
              <div className="flab__tags">
                {f.tags.map((t) => <span key={t} className="fl-pill">{t}</span>)}
              </div>
              <Btn size="sm" variant={on ? 'tonal' : 'filled'} onClick={() => pick(f.n)}>
                {on ? 'Selected' : 'Use this footer'}
              </Btn>
            </div>
            <div className="flab__stage">
              <Comp counts={counts} />
            </div>
          </section>
        );
      })}

      <p className="flab-foot">
        The footer live today is number 1. Nothing changes on the public site until you pick.
      </p>
    </PublicShell>
  );
}
