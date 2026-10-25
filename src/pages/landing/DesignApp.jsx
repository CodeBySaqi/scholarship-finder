import React from 'react';
import { PublicShell } from '../../components/Shell.jsx';
import { Card, Btn, Chip, Icon, Progress } from '../../components/ui.jsx';
import { Disclaimer, FreshnessTag, CountdownTag, iconFor, toneFor, fundingLabel } from '../../lib.jsx';
import { useLanding, STEPS } from './data.js';
import { DesignBar, ChoiceBanner, SiteFoot } from './shared.jsx';

/* Design 4 — Product preview.
   The hero is the product: a mocked app window built from the same cards the
   real dashboard uses. Copy sits beside it as three short promises. */
export default function DesignApp() {
  const { stats, sample, counts, months, num } = useLanding();
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts, 1);

  return (
    <PublicShell page="landing">
      <div className="lv lv-app">
        <ChoiceBanner />

        <section className="lv4-hero">
          <div className="lv4-copy">
            <Chip className="tag" color="primary" variant="flat">Pakistan → Germany</Chip>
            <h1 className="lv4-h1">A shortlist that tells you <span className="lv-mark">why</span></h1>
            <p className="lv4-lead">
              Not another scholarship directory. ScholarPath checks every published minimum against your profile
              and shows the verdict with its reasons, on the programme card itself.
            </p>
            <div className="lv4-promises">
              {[
                ['target', 'Verdicts, not percentages', 'Eligible, Not eligible, or Check manually — never a score with no explanation.'],
                ['shield', 'Fixed source of truth', 'The university page beats the aggregator listing, and the check date is on every card.'],
                ['clock', 'Deadlines that move', 'Listings older than 90 days stop being shown as current and warn you instead.']
              ].map(([icon, t, d]) => (
                <div className="lv4-promise" key={t}>
                  <span className="statcard__icon tone-blue"><Icon name={icon} /></span>
                  <div><div className="h3">{t}</div><p className="cap">{d}</p></div>
                </div>
              ))}
            </div>
            <div className="row wr" style={{ gap: 10 }}>
              <Btn variant="filled" to="/signup">Create your profile</Btn>
              <Btn variant="text" href="#how">See how it works</Btn>
            </div>
          </div>

          {/* the mocked app window */}
          <div className="lv4-window" aria-label="Preview of the app">
            <div className="lv4-window__bar">
              <span className="lv4-dot" /><span className="lv4-dot" /><span className="lv4-dot" />
              <span className="lv4-window__url">scholarship-finder · matches</span>
            </div>
            <div className="lv4-window__body">
              <div className="lv4-mini-tabs">
                <span className="is-on">Scholarships · {num(stats.scholarships)}</span>
                <span>Programmes · {num(stats.programs)}</span>
              </div>
              {sample ? (
                <Card className="lv4-card">
                  <div className="row sp wr" style={{ gap: 8 }}>
                    <div className="row" style={{ gap: 10, minWidth: 0 }}>
                      <span className={'statcard__icon ' + toneFor(sample.kind)} style={{ width: 36, height: 36 }}>
                        <Icon name={iconFor(sample.kind)} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="h3 lv4-clamp">{sample.title}</div>
                        <div className="cap">{sample.provider}</div>
                      </div>
                    </div>
                    <Chip size="sm" className="tag" color="success" variant="flat">
                      <Icon name="check" size={12} /> {sample.freshness === 'fresh' ? 'Eligible' : 'Check manually'}
                    </Chip>
                  </div>
                  <div className="lv4-checks">
                    {[['CGPA', sample.minCgpa ? sample.minCgpa + ' / 4.0' : 'not stated', 'ok'],
                      ['English', sample.ieltsRequired ? (sample.minIelts ? 'IELTS ' + sample.minIelts : 'certificate') : 'not required', 'ok'],
                      ['Deadline', sample.deadline || 'not stated', 'ask']].map(([k, v, tone]) => (
                      <div className={'lv4-check lv4-check--' + tone} key={k}>
                        <Icon name={tone === 'ok' ? 'check' : 'info'} size={13} />
                        <span>{k}</span><b>{v}</b>
                      </div>
                    ))}
                  </div>
                  <div className="row sp wr" style={{ gap: 8 }}>
                    <div className="row wr" style={{ gap: 6 }}>
                      <FreshnessTag iso={sample.lastVerified} freshness={sample.freshness} />
                      <CountdownTag iso={sample.deadline} />
                    </div>
                    <Btn size="sm" variant="tonal">Save</Btn>
                  </div>
                </Card>
              ) : <Card><p className="cap">No verified listing yet.</p></Card>}

              <Card className="lv4-mini-chart">
                <div className="row sp"><span className="cap">Deadlines, next 6 months</span><b className="w600">{total}</b></div>
                <div className="lv4-bars">
                  {counts.map((v, i) => (
                    <div key={i} className="lv4-bar"><div style={{ height: Math.max(5, (v / max) * 100) + '%' }} /><span>{months[i].label}</span></div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section id="how" className="lv4-steps">
          {STEPS.map(s => (
            <Card key={s.n} className="lv4-step">
              <div className="row sp"><span className="lv4-step__n">{s.n}</span><span className="eyebrow">step</span></div>
              <div className="h3">{s.t}</div>
              <p className="cap">{s.d}</p>
              <Progress value={100} />
            </Card>
          ))}
        </section>

        <section className="lv4-band">
          <div>
            <h2 className="h1">Built on what the provider actually published</h2>
            <p className="cap">
              Every requirement field is optional and every unknown is shown as unknown. If a page does not state a
              CGPA minimum or a funding amount, the card says so instead of guessing.
            </p>
          </div>
          <div className="row wr" style={{ gap: 10 }}>
            <Btn variant="filled" to="/programs">Browse programmes</Btn>
            <Btn variant="outlined" to="/scholarships">Browse scholarships</Btn>
          </div>
        </section>

        <SiteFoot />
        <Disclaimer />
      </div>
      <DesignBar current="app" />
    </PublicShell>
  );
}
