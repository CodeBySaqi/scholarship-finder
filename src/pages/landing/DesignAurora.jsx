import React from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '../../components/Shell.jsx';
import { Card, Btn, Chip, Icon, Divider } from '../../components/ui.jsx';
import { Disclaimer, FreshnessTag, CountdownTag, fundingLabel, fmtDate, iconFor, toneFor } from '../../lib.jsx';
import { useLanding, STEPS } from './data.js';
import { DesignBar, SiteFoot } from './shared.jsx';

/* Design 3 — Dark aurora.
   A dark, glowing hero that owns the viewport, glass cards floating over it,
   then a light body so the data stays readable. The boldest of the five. */
export default function DesignAurora() {
  const { stats, sample, num } = useLanding();

  return (
    <PublicShell page="landing">
      <div className="lv lv-aurora-body">
        <section className="lv3-hero">
          <div className="lv3-glow lv3-glow--a" aria-hidden="true" />
          <div className="lv3-glow lv3-glow--b" aria-hidden="true" />
          <div className="lv3-inner">
            <span className="lv3-chip lv3-chip--pill">
              <span className="lv3-dot" />
              Live · {num(stats.scholarships)} scholarships and {num(stats.programs)} programmes checked by hand
            </span>
            <h1 className="lv3-h1">
              Your German study shortlist,<br /><span className="lv3-grad">without the guesswork.</span>
            </h1>
            <p className="lv3-lead">
              Published minimums, checked against your profile. Three honest verdicts, the reasons attached,
              and the date each listing was last verified.
            </p>
            <div className="row wr lv3-cta">
              <Btn variant="filled" size="lg" to="/signup">Create your profile — free</Btn>
              <Btn variant="bordered" size="lg" to="/scholarships"
                className="lv3-ghost">Browse the listings</Btn>
            </div>
            <div className="lv3-chips">
              {['No documents uploaded', 'No paid ranking', 'No passport or bank details'].map(t => (
                <span key={t}><Icon name="check" size={13} />{t}</span>
              ))}
            </div>
          </div>

          {/* glass card row */}
          <div className="lv3-glass">
            {sample ? (
              <Card className="lv3-card lv3-card--wide" as={Link}
                to={(sample.kind === 'scholarship' ? '/scholarship/' : '/program/') + sample.id}>
                <div className="row sp wr" style={{ gap: 8 }}>
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <span className={'statcard__icon ' + toneFor(sample.kind)}><Icon name={iconFor(sample.kind)} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="h3 lv3-ink">{sample.title}</div>
                      <div className="cap lv3-dim">{sample.provider}</div>
                    </div>
                  </div>
                  <Chip size="sm" className="lv3-tag" variant="flat">{fundingLabel(sample)}</Chip>
                </div>
                <div className="lv3-rows">
                  <div><span>CGPA</span><b>{sample.minCgpa ? sample.minCgpa + ' / 4.0' : 'Not stated'}</b></div>
                  <div><span>English</span><b>{sample.ieltsRequired ? (sample.minIelts ? 'IELTS ' + sample.minIelts : 'Certificate') : 'Not required'}</b></div>
                  <div><span>Deadline</span><b>{sample.deadline ? fmtDate(sample.deadline) : 'Not stated'}</b></div>
                </div>
                <div className="row wr" style={{ gap: 6 }}>
                  <FreshnessTag iso={sample.lastVerified} freshness={sample.freshness} />
                  <CountdownTag iso={sample.deadline} />
                </div>
              </Card>
            ) : (
              <Card className="lv3-card lv3-card--wide">
                <div className="h3 lv3-ink">The newest verified listing appears here</div>
                <p className="cap lv3-dim">Nothing is shown until an editor has checked it against an official page.</p>
              </Card>
            )}
            <Card className="lv3-card">
              <div className="lv3-num">{num(stats.scholarships)}</div>
              <div className="cap lv3-dim">scholarships, open now</div>
            </Card>
            <Card className="lv3-card">
              <div className="lv3-num">{num(stats.programs)}</div>
              <div className="cap lv3-dim">German programmes</div>
            </Card>
          </div>
        </section>

        {/* light body */}
        <section className="lv3-body">
          <div className="lv3-three">
            {[
              ['Eligible', 'check', 'ok', 'You meet every published minimum. Screening only — the provider decides.'],
              ['Not eligible', 'close', 'no', 'A stated minimum is missed. We name which one and by how much.'],
              ['Check manually', 'info', 'ask', 'The page does not publish enough to screen. Never hidden, always flagged.']
            ].map(([t, icon, tone, d]) => (
              <Card key={t} className={'lv3-verdict lv3-verdict--' + tone}>
                <span className="lv3-verdict__i"><Icon name={icon} /></span>
                <div className="h3">{t}</div>
                <p className="cap">{d}</p>
              </Card>
            ))}
          </div>

          <div className="lv3-steps">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.n}>
                {i > 0 && <Divider className="lv3-divider" />}
                <div className="lv3-step">
                  <span className="lv3-step__n">{s.n}</span>
                  <div>
                    <div className="h3">{s.t}</div>
                    <p className="cap">{s.d}</p>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>

          <Card className="lv3-cta-card">
            <div>
              <h2 className="h1" style={{ color: 'inherit' }}>Five minutes now, a shortlist you can trust</h2>
              <p className="cap" style={{ color: 'inherit', opacity: .92 }}>
                Free, no documents, and every verdict tells you why.
              </p>
            </div>
            <div className="row wr" style={{ gap: 10 }}>
              <Btn variant="filled" to="/signup" style={{ background: '#fff', color: 'var(--primary)' }}>Create your profile</Btn>
              <Btn variant="text" to="/login" style={{ color: '#fff' }}>I already have an account</Btn>
            </div>
          </Card>

          <SiteFoot />
          <Disclaimer />
        </section>
      </div>
      <DesignBar current="aurora" />
    </PublicShell>
  );
}
