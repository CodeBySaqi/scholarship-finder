import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/Shell.jsx';
import { Icon, StatCard, BarChart, Donut, Loader, Empty, Btn, Progress, useAsync, LoadError } from '../components/ui.jsx';
import { ListingRow } from '../components/cards.jsx';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useSaved } from '../components/saved.jsx';
import { fmtDate, daysTo, plural, CountdownTag, Disclaimer, FreshnessTag } from '../lib.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const saved = useSaved();
  const { data, loading, error, reload } = useAsync(() => Promise.all([
    api.get('/profile'),
    api.get('/matches?kind=scholarships'),
    api.get('/matches?kind=programs'),
    api.get('/listings?kind=scholarship'),
    api.get('/listings?kind=program')
  ]).then(([profile, sch, prog, schL, progL]) => ({ profile, sch, prog, schL, progL })), []);

  const p = data ? data.profile.profile : null;
  const targets = (data && data.profile.targets) || [];
  const sch = (data && data.sch) || { meets: [], almost: [], next_cycle: [], all: [] };
  const prog = (data && data.prog) || { meets: [], almost: [], next_cycle: [] };

  const meets = sch.meets.length + prog.meets.length;
  const almost = sch.almost.length + prog.almost.length;

  const soon = useMemo(() => {
    const all = (data && data.schL.listings.concat(data.progL.listings)) || [];
    const inMatch = [...sch.meets, ...sch.almost, ...prog.meets, ...prog.almost].map(r => r.listingId);
    const seen = {};
    return all.map(l => ({ l, d: l.deadline ? daysTo(l.deadline) : null, saved: saved.ids.includes(l.id) }))
      .filter(x => (x.saved || inMatch.includes(x.l.id)) && x.d != null && x.d >= 0 && x.d <= 30)
      .filter(x => (seen[x.l.id] ? false : (seen[x.l.id] = 1)))
      .sort((a, b) => a.d - b.d);
  }, [data, saved.ids]);

  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      return { key: d.toISOString().slice(0, 7), label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] };
    });
  }, []);
  const allVerified = ((data && data.schL.listings) || []).concat((data && data.progL.listings) || []);
  const counts = months.map(m => allVerified.filter(l => l.deadline && l.deadline.slice(0, 7) === m.key).length);
  const tallest = counts.indexOf(Math.max(...counts));

  const near = [...sch.almost, ...prog.almost].slice(0, 3);

  if (loading) return <AppShell page="dashboard"><div className="card"><Loader label="Loading your dashboard" /></div></AppShell>;
  if (!data || !data.profile || !data.profile.profile) {
    return <AppShell page="dashboard"><LoadError error={error} onRetry={reload} what="dashboard" /></AppShell>;
  }

  const pct = p ? p.completenessPct : 0;
  const provisional = pct < 80;
  const leftSteps = Math.max(1, Math.ceil((100 - pct) / 12));

  const steps = [];
  if (p && p.apsStatus !== 'certificate_ready') steps.push({ t: 'Start your APS certificate', d: 'Several programs require it before you apply. It takes weeks.', to: '/wizard?step=5', icon: 'file', tone: 'tone-amber' });
  if (p && p.ibccStatus !== 'done' && p.ibccStatus !== 'not_needed') steps.push({ t: 'Complete IBCC equivalence', d: 'Needed for the bachelor route with an HSSC certificate.', to: '/wizard?step=2', icon: 'shield', tone: 'tone-blue' });
  if (p && (!p.ielts || p.ielts.status !== 'taken')) steps.push({ t: 'Book IELTS', d: 'Most English-taught programs ask for 6.0–6.5.', to: '/wizard?step=3', icon: 'globe', tone: 'tone-purple' });
  if (p && (p.documentsReady || []).length < 3) steps.push({ t: 'Collect 3 core documents', d: 'Transcripts, degree certificate and CV cover most applications.', to: '/wizard?step=5', icon: 'list', tone: 'tone-cyan' });
  if (pct < 100) steps.push({ t: 'Finish your profile', d: 'Complete profiles get the full, provisional-free list.', to: '/wizard', icon: 'person', tone: 'tone-green' });

  return (
    <AppShell page="dashboard" counts={{ summary: targets.length ? (targets[0].label || '').replace(/^Primary: /, '') + ' · ' + targets[0].intakeYear + ' intake' : 'No targets yet', saved: saved.rows.length }}>
      <div className="phead">
        <div>
          <h1 className="h1">Dashboard</h1>
          <p className="cap">Everything your profile can reach, and what is still missing.</p>
        </div>
        <div className="chips">
          {targets.map((t, i) => (
            <span className={'chip' + (t.isPrimary ? ' is-on' : '')} key={i}>
              {t.isPrimary ? <Icon name="star" /> : null}{t.label || (t.isPrimary ? 'Primary' : 'Backup')} · {t.intakeYear}
            </span>
          ))}
          <Link className="chip" to="/wizard?step=4">Edit targets</Link>
        </div>
      </div>

      {pct < 100 && (
        <section className="card card--pad-l">
          <div className="row sp wr" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 12, minWidth: 0 }}>
              <span className="statcard__icon tone-amber"><Icon name="alert" /></span>
              <div>
                <div className="h3">Profile {pct}% complete</div>
                <p className="cap">{provisional
                  ? 'Counts are provisional. Add your IELTS status and CGPA to unlock the full list.'
                  : 'Add your IELTS certificate date so we can check whether it is still valid at each deadline.'}</p>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span className="tag tag--wn">{leftSteps} step{leftSteps === 1 ? '' : 's'} left</span>
              <Btn variant="filled" size="sm" to={'/wizard?step=' + (provisional ? 3 : 4)}>Finish profile</Btn>
            </div>
          </div>
          <Progress value={pct} tone="progress--grad" />
        </section>
      )}

      <div className="statgrid">
        <StatCard label="Scholarships matched" value={sch.meets.length} sub="meet published minimums" icon="cap" tone="tone-green"
          delta={'+' + sch.next_cycle.length} dir="up" to="/matches"
          progress={Math.round(sch.meets.length / Math.max(((data && data.schL.listings) || []).length, 1) * 100)} />
        <StatCard label="Programs matched" value={prog.meets.length} sub="German programs you can apply to" icon="school" tone="tone-blue"
          delta={'+' + prog.next_cycle.length} dir="up" to="/matches"
          progress={Math.round(prog.meets.length / Math.max(((data && data.progL.listings) || []).length, 1) * 100)} />
        <StatCard label="Almost there" value={almost} sub="one requirement away" icon="target" tone="tone-amber" to="/matches" />
        <StatCard label="Saved" value={saved.rows.length} sub="with deadlines tracked" icon="bookmark" tone="tone-purple" to="/saved" />
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          <section className="card">
            <div className="chart-head">
              <div><div className="h2">Deadlines ahead</div><p className="cap">Verified listings closing in the next five months</p></div>
              <span className="tag tag--pr">{soon.length} due in 30 days</span>
            </div>
            <BarChart values={counts} labels={months.map(m => m.label)} height={170} highlight={tallest} />
            <div className="legend">
              <span className="legend__item"><span className="legend__dot" style={{ background: 'var(--c1)' }} />This month</span>
              <span className="legend__item"><span className="legend__dot" style={{ background: 'var(--chart-track)' }} />Later months</span>
              <span className="legend__item" style={{ marginLeft: 'auto' }}><Link className="link-quiet" to="/saved">Track your saved list →</Link></span>
            </div>
          </section>

          <section className="card">
            {soon.length ? (
              <>
                <div className="row sp">
                  <div><div className="h2">Closing soon</div><p className="cap">Saved or matched listings inside 30 days</p></div>
                  <Btn variant="outlined" size="sm" to="/saved">Saved list</Btn>
                </div>
                <div className="rows">
                  {soon.map(x => (
                    <div className="row sp" style={{ gap: 12 }} key={x.l.id}>
                      <Link to={(x.l.kind === 'scholarship' ? '/scholarship/' : '/program/') + x.l.id} style={{ color: 'inherit', minWidth: 0 }}>
                        <div className="h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.l.title}</div>
                        <div className="cap">{(x.saved ? 'Saved ' : 'Matched ') + x.l.kind + ' · ' + fmtDate(x.l.deadline)}</div>
                      </Link>
                      <CountdownTag iso={x.l.deadline} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="h2">Closing soon</div>
                <Empty icon="calendar" title="Nothing due in the next 30 days"
                  text="When a saved or matched listing comes within 30 days of its deadline it appears here with a countdown."
                  action={<Btn variant="tonal" size="sm" to="/scholarships">Browse scholarships</Btn>} />
              </>
            )}
          </section>

          <section className="card">
            {near.length ? (
              <>
                <div className="row sp">
                  <div><div className="h2">Closest gaps</div><p className="cap">One missing item each — these are the cheapest wins</p></div>
                  <Btn variant="outlined" size="sm" to="/matches">All matches</Btn>
                </div>
                <div className="rows">
                  {near.map(r => (
                    <Link className="row-top sp" key={r.listingId} to={(r.listing.kind === 'scholarship' ? '/scholarship/' : '/program/') + r.listing.id} style={{ color: 'inherit', gap: 12 }}>
                      <span className="row-top" style={{ gap: 10, minWidth: 0 }}>
                        <span className="tag tag--wn" style={{ flex: 'none' }}>Gap</span>
                        <span style={{ minWidth: 0 }}>
                          <span className="h3" style={{ display: 'block' }}>{r.listing.title}</span>
                          <span className="cap">{(r.gaps && r.gaps[0]) || 'One requirement missing'}</span>
                        </span>
                      </span>
                      <span className="link-quiet nowrap">Fix →</span>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="h2">Closest gaps</div>
                <Empty icon="checkCircle" title="No gaps right now" text="Every listing you can see is either a full match or outside your targets." />
              </>
            )}
          </section>
        </div>

        <div className="dash-side">
          <section className="card">
            <div className="row sp"><div className="h2">Match breakdown</div><span className="tag tag--out">{meets + almost} listings</span></div>
            <p className="cap">Across scholarships and German programs</p>
            <Donut segments={[
              { label: 'Meets minimums', value: meets, color: 'var(--c4)' },
              { label: 'Almost there', value: almost, color: 'var(--c5)' },
              { label: 'Next cycle', value: sch.next_cycle.length + prog.next_cycle.length, color: 'var(--c1)' }
            ]} centerValue={meets + almost} centerLabel="in reach" />
            <Btn variant="tonal" size="sm" block to="/matches">Open matches</Btn>
          </section>

          <section className="card">
            <div className="h2">Next steps</div>
            <p className="cap">The order that unlocks the most listings</p>
            <div className="rows">
              {steps.length ? steps.slice(0, 4).map(s => (
                <Link className="row-top" key={s.t} to={s.to} style={{ color: 'inherit', gap: 10 }}>
                  <span className={'statcard__icon ' + s.tone} style={{ width: 34, height: 34, borderRadius: 10, flex: 'none' }}><Icon name={s.icon} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span className="h3" style={{ display: 'block' }}>{s.t}</span>
                    <span className="cap">{s.d}</span>
                  </span>
                </Link>
              )) : <p className="cap">Nothing outstanding. Your profile is complete.</p>}
            </div>
          </section>

          <section className="card">
            <div className="row sp"><div className="h2">Saved list</div><Link className="link-quiet" to="/saved">All →</Link></div>
            {saved.rows.length ? (
              <div className="rows">
                {saved.rows.slice(0, 3).map(r => r.listing ? (
                  <Link className="row sp" key={r.id} to={(r.listing.kind === 'scholarship' ? '/scholarship/' : '/program/') + r.listing.id} style={{ color: 'inherit', gap: 10 }}>
                    <span className="h3" style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.listing.title}</span>
                    <CountdownTag iso={r.listing.deadline} />
                  </Link>
                ) : null)}
              </div>
            ) : <p className="cap">Nothing saved yet. Save a listing to track its deadline here.</p>}
          </section>

          <section className="card card--tone">
            <div className="row-top" style={{ gap: 10 }}>
              <span className="statcard__icon tone-blue" style={{ background: 'rgba(255,255,255,.55)', width: 36, height: 36 }}><Icon name="refresh" /></span>
              <div>
                <div className="h3" style={{ color: 'inherit' }}>Every listing is dated</div>
                <p className="cap" style={{ opacity: .9 }}>A listing not rechecked for 90 days shows “Needs recheck”. After 180 days it leaves the results until a human verifies it again.</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Disclaimer />
    </AppShell>
  );
}
