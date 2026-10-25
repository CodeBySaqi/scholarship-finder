import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { PublicShell } from '../../components/Shell.jsx';
import { Card, Btn, Chip, Icon, Notice } from '../../components/ui.jsx';
import { Disclaimer } from '../../lib.jsx';
import DesignSplit from './DesignSplit.jsx';
import DesignBento from './DesignBento.jsx';
import DesignAurora from './DesignAurora.jsx';
import DesignApp from './DesignApp.jsx';
import DesignMinimal from './DesignMinimal.jsx';
import { DESIGNS, designBySlug, readChoice, choose, ChoiceBanner } from './shared.jsx';

const PAGES = { split: DesignSplit, bento: DesignBento, aurora: DesignAurora, app: DesignApp, minimal: DesignMinimal };

/* /design/:slug → the design itself. An unknown slug goes back to the gallery
   rather than a blank page. */
export function DesignPreview() {
  const { slug } = useParams();
  const Page = PAGES[slug];
  if (!Page) return <Navigate to="/design" replace />;
  return <Page />;
}

/* A tiny wireframe of each layout, so the five are comparable at a glance
   without five live previews on one page. */
function Thumb({ id }) {
  return (
    <div className={'lvthumb lvthumb--' + id} aria-hidden="true">
      {id === 'split' && <><span className="t-hero" /><span className="t-card" /><span className="t-row" /><span className="t-row" /></>}
      {id === 'bento' && <><span className="t-b b1" /><span className="t-b b2" /><span className="t-b b3" /><span className="t-b b4" /><span className="t-b b5" /><span className="t-b b6" /></>}
      {id === 'aurora' && <><span className="t-aur" /><span className="t-glass g1" /><span className="t-glass g2" /></>}
      {id === 'app' && <><span className="t-win" /><span className="t-lines" /></>}
      {id === 'minimal' && <><span className="t-h1" /><span className="t-h2" /><span className="t-nums" /><span className="t-h3" /></>}
    </div>
  );
}

/* /design — the comparison page and the place to pick. */
export default function DesignIndex() {
  const [picked, setPicked] = React.useState(readChoice);
  React.useEffect(() => {
    const sync = () => setPicked(readChoice());
    window.addEventListener('sf:design-chosen', sync);
    return () => window.removeEventListener('sf:design-chosen', sync);
  }, []);

  return (
    <PublicShell page="design">
      <div className="lv lv-index">
        <div className="lv-index__head">
          <span className="lv5-kicker">Home page design review</span>
          <h1 className="h1" style={{ fontSize: 30 }}>Five home pages. Pick one.</h1>
          <p className="cap" style={{ maxWidth: '62ch' }}>
            All five use the same Header, footer and content — the live counts and the newest verified listing — and all
            five are built from HeroUI components. Only the layout and the visual language differ, so this is a fair
            comparison. Open one, flip between them with the bar at the bottom, then mark the one you want.
          </p>
          <ChoiceBanner />
        </div>

        <div className="lv-index__grid">
          {DESIGNS.map(d => {
            const isPick = picked === d.id;
            return (
              <Card key={d.id} className={'lv-pick' + (isPick ? ' is-picked' : '')}>
                <Link to={'/design/' + d.slug} className="lv-pick__thumb"><Thumb id={d.slug} /></Link>
                <div className="row sp wr" style={{ gap: 8 }}>
                  <div className="h3"><span className="lv-pick__n">{d.id}</span>{d.name}</div>
                  {isPick && <Chip className="tag" color="success" variant="flat" size="sm">Your pick</Chip>}
                </div>
                <p className="cap">{d.blurb}</p>
                <div className="row wr" style={{ gap: 6 }}>
                  {d.tags.map(t => <Chip key={t} className="tag" color="default" variant="flat" size="sm">{t}</Chip>)}
                </div>
                <div className="row wr" style={{ gap: 8, marginTop: 'auto' }}>
                  <Btn size="sm" variant="filled" to={'/design/' + d.slug}>Open design {d.id}</Btn>
                  <Btn size="sm" variant={isPick ? 'tonal' : 'outlined'} onClick={() => { choose(d.id); setPicked(d.id); }}>
                    {isPick ? 'Selected' : 'Use this one'}
                  </Btn>
                </div>
              </Card>
            );
          })}
        </div>

        <Notice tone="info">
          <b className="w500">Nothing here is public yet.</b> These five pages live at <code>/design</code> only — the real
          home page at <code>/</code> is untouched. When you pick one, I move it to <code>/</code> and the other four can be
          removed or kept behind this page.
        </Notice>

        <div className="row wr" style={{ gap: 10 }}>
          <Btn variant="outlined" to="/">Back to the live home page</Btn>
        </div>

        <Disclaimer />
      </div>
    </PublicShell>
  );
}
