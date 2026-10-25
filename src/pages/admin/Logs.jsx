import React, { useMemo, useState } from 'react';
import { AdminShell } from '../../components/Shell.jsx';
import { Card, Loader, useAsync, LoadError } from '../../components/ui.jsx';
import { api } from '../../api.js';
import { fmtDate } from '../../lib.jsx';

export default function AdminLogs() {
  const [filter, setFilter] = useState('all');
  const { data, loading, reload, error } = useAsync(() => api.get('/admin/logs'), []);
  const logs = (data && data.logs) || [];
  const actions = useMemo(() => ['all', ...Array.from(new Set(logs.map(l => l.action)))], [logs]);
  const rows = logs.filter(l => filter === 'all' || l.action === filter);

  if (error) return <AdminShell page="admin-logs"><LoadError error={error} onRetry={reload} what="audit log" /></AdminShell>;
  return (
    <AdminShell page="admin-logs">
      <div className="phead">
        <div><h1 className="h1">Audit log</h1><p className="cap">Append-only. The store rejects updates and deletes on these entries, so history cannot be rewritten.</p></div>
      </div>

      <Card>
        <div className="chips">
          {actions.map(a => (
            <button key={a} className={'chip chip--sm' + (filter === a ? ' is-on' : '')} type="button" aria-pressed={filter === a}
              onClick={() => setFilter(a)}>{a === 'all' ? 'All actions' : a.replace(/_/g, ' ')}</button>
          ))}
        </div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="table table--stack">
            <thead><tr><th>Action</th><th>Entity</th><th>Record</th><th>Actor</th><th>When</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5}><Loader /></td></tr>}
              {rows.map(l => (
                <tr key={l.id}>
                  <td data-label="Action"><span className="tag tag--out">{l.action.replace(/_/g, ' ')}</span></td>
                  <td data-label="Entity" className="cap">{l.entityType}</td>
                  <td data-label="Record">{l.entityId}</td>
                  <td data-label="Actor" className="cap">{l.adminId}</td>
                  <td data-label="When" className="cap">{fmtDate(String(l.createdAt).slice(0, 10))}</td>
                </tr>
              ))}
              {!loading && !rows.length && <tr><td colSpan={5}><div className="empty"><p className="cap">No entries for this action yet.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
