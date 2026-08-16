import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSummonerDashboard } from '../services/riotApi';
import { ChampionIcon } from '../components/GameIcons';
import RoleIcon from '../components/RoleIcon';
import MatchReview from '../components/MatchReview';
import { parsePlayerSearch, parseRiotId } from '../lib/playerRoute';
import { apiUserMessage, noticeFromError } from '../lib/apiNotice';
import { MODE_KEYS, MODE_LABEL, MODE_QUEUE } from '../lib/queues';
import { useSession } from '../state/SessionContext';
import './History.css';

export default function History() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qParam = parsePlayerSearch(searchParams);
  const ownId = session ? `${session.gameName}#${session.tagLine}` : '';
  const activeId = (qParam || ownId).trim();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('Solo');
  const [review, setReview] = useState(null);

  const sessionLookup = {
    region: session?.region || 'europe',
    platform: session?.platform || 'euw1',
  };
  const reviewPlatform = profile?.platform || sessionLookup.platform;

  const load = async (riotId, selectedMode = mode) => {
    if (!riotId) {
      setProfile(null);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const parsed = parseRiotId(riotId, session?.tagLine || '');
    if (!parsed) {
      setProfile(null);
      setError('Use Name#TAG — for example Ana de Armas#7589.');
      setLoading(false);
      return;
    }
    try {
      const data = await getSummonerDashboard({
        gameName: parsed.gameName,
        tagLine: parsed.tagLine,
        region: sessionLookup.region,
        platform: sessionLookup.platform,
        queue: MODE_QUEUE[selectedMode],
        count: 40,
      });
      setProfile(data);
    } catch (err) {
      noticeFromError(err);
      setError(apiUserMessage(err) || 'Could not load match history.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, session?.platform, session?.region]);

  const games = profile?.recentGames || [];

  return (
    <div className="hs-page">
      <header className="hs-head">
        <div>
          <h1>Match History</h1>
          <p>
            {activeId
              ? `${activeId} · ${profile?.region || ''} · ${loading ? 'loading' : `${games.length} ${MODE_LABEL[mode].toLowerCase()} games`}`
              : 'Link an account to browse match history.'}
          </p>
        </div>
        <div className="hs-filters">
          {MODE_KEYS.map((m) => (
            <button
              key={m}
              type="button"
              className={`hs-chip${m === mode ? ' is-on' : ''}`}
              onClick={() => { setMode(m); load(activeId, m); }}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      {!activeId ? (
        <div className="hs-empty">
          <span>Link a Riot account to load match history.</span>
          <button type="button" onClick={() => navigate('/link-account')}>Link account</button>
        </div>
      ) : error ? (
        <div className="hs-empty">
          <span>{error}</span>
          <button type="button" onClick={() => load(activeId)}>Retry</button>
        </div>
      ) : loading || !profile ? (
        <div className="hs-empty">Loading matches…</div>
      ) : (
        <div className="hs-list">
          {games.map((g) => (
            <button
              key={g.matchId}
              type="button"
              className={`hs-row hs-row--${g.win ? 'win' : 'loss'}`}
              onClick={() => setReview(g)}
            >
              <span className={`hs-result ${g.win ? 'win' : 'loss'}`}>{g.win ? 'WIN' : 'LOSS'}</span>
              <ChampionIcon name={g.champion} size={40} className="hs-champ" />
              <span className="hs-role">{g.role ? <RoleIcon role={g.role} size={16} /> : null}</span>
              <div className="hs-mid">
                <div className="hs-champ-name">{g.champion}</div>
                <div className="hs-meta">{g.queueLabel || g.queueType} · {g.region || ''} · {g.ago}</div>
              </div>
              <div className="hs-kda">
                <strong>{g.kills}/{g.deaths}/{g.assists}</strong>
                <span>{g.kda} KDA</span>
              </div>
              <div className="hs-gd">
                <strong>{g.gdScore ?? '—'}</strong>
                <span>GD</span>
              </div>
              <div className="hs-cs">
                <strong>{g.cs}</strong>
                <span>CS</span>
              </div>
              <div className="hs-dur">{g.durationMin}:{String(g.durationSec || 0).padStart(2, '0')}</div>
            </button>
          ))}
          {!games.length && <div className="hs-empty">No games in this queue yet.</div>}
        </div>
      )}

      {review && (
        <MatchReview
          game={review}
          platform={reviewPlatform}
          onClose={() => setReview(null)}
        />
      )}
    </div>
  );
}
