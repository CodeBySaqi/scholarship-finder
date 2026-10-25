import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/Shell.jsx';
import { Card, Icon, Empty, Btn, useToast, Field, LoadError, Textarea } from '../components/ui.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { SaveButton } from '../components/cards.jsx';
import { useSaved } from '../components/saved.jsx';
import { api } from '../api.js';
import { fmtDate, daysTo, fundingLabel, FreshnessTag, CountdownTag, Disclaimer } from '../lib.jsx';

const groupOf = (l) => {
  if (!l.deadline) return 'No deadline stated';
  const d = daysTo(l.deadline);
  if (d < 0) return 'Closed — kept for the next cycle';
  if (d < 14) return 'Closing in under 14 days';
  if (d <= 30) return 'Closing this month';
  if (d <= 90) return 'In the next 3 months';
  return 'Later';
};
const ORDER = ['Closing in under 14 days', 'Closing this month', 'In the next 3 months', 'Later', 'Closed — kept for the next cycle', 'No deadline stated'];

export default function Saved() {
  const { rows, reload, error } = useSaved();
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [note, setNote] = useState('');
  const toast = useToast();

  const list = useMemo(() => rows
    .filter(s => filter === 'all' || (s.listing && s.listing.kind === filter))
    .filter(s => s.listing)
    .sort((a, b) => (a.listing.deadline || '9999-12-31').localeCompare(b.listing.deadline || '9999-12-31')), [rows, filter]);

  const groups = {};
  list.forEach(x => { const g = groupOf(x.listing); (groups[g] = groups[g] || []).push(x); });

  async function saveNote() {
    try {
      await api.patch('/saved/' + editing.listing.id, { note });
      setEditing(null);
      await reload();
      toast('Note saved');
    } catch (e) { toast(e.message); }
  }

  if (error && !rows.length) return <AppShell page="saved" counts={{ saved: 0 }}><LoadError error={error} onRetry={reload} what="saved list" /></AppShell>;

  return (
    <AppShell page="saved" counts={{ saved: rows.length }}>
      <div className="phead">
        <div className="row sp wr">
          <div>
            <h1 className="h1">Saved</h1>
            <p className="cap">Sorted by deadline. Anything closing inside 14 days is marked in red.</p>
          </div>
          <div className="chips">
            {[['all', 'All'], ['scholarship', 'Scholarships'], ['program', 'Programs']].map(([k, label]) => (
              <button key={k} className={'chip chip--sm' + (filter === k ? ' is-on' : '')} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {!list.length ? (
        <Card>
          <Empty icon="bookmark" title="Your saved list is empty"
            text="Tap Save on any scholarship or program card. Saved items appear here with a countdown, and you can add a private note to each one."
            action={<div className="row wr" style={{ justifyContent: 'center' }}>
              <Btn variant="filled" size="sm" to="/matches">See my matches</Btn>
              <Btn variant="outlined" size="sm" to="/scholarships">Browse scholarships</Btn>
            </div>} />
        </Card>
      ) : ORDER.filter(g => groups[g]).map(g => (
        <section className="col-8" key={g}>
          <div className="sect-head">
            <h2 className="h2" style={g === 'Closing in under 14 days' ? { color: 'var(--on-danger)' } : undefined}>{g} · {groups[g].length}</h2>
          </div>
          <div className="cards-2">
            {groups[g].map(x => {
              const l = x.listing;
              return (
                <Card  key={x.id}>
                  <div className="row sp wr" style={{ gap: 6 }}>
                    <div className="row wr" style={{ gap: 6 }}>
                      <span className="tag tag--out">{l.kind === 'scholarship' ? 'Scholarship' : 'Program'}</span>
                      <FreshnessTag iso={l.lastVerified} freshness={l.freshness} />
                    </div>
                    <CountdownTag iso={l.deadline} />
                  </div>
                  <div>
                    <h2 className="h2"><Link to={(l.kind === 'scholarship' ? '/scholarship/' : '/program/') + l.id} style={{ color: 'inherit' }}>{l.title}</Link></h2>
                    <p className="cap">{l.provider} · {fundingLabel(l)} · deadline {fmtDate(l.deadline)}</p>
                  </div>
                  {x.note
                    ? <div className="gapbox gapbox--info"><Icon name="file" /><span>{x.note}</span></div>
                    : <Btn variant="text" size="sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
                        onClick={() => { setEditing(x); setNote(x.note || ''); }}><Icon name="plus" />Add a note</Btn>}
                  <div className="row wr" style={{ marginTop: 2 }}>
                    <Btn variant="tonal" size="sm" to={(l.kind === 'scholarship' ? '/scholarship/' : '/program/') + l.id}>View details</Btn>
                    <SaveButton listingId={l.id} saved size="sm" onChange={() => reload()} />
                    {x.note && <Btn variant="text" size="sm" onClick={() => { setEditing(x); setNote(x.note || ''); }}><Icon name="edit" />Edit note</Btn>}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      <Disclaimer />

      <Sheet open={!!editing} title="Note for yourself" onClose={() => setEditing(null)}
        footer={<div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <Btn variant="text" onClick={() => setEditing(null)}>Cancel</Btn>
          <Btn variant="filled" onClick={saveNote}>Save note</Btn>
        </div>}>
        <Field label="Private note" htmlFor="note" help="Only you can see this. Notes are not sent anywhere.">
          <Textarea id="note" rows={3} placeholder="Documents to gather, a question for your referee…" value={note} onChange={e => setNote(e.target.value)} className="input" />
        </Field>
      </Sheet>
    </AppShell>
  );
}
