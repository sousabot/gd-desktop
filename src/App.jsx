import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { SessionProvider } from './state/SessionContext';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import LiveStatus from './pages/LiveStatus';
import LinkAccount from './pages/LinkAccount';
import Login from './pages/Login';
import Champions from './pages/Champions';
import History from './pages/History';
import Compare from './pages/Compare';

export default function App() {
  return (
    <SessionProvider>
      <div className="gd-shell">
        <TitleBar />
        <div className="gd-shell__body">
          <Sidebar />
          <main className="gd-shell__main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/live" element={<LiveStatus />} />
              <Route path="/champions" element={<Champions />} />
              <Route path="/history" element={<History />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/link-account" element={<LinkAccount />} />
              <Route path="/login" element={<Login />} />
            </Routes>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
