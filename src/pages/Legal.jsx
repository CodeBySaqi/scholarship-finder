import React from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '../components/Shell.jsx';

export function Terms() {
  return (
    <PublicShell page="terms">
      <div className="page--narrow" style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        <div className="phead">
          <span className="tag tag--out">Legal</span>
          <h1 className="h1">Terms of use</h1>
          <p className="cap">Last updated 21 October 2026.</p>
        </div>

        <section className="card card--warning">
          <h2 className="h2" style={{ color: 'inherit' }}>The important one, first</h2>
          <p style={{ color: 'inherit', fontSize: 14 }}>This service is guidance, not an admission decision and not legal advice. “Meets published minimums” means the checks we could run against the provider’s published requirements passed on the date shown. It does not mean you will be selected, and it does not replace the provider’s own rules.</p>
        </section>

        {[
          ['1. Who we are and what this is', <p className="body">Scholarship Finder is an independent directory and matching tool for Pakistani students looking at scholarships and German university programs. We are not affiliated with any provider, university, uni-assist, APS or IBCC.</p>],
          ['2. Using the service', <ul className="col-8 body" style={{ paddingLeft: 18, listStyle: 'disc' }}>
            <li>You need an account with a working email address.</li>
            <li>Give accurate answers. Wrong scores produce wrong matches, and the match is only as good as your profile.</li>
            <li>Do not scrape, resell or bulk-copy the directory.</li>
            <li>Do not attempt to access another student’s data or an admin area you were not given.</li>
          </ul>],
          ['3. Accuracy and freshness', <>
            <p className="body">Every listing shows the date it was last verified against the official page. Listings unverified for 90 days carry a “Needs recheck” tag and after 180 days are removed from results until a human verifies them again.</p>
            <p className="body">Providers change deadlines and requirements without notice. Always confirm the deadline, the requirements and the fee on the official page before you apply or pay anything.</p>
          </>],
          ['4. Grades and language conversions', <p className="body">The German grade we show is an estimate from a standard formula. Universities and uni-assist decide your final converted grade. Deadlines for test validity are also an estimate: check the provider’s own rule for IELTS and TOEFL validity.</p>],
          ['5. Third-party links and fees', <p className="body">Applying happens on the provider’s site, not ours. We never take an application fee and we will never ask you to pay a fee to us. If a page you reached from here asks for money, stop and report it.</p>],
          ['6. Your content', <p className="body">Your profile, targets, saved list and notes belong to you. You grant us only the permission needed to store and process them so the service works. Notes are private.</p>],
          ['7. Availability and liability', <p className="body">We work to keep the service online but cannot promise uninterrupted access. To the extent the law allows, we are not liable for decisions made by providers, missed deadlines, or losses from relying on a listing without checking the official page.</p>],
          ['8. Changes to these terms', <p className="body">If these terms change in a way that matters, we email registered users before the change takes effect. Continuing to use the service after that means you accept the new version.</p>]
        ].map(([title, body]) => (
          <section className="card" key={title}><h2 className="h1">{title}</h2>{body}</section>
        ))}

        <div className="row wr">
          <Link className="btn btn--outlined btn--sm" to="/privacy">Privacy policy</Link>
          <Link className="btn btn--text btn--sm" to="/">Back to home</Link>
        </div>
      </div>
    </PublicShell>
  );
}

export function Privacy() {
  const sections = [
    ['what', '1. What we collect', <>
      <p className="body">An account needs only an email address and a password. If you build a profile, we store the answers you choose to give: your date of birth, city and province, education level and results, test scores, German level, funding need, income bracket (optional), APS and IBCC status, a documents checklist, your targets, and the listings you save with any private notes.</p>
      <p className="body">We also store the time you accepted these terms, and technical logs needed to keep the service running.</p>
    </>],
    ['why', '2. Why we collect it', <>
      <ul className="col-8 body" style={{ paddingLeft: 18, listStyle: 'disc' }}>
        <li>To check each listing’s published minimums against your profile and group results.</li>
        <li>To show deadlines and send alerts you asked for.</li>
        <li>To keep your saved list and notes available across devices.</li>
        <li>To keep the listings accurate, using anonymous error reports.</li>
      </ul>
      <p className="cap">Our basis for processing is your consent, given at sign-up, and the service you asked us to provide.</p>
    </>],
    ['never', '3. What we never collect', <>
      <ul className="col-8" style={{ paddingLeft: 18, listStyle: 'disc', color: 'inherit', fontSize: 14 }}>
        <li>CNIC or passport numbers</li>
        <li>Bank details, statements or income proof documents</li>
        <li>Uploaded transcripts, certificates or photographs</li>
        <li>Your password in readable form</li>
      </ul>
      <p style={{ color: 'inherit', fontSize: 13 }}>Matching needs numbers and dates, not documents. Any application documents go directly to the provider’s own portal, never through us.</p>
    </>],
    ['share', '4. Who else sees your data', <>
      <table className="kv"><tbody>
        <tr><th>This server</th><td>Database and authentication. Only you can read your profile.</td></tr>
        <tr><th>Email sender</th><td>Sends verification, deadline and digest emails. Receives your email address and the listing titles in the email.</td></tr>
        <tr><th>AI extraction</th><td>Drafts listing text from public provider pages for a human to review. It never receives student profiles or saved lists.</td></tr>
        <tr><th>Other students</th><td>Nothing. Other students cannot see your profile, matches, notes or that you saved a listing.</td></tr>
        <tr><th>Admins</th><td>Admins can see profiles only to answer a support request, and every access is logged.</td></tr>
      </tbody></table>
      <p className="cap">We do not sell data and we do not run advertising or a data broker integration.</p>
    </>],
    ['keep', '5. How long we keep it', <p className="body">Your profile stays until you delete it. Deleting your account removes your profile, targets, saved list and notes immediately. Anonymous error reports and audit-log entries stay, without your name attached.</p>],
    ['rights', '6. Your choices and rights', <div className="rows">
      <div><div className="h3">Change anything</div><p className="cap">Every field can be edited or cleared in the profile wizard, and you can mark optional questions “prefer not to say”.</p></div>
      <div><div className="h3">Download your data</div><p className="cap">Settings → Privacy → Download my data gives you a machine-readable copy.</p></div>
      <div><div className="h3">Delete your data</div><p className="cap">Profile → Delete my account. No waiting period and no “are you sure” email loop.</p></div>
      <div><div className="h3">Turn off emails</div><p className="cap">One switch in Settings → Alerts, or the unsubscribe link in every email.</p></div>
    </div>],
    ['cookies', '7. Cookies and analytics', <>
      <p className="body">There is one cookie: the session cookie that keeps you logged in. There is no analytics script, no advertising pixel and no session recording. We do not use third-party fonts or tracking images.</p>
      <p className="cap">The theme you pick is stored in your browser only. Everything else lives in the app’s own JSON store.</p>
    </>],
    ['contact', '8. Contact', <>
      <p className="body">Questions about your data, or a request to delete it by email: <b className="w500">privacy@example.org</b></p>
      <p className="cap">If you are under 18, please use the platform with a parent or guardian.</p>
    </>]
  ];
  return (
    <PublicShell page="privacy">
      <div className="page--narrow" style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        <div className="phead">
          <span className="tag tag--out">Legal</span>
          <h1 className="h1">Privacy policy</h1>
          <p className="cap">Last updated 21 October 2026. Written in plain language on purpose.</p>
        </div>

        <nav className="card" aria-label="Contents">
          <h2 className="h3">On this page</h2>
          <div className="rows" style={{ fontSize: 13 }}>
            {sections.map(([id, title]) => <a href={'#' + id} key={id}>{title}</a>)}
          </div>
        </nav>

        {sections.map(([id, title, body]) => (
          <section className={'card' + (id === 'never' ? ' card--danger' : '')} id={id} key={id}>
            <h2 className="h1" style={id === 'never' ? { color: 'inherit' } : undefined}>{title}</h2>
            {id === 'never' ? <div style={{ color: 'inherit' }}>{body}</div> : body}
          </section>
        ))}

        <div className="row wr">
          <Link className="btn btn--outlined btn--sm" to="/terms">Terms of use</Link>
          <Link className="btn btn--text btn--sm" to="/">Back to home</Link>
        </div>
      </div>
    </PublicShell>
  );
}
