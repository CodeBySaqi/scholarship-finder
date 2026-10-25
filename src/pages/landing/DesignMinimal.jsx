import React from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '../../components/Shell.jsx';
import { Card, Btn, Chip, Icon, Divider } from '../../components/ui.jsx';
import { Disclaimer, FreshnessTag, fundingLabel } from '../../lib.jsx';
import { useLanding } from './data.js';
import { DesignBar, SiteFoot } from './shared.jsx';

/* Design 5 — Minimal type.
   Whitespace and type do the work: one sentence, one button, three numbered
   facts, and a small list of what was recently checked. Quiet on purpose. */
export default function DesignMinimal() {
  const { stats, sample, num } = useLanding();

  return (
    <PublicShell page="landing" footer={false}>
      <div className="lv lv-min">
        <section className="lv5-hero">
          <span className="lv5-kicker">Scholarships and German programmes for Pakistani students</span>
          <h1 className="lv5-h1">
            Know where you stand<br />before you apply.
          </h1>
          <p className="lv5-lead">
            Every published minimum, checked against your profile. Three verdicts, the reasons written out,
            and the date each listing was last verified.
          </p>
          <div className="row wr" style={{ gap: 12, marginTop: 6 }}>
            <Btn variant="filled" size="lg" to="/signup">Create your profile</Btn>
            <Btn variant="text" size="lg" to="/scholarships">See the listings →</Btn>
          </div>
        </section>

        <Divider className="lv5-rule" />

        <section className="lv5-facts">
          {[
            [num(stats.scholarships), 'scholarships verified by hand'],
            [num(stats.programs), 'English-taught German programmes'],
            ['3', 'verdicts — never a match percentage'],
            ['90d', 'after which a listing stops counting as current']
          ].map(([n, l]) => (
            <div className="lv5-fact" key={l}>
              <div className="lv5-fact__n">{n}</div>
              <div className="cap">{l}</div>
            </div>
          ))}
        </section>

        <Divider className="lv5-rule" />

        <section className="lv5-two">
          <div className="lv5-col">
            <h2 className="lv5-h2">What it does</h2>
            <ol className="lv5-list">
              <li><b>A profile, not a form dump.</b> Degree, CGPA, English, age, intake — the fields that change a verdict, and nothing else. No passport, no bank details.</li>
              <li><b>A verdict per listing.</b> Eligible, Not eligible, or Check manually, with each requirement shown as met, missed or unknown.</li>
              <li><b>A shortlist with dates.</b> Save what fits, watch the deadlines, and confirm on the provider's own page before paying anything.</li>
            </ol>
          </div>
          <div className="lv5-col">
            <h2 className="lv5-h2">What it never does</h2>
            <ul className="lv5-list lv5-list--x">
              <li><Icon name="close" size={13} /> promise admission, or a ranking we are paid for</li>
              <li><Icon name="close" size={13} /> invent a CGPA cut-off, fee, ECTS count or deadline</li>
              <li><Icon name="close" size={13} /> hide a programme because its page was vague</li>
              <li><Icon name="close" size={13} /> treat “medium of instruction” as a language waiver</li>
            </ul>
            <p className="cap lv5-aside">Screening is not admission. Grades converted from CGPA are estimates and are labelled as such.</p>
          </div>
        </section>

        <Divider className="lv5-rule" />

        <section className="lv5-recent">
          <div className="row sp wr" style={{ gap: 10 }}>
            <h2 className="lv5-h2">Recently checked</h2>
            <Link className="link-quiet" to="/scholarships">All listings →</Link>
          </div>
          <div className="lv5-rows">
            {(stats.recent || []).slice(0, 5).map(l => (
              <Link className="lv5-row" key={l.id} to={(l.kind === 'scholarship' ? '/scholarship/' : '/program/') + l.id}>
                <span className="lv5-row__t">{l.title}</span>
                <span className="cap lv5-row__p">{l.provider} · {fundingLabel(l)}</span>
                <FreshnessTag iso={l.lastVerified} freshness={l.freshness} />
              </Link>
            ))}
            {sample === null && <p className="cap">Nothing verified yet.</p>}
          </div>
        </section>

        <section className="lv5-end">
          <h2 className="lv5-h1">Five minutes. No documents.</h2>
          <Btn variant="filled" size="lg" to="/signup">Start your profile</Btn>
        </section>

        <SiteFoot />
        <Disclaimer />
      </div>
      <DesignBar current="minimal" />
    </PublicShell>
  );
}
