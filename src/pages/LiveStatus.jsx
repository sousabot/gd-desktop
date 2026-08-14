import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getLatestMatchReview, getLiveGame } from '../services/riotApi';
import { platformLabel } from '../services/ddragon';
import { SpellIcon, RuneIcon, ChampionIcon } from '../components/GameIcons';
import MatchReview from '../components/MatchReview';
import { parsePlayerSearch, playerSearchPath } from '../lib/playerRoute';
import { useSession } from '../state/SessionContext';
import './LiveStatus.css';
import CHALLENGER_IMG  from '../assets/ranks/CHALLENGER.webp';
import GRANDMASTER_IMG from '../assets/ranks/GRANDMASTER_SMALL.webp';
import MASTER_IMG      from '../assets/ranks/MASTER.webp';
import DIAMOND_IMG     from '../assets/ranks/DIAMOND.webp';
import EMERALD_IMG     from '../assets/ranks/EMERALD.webp';

const RANK_IMGS = {
  CHALLENGER: CHALLENGER_IMG,
  GRANDMASTER: GRANDMASTER_IMG,
  MASTER: MASTER_IMG,
  DIAMOND: DIAMOND_IMG,
  EMERALD: EMERALD_IMG,
};

const champKey = (name = '') =>
  String(name).replace(/[^a-zA-Z0-9]/g, '').replace(/^./, (c) => c.toUpperCase());

const splashArt = (name) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champKey(name)}_0.jpg`;

function fmtElapsed(seconds = 0) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, Math.floor(seconds % 60));
  return `${m}:${String(s).padStart(2, '0')}`;
}

function rankEmblem(label) {
  const tier = (label || '').split(' ')[0].toUpperCase();
  if (RANK_IMGS[tier]) return RANK_IMGS[tier];
  if (!tier || tier === 'UNRANKED') return null;
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/ranked-emblem/emblem-${tier.toLowerCase()}.png`;
}

function rankLine(player) {
  if (!player.rank || player.rank === 'Unranked') return 'Unranked';
  const [tier, div] = String(player.rank).split(' ');
  const lp = player.lp != null ? `${player.lp} LP` : '';
  if (!div || ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier.toUpperCase())) {
    return lp || tier;
  }
  return lp ? `${div} - ${lp}` : div;
}

function overallLine(player) {
  if (player.wins == null && player.losses == null) return '';
  const w = player.wins || 0;
  const l = player.losses || 0;
  const games = w + l;
  if (!games) return '';
  return `${((w / games) * 100).toFixed(1)}% (${w}w-${l}L)`;
}

function BanRow({ bans, team }) {
  const list = bans.filter((b) => b.teamId === team && b.champion);
  if (!list.length) return <div className="lv-bans lv-bans--empty">No bans</div>;
  return (
    <div className="lv-bans">
      {list.map((b, i) => (
        <div key={`${b.champion}-${i}`} className="lv-ban">
          <ChampionIcon name={b.champion} size={26} />
        </div>
      ))}
    </div>
  );
}

function PlayerCard({ player }) {
  const navigate = useNavigate();
  const emblem = rankEmblem(player.rank);
  const record = overallLine(player);
  const unranked = !player.rank || player.rank === 'Unranked';
  const open = () => {
    if (player.gameName) navigate(playerSearchPath(player.riotId || `${player.gameName}#${player.tagLine || 'EUW'}`));
  };

  return (
    <button
      type="button"
      className={`lv-card${player.isSelf ? ' is-self' : ''}`}
      onClick={open}
    >
      <img className="lv-card-splash" src={splashArt(player.champion)} alt="" />
      <div className="lv-card-fade" />

      <div className="lv-card-top">
        <div className="lv-card-champ">{player.championName || player.champion}</div>
        {player.champGames > 0 && (
          <div className="lv-card-onchamp">
            vs {player.championName || player.champion}: {player.champWins ?? 0}–{Math.max(0, (player.champGames || 0) - (player.champWins || 0))}
            {player.champWr != null ? ` · ${player.champWr.toFixed(0)}%` : ''}
          </div>
        )}
        {(player.last3 || []).length > 0 && (
          <div className="lv-card-last3">
            {player.last3.slice(0, 3).map((win, i) => (
              <span key={i} className={win ? 'is-w' : 'is-l'}>{win ? 'W' : 'L'}</span>
            ))}
          </div>
        )}
      </div>

      {player.dodge ? (
        <div className="lv-card-dodge">Dodge</div>
      ) : player.streak ? (
        <div className={`lv-card-streak ${player.streak > 0 ? 'is-hot' : 'is-cold'}`}>
          <span>{Math.abs(player.streak)}</span>
        </div>
      ) : null}

      <div className="lv-card-bottom">
        <div className="lv-card-name">{player.gameName}</div>
        <div className="lv-card-actions">
          <div className="lv-card-spells">
            <SpellIcon id={player.spell1Id} size={22} />
            <SpellIcon id={player.spell2Id} size={22} />
          </div>
          <div className="lv-card-runes">
            <RuneIcon id={player.keystone} size={24} />
            <RuneIcon id={player.subStyle} size={16} />
          </div>
        </div>
        <div className="lv-card-meta">
          {emblem && !unranked && <img src={emblem} alt="" className="lv-card-emblem" />}
          <span>{rankLine(player)}</span>
          {record && <span className="lv-card-record">{record}</span>}
        </div>
      </div>
    </button>
  );
}

export default function LiveStatus() {
  const { session } = useSession();
  const [searchParams] = useSearchParams();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [recap, setRecap] = useState(null);
  const hadGameRef = useRef(false);

  const viewed = parsePlayerSearch(searchParams);
  const lookup = {
    gameName: viewed.split('#')[0] || session?.gameName,
    tagLine: viewed.split('#')[1] || session?.tagLine,
    region: session?.region || 'europe',
    platform: session?.platform || 'euw1',
  };
  const label = lookup.gameName ? `${lookup.gameName}#${lookup.tagLine || ''}` : null;

  const check = async ({ silent = false } = {}) => {
    if (!lookup.gameName) { setLoading(false); setGame(null); return; }
    if (!silent) setLoading(true);
    const data = await getLiveGame(lookup);
    if (hadGameRef.current && !data) {
      let ended = await getLatestMatchReview(lookup);
      if (!ended) {
        await new Promise((r) => setTimeout(r, 4000));
        ended = await getLatestMatchReview(lookup);
      }
      if (ended) setRecap(ended);
    }
    hadGameRef.current = !!data;
    setGame(data);
    if (data) setFetchedAt(Date.now());
    setCheckedAt(new Date());
    if (!silent) setLoading(false);
  };

  useEffect(() => { check(); /* eslint-disable-line */ }, [lookup.gameName, lookup.tagLine, lookup.platform]);

  useEffect(() => {
    if (!lookup.gameName) return undefined;
    const t = setInterval(() => check({ silent: true }), 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup.gameName, lookup.tagLine, lookup.platform]);

  useEffect(() => {
    if (!game) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [game]);

  const elapsed = game ? (game.gameLength || 0) + Math.floor((now - fetchedAt) / 1000) : 0;

  if (!lookup.gameName) {
    return (
      <div className="lv-page">
        <section className="lv-empty">
          <h1>Live Status</h1>
          <p>Link a Riot ID to watch a live game, or open a player from the leaderboard.</p>
        </section>
      </div>
    );
  }

  return (
    <div className={`lv-page${game && !loading ? ' lv-page--live' : ''}`}>
      <header className="lv-head">
        <div>
          <h1>Live Status</h1>
          <div className="lv-sub">{label} · {platformLabel(lookup.platform)}</div>
        </div>
        <button type="button" className="lv-refresh" onClick={check} disabled={loading}>
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </header>

      {loading ? (
        <div className="lv-loading">Checking spectator…</div>
      ) : game ? (
        <div className="lv-match">
          <div className="lv-match-bar">
            <BanRow bans={game.bans || []} team={100} />
            <div className="lv-timer">
              <span className="lv-timer-dot" />
              <span className="lv-timer-queue">{game.queueName}</span>
              <span className="lv-timer-clock">{fmtElapsed(elapsed)}</span>
            </div>
            <BanRow bans={game.bans || []} team={200} />
          </div>

          <div className="lv-grid">
            {(game.blue || []).map((p) => (
              <PlayerCard key={p.puuid || p.riotId} player={p} />
            ))}
          </div>
          <div className="lv-grid lv-grid--red">
            {(game.red || []).map((p) => (
              <PlayerCard key={p.puuid || p.riotId} player={p} />
            ))}
          </div>
        </div>
      ) : (
        <section className="lv-idle">
          <div className="lv-idle-dot" />
          <h2>Not in game</h2>
          <p>{label} is not currently in a live match.</p>
        </section>
      )}

      {checkedAt && !game && (
        <div className="lv-checked">Last checked {checkedAt.toLocaleTimeString()}</div>
      )}

      {recap && (
        <MatchReview
          game={recap}
          platform={lookup.platform}
          kicker="Post-game recap"
          onClose={() => setRecap(null)}
        />
      )}
    </div>
  );
}
