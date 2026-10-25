import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminShell } from '../../components/Shell.jsx';
import { Card, Icon, Loader, Empty, Btn, Notice, Field, useAsync, useToast, LoadError, Input, Textarea } from '../../components/ui.jsx';
import { api } from '../../api.js';
import { fmtDate, plural } from '../../lib.jsx';

const SAMPLE = `Deutschlandstipendium - Humboldt-Universit\u00e4t zu Berlin

The application period for the Deutschlandstipendium will run from 9 November to 6 December 2026. Funding will begin on 1 April 2027.

The Deutschlandstipendium supports high-achieving, socially committed students of all nationalities with 300 euros per month. Half of the sum is provided by the Federal Government, the other half by a private sponsor. The funding is granted for at least two semesters and is independent of income.

Students must be enrolled or about to enrol at Humboldt-Universit\u00e4t zu Berlin and still be within the standard period of study. Doctoral candidates and exchange students cannot apply.

How to apply
Open the online application portal during the application period and upload your transcripts, your CV and a short statement on your social engagement. Certificates issued abroad must be submitted with a translation into German or English.

Deadlines
Applications close on 6 December 2026. The portal closes at the end of that day.

Source: Humboldt-Universit\u00e4t zu Berlin, Deutschlandstipendium pages.`;

export default function AiDraft() {
  const [params, setParams] = useSearchParams();
  const id = params.get('id');
  const toast = useToast();
  const [url, setUrl] = useState('https://deutschlandstipendium.hu-berlin.de/en');
  const [snapshot, setSnapshot] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState([]);

  const { data, loading, error, reload } = useAsync(() => (id ? api.get('/admin/listings/' + id) : Promise.resolve({ listing: null })), [id]);
  const listing = data && data.listing;

  async function create() {
    setBusy(true);
    try {
      const r = await api.post('/admin/ai-draft', { url, snapshot });
      toast('Draft created — ' + r.listing.id + '. Nothing is published.');
      setParams({ id: r.listing.id });
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  if (id && loading) return <AdminShell page="admin-ai-draft"><Card><Loader /></Card></AdminShell>;
  if (id && error) return <AdminShell page="admin-ai-draft"><LoadError error={error} onRetry={reload} what="draft" /></AdminShell>;
  if (id && data && !listing) return <AdminShell page="admin-ai-draft"><Card>
    <Empty icon="info" title="Draft not found" text="Open the queue and pick a draft."
      action={<Btn variant="filled" size="sm" to="/admin/queue">Open the queue</Btn>} /></Card></AdminShell>;

  /* ---------------------------------------------------- create-from-URL mode */
  if (!id) {
    return (
      <AdminShell page="admin-ai-draft">
        <div className="row sp wr" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <Btn variant="outlined" size="sm" to="/admin/queue" aria-label="Back" icon="back" />
            <div><h1 className="h1">Draft from a URL</h1><p className="cap">Paste the source page text. Every field is kept only when a sentence in that text supports it.</p></div>
          </div>
          <span className="tag tag--wn">never publishes</span>
        </div>

        <Notice tone="warning"><b className="w500">This endpoint can never publish.</b> It writes a draft with the flag drafted by AI and the evidence sentence for each field. A human accepts the fields, ticks the groups in the form, and a second person publishes.</Notice>

        <div className="split">
          <Card>
            <h2 className="h2">Source page text</h2>
            <p className="cap">Only one page is used: no crawling. Paste what the official page says, verbatim.</p>
            <Field label="Source URL" htmlFor="url"><Input id="url" type="url" value={url} onChange={e => setUrl(e.target.value)} className="input" /></Field>
            <Field label="Page text" htmlFor="snap" help="At least 40 characters. Numbers and dates are read from these sentences.">
              <Textarea id="snap" rows={16} value={snapshot} onChange={e => setSnapshot(e.target.value)} className="input" />
            </Field>
            <div className="row wr" style={{ marginTop: 4 }}>
              <Btn variant="filled" size="sm" onClick={create} disabled={busy} icon="sparkle">{busy ? 'Extracting…' : 'Extract a draft'}</Btn>
              <Btn variant="text" size="sm" onClick={() => setSnapshot(SAMPLE)}>Reset the sample text</Btn>
            </div>
            <p className="cap">The extracted draft appears in the queue as a draft. It cannot set status or who verified it.</p>
          </Card>

          <Card>
            <h2 className="h2">Existing AI drafts</h2>
            <p className="cap">Open one to review the evidence field by field.</p>
            <RecentAiDrafts />
          </Card>
        </div>
      </AdminShell>
    );
  }

  /* ------------------------------------------------------------- review mode */
  const text = listing.sourceSnapshot || '';
  const FIELDS = [
    { key: 'title', label: 'Title', value: listing.title, ev: (listing.evidence || {}).title },
    { key: 'provider', label: 'Provider', value: listing.provider, ev: (listing.evidence || {}).title },
    { key: 'deadline', label: 'Deadline', value: listing.deadline ? fmtDate(listing.deadline) : null, ev: (listing.evidence || {}).deadline },
    { key: 'minCgpa', label: 'Minimum CGPA', value: listing.minCgpa != null ? listing.minCgpa + ' / 4.0' : null, ev: (listing.evidence || {}).cgpa },
    { key: 'minIelts', label: 'Minimum IELTS', value: listing.minIelts, ev: (listing.evidence || {}).ielts },
    { key: 'maxAge', label: 'Maximum age at deadline', value: listing.maxAge, ev: (listing.evidence || {}).age }
  ];
  const withEvidence = FIELDS.filter(f => f.ev && text.includes(f.ev)).length;

  return (
    <AdminShell page="admin-ai-draft">
      <div className="row sp wr" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <Btn variant="outlined" size="sm" to="/admin/queue" aria-label="Back" icon="back" />
          <div><h1 className="h1">AI draft review</h1><p className="cap">{listing.title} · {listing.provider}</p></div>
        </div>
        <div className="row wr" style={{ gap: 6 }}>
          <span className="tag tag--wn">draft</span>
          <span className="tag tag--out">{withEvidence} fields with evidence</span>
        </div>
      </div>

      <Notice tone="warning"><b className="w500">This endpoint can never publish.</b> It writes a draft with <span className="mono">drafted by AI = true</span> and evidence per field. A human must accept the fields, tick the groups in the form, and a second person must publish.</Notice>

      <div className="split">
        <Card>
          <div className="row sp"><h2 className="h2">Source page text</h2><span className="tag tag--out">{withEvidence} sentences matched</span></div>
          <p className="cap">Stored as the source snapshot. Only this page is used: no crawling.</p>
          <div className="src">
            {text
              ? text.split(/(?<=[.!?])\s+/).map((s, i) => {
                  const hit = FIELDS.some(f => f.ev && s.includes(f.ev));
                  return <React.Fragment key={i}>{hit ? <mark>{s}</mark> : s}{' '}</React.Fragment>;
                })
              : <span className="cap">No snapshot stored for this listing. Drafts created through the URL screen store their text here.</span>}
          </div>
        </Card>

        <Card>
          <h2 className="h2">Extracted fields</h2>
          <p className="cap">A value is kept only when its evidence sentence appears word for word in the page text. Otherwise the field is dropped to empty and flagged.</p>
          <div className="col">
            {FIELDS.map((f, i) => {
              const verified = f.ev && text.includes(f.ev);
              const tone = f.value == null ? 'tag--out' : verified ? 'tag--ok' : 'tag--er';
              const word = f.value == null ? 'Empty' : verified ? 'Evidence found' : 'No evidence';
              const isAccepted = accepted.includes(f.key);
              return (
                <Card  key={f.key} style={isAccepted ? { opacity: .72 } : undefined} className="card card--flat">
                  <div className="row sp"><span className="h3">{f.label}</span><span className={'tag ' + tone}>{word}</span></div>
                  <div className="row sp" style={{ gap: 8 }}>
                    <span className="cap">Value</span>
                    <span className="h3" style={{ textAlign: 'right' }}>{f.value == null ? '—' : String(f.value)}</span>
                  </div>
                  {f.ev
                    ? <div className="gapbox gapbox--info" style={{ fontSize: 12 }}>“{f.ev}”</div>
                    : <p className="cap">No sentence on the page supports a value, so the field stays empty.</p>}
                  <div className="row wr" style={{ gap: 6 }}>
                    <button className={'btn btn--sm ' + (isAccepted ? 'btn--outlined' : 'btn--tonal')} type="button" disabled={f.value == null || isAccepted}
                      onClick={() => { setAccepted(a => [...a, f.key]); toast('Accepted. Nothing is published from here.'); }}>
                      {isAccepted ? 'Accepted' : 'Accept'}
                    </button>
                    <Btn variant="text" size="sm" to={'/admin/listings/' + listing.id}>Edit</Btn>
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="row wr" style={{ marginTop: 4 }}>
            <Btn size="sm" onClick={() => { setAccepted([]); toast('Unreviewed fields dropped — the draft stays unpublished'); }}>Drop all unreviewed</Btn>
            <Btn variant="text" size="sm" to={'/admin/listings/' + listing.id}>Open in the form</Btn>
          </div>
          <p className="cap">{accepted.length} field{accepted.length === 1 ? '' : 's'} accepted in this session. Nothing is published from here. Open the form to tick the groups and hand it to a second reviewer.</p>
        </Card>
      </div>
    </AdminShell>
  );
}

function RecentAiDrafts() {
  const { data } = useAsync(() => api.get('/admin/queue'), []);
  const drafts = (data && data.drafts) || [];
  if (!drafts.length) return <p className="cap">No drafts in the queue yet.</p>;
  return (
    <div className="rows">
      {drafts.map(d => (
        <Link className="row sp" key={d.id} to={'/admin/ai-draft?id=' + d.id} style={{ color: 'inherit', textDecoration: 'none', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div className="h3">{d.title}</div>
            <div className="cap">{d.draftedByAi ? 'AI draft' : 'Manual draft'} · {d.createdBy} · {plural(d.age, 'day')} old</div>
          </div>
          <span className="tag tag--out">Review</span>
        </Link>
      ))}
    </div>
  );
}
