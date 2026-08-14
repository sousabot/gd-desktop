import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { playerSearchPath, parsePlayerSearch } from '../lib/playerRoute';
import { useSession } from '../state/SessionContext';
import FeedbackForm from './FeedbackForm';
import './TitleBar.css';

const APP_VERSION = '0.1.0';
const hasWindowApi = typeof window !== 'undefined' && !!window.windowControls;

function IconBack() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconFwd() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M16.2 10a6.2 6.2 0 1 1-1.8-4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M16.2 4.2v4.2h-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconBug() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 7.2c2 0 3.4 1.3 3.4 3.4v2.2c0 1.9-1.5 3.2-3.4 3.2s-3.4-1.3-3.4-3.2V10.6c0-2.1 1.4-3.4 3.4-3.4Z" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6.6 8.2 4.4 6.4M13.4 8.2l2.2-1.8M6.6 12H4.2M13.4 12h2.4M10 7.2V4.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function IconGear() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 3.4v1.8M10 14.8v1.8M3.4 10h1.8M14.8 10h1.8M5.3 5.3l1.3 1.3M13.4 13.4l1.3 1.3M14.7 5.3 13.4 6.6M6.6 13.4 5.3 14.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default function TitleBar() {
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const viewedId = parsePlayerSearch(searchParams);
  const ownId = session ? `${session.gameName}#${session.tagLine}` : '';
  const [query, setQuery] = useState(viewedId || ownId);
  const [maximized, setMaximized] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    setQuery(viewedId || ownId);
  }, [viewedId, ownId, location.pathname]);

  useEffect(() => {
    if (!hasWindowApi) return undefined;
    window.windowControls.isMaximized().then(setMaximized);
    return window.windowControls.onMaximizedChange(setMaximized);
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    const next = query.trim();
    if (!next) return;
    const isOwn = ownId && next.toLowerCase() === ownId.toLowerCase();
    if (isOwn) navigate('/');
    else navigate(playerSearchPath(next, session?.tagLine || 'EUW'));
  };

  return (
    <header className="gd-titlebar" onDoubleClick={() => window.windowControls?.maximize()}>
      <div className="gd-titlebar__left" onDoubleClick={(e) => e.stopPropagation()}>
        <div className="gd-titlebar__brand">
          <span className="gd-titlebar__mark">GD</span>
          <div className="gd-titlebar__names">
            <span className="gd-titlebar__name">GD</span>
            <span className="gd-titlebar__ver">APP V.{APP_VERSION}</span>
          </div>
        </div>
        <div className="gd-titlebar__nav">
          <button type="button" className="gd-titlebar__icon-btn" onClick={() => window.history.back()} aria-label="Back">
            <IconBack />
          </button>
          <button type="button" className="gd-titlebar__icon-btn" onClick={() => window.history.forward()} aria-label="Forward">
            <IconFwd />
          </button>
          <button type="button" className="gd-titlebar__icon-btn" onClick={() => window.location.reload()} aria-label="Refresh">
            <IconRefresh />
          </button>
        </div>
      </div>

      <form className="gd-titlebar__search" onSubmit={submitSearch} onDoubleClick={(e) => e.stopPropagation()}>
        <svg className="gd-titlebar__search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a player, champion, team, pro…"
        />
      </form>

      <div className="gd-titlebar__right" onDoubleClick={(e) => e.stopPropagation()}>
        <button type="button" className="gd-titlebar__feedback" onClick={() => setFeedbackOpen(true)}>
          <IconBug />
          Report feedback / bugs
        </button>
        <button type="button" className="gd-titlebar__icon-btn" onClick={() => navigate('/link-account')} aria-label="Settings">
          <IconGear />
        </button>
        <button
          type="button"
          className="gd-titlebar__profile"
          onClick={() => navigate(session ? '/' : '/link-account')}
        >
          {session ? `${session.gameName}#${session.tagLine}` : 'Link account'}
        </button>

        {hasWindowApi && (
          <div className="gd-titlebar__win">
            <button type="button" className="gd-win-btn" onClick={() => window.windowControls.minimize()} aria-label="Minimize">
              <svg viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.2"/></svg>
            </button>
            <button type="button" className="gd-win-btn" onClick={() => window.windowControls.maximize()} aria-label={maximized ? 'Restore' : 'Maximize'}>
              {maximized ? (
                <svg viewBox="0 0 12 12">
                  <path d="M3.5 4.5h5v5h-5v-5Z M4.5 3.5h5v5" fill="none" stroke="currentColor" strokeWidth="1.1"/>
                </svg>
              ) : (
                <svg viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.1"/></svg>
              )}
            </button>
            <button type="button" className="gd-win-btn gd-win-btn--close" onClick={() => window.windowControls.close()} aria-label="Close">
              <svg viewBox="0 0 12 12"><path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.2"/></svg>
            </button>
          </div>
        )}
      </div>
      <FeedbackForm open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </header>
  );
}
