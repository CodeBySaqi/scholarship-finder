import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui.jsx';
import { COPY, fmtDate, fundingLabel, listingPath, FreshnessTag, CountdownTag, BucketTag } from '../lib.jsx';
import { useSaved } from './saved.jsx';

export function SaveButton({ listingId, saved, size = 'sm', block, onChange }) {
  const { toggle, ids } = useSaved();
  const [on, setOn] = React.useState(saved !== undefined ? !!saved : ids.includes(listingId));
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { setOn(saved !== undefined ? !!saved : ids.includes(listingId)); }, [saved, ids, listingId]);
  async function click(e) {
    e.preventDefault(); e.stopPropagation();
    setBusy(true);
    try { const next = await toggle(listingId); setOn(next); onChange && onChange(next); }
    catch (err) { /* surface in toast by caller */ }
    finally { setBusy(false); }
  }
  return (
    <button type="button" className={'btn ' + (on ? 'btn--tonal' : 'btn--outlined') + ' btn--sm' + (block ? ' btn--block' : '')}
      aria-pressed={on} disabled={busy} onClick={click}>
      <Icon name="bookmark" />{on ? 'Saved' : 'Save'}
    </button>
  );
}

export function fmtReason(r) {
  if (r.status === 'pass') return [<b key="c">{r.check}</b>, ' ' + r.yours + ' - meets ' + r.required];
  if (r.status === 'gap') return [<b key="c">{r.check}</b>, ' needs ' + r.required + ' - you have ' + r.yours];
  if (r.status === 'info') return [<b key="c">{r.check}</b>, ' ' + r.required + ' - you have ' + r.yours];
  return [<b key="c">{r.check}</b>, ' needs ' + r.required + ' - you have ' + r.yours];
}

export function WhyList({ result, limit = 3 }) {
  const shown = (result.reasons || []).filter(r => r.status !== 'fail');
  const rows = shown.slice(0, limit);
  return (
    <div className="why-list">
      {rows.map((r, i) => {
        const cls = r.status === 'pass' ? '' : r.status === 'gap' ? ' why--gap' : ' why--info';
        const ic = r.status === 'pass' ? 'check' : r.status === 'gap' ? 'alert' : 'info';
        return <div className={'why' + cls} key={i}><Icon name={ic} /><span>{fmtReason(r)}</span></div>;
      })}
      {shown.length > limit && <div className="why why--info"><Icon name="info" /><span>+{shown.length - limit} more checks on the detail page</span></div>}
    </div>
  );
}

export function GapBox({ gaps }) {
  if (!gaps || !gaps.length) return null;
  return (
    <div className="gapbox">
      <Icon name="alert" />
      <b className="w500">{gaps.length === 1 ? 'One thing missing' : gaps.length + ' things missing'}</b>
      {gaps.map((g, i) => <span key={i}>{g}</span>)}
    </div>
  );
}

export function MatchCard({ listing: l, match, showReport, onReport }) {
  const saved = l.saved;
  return (
    <article className="card">
      <div className="row sp wr" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <BucketTag bucket={match.bucket} provisional={match.provisional} />
          {(match.matchedTargets || []).map(t => <span className="tag tag--pr" key={t}>{t}</span>)}
        </div>
      </div>
      <div>
        <h2 className="h2"><Link to={listingPath(l)} style={{ color: 'inherit' }}>{l.title}</Link></h2>
        <p className="cap">{l.provider || 'Provider not stated'} · {l.hostCountry} · {fundingLabel(l)}</p>
      </div>
      <div className="row wr" style={{ gap: 6 }}>
        <FreshnessTag iso={l.lastVerified} freshness={l.freshness} />
        <CountdownTag iso={l.deadline} />
        {l.kind === 'program' && (l.tuitionPerSemester || 0) > 0 && <span className="tag tag--wn">{l.tuitionPerSemester} EUR / semester</span>}
        {(l.openErrorReports || 0) >= 2 && <span className="tag tag--wn"><Icon name="flag" />{l.openErrorReports} open reports</span>}
      </div>
      {match.bucket === 'meets' && <WhyList result={match} limit={3} />}
      <GapBox gaps={match.bucket === 'almost' ? match.gaps : []} />
      {(match.badges || []).includes('borderline_estimate') && <p className="cap">{COPY.gradeNote}</p>}
      {match.bucket === 'next_cycle' && <p className="cap">The deadline for this intake has passed. It is annual, so it comes back in the next cycle.</p>}
      <div className="row wr" style={{ marginTop: 4 }}>
        <SaveButton listingId={l.id} saved={saved} />
        <Link className="btn btn--tonal btn--sm" to={listingPath(l)}>View details</Link>
        {showReport && <button className="btn btn--text btn--sm" type="button" onClick={() => onReport && onReport(l)}><Icon name="flag" />Report an error</button>}
      </div>
    </article>
  );
}

export function PlainCard({ listing: l }) {
  return (
    <article className="card">
      <div className="row wr" style={{ gap: 6 }}>
        <span className="tag tag--pr">{l.kind === 'scholarship' ? 'Scholarship' : 'Program'}</span>
        {(l.degreeLevels || []).map(dg => <span className="tag tag--out" key={dg}>{dg[0].toUpperCase() + dg.slice(1)}</span>)}
      </div>
      <div>
        <h2 className="h2"><Link to={listingPath(l)} style={{ color: 'inherit' }}>{l.title}</Link></h2>
        <p className="cap">{l.provider} · {l.hostCountry} · {fundingLabel(l)}</p>
      </div>
      <div className="row wr" style={{ gap: 6 }}>
        <FreshnessTag iso={l.lastVerified} freshness={l.freshness} />
        <CountdownTag iso={l.deadline} />
      </div>
      <p className="cap">Sign in with a profile to see which requirements you meet.</p>
      <div className="row wr" style={{ marginTop: 2 }}>
        <SaveButton listingId={l.id} saved={l.saved} />
        <Link className="btn btn--tonal btn--sm" to={listingPath(l)}>View details</Link>
      </div>
    </article>
  );
}

export function ListingRow({ l, meta, right }) {
  return (
    <Link className="row sp" to={listingPath(l)} style={{ color: 'inherit', gap: 12 }}>
      <div className="row" style={{ gap: 12, minWidth: 0 }}>
        <span className={'statcard__icon ' + (l.kind === 'scholarship' ? 'tone-green' : 'tone-blue')} style={{ width: 38, height: 38, borderRadius: 11 }}>
          <Icon name={l.kind === 'scholarship' ? 'cap' : 'school'} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
          <div className="cap nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</div>
        </div>
      </div>
      {right}
    </Link>
  );
}
