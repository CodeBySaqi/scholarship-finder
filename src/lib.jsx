import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './components/ui.jsx';

export const COPY = {
  disclaimer: 'Matches are guidance based on the minimum requirements published by the provider and last verified on the date shown. Meeting them does not guarantee selection. Always confirm requirements and deadlines on the official page before you apply.',
  gradeNote: 'Grade conversion is an estimate. Universities and uni-assist decide your final converted grade.',
  provisional: 'Provisional – complete your profile',
  meetsLine: "You meet the minimums we checked. Final decision is the provider's.",
  labels: { meets: 'Meets published minimums', almost: 'Almost there', next_cycle: 'Next cycle', hidden: 'Hidden' }
};

const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (iso) => {
  if (!iso) return 'No deadline stated';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return Number(d) + ' ' + M[Number(m) - 1] + ' ' + y;
};
export const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
export const TODAY = new Date().toISOString().slice(0, 10);
export const daysTo = (iso, today = TODAY) => {
  if (!iso) return null;
  return Math.round((new Date(iso.slice(0, 10) + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 86400000);
};
export function freshness(lastVerified, today = TODAY) {
  const days = Math.max(0, Math.round((new Date(today + 'T00:00:00Z') - new Date(String(lastVerified).slice(0, 10) + 'T00:00:00Z')) / 86400000));
  if (!lastVerified) return { state: 'stale', days: 9999 };
  if (days <= 30) return { state: 'fresh', days };
  if (days < 90) return { state: 'ok', days };
  if (days < 180) return { state: 'recheck', days };
  return { state: 'stale', days };
}
export const listingPath = (l) => (l.kind === 'scholarship' ? '/scholarship/' : '/program/') + l.id;

export function fundingLabel(l) {
  if (l.kind === 'scholarship') {
    if (l.fundingType === 'full') return 'Fully funded';
    if (l.fundingType === 'partial') return 'Partial funding';
    if (l.fundingType === 'tuition_only') return 'Tuition only';
    return 'Funding not stated';
  }
  return (l.tuitionPerSemester || 0) > 0 ? 'Tuition ' + l.tuitionPerSemester + ' EUR / semester' : 'No tuition fee';
}

export function CountdownTag({ iso }) {
  if (!iso) return <span className="tag tag--out">No deadline stated</span>;
  const d = daysTo(iso);
  if (d < 0) return <span className="tag tag--out">Closed</span>;
  return <span className={'tag ' + (d < 14 ? 'tag--er' : 'tag--wn')}><Icon name="clock" />{d === 0 ? 'closes today' : 'in ' + plural(d, 'day')}</span>;
}

export function FreshnessTag({ iso, freshness: f }) {
  const s = (f || freshness(iso)).state;
  if (s === 'fresh') { const d = (f || freshness(iso)).days; return <span className="tag tag--ok"><Icon name="checkCircle" />{d === 0 ? 'Verified today' : 'Verified ' + plural(d, 'day') + ' ago'}</span>; }
  if (s === 'ok') return <span className="tag tag--out"><Icon name="shield" />Verified on {fmtDate(iso)}</span>;
  if (s === 'recheck') return <span className="tag tag--er"><Icon name="refresh" />Needs recheck</span>;
  return <span className="tag tag--er"><Icon name="alert" />Stale</span>;
}

export function BucketTag({ bucket, provisional }) {
  const map = { meets: 'tag--ok', almost: 'tag--wn', next_cycle: 'tag--pr', hidden: 'tag--out' };
  const label = provisional && bucket === 'meets' ? 'Provisional – complete your profile' : COPY.labels[bucket];
  return <span className={'tag ' + (map[bucket] || 'tag--out')}>{label}</span>;
}

export function Disclaimer() {
  /* No placeholder links: "the official page" is the provider's own listing, which
     each card links to. Sending it to a stand-in domain was a dead end. */
  return <p className="cap">{COPY.disclaimer}</p>;
}

export const toneFor = (kind) => (kind === 'scholarship' ? 'tone-green' : 'tone-blue');
export const iconFor = (kind) => (kind === 'scholarship' ? 'cap' : 'school');
