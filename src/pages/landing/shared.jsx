import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Btn, Chip, Icon, Notice } from '../../components/ui.jsx';
import SiteFooter from '../../components/SiteFooter.jsx';
import { fmtDate, fundingLabel, FreshnessTag, CountdownTag, iconFor, toneFor } from '../../lib.jsx';

/* ==========================================================================
   The five home-page designs.

   They share the public header and footer (same structure as the live site) and
   the same honest content — the live counts and the newest verified listing.
   What differs is the layout and the visual language, which is what is being
   chosen here. Nothing on these pages changes the app itself.
   ========================================================================== */

export const DESIGNS = [
  {
    id: 1, slug: 'split', name: 'Split editorial',
    blurb: 'Big statement left, a real listing card right. Calm, typographic, closest to the current site.',
    tags: ['Light', 'Editorial', 'Search-first']
  },
  {
    id: 2, slug: 'bento', name: 'Bento grid',
    blurb: 'One hero tile plus a mosaic of live tiles: counts, the newest check, deadlines. Dense but scannable.',
    tags: ['Light', 'Modular', 'Data-forward']
  },
  {
    id: 3, slug: 'aurora', name: 'Dark aurora',
    blurb: 'Deep dark hero with a gradient glow, glass cards, centred call to action. Feels like a product, not a brochure.',
    tags: ['Dark', 'Bold', 'Centred']
  },
  {
    id: 4, slug: 'app', name: 'Product preview',
    blurb: 'Shows the actual app screen in the hero with a feature list beside it. Best for “what do I get?”.',
    tags: ['Light', 'Product-led', 'Screenshot']
  },
  {
    id: 5, slug: 'minimal', name: 'Minimal type',
    blurb: 'Almost nothing but type, space and one button. The fastest to read, the quietest of the five.',
    tags: ['Light', 'Minimal', 'Type-led']
  }
];

export const designBySlug = (slug) => DESIGNS.find(d => d.slug === slug) || DESIGNS[0];

/* ---------------------------------------------------------------- picker -- */
export function DesignBar({ current }) {
  const nav = useNavigate();
  const [chosen, setChosen] = React.useState(readChoice);
  React.useEffect(() => {
    const sync = () => setChosen(readChoice());
    window.addEventListener('sf:design-chosen', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('sf:design-chosen', sync); window.removeEventListener('storage', sync); };
  }, []);
  const d = designBySlug(current);
  return (
    <div className="lvd-bar" role="region" aria-label="Choose a home page design">
      <div className="lvd-bar__in">
        <span className="lvd-bar__name">
          <span className="lvd-bar__n">{d.id}</span>
          <span><b>{d.name}</b><span className="cap"> · design {d.id} of {DESIGNS.length}</span></span>
        </span>
        <div className="lvd-bar__dots" role="group" aria-label="Switch design">
          {DESIGNS.map(x => (
            <button key={x.id} type="button" title={x.name} aria-label={'Design ' + x.id + ': ' + x.name}
              aria-current={x.id === d.id ? 'true' : undefined}
              className={'lvd-dot' + (x.id === d.id ? ' is-on' : '')}
              onClick={() => nav('/design/' + x.slug)}>{x.id}</button>
          ))}
        </div>
        <span className="lvd-bar__spacer" />
        <Btn size="sm" variant={chosen === d.id ? 'tonal' : 'filled'} onClick={() => choose(d.id)}>
          {chosen === d.id ? 'Selected' : 'Use this design'}
        </Btn>
        <Btn size="sm" variant="outlined" to="/design">Compare all 5</Btn>
      </div>
    </div>
  );
}

const KEY = 'sf.landing-choice';
export function readChoice() {
  try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; }
}
export function choose(id) {
  try { localStorage.setItem(KEY, String(id)); } catch { /* private mode */ }
  window.dispatchEvent(new Event('sf:design-chosen'));
}

export function ChoiceBanner() {
  const [picked, setPicked] = React.useState(readChoice);
  React.useEffect(() => {
    const sync = () => setPicked(readChoice());
    window.addEventListener('sf:design-chosen', sync);
    return () => window.removeEventListener('sf:design-chosen', sync);
  }, []);
  if (!picked) return null;
  const d = DESIGNS.find(x => x.id === picked);
  return (
    <Notice tone="success">
      <b className="w500">Design {picked} ({d ? d.name : ''}) is marked as your pick.</b> Tell me and I’ll wire it in as the real
      home page — the others can be deleted or kept behind this preview.
    </Notice>
  );
}

/* ------------------------------------------------------------ shared bits -- */
export function MiniListing({ l, compact }) {
  if (!l) return null;
  const to = (l.kind === 'scholarship' ? '/scholarship/' : '/program/') + l.id;
  return (
    <Card className="lvd-listing" style={{ gap: compact ? 8 : 12 }}>
      <div className="row sp wr" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <span className={'statcard__icon ' + toneFor(l.kind)} style={{ width: 38, height: 38 }}><Icon name={iconFor(l.kind)} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="h3 lvd-clamp2">{l.title}</div>
            <div className="cap">{l.provider}{l.hostCountry ? ' · ' + l.hostCountry : ''}</div>
          </div>
        </div>
        <Chip size="sm" className="tag" color={l.kind === 'program' ? 'primary' : 'secondary'} variant="flat">
          {l.kind === 'program' ? 'Program' : fundingLabel(l)}
        </Chip>
      </div>
      {!compact && (
        <div className="lvd-kv">
          <div><span className="cap">CGPA minimum</span><b>{l.minCgpa ? l.minCgpa + ' / 4.0' : 'Not stated'}</b></div>
          <div><span className="cap">English</span><b>{l.ieltsRequired ? (l.minIelts ? 'IELTS ' + l.minIelts : 'Certificate') : 'Not required'}</b></div>
          <div><span className="cap">Deadline</span><b>{l.deadline ? fmtDate(l.deadline) : 'Not stated'}</b></div>
        </div>
      )}
      <div className="row sp wr" style={{ gap: 8 }}>
        <div className="row wr" style={{ gap: 6 }}>
          <FreshnessTag iso={l.lastVerified} freshness={l.freshness} />
          <CountdownTag iso={l.deadline} />
        </div>
        <Link className="link-quiet nowrap" to={to}>Open →</Link>
      </div>
    </Card>
  );
}

export function TrustRow({ stats, num }) {
  return (
    <div className="lvd-trust">
      <span><b>{num(stats.scholarships)}</b> verified scholarships</span>
      <span><b>{num(stats.programs)}</b> German programs</span>
      <span><b>{num(stats.universities)}</b> universities</span>
      <span>Every card shows the date it was checked</span>
    </div>
  );
}

export function StepCards({ steps, dark }) {
  return (
    <div className="lvd-steps">
      {steps.map(s => (
        <Card key={s.n} className={(dark ? 'lvd-dark-card ' : '') + 'lvd-step'} style={{ gap: 10 }}>
          <div className="row sp">
            <span className={'statcard__icon ' + s.tone}><Icon name={s.icon} /></span>
            <span className="eyebrow">{s.n}</span>
          </div>
          <div className="h3">{s.t}</div>
          <p className="cap">{s.d}</p>
        </Card>
      ))}
    </div>
  );
}

export function SiteFoot() {
  return <SiteFooter />;
}
