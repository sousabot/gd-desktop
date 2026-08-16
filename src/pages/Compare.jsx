import React, { useState } from 'react';
import { useSession } from '../state/SessionContext';
import { comparePlayers } from '../services/riotApi';
import { ChampionIcon } from '../components/GameIcons';
import { parseRiotId } from '../lib/playerRoute';
import { apiUserMessage, noticeFromError } from '../lib/apiNotice';
import './Compare.css';

function wr(profile) {
  const games = (profile?.wins || 0) + (profile?.losses || 0);
  if (!games) return '—';
  return `${Math.round((profile.wins / games) * 100)}%`;
}

function FormDots({ games = [] }) {
  return (
    <div className="cp-form">
      {games.slice(0, 8).map((g) => (
        <span key={g.matchId} className={g.win ? 'is-w' : 'is-l'}>{g.win ? 'W' : 'L'}</span>
      ))}
    </div>
  );
}

function Side({ profile }) {
  if (!profile) return <div className="cp-side cp-side--empty">No player loaded</div>;
  return (
    <div className="cp-side">
      <h2>{profile.riotId?.split('#')[0]}</h2>
      <div className="cp-tag">#{profile.riotId?.split('#')[1]}</div>
      <div className="cp-rank">{profile.rank} · {profile.lp} LP</div>
      {profile.ladderRank ? <div className="cp-ladder">#{profile.ladderRank}</div> : null}
      <div className="cp-record">{profile.wins}W – {profile.losses}L · {wr(profile)} WR</div>
      <div className="cp-stat-row">
        <div><span>KDA</span><strong>{profile.stats?.kda}</strong></div>
        <div><span>CS/min</span><strong>{profile.stats?.csm}</strong></div>
        <div><span>Gold @15</span><strong>{profile.stats?.goldDiff15}</strong></div>
      </div>
      <div className="cp-form-label">Recent form</div>
      <FormDots games={profile.recentGames} />
    </div>
  );
}

export default function Compare() {
  const { session } = useSession();
  const [leftInput, setLeftInput] = useState(session ? `${session.gameName}#${session.tagLine}` : '');
  const [rightInput, setRightInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const run = async (e) => {
    e?.preventDefault();
    const leftId = parseRiotId(leftInput, session?.tagLine || '');
    const rightId = parseRiotId(rightInput, session?.tagLine || '');
    if (!leftId || !rightId) {
      setError('Enter both Riot IDs as Name#TAG.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await comparePlayers(
        { ...leftId, region: session?.region || 'europe', platform: session?.platform || 'euw1' },
        { ...rightId, region: session?.region || 'europe', platform: session?.platform || 'euw1' },
      );
      setResult(data);
    } catch (err) {
      noticeFromError(err);
      setError(apiUserMessage(err) || 'Could not compare these players.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cp-page">
      <header className="cp-head">
        <div>
          <h1>Compare</h1>
          <p>Side-by-side rank, winrate, champion overlap, and recent form.</p>
        </div>
      </header>

      <form className="cp-form-bar" onSubmit={run}>
        <input
          value={leftInput}
          onChange={(e) => setLeftInput(e.target.value)}
          placeholder="Player A  Name#TAG"
          aria-label="Player A"
        />
        <span className="cp-vs">VS</span>
        <input
          value={rightInput}
          onChange={(e) => setRightInput(e.target.value)}
          placeholder="Player B  Name#TAG"
          aria-label="Player B"
        />
        <button type="submit" disabled={loading}>{loading ? 'Comparing…' : 'Compare'}</button>
      </form>
      {error && <div className="cp-error">{error}</div>}

      {result && (
        <>
          <div className="cp-grid">
            <Side profile={result.left} />
            <Side profile={result.right} />
          </div>
          <section className="cp-overlap">
            <h3>Champion overlap</h3>
            {result.overlap?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Champion</th>
                    <th>{result.left.riotId?.split('#')[0]}</th>
                    <th>{result.right.riotId?.split('#')[0]}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.overlap.map((row) => (
                    <tr key={row.champion}>
                      <td>
                        <div className="cp-champ">
                          <ChampionIcon name={row.champion} size={28} />
                          {row.champion}
                        </div>
                      </td>
                      <td>{row.left.games}g · {row.left.wr.toFixed(0)}% · {row.left.kda} KDA</td>
                      <td>{row.right.games}g · {row.right.wr.toFixed(0)}% · {row.right.kda} KDA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No shared champions in the last 20 ranked games.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
