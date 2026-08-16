import React from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../state/SessionContext';
import './Login.css';

export default function Login() {
  const { session, setSession } = useSession();
  const unlink = () => setSession(null);

  return (
    <div className="gd-page gd-page--narrow">
      <section className="gd-panel gd-login-card">
        <span className="gd-brand__mark gd-login-mark">GD</span>
        <h1>GD Esports</h1>
        <p className="gd-text-muted">Track your League of Legends stats, matches, and rank progress.</p>
        <p className="gd-text-muted">Windows may warn that the app is unsigned. Choose More info, then Run anyway.</p>

        {session ? (
          <>
            <p className="gd-login-linked">Linked as <strong>{session.gameName}#{session.tagLine}</strong></p>
            <Link to="/" className="gd-login-btn">Go to dashboard</Link>
            <div className="gd-login-alt">
              <Link to="/link-account">Switch account</Link>
              <button type="button" onClick={unlink}>Unlink</button>
            </div>
          </>
        ) : (
          <Link to="/link-account" className="gd-login-btn">Link your Riot account</Link>
        )}
      </section>
    </div>
  );
}
