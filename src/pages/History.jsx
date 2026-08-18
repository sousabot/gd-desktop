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
import { useI18n } from '../i18n/LocaleContext';
import './History.css';

function lpChangeLabel(game) {
  const measured = Number.isFinite(Number(game.lpDelta)) && Number(game.lpDelta) !== 0;
  const n = measured ? Number(game.lpDelta) : Number(game.lpDeltaEst);
  if (!Number.isFinite(n) || n === 0) return '—';
  return `${measured ? '' : '~'}${n > 0 ? '+' : ''}${Math.round(n)}`;
}

export default function History() {
  const { session } = useSession();
  const { t } = useI18n();
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
      setError(t('history.needTag'));
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
          <h1>{t('history.title')}</h1>
          <p>
            {activeId
              ? `${activeId} · ${profile?.region || ''} · ${loading ? t('history.loading') : t('history.games', { n: games.length, mode: MODE_LABEL[mode].toLowerCase() })}`
              : t('history.linkBlurb')}
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
          <span>{t('history.empty')}</span>
          <button type="button" onClick={() => navigate('/link-account')}>{t('chrome.linkAccount')}</button>
        </div>
      ) : error ? (
        <div className="hs-empty">
          <span>{error}</span>
          <button type="button" onClick={() => load(activeId)}>{t('history.retry')}</button>
        </div>
      ) : loading || !profile ? (
        <div className="hs-empty">{t('common.loading')}</div>
      ) : (
        <div className="hs-list">
          {games.map((g) => (
            <button
              key={g.matchId}
              type="button"
              className={`hs-row hs-row--${g.win ? 'win' : 'loss'}`}
              onClick={() => setReview(g)}
              aria-label={t('history.openMatch')}
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
              <div className={`hs-lp${(g.lpDelta || g.lpDeltaEst) > 0 ? ' is-up' : (g.lpDelta || g.lpDeltaEst) < 0 ? ' is-down' : ''}${!g.lpDelta && g.lpDeltaEst ? ' is-est' : ''}`}>
                <strong title={!g.lpDelta && g.lpDeltaEst ? t('dash.lpEstHint') : undefined}>
                  {lpChangeLabel(g)}
                </strong>
                <span>LP</span>
              </div>
              <div className="hs-rift">
                <strong>{g.gdScore ?? '—'}</strong>
                <span>Rift</span>
              </div>
              <div className="hs-cs">
                <strong>{g.cs}</strong>
                <span>CS</span>
              </div>
              <div className="hs-dur">{g.durationMin}:{String(g.durationSec || 0).padStart(2, '0')}</div>
              <span className="hs-chevron" aria-hidden>›</span>
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
