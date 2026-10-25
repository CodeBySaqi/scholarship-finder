import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/Shell.jsx';
import { Card, Icon, Loader, Empty, Btn, Notice, useAsync, useToast, LoadError } from '../components/ui.jsx';
import { MatchCard } from '../components/cards.jsx';
import { Sheet } from '../components/Sheet.jsx';
import MatchFilters, { defaultFilters, applyFilters } from '../components/MatchFilters.jsx';
import { api } from '../api.js';
import { Disclaimer, daysTo } from '../lib.jsx';

const REASONS = ['Deadline is wrong', 'Requirements changed', 'The link does not work', 'This listing has closed', 'Something else'];

export default function Matches() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'programs' ? 'programs' : 'scholarships');
  const [filters, setFilters] = useState(() => defaultFilters(tab));
  const [reporting, setReporting] = useState(null);
  const [reason, setReason] = useState(REASONS[0]);
  const toast = useToast();

  const kind = tab === 'programs' ? 'programs' : 'scholarships';
  const { data: sch, loading: l1, error: e1, reload: r1 } = useAsync(() => api.get('/matches?kind=scholarships'), []);
  const { data: prog, loading: l2, error: e2, reload: r2 } = useAsync(() => api.get('/matches?kind=programs'), []);
  const active = kind === 'programs' ? prog : sch;

  /* every control lives in the contextual filter card, so the grouping here is
     just "take what survived the filters and put it back into its three buckets" */
  const groups = useMemo(() => {
    if (!active) return { meets: [], almost: [], next: [] };
    const kept = new Set(applyFilters(active, filters).map(r => r.listing && r.listing.id ? r.listing.id : r.listingId));
    const pick = (list) => list.filter(r => kept.has(r.listing && r.listing.id ? r.listing.id : r.listingId));
    return { meets: pick(active.meets || []), almost: pick(active.almost || []), next: pick(active.next_cycle || []) };
  }, [active, filters]);

  function switchTab(t) {
    setTab(t);
    setParams({ tab: t });
    /* the two tabs expose different controls: start the new one clean */
    setFilters(defaultFilters(t));
  }

  async function sendReport() {
    try {
      await api.post('/reports', { listingId: reporting.id, reason });
      toast('Report received');
      setReporting(null);
    } catch (e) { toast(e.message); }
  }

  const Section = ({ title, tone, list, empty }) => {
    if (!list.length) {
      return (
        <section className="col-8">
          <div className="sect-head"><h2 className="h2" style={{ color: 'var(--' + tone + ')' }}>{title} · 0</h2></div>
          <Card><Empty icon="info" title={empty.title} text={empty.body} /></Card>
        </section>
      );
    }
    return (
      <section className="col">
        <div className="sect-head">
          <h2 className="h2" style={{ color: 'var(--' + tone + ')' }}>{title} · {list.length}</h2>
          <span className="cnt">sorted by deadline</span>
        </div>
        <div className="cards-2">
          {list.map(r => <MatchCard key={r.listingId} listing={{ ...r.listing, saved: false }} match={r} showReport onReport={setReporting} />)}
        </div>
      </section>
    );
  };

  if (e1 || e2) {
    const err = e1 || e2;
    return (
      <AppShell page="matches">
        <LoadError error={err} what="matches" onRetry={() => { r1(); r2(); }} />
      </AppShell>
    );
  }
  if (!active && !l1 && !l2) {
    return <AppShell page="matches"><LoadError what="matches" onRetry={() => { r1(); r2(); }} /></AppShell>;
  }

  return (
    <AppShell page="matches">
      <div className="phead">
        <div><h1 className="h1">Matches</h1><p className="cap">Grouped by what the published minimums say about your profile. Meeting them does not guarantee selection.</p></div>
      </div>

      <div className="tabs" role="tablist" aria-label="Listing type">
        <button role="tab" aria-selected={tab === 'scholarships'} onClick={() => switchTab('scholarships')}>
          Scholarships <span className="count">{sch ? '(' + (sch.meets.length + sch.almost.length + sch.next_cycle.length) + ')' : '…'}</span>
        </button>
        <button role="tab" aria-selected={tab === 'programs'} onClick={() => switchTab('programs')}>
          Programs <span className="count">{prog ? '(' + (prog.meets.length + prog.almost.length + prog.next_cycle.length) + ')' : '…'}</span>
        </button>
      </div>

      <MatchFilters tab={tab} active={active} filters={filters} setFilters={setFilters}
        onReset={() => setFilters(defaultFilters(tab))} />

      {active && active.provisional && (
        <Notice tone="warning">
          <b className="w500">Provisional — complete your profile.</b> At {active.profilePct}% we are skipping checks we cannot run yet, so some listings may be missing or marked as gaps. <Link to="/wizard">Finish the five steps</Link> to see the final list.
        </Notice>
      )}

      <div className="with-rail with-rail--left">
        <div className="col with-rail__main">
          {(l1 || l2) && !active ? <Card><Loader /></Card> : (
            <>
              <Section title="Meets published minimums" tone="on-success" list={groups.meets}
                empty={{ title: 'Nothing meets every check yet', body: 'That is normal at the start. Look at the Almost there group below: each card names the single missing item, and most are one test or one certificate away.' }} />
              <Section title="Almost there" tone="on-warning" list={groups.almost}
                empty={{ title: 'No partial matches', body: 'You either meet everything or the listing sits outside your targets. Adjust targets to widen the net.' }} />
              {groups.next.length > 0 && <Section title="Next cycle" tone="on-primary-container" list={groups.next} empty={{}} />}
              {!groups.meets.length && !groups.almost.length && !groups.next.length && (
                <Card>
                  <Empty icon="search" title="No results with these filters" text="Loosen the filter card above — the counts on each option show what is available."
                    action={<Btn variant="tonal" size="sm" onClick={() => setFilters(defaultFilters(tab))}>Reset filters</Btn>} />
                </Card>
              )}
            </>
          )}
        </div>

        <aside className="rail">
          <Card>
            <div className="row sp"><h2 className="h2">Your targets</h2><Link className="link-quiet" to="/wizard?step=4">Edit</Link></div>
            <div className="col-8">
              {((active && active.targets) || []).map((x, i) => (
                <div className="row sp" key={i}>
                  <span className={'chip' + (x.isPrimary ? ' is-on' : '')} style={{ pointerEvents: 'none' }}>{(x.label || '').replace(/^Primary: |^Backup: /, '')}</span>
                  <span className="cap">{x.isPrimary ? 'Primary' : 'Backup'} · {x.intakeYear}</span>
                </div>
              ))}
              {!(active && active.targets && active.targets.length) && <p className="cap">No targets yet.</p>}
            </div>
            <p className="cap">A listing is shown once, matched against all your targets.</p>
          </Card>

          <Card className="card card--tone">
            <span className="h3" style={{ color: 'inherit' }}>How the groups work</span>
            <div className="col-4 cap" style={{ marginTop: 4 }}>
              <span><b className="w500">Meets published minimums</b>: every check we could run passed.</span>
              <span><b className="w500">Almost there</b>: one or more checks need something from you.</span>
              <span><b className="w500">Next cycle</b>: this intake closed, the listing is annual.</span>
            </div>
          </Card>
        </aside>
      </div>

      <Disclaimer />

      <Sheet open={!!reporting} title="Report an error" onClose={() => setReporting(null)}>
        {reporting && <>
          <p className="cap">{reporting.title}</p>
          <div className="field">
            <label htmlFor="rsn">What is wrong?</label>
            <select className="select" id="rsn" value={reason} onChange={e => setReason(e.target.value)}>
              {REASONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <Btn variant="text" onClick={() => setReporting(null)}>Cancel</Btn>
            <Btn variant="filled" onClick={sendReport}>Send report</Btn>
          </div>
        </>}
      </Sheet>
    </AppShell>
  );
}
