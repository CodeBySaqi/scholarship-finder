import React, { useMemo } from 'react';
import { Btn } from './ui.jsx';

/* Contextual filter card for the Matches page.
   The options are not a fixed list: they are derived from the listings that are
   actually loaded, and they change with the tab — a scholarship offers funding
   and degree level, a programme offers language, tuition and intake. Every chip
   carries the number of listings behind it, so a choice that would empty the
   page is visible before it is made. */

const DAYS = (iso) => {
  if (!iso) return null;
  return Math.round((new Date(iso.slice(0, 10) + 'T00:00:00Z') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 86400000);
};

const DEFAULT_SCHOLARSHIP = { match: 'all', funding: 'all', degree: 'all', country: 'all', deadline: 'all', recheck: false };
const DEFAULT_PROGRAM = { match: 'all', language: 'all', degree: 'all', tuition: 'all', intake: 'all', country: 'all', deadline: 'all', recheck: false };

export const defaultFilters = (tab) => (tab === 'programs' ? DEFAULT_PROGRAM : DEFAULT_SCHOLARSHIP);

/* the raw groups, straight off the API response */
const flatten = (active) => active ? [...active.meets, ...active.almost, ...active.next_cycle] : [];

const matchesValue = (r, key, val) => {
  const l = r.listing || {};
  switch (key) {
    case 'funding':
      if (val === 'all') return true;
      return val === 'full' ? l.fundingType === 'full' : l.fundingType !== 'full';
    case 'tuition':
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

/* apply everything except the group being counted, so the counts stay honest */
const bucketOf = (active, r) => ((active.meets || []).includes(r) ? 'meets'
  : (active.almost || []).includes(r) ? 'almost' : 'next');

export function applyFilters(active, filters, skip = null) {
  const rows = flatten(active);
  return rows.filter(r => {
    if (filters.match !== 'all' && skip !== 'match') {
      if (bucketOf(active, r) !== filters.match) return false;
    }
    return Object.keys(filters)
      .filter(k => k !== 'match' && k !== skip)
      .every(k => matchesValue(r, k, filters[k]));
  });
}

function countFor(active, filters, key, val) {
  const pool = applyFilters(active, filters, key);
  if (key === 'match') {
    /* a bucket is counted inside its own group, not by the group's filter */
    return val === 'all' ? pool.length : pool.filter(r => bucketOf(active, r) === val).length;
  }
  return pool.filter(r => (key === 'recheck' ? true : matchesValue(r, key, val))).length;
}

export default function MatchFilters({ tab, active, filters, setFilters, onReset }) {
  const rows = flatten(active);

  const countries = useMemo(() => {
    const seen = new Map();
    rows.forEach(r => { const c = r.listing && r.listing.hostCountry; if (c) seen.set(c, (seen.get(c) || 0) + 1); });
    return [...seen.keys()].sort();
  }, [rows]);

  const degrees = useMemo(() => {
    const seen = new Set();
    rows.forEach(r => (r.listing.degreeLevels || []).forEach(d => seen.add(d)));
    const order = ['bachelor', 'master', 'phd'];
    return [...seen].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [rows]);

  const languages = useMemo(() => {
    const seen = new Set();
    rows.forEach(r => { if (r.listing.languageMode) seen.add(r.listing.languageMode); });
    return [...seen].sort();
  }, [rows]);

  const intakes = useMemo(() => {
    const seen = new Set();
    rows.forEach(r => (r.listing.intakes || []).forEach(i => seen.add(i)));
    return ['WS', 'SS'].filter(i => seen.has(i));
  }, [rows]);

  const total = applyFilters(active, filters).length;
  const activeCount = Object.keys(filters).filter(k => k !== 'match' && filters[k] !== 'all' && filters[k] !== false).length;
  const label = tab === 'programs' ? 'programmes' : 'scholarships';

  const group = (key, title, items) => {
    if (!items.length) return null;
    return (
      <div className="mfilter__group" key={key}>
        <span className="mfilter__label">{title}</span>
        <div className="chips" role="group" aria-label={title}>
          {items.map(({ id, text }) => {
            const n = id === 'all' ? rows.length : countFor(active, filters, key, id);
            return (
              <button
                key={id}
                type="button"
                className={'chip chip--sm' + (filters[key] === id ? ' is-on' : '')}
                aria-pressed={filters[key] === id}
                disabled={n === 0 && filters[key] !== id}
                onClick={() => setFilters(f => ({ ...f, [key]: id }))}
              >{text} <span className="mfilter__n">{n}</span></button>
            );
          })}
        </div>
      </div>
    );
  };

  const DEGREES = { bachelor: 'Bachelor', master: 'Master', phd: 'PhD' };
  const LANGS = { english: 'English', german: 'German', mixed: 'Mixed' };

  return (
    <section className="card mfilter" aria-label="Match filters">
      <div className="mfilter__head">
        <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
          <h2 className="h2">Filters</h2>
          <span className="cap">{total} of {rows.length} {label}</span>
        </div>
        <button className="btn btn--text btn--sm" type="button" onClick={onReset}
          disabled={!activeCount && filters.match === 'all'}>Reset</button>
      </div>

      <div className="mfilter__grid">
        {group('match', 'Match', [
          { id: 'all', text: 'All' },
          { id: 'meets', text: 'Meets minimums' },
          { id: 'almost', text: 'Almost there' },
          { id: 'next', text: 'Next cycle' }
        ])}

        {tab === 'programs'
          ? <>
            {group('language', 'Language', [{ id: 'all', text: 'All' }, ...languages.map(l => ({ id: l, text: LANGS[l] || l }))])}
            {group('degree', 'Degree level', [{ id: 'all', text: 'All' }, ...degrees.map(d => ({ id: d, text: DEGREES[d] || d }))])}
            {group('tuition', 'Tuition', [{ id: 'all', text: 'All' }, { id: 'free', text: 'No tuition fee' }, { id: 'paid', text: 'Tuition charged' }])}
            {intakes.length > 1 && group('intake', 'Intake', [{ id: 'all', text: 'Any' }, ...intakes.map(i => ({ id: i, text: i === 'WS' ? 'Winter' : 'Summer' }))])}
          </>
          : <>
            {group('funding', 'Funding', [{ id: 'all', text: 'All' }, { id: 'full', text: 'Fully funded' }, { id: 'partial', text: 'Partial' }])}
            {group('degree', 'Degree level', [{ id: 'all', text: 'All' }, ...degrees.map(d => ({ id: d, text: DEGREES[d] || d }))])}
          </>}

        {group('country', 'Host country', [{ id: 'all', text: 'All' }, ...countries.map(c => ({ id: c, text: c }))])}
        {group('deadline', 'Deadline', [
          { id: 'all', text: 'Any' },
          { id: '30', text: 'Next 30 days' },
          { id: '60', text: 'Next 60 days' },
          { id: '90', text: 'Next 90 days' },
          { id: 'closed', text: 'Closed' }
        ])}
      </div>

      <div className="mfilter__foot">
        <div className="switch-row" style={{ minHeight: 34, flex: '1 1 220px' }}>
          <span className="h3">Hide needs-recheck</span>
          <button className="switch" type="button" role="switch" aria-checked={filters.recheck}
            aria-label="Hide needs-recheck"
            onClick={() => setFilters(f => ({ ...f, recheck: !f.recheck }))} />
        </div>
        <Btn variant="outlined" size="sm" to={tab === 'programs' ? '/programs' : '/scholarships'}>Advanced filters</Btn>
      </div>
    </section>
  );
}
