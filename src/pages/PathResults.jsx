import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/Shell.jsx';
import { Notice, Empty, Loader, LoadError, useAsync, Icon, Btn } from '../components/ui.jsx';
import { api } from '../api.js';

const VERDICTS = [
  { id: 'eligible', label: 'Eligible', tone: 'ok', blurb: 'Every stated requirement passes.' },
  { id: 'check_manually', label: 'Check manually', tone: 'wn', blurb: 'No known requirement fails, but something is not stated. The university page decides.' },
  { id: 'not_eligible', label: 'Not eligible', tone: 'er', blurb: 'A stated requirement is not met. The reason is named on every card.' }
];

const StatusIcon = ({ status }) => {
  const map = { pass: 'check', fail: 'close', unknown: 'alert', pending: 'clock' };
  return <Icon name={map[status] || 'info'} size={13} />;
};

function ResultCard({ r, kind }) {
  const [open, setOpen] = useState(false);
  const show = open ? r.reasons : r.reasons.filter(x => x.status !== 'pass').slice(0, 3);
  return (
    <article className={'card path-card is-' + r.verdict}>
      <div className="path-card__head">
        <div>
          <h3 className="h3">{r.title}</h3>
          <p className="cap">
            {kind === 'programmes'
              ? [r.university, r.city].filter(Boolean).join(' · ')
              : r.provider}
          </p>
        </div>
        <span className={'tag tag--' + (VERDICTS.find(v => v.id === r.verdict) || {}).tone}>{r.verdict.replace('_', ' ')}</span>
      </div>

      <p className={'path-card__headline' + (r.verdict === 'not_eligible' ? ' is-fail' : '')}>{r.headline}</p>

      {r.tags && r.tags.length > 0 && (
        <div className="chips">{r.tags.map(t => <span key={t} className="chip chip--sm is-soft">{t}</span>)}</div>
      )}

      <ul className="path-reasons">
        {show.map((x, i) => (
          <li key={i} className={'path-reason is-' + x.status}>
            <span className="path-reason__ic"><StatusIcon status={x.status} /></span>
            <span><b className="w500">{x.check}</b> — {x.text}</span>
          </li>
        ))}
      </ul>

      <div className="path-card__foot">
        {r.reasons.length > show.length && (
          <button className="btn btn--text btn--sm" type="button" onClick={() => setOpen(!open)}>
            {open ? 'Show fewer reasons' : 'Show all ' + r.reasons.length + ' checks'}
          </button>
        )}
        <span className="grow" />
        {kind === 'programmes' && r.links && r.links.programme && (
          <a className="btn btn--outlined btn--sm" href={r.links.programme} target="_blank" rel="noreferrer noopener">University page</a>
        )}
        {kind === 'scholarships' && r.link && (
          <a className="btn btn--outlined btn--sm" href={r.link} target="_blank" rel="noreferrer noopener">Official page</a>
        )}
      </div>
    </article>
  );
}

export default function PathResults({ kind = 'programmes' }) {
  const { data, loading, error, reload } = useAsync(() => api.get('/path/matches?kind=' + kind), [kind]);
  const [filter, setFilter] = useState('all');

  if (error) return <AppShell page={kind === 'programmes' ? 'path-programmes' : 'path-scholarships'}>
    <LoadError error={error} onRetry={reload} what="matches" />
  </AppShell>;

  const counts = (data && data.counts) || {};
  const results = (data && data.results) || [];
  const shown = filter === 'all' ? results : results.filter(r => r.verdict === filter);
  const isEmptyProfile = (data && data.completeness && data.completeness.steps[1] === 0);

  return (
    <AppShell page={kind === 'programmes' ? 'path-programmes' : 'path-scholarships'}>
      <div className="phead">
        <div>
          <h1 className="h1">{kind === 'programmes' ? 'Programme matches' : 'Scholarship matches'}</h1>
          <p className="cap">Eligibility screening against the requirements each listing actually states.</p>
        </div>
        <Btn variant="filled" size="sm" to="/path">Edit my profile</Btn>
      </div>

      <Notice tone="warning">
        <b className="w500">Screening only — not an admission.</b> These verdicts compare your profile with the
        published requirements. The university or provider decides, and a page can change after we read it.
      </Notice>

      {loading && <div className="card"><Loader /></div>}

      {!loading && data && data.pending && data.pending.length > 0 && (
        <Notice tone="info">
          <b className="w500">Still pending:</b> {data.pending.join(', ')}.
          {' '}Checks that need these are marked <b className="w500">pending</b> and can never make a result Eligible.
          {' '}<Link to="/path">Complete step {data.completeness.steps[2] < 100 ? 2 : 3}</Link>
        </Notice>
      )}

      {!loading && data && (
        <>
          <div className="path-tally">
            {VERDICTS.map(v => (
              <button key={v.id} type="button" className={'path-tally__item' + (filter === v.id ? ' is-on' : '')}
                onClick={() => setFilter(filter === v.id ? 'all' : v.id)}>
                <span className={'path-tally__n is-' + v.tone}>{counts[v.id] || 0}</span>
                <span className="path-tally__l">{v.label}</span>
              </button>
            ))}
            <span className="grow" />
            <span className="cap">{filter === 'all' ? results.length + ' results' : shown.length + ' shown'}</span>
          </div>

          {isEmptyProfile && (
            <Notice tone="warning">
              <b className="w500">Your target step is empty.</b> Step 1 takes two minutes and already produces rough
              matches. <Link to="/path">Start step 1</Link>
            </Notice>
          )}

          {!shown.length && !isEmptyProfile && (
            <div className="card"><Empty icon="search" title="Nothing in this group"
              text="Switch the filter above, or loosen your budget." /></div>
          )}

          <div className="path-list">
            {shown.map(r => <ResultCard key={r.id} r={r} kind={kind} />)}
          </div>

          <p className="cap">{data.disclaimer}</p>
        </>
      )}
    </AppShell>
  );
}
