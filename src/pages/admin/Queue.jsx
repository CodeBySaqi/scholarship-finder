import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminShell } from '../../components/Shell.jsx';
import { Icon, Loader, Empty, Notice, Btn, useAsync, useToast, LoadError } from '../../components/ui.jsx';
import { api } from '../../api.js';
import { fmtDate, plural } from '../../lib.jsx';

export default function AdminQueue() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'verify');
  const toast = useToast();
  const { data, loading, reload, error } = useAsync(() => api.get('/admin/queue'), []);

  async function markVerified(id) {
    try { await api.post('/admin/listings/' + id + '/mark-verified', {}); toast('Marked verified today'); reload(); }
    catch (e) { toast(e.message); }
  }
  async function runJob() {
    try { const r = await api.post('/admin/run-stale-job', {}); toast(r.moved + ' listing(s) returned to draft'); reload(); }
    catch (e) { toast(e.message); }
  }

  if (loading) return <AdminShell page="admin-queue"><div className="card"><Loader /></div></AdminShell>;
  const q = data || { drafts: [], recheck: [], stale: [], errors: [] };
  const staleRows = q.recheck.concat(q.stale).sort((a, b) => b.age - a.age);

  const Row = ({ title, sub, right }) => (
    <div className="row sp wr" style={{ gap: 10 }}>
      <div style={{ minWidth: 0 }}><div className="h3">{title}</div><div className="cap">{sub}</div></div>
      <div className="row wr" style={{ gap: 6 }}>{right}</div>
    </div>
  );

  if (error) return <AdminShell page="admin-queue"><LoadError error={error} onRetry={reload} what="queue" /></AdminShell>;
  return (
    <AdminShell page="admin-queue">
      <div className="phead">
        <div><h1 className="h1">Queue</h1><p className="cap">Three work lists, oldest first. Each row opens the record that needs a decision.</p></div>
        <Btn variant="outlined" size="sm" onClick={runJob} icon="refresh">Run the stale job</Btn>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'verify'} onClick={() => setTab('verify')}>Awaiting verification <span className="count">({q.drafts.length})</span></button>
        <button role="tab" aria-selected={tab === 'errors'} onClick={() => setTab('errors')}>Error reports <span className="count">({q.errors.length})</span></button>
        <button role="tab" aria-selected={tab === 'stale'} onClick={() => setTab('stale')}>Stale 90+ days <span className="count">({staleRows.length})</span></button>
      </div>

      <div className="col">
        {tab === 'verify' && (q.drafts.length ? (
          <div className="card"><div className="rows">
            {q.drafts.map(l => (
              <Row key={l.id} title={l.title}
                sub={'Created by ' + (l.createdBy || 'unknown') + ' · ' + l.kind + ' · drafted ' + plural(l.age, 'day') + ' ago'}
                right={<>
                  {l.draftedByAi && <span className="tag tag--wn"><Icon name="sparkle" />AI draft</span>}
                  <span className="tag tag--out">{l.createdBy || 'unknown'}</span>
                  <Btn variant="outlined" size="sm" to={'/admin/listings/' + l.id}>Review</Btn>
                  {l.draftedByAi && <Btn variant="text" size="sm" to={'/admin/ai-draft?id=' + l.id}>AI evidence</Btn>}
                </>} />
            ))}
          </div></div>
        ) : <div className="card"><Empty icon="checkCircle" title="Nothing awaiting verification" text="New drafts from the AI endpoint or from contributors land here first." /></div>)}

        {tab === 'errors' && (q.errors.length ? (
          <div className="card"><div className="rows">
            {q.errors.map(r => (
              <Row key={r.id} title={r.listingTitle}
                sub={'“' + (r.note || r.reason) + '” · ' + (r.userId || 'anonymous') + ' · ' + r.reason}
                right={<><span className="tag tag--wn">{r.reason}</span><Btn variant="outlined" size="sm" to="/admin/errors">Open</Btn></>} />
            ))}
          </div></div>
        ) : <div className="card"><Empty icon="checkCircle" title="No open error reports" text="Reports arrive from the “Report an error” button on every listing." /></div>)}

        {tab === 'stale' && (
          <>
            <Notice tone="info"><b className="w500">Two thresholds.</b> At 90 days a listing shows “Needs recheck”. At 180 days the nightly job sets it back to draft and logs the change, so it leaves student results until someone verifies it again.</Notice>
            {staleRows.length ? (
              <div className="card"><div className="rows">
                {staleRows.map(l => (
                  <Row key={l.id} title={l.title} sub={'Last verified ' + plural(l.age, 'day') + ' ago · status ' + (l.status || 'verified')}
                    right={<>
                      <span className={'tag ' + (l.age >= 180 ? 'tag--er' : 'tag--wn')}>{l.age} days</span>
                      <Btn variant="outlined" size="sm" to={'/admin/listings/' + l.id}>Recheck</Btn>
                      <Btn variant="text" size="sm" onClick={() => markVerified(l.id)}>Mark verified</Btn>
                    </>} />
                ))}
              </div></div>
            ) : <div className="card"><Empty icon="checkCircle" title="Nothing older than 90 days" text="Every live listing has been checked recently." /></div>}
          </>
        )}
      </div>
    </AdminShell>
  );
}
