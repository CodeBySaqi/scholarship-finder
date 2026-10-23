import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminShell } from '../../components/Shell.jsx';
import { Loader, Btn, useAsync, Empty, LoadError } from '../../components/ui.jsx';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate, plural } from '../../lib.jsx';

export default function AdminListings() {
  const { user } = useAuth();
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const { data, loading, reload, error } = useAsync(() => api.get('/admin/listings'), []);

  const all = (data && data.listings) || [];
  const rows = useMemo(() => all.filter(l => {
    if (kind !== 'all' && l.kind !== kind) return false;
    if (status === 'verified' && l.status !== 'verified') return false;
    if (status === 'draft' && l.status !== 'draft') return false;
    if (status === 'stale' && l.freshness.state !== 'stale') return false;
    if (status === 'recheck' && l.freshness.state !== 'recheck') return false;
    if (user?.role === 'contributor' && l.status === 'draft' && l.createdBy !== user.email) return false;
    if (q && !(l.title + ' ' + (l.provider || '') + ' ' + l.id).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [all, kind, status, q, user]);

  const drafts = all.filter(l => l.status === 'draft').length;
  const scope = user?.role === 'contributor'
    ? 'Contributor view: your own drafts plus every published listing. You cannot verify.'
    : 'Admin view: every listing including drafts and stale records.';

  if (error) return <AdminShell page="admin-listings"><LoadError error={error} onRetry={reload} what="listings" /></AdminShell>;
  return (
    <AdminShell page="admin-listings">
      <div className="phead">
        <div className="row sp wr">
          <div>
            <h1 className="h1">Scholarships and programs</h1>
            <p className="cap">{scope}</p>
          </div>
          <div className="row wr" style={{ gap: 8 }}>
            <Btn variant="outlined" size="sm" to="/admin/queue">Queue <span className="pill-count">{drafts}</span></Btn>
            <Btn variant="filled" size="sm" to="/admin/listings/new">Add a listing</Btn>
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {[['all', 'All'], ['scholarship', 'Scholarships'], ['program', 'Programs']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>{label}</button>
        ))}
      </div>

      <div className="card">
        <div className="row sp wr" style={{ gap: 8 }}>
          <input className="input" type="search" placeholder="Search title, provider or id" style={{ maxWidth: 320 }}
            value={q} onChange={e => setQ(e.target.value)} />
          <div className="chips">
            {[['all', 'All statuses'], ['verified', 'Verified'], ['draft', 'Draft'], ['stale', 'Stale'], ['recheck', 'Needs recheck']].map(([k, label]) => (
              <button key={k} className={'chip chip--sm' + (status === k ? ' is-on' : '')} type="button" aria-pressed={status === k}
                onClick={() => setStatus(k)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>Listing</th><th>Type</th><th>Status</th><th>Last verified</th><th>Deadline</th><th>Created by</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7}><Loader /></td></tr>}
              {!loading && rows.map(l => (
                <tr key={l.id}>
                  <td><div className="t-title">{l.title}</div><div className="cap">{l.provider} · {l.id}{l.draftedByAi ? ' · AI draft' : ''}</div></td>
                  <td>{l.kind === 'scholarship' ? 'Scholarship' : 'Program'}</td>
                  <td>{l.status === 'verified' ? <span className="tag tag--ok">verified</span>
                    : l.status === 'draft' ? <span className="tag tag--wn">draft</span>
                      : l.status === 'stale' ? <span className="tag tag--er">stale</span>
                        : <span className="tag tag--out">{l.status}</span>}</td>
                  <td>{l.freshness.state === 'fresh' ? <span className="cap">{plural(l.freshness.days, 'day')} ago</span>
                    : l.freshness.state === 'ok' ? <span className="cap">{fmtDate(l.lastVerified)}</span>
                      : <span className="tag tag--er">{l.freshness.days} days — recheck</span>}</td>
                  <td>{l.deadline ? fmtDate(l.deadline) : '—'}</td>
                  <td className="cap">{l.createdBy || '—'}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                      <Link className="btn btn--text btn--sm" to={(l.kind === 'scholarship' ? '/scholarship/' : '/program/') + l.id} target="_blank" rel="noopener">View</Link>
                      <Link className="btn btn--outlined btn--sm" to={'/admin/listings/' + l.id}>Edit</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !rows.length && <tr><td colSpan={7}><div className="empty"><p className="cap">No listings match these filters.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
        <p className="cap">{rows.length} of {all.length} listings. Publish is always blocked on your own records — open one and use the publish gate.</p>
      </div>
    </AdminShell>
  );
}
