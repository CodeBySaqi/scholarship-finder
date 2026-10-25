import React from 'react';
import { PublicShell } from '../components/Shell.jsx';
import { Card, Btn } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <PublicShell page="404">
      <div className="page--narrow" style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <Card>
          <div className="empty">
            <span className="num" style={{ fontSize: 44, color: 'var(--text-2)' }}>404</span>
            <h3 className="h2">That page does not exist</h3>
            <p className="cap">The link may be old, or the listing may have been removed. Searching from the dashboard is usually faster.</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Btn variant="filled" size="sm" to="/dashboard">Go to dashboard</Btn>
              <Btn variant="outlined" size="sm" to="/scholarships">Browse</Btn>
            </div>
          </div>
        </Card>
      </div>
    </PublicShell>
  );
}
