import React, { useEffect, useMemo } from 'react';
import { ChampionIcon, ItemIcon, RuneIcon, SpellIcon } from './GameIcons';
import { platformLabel, useItemCatalog } from '../services/ddragon';
import { useI18n } from '../i18n/LocaleContext';
import { pickMatchStory } from '../lib/matchStory';
import './MatchReview.css';

function fmtSigned(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Math.round(Number(v));
  return `${n >= 0 ? '+' : ''}${n}`;
}

function fmtClock(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return '—';
  const s = Math.max(0, Math.floor(Number(ms) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function purchasesOf(game) {
  if (Array.isArray(game.buildPurchases) && game.buildPurchases.length) {
    return game.buildPurchases.filter((row) => row && row.id);
  }
  return (game.buildPath || []).filter(Boolean).map((id) => ({ id, atMs: null }));
}

function isJunkItem(meta) {
  const tags = meta?.tags || [];
  return tags.includes('Consumable') || tags.includes('Trinket') || tags.includes('Jungle');
}

function groupBuild(purchases, catalog) {
  const pending = [];
  const completes = [];
  for (const buy of purchases) {
    const meta = catalog[buy.id] || {};
    if (isJunkItem(meta)) continue;
    const from = (meta.from || []).map(Number).filter((n) => n > 0);
    const node = { id: buy.id, atMs: buy.atMs, name: meta.name || '', from };
    if (from.length) {
      const components = [];
      from.forEach((cid) => {
        for (let i = pending.length - 1; i >= 0; i -= 1) {
          if (pending[i].id === cid && !pending[i].consumed) {
            pending[i].consumed = true;
            components.push(pending[i]);
            break;
          }
        }
      });
      completes.push({ ...node, components });
    } else {
      pending.push({ ...node, consumed: false, components: [] });
    }
  }
  const leftover = pending.filter((p) => !p.consumed);
  return [...completes, ...leftover].sort((a, b) => (a.atMs || 0) - (b.atMs || 0));
}

export default function MatchReview({ game, platform, kicker, onClose }) {
  const catalog = useItemCatalog();
  const { t } = useI18n();
  const rows = useMemo(
    () => (game ? groupBuild(purchasesOf(game), catalog) : []),
    [game, catalog],
  );

  useEffect(() => {
    if (!game) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, onClose]);

  if (!game) return null;

  const gd15 = game.goldDiff15;
  const gdClass = gd15 == null ? '' : gd15 >= 0 ? 'is-pos' : 'is-neg';
  const share = game.damageShare != null ? `${Math.round(game.damageShare * 100)}%` : null;
  const finals = (game.items || []).filter(Boolean);
  const story = pickMatchStory(game);

  return (
    <div className="rift-review-overlay" onClick={onClose} role="presentation">
      <div
        className="rift-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rift-review-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="rift-review-close" onClick={onClose} aria-label="Close">×</button>
        {kicker && <div className="rift-review-banner">{kicker}</div>}
        <div className="rift-review-kicker">
          <span className={`rift-review-result ${game.win ? 'win' : 'loss'}`}>{game.win ? t('review.victory') : t('review.defeat')}</span>
          <span>{game.queueType || game.queueLabel || 'Solo/Duo'}</span>
          <span>{game.region || platformLabel(platform)}</span>
          <span>{game.durationMin}:{String(game.durationSec || 0).padStart(2, '0')}</span>
        </div>
        <div className="rift-review-hero">
          <ChampionIcon name={game.champion} size={52} className="rift-review-champ" />
          <div>
            <h2 id="rift-review-title">{game.champion}</h2>
            <div className="rift-review-kda">{game.kills} / {game.deaths} / {game.assists} · {game.kda} KDA</div>
          </div>
        </div>
        <div className="rift-review-highlights">
          <div>
            <span>{t('review.gold15')}</span>
            <strong className={gdClass}>{fmtSigned(gd15)}</strong>
          </div>
          <div>
            <span>{t('review.damage')}</span>
            <strong>{share || '—'}</strong>
          </div>
          <div>
            <span>{t('review.cs')}</span>
            <strong>{game.cs ?? game.csm ?? '—'}</strong>
          </div>
        </div>
        <p className="rift-review-story">{t(story.key, story.vars)}</p>
        {rows.length > 0 && (
          <div className="rift-review-pathblock">
            <div className="rift-review-label">{t('review.build')}</div>
            <div className="rift-review-buys">
              {rows.map((row, i) => {
                const recipe = (row.from || []).length >= 2
                  ? row.from.map((id) => ({
                    id,
                    atMs: row.components?.find((c) => c.id === id)?.atMs ?? null,
                    name: catalog[id]?.name || '',
                  }))
                  : [];
                return (
                  <div key={`buy-${row.id}-${row.atMs}-${i}`} className="rift-review-buy">
                    <span className="rift-review-buy-time">{fmtClock(row.atMs)}</span>
                    <ItemIcon id={row.id} size={28} title={row.name} />
                    <div className="rift-review-buy-copy">
                      <strong>{row.name || `Item ${row.id}`}</strong>
                      {recipe.length > 0 && (
                        <div className="rift-review-recipe">
                          {recipe.map((part, pi) => (
                            <span
                              key={`rp-${row.id}-${part.id}-${pi}`}
                              className="rift-review-part"
                              title={part.atMs != null ? `${part.name} · ${fmtClock(part.atMs)}` : part.name}
                            >
                              <ItemIcon id={part.id} size={18} title={part.name} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {(finals.length > 0 || game.spells || game.runes?.perks?.length || game.allyTeam?.length) && (
          <div className="rift-review-foot">
            {(finals.length > 0 || game.spells || game.runes?.perks?.length) && (
              <div className="rift-review-kit">
                <div className="rift-review-loadout">
                  <div className="rift-review-spells">
                    {(game.spells || []).map((id, i) => <SpellIcon key={`sp-${i}`} id={id} size={22} />)}
                  </div>
                  <div className="rift-review-items">
                    {finals.map((id, i) => <ItemIcon key={`it-${i}`} id={id} size={28} />)}
                  </div>
                </div>
                {game.runes?.perks?.length > 0 && (
                  <div className="rift-review-runes">
                    <RuneIcon id={game.runes.keystone} size={26} />
                    {game.runes.perks.slice(1).map((id, i) => (
                      <RuneIcon key={`rk-${id}-${i}`} id={id} size={18} />
                    ))}
                    {game.runes.sub && <RuneIcon id={game.runes.sub} size={18} />}
                  </div>
                )}
              </div>
            )}
            {(game.allyTeam?.length || game.enemyTeam?.length) ? (
              <div className="rift-review-teams">
                <div className="rift-review-row">
                  {(game.allyTeam || []).slice(0, 5).map((c, i) => (
                    <ChampionIcon key={`ra-${c}-${i}`} name={c} size={32} />
                  ))}
                </div>
                <div className="rift-review-vs">VS</div>
                <div className="rift-review-row">
                  {(game.enemyTeam || []).slice(0, 5).map((c, i) => (
                    <ChampionIcon key={`re-${c}-${i}`} name={c} size={32} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
