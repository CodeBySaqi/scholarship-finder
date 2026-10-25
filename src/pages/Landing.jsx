import React from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '../components/Shell.jsx';
import { Icon, StatCard, BarChart, Donut, Card, Btn, useAsync, Loader } from '../components/ui.jsx';
import { api } from '../api.js';
import { fmtDate, fundingLabel, FreshnessTag, CountdownTag, toneFor, iconFor, Disclaimer } from '../lib.jsx';

const STEPS = [
  { n: '01', icon: 'person', tone: 'tone-blue', t: 'Build your profile', d: 'Degree, CGPA, IELTS, age, APS and intake. Five short steps, editable later.' },
  { n: '02', icon: 'target', tone: 'tone-green', t: 'See what you meet', d: 'Every listing is checked against its published minimums. Gaps are named.' },
  { n: '03', icon: 'bookmark', tone: 'tone-amber', t: 'Track and apply', d: 'Save the shortlist, watch deadlines, and confirm on the provider’s own page.' }
];


export default function Landing() {
  const { data, loading, error, reload } = useAsync(() => api.get('/public/stats'), []);
  const stats = data || { scholarships: 0, programs: 0, universities: 0, recent: [], verifiedList: [] };
  const sample = (stats.recent || [])[0] || null;
  const statsReady = !loading && !error && !!data;

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    return { key: d.toISOString().slice(0, 7), label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] };
  });
  const counts = months.map(m => stats.verifiedList.filter(l => l.deadline && l.deadline.slice(0, 7) === m.key).length);

  const checks = { 'CGPA': 0, 'IELTS / English': 0, 'Degree & route': 0, 'Age & timing': 0, 'Nationality': 0, 'Deadline': 0 };
  stats.verifiedList.forEach(l => {
    if (l.minCgpa) checks['CGPA']++;
    if (l.ieltsRequired) checks['IELTS / English']++;
    if (l.degreeLevels && l.degreeLevels.length) checks['Degree & route']++;
    if (l.maxAge) checks['Age & timing']++;
    if (l.allowedCountries && l.allowedCountries.length) checks['Nationality']++;
    if (l.deadline) checks['Deadline']++;
  });
  const palette = ['var(--c1)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c2)', 'var(--c3)'];

  return (
    <PublicShell page="landing">
      <section className="hero">
        <div className="col" style={{ gap: 14 }}>
          <div className="hero-badges">
            <span className="tag tag--pr">For Pakistani students</span>
            <span className="tag tag--out">Germany</span>
            <span className="tag tag--ok"><Icon name="checkCircle" size={13} />Rechecked by a human</span>
          </div>
          <h1>Find the scholarships and German programs you actually meet</h1>
          <p className="lead">We check every published minimum against your profile — CGPA, IELTS, age, entry route, APS — and tell you exactly what is missing. No guesswork, and no promises about selection.</p>
          <div className="row wr" style={{ gap: 10 }}>
            <Btn variant="filled" to="/signup">Create your profile</Btn>
            <Btn variant="outlined" to="/scholarships">Browse scholarships</Btn>
            <Btn variant="text" href="#how">How it works</Btn>
          </div>
          <div className="row wr" style={{ gap: 16, marginTop: 4 }}>
            <span className="cap"><b className="w600" style={{ color: 'var(--text)' }}>{statsReady ? stats.scholarships : '—'}</b> verified scholarships</span>
            <span className="cap"><b className="w600" style={{ color: 'var(--text)' }}>{statsReady ? stats.programs : '—'}</b> German programs</span>
            <span className="cap"><b className="w600" style={{ color: 'var(--text)' }}>{statsReady ? stats.universities : '—'}</b> universities</span>
            <span className="cap">Deadlines move — every card shows the date it was checked.</span>
          </div>
        </div>

        <div className="hero__art">
          {sample ? (
            <Link className="card card--pad-l" style={{ gap: 14 }} to={'/' + (sample.kind === 'program' ? 'program' : 'scholarship') + '/' + sample.id}>
              <div className="row sp wr" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="statcard__icon tone-green"><Icon name={iconFor(sample.kind)} /></span>
                  <div><div className="h3">{sample.title}</div><div className="cap">{sample.provider}{sample.hostCountry ? ' · ' + sample.hostCountry : ''}</div></div>
                </div>
                <span className={sample.kind === 'program' ? 'tag tag--out' : 'tag tag--pr'}>{sample.kind === 'program' ? 'Program' : fundingLabel(sample)}</span>
              </div>
              <div className="rows" style={{ fontSize: 13 }}>
                <div className="row sp"><span className="cap">CGPA minimum</span><b className="w600">{sample.minCgpa ? sample.minCgpa + ' / 4.0' : 'Not stated on the source'}</b></div>
                <div className="row sp"><span className="cap">English</span><b className="w600">{sample.ieltsRequired ? (sample.minIelts ? 'IELTS ' + sample.minIelts : 'Certificate required') : 'Not required'}</b></div>
                <div className="row sp"><span className="cap">Deadline</span><b className="w600">{sample.deadline ? fmtDate(sample.deadline) : 'Not stated'}</b></div>
              </div>
              <div className="row sp wr" style={{ gap: 8 }}>
                <CountdownTag iso={sample.deadline} />
                <FreshnessTag iso={sample.lastVerified} freshness={sample.freshness} />
              </div>
              <div className="notice notice--info" style={{ fontSize: 12 }}>
                <Icon name="info" />
                <span>The newest listing in the database, as a student sees it. Every card shows the date it was last checked against the official page.</span>
              </div>
            </Link>
          ) : (
            <Card  style={{ gap: 14 }} className="card card--pad-l">
              <div className="row" style={{ gap: 10 }}>
                <span className="statcard__icon tone-green"><Icon name="cap" /></span>
                <div><div className="h3">{loading ? 'Loading the newest listing…' : 'No verified listing yet'}</div><div className="cap">Germany · checked by an editor</div></div>
              </div>
              <p className="cap">The card on this spot shows the most recently verified scholarship or program. Nothing is shown until an editor has checked it against an official page.</p>
            </Card>
          )}
        </div>
      </section>

      {error && (
        <Card  style={{ gap: 8 }}>
          <div className="row sp wr" style={{ gap: 10 }}>
            <span className="cap"><b className="w500">The live numbers could not load.</b> The rest of the page still works; the counts come from the same API.</span>
            <Btn variant="outlined" size="sm" onClick={reload}>Try again</Btn>
          </div>
        </Card>
      )}

      <section className="statgrid">
        <StatCard label="Scholarships" value={statsReady ? stats.scholarships : '—'} sub="verified, open now" icon="cap" tone="tone-green" to="/scholarships" />
        <StatCard label="German programs" value={statsReady ? stats.programs : '—'} sub="English-taught, checked" icon="school" tone="tone-blue" to="/programs" />
        <StatCard label="Recheck window" value="90d" sub="then the listing warns you" icon="clock" tone="tone-amber" />
        <StatCard label="Cost to apply" value="Free" sub="no paid ranking, ever" icon="shield" tone="tone-purple" />
      </section>

      <div className="dash-grid">
        <div className="dash-main">
          <Card  id="how">
            <div className="row sp"><div><div className="h2">How it works</div><p className="cap">Three steps, about five minutes</p></div>
              <span className="tag tag--pr">Free</span></div>
            <div className="cards-3">
              {STEPS.map(s => (
                <Card  style={{ gap: 10 }} key={s.n} className="card card--flat">
                  <div className="row sp"><span className={'statcard__icon ' + s.tone}><Icon name={s.icon} /></span>
                    <span className="eyebrow">{s.n}</span></div>
                  <div className="h3">{s.t}</div><p className="cap">{s.d}</p>
                </Card>
              ))}
            </div>
          </Card>

          <Card>
            <div className="row sp">
              <div><div className="h2">Recently verified</div><p className="cap">Newest human checks first — nothing older than 90 days is shown as current</p></div>
              <Btn variant="outlined" size="sm" to="/scholarships">All scholarships</Btn>
            </div>
            {loading ? <Loader /> : (
              <div className="rows">
                {stats.recent.map(l => (
                  <Link className="row sp" key={l.id} to={(l.kind === 'scholarship' ? '/scholarship/' : '/program/') + l.id} style={{ color: 'inherit', gap: 12 }}>
                    <div className="row" style={{ gap: 12, minWidth: 0 }}>
                      <span className={'statcard__icon ' + toneFor(l.kind)} style={{ width: 38, height: 38, borderRadius: 11 }}><Icon name={iconFor(l.kind)} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                        <div className="cap nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.provider} · {fundingLabel(l)}</div>
                      </div>
                    </div>
                    <div className="row wr" style={{ gap: 6 }}>
                      <FreshnessTag iso={l.lastVerified} freshness={l.freshness} />
                      <CountdownTag iso={l.deadline} />
                      <span className="link-quiet nowrap hide-sm">Open →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="dash-side">
          <Card>
            <div className="row sp"><div><div className="h2">Deadlines ahead</div><p className="cap">Verified listings, next six months</p></div>
              <span className="tag tag--pr">{counts.reduce((a, b) => a + b, 0)} total</span></div>
            <BarChart values={counts} labels={months.map(m => m.label)} height={140} />
          </Card>

          <Card>
            <div className="row sp"><div className="h2">What every card checks</div><span className="tag tag--out">{stats.verifiedList.length} listings</span></div>
            <p className="cap">Six kinds of check, and how many listings publish each one</p>
            <Donut segments={Object.keys(checks).map((k, i) => ({ label: k, value: checks[k], color: palette[i % palette.length] }))}
              centerValue={String(stats.verifiedList.length)} centerLabel="listings" />
          </Card>

          <Card  style={{ gap: 10 }} className="card card--tone">
            <div className="h2" style={{ color: 'inherit' }}>Never the word “eligible”</div>
            <p className="cap" style={{ opacity: .92 }}>We say you meet the published minimums and name what is missing. Selection is the provider’s decision, and grades we convert are always estimates.</p>
            <Btn variant="filled" size="sm" to="/signup" style={{ alignSelf: 'flex-start' }}>Start your profile</Btn>
          </Card>
        </div>
      </div>

      <Disclaimer />
    </PublicShell>
  );
}
