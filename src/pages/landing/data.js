import { useMemo } from 'react';
import { api } from '../../api.js';
import { useAsync } from '../../components/ui.jsx';

/* One data source for all five home-page designs: the same live numbers and the
   same newest verified listing. Nothing is invented — if the API fails the
   variants say so instead of printing zeroes. */
export function useLanding() {
  const { data, loading, error, reload } = useAsync(() => api.get('/public/stats'), []);
  const stats = data || { scholarships: 0, programs: 0, universities: 0, recent: [], verifiedList: [] };
  const statsReady = !loading && !error && !!data;
  const sample = (stats.recent || [])[0] || null;

  const months = useMemo(() => {
    const now = new Date();
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      return { key: d.toISOString().slice(0, 7), label: labels[d.getUTCMonth()] };
    });
  }, []);

  const counts = months.map(m => (stats.verifiedList || []).filter(l => l.deadline && l.deadline.slice(0, 7) === m.key).length);

  const checks = useMemo(() => {
    const c = { 'CGPA': 0, 'IELTS / English': 0, 'Degree & route': 0, 'Age & timing': 0, 'Nationality': 0, 'Deadline': 0 };
    (stats.verifiedList || []).forEach(l => {
      if (l.minCgpa) c['CGPA']++;
      if (l.ieltsRequired) c['IELTS / English']++;
      if (l.degreeLevels && l.degreeLevels.length) c['Degree & route']++;
      if (l.maxAge) c['Age & timing']++;
      if (l.allowedCountries && l.allowedCountries.length) c['Nationality']++;
      if (l.deadline) c['Deadline']++;
    });
    return c;
  }, [stats.verifiedList]);

  const num = (v) => (statsReady ? v : '—');

  return { stats, loading, error, reload, statsReady, sample, months, counts, checks, num };
}

export const STEPS = [
  { n: '01', icon: 'person', tone: 'tone-blue', t: 'Build your profile', d: 'Degree, CGPA, IELTS, age, test scores and intake. Seven short steps, editable later.' },
  { n: '02', icon: 'target', tone: 'tone-green', t: 'See what you meet', d: 'Every listing is checked against its published minimums. The gaps are named, not hidden.' },
  { n: '03', icon: 'bookmark', tone: 'tone-amber', t: 'Track and apply', d: 'Save the shortlist, watch deadlines, confirm everything on the provider’s own page.' }
];
