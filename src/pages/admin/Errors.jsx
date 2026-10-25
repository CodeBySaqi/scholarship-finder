import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminShell } from '../../components/Shell.jsx';
import { Card, Loader, Btn, useAsync, useToast, LoadError } from '../../components/ui.jsx';
import { api } from '../../api.js';
import { fmtDate, daysTo } from '../../lib.jsx';

const REASON = { wrong_deadline: 'Wrong deadline', wrong_requirement: 'Wrong requirement', broken_link: 'Broken link', other: 'Something else' };

export default function AdminErrors() {
  const [filter, setFilter] = useState('open');
  const toast = useToast();
  const { data, loading, reload, error } = useAsync(() => api.get('/admin/errors'), []);
  const all = (data && data.reports) || [];
  const rows = useMemo(() => all.filter(r => filter === 'all' || r.status === filter), [all, filter]);

  async function act(id, what) {
    try {
      await api.post('/admin/errors/' + id + '/' + what, {});
      toast(what === 'resolve' ? 'Marked fixed' : 'Report dismissed');
      reload();
    } catch (e) { toast(e.message); }
  }

  if (error) return <AdminShell page="admin-errors"><LoadError error={error} onRetry={reload} what="error reports" /></AdminShell>;
  return (
    <AdminShell page="admin-errors">
      <div className="phead">
        <div className="row sp wr">
          <div>
            <h1 className="h1">Error reports</h1>
            <p className="cap">Two open reports on one listing add a “Needs recheck” tag for every student.</p>
          </div>
          <div className="chips">
            {[['open', 'Open'], ['fixed', 'Fixed'], ['dismissed', 'Dismissed'], ['all', 'All']].map(([k, label]) => (
              <button key={k} className={'chip chip--sm' + (filter === k ? ' is-on' : '')} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <Card>
        <div className="table-wrap">
          <table className="table table--stack">
            <thead><tr><th>Listing</th><th>Reason</th><th>Note</th><th>Reporter</th><th>Age</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7}><Loader /></td></tr>}
              {!loading && rows.map(r => (
                <tr key={r.id}>
                  <td data-label="Listing"><div className="t-title">{r.listingTitle}</div><div className="cap">{r.listingType} · {r.listingId}</div></td>
                  <td data-label="Reason"><span className="tag tag--wn">{REASON[r.reason] || r.reason}</span></td>
                  <td data-label="Note" className="cap" style={{ maxWidth: 260 }}>{r.note || '—'}</td>
                  <td data-label="Reporter" className="cap">{r.userId || 'anonymous'}</td>
                  <td data-label="Age" className="cap">{Math.max(0, -daysTo(String(r.createdAt).slice(0, 10)))} days</td>
                  <td data-label="Status">{r.status === 'open' ? <span className="tag tag--er">open</span>
                    : r.status === 'fixed' ? <span className="tag tag--ok">fixed</span>
                    : <span className="tag tag--out">dismissed</span>}</td>
                  <td data-label="Actions">
                    <div className="row wr" style={{ justifyContent: 'flex-end', gap: 4 }}>
                      <Btn variant="text" size="sm" to={(r.listingType === 'program' ? '/program/' : '/scholarship/') + r.listingId}>View</Btn>
                      {r.status === 'open' && <>
                        <Btn size="sm" onClick={() => act(r.id, 'resolve')}>Mark fixed</Btn>
                        <Btn variant="text" size="sm" onClick={() => act(r.id, 'dismiss')}>Dismiss</Btn>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !rows.length && <tr><td colSpan={7}><div className="empty"><p className="cap">No reports with this status.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
        <p className="cap">Reports arrive from the “Report an error” button on every saved or matched listing.</p>
      </Card>
    </AdminShell>
  );
}
