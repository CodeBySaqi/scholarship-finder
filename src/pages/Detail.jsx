import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/Shell.jsx';
import { Icon, Loader, Empty, Btn, useAsync, useToast, Field, Notice, LoadError } from '../components/ui.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { SaveButton, GapBox, fmtReason } from '../components/cards.jsx';
import { EligibilityPanel } from '../components/PathFields.jsx';
import { api } from '../api.js';
import { COPY, fmtDate, daysTo, plural, fundingLabel, FreshnessTag, BucketTag, freshness } from '../lib.jsx';
import { useAuth } from '../auth.jsx';

const GRADES = { bachelor: 'Bachelor', master: 'Master', phd: 'PhD' };
const REASONS = ['Deadline is wrong', 'Requirements changed', 'The link does not work', 'This listing has closed', 'Something else'];

function ReportSheet({ listing, open, onClose, onDone }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit() {
    setBusy(true); setErr('');
    try {
      await api.post('/reports', { listingId: listing.id, reason, note });
      onDone && onDone();
      onClose();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <Sheet open={open} title="Report an error" onClose={onClose}>
      <p className="cap">Two open reports add a recheck tag to this listing for everyone.</p>
      <div className="field">
        <label htmlFor="reason">What is wrong?</label>
        <select className="select" id="reason" value={reason} onChange={e => setReason(e.target.value)}>
          {REASONS.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>
      <Field label="Anything else? (optional)" htmlFor="note">
        <textarea className="input" id="note" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="A line about what you saw on the official page" />
      </Field>
      {err && <p className="err"><Icon name="alert" size={13} />{err}</p>}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn btn--text" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn--filled" type="button" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
      </div>
    </Sheet>
  );
}

export default function Detail({ kind }) {
  const { id } = useParams();
  /* the eligibility verdict for this listing, from the saved profile */
  const verdicts = useAsync(() => api.get('/path/verdicts?kind=' + kind), [kind]);
  const verdict = useMemo(() => {
    const map = (verdicts.data && verdicts.data.byListing) || {};
    return map[id] || null;
  }, [verdicts.data, id]);
  const { user } = useAuth();
  const toast = useToast();
  const [report, setReport] = useState(false);
  const { data, loading, error, reload } = useAsync(() => Promise.all([
    api.get('/listings/' + id),
    api.get('/listings?kind=' + kind)
  ]).then(([one, list]) => ({ listing: one.listing, all: list.listings })), [id]);

  if (loading) return <AppShell page="browse"><div className="card"><Loader /></div></AppShell>;
  if (error) return <AppShell page="browse"><LoadError error={error} onRetry={reload} what="listing" /></AppShell>;
  if (!data || !data.listing) {
    return (
      <AppShell page="browse">
        <div className="card">
          <Empty icon="info" title="This listing is not available" text="It may have been returned to draft for rechecking, or the link is wrong."
            action={<Btn variant="filled" size="sm" to={kind === 'scholarship' ? '/scholarships' : '/programs'}>Browse {kind}s</Btn>} />
        </div>
      </AppShell>
    );
  }

  const l = data.listing;
  const match = l.match;
  const days = l.deadline ? daysTo(l.deadline) : null;
  const cov = (l.coverage || []);
  const isBachelorProgram = kind === 'program' && (l.degreeLevels || []).includes('bachelor');
  const similar = data.all.filter(x => x.id !== l.id && (x.degreeLevels || []).some(d => (l.degreeLevels || []).includes(d))).slice(0, 3);

  const requirementRows = (match && match.reasons) || [];

  const railFacts = (
    <>
      <div className="card">
        <div className="row sp"><h2 className="h2">Key facts</h2><FreshnessTag iso={l.lastVerified} freshness={l.freshness} /></div>
        <table className="kv">
          <tbody>
            <tr><th>Deadline</th><td>{fmtDate(l.deadline)}{days != null && days >= 0 ? <><br /><span className="cap">in {plural(days, 'day')}</span></> : null}</td></tr>
            {l.opensDate && <tr><th>Opens</th><td>{fmtDate(l.opensDate)}</td></tr>}
            <tr><th>Level</th><td>{(l.degreeLevels || []).map(d => GRADES[d]).join(' / ')}</td></tr>
            <tr><th>{kind === 'scholarship' ? 'Funding' : 'Tuition'}</th><td>{fundingLabel(l)}</td></tr>
            {kind === 'program' && <tr><th>Language</th><td>{l.languageMode === 'english' ? 'English' : l.languageMode === 'german' ? 'German' : 'Mixed'}</td></tr>}
            {kind === 'program' && <tr><th>Semester fee</th><td>{l.semesterFee ? l.semesterFee + ' EUR' : 'Not stated'}</td></tr>}
            {l.universityName && <tr><th>University</th><td>{l.universityName}</td></tr>}
            {l.applyRoute && <tr><th>Apply via</th><td>{l.applyRoute === 'uni_assist' ? 'uni-assist' : 'University portal'}</td></tr>}
            <tr><th>Annual</th><td>{l.isAnnual ? 'Yes, repeats each intake' : 'One-off'}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2 className="h2">Need to prepare</h2>
        <div className="col-8">
          {(l.documents || []).map(d => (
            <div className="row" style={{ gap: 8 }} key={d}><Icon name="file" size={16} style={{ color: 'var(--text-2)' }} /><span style={{ fontSize: 13 }}>{d}</span></div>
          ))}
        </div>
      </div>
      <div className="card">
        <h2 className="h2">Source</h2>
        <p className="cap">Last verified {fmtDate(l.lastVerified)} against the official requirements page.</p>
        <a className="btn btn--outlined btn--sm btn--block" href={l.sourceUrl || l.officialUrl} target="_blank" rel="noopener"><Icon name="external" />Open source page</a>
        <p className="cap">Problems with this listing? Use “Report an error”. Two open reports add a recheck tag for everyone.</p>
      </div>
    </>
  );

  return (
    <AppShell page="browse">
      <div className="row wr" style={{ gap: 6 }}>
        {match ? <BucketTag bucket={match.bucket} provisional={match.provisional} /> : null}
        <span className={'tag ' + (l.fundingType === 'full' ? 'tag--pr' : 'tag--out')}>{fundingLabel(l)}</span>
        <span className="tag tag--out">{kind === 'scholarship' ? 'Scholarship' : 'Program'}</span>
        {l.draftedByAi && <span className="tag tag--wn"><Icon name="sparkle" />AI draft</span>}
        {l.status === 'draft' && <span className="tag tag--er">Draft - not published</span>}
      </div>

      <div className="page-head">
        <h1 className="h1" style={{ fontSize: 26 }}>{l.title}</h1>
        <p className="cap">{l.provider} · {l.hostCountry}{l.universityCity ? ' · ' + l.universityCity : ''}</p>
      </div>

      {verdict && (
        <div className="detail-eligibility">
          <EligibilityPanel result={verdict} kind={kind === 'scholarship' ? 'scholarship' : 'programme'} />
        </div>
      )}

      <div className="detail-grid">
        <div className="col">
          <div className="g2">
            <div className="card card--tone">
              <span className="cap" style={{ color: 'inherit' }}>Deadline</span>
              <span className="h2" style={{ color: 'inherit' }}>{fmtDate(l.deadline)}</span>
              <span className="cap" style={{ color: 'inherit' }}>{days == null ? 'No deadline stated' : days < 0 ? 'Closed for this intake' : 'in ' + plural(days, 'day')}</span>
            </div>
            <div className="card">
              <span className="cap">{kind === 'scholarship' ? 'Covers' : 'Costs'}</span>
              <span className="h2">{cov[0] || 'Not stated'}</span>
              <span className="cap">{cov.slice(1).join(', ') || (l.semesterFee ? 'Semester fee ' + l.semesterFee + ' EUR' : '')}</span>
            </div>
          </div>

          <div className="card">
            <h2 className="h2">About</h2>
            <p className="body">{l.description}</p>
            <div className="row wr" style={{ gap: 6, marginTop: 2 }}>
              <span className="tag tag--out"><Icon name="globe" />{l.hostCountry}</span>
              <span className="tag tag--out"><Icon name="school" />{(l.degreeLevels || []).map(d => GRADES[d]).join(' / ')}</span>
              <span className="tag tag--out"><Icon name="clock" />{l.isAnnual ? 'Annual intake' : 'One-off intake'}</span>
            </div>
          </div>

          {!user && (
            <div className="card card--tone">
              <h2 className="h2" style={{ color: 'inherit' }}>See your own fit</h2>
              <p className="cap">Create a profile and this block becomes a table of every requirement, your value and the result.</p>
              <div className="row wr"><Btn variant="filled" size="sm" to="/signup">Create profile</Btn><Btn variant="outlined" size="sm" to="/login">Log in</Btn></div>
            </div>
          )}

          {user && match && (
            <div className="card">
              <div className="row sp wr">
                <h2 className="h2">Your match</h2>
                <div className="row wr" style={{ gap: 6 }}>
                  <BucketTag bucket={match.bucket} provisional={match.provisional} />
                  {(match.matchedTargets || []).map(t => <span className="tag tag--pr" key={t}>{t}</span>)}
                  {match.provisional && <span className="tag tag--out">{COPY.provisional}</span>}
                </div>
              </div>
              <table className="kv"><tbody>
                {requirementRows.map((r, i) => {
                  const tone = r.status === 'pass' ? 'tag--ok' : r.status === 'gap' ? 'tag--wn' : r.status === 'fail' ? 'tag--er' : 'tag--out';
                  const word = r.status === 'pass' ? 'Pass' : r.status === 'gap' ? 'To do' : r.status === 'fail' ? 'Not met' : 'Info';
                  return (
                    <tr key={i}>
                      <th>{r.check}<br /><span className="cap">required: {r.required}</span></th>
                      <td>{r.yours} <span className={'tag ' + tone}>{word}</span></td>
                    </tr>
                  );
                })}
              </tbody></table>
              <GapBox gaps={match.gaps} />
              {match.bucket === 'meets' && <p className="cap">{COPY.meetsLine}</p>}
              {match.bucket === 'next_cycle' && <p className="cap">This intake has closed. The listing is annual, so it returns in the next cycle - we will keep it in your list.</p>}
            </div>
          )}

          {isBachelorProgram && (
            <div className="card card--warning">
              <div className="row" style={{ gap: 8 }}><Icon name="info" /><h2 className="h2" style={{ color: 'inherit' }}>Pakistani applicants</h2></div>
              <p style={{ color: 'inherit', fontSize: 13 }}>
                HSSC alone is usually {l.hsscEntryRoute === 'direct' ? 'accepted for this program, but confirm the subject group.'
                  : l.hsscEntryRoute === 'studienkolleg_required' ? 'not enough: a one-year Studienkolleg (with an entrance exam) comes first.'
                    : l.hsscEntryRoute === 'one_year_university_required' ? 'not enough: one year of university study in Pakistan is required first.'
                      : 'not enough, and the entry route is not confirmed on the official page yet.'}
              </p>
              {l.hsscGroups && <p style={{ color: 'inherit', fontSize: 13 }}>Accepted HSSC groups: <b className="w500">{l.hsscGroups.join(', ').replace(/_/g, ' ')}</b>.</p>}
            </div>
          )}

          <div className="card">
            <h2 className="h2">How to apply</h2>
            <ol className="steps">{(l.applySteps || []).map(s => <li key={s}><span>{s}</span></li>)}</ol>
          </div>

          <div className="card">
            <h2 className="h2">Before you apply</h2>
            <div className="rows">
              <div className="row sp"><div><div className="h3">APS certificate</div><div className="cap">Required for Pakistani applicants in most cases</div></div>
                <span className={'tag ' + (l.apsRequired === 'yes' ? 'tag--wn' : 'tag--out')}>{l.apsRequired === 'yes' ? 'Required' : l.apsRequired === 'no' ? 'Not required' : 'Confirm'}</span></div>
              <div className="row sp"><div><div className="h3">IBCC equivalence</div><div className="cap">Needed for HSSC holders before the bachelor route</div></div>
                <span className="tag tag--out">Check yours</span></div>
              <div className="row sp"><div><div className="h3">HEC attestation</div><div className="cap">Needed when you apply with a Pakistani bachelor degree</div></div>
                <span className="tag tag--out">Check yours</span></div>
              <div className="row sp"><div><div className="h3">Blocked account</div><div className="cap">Usually requested for the visa, not the application</div></div>
                <span className="tag tag--out">After admission</span></div>
              <div className="row sp"><div><div className="h3">Passport</div><div className="cap">Valid for at least the length of the program</div></div>
                <span className="tag tag--out">Check expiry</span></div>
            </div>
          </div>

          <div className="card">
            <div className="row wr" style={{ gap: 8 }}>
              <a className="btn btn--filled" href={l.applyUrl} target="_blank" rel="noopener">Apply on official site<Icon name="external" /></a>
              <SaveButton listingId={l.id} saved={l.saved} size="md" />
              {user && <button className="btn btn--text" type="button" onClick={() => setReport(true)}><Icon name="flag" />Report an error</button>}
            </div>
            <p className="cap">Verified {plural(freshness(l.lastVerified).days, 'day')} ago from the official page. {COPY.disclaimer}</p>
          </div>
        </div>

        <aside className="rail rail-side rail-side--sticky">{railFacts}</aside>
      </div>

      <div className="cards-2 hide-md-none rail-mobile">{railFacts}</div>

      {similar.length > 0 && (
        <section className="col" style={{ marginTop: 6 }}>
          <h2 className="h1">Similar {kind}s</h2>
          <div className="cards-3">
            {similar.map(x => (
              <Link className="card card--link" key={x.id} to={(x.kind === 'scholarship' ? '/scholarship/' : '/program/') + x.id} style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="row wr" style={{ gap: 6 }}><FreshnessTag iso={x.lastVerified} freshness={x.freshness} /><span className="tag tag--out">{fmtDate(x.deadline)}</span></div>
                <h3 className="h2">{x.title}</h3>
                <p className="cap">{x.provider} · {fundingLabel(x)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ReportSheet listing={l} open={report} onClose={() => setReport(false)}
        onDone={() => { toast('Report received — thank you'); reload(); }} />
    </AppShell>
  );
}
