import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/Shell.jsx';
import { Icon, Empty, Loader, Btn, Chip, LoadError } from '../components/ui.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { MatchCard, PlainCard } from '../components/cards.jsx';
import { Disclaimer, plural } from '../lib.jsx';
import { useAuth } from '../auth.jsx';
import { useAsync } from '../components/ui.jsx';
import { api } from '../api.js';

const FIELDS = [
  { id: 'ai', label: 'AI' }, { id: 'data', label: 'Data' }, { id: 'software', label: 'Software' },
  { id: 'engineering', label: 'Engineering' }, { id: 'business', label: 'Business' }, { id: 'science', label: 'Science' }
];
const DAYS = (iso) => {
  if (!iso) return null;
  return Math.round((new Date(iso.slice(0, 10) + 'T00:00:00Z') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 86400000);
};

function Filters({ kind, state, set, clear }) {
  const toggle = (key, val) => {
    if (key === 'deadline') set({ deadline: state.deadline === val ? '' : val });
    else set({ [key]: state[key].includes(val) ? state[key].filter(v => v !== val) : [...state[key], val] });
  };
  const group = (key, options) => (
    <div className="col-8">
      <span className="cap w500">{options.label}</span>
      <div className="chips">
        {options.items.map(o => <Chip key={o.id} active={state[key] === o.id || (Array.isArray(state[key]) && state[key].includes(o.id))} onClick={() => toggle(key, o.id)}>{o.label}</Chip>)}
      </div>
    </div>
  );
  const sw = (key, title, sub, disabled) => (
    <div className="switch-row">
      <span className="t"><span className="h3">{title}</span><span className="cap">{sub}</span></span>
      <button className="switch" type="button" role="switch" aria-checked={state[key]} aria-label={title} disabled={disabled}
        onClick={() => set({ [key]: !state[key] })} />
    </div>
  );

  return (
    <>
      <h2 className="h2">Filters</h2>
      <div className="field">
        <label htmlFor={'fq' + kind}>Search</label>
        <input className="input" id={'fq' + kind} type="search" placeholder={kind === 'scholarship' ? 'Provider or scholarship name' : 'Program or university'}
          value={state.q} onChange={e => set({ q: e.target.value })} />
      </div>
      {group('degree', { label: 'Degree level', items: [{ id: 'bachelor', label: 'Bachelor' }, { id: 'master', label: 'Master' }, { id: 'phd', label: 'PhD' }] })}
      {group('funding', {
        label: kind === 'scholarship' ? 'Funding' : 'Tuition',
        items: kind === 'scholarship' ? [{ id: 'full', label: 'Fully funded' }, { id: 'partial', label: 'Partial' }]
          : [{ id: 'free', label: 'No tuition fee' }, { id: 'paid', label: 'Tuition charged' }]
      })}
      {group('deadline', { label: 'Deadline', items: [{ id: '30', label: 'Next 30 days' }, { id: '60', label: 'Next 60 days' }, { id: '90', label: 'Next 90 days' }] })}
      {kind === 'program' && group('language', { label: 'Language', items: [{ id: 'english', label: 'English' }, { id: 'german', label: 'German' }, { id: 'mixed', label: 'Mixed' }] })}
      {kind === 'program' && group('field', { label: 'Field', items: FIELDS })}
      {kind === 'scholarship' && sw('ieltsFree', 'IELTS not required', 'Skips listings that need a test')}
      {sw('freshOnly', 'Verified in last 30 days', 'Fresh listings only')}
      {sw('mineOnly', 'Only what I meet', 'Uses your profile and targets')}
      <button className="btn btn--text btn--sm" type="button" style={{ alignSelf: 'flex-start', marginTop: 2 }} onClick={clear}>Clear all filters</button>
    </>
  );
}

export default function Browse({ kind = 'scholarship' }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [mobile, setMobile] = useState(false);
  const [state, setStateRaw] = useState({
    q: params.get('q') || '', degree: [], funding: [], deadline: '', language: [], field: [],
    ieltsFree: false, freshOnly: false, mineOnly: false, sort: 'deadline'
  });
  const [sort, setSort] = useState('deadline');
  const set = (patch) => setStateRaw(s => ({ ...s, ...patch }));
  const clear = () => setStateRaw(s => ({ ...s, q: '', degree: [], funding: [], deadline: '', language: [], field: [], ieltsFree: false, freshOnly: false, mineOnly: false }));

  const { data, loading, reload, error } = useAsync(
    () => api.get('/listings?kind=' + kind + (user ? '&x=1' : '')),
    [kind, !!user]
  );
  const all = (data && data.listings) || [];

  const rows = useMemo(() => {
    let out = all.slice();
    const d = (iso) => DAYS(iso);
    if (state.q) { const q = state.q.toLowerCase(); out = out.filter(l => (l.title + ' ' + (l.provider || '')).toLowerCase().includes(q)); }
    if (state.degree.length) out = out.filter(l => (l.degreeLevels || []).some(v => state.degree.includes(v)));
    if (state.funding.length) out = out.filter(l => {
      if (kind === 'scholarship') return state.funding.includes(l.fundingType);
      const free = !(l.tuitionPerSemester || 0);
      return state.funding.some(f => (f === 'free' && free) || (f === 'paid' && !free));
    });
    if (state.deadline) out = out.filter(l => l.deadline && d(l.deadline) >= 0 && d(l.deadline) <= Number(state.deadline));
    if (state.language.length) out = out.filter(l => state.language.includes(l.languageMode));
    if (state.field.length) out = out.filter(l => state.field.includes(l.fieldCategory));
    if (state.ieltsFree) out = out.filter(l => !l.ieltsRequired);
    if (state.freshOnly) out = out.filter(l => l.freshness && l.freshness.days <= 30);
    if (state.mineOnly) out = out.filter(l => l.match && l.match.bucket === 'meets');
    const fit = { meets: 0, almost: 1, next_cycle: 2 };
    if (sort === 'deadline') out.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    if (sort === 'verified') out.sort((a, b) => String(b.lastVerified).localeCompare(String(a.lastVerified)));
    if (sort === 'fit') out.sort((a, b) => (a.match ? fit[a.match.bucket] : 9) - (b.match ? fit[b.match.bucket] : 9));
    return out;
  }, [all, state, sort, kind]);

  const activeChips = [];
  state.degree.forEach(v => activeChips.push({ label: v, clear: () => set({ degree: state.degree.filter(x => x !== v) }) }));
  state.funding.forEach(v => activeChips.push({ label: v === 'free' ? 'No tuition fee' : v === 'paid' ? 'Tuition charged' : v, clear: () => set({ funding: state.funding.filter(x => x !== v) }) }));
  if (state.deadline) activeChips.push({ label: 'Next ' + state.deadline + ' days', clear: () => set({ deadline: '' }) });
  state.language.forEach(v => activeChips.push({ label: v, clear: () => set({ language: state.language.filter(x => x !== v) }) }));
  state.field.forEach(v => activeChips.push({ label: v, clear: () => set({ field: state.field.filter(x => x !== v) }) }));
  if (state.ieltsFree) activeChips.push({ label: 'IELTS not required', clear: () => set({ ieltsFree: false }) });
  if (state.freshOnly) activeChips.push({ label: 'Fresh only', clear: () => set({ freshOnly: false }) });
  if (state.mineOnly) activeChips.push({ label: 'Only what I meet', clear: () => set({ mineOnly: false }) });
  if (state.q) activeChips.push({ label: '“' + state.q + '”', clear: () => set({ q: '' }) });

  const label = kind === 'scholarship' ? 'Scholarships' : 'German programs';

  if (error) return <AppShell page="browse"><LoadError error={error} onRetry={reload} what="listings" /></AppShell>;

  return (
    <AppShell page="browse">
      <div className="phead">
        <div className="row sp wr">
          <div>
            <h1 className="h1">{label}</h1>
            <p className="cap">Every listing carries the date it was last checked against the official page.</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--outlined btn--sm" type="button" onClick={() => setMobile(true)} style={{ display: 'inline-flex' }}>
              <Icon name="filter" />Filters
            </button>
            <select className="select" aria-label="Sort results" style={{ width: 'auto', minHeight: 38, fontSize: 13 }}
              value={sort} onChange={e => setSort(e.target.value)}>
              <option value="deadline">Deadline soonest</option>
              <option value="verified">Recently verified</option>
              <option value="fit">Best fit</option>
            </select>
          </div>
        </div>
        <div className="row sp wr">
          <span className="cap">{loading ? 'Loading…' : plural(rows.length, kind === 'scholarship' ? 'scholarship' : 'program') + ' found'}</span>
          <div className="chips">
            {activeChips.map(c => (
              <button className="chip chip--sm is-on" type="button" key={c.label} onClick={c.clear}>{c.label} ✕</button>
            ))}
          </div>
        </div>
      </div>

      <div className="with-rail with-rail--left">
        <div className="cards-2 with-rail__main">
          {loading ? <div className="card"><Loader /></div>
            : rows.length === 0
              ? <div className="card">
                  <Empty icon="search" title="No results with these filters"
                    text="Try removing the deadline window or the degree filter. Listings older than 90 days are hidden until someone rechecks them."
                    action={<button className="btn btn--tonal btn--sm" type="button" onClick={clear}>Clear all filters</button>} />
                </div>
              : rows.map(l => l.match
                  ? <MatchCard key={l.id} listing={l} match={l.match} />
                  : <PlainCard key={l.id} listing={l} />)}
        </div>

        <aside className="rail">
          <div className="card filters-panel">
            <Filters kind={kind} state={state} set={set} clear={clear} />
          </div>
          <div className="card card--tone">
            <span className="h3" style={{ color: 'inherit' }}>Not sure what fits?</span>
            <p className="cap">Answer five short steps and every card will show its checks.</p>
            <Btn variant="outlined" size="sm" block to="/wizard">Build my profile</Btn>
          </div>
        </aside>
      </div>

      <Disclaimer />

      <Sheet open={mobile} title="Filters" onClose={() => setMobile(false)}
        footer={<div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn--filled" type="button" onClick={() => setMobile(false)}>Done</button></div>}>
        <p className="cap" style={{ marginBottom: 10 }}>The same filters as the desktop sidebar.</p>
        <Filters kind={kind} state={state} set={set} clear={clear} />
      </Sheet>
    </AppShell>
  );
}
