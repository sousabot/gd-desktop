import React from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { SessionProvider } from './state/SessionContext';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import ApiNotice from './components/ApiNotice';
import UpdateBanner from './components/UpdateBanner';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import LiveStatus from './pages/LiveStatus';
import LinkAccount from './pages/LinkAccount';
import Login from './pages/Login';
import Champions from './pages/Champions';
import History from './pages/History';
import Compare from './pages/Compare';
import Collections from './pages/Collections';
import Replays from './pages/Replays';
import Draft from './pages/Draft';
import Spectate from './pages/Spectate';

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/overlay" element={<Navigate to="/" replace />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/live" element={<LiveStatus />} />
          <Route path="/champions" element={<Champions />} />
          <Route path="/history" element={<History />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/replays" element={<Replays />} />
          <Route path="/tierlist" element={<Navigate to="/" replace />} />
          <Route path="/draft" element={<Draft />} />
          <Route path="/spectate" element={<Spectate />} />
          <Route path="/overlays" element={<Navigate to="/" replace />} />
          <Route path="/link-account" element={<LinkAccount />} />
          <Route path="/login" element={<Login />} />
        </Route>
      </Routes>
    </SessionProvider>
  );
}

function AppShell() {
  return (
    <div className="gd-shell">
      <TitleBar />
      <UpdateBanner />
      <ApiNotice />
      <div className="gd-shell__body">
        <Sidebar />
        <main className="gd-shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
