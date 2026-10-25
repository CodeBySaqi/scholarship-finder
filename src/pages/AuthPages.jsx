import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PublicShell } from '../components/Shell.jsx';
import { Card, Icon, Field, Btn, Notice, useToast, Input } from '../components/ui.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';

function AuthHead({ title, sub }) {
  return <div className="phead" style={{ marginTop: 8 }}>
    <h1 className="h1">{title}</h1>
    {sub && <p className="cap">{sub}</p>}
  </div>;
}

/* ------------------------------------------------------------------- login */
export function Login() {
  const [email, setEmail] = useState('ayesha@example.com');
  const [password, setPassword] = useState('demo1234');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(null);
  const { login } = useAuth();
  const nav = useNavigate();
  const toast = useToast();

  async function go(mail) {
    setErr(''); setBusy(true); setNeedsVerify(null);
    try {
      const user = await login(mail, mail === email ? password : 'demo1234');
      toast('Signed in as ' + user.displayName);
      nav(user.role === 'admin' || user.role === 'contributor' ? '/admin' : '/dashboard');
    } catch (e) {
      if (e.data && e.data.verifyToken) setNeedsVerify(e.data.verifyToken);
      else setErr(e.message);
    } finally { setBusy(false); }
  }

  return (
    <PublicShell minimal page="login">
      <div style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
        <AuthHead title="Log in" sub="Your profile, saved list and matches are waiting." />
        <form className="card card--pad-l" noValidate style={{ marginTop: 'var(--gap)' }}
          onSubmit={(e) => { e.preventDefault(); go(email); }}>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="input" />
          </Field>
          <Field label="Password" htmlFor="password" help={<Link to="/forgot-password">Forgot password?</Link>}>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="input" />
          </Field>
          {err && <div className="form-error" role="alert">{err}</div>}
          {needsVerify && (
            <div className="form-error" role="alert">
              Verify your email first. <Link to={'/verify-email?token=' + needsVerify}>Open the verification screen</Link>
            </div>
          )}
          <div className="check"><input type="checkbox" id="remember" defaultChecked /><label htmlFor="remember">Keep me signed in on this device</label></div>
          <Btn variant="filled" block type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</Btn>
          <div className="divider-v" style={{ height: 1, width: 'auto', margin: '2px 0' }} />
          <p className="cap">Demo accounts — every one uses the password <b className="w500">demo1234</b>.</p>
          <Btn block disabled={busy} onClick={() => go('ayesha@example.com')}>Continue as demo student (Ayesha)</Btn>
          <Btn block disabled={busy} onClick={() => go('admin@example.com')}>Continue as demo admin</Btn>
          <Btn block disabled={busy} onClick={() => go('contributor@example.com')}>Continue as demo contributor</Btn>
          <p className="cap center">New here? <Link to="/signup">Create an account</Link></p>
        </form>

        <Card  style={{ marginTop: 'var(--gap)' }}>
          <div className="row" style={{ gap: 8 }}>
            <Icon name="shield" size={18} style={{ color: 'var(--text-2)' }} />
            <p className="cap" style={{ flex: 1 }}>Unverified accounts cannot reach the dashboard. The verification email is sent right after sign-up.</p>
          </div>
        </Card>
      </div>
    </PublicShell>
  );
}

/* ------------------------------------------------------------------ signup */
export function Signup() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { signup } = useAuth();
  const nav = useNavigate();
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!consent) return setErr('Please accept the Privacy Policy and Terms to continue.');
    if (form.password.length < 8) return setErr('Use at least 8 characters for your password.');
    setBusy(true);
    try {
      const r = await signup(form.fullName, form.email, form.password);
      nav('/verify-email?token=' + r.verifyToken + '&email=' + encodeURIComponent(form.email));
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <PublicShell minimal page="signup">
      <div style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <AuthHead title="Create your account" sub="Two minutes now, then every listing shows what you meet." />
        <form className="card card--pad-l" noValidate style={{ marginTop: 'var(--gap)' }} onSubmit={submit}>
          <Field label="Full name" htmlFor="name">
            <Input id="name" autoComplete="name" placeholder="As printed on your documents" value={form.fullName} onChange={set('fullName')} required className="input" />
          </Field>
          <Field label="Email" htmlFor="email" help="We send one verification link and, if you want them, deadline alerts.">
            <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required className="input" />
          </Field>
          <Field label="Password" htmlFor="password" help="Use 8 or more characters. A passphrase works well.">
            <Input id="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={set('password')} required className="input" />
          </Field>
          <div className="check" style={{ marginTop: 2 }}>
            <input type="checkbox" id="consent" checked={consent} onChange={e => setConsent(e.target.checked)} />
            <label htmlFor="consent">I agree to the <Link to="/privacy">Privacy Policy</Link> and <Link to="/terms">Terms of use</Link>.</label>
          </div>
          {err && <p className="err" role="alert"><Icon name="alert" size={13} />{err}</p>}
          <Btn variant="filled" block type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Btn>
          <Notice tone="info" icon="shield">We never ask for your CNIC, passport number, bank details or document uploads. Grade and score data stays in your profile and is only used for matching.</Notice>
          <p className="cap center">Already have an account? <Link to="/login">Log in</Link></p>
        </form>
      </div>
    </PublicShell>
  );
}

/* ------------------------------------------------------------- verify mail */
export function VerifyEmail() {
  const [params] = useSearchParams();
  const { verify } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');
  const token = params.get('token');
  const email = params.get('email') || 'your email';

  async function doVerify() {
    setState('busy');
    try {
      await verify(token);
      nav('/dashboard');
    } catch (e) { setMsg(e.message); setState('error'); }
  }

  return (
    <PublicShell minimal page="verify">
      <div style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
        <Card  style={{ textAlign: 'center', alignItems: 'center', marginTop: 16 }} className="card card--pad-l">
          <span className="brand__mark" style={{ width: 52, height: 52, borderRadius: 14 }}><Icon name="mail" size={26} /></span>
          <h1 className="h1">Check your inbox</h1>
          <p className="cap" style={{ maxWidth: '36ch' }}>We sent a verification link to <b className="w500">{email}</b>. Open it on this device to finish setting up your account.</p>
          {msg && <div className="form-error" role="alert" style={{ width: '100%' }}>{msg}</div>}
          {token
            ? <Btn variant="filled" block onClick={doVerify} disabled={state === 'busy'} style={{ marginTop: 6 }}>{state === 'busy' ? 'Verifying…' : 'I have verified my email'}</Btn>
            : <Btn variant="filled" block to="/dashboard" style={{ marginTop: 6 }}>I have verified my email</Btn>}
          <p className="cap" style={{ margin: 0 }}>No mail server here: this link is the verification step itself.</p>
        </Card>

        <Card  style={{ marginTop: 'var(--gap)' }}>
          <h2 className="h2">Nothing arrived?</h2>
          <div className="rows">
            <div className="row-top"><span className="tag tag--out">1</span><p className="cap">Wait a minute: delivery can lag. Check the spam or promotions folder.</p></div>
            <div className="row-top"><span className="tag tag--out">2</span><p className="cap">Make sure the address has no typos. You can change it and sign up again.</p></div>
            <div className="row-top"><span className="tag tag--out">3</span><p className="cap">Still stuck? Email the address on the privacy page and we will verify manually.</p></div>
          </div>
        </Card>
      </div>
    </PublicShell>
  );
}

/* --------------------------------------------------------------- forgot pw */
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetUrl, setResetUrl] = useState(null);
  const nav = useNavigate();
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    const r = await api.post('/auth/forgot', { email });
    setBusy(false);
    setResetUrl(r.resetUrl);
    if (r.resetUrl) nav('/reset-sent?reset=' + encodeURIComponent(r.resetUrl) + '&email=' + encodeURIComponent(email));
    else nav('/reset-sent?email=' + encodeURIComponent(email));
  }
  return (
    <PublicShell minimal page="forgot">
      <div style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
        <AuthHead title="Reset your password" sub="Enter the email you signed up with. We send a link that expires in one hour." />
        <form className="card card--pad-l" style={{ marginTop: 'var(--gap)' }} onSubmit={submit}>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="input" />
          </Field>
          <Btn variant="filled" block type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Btn>
          <Btn variant="text" block to="/login">Back to log in</Btn>
        </form>
      </div>
    </PublicShell>
  );
}

export function ResetSent() {
  const [params] = useSearchParams();
  const reset = params.get('reset');
  const email = params.get('email') || 'your email';
  return (
    <PublicShell minimal page="reset-sent">
      <div style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
        <Card  style={{ textAlign: 'center', alignItems: 'center', marginTop: 16 }} className="card card--pad-l">
          <span className="brand__mark" style={{ width: 52, height: 52, borderRadius: 14 }}><Icon name="check" size={26} /></span>
          <h1 className="h1">Reset link sent</h1>
          <p className="cap" style={{ maxWidth: '36ch' }}>If an account exists for <b className="w500">{email}</b>, the link is on its way. It expires in one hour.</p>
          <Btn variant="filled" block to={reset ? '/reset-password?token=' + new URLSearchParams(reset.split('?')[1] || '').get('token') : '/reset-password'} style={{ marginTop: 6 }}>Open the reset screen</Btn>
          <Btn variant="text" block to="/login">Back to log in</Btn>
        </Card>
        <p className="cap center" style={{ marginTop: 'var(--gap)' }}>We do not say whether an address is registered. That would let anyone test emails against the platform.</p>
      </div>
    </PublicShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const token = params.get('token');

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (p1.length < 8) return setErr('Use at least 8 characters.');
    if (p1 !== p2) return setErr('The two passwords do not match.');
    if (!token) return setErr('This screen needs the link from your reset email.');
    setBusy(true);
    try { await api.post('/auth/reset', { token, password: p1 }); setOk(true); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <PublicShell minimal page="reset">
      <div style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
        <AuthHead title="Choose a new password" sub="Signing in again everywhere else will need this new password." />
        {ok
          ? <Card  style={{ textAlign: 'center', alignItems: 'center', marginTop: 'var(--gap)' }} className="card card--pad-l">
              <span className="brand__mark" style={{ width: 52, height: 52, borderRadius: 14 }}><Icon name="check" size={26} /></span>
              <h2 className="h2">Password saved</h2>
              <p className="cap">You can sign in with the new password now.</p>
              <Btn variant="filled" block to="/login">Go to log in</Btn>
            </Card>
          : <form className="card card--pad-l" noValidate style={{ marginTop: 'var(--gap)' }} onSubmit={submit}>
              <Field label="New password" htmlFor="p1" help="8 or more characters. Avoid your name, email or birth year.">
                <Input id="p1" type="password" autoComplete="new-password" value={p1} onChange={e => setP1(e.target.value)} className="input" />
              </Field>
              <Field label="Repeat new password" htmlFor="p2">
                <Input id="p2" type="password" autoComplete="new-password" value={p2} onChange={e => setP2(e.target.value)} className="input" />
              </Field>
              {err && <p className="err" role="alert"><Icon name="alert" size={13} />{err}</p>}
              <Btn variant="filled" block type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</Btn>
            </form>}
      </div>
    </PublicShell>
  );
}
