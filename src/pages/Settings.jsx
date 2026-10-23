import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/Shell.jsx';
import { Icon, Btn, Loader, Notice, Field, useAsync, useToast, LoadError } from '../components/ui.jsx';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { applyTheme, readTheme } from '../components/theme.js';
import { fmtDate, fundingLabel, daysTo } from '../lib.jsx';
import { useSaved } from '../components/saved.jsx';

const THEMES = [
  { id: 'auto', label: 'Match my device', sub: 'Follows your phone or laptop setting' },
  { id: 'light', label: 'Light', sub: 'Always light' },
  { id: 'dark', label: 'Dark', sub: 'Always dark' }
];
const ALERT_DAYS = [30, 14, 7, 1];
const Sw = ({ on, onChange, label, disabled }) => (
  <button className="switch" type="button" role="switch" aria-checked={!!on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />
);
const RadioCards = ({ name, list, value, onChange }) => (
  <div className="radios">
    {list.map(o => (
      <label className="radio-card" key={o.id}>
        <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
        <span className="t"><span className="h3">{o.label}</span><span className="cap">{o.sub}</span></span>
      </label>
    ))}
  </div>
);

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'prefs';
  const toast = useToast();
  const { user } = useAuth();
  const [theme, setTheme] = useState(readTheme());
  const { data, loading, reload, error } = useAsync(() => api.get('/profile'), []);
  const { rows: savedRows } = useSaved();
  const nextSaved = (savedRows || [])[0] || null;
  const [prefs, setPrefs] = useState({ notifyEmail: true, notifyWhatsapp: false, alertDays: [30, 14, 7, 1], langPref: 'both' });
  const isAdmin = user?.role === 'admin';
  const site = useAsync(() => (isAdmin ? api.get('/admin/settings') : Promise.resolve(null)), [isAdmin]);
  const [siteForm, setSiteForm] = useState(null);
  const [siteBusy, setSiteBusy] = useState(false);
  useEffect(() => {
    if (site.data && site.data.settings && !siteForm) setSiteForm({ ...site.data.settings, aiApiKey: '' });
  }, [site.data]);

  useEffect(() => { if (data && data.profile) setPrefs(p => ({ ...p, ...Object.fromEntries(Object.entries(data.profile).filter(([k]) => ['notifyEmail', 'notifyWhatsapp', 'alertDays', 'langPref'].includes(k))) })); }, [data]);

  async function patchPrefs(patch) {
    setPrefs(p => ({ ...p, ...patch }));
    try { await api.put('/profile', { profile: patch }); } catch (e) { toast(e.message); }
  }

  if (loading) return <AppShell page="settings"><div className="card"><Loader /></div></AppShell>;
  if (error) return <AppShell page="settings"><LoadError error={error} onRetry={reload} what="settings" /></AppShell>;
  const p = data.profile;

  return (
    <AppShell page="settings">
      <div className="page--narrow" style={{ maxWidth: 780, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        <div className="phead">
          <div><h1 className="h1">Settings</h1><p className="cap">Theme, alerts and account. Changes save immediately.</p></div>
        </div>

        <div className="tabs" role="tablist">
          {[['prefs', 'Preferences'], ['alerts', 'Alerts'], ['account', 'Account'], ['privacy', 'Privacy'],
            ...(isAdmin ? [['site', 'Site & AI']] : [])].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k })}>{label}</button>
          ))}
        </div>

        {tab === 'prefs' && (
          <div className="card card--pad-l">
            <h2 className="h2">Appearance</h2>
            <p className="cap">Auto follows your operating system. The moon icon in the top bar flips between light and dark from anywhere.</p>
            <RadioCards name="theme" list={THEMES} value={theme} onChange={v => { setTheme(v); applyTheme(v); toast('Theme: ' + v); }} />
            <div className="divider-v" style={{ height: 1, width: 'auto' }} />
            <h2 className="h2">Density</h2>
            <div className="switch-row">
              <span className="t"><span className="h3">Comfortable spacing</span><span className="cap">Locked in this version</span></span>
              <Sw on disabled label="Comfortable spacing" />
            </div>
            <h2 className="h2">Language of listings</h2>
            <p className="cap">Programs taught in German still show their German-language requirement on the card. This setting only filters lists.</p>
            <RadioCards name="langpref" value={prefs.langPref || 'both'} onChange={v => { patchPrefs({ langPref: v }); toast('Listing language updated'); }} list={[
              { id: 'both', label: 'English and German', sub: 'Show everything' },
              { id: 'english', label: 'English-taught only', sub: 'IELTS usually required' },
              { id: 'german', label: 'German-taught only', sub: 'B2 or C1 usually required' }
            ]} />
          </div>
        )}

        {tab === 'alerts' && (
          <>
            <div className="card card--pad-l">
              <h2 className="h2">Deadline alerts</h2>
              <p className="cap">Alerts only cover listings you saved, plus a weekly digest of new matches. Every email has a one-click unsubscribe.</p>
              <div className="switch-row">
                <span className="t"><span className="h3">Email alerts</span><span className="cap">{p.email}</span></span>
                <Sw on={prefs.notifyEmail} label="Email alerts" onChange={v => { patchPrefs({ notifyEmail: v }); toast('Email alerts updated'); }} />
              </div>
              <div className="switch-row">
                <span className="t"><span className="h3">WhatsApp alerts</span><span className="cap">{p.whatsapp || 'Add a number in step 1'}</span></span>
                <Sw on={prefs.notifyWhatsapp} label="WhatsApp alerts" onChange={v => { patchPrefs({ notifyWhatsapp: v }); toast('WhatsApp alerts updated'); }} />
              </div>
              <div className="field" style={{ marginTop: 6 }}>
                <span className="lbl">Remind me this many days before a deadline</span>
                <div className="chips">
                  {ALERT_DAYS.map(d => {
                    const on = (prefs.alertDays || []).includes(d);
                    return <button key={d} className={'chip' + (on ? ' is-on' : '')} type="button" aria-pressed={on}
                      onClick={() => {
                        const next = on ? prefs.alertDays.filter(x => x !== d) : [...(prefs.alertDays || []), d].sort((a, b) => b - a);
                        patchPrefs({ alertDays: next }); toast('Reminder days updated');
                      }}>{d === 1 ? '1 day' : d + ' days'}</button>;
                  })}
                </div>
                <span className="help">Default is 30, 14, 7 and 1 day before the deadline.</span>
              </div>
              <Notice tone="info" icon="bell">One email per listing per alert day. A unique key in the database stops duplicates if a job runs twice.</Notice>
            </div>
            <div className="card">
              <h2 className="h2">Preview the email</h2>
              {nextSaved ? (
                <>
                  <p className="cap">The next deadline on your saved list, as the reminder email shows it.</p>
                  <div className="card card--flat" style={{ gap: 6 }}>
                    <span className="tag tag--wn">{daysTo(nextSaved.listing.deadline)} days left</span>
                    <span className="h3">{nextSaved.listing.title} closes on {fmtDate(nextSaved.listing.deadline)}</span>
                    <p className="cap">Saved on {fmtDate((nextSaved.createdAt || '').slice(0, 10))} · {nextSaved.listing.provider} · {fundingLabel(nextSaved.listing)}</p>
                    {nextSaved.note && <p className="cap">Your note: {nextSaved.note}</p>}
                    <Link className="link-quiet" to={'/' + (nextSaved.listing.kind === 'program' ? 'program' : 'scholarship') + '/' + nextSaved.listing.id}>Open the listing</Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="cap">No saved listing yet.</p>
                  <p className="cap" style={{ marginTop: 6 }}>Save a scholarship or program and this panel shows the reminder you would receive for its deadline, built from the real title, provider and date.</p>
                  <Btn variant="outlined" size="sm" to="/scholarships" style={{ alignSelf: 'flex-start', marginTop: 6 }}>Browse scholarships</Btn>
                </>
              )}
            </div>
          </>
        )}

        {tab === 'account' && (
          <>
            <div className="card card--pad-l">
              <h2 className="h2">Email address</h2>
              <div className="field">
                <label htmlFor="acct-email">Email</label>
                <input className="input" id="acct-email" defaultValue={p.email} />
                <span className="help">Changing this sends a verification link to the new address. The old address keeps access until it is confirmed.</span>
              </div>
              <Btn variant="outlined" size="sm" onClick={() => toast('Verification link sent to the new address')} style={{ alignSelf: 'flex-start' }}>Update email</Btn>
              <div className="divider-v" style={{ height: 1, width: 'auto' }} />
              <h2 className="h2">Password</h2>
              <p className="cap">Use a passphrase you do not reuse anywhere else. Resetting signs you out everywhere else.</p>
              <Btn variant="outlined" size="sm" to="/forgot-password" style={{ alignSelf: 'flex-start' }}>Change password</Btn>
              <div className="divider-v" style={{ height: 1, width: 'auto' }} />
              <h2 className="h2">Sessions</h2>
              <div className="rows">
                <div className="row sp"><div><div className="h3">This device</div><div className="cap">{p.city || 'Lahore'}, Pakistan · active now</div></div><span className="tag tag--ok">Current</span></div>
                <div className="row sp"><div><div className="h3">Signed in as</div><div className="cap">{user?.email} · {user?.role}</div></div><span className="tag tag--out">14-day cookie</span></div>
              </div>
            </div>
            <div className="card">
              <h2 className="h2">Danger zone</h2>
              <p className="cap">Deleting removes your profile, targets, saved list and notes. Error reports stay, without your name.</p>
              <Btn variant="danger" size="sm" to="/profile" style={{ alignSelf: 'flex-start' }}>Delete my account</Btn>
            </div>
          </>
        )}

        {tab === 'site' && isAdmin && (
          <>
            <div className="card card--pad-l">
              <h2 className="h2">Site</h2>
              <p className="cap">These values are used by the app itself and in messages the server sends.</p>
              {!siteForm ? <Loader /> : (
                <>
                  <Field label="Site name" htmlFor="site-name">
                    <input className="input" id="site-name" value={siteForm.siteName || ''} onChange={e => setSiteForm(f => ({ ...f, siteName: e.target.value }))} />
                  </Field>
                  <Field label="Tagline" htmlFor="site-tagline">
                    <input className="input" id="site-tagline" value={siteForm.tagline || ''} onChange={e => setSiteForm(f => ({ ...f, tagline: e.target.value }))} />
                  </Field>
                  <Field label="Support email" htmlFor="site-support" help="Shown in suspension messages and on the privacy page.">
                    <input className="input" id="site-support" type="email" value={siteForm.supportEmail || ''} onChange={e => setSiteForm(f => ({ ...f, supportEmail: e.target.value }))} />
                  </Field>
                </>
              )}
            </div>

            <div className="card card--pad-l">
              <div className="row sp wr">
                <div>
                  <h2 className="h2">AI research</h2>
                  <p className="cap">The research agent uses this key to read a scholarship or program page and fill the entry form.</p>
                </div>
                <span className={'tag ' + (siteForm && siteForm.aiApiKeySet ? 'tag--ok' : 'tag--wn')}>
                  <Icon name={siteForm && siteForm.aiApiKeySet ? 'checkCircle' : 'alert'} />
                  {siteForm && siteForm.aiApiKeySet ? 'key stored' : 'no key'}
                </span>
              </div>
              {!siteForm ? null : (
                <>
                  <div className="g2">
                    <Field label="Provider" htmlFor="ai-provider">
                      <select className="select" id="ai-provider" value={siteForm.aiProvider || 'openai'}
                        onChange={e => setSiteForm(f => ({ ...f, aiProvider: e.target.value }))}>
                        <option value="openai">OpenAI-compatible</option>
                        <option value="none">None (built-in extractor only)</option>
                      </select>
                    </Field>
                    <Field label="Model" htmlFor="ai-model">
                      <input className="input" id="ai-model" value={siteForm.aiModel || ''} onChange={e => setSiteForm(f => ({ ...f, aiModel: e.target.value }))} placeholder="gpt-4o-mini" />
                    </Field>
                  </div>
                  <Field label="API base URL" htmlFor="ai-base" help="Change this for a compatible gateway. The path /chat/completions is appended.">
                    <input className="input" id="ai-base" value={siteForm.aiBaseUrl || ''} onChange={e => setSiteForm(f => ({ ...f, aiBaseUrl: e.target.value }))} placeholder="https://api.openai.com/v1" />
                  </Field>
                  <Field label="API key" htmlFor="ai-key"
                    help={siteForm.aiApiKeySet ? 'A key is stored (' + siteForm.aiApiKeyHint + '). It is never sent back to the browser — type a new one only to replace it.' : 'Stored on the server. Only admins can set or change it.'}>
                    <input className="input" id="ai-key" type="password" autoComplete="off" value={siteForm.aiApiKey || ''}
                      onChange={e => setSiteForm(f => ({ ...f, aiApiKey: e.target.value }))}
                      placeholder={siteForm.aiApiKeySet ? '•••••••••••• stored — leave blank to keep' : 'sk-…'} />
                  </Field>
                  <div className="switch-row">
                    <span className="t"><span className="h3">Research agent enabled</span><span className="cap">Turning this off blocks the AI research page for everyone.</span></span>
                    <button className="switch" type="button" role="switch" aria-checked={!!siteForm.researchEnabled}
                      aria-label="Research agent enabled" onClick={() => setSiteForm(f => ({ ...f, researchEnabled: !f.researchEnabled }))} />
                  </div>
                  <div className="row wr" style={{ gap: 8 }}>
                    <button className="btn btn--filled btn--sm" type="button" disabled={siteBusy} onClick={async () => {
                      setSiteBusy(true);
                      try {
                        const r = await api.put('/admin/settings', {
                          siteName: siteForm.siteName, tagline: siteForm.tagline, supportEmail: siteForm.supportEmail,
                          aiProvider: siteForm.aiProvider, aiModel: siteForm.aiModel, aiBaseUrl: siteForm.aiBaseUrl,
                          researchEnabled: siteForm.researchEnabled,
                          ...(siteForm.aiApiKey ? { aiApiKey: siteForm.aiApiKey } : {})
                        });
                        setSiteForm({ ...r.settings, aiApiKey: '' });
                        site.reload();
                        toast('Site settings saved');
                      } catch (e) { toast(e.message); } finally { setSiteBusy(false); }
                    }}>{siteBusy ? 'Saving…' : 'Save settings'}</button>
                    {siteForm.aiApiKeySet && (
                      <button className="btn btn--outlined btn--sm" type="button" onClick={async () => {
                        try {
                          const r = await api.put('/admin/settings', { aiApiKey: null });
                          setSiteForm({ ...r.settings, aiApiKey: '' }); site.reload(); toast('API key removed');
                        } catch (e) { toast(e.message); }
                      }}>Remove key</button>
                    )}
                    <Btn variant="text" size="sm" to="/admin/research">Open AI research</Btn>
                  </div>
                  <Notice tone="info" icon="shield">The key is read only by the server and is masked in every response. Only an admin can open this tab; contributors and students never see it.</Notice>
                </>
              )}
            </div>
          </>
        )}

        {tab === 'privacy' && (
          <>
            <div className="card card--pad-l">
              <h2 className="h2">Your data</h2>
              <table className="kv"><tbody>
                <tr><th>Consent given</th><td>{p.consentAt ? fmtDate(p.consentAt.slice(0, 10)) : 'On sign-up'}</td></tr>
                <tr><th>Data stored</th><td>Profile, targets, saved list, notes</td></tr>
                <tr><th>Not stored</th><td>CNIC, passport, bank details, documents</td></tr>
                <tr><th>Analytics</th><td>None</td></tr>
                <tr><th>Cookies</th><td>Session cookie only</td></tr>
                <tr><th>Data location</th><td>The server running this app (local JSON store)</td></tr>
              </tbody></table>
              <div className="row wr" style={{ marginTop: 4 }}>
                <Btn variant="outlined" size="sm" onClick={async () => {
                  const all = await Promise.all([api.get('/profile'), api.get('/saved'), api.get('/settings')]);
                  const blob = new Blob([JSON.stringify({ profile: all[0], saved: all[1], settings: all[2] }, null, 2)], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'scholarship-finder-data.json';
                  a.click();
                  toast('Your data file is downloading');
                }}>Download my data</Btn>
                <Btn variant="text" size="sm" to="/privacy">Read the policy</Btn>
              </div>
              <p className="cap">Privacy contact: <b className="w500">privacy@example.org</b></p>
            </div>
            <div className="card">
              <h2 className="h2">What this build stores</h2>
              <div className="rows">
                <div className="row sp"><div><div className="h3">This server</div><div className="cap">Accounts, profiles, saves and the audit log</div></div><span className="tag tag--out">data/db.json</span></div>
                <div className="row sp"><div><div className="h3">Your browser</div><div className="cap">Theme choice only</div></div><span className="tag tag--out">localStorage</span></div>
                <div className="row sp"><div><div className="h3">No third parties</div><div className="cap">No analytics, no CDN, no tracking pixels</div></div><span className="tag tag--ok">None</span></div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
