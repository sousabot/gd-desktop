import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSummonerDashboard, getLiveGame } from '../services/riotApi';
import { champIconUrl, platformLabel, profileIconUrl, useDdragonVersion } from '../services/ddragon';
import { parsePlayerSearch, parseRiotId, playerQuery } from '../lib/playerRoute';
import { rememberPlayer } from '../lib/recentPlayers';
import { apiUserMessage, noticeFromError } from '../lib/apiNotice';
import { MODE_KEYS, MODE_LABEL, MODE_QUEUE } from '../lib/queues';
import { useSession } from '../state/SessionContext';
import MatchReview from '../components/MatchReview';
import { GD_SCORE_HINT } from '../lib/gdScore';
import './Dashboard.css';
import CHALLENGER_IMG  from '../assets/ranks/CHALLENGER.webp';
import GRANDMASTER_IMG from '../assets/ranks/GRANDMASTER_SMALL.webp';
import MASTER_IMG      from '../assets/ranks/MASTER.webp';
import DIAMOND_IMG     from '../assets/ranks/DIAMOND.webp';
import EMERALD_IMG     from '../assets/ranks/EMERALD.webp';

/* ─── helpers ─────────────────────────────────────────────── */
const normChamp = (name = '') =>
  name.replace(/[^a-zA-Z0-9]/g, '').replace(/^./, (c) => c.toUpperCase());

const splashImg = (name) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${normChamp(name)}_0.jpg`;

const loadingImg = (name) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${normChamp(name)}_0.jpg`;

const fmtElapsed = (seconds = 0) => {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, Math.floor(seconds % 60));
  return `${m}:${String(s).padStart(2, '0')}`;
};

const RANK_COLORS = {
  IRON: '#8a8a8a', BRONZE: '#cd7f32', SILVER: '#9fb3c8', GOLD: '#e0b256',
  PLATINUM: '#4fd7c5', EMERALD: '#3ecf8e', DIAMOND: '#5ba2ff',
  MASTER: '#a06bff', GRANDMASTER: '#ff5c68', CHALLENGER: '#ffd76b',
};
const rankColor = (label) =>
  RANK_COLORS[(label || '').split(' ')[0].toUpperCase()] || '#a06bff';

const RANK_IMGS = {
  CHALLENGER:  CHALLENGER_IMG,
  GRANDMASTER: GRANDMASTER_IMG,
  MASTER:      MASTER_IMG,
  DIAMOND:     DIAMOND_IMG,
  EMERALD:     EMERALD_IMG,
  PLATINUM:    EMERALD_IMG,  // fallback until you add the asset
};
const rankImg = (label) =>
  RANK_IMGS[(label || '').split(' ')[0].toUpperCase()] || null;

/* ─── Sparkline ────────────────────────────────────────────── */
function Sparkline({ data = [], up = true }) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => [
      (i / (data.length - 1)) * w,
      h - ((v - min) / range) * (h - 6) - 3,
    ]);
    ctx.clearRect(0, 0, w, h);
    const c = up ? '#3ecf8e' : '#ff5c68';
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, c + '55');
    grad.addColorStop(1, c);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  }, [data, up]);
  return <canvas ref={ref} width={88} height={28} className="db-sparkline" />;
}

/* ─── StatCard ─────────────────────────────────────────────── */
function StatCard({ label, value, delta, deltaDir, sparkData, hint }) {
  const isUp   = deltaDir === 'up';
  const isDown = deltaDir === 'down';
  return (
    <div className="db-stat-card" title={hint || undefined}>
      <div className="db-stat-top">
        <span className="db-stat-label">{label}</span>
        <Sparkline data={sparkData} up={!isDown} />
      </div>
      <div className="db-stat-bottom">
        <span className="db-stat-value">{value}</span>
        <span className={`db-stat-delta-pill db-stat-delta-pill--${deltaDir}`}>
          <span className="db-stat-delta-dot" />
          {delta} <span className="db-stat-delta-sub">vs 1w</span>
        </span>
      </div>
    </div>
  );
}

/* ─── ChampionIcon ─────────────────────────────────────────── */
function ChampionIcon({ name, size = 36, enemy = false, rounded = false, team }) {
  const version = useDdragonVersion();
  const [src, setSrc] = useState(() => champIconUrl(name, version));
  useEffect(() => { setSrc(champIconUrl(name, version)); }, [name, version]);
  const teamClass = team === 'blue' ? ' db-champ-icon--blue' : team === 'red' ? ' db-champ-icon--red' : '';
  return (
    <img
      src={src}
      alt={name}
      title={name}
      onError={() => setSrc(champIconUrl('Aatrox', version))}
      className={`db-champ-icon${enemy ? ' db-champ-icon--enemy' : ''}${rounded ? ' db-champ-icon--rounded' : ''}${teamClass}`}
      style={{ width: size, height: size }}
    />
  );
}

/* ─── ScoreRing ────────────────────────────────────────────── */
function ScoreRing({ label, value, max = 100, color, size = 40 }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = Math.min((Number(value) || 0) / max, 1);
  const cx = size / 2;
  return (
    <div className="db-score-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3.5" />
        <circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke={color} strokeWidth="3.5"
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
        />
        <text x={cx} y={cx + 4} textAnchor="middle" fill="#fff" fontSize={size > 48 ? 13 : 10} fontWeight="700">{value}</text>
      </svg>
      <span className="db-score-ring-label">{label}</span>
    </div>
  );
}

/* ─── LPRing (sidebar recent game badge) ───────────────────── */
function LPRing({ lp, win }) {
  const r = 10, circ = 2 * Math.PI * r;
  const pct = Math.min(lp / 100, 1);
  const c = win ? '#3ecf8e' : '#ff5c68';
  return (
    <div className="db-lp-ring" title={`GD Score ${lp}`}>
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
        <circle cx="14" cy="14" r={r} fill="none" stroke={c} strokeWidth="2.5"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 14 14)" />
        <text x="14" y="18" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700">{lp}</text>
      </svg>
    </div>
  );
}

/* ─── RecentGameRow ────────────────────────────────────────── */
function RecentGameRow({ game, active, onSelect }) {
  const { champion, win, kills, deaths, assists, kda, ago, gdScore, lp, queueLabel, queueType } = game;
  const score = gdScore ?? lp;
  return (
    <button
      type="button"
      className={`db-recent-row db-recent-row--${win ? 'win' : 'loss'}${active ? ' is-active' : ''}`}
      onClick={onSelect}
    >
      <div className="db-recent-left">
        <span className="db-recent-ago">{ago}</span>
        <ChampionIcon name={champion} size={32} rounded />
      </div>
      <div className="db-recent-mid">
        <div className="db-recent-top-row">
          <span className={`db-recent-result ${win ? 'win' : 'loss'}`}>{win ? 'WIN' : 'LOSS'}</span>
          <span className="db-recent-queue">{queueLabel || queueType || 'Solo/Duo'}</span>
        </div>
        <span className="db-recent-kda">{kills}/{deaths}/{assists}</span>
        <span className="db-recent-kdaval">{kda} KDA</span>
      </div>
      <LPRing lp={score} win={win} />
    </button>
  );
}

/* ─── Dashboard ────────────────────────────────────────────── */
export default function Dashboard() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const ddVersion = useDdragonVersion();
  const qParam = parsePlayerSearch(searchParams);
  const ownId = session ? `${session.gameName}#${session.tagLine}` : '';
  const activeId = (qParam || ownId).trim();
  const viewingOther = Boolean(qParam && (!ownId || qParam.toLowerCase() !== ownId.toLowerCase()));

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState('Solo');
  const [liveGame, setLiveGame] = useState(null);
  const [liveAt, setLiveAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [matchIdx, setMatchIdx] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [lcuCol, setLcuCol] = useState(null);

  const lookup = {
    region: session?.region || 'europe',
    platform: session?.platform || 'euw1',
  };

  const load = async (riotId, selectedMode = mode) => {
    if (!riotId) {
      setProfile(null);
      setLoadError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    setMatchIdx(0);
    setReviewOpen(false);
    setLiveGame(null);
    const parsed = parseRiotId(riotId, session?.tagLine || '');
    if (!parsed) {
      setProfile(null);
      setLoadError('Use Name#TAG — for example Ana de Armas#7589.');
      setLoading(false);
      return;
    }
    try {
      const data = await getSummonerDashboard({
        gameName: parsed.gameName,
        tagLine: parsed.tagLine,
        region: lookup.region,
        platform: lookup.platform,
        queue: MODE_QUEUE[selectedMode],
        count: 20,
      });
      setProfile(data);
      rememberPlayer(data?.riotId || riotId);
    } catch (err) {
      console.error('[Dashboard] Failed to load summoner:', err);
      noticeFromError(err);
      setProfile(null);
      setLoadError(apiUserMessage(err) || 'Could not load this account. Check the Riot ID (Name#TAG) and region.');
    } finally {
      setLoading(false);
    }
  };

  const selectMode = (m) => {
    setMode(m);
    load(activeId, m);
  };

  useEffect(() => {
    load(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, session?.platform, session?.region]);

  useEffect(() => {
    if (!window.lcuAPI?.getCollections) return undefined;
    let alive = true;
    window.lcuAPI.getCollections(false).then((next) => {
      if (alive && next?.connected) setLcuCol(next);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Spectator for whoever is on this dashboard — linked account or a searched player.
  useEffect(() => {
    if (!profile?.riotId) return undefined;
    let cancelled = false;
    const [gameName, tagLine] = profile.riotId.split('#');
    const lookupLive = {
      gameName,
      tagLine,
      region: lookup.region,
      platform: profile.platform || lookup.platform,
    };
    const tick = (first) => {
      if (first) setLiveGame((prev) => prev);
      getLiveGame(lookupLive).then((g) => {
        if (cancelled) return;
        setLiveGame(g || null);
        if (g) setLiveAt(Date.now());
      }).catch(() => {
        if (!cancelled) setLiveGame(null);
      });
    };
    tick(true);
    const id = setInterval(() => tick(false), 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [profile?.riotId, profile?.platform, lookup.region, lookup.platform]);

  useEffect(() => {
    if (!liveGame) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [liveGame]);

  const winrate = profile && profile.wins != null
    ? Math.round((profile.wins / Math.max(1, profile.wins + profile.losses)) * 100)
    : null;

  const s  = profile?.stats || {};
  const sp = profile?.sparklines || {};
  const games = profile?.recentGames || [];
  const lg = games[matchIdx] || profile?.lastGame || null;
  const rc = profile ? rankColor(profile.rank) : '#a06bff';
  const resolvedPlatform = profile?.platform || lookup.platform;
  const collections = profile?.collections || { played: 0, total: 0 };
  const lens = profile?.lens || { score: 0, series: [50], avgDeaths: 0 };
  const inLive = !!(liveGame && (liveGame.blue?.length || liveGame.red?.length));
  const liveYou = inLive
    ? [...(liveGame.blue || []), ...(liveGame.red || [])].find((p) => (
      p.isSelf || String(p.riotId || '').toLowerCase() === String(profile?.riotId || '').toLowerCase()
    ))
    : null;
  const splashChamp = liveYou?.champion || lg?.champion || null;
  const liveAlly = liveYou?.teamId === 200 ? liveGame.red : liveGame?.blue;
  const liveEnemy = liveYou?.teamId === 200 ? liveGame.blue : liveGame?.red;
  const liveBlue = inLive ? (liveAlly || []).map((p) => p.champion) : null;
  const liveRed = inLive ? (liveEnemy || []).map((p) => p.champion) : null;
  const liveElapsed = inLive
    ? (liveGame.gameLength || 0) + Math.floor((now - liveAt) / 1000)
    : 0;

  const cycleMatch = (dir) => {
    if (!games.length) return;
    setMatchIdx((i) => (i + dir + games.length) % games.length);
  };

  const lensPoints = (() => {
    const series = lens.series?.length ? lens.series : [50];
    const w = 200, h = 70;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;
    const pts = series.map((v, i) => {
      const x = (i / Math.max(1, series.length - 1)) * w;
      const y = h - 10 - ((v - min) / range) * (h - 18);
      return [x, y];
    });
    const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
    const area = `M${pts[0][0]},${pts[0][1]} ${pts.slice(1).map(([x, y]) => `L${x},${y}`).join(' ')} L${w},${h} L0,${h} Z`;
    return { line, area };
  })();

  const stats = [
    { label: 'KDA', value: s.kda, delta: s.kdaDelta, deltaDir: s.kdaDeltaDir, sparkData: sp.kda },
    { label: 'GD Score', value: s.gdScore, delta: s.gdDelta, deltaDir: s.gdDeltaDir, sparkData: sp.gdScore, hint: GD_SCORE_HINT },
    { label: 'KP', value: s.kp, delta: s.kpDelta, deltaDir: s.kpDeltaDir, sparkData: sp.kp },
    { label: 'CSM', value: s.csm, delta: s.csmDelta, deltaDir: s.csmDeltaDir, sparkData: sp.csm },
    { label: 'Vision Score', value: s.visionScore, delta: s.visionDelta, deltaDir: s.visionDeltaDir, sparkData: sp.vision },
    { label: 'GPM', value: s.gpm, delta: s.gpmDelta, deltaDir: s.gpmDeltaDir, sparkData: sp.gpm },
    { label: 'Gold Diff @15', value: s.goldDiff15, delta: s.goldDiff15Delta, deltaDir: s.goldDiff15DeltaDir, sparkData: sp.goldDiff15 },
    { label: 'K+A Diff @15', value: s.kaDiff15, delta: s.kaDiff15Delta, deltaDir: s.kaDiff15DeltaDir, sparkData: sp.kaDiff15 },
  ];

  return (
    <div className="db-page">

      {/* ── Page title + mode filters ── */}
      <div className="db-page-head">
        <div>
          <h1 className="db-page-title">Dashboard</h1>
          {viewingOther && (
            <div className="db-viewing-banner">
              Viewing {activeId}
              {ownId && (
                <button type="button" onClick={() => setSearchParams({})}>Back to my dashboard</button>
              )}
            </div>
          )}
        </div>
        <div className="db-toolbar">
          <div className="db-mode-filters">
            {MODE_KEYS.map((m) => (
              <button
                key={m}
                className={`db-mode-btn${m === mode ? ' active' : ''}`}
                onClick={() => selectMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="db-toolbar-meta">
            <span className="db-filter-label">Last 20 games</span>
            <span className="db-filter-label">{platformLabel(resolvedPlatform)}</span>
            <button type="button" className="db-filter-label highlight" onClick={() => navigate(`/history${viewingOther ? playerQuery(activeId) : ''}`)}>
              Full history
            </button>
          </div>
        </div>
      </div>

      {!activeId ? (
        <div className="db-loading">
          <span>Link a Riot account to load your dashboard.</span>
          <button type="button" className="db-retry" onClick={() => navigate('/link-account')}>Link account</button>
        </div>
      ) : loadError ? (
        <div className="db-loading">
          <span>{loadError}</span>
          <button type="button" className="db-retry" onClick={() => load(activeId)}>Retry</button>
        </div>
      ) : loading || !profile ? (
        <div className="db-loading">
          <div className="db-loading-spinner" />
          <span>Loading summoner data…</span>
        </div>
      ) : (
        <div className="db-content">
          <div className="db-body">
            <div className="db-main-col">

              {/* Hero: splash + profile + rank + glass stats */}
              <div className="db-hero">
                <div className="db-splash-bg" style={splashChamp ? { backgroundImage: `url(${splashImg(splashChamp)})` } : undefined} />
                <div className="db-splash-overlay" />

                <div className="db-hero-inner">
                  <div className="db-hero-top">
                    <div className="db-profile-row">
                      <div className="db-avatar-wrap" style={{ '--rc': rc }}>
                        <img src={profileIconUrl(profile.profileIconId, ddVersion)} alt="" className="db-avatar"
                          onError={(e) => { e.target.src = profileIconUrl(29, ddVersion); }} />
                        {profile.summonerLevel != null && (
                          <span className="db-avatar-level">{profile.summonerLevel}</span>
                        )}
                      </div>
                      <div className="db-profile-info">
                        <h2 className="db-summoner-name">{profile.riotId?.split('#')[0]}</h2>
                        <div className="db-profile-meta">
                          <span className="db-summoner-tag">#{profile.riotId?.split('#')[1]}</span>
                          <span className="db-summoner-tag">{profile.region || platformLabel(resolvedPlatform)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="db-rank-card" style={{ '--rc': rc }}>
                      <span className="db-rank-card-eyebrow">{MODE_LABEL[mode] === 'All Queues' ? 'Ranked' : MODE_LABEL[mode]}</span>
                      <div className="db-rank-card-main">
                        {rankImg(profile.rank) && (
                          <img src={rankImg(profile.rank)} alt={profile.rank} className="db-rank-card-emblem" />
                        )}
                        <div className="db-rank-card-info">
                          <span className="db-rank-card-name" style={{ color: rc }}>{profile.rank || 'Unranked'}</span>
                          {profile.ladderRank && (
                            <span className="db-rank-card-num" style={{ color: rc }}>#{profile.ladderRank}</span>
                          )}
                          <span className="db-rank-card-lp" style={{ color: rc }}>
                            {profile.lp != null ? `${profile.lp} LP` : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="db-rank-card-record">
                        {profile.wins != null
                          ? `${profile.wins}W – ${profile.losses}L${winrate != null ? ` · ${winrate}%` : ''}`
                          : 'Ranked data unavailable'}
                      </div>
                    </div>
                  </div>

                  <div className="db-stat-grid">
                    {stats.map((stat) => (
                      <StatCard key={stat.label} {...stat} />
                    ))}
                  </div>
                </div>
              </div>

              {/* DPM-style action cards */}
              <div className="db-cards">
                <article className="db-dpm-card db-card-match">
                  <button type="button" className="db-card-side-arrow is-left" aria-label="Previous" onClick={() => cycleMatch(-1)}>‹</button>
                  <button type="button" className="db-card-side-arrow is-right" aria-label="Next" onClick={() => cycleMatch(1)}>›</button>

                  <div className="db-card-match-top">
                    <span className="db-region-badge">{lg?.region || platformLabel(resolvedPlatform)}</span>
                    <span className={`db-match-timer${inLive ? ' is-live' : ''}`}>
                      <span className="db-match-timer-dot" />
                      {inLive
                        ? fmtElapsed(liveElapsed)
                        : lg
                          ? `${lg.durationMin}:${String(lg.durationSec || 0).padStart(2, '0')}`
                          : '--:--'}
                    </span>
                    {(inLive ? liveGame.queueName : lg?.queueType) && (
                      <span className="db-queue-badge">{inLive ? liveGame.queueName : lg.queueType}</span>
                    )}
                  </div>

                  <div className="db-card-match-teams">
                    <div className="db-card-match-row">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const c = (liveBlue || lg?.allyTeam)?.[i];
                        return c
                          ? <ChampionIcon key={`a-${c}-${i}`} name={c} size={46} team="blue" />
                          : <span key={`a-empty-${i}`} className="db-champ-empty" />;
                      })}
                    </div>
                    <div className="db-vs-chip">VS</div>
                    <div className="db-card-match-row">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const c = (liveRed || lg?.enemyTeam)?.[i];
                        return c
                          ? <ChampionIcon key={`e-${c}-${i}`} name={c} size={46} team="red" />
                          : <span key={`e-empty-${i}`} className="db-champ-empty" />;
                      })}
                    </div>
                  </div>

                  <div className="db-card-match-dots">
                    {(games.length ? games : [0]).map((g, i) => (
                      <button
                        type="button"
                        key={g.matchId || i}
                        className={i === matchIdx ? 'is-on' : ''}
                        aria-label={`Match ${i + 1}`}
                        onClick={() => setMatchIdx(i)}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    className={`db-pill-btn db-pill-btn--live${inLive ? ' is-live' : ''}`}
                    onClick={() => navigate(`/live${playerQuery(activeId)}`)}
                  >
                    {inLive ? 'Watch live' : 'Live status'}
                  </button>
                </article>

                <article
                  className="db-dpm-card db-card-soon"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/replays')}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate('/replays'); }}
                >
                  {lg && splashChamp && (
                    <img
                      src={loadingImg(splashChamp)}
                      alt=""
                      className="db-card-soon-art"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className="db-card-soon-overlay" />
                  <div className="db-card-soon-body">
                    <span className="db-card-soon-kicker">Replays</span>
                    <h3>Record this client</h3>
                    <p>Borderless or windowed. Exclusive fullscreen cannot be captured.</p>
                  </div>
                </article>

                {lg && (
                  <article className="db-dpm-card db-card-perf">
                    <div className="db-card-perf-head">
                      <ChampionIcon name={lg.champion} size={42} rounded />
                      <div className="db-card-perf-kda-wrap">
                        <div className="db-card-perf-kda">{lg.kills} / {lg.deaths} / {lg.assists}</div>
                        <div className="db-card-perf-kda-sub">{lg.kda} KDA</div>
                      </div>
                    </div>

                    <div className="db-card-perf-rings">
                      <ScoreRing label="EARLY" value={lg.earlyScore} color="#7c5cff" size={58} />
                      <ScoreRing label="MID"   value={lg.midScore}   color="#5ba2ff" size={58} />
                      <ScoreRing label="LATE"  value={lg.lateScore}  color="#3ecf8e" size={58} />
                    </div>

                    <div className="db-card-perf-stats">
                      <div>
                        <span>Deaths</span>
                        <strong className="is-red">{lg.deaths4}</strong>
                      </div>
                      <div>
                        <span>Kills + Assists</span>
                        <strong className="is-gold">{lg.killsAssists}</strong>
                      </div>
                      <div>
                        <span>CSM</span>
                        <strong className="is-green">{lg.csm}</strong>
                      </div>
                    </div>

                    <button type="button" className="db-pill-btn db-pill-btn--solid" onClick={() => setReviewOpen(true)}>
                      Review this game
                    </button>
                  </article>
                )}

                <article className="db-dpm-card db-card-overlays is-soon">
                  <div className="db-overlays-dim" />
                  <div className="db-overlays-foot">
                    <span className="db-overlays-logo" aria-hidden="true" />
                    <span className="db-card-title-lg">Overlays</span>
                    <span className="db-overlays-soon">Soon · Riot-safe only</span>
                  </div>
                </article>

                <article
                  className="db-dpm-card db-card-collections"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/collections')}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate('/collections'); }}
                >
                  <img className="db-collections-art" src={splashImg('Rakan')} alt="" />
                  <div className="db-collections-overlay" />
                  <div className="db-collections-count">
                    {lcuCol
                      ? `${lcuCol.skinsOwned} / ${lcuCol.skinsTotal} skins`
                      : `${collections.played} / ${collections.total} champions played`}
                  </div>
                  <div className="db-collections-foot">
                    <span className="db-hex-icon" aria-hidden="true" />
                    <span className="db-card-title-lg">Collections</span>
                  </div>
                </article>

                <article className="db-dpm-card db-card-lens">
                  <div className="db-lens-head">
                    <span className="db-lens-mark">◎</span>
                    <span>GD Lens</span>
                  </div>
                  <svg viewBox="0 0 200 70" className="db-lens-graph" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="lensFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffb454" stopOpacity="0.35"/>
                        <stop offset="100%" stopColor="#ffb454" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d={lensPoints.area} fill="url(#lensFill)"/>
                    <polyline points={lensPoints.line}
                      fill="none" stroke="#ffb454" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round"/>
                  </svg>
                  <div className="db-lens-foot">
                    <div>
                      <div className="db-lens-label">Survivability</div>
                      <div className="db-lens-sub">Avg {lens.avgDeaths} deaths / game</div>
                    </div>
                    <div className="db-lens-score">{lens.score}/100</div>
                  </div>
                </article>
              </div>

            </div>

            <aside className="db-matches">
              <div className="db-matches-header">
                {MODE_LABEL[mode]} · Recent games
                <button type="button" className="db-matches-more" onClick={() => navigate(`/history${viewingOther ? playerQuery(activeId) : ''}`)}>All</button>
              </div>
              <div className="db-recent-list">
                {(profile.recentGames || []).map((g, i) => (
                  <RecentGameRow
                    key={g.matchId}
                    game={g}
                    active={i === matchIdx}
                    onSelect={() => setMatchIdx(i)}
                  />
                ))}
                {!(profile.recentGames || []).length ? (
                  <div className="db-recent-empty">No games in this queue yet.</div>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      )}

      {reviewOpen && lg && (
        <MatchReview
          game={lg}
          platform={resolvedPlatform}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
}