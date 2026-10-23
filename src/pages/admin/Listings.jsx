import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminShell } from '../../components/Shell.jsx';
import { Icon, Loader, Btn, useAsync, Empty, LoadError, Notice, useToast } from '../../components/ui.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate, plural, fundingLabel } from '../../lib.jsx';

const or = (v) => (v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? (v.length ? v.join(', ') : '—') : String(v));

export default function AdminListings() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState(params.get('q') || '');
  const [viewId, setViewId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, reload, error } = useAsync(() => api.get('/admin/listings'), []);
  const detail = useAsync(() => (viewId ? api.get('/admin/listings/' + viewId) : Promise.resolve(null)), [viewId]);

  /* the header search lands here as ?q= — keep the box in sync */
  useEffect(() => { setQ(params.get('q') || ''); }, [params]);

  async function remove(l) {
    setBusy(true);
    try {
      await api.del('/admin/listings/' + l.id);
      toast(l.id + ' deleted');
      setConfirmDelete(null);
      setViewId(null);
      reload();
    } catch (e) { toast(e.message); }
    finally { setBusy(false); }
  }

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
          <table className="table table--stack">
            <thead><tr>
              <th>Listing</th><th>Type</th><th>Status</th><th>Last verified</th><th>Deadline</th><th>Created by</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7}><Loader /></td></tr>}
              {!loading && rows.map(l => (
                <tr key={l.id}>
                  <td data-label="Listing"><div className="t-title">{l.title}</div><div className="cap">{l.provider} · {l.id}{l.draftedByAi ? ' · AI draft' : ''}</div></td>
                  <td data-label="Type">{l.kind === 'scholarship' ? 'Scholarship' : 'Program'}</td>
                  <td data-label="Status">{l.status === 'verified' ? <span className="tag tag--ok">verified</span>
                    : l.status === 'draft' ? <span className="tag tag--wn">draft</span>
                      : l.status === 'stale' ? <span className="tag tag--er">stale</span>
                        : <span className="tag tag--out">{l.status}</span>}</td>
                  <td data-label="Last verified">{l.freshness.state === 'fresh' ? <span className="cap">{plural(l.freshness.days, 'day')} ago</span>
                    : l.freshness.state === 'ok' ? <span className="cap">{fmtDate(l.lastVerified)}</span>
                      : <span className="tag tag--er">{l.freshness.days} days — recheck</span>}</td>
                  <td data-label="Deadline">{l.deadline ? fmtDate(l.deadline) : '—'}</td>
                  <td data-label="Created by" className="cap">{l.createdBy || '—'}</td>
                  <td data-label="Actions">
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
                      <button className="iconbtn" type="button" aria-label={'View all details for ' + l.id} title="View details"
                        onClick={() => setViewId(l.id)}><Icon name="eye" /></button>
                      <Link className="iconbtn" to={'/admin/listings/' + l.id} aria-label={'Edit ' + l.id} title="Edit"><Icon name="edit" /></Link>
                      <Link className="iconbtn" to={(l.kind === 'scholarship' ? '/scholarship/' : '/program/') + l.id} target="_blank" rel="noopener"
                        aria-label={'Open the public page for ' + l.id} title="Open public page"><Icon name="external" /></Link>
                      {user?.role === 'admin' && (
                        <button className="iconbtn" type="button" aria-label={'Delete ' + l.id} title="Delete listing"
                          style={{ color: 'var(--on-danger)' }} onClick={() => setConfirmDelete(l)}><Icon name="trash" /></button>
                      )}
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

      {/* --------------------------------------------------------- details */}
      <Sheet open={!!viewId} title="Listing details" onClose={() => setViewId(null)}
        footer={<div className="row sp wr" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn btn--text btn--sm" type="button" onClick={() => setViewId(null)}>Close</button>
          <div className="row" style={{ gap: 8 }}>
            <Link className="btn btn--outlined btn--sm" to={'/admin/listings/' + viewId}>Edit</Link>
            <Link className="btn btn--text btn--sm" to={(detail.data && detail.data.listing.kind === 'program' ? '/program/' : '/scholarship/') + viewId} target="_blank" rel="noopener">Public page</Link>
          </div>
        </div>}>
        {detail.loading && !detail.data ? <Loader /> : !detail.data ? <p className="cap">Details could not load.</p> : (() => {
          const l = detail.data.listing;
          const rows2 = [
            ['Id', l.id], ['Type', l.kind], ['Status', l.status], ['Provider', l.provider],
            ['Degree levels', l.degreeLevels], ['Funding', l.fundingType || fundingLabel(l)],
            ['Deadline', l.deadline ? fmtDate(l.deadline) : 'not stated'], ['Opens', l.opensDate ? fmtDate(l.opensDate) : '—'],
            ['Min CGPA', l.minCgpa], ['Min IELTS', l.minIelts], ['IELTS required', l.ieltsRequired === undefined ? null : (l.ieltsRequired ? 'Yes' : 'No')],
            ['Max age', l.maxAge], ['Allowed countries', l.allowedCountries], ['German level', l.minGermanLevel],
            ['APS required', l.apsRequired === undefined ? null : (l.apsRequired ? 'Yes' : 'No')],
            ['Tuition / semester', l.tuitionPerSemester], ['Semester fee', l.semesterFee], ['Language', l.languageMode],
            ['Field', l.fieldCategory], ['Last verified', l.lastVerified ? fmtDate(l.lastVerified) : '—'],
            ['Created by', l.createdBy], ['Verified by', l.verifiedBy], ['AI draft', l.draftedByAi ? 'Yes' : 'No'],
            ['Open reports', l.openErrorReports || 0],
            ['Official page', l.officialUrl], ['Apply page', l.applyUrl], ['Source', l.sourceUrl]
          ];
          return (
            <div className="col" style={{ gap: 12 }}>
              <div>
                <div className="h2">{l.title}</div>
                <div className="cap">{l.provider} · {l.id}</div>
              </div>
              <div className="table-wrap">
                <table className="kv"><tbody>
                  {rows2.map(([k, v]) => <tr key={k}><th>{k}</th><td className={/^https?:/.test(String(v)) ? 'mono' : ''}>{String(v) === 'null' ? '—' : or(v)}</td></tr>)}
                </tbody></table>
              </div>
              {l.description && <div><div className="h3">Description</div><p className="cap">{l.description}</p></div>}
              {l.coverage && l.coverage.length > 0 && <div><div className="h3">Coverage</div><ul className="cap">{l.coverage.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
              {l.documents && l.documents.length > 0 && <div><div className="h3">Documents</div><ul className="cap">{l.documents.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
            </div>
          );
        })()}
      </Sheet>

      {/* ---------------------------------------------------------- delete */}
      <Sheet open={!!confirmDelete} title="Delete this listing?" onClose={() => setConfirmDelete(null)}
        footer={<div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn btn--text" type="button" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="btn btn--danger" type="button" disabled={busy} onClick={() => remove(confirmDelete)}>{busy ? 'Deleting…' : 'Delete permanently'}</button>
        </div>}>
        {confirmDelete && (
          <div className="col" style={{ gap: 10 }}>
            <Notice tone="danger" icon="alert">
              <b>{confirmDelete.title}</b> ({confirmDelete.id}) is removed from the catalogue, from every student's saved
              list and from the error reports that mention it. This cannot be undone.
            </Notice>
            <p className="cap">Set the status back to draft instead if the listing is only out of date — that keeps its history and takes it out of the student app.</p>
          </div>
        )}
      </Sheet>
    </AdminShell>
  );
}
