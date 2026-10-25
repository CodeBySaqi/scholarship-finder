import React from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '../../components/Shell.jsx';
import { Card, Btn, Chip, Icon, Notice, Loader } from '../../components/ui.jsx';
import { Disclaimer } from '../../lib.jsx';
import { useLanding, STEPS } from './data.js';
import { DesignBar, ChoiceBanner, MiniListing, TrustRow, StepCards, SiteFoot } from './shared.jsx';

/* Design 1 — Split editorial.
   Oversized headline and copy on the left, one real listing card on the right,
   then counts, the three steps and the newest checks. Closest to the current
   site, but with HeroUI's type scale, pills and soft cards. */
export default function DesignSplit() {
  const { stats, loading, error, reload, sample, num } = useLanding();
  return (
    <PublicShell page="landing" footer={false}>
      <div className="lv lv-split">
        <ChoiceBanner />

        <section className="lv1-hero">
          <div className="lv1-copy">
            <div className="row wr" style={{ gap: 8 }}>
              <Chip className="tag" color="primary" variant="flat">For Pakistani students</Chip>
              <Chip className="tag" color="default" variant="flat">Germany</Chip>
              <Chip className="tag" color="success" variant="flat" startContent={<Icon name="checkCircle" size={13} />}>Checked by a human</Chip>
            </div>
            <h1 className="lv1-h1">Find the scholarships and German programmes you <span className="lv-mark">actually meet</span></h1>
            <p className="lv1-lead">
              Every published minimum — CGPA, IELTS, entry route, age, APS — is checked against your profile.
              You get three honest answers: <b>Eligible</b>, <b>Not eligible</b>, or <b>Check manually</b>, with the
              reasons written out. Screening is not admission.
            </p>
            <div className="row wr" style={{ gap: 10 }}>
              <Btn variant="filled" to="/signup">Create your profile</Btn>
              <Btn variant="outlined" to="/scholarships">Browse scholarships</Btn>
              <Btn variant="text" href="#how">How it works</Btn>
            </div>
            <TrustRow stats={stats} num={num} />
          </div>

          <div className="lv1-art">
            {loading ? <Card><Loader label="Loading the newest check" /></Card>
              : sample ? <MiniListing l={sample} />
              : <Card><p className="cap">Nothing is shown here until an editor has checked a listing against an official page.</p></Card>}
            <p className="cap lv1-note">The newest listing in the database, exactly as a student sees it.</p>
          </div>
        </section>

        {error && (
          <Notice tone="warning">
            <b className="w500">The live numbers could not load.</b> The rest of the page still works — the counts come
            from the same API. <Btn size="sm" variant="text" onClick={reload}>Try again</Btn>
          </Notice>
        )}

        <section className="lv1-stats">
          {[
            ['Scholarships', num(stats.scholarships), 'verified, open now', 'cap', 'tone-green', '/scholarships'],
            ['German programmes', num(stats.programs), 'English-taught, checked', 'school', 'tone-blue', '/programs'],
            ['Recheck window', '90d', 'then the card warns you', 'clock', 'tone-amber', null],
            ['Cost to apply', 'Free', 'no paid ranking, ever', 'shield', 'tone-purple', null]
          ].map(([label, value, sub, icon, tone, to]) => {
            const inner = (
              <>
                <div className="row sp" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="statcard__label">{label}</div>
                    <div className="lv1-num">{value}</div>
                  </div>
                  <span className={'statcard__icon ' + tone}><Icon name={icon} /></span>
                </div>
                <div className="cap">{sub}</div>
              </>
            );
            return to ? <Card key={label} as={Link} to={to} className="lv1-stat" style={{ gap: 10 }}>{inner}</Card>
              : <Card key={label} className="lv1-stat" style={{ gap: 10 }}>{inner}</Card>;
          })}
        </section>

        <section id="how" className="lv1-how">
          <div className="lv1-sec-head">
            <div>
              <h2 className="h1">How it works</h2>
              <p className="cap">Three steps, about five minutes. Free, and nothing to upload.</p>
            </div>
            <Chip className="tag" color="primary" variant="flat">No documents needed</Chip>
          </div>
          <StepCards steps={STEPS} />
        </section>

        <section className="lv1-recent">
          <div className="lv1-sec-head">
            <div>
              <h2 className="h1">Recently verified</h2>
              <p className="cap">Newest human checks first. Nothing older than 90 days is shown as current.</p>
            </div>
            <Btn variant="outlined" size="sm" to="/scholarships">All scholarships</Btn>
          </div>
          <div className="lv1-recent-grid">
            {(stats.recent || []).slice(0, 4).map(l => <MiniListing key={l.id} l={l} compact />)}
            {!loading && !(stats.recent || []).length && <Card><p className="cap">No verified listing yet.</p></Card>}
          </div>
        </section>

        <section className="lv1-honest">
          <Card className="lv1-honest-card">
            <h2 className="h1" style={{ color: 'inherit' }}>We never say “eligible” and mean “selected”</h2>
            <p className="lead" style={{ color: 'inherit', opacity: .95 }}>
              Meeting every published minimum is not an offer of admission. The verdict is a screening result from the
              provider’s own text, the reasons are always shown, and anything a provider does not publish is reported as
              <b> unknown</b> rather than guessed.
            </p>
            <div className="row wr" style={{ gap: 10 }}>
              <Btn variant="filled" to="/signup" style={{ background: '#fff', color: 'var(--primary)' }}>Start your profile</Btn>
              <Btn variant="text" to="/programs" style={{ color: '#fff' }}>See the programmes</Btn>
            </div>
          </Card>
        </section>

        <SiteFoot />
        <Disclaimer />
      </div>
      <DesignBar current="split" />
    </PublicShell>
  );
}
