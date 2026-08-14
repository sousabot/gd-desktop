import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSession } from '../state/SessionContext';
import './Sidebar.css';

function IconHome() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 9.2 10 3.5l6.5 5.7V16a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 16V9.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 17.5v-5h4v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function IconList() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 5.5h12M4 10h12M4 14.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function IconLive() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3" fill="currentColor"/>
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" opacity="0.55"/>
    </svg>
  );
}
function IconLink() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8.2 11.8a3.4 3.4 0 0 0 4.8 0l2-2a3.4 3.4 0 0 0-4.8-4.8l-1.1 1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11.8 8.2a3.4 3.4 0 0 0-4.8 0l-2 2a3.4 3.4 0 1 0 4.8 4.8l1.1-1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function IconReplay() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8.2 7.2v5.6L13.2 10 8.2 7.2Z" fill="currentColor"/>
    </svg>
  );
}
function IconGrid() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11" y="3.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="3.5" y="11" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11" y="11" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
function IconWatch() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5Z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
function IconCollection() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 6.5h12v9.2a1.3 1.3 0 0 1-1.3 1.3H5.3A1.3 1.3 0 0 1 4 15.7V6.5Z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 6.5V5.2A1.7 1.7 0 0 1 8.7 3.5h2.6A1.7 1.7 0 0 1 13 5.2v1.3" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
function IconEsports() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6.5 13.5 4 16.2M13.5 13.5 16 16.2M10 3.5v3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="10.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
function IconChamp() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 3.2 12.4 8l5.2.5-3.9 3.4 1.2 5.1L10 14.4 5.1 17l1.2-5.1L2.4 8.5 7.6 8 10 3.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}
function IconCompare() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 4.5v11M14 4.5v11M3.5 8.5H8.5M11.5 11.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function IconHistory() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 7.2v3.5l2.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

const NAV_GROUPS = [
  {
    label: 'GD Core',
    items: [
      { to: '/', label: 'Dashboard', icon: <IconHome />, end: true },
      { to: '/history', label: 'History', icon: <IconHistory /> },
      { to: '/champions', label: 'Champions', icon: <IconChamp /> },
      { to: '/leaderboard', label: 'Leaderboard', icon: <IconList /> },
      { to: '/live', label: 'Live Status', icon: <IconLive /> },
      { to: '/compare', label: 'Compare', icon: <IconCompare /> },
    ],
  },
  {
    label: 'GD App',
    items: [
      { to: '/link-account', label: 'Link Account', icon: <IconLink /> },
      { label: 'Replays', icon: <IconReplay />, soon: true },
      { label: 'Overlays', icon: <IconGrid />, soon: true },
      { label: 'Watch', icon: <IconWatch />, soon: true },
      { label: 'Collections', icon: <IconCollection />, soon: true },
    ],
  },
  {
    label: 'GD Insights',
    items: [
      { label: 'Esports', icon: <IconEsports />, soon: true },
    ],
  },
];

export default function Sidebar() {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const unlink = () => {
    setSession(null);
    navigate('/link-account');
  };

  return (
    <aside className="gd-sidebar">
      <nav className="gd-sidebar__nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="gd-sidebar__group">
            <div className="gd-sidebar__group-label">{group.label}</div>
            {group.items.map((item) => (
              item.soon ? (
                <span key={item.label} className="gd-sidebar__link gd-sidebar__link--soon">
                  <span className="gd-sidebar__icon">{item.icon}</span>
                  {item.label}
                  <span className="gd-sidebar__soon">Soon</span>
                </span>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `gd-sidebar__link${isActive ? ' gd-sidebar__link--active' : ''}`
                  }
                >
                  <span className="gd-sidebar__icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              )
            ))}
          </div>
        ))}
      </nav>

      {session ? (
        <div className="gd-sidebar__account">
          <div className="gd-sidebar__account-id">{session.gameName}#{session.tagLine}</div>
          <div className="gd-sidebar__account-actions">
            <NavLink to="/link-account">Switch</NavLink>
            <button type="button" onClick={unlink}>Unlink</button>
          </div>
        </div>
      ) : (
        <NavLink to="/link-account" className="gd-sidebar__login">Link account</NavLink>
      )}
    </aside>
  );
}
