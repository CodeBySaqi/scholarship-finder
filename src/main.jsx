import React, { Component, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { HeroUIProvider } from '@heroui/react';
import { AuthProvider, useAuth } from './auth.jsx';
import { Card, ToastProvider, Loader, Icon, Btn } from './components/ui.jsx';
import { SavedProvider } from './components/saved.jsx';
import { NotificationsProvider } from './components/notifications.jsx';
import { applyTheme, readTheme, watchTheme } from './components/theme.js';
import './styles/tokens.css';
import './styles/app.css';
import './styles/react.css';
/* HeroUI + Tailwind load last: HeroUI paints the components, the app's own
   stylesheets keep owning the layout (see src/styles/heroui.css). */
import './styles/heroui.css';
import './styles/landing-variants.css';
import './styles/footer.css';

import Landing from './pages/Landing.jsx';
import DesignIndex, { DesignPreview } from './pages/landing/DesignIndex.jsx';
import { Login, Signup, VerifyEmail, ForgotPassword, ResetSent, ResetPassword } from './pages/AuthPages.jsx';
import Browse from './pages/Browse.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Detail from './pages/Detail.jsx';
import Matches from './pages/Matches.jsx';
import Saved from './pages/Saved.jsx';
import Profile from './pages/Profile.jsx';
import Wizard from './pages/Wizard.jsx';
import Settings from './pages/Settings.jsx';
import { Terms, Privacy } from './pages/Legal.jsx';
import AdminOverview from './pages/admin/Overview.jsx';
import AdminListings from './pages/admin/Listings.jsx';
import ListingForm from './pages/admin/ListingForm.jsx';
import AdminQueue from './pages/admin/Queue.jsx';
import AdminErrors from './pages/admin/Errors.jsx';
import AiDraft from './pages/admin/AiDraft.jsx';
import AdminUniversities from './pages/admin/Universities.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminLogs from './pages/admin/Logs.jsx';
import Broadcast from './pages/admin/Broadcast.jsx';
import Research from './pages/admin/Research.jsx';
import Notifications from './pages/Notifications.jsx';
import NotFound from './pages/NotFound.jsx';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/* A crash must never leave a white page: show what broke and a way back. */
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[ui] render failed:', error, info && info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="boot">
        <Card  style={{ maxWidth: 520, textAlign: 'center' }}>
          <Icon name="alert" size={28} style={{ margin: '0 auto 8px', color: 'var(--on-danger)' }} />
          <h1 className="h2">This page could not be shown</h1>
          <p className="cap" style={{ marginTop: 6 }}>
            {String(this.state.error.message || this.state.error)}
          </p>
          <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 14 }}>
            <Btn variant="filled" size="sm" onClick={() => window.location.reload()}>Reload</Btn>
            <a className="btn btn--outlined btn--sm" href="/dashboard">Go to dashboard</a>
          </div>
        </Card>
      </div>
    );
  }
}

function BootError({ kind, onRetry }) {
  const offline = kind === 'offline';
  return (
    <div className="boot">
      <Card  style={{ maxWidth: 520, textAlign: 'center' }}>
        <Icon name={offline ? 'globe' : 'alert'} size={28} style={{ margin: '0 auto 8px', color: offline ? 'var(--on-warning)' : 'var(--on-danger)' }} />
        <h1 className="h2">{offline ? 'Cannot reach the server' : 'The server had a problem'}</h1>
        <p className="cap" style={{ marginTop: 6 }}>
          {offline
            ? 'Your connection or our server dropped the request, so the page could not load. Check your internet connection and try again.'
            : 'The server answered with an error. Nothing was lost — try again in a moment; if it keeps happening, contact support.'}
        </p>
        <Btn variant="filled" size="sm" style={{ marginTop: 14 }} onClick={onRetry}>Try again</Btn>
      </Card>
    </div>
  );
}

function NoAdminAccess({ role, onSwitch }) {
  return (
    <div className="boot">
      <Card  style={{ maxWidth: 560 }}>
        <div className="row" style={{ gap: 10 }}>
          <Icon name="shield" size={22} style={{ color: 'var(--on-warning)' }} />
          <h1 className="h2">Admin access required</h1>
        </div>
        <p className="cap" style={{ marginTop: 8 }}>
          You are signed in as <b className="w600">{role}</b>. The console is limited to administrators and
          contributors. If you were given an admin account, sign out and sign back in with it.
        </p>
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <a className="btn btn--filled btn--sm" href="/dashboard">Back to your dashboard</a>
          <Btn size="sm" onClick={onSwitch}>Sign in as someone else</Btn>
        </div>
      </Card>
    </div>
  );
}

function Guard({ children, admin }) {
  const { user, loading, bootError, logout, retryBoot } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="boot"><Loader /></div>;
  if (bootError) return <BootError kind={bootError} onRetry={retryBoot} />;
  if (!user) return <Navigate to={'/login?next=' + encodeURIComponent(loc.pathname)} replace />;
  if (admin && user.role !== 'admin' && user.role !== 'contributor') {
    return <NoAdminAccess role={user.role} onSwitch={async () => { await logout(); window.location.assign('/login?next=' + encodeURIComponent(loc.pathname)); }} />;
  }
  return children;
}

function App() {
  return (
    <Routes>
      {/* public */}
      <Route path="/" element={<Landing />} />
      {/* home-page design review — five candidates, not public navigation */}
      <Route path="/design" element={<DesignIndex />} />
      <Route path="/design/:slug" element={<DesignPreview />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      {/* auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-sent" element={<ResetSent />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* student app */}
      <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
      <Route path="/matches" element={<Guard><Matches /></Guard>} />
      <Route path="/scholarships" element={<Guard><Browse kind="scholarship" /></Guard>} />
      <Route path="/programs" element={<Guard><Browse kind="program" /></Guard>} />
      <Route path="/scholarship/:id" element={<Guard><Detail kind="scholarship" /></Guard>} />
      <Route path="/program/:id" element={<Guard><Detail kind="program" /></Guard>} />
      <Route path="/saved" element={<Guard><Saved /></Guard>} />
      <Route path="/profile" element={<Guard><Profile /></Guard>} />
      <Route path="/wizard" element={<Guard><Wizard /></Guard>} />
      <Route path="/settings" element={<Guard><Settings /></Guard>} />
      <Route path="/notifications" element={<Guard><Notifications /></Guard>} />

      {/* admin */}
      <Route path="/admin" element={<Guard admin><AdminOverview /></Guard>} />
      <Route path="/admin/listings" element={<Guard admin><AdminListings /></Guard>} />
      <Route path="/admin/listings/new" element={<Guard admin><ListingForm /></Guard>} />
      <Route path="/admin/listings/:id" element={<Guard admin><ListingForm /></Guard>} />
      <Route path="/admin/queue" element={<Guard admin><AdminQueue /></Guard>} />
      <Route path="/admin/errors" element={<Guard admin><AdminErrors /></Guard>} />
      <Route path="/admin/ai-draft" element={<Guard admin><AiDraft /></Guard>} />
      <Route path="/admin/universities" element={<Guard admin><AdminUniversities /></Guard>} />
      <Route path="/admin/users" element={<Guard admin><AdminUsers /></Guard>} />
      <Route path="/admin/logs" element={<Guard admin><AdminLogs /></Guard>} />
      <Route path="/admin/broadcast" element={<Guard admin><Broadcast /></Guard>} />
      <Route path="/admin/research" element={<Guard admin><Research /></Guard>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/* HeroUI needs to sit inside the router so its own links can navigate with it,
   and it has to wrap every route — the shells, the pages and the dialogs. */
function Providers({ children }) {
  const navigate = useNavigate();
  return (
    <HeroUIProvider navigate={navigate} locale="en-GB">
      {children}
    </HeroUIProvider>
  );
}

applyTheme(readTheme());
watchTheme();
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Providers>
    <ErrorBoundary><AuthProvider>
      <ToastProvider>
        <SavedProvider>
          <NotificationsProvider>
            <ScrollTop />
            <App />
          </NotificationsProvider>
        </SavedProvider>
      </ToastProvider>
    </AuthProvider></ErrorBoundary>
    </Providers>
  </BrowserRouter>
);
