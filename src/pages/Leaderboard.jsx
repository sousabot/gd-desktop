import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTopLeague } from '../services/riotApi';
import { champIconUrl, platformLabel, useDdragonVersion } from '../services/ddragon';
import { playerSearchPath } from '../lib/playerRoute';
import { useSession } from '../state/SessionContext';
import RoleIcon from '../components/RoleIcon';
import './Leaderboard.css';

import CHALLENGER_IMG  from '../assets/ranks/CHALLENGER_SMALL.webp';
import GRANDMASTER_IMG from '../assets/ranks/GRANDMASTER_SMALL.webp';
import MASTER_IMG      from '../assets/ranks/MASTER.webp';

const TIERS = ['challenger', 'grandmaster', 'master'];
const TIER_COLORS = { challenger: '#ffd76b', grandmaster: '#ff5c68', master: '#a06bff' };
const TIER_IMGS   = { challenger: CHALLENGER_IMG, grandmaster: GRANDMASTER_IMG, master: MASTER_IMG };
const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

function splitRiotId(name = '', fallbackTag = '') {
  const [gameName, tagLine] = String(name).split('#');
  return { gameName: gameName || name || '—', tagLine: tagLine || fallbackTag };
}

function gamesOf(row) { return (row.wins || 0) + (row.losses || 0); }
function wrOf(row) { return Math.round((row.wins / Math.max(1, gamesOf(row))) * 100); }
function kdaOf(row) { return row.kda != null && row.kda !== '' ? row.kda : '—'; }
function champsOf(row) {
  return (row.topChampions || []).slice(0, 4);
}

function wrTone(pct) {
  if (pct >= 58) return 'is-hot';
  if (pct <= 48) return 'is-cold';
  return '';
}

const PLACE_TONE = { 1: '#ffd76b', 2: '#c9d0dc', 3: '#cd7f32' };

function ChampThumb({ name, size = 28 }) {
  const version = useDdragonVersion();
  const [src, setSrc] = useState(() => champIconUrl(name, version));
  useEffect(() => { setSrc(champIconUrl(name, version)); }, [name, version]);
  return (
    <img
      src={src}
      alt={name}
      title={name}
      className="lb-champ"
      onError={() => setSrc(champIconUrl('Aatrox', version))}
      style={{ width: size, height: size }}
    />
  );
}

function PlayerAvatar({ name, url, size = 36 }) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?')[0].toUpperCase();
  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        className="lb-avatar-img"
        style={{ width: size, height: size }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div className="lb-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initial}
    </div>
  );
}

function RegionTag({ tag = 'EUW' }) {
  return <span className={`lb-region lb-region--${tag.toLowerCase()}`}>{tag}</span>;
}

function WinrateCell({ pct, wins, losses }) {
  return (
    <div className="lb-row-wr">
      <div className="lb-wr-copy">
        <span className="lb-wl">{wins}W – {losses}L</span>
        <span className={`lb-wr-pill ${wrTone(pct)}`}>{pct}%</span>
      </div>
      <div className="lb-wr-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function PodiumCard({ row, place, emblem, region }) {
  const { gameName, tagLine } = splitRiotId(row.summonerName, region);
  const wr = wrOf(row);
  const champs = champsOf(row);
  const to = playerSearchPath(row.summonerName, region);
  const tone = PLACE_TONE[place];

  return (
    <Link to={to} className={`lb-podium-card is-p${place} is-clickable`}>
      <div className="lb-podium-head">
        <span className="lb-podium-place" style={{ color: tone }}>{place}</span>
        <RegionTag tag={region} />
        <PlayerAvatar name={gameName} url={row.profileIconUrl} size={44} />
        <div className="lb-podium-who">
          <div className="lb-podium-name">{gameName}</div>
          <div className="lb-podium-sub">#{tagLine}</div>
        </div>
        {row.role ? (
          <span className="lb-podium-role" title={row.role}>
            <RoleIcon role={row.role} size={16} />
          </span>
        ) : null}
      </div>

      <div className="lb-podium-lp-block">
        <img src={emblem} alt="" className="lb-podium-emblem" />
        <div className="lb-podium-lp" style={{ color: tone }}>{row.lp.toLocaleString()} <span>LP</span></div>
        <div className="lb-podium-record">
          <b className="is-w">{row.wins}W</b> – <b className="is-l">{row.losses}L</b>
          <span className="lb-podium-wr">({wr}%)</span>
        </div>
      </div>

      <div className="lb-podium-foot">
        <span className="lb-podium-kda">{kdaOf(row)} KDA</span>
        <div className="lb-champs">
          {champs.map((c) => <ChampThumb key={c} name={c} size={28} />)}
        </div>
        <span className="lb-podium-games">{gamesOf(row)} games</span>
      </div>
    </Link>
  );
}

export default function Leaderboard() {
  const { session } = useSession();
  const platform = session?.platform || 'euw1';
  const region = session?.region || 'europe';
  const regionTag = platformLabel(platform);
  const [tier, setTier] = useState('challenger');
  const [role, setRole] = useState('All');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEnriching(false);
    setError('');
    getTopLeague({
      tier,
      platform,
      region,
      onPartial: (data) => {
        if (cancelled) return;
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
        setEnriching(true);
      },
    }).then((data) => {
      if (cancelled) return;
      setRows(Array.isArray(data) ? data : []);
      setLoading(false);
      setEnriching(false);
    }).catch((err) => {
      if (!cancelled) {
        setLoading(false);
        setEnriching(false);
        setRows([]);
        setError(err?.message || 'Could not load this ladder.');
      }
    });
    return () => { cancelled = true; };
  }, [tier, platform, region]);

  const roleCounts = useMemo(() => {
    const counts = { Top: 0, Jungle: 0, Mid: 0, ADC: 0, Support: 0 };
    rows.forEach((r) => { if (r.role && counts[r.role] != null) counts[r.role] += 1; });
    const known = Object.values(counts).reduce((a, b) => a + b, 0);
    const pct = {};
    ROLES.forEach((r) => {
      pct[r] = known >= 8 ? ((counts[r] / known) * 100).toFixed(1) : '—';
    });
    return pct;
  }, [rows]);

  const filtered = useMemo(
    () => (role === 'All' ? rows : rows.filter((r) => r.role === role)),
    [rows, role]
  );

  const img = TIER_IMGS[tier];
  const top3 = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  return (
    <div className="lb-page">
      <div className="lb-page-head">
        <h1 className="lb-page-title">Leaderboard</h1>
        <div className="lb-tabs">
          {TIERS.map((t) => (
            <button
              key={t}
              className={`lb-tab${t === tier ? ' is-on' : ''}`}
              style={t === tier ? { '--tc': TIER_COLORS[t] } : undefined}
              onClick={() => setTier(t)}
            >
              <img src={TIER_IMGS[t]} alt="" className="lb-tab-icon" />
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="lb-toolbar">
        <div className="lb-roles">
          <button
            className={`lb-role-btn${role === 'All' ? ' is-on' : ''}`}
            onClick={() => setRole('All')}
          >
            All
          </button>
          {ROLES.map((r) => (
            <button
              key={r}
              className={`lb-role-btn${role === r ? ' is-on' : ''}`}
              onClick={() => setRole(r)}
              title={r}
            >
              <RoleIcon role={r} size={22} />
              <span className="lb-role-pct">{roleCounts[r]}%</span>
            </button>
          ))}
        </div>
        <div className="lb-toolbar-right">
          <span className="lb-filter-chip">{regionTag} · Solo/Duo</span>
          {enriching ? <span className="lb-filter-chip is-soft">Filling roles…</span> : null}
        </div>
      </div>

      {error && !rows.length ? (
        <div className="lb-empty">
          <span>{error.includes('desktop app') ? error : 'Could not load this ladder. Check the linked region and try again.'}</span>
        </div>
      ) : loading && !rows.length ? (
        <div className="lb-body">
          <div className="lb-podium">
            {[1, 2, 3].map((n) => <div key={n} className={`lb-skel lb-skel-podium is-p${n}`} />)}
          </div>
          <div className="lb-list">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="lb-skel lb-skel-row" />)}
          </div>
        </div>
      ) : (
        <div className="lb-body">
          {top3.length > 0 && (
            <div className="lb-podium">
              {top3.map((r, i) => (
                <PodiumCard key={r.puuid || r.rank} row={r} place={i + 1} emblem={img} region={regionTag} />
              ))}
            </div>
          )}

          <div className="lb-list">
            <div className="lb-list-head">
              <span>Player</span>
              <span>Role</span>
              <span>Rank</span>
              <span>Winrate</span>
              <span>KDA</span>
              <span>Best champions</span>
            </div>

            {rest.map((r) => {
              const { gameName, tagLine } = splitRiotId(r.summonerName, regionTag);
              const wr = wrOf(r);
              const to = playerSearchPath(r.summonerName, tagLine || regionTag);
              return (
                <Link key={r.puuid || r.rank} to={to} className="lb-row is-clickable">
                  <div className="lb-row-player">
                    <span className="lb-rank-num">{r.rank}</span>
                    <RegionTag tag={regionTag} />
                    <PlayerAvatar name={gameName} url={r.profileIconUrl} size={36} />
                    <div>
                      <div className="lb-player-name">{gameName}</div>
                      <div className="lb-player-tag">#{tagLine}</div>
                    </div>
                  </div>

                  <div className="lb-row-role">
                    {r.role ? (
                      <>
                        <RoleIcon role={r.role} size={18} />
                        <span>{r.role}</span>
                      </>
                    ) : <span className="lb-muted">{enriching ? '…' : '—'}</span>}
                  </div>

                  <div className="lb-row-rank">
                    <img src={img} alt="" className="lb-row-emblem" />
                    <span className="lb-lp-val">{Number(r.lp || 0).toLocaleString()} LP</span>
                  </div>

                  <WinrateCell pct={wr} wins={r.wins} losses={r.losses} />

                  <div className="lb-kda-val">{kdaOf(r)}</div>

                  <div className="lb-champs">
                    {champsOf(r).map((c) => <ChampThumb key={c} name={c} size={26} />)}
                  </div>
                </Link>
              );
            })}
            {!rest.length && !top3.length && !loading ? (
              <div className="lb-empty">No players in this filter.</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
