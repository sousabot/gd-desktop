import React, { useEffect } from 'react';
import { ChampionIcon, ItemIcon, RuneIcon, SpellIcon } from './GameIcons';
import { platformLabel } from '../services/ddragon';
import './MatchReview.css';

function fmtSigned(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Math.round(Number(v));
  return `${n >= 0 ? '+' : ''}${n}`;
}

function goldStory(gd15, won) {
  if (gd15 == null) return 'Gold at 15 was not available (short game or no timeline).';
  const n = Math.round(gd15);
  const abs = Math.abs(n);
  if (!won) {
    if (n <= -300) {
      return `You lost gold at 15 by ${abs}. Missed CS or deaths in lane put you behind before the map opened.`;
    }
    if (n >= 300) {
      return `You were ahead by ${abs} gold at 15, so lane was not why you lost. The game slipped in fights or objectives after that.`;
    }
    return `Lane gold was even at 15 (${fmtSigned(n)}). The loss came later — fights, objectives, or a throw.`;
  }
  if (n >= 300) {
    return `You were ahead of your lane by ${abs} gold at 15. That CS or kill lead is a big reason this game closed.`;
  }
  if (n <= -300) {
    return `You were behind by ${abs} gold at 15 and still won. Lane was a hole; the rest of the map paid it back.`;
  }
  return `Lane was roughly even at 15 (${fmtSigned(n)} gold). The rest of the game decided it.`;
}

export default function MatchReview({ game, platform, kicker, onClose }) {
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
  const path = (game.buildPath || []).filter(Boolean);
  const finals = (game.items || []).filter(Boolean);

  return (
    <div className="gd-review-overlay" onClick={onClose} role="presentation">
      <div
        className="gd-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gd-review-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="gd-review-close" onClick={onClose} aria-label="Close">×</button>
        {kicker && <div className="gd-review-banner">{kicker}</div>}
        <div className="gd-review-kicker">
          <span className={`gd-review-result ${game.win ? 'win' : 'loss'}`}>{game.win ? 'Victory' : 'Defeat'}</span>
          <span>{game.queueType || game.queueLabel || 'Solo/Duo'}</span>
          <span>{game.region || platformLabel(platform)}</span>
          <span>{game.durationMin}:{String(game.durationSec || 0).padStart(2, '0')}</span>
        </div>
        <div className="gd-review-hero">
          <ChampionIcon name={game.champion} size={52} className="gd-review-champ" />
          <div>
            <h2 id="gd-review-title">{game.champion}</h2>
            <div className="gd-review-kda">{game.kills} / {game.deaths} / {game.assists} · {game.kda} KDA</div>
          </div>
        </div>
        <div className="gd-review-highlights">
          <div>
            <span>KDA</span>
            <strong>{game.kills}/{game.deaths}/{game.assists}</strong>
          </div>
          <div>
            <span>Gold diff @15</span>
            <strong className={gdClass}>{fmtSigned(gd15)}</strong>
          </div>
          <div>
            <span>Damage share</span>
            <strong>{share || '—'}</strong>
          </div>
        </div>
        <p className="gd-review-story">{goldStory(gd15, game.win)}</p>
        {path.length > 0 && (
          <div>
            <div className="gd-review-label">Build path</div>
            <div className="gd-review-path">
              {path.map((id, i) => (
                <React.Fragment key={`bp-${id}-${i}`}>
                  {i > 0 && <span className="gd-review-arrow">→</span>}
                  <ItemIcon id={id} size={28} />
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        {(finals.length > 0 || game.spells) && (
          <div className="gd-review-build">
            <div className="gd-review-spells">
              {(game.spells || []).map((id, i) => <SpellIcon key={`sp-${i}`} id={id} size={24} />)}
            </div>
            <div className="gd-review-items">
              {finals.map((id, i) => <ItemIcon key={`it-${i}`} id={id} size={32} />)}
            </div>
          </div>
        )}
        {game.runes?.perks?.length > 0 && (
          <div className="gd-review-runes">
            <RuneIcon id={game.runes.keystone} size={36} />
            {game.runes.perks.slice(1).map((id, i) => (
              <RuneIcon key={`rk-${id}-${i}`} id={id} size={22} />
            ))}
            {game.runes.sub && <RuneIcon id={game.runes.sub} size={22} />}
          </div>
        )}
        <div className="gd-review-teams">
          <div className="gd-review-row">
            {(game.allyTeam || []).slice(0, 5).map((c, i) => (
              <ChampionIcon key={`ra-${c}-${i}`} name={c} size={36} />
            ))}
          </div>
          <div className="gd-review-vs">VS</div>
          <div className="gd-review-row">
            {(game.enemyTeam || []).slice(0, 5).map((c, i) => (
              <ChampionIcon key={`re-${c}-${i}`} name={c} size={36} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
