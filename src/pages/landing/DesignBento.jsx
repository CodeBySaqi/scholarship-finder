import React from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '../../components/Shell.jsx';
import { Card, Btn, Chip, Icon, Progress, Loader } from '../../components/ui.jsx';
import { Disclaimer, FreshnessTag, CountdownTag, fundingLabel, iconFor, toneFor } from '../../lib.jsx';
import { useLanding } from './data.js';
import { DesignBar, ChoiceBanner, MiniListing, SiteFoot } from './shared.jsx';

/* Design 2 — Bento grid.
   A mosaic instead of a column: the headline tile is the anchor, everything
   else is a live tile (counts, the newest check, the deadline spread, the
   promise). Dense, but each tile is one idea. */
export default function DesignBento() {
  const { stats, loading, sample, counts, months, num } = useLanding();
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts, 1);

  return (
    <PublicShell page="landing">
      <div className="lv lv-bento">
        <ChoiceBanner />

        <div className="lv2-grid">
          {/* headline */}
          <Card className="lv2-tile lv2-hero">
            <div className="row wr" style={{ gap: 8 }}>
              <Chip className="tag" color="primary" variant="flat">Pakistan → Germany</Chip>
              <Chip className="tag" color="success" variant="flat" startContent={<Icon name="checkCircle" size={13} />}>Human-checked</Chip>
            </div>
            <h1 className="lv2-h1">The scholarships you meet,<br />and the gaps named.</h1>
            <p className="lv2-lead">
              We test every published minimum against your profile and answer with one of three verdicts —
              Eligible, Not eligible, Check manually — with the reasons attached.
            </p>
            <div className="row wr" style={{ gap: 10 }}>
              <Btn variant="filled" to="/signup">Create your profile</Btn>
              <Btn variant="outlined" to="/scholarships">Browse listings</Btn>
            </div>
            <div className="lv2-pills">
              {['CGPA', 'IELTS', 'Degree route', 'Age', 'APS', 'Deadline'].map(k => (
                <Chip key={k} className="tag" color="default" variant="flat" size="sm">{k}</Chip>
              ))}
            </div>
          </Card>

          {/* count tiles */}
          <Card className="lv2-tile lv2-count" as={Link} to="/scholarships">
            <span className="statcard__icon tone-green"><Icon name="cap" /></span>
            <div>
              <div className="lv2-num">{num(stats.scholarships)}</div>
              <div className="cap">verified scholarships</div>
            </div>
          </Card>
          <Card className="lv2-tile lv2-count" as={Link} to="/programs">
            <span className="statcard__icon tone-blue"><Icon name="school" /></span>
            <div>
              <div className="lv2-num">{num(stats.programs)}</div>
              <div className="cap">German programmes</div>
            </div>
          </Card>
          <Card className="lv2-tile lv2-count">
            <span className="statcard__icon tone-amber"><Icon name="clock" /></span>
            <div>
              <div className="lv2-num">{loading ? '—' : total}</div>
              <div className="cap">deadlines in the next 6 months</div>
            </div>
          </Card>

          {/* newest check */}
          <Card className="lv2-tile lv2-listing">
            <div className="row sp">
              <div className="h3">Newest check</div>
              <Chip className="tag" color="primary" variant="flat" size="sm">Live</Chip>
            </div>
            {loading ? <Loader /> : sample ? <MiniListing l={sample} compact /> : <p className="cap">No verified listing yet.</p>}
          </Card>

          {/* deadline spread */}
          <Card className="lv2-tile lv2-bars">
            <div className="row sp">
              <div className="h3">Deadlines ahead</div>
              <span className="cap">next six months</span>
            </div>
            <div className="lv2-barset">
              {counts.map((v, i) => (
                <div className="lv2-bar" key={i}>
                  <span className="lv2-bar__n">{v}</span>
                  <div className="lv2-bar__track">
                    <div className="lv2-bar__fill" style={{ height: Math.max(6, (v / max) * 100) + '%' }} />
                  </div>
                  <span className="cap">{months[i].label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* the three answers */}
          <Card className="lv2-tile lv2-verdicts">
            <div className="h3">Three answers, never a percentage</div>
            <div className="lv2-verdicts-row">
              <div className="lv2-verdict lv2-verdict--ok"><Icon name="check" size={14} /><b>Eligible</b><span className="cap">you meet every stated minimum</span></div>
              <div className="lv2-verdict lv2-verdict--no"><Icon name="close" size={14} /><b>Not eligible</b><span className="cap">a stated minimum is missed</span></div>
              <div className="lv2-verdict lv2-verdict--ask"><Icon name="info" size={14} /><b>Check manually</b><span className="cap">the page does not say enough</span></div>
            </div>
            <p className="cap">Screening only — selection stays with the provider.</p>
          </Card>

          {/* steps */}
          <Card className="lv2-tile lv2-steps">
            <div className="row sp"><div className="h3">Five minutes, three steps</div><Chip className="tag" color="primary" variant="flat" size="sm">Free</Chip></div>
            <ol className="lv2-list">
              <li><span className="lv2-list__n">1</span><div><b>Profile</b><span className="cap">degree, CGPA, English, age, intake</span></div></li>
              <li><span className="lv2-list__n">2</span><div><b>Verdicts</b><span className="cap">per listing, with reasons</span></div></li>
              <li><span className="lv2-list__n">3</span><div><b>Shortlist</b><span className="cap">save, track deadlines, apply</span></div></li>
            </ol>
            <Progress value={100} label="Three steps" />
          </Card>

          {/* recently verified list */}
          <Card className="lv2-tile lv2-recent">
            <div className="row sp">
              <div><div className="h3">Recently verified</div><p className="cap">Newest checks first</p></div>
              <Btn variant="outlined" size="sm" to="/scholarships">All listings</Btn>
            </div>
            <div className="lv2-rows">
              {(stats.recent || []).slice(0, 3).map(l => (
                <Link className="lv2-row" key={l.id} to={(l.kind === 'scholarship' ? '/scholarship/' : '/program/') + l.id}>
                  <span className={'statcard__icon ' + toneFor(l.kind)} style={{ width: 34, height: 34 }}><Icon name={iconFor(l.kind)} /></span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <b className="lv2-row__t">{l.title}</b>
                    <span className="cap">{l.provider} · {fundingLabel(l)}</span>
                  </span>
                  <FreshnessTag iso={l.lastVerified} freshness={l.freshness} />
                </Link>
              ))}
            </div>
          </Card>

          {/* promise */}
          <Card className="lv2-tile lv2-promise">
            <div className="h3">What we never do</div>
            <ul className="lv2-never">
              <li><Icon name="close" size={13} /> call a match “guaranteed admission”</li>
              <li><Icon name="close" size={13} /> invent a deadline, fee or score</li>
              <li><Icon name="close" size={13} /> hide a listing because data is missing</li>
              <li><Icon name="close" size={13} /> ask for your passport or bank details</li>
            </ul>
            <Btn variant="tonal" size="sm" to="/signup" style={{ alignSelf: 'flex-start' }}>Start free</Btn>
          </Card>
        </div>

        <SiteFoot />
        <Disclaimer />
      </div>
      <DesignBar current="bento" />
    </PublicShell>
  );
}
