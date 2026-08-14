import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../state/SessionContext';
import { REGIONS, parseRiotIdInput, linkErrorMessage } from '../lib/regions';
import './LinkAccount.css';

export default function LinkAccount() {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const [gameName, setGameName] = useState('');
  const [tagLine, setTagLine] = useState('');
  const [regionIdx, setRegionIdx] = useState(0);
  const [status, setStatus] = useState(null); // null | 'checking' | 'error'
  const [error, setError] = useState('');

  const unlink = () => {
    setSession(null);
    setGameName('');
    setTagLine('');
    setStatus(null);
    setError('');
  };

  const onNameChange = (value) => {
    if (value.includes('#')) {
      const parsed = parseRiotIdInput(value, tagLine);
      setGameName(parsed.gameName);
      if (parsed.tagLine) setTagLine(parsed.tagLine);
      return;
    }
    setGameName(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = parseRiotIdInput(gameName, tagLine);
    if (!parsed.gameName || !parsed.tagLine) {
      setStatus('error');
      setError('Enter both your Riot name and tag (for example Name#EUW).');
      return;
    }

    setGameName(parsed.gameName);
    setTagLine(parsed.tagLine);
    setError('');

    const hint = REGIONS[regionIdx] || REGIONS[0];
    if (!window.riotAPI?.linkAccount && !window.riotAPI?.getAccountByRiotId) {
      setStatus('error');
      setError('Riot connection isn’t available. Restart the app and try again.');
      return;
    }

    setStatus('checking');
    try {
      const linked = window.riotAPI.linkAccount
        ? await window.riotAPI.linkAccount({
            gameName: parsed.gameName,
            tagLine: parsed.tagLine,
            region: hint.region,
            platform: hint.platform,
          })
        : {
            ...(await window.riotAPI.getAccountByRiotId({
              gameName: parsed.gameName,
              tagLine: parsed.tagLine,
              region: hint.region,
            })),
            region: hint.region,
            platform: hint.platform,
          };

      setSession({
        gameName: linked.gameName || parsed.gameName,
        tagLine: linked.tagLine || parsed.tagLine,
        region: linked.region || hint.region,
        platform: linked.platform || hint.platform,
        puuid: linked.puuid || null,
      });
      setStatus(null);
      navigate({ pathname: '/', search: '' }, { replace: true });
    } catch (err) {
      setStatus('error');
      setError(linkErrorMessage(err));
    }
  };

  return (
    <div className="gd-page gd-page--narrow">
      <section className="gd-panel">
        <h2>{session ? 'Switch Riot account' : 'Link your Riot account'}</h2>
        {session && (
          <div className="gd-link-current">
            Currently linked as <strong>{session.gameName}#{session.tagLine}</strong>
            <button type="button" className="gd-link-unlink" onClick={unlink}>Unlink</button>
          </div>
        )}
        <form className="gd-link-form" onSubmit={handleSubmit}>
          <div className="gd-link-row">
            <input
              value={gameName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Riot name"
              autoFocus
              autoComplete="off"
              required
            />
            <span className="gd-link-hash">#</span>
            <input
              className="gd-link-tag"
              value={tagLine}
              onChange={(e) => setTagLine(e.target.value.replace(/^#/, '').toUpperCase())}
              placeholder="TAG"
              maxLength={5}
              autoComplete="off"
              required
            />
          </div>

          <select value={regionIdx} onChange={(e) => setRegionIdx(Number(e.target.value))}>
            {REGIONS.map((r, i) => (
              <option key={r.platform} value={i}>{r.label}</option>
            ))}
          </select>
          <p className="gd-link-hint">Server is used as a hint — we still look up the League shard from Riot.</p>

          {status === 'error' && <p className="gd-link-error">{error}</p>}

          <button type="submit" disabled={status === 'checking'}>
            {status === 'checking' ? 'Checking…' : session ? 'Switch account' : 'Verify and link'}
          </button>
        </form>
      </section>
    </div>
  );
}
