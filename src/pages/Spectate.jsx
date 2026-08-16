import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChampionIcon } from '../components/GameIcons';
import { typicalLane } from '../lib/champLane';
import { playerSearchPath } from '../lib/playerRoute';
import { apiUserMessage } from '../lib/apiNotice';
import './Spectate.css';
import CHALLENGER_IMG from '../assets/ranks/CHALLENGER.webp';
import GRANDMASTER_IMG from '../assets/ranks/GRANDMASTER_SMALL.webp';
import MASTER_IMG from '../assets/ranks/MASTER.webp';

const api = typeof window !== 'undefined' ? window.spectateAPI : null;

const REGIONS = [
  { id: 'all', label: 'All', platforms: 'euw1,kr,na1' },
  { id: 'euw1', label: 'EUW', platforms: 'euw1' },
  { id: 'kr', label: 'KR', platforms: 'kr' },
  { id: 'na1', label: 'NA', platforms: 'na1' },
  { id: 'eun1', label: 'EUNE', platforms: 'eun1' },
  { id: 'br1', label: 'BR', platforms: 'br1' },
  { id: 'jp1', label: 'JP', platforms: 'jp1' },
];

const RANK_IMGS = {
  CHALLENGER: CHALLENGER_IMG,
  GRANDMASTER: GRANDMASTER_IMG,
  MASTER: MASTER_IMG,
};

const LANES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
const TIER_RANK = { CHALLENGER: 3, GRANDMASTER: 2, MASTER: 1 };

function fmtElapsed(seconds = 0) {
  const n = Math.max(0, Math.floor(seconds));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function orderTeam(players = []) {
  const pool = [...players];
  const out = [];
  for (const lane of LANES) {
    const i = pool.findIndex((p) => typicalLane(p.champion) === lane);
    if (i >= 0) out.push(pool.splice(i, 1)[0]);
  }
  return [...out, ...pool];
}

function gameSeconds(game, now) {
  if (game.gameStartTime) return Math.max(0, Math.floor((now - game.gameStartTime) / 1000));
  return 0;
}

function gameSearchText(game) {
  return [
    game.regionLabel,
    game.queueName,
    game.rank?.label,
    ...(game.players || []).flatMap((p) => [p.champion, p.gameName, p.riotId, p.pro?.player, p.pro?.team]),
  ].join(' ').toLowerCase();
}

export default function Spectate() {
  const navigate = useNavigate();
  const [region, setRegion] = useState('all');
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('');
  const [sort, setSort] = useState('relevant');
  const [payload, setPayload] = useState({ games: [], scanning: false });
  const [error, setError] = useState('');
  const [launching, setLaunching] = useState('');
  const [launchErr, setLaunchErr] = useState('');
  const [now, setNow] = useState(Date.now());

  const platforms = REGIONS.find((r) => r.id === region)?.platforms || 'euw1,kr,na1';

  async function load(force = false) {
    if (!api) {
      setError('Open GD Esports as the desktop app to load live games.');
      return;
    }
    setError('');
    setPayload((prev) => ({ ...prev, scanning: true }));
    try {
      const data = await api.list({ platforms, force });
      setPayload(data || { games: [] });
      if (data?.error) setError(data.error);
    } catch (err) {
      setPayload((prev) => ({ ...prev, scanning: false }));
      setError(apiUserMessage(err) || err.message || 'Could not load live games.');
    }
  }

  useEffect(() => {
    load(false);
  }, [platforms]);

  useEffect(() => {
    if (!payload.scanning) return undefined;
    const t = setInterval(() => load(false), 4000);
    return () => clearInterval(t);
  }, [payload.scanning, platforms]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const teams = useMemo(() => {
    const set = new Set();
    (payload.games || []).forEach((g) => {
      (g.players || []).forEach((p) => { if (p.pro?.team) set.add(p.pro.team); });
    });
    return [...set].sort();
  }, [payload.games]);

  const games = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = (payload.games || []).filter((g) => {
      if (q && !gameSearchText(g).includes(q)) return false;
      if (team && !(g.players || []).some((p) => p.pro?.team === team)) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === 'recent') return (b.gameStartTime || 0) - (a.gameStartTime || 0);
      const pro = (b.proCount || 0) - (a.proCount || 0);
      if (pro) return pro;
      const tier = (TIER_RANK[b.rank?.tier] || 0) - (TIER_RANK[a.rank?.tier] || 0);
      if (tier) return tier;
      return (b.rank?.lp || 0) - (a.rank?.lp || 0);
    });
    return rows;
  }, [payload.games, query, team, sort]);

  async function spectateGame(game) {
    if (!api) return;
    const id = `${game.platformId}:${game.gameId}`;
    setLaunching(id);
    setLaunchErr('');
    try {
      const result = await api.launch({ gameId: game.gameId, platformId: game.platformId });
      if (!result?.ok) setLaunchErr(result?.error || 'Could not start spectator.');
    } catch (err) {
      setLaunchErr(err.message || 'Could not start spectator.');
    } finally {
      setLaunching('');
    }
  }

  function openPlayer(player) {
    if (!player?.gameName || !player?.tagLine) return;
    navigate(playerSearchPath(`${player.gameName}#${player.tagLine}`));
  }

  return (
    <div className="sp-page">
      <header className="sp-head">
        <div>
          <h1>Spectate</h1>
          <p>Live Challenger and Grandmaster solo queue on EUW, KR, and NA. Pro names are tagged only when they match a current Leaguepedia roster.</p>
        </div>
        <button type="button" className="sp-refresh" onClick={() => load(true)} disabled={payload.scanning}>
          {payload.scanning ? 'Scanning…' : 'Refresh'}
        </button>
      </header>

      <div className="sp-note">
        Spectate uses League’s spectator mode. Be on the client home screen first. After watching, you may need to restart League before you can queue.
      </div>

      <div className="sp-toolbar">
        <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
          {REGIONS.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
          <option value="">All teams</option>
          {teams.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player, champion, team…"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="relevant">Most relevant</option>
          <option value="recent">Newest</option>
        </select>
      </div>

      {launchErr && <div className="sp-error">{launchErr}</div>}
      {error && <div className="sp-error">{error}</div>}
      {payload.limited && (
        <div className="sp-error">Riot rate limit — showing games found so far. Wait a minute, then refresh.</div>
      )}
      {payload.note && !payload.limited && <div className="sp-muted">{payload.note}</div>}

      {!api && (
        <div className="sp-empty">
          <h2>Desktop app required</h2>
          <p>Spectate needs the GD Esports desktop app so it can talk to Riot and the League client.</p>
        </div>
      )}

      {api && !games.length && (
        <div className="sp-empty">
          <h2>{payload.scanning ? 'Looking for live games…' : 'No live games in this scan'}</h2>
          <p>
            {payload.scanning
              ? 'Checking Challenger and Grandmaster ladders. This takes a short while on the first load.'
              : 'Nobody from the scanned ladder is in ranked right now, or this region is still loading. Try another server or refresh.'}
          </p>
        </div>
      )}

      <div className="sp-list">
        {games.map((game) => {
          const id = `${game.platformId}:${game.gameId}`;
          const blue = orderTeam((game.players || []).filter((p) => p.teamId === 100));
          const red = orderTeam((game.players || []).filter((p) => p.teamId === 200));
          const emblem = RANK_IMGS[game.rank?.tier] || null;
          return (
            <article key={id} className="sp-game">
              <div className="sp-meta">
                <span className="sp-time">{fmtElapsed(gameSeconds(game, now))}</span>
                <span className="sp-region">{game.regionLabel}</span>
                <span className="sp-queue">{game.queueName}</span>
                {game.rank?.label && (
                  <span className="sp-rank">
                    {emblem && <img src={emblem} alt="" />}
                    {game.rank.label}
                  </span>
                )}
              </div>
              <TeamRow players={blue} onOpen={openPlayer} />
              <div className="sp-vs">VS</div>
              <TeamRow players={red} onOpen={openPlayer} red />
              <button
                type="button"
                className="sp-watch"
                disabled={launching === id}
                onClick={() => spectateGame(game)}
              >
                {launching === id ? 'Starting…' : 'Spectate'}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TeamRow({ players, onOpen, red }) {
  return (
    <div className={`sp-team${red ? ' is-red' : ''}`}>
      {players.map((p, i) => (
        <button
          key={p.puuid || `${p.champion}-${i}`}
          type="button"
          className={`sp-player${p.pro ? ' is-pro' : ''}`}
          onClick={() => onOpen(p)}
          title={p.riotId || p.gameName}
        >
          <ChampionIcon name={p.champion} size={34} />
          <span className="sp-name">
            {p.pro?.team && <em>{p.pro.team}</em>}
            {p.gameName || p.champion || 'Unknown'}
          </span>
        </button>
      ))}
    </div>
  );
}
