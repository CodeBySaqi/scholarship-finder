import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/auth.jsx';
import { ToastProvider } from '../src/components/ui.jsx';
import { SavedProvider } from '../src/components/saved.jsx';
import { NotificationsProvider } from '../src/components/notifications.jsx';

import Landing from '../src/pages/Landing.jsx';
import Notifications from '../src/pages/Notifications.jsx';
import Settings from '../src/pages/Settings.jsx';
import Browse from '../src/pages/Browse.jsx';
import AdminUsers from '../src/pages/admin/Users.jsx';
import AdminListings from '../src/pages/admin/Listings.jsx';
import AdminUniversities from '../src/pages/admin/Universities.jsx';
import Broadcast from '../src/pages/admin/Broadcast.jsx';
import Research from '../src/pages/admin/Research.jsx';
import Dashboard from '../src/pages/Dashboard.jsx';
import Matches from '../src/pages/Matches.jsx';
import Saved from '../src/pages/Saved.jsx';
import Profile from '../src/pages/Profile.jsx';
import Wizard from '../src/pages/Wizard.jsx';
import Detail from '../src/pages/Detail.jsx';
import AdminOverview from '../src/pages/admin/Overview.jsx';
import AdminQueue from '../src/pages/admin/Queue.jsx';
import AdminErrors from '../src/pages/admin/Errors.jsx';
import AdminLogs from '../src/pages/admin/Logs.jsx';
import ListingForm from '../src/pages/admin/ListingForm.jsx';
import AiDraft from '../src/pages/admin/AiDraft.jsx';

let root = null;
export function mount(route) {
  const el = document.getElementById('root');
  if (!root) root = createRoot(el);
  root.render(
    <MemoryRouter key={route} initialEntries={[route]}>
      <AuthProvider>
        <ToastProvider>
          <SavedProvider>
            <NotificationsProvider>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/scholarships" element={<Browse kind="scholarship" />} />
                <Route path="/programs" element={<Browse kind="program" />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/listings" element={<AdminListings />} />
                <Route path="/admin/universities" element={<AdminUniversities />} />
                <Route path="/admin/broadcast" element={<Broadcast />} />
                <Route path="/admin/research" element={<Research />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/matches" element={<Matches />} />
                <Route path="/saved" element={<Saved />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/wizard" element={<Wizard />} />
                <Route path="/scholarship/:id" element={<Detail kind="scholarship" />} />
                <Route path="/program/:id" element={<Detail kind="program" />} />
                <Route path="/admin" element={<AdminOverview />} />
                <Route path="/admin/queue" element={<AdminQueue />} />
                <Route path="/admin/errors" element={<AdminErrors />} />
                <Route path="/admin/logs" element={<AdminLogs />} />
                <Route path="/admin/listings/new" element={<ListingForm />} />
                <Route path="/admin/listings/:id" element={<ListingForm />} />
                <Route path="/admin/ai-draft" element={<AiDraft />} />
              </Routes>
            </NotificationsProvider>
          </SavedProvider>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
  return root;
}
