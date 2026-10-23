import React, { useMemo } from 'react';
import { Btn } from './ui.jsx';

/* Compact filter bar for Matches.
   Two rows only: the match bucket as pills, the rest as selects. Every option
   carries the number of listings behind it and impossible choices are disabled,
   so the whole surface stays short at every width while keeping the options
   different for scholarships and programmes. */

const DAYS = (iso) => {
  if (!iso) return null;
  return Math.round((new Date(iso.slice(0, 10) + 'T00:00:00Z') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 86400000);
};

const DEFAULT_SCHOLARSHIP = { match: 'all', funding: 'all', degree: 'all', country: 'all', deadline: 'all', recheck: false };
const DEFAULT_PROGRAM = { match: 'all', funding: 'all', language: 'all', degree: 'all', intake: 'all', country: 'all', deadline: 'all', recheck: false };

export const defaultFilters = (tab) => (tab === 'programs' ? DEFAULT_PROGRAM : DEFAULT_SCHOLARSHIP);

const flatten = (active) => active ? [...active.meets, ...active.almost, ...active.next_cycle] : [];

const bucketOf = (active, r) => ((active.meets || []).includes(r) ? 'meets'
  : (active.almost || []).includes(r) ? 'almost' : 'next');

const matchesValue = (r, key, val) => {
  const l = r.listing || {};
  switch (key) {
    case 'funding':
      if (val === 'all') return true;
      return val === 'full' ? l.fundingType === 'full' : l.fundingType !== 'full';
    case 'tuition':
    case 'funding_program':
      if (val === 'all') return true;
      return val === 'free' ? (l.tuitionPerSemester || 0) === 0 : (l.tuitionPerSemester || 0) > 0;
    case 'degree':
      return val === 'all' || (l.degreeLevels || []).includes(val);
    case 'country':
      return val === 'all' || l.hostCountry === val;
    case 'language':
      return val === 'all' || l.languageMode === val;
    case 'intake':
      return val === 'all' || (l.intakes || []).includes(val);
    case 'deadline': {
      if (val === 'all') return true;
      const d = DAYS(l.deadline);
      if (d === null) return false;
      if (val === 'closed') return d < 0;
      if (val === '30') return d >= 0 && d <= 30;
      if (val === '60') return d >= 0 && d <= 60;
      if (val === '90') return d >= 0 && d <= 90;
      return true;
    }
    case 'recheck':
      return !val || !(r.badges || []).includes('recheck');
    default:
      return true;
  }
};

export function applyFilters(active, filters, skip = null) {
  const rows = flatten(active);
  return rows.filter(r => {
    if (filters.match !== 'all' && skip !== 'match' && bucketOf(active, r) !== filters.match) return false;
    return Object.keys(filters)
      .filter(k => k !== 'match' && k !== skip)
      .every(k => matchesValue(r, k, filters[k]));
  });
}

function countFor(active, filters, key, val) {
  const pool = applyFilters(active, filters, key);
  if (key === 'match') {
    return val === 'all' ? pool.length : pool.filter(r => bucketOf(active, r) === val).length;
  }
  return pool.filter(r => matchesValue(r, key, val)).length;
}

export default function MatchFilters({ tab, active, filters, setFilters, onReset }) {
  const rows = flatten(active);
  const isProgram = tab === 'programs';

  const countries = useMemo(() => {
    const seen = new Set();
    rows.forEach(r => { const c = r.listing && r.listing.hostCountry; if (c) seen.add(c); });
    return [...seen].sort();
  }, [rows]);

  const degrees = useMemo(() => {
    const seen = new Set();
    rows.forEach(r => (r.listing.degreeLevels || []).forEach(d => seen.add(d)));
    return ['bachelor', 'master', 'phd'].filter(d => seen.has(d));
  }, [rows]);

  const languages = useMemo(() => {
    const seen = new Set();
    rows.forEach(r => { if (r.listing.languageMode) seen.add(r.listing.languageMode); });
    return ['english', 'german', 'mixed'].filter(l => seen.has(l));
  }, [rows]);

  const intakes = useMemo(() => {
    const seen = new Set();
    rows.forEach(r => (r.listing.intakes || []).forEach(i => seen.add(i)));
    return ['WS', 'SS'].filter(i => seen.has(i));
  }, [rows]);

  const total = applyFilters(active, filters).length;
  const activeCount = Object.keys(filters).filter(k => k !== 'match' && filters[k] !== 'all' && filters[k] !== false).length
    + (filters.match !== 'all' ? 1 : 0);
  const noun = isProgram ? 'programmes' : 'scholarships';

  const DEGREES = { bachelor: 'Bachelor', master: 'Master', phd: 'PhD' };
  const LANGS = { english: 'English', german: 'German', mixed: 'Mixed' };

  /* one pill row — the bucket is the decision people actually make */
  const buckets = [
    { id: 'all', text: 'All' },
    { id: 'meets', text: 'Meets' },
    { id: 'almost', text: 'Almost there' },
    { id: 'next', text: 'Next cycle' }
  ];

  /* one select row — everything else stays folded away until it is needed */
  const selects = [
    isProgram
      ? { key: 'funding', label: 'Tuition', items: [{ id: 'all', text: 'Any tuition' }, { id: 'free', text: 'No tuition fee' }, { id: 'paid', text: 'Tuition charged' }], value: filters.funding }
      : { key: 'funding', label: 'Funding', items: [{ id: 'all', text: 'Any funding' }, { id: 'full', text: 'Fully funded' }, { id: 'partial', text: 'Partial funding' }], value: filters.funding },
    isProgram && languages.length > 1
      ? { key: 'language', label: 'Language', items: [{ id: 'all', text: 'Any language' }, ...languages.map(l => ({ id: l, text: LANGS[l] || l }))], value: filters.language }
      : null,
    degrees.length > 1
      ? { key: 'degree', label: 'Degree', items: [{ id: 'all', text: 'Any degree' }, ...degrees.map(d => ({ id: d, text: DEGREES[d] || d }))], value: filters.degree }
      : null,
    isProgram && intakes.length > 1
      ? { key: 'intake', label: 'Intake', items: [{ id: 'all', text: 'Any intake' }, ...intakes.map(i => ({ id: i, text: i === 'WS' ? 'Winter' : 'Summer' }))], value: filters.intake }
      : null,
    countries.length > 1
      ? { key: 'country', label: 'Country', items: [{ id: 'all', text: 'Any country' }, ...countries.map(c => ({ id: c, text: c }))], value: filters.country }
      : null,
    { key: 'deadline', label: 'Deadline', items: [{ id: 'all', text: 'Any deadline' }, { id: '30', text: 'Next 30 days' }, { id: '60', text: 'Next 60 days' }, { id: '90', text: 'Next 90 days' }, { id: 'closed', text: 'Closed' }], value: filters.deadline }
  ].filter(Boolean);

  return (
    <section className="card mfilter" aria-label="Match filters">
      <div className="mfilter__head">
        <div className="mfilter__count">
          <h2 className="h2">Filters</h2>
          <span className="cap">{total} of {rows.length} {noun}</span>
        </div>
        <button className="btn btn--text btn--sm mfilter__reset" type="button" onClick={onReset} disabled={!activeCount}>
          Reset{activeCount ? ' · ' + activeCount : ''}
        </button>
      </div>

      <div className="mfilter__pills" role="group" aria-label="Match group">
        {buckets.map(b => {
          const n = b.id === 'all' ? rows.length : countFor(active, filters, 'match', b.id);
          return (
            <button key={b.id} type="button"
              className={'chip chip--sm' + (filters.match === b.id ? ' is-on' : '')}
              aria-pressed={filters.match === b.id}
              disabled={n === 0 && filters.match !== b.id}
              onClick={() => setFilters(f => ({ ...f, match: b.id }))}>
              {b.text}<span className="mfilter__n">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="mfilter__selects">
        {selects.map(group => (
          <label className="mfilter__select" key={group.key}>
            <span className="mfilter__select-label">{group.label}</span>
            <select className="select input--compact" value={group.value}
              onChange={e => setFilters(f => ({ ...f, [group.key]: e.target.value }))}>
              {group.items.map(o => {
                const n = o.id === 'all' ? rows.length : countFor(active, filters, group.key, o.id);
                return <option key={o.id} value={o.id} disabled={n === 0 && group.value !== o.id}>{o.text} · {n}</option>;
              })}
            </select>
          </label>
        ))}
      </div>

      <div className="mfilter__foot">
        <label className="mfilter__check">
          <input type="checkbox" checked={filters.recheck}
            onChange={e => setFilters(f => ({ ...f, recheck: e.target.checked }))} />
          <span>Hide needs-recheck</span>
        </label>
        <Btn variant="text" size="sm" to={isProgram ? '/programs' : '/scholarships'}>Not finding it? Browse all</Btn>
      </div>
    </section>
  );
}
