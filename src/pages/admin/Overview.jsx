import React from 'react';
import { Link } from 'react-router-dom';
import { AdminShell } from '../../components/Shell.jsx';
import { Card, Icon, StatCard, Donut, Loader, Btn, Notice, useAsync, LoadError } from '../../components/ui.jsx';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate, plural } from '../../lib.jsx';

export default function AdminOverview() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.get('/admin/overview'), []);

  return (
    <AdminShell page="admin">
      <div>
        {user?.role === 'contributor' && (
          <Notice tone="warning"><b className="w500">Contributor view.</b> You can create and edit drafts, but you cannot set a listing to verified. The publish button will refuse.</Notice>
        )}
      </div>

      <div className="phead">
        <div>
          <h1 className="h1">Overview</h1>
          <p className="cap">Nothing invented is published: a human reviewer enters real data through the form, and a second person publishes it.</p>
        </div>
        <div className="row wr" style={{ gap: 8 }}>
          <Btn variant="outlined" size="sm" to="/admin/ai-draft" icon="sparkle">Draft from a URL</Btn>
          <Btn variant="filled" size="sm" to="/admin/listings/new">Add a listing</Btn>
        </div>
      </div>

      {loading ? <Card><Loader /></Card>
        : (!data || !data.counts) ? <LoadError error={error} onRetry={reload} what="overview" />
        : (
        <>
          <div className="statgrid">
            <StatCard label="Awaiting verification" value={data.counts.drafts} sub="drafts, oldest first" icon="clock" tone="tone-amber" to="/admin/queue" />
            <StatCard label="Open error reports" value={data.counts.openReports} sub="reported by students" icon="flag" tone="tone-red" to="/admin/errors" />
            <StatCard label="Needs recheck" value={data.counts.recheck} sub="not checked in 90+ days" icon="refresh" tone="tone-blue" to="/admin/queue?tab=stale" />
            <StatCard label="Stale past 180 days" value={data.counts.stale} sub="returns to draft nightly" icon="alert" tone="tone-purple" to="/admin/queue?tab=stale" />
          </div>

          <Card>
            <div className="chart-head">
              <div><div className="h2">Verification health</div>
                <p className="cap">How much of the directory a human has checked recently</p></div>
              <span className={'tag ' + (data.counts.fresh / Math.max(data.counts.listings, 1) >= .8 ? 'tag--ok' : 'tag--wn')}>
                {Math.round(data.counts.fresh / Math.max(data.counts.listings, 1) * 100)}% fresh
              </span>
            </div>
            <Donut segments={[
              { label: 'Fresh (under 90 days)', value: data.counts.fresh, color: 'var(--c4)' },
              { label: 'Needs recheck', value: data.counts.recheck, color: 'var(--c5)' },
              { label: 'Stale (180+ days)', value: data.counts.stale, color: 'var(--c1)' },
              { label: 'Drafts', value: data.counts.drafts, color: 'var(--c6)' }
            ]} centerValue={data.counts.listings} centerLabel="listings" />
          </Card>

          <div className="dash-grid">
            <div className="dash-main">
              <Card>
                <div className="row sp"><h2 className="h2">Queue</h2><Link className="link-quiet" to="/admin/queue">Open the queue</Link></div>
                <div className="rows">
                  {data.queue.map(l => (
                    <Link className="row sp" key={l.id} to={'/admin/listings/' + l.id} style={{ color: 'inherit', textDecoration: 'none', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="h3">{l.title}</div>
                        <div className="cap">{l.status === 'draft' ? 'Draft' : 'Verified ' + plural(l.age, 'day') + ' ago'} · created by {l.createdBy || 'unknown'}</div>
                      </div>
                      <span className={'tag ' + (l.status === 'draft' ? 'tag--wn' : 'tag--er')}>{l.status === 'draft' ? 'Verify' : 'Stale'}</span>
                    </Link>
                  ))}
                  {!data.queue.length && <p className="cap">Nothing in the queue.</p>}
                </div>
              </Card>

              <Card>
                <div className="row sp"><h2 className="h2">Data quality</h2><Link className="link-quiet" to="/admin/listings">All listings</Link></div>
                <div className="rows">
                  {data.quality.map(r => (
                    <div className="row sp" key={r.key}><span className="cap" style={{ flex: 1 }}>{r.key}</span><span className="tag tag--out">{r.value}</span></div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="dash-side">
              <Card>
                <div className="row sp"><h2 className="h2">Recent activity</h2><Link className="link-quiet" to="/admin/logs">Full log</Link></div>
                <div className="rows">
                  {data.activity.map(a => (
                    <div className="row-top" style={{ gap: 10 }} key={a.id}>
                      <span className="tag tag--out" style={{ flex: 'none' }}>{a.action.replace(/_/g, ' ')}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.entityId || a.entityType}</div>
                        <div className="cap">{a.adminId} · {fmtDate(String(a.createdAt).slice(0, 10))}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="cap">The audit log is append-only: the store rejects updates and deletes.</p>
              </Card>

              <Card className="card card--tone">
                <h2 className="h2" style={{ color: 'inherit' }}>Rules baked into the admin</h2>
                <div className="col-8" style={{ color: 'inherit', fontSize: 13 }}>
                  <span><b className="w500">Four eyes.</b> A listing can only be published by someone other than its creator.</span>
                  <span><b className="w500">No AI publishing.</b> The AI draft endpoint can create drafts only; it cannot set status or who verified it.</span>
                  <span><b className="w500">Evidence per field.</b> Every extracted eligibility value stores the sentence it came from.</span>
                  <span><b className="w500">Stale to draft.</b> The nightly job returns listings unverified for 180+ days to draft.</span>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
