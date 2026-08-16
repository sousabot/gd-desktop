import React, { useEffect, useMemo, useState } from 'react';
import { getChampionTierList } from '../services/riotApi';
import { ChampionIcon } from '../components/GameIcons';
import { REGIONS } from '../lib/regions';
import { apiUserMessage, noticeFromError } from '../lib/apiNotice';
import { useSession } from '../state/SessionContext';
import RoleIcon from '../components/RoleIcon';
import './TierList.css';

const ROLES = [
  { id: 'all', label: 'All' },
  { id: 'Top', label: 'Top' },
  { id: 'Jungle', label: 'Jungle' },
  { id: 'Mid', label: 'Mid' },
  { id: 'ADC', label: 'Bot' },
  { id: 'Support', label: 'Support' },
];

const RANKS = [
  { id: 'challenger', label: 'Challenger' },
  { id: 'grandmaster', label: 'Grandmaster' },
  { id: 'master_plus', label: 'Master+' },
  { id: 'master', label: 'Master' },
  { id: 'diamond_plus', label: 'Diamond+' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'emerald_plus', label: 'Emerald+' },
  { id: 'platinum_plus', label: 'Platinum+' },
  { id: 'gold_plus', label: 'Gold+' },
];

const RANK_LABEL = Object.fromEntries(RANKS.map((r) => [r.id, r.label]));

function emblemUrl(id) {
  const tier = id.replace('_plus', '').replace(/_.*/, '');
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/ranked-emblem/emblem-${tier}.png`;
}

function fmtGames(n) {
  return Number(n || 0).toLocaleString();
}

function IconStar() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path fill="currentColor" d="M10 2.4 12.2 7l5 .4-3.8 3.3 1.2 4.8L10 13.3 5.4 15.5 6.6 10.7 2.8 7.4l5-.4L10 2.4Z" />
    </svg>
  );
}

export default function TierList() {
  const { session } = useSession();
  const [role, setRole] = useState('all');
  const [rank, setRank] = useState('challenger');
  const [platform, setPlatform] = useState(session?.platform || 'euw1');
  const [query, setQuery] = useState('');
  const [offMeta, setOffMeta] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('Loading ladder…');
  const [error, setError] = useState('');

  const applyPayload = (next) => {
    if (!next) return;
    setData(next);
    if (next.error) setError(apiUserMessage({ message: next.error }) || next.error);
    else setError('');
  };

  const load = async (opts = {}) => {
    setLoading(true);
    if (!opts.force) setError('');
    setProgress(opts.force ? 'Rebuilding…' : 'Loading ladder…');
    let next = null;
    try {
      next = await getChampionTierList({
        platform,
        rank,
        force: !!opts.force,
      });
      applyPayload(next);
    } catch (err) {
      noticeFromError(err);
      setError(apiUserMessage(err) || 'Could not build the tier list. Wait a moment and try again.');
    } finally {
      setLoading(!!next?.refreshing);
    }
  };

  useEffect(() => {
    const unsubProgress = window.riotAPI?.onTierListProgress?.((message) => {
      if (message) setProgress(message);
    });
    const unsubReady = window.riotAPI?.onTierListReady?.((next) => {
      if (!next) return;
      if (next.platform && next.platform !== platform) return;
      if (next.rank && next.rank !== rank) return;
      applyPayload(next);
      setLoading(false);
    });
    return () => {
      unsubProgress?.();
      unsubReady?.();
    };
  }, [platform, rank]);

  useEffect(() => {
    setData(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, rank]);

  const rows = useMemo(() => {
    const all = data?.rows || [];
    const q = query.trim().toLowerCase();
    let list = all.filter((row) => {
      if (row.lowSample) return false;
      if (q && !String(row.champion).toLowerCase().includes(q)) return false;
      if (role !== 'all' && row.role !== role) return false;
      if (!offMeta && row.lanePct < 12) return false;
      return true;
    });
    if (role === 'all') {
      const best = new Map();
      for (const row of list) {
        const prev = best.get(row.champion);
        if (!prev || row.games > prev.games) best.set(row.champion, row);
      }
      list = [...best.values()];
    }
    return [...list].sort((a, b) => a.rank - b.rank || b.winrate - a.winrate);
  }, [data, role, query, offMeta]);

  return (
    <div className="tl-page">
      <header className="tl-head">
        <div>
          <h1>Tier list</h1>
          <p>
            Live Solo/Duo sample from this ladder. Winrates are confidence-adjusted,
            so a 2–0 cannot rank S+.
            {data?.matches ? ` ${fmtGames(data.matches)} games` : ''}
            {data?.reliable != null ? ` · ${data.reliable} champs with enough games` : ''}.
            {data?.matches && data.matches < 80 ? ' Rebuild later to add more games.' : ''}
            {data?.note ? ` ${data.note}` : ''}
          </p>
        </div>
        <button type="button" className="tl-refresh" onClick={() => load({ force: true })} disabled={loading}>
          {loading ? (data ? 'Updating…' : 'Building…') : 'Rebuild'}
        </button>
      </header>

      <div className="tl-toolbar">
        <div className="tl-roles">
          {ROLES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tl-role${role === item.id ? ' is-on' : ''}`}
              onClick={() => setRole(item.id)}
              title={item.label}
            >
              {item.id === 'all'
                ? <IconStar />
                : <RoleIcon role={item.id} size={18} />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="tl-filters">
          <div className="tl-rank-wrap">
            <button type="button" className="tl-select" onClick={() => setRankOpen((v) => !v)}>
              <img src={emblemUrl(rank)} alt="" />
              {RANK_LABEL[rank] || 'Challenger'}
            </button>
            {rankOpen ? (
              <div className="tl-rank-menu">
                {RANKS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === rank ? 'is-on' : ''}
                    onClick={() => { setRank(item.id); setRankOpen(false); }}
                  >
                    <img src={emblemUrl(item.id)} alt="" />
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <select
            className="tl-select"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {REGIONS.map((r) => (
              <option key={r.platform} value={r.platform}>{r.label.replace(/ \(.*\)/, '')}</option>
            ))}
          </select>

          <span className="tl-patch">Patch {data?.patch || '—'}</span>

          <label className="tl-toggle">
            <input type="checkbox" checked={offMeta} onChange={(e) => setOffMeta(e.target.checked)} />
            Off-meta
          </label>

          <input
            className="tl-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search champion..."
          />
        </div>
      </div>

      {error ? <div className="tl-error">{error}</div> : null}

      {loading && !data ? (
        <div className="tl-loading">
          <strong>{progress}</strong>
          First load samples this ladder and saves the games on your PC. Rebuild later to grow the sample.
        </div>
      ) : (
        <div className="tl-table-wrap">
          <div className="tl-table-head">
            <span>Rank</span>
            <span>Champion</span>
            <span>Lane</span>
            <span>Tier</span>
            <span>Winrate</span>
            <span>Pickrate</span>
            <span>Games</span>
          </div>
          {rows.map((row, i) => (
            <div key={`${row.champion}-${row.role}`} className="tl-row">
              <span className="tl-num">{i + 1}</span>
              <span className="tl-champ">
                <ChampionIcon name={row.champion} size={32} />
                {row.champion}
              </span>
              <span className="tl-lane">
                <RoleIcon role={row.role} size={16} />
                <em>{row.lanePct.toFixed(1)}%</em>
              </span>
              <span className={`tl-tier is-${String(row.tier).replace('+', 'p').replace('?', 'na')}`}>{row.tier}</span>
              <span className="tl-wr">
                {row.winrate.toFixed(1)}%
                <em className={row.delta >= 0 ? 'is-up' : 'is-down'}>
                  {row.delta >= 0 ? '+' : ''}{row.delta.toFixed(1)} vs field
                </em>
              </span>
              <span>{row.pickrate.toFixed(1)}%</span>
              <span>{fmtGames(row.games)}</span>
            </div>
          ))}
          {!rows.length && !loading ? (
            <div className="tl-empty">
              {error ? 'No sample loaded yet. Wait 2 minutes if you hit the rate limit, then rebuild on Challenger.' : 'No champions matched these filters.'}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
