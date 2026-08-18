import CHALLENGER_IMG from '../assets/ranks/CHALLENGER.webp';
import GRANDMASTER_IMG from '../assets/ranks/GRANDMASTER_SMALL.webp';
import MASTER_IMG from '../assets/ranks/MASTER.webp';
import DIAMOND_IMG from '../assets/ranks/DIAMOND.webp';
import EMERALD_IMG from '../assets/ranks/EMERALD.webp';
import PLATINUM_IMG from '../assets/ranks/PLATINUM.png';
import GOLD_IMG from '../assets/ranks/GOLD.png';
import SILVER_IMG from '../assets/ranks/SILVER.png';
import BRONZE_IMG from '../assets/ranks/BRONZE.png';
import IRON_IMG from '../assets/ranks/IRON.png';

export const RANK_COLORS = {
  IRON: '#8a8a8a',
  BRONZE: '#cd7f32',
  SILVER: '#9fb3c8',
  GOLD: '#e0b256',
  PLATINUM: '#4fd7c5',
  EMERALD: '#3ecf8e',
  DIAMOND: '#5ba2ff',
  MASTER: '#a06bff',
  GRANDMASTER: '#ff5c68',
  CHALLENGER: '#ffd76b',
};

const RANK_IMGS = {
  CHALLENGER: CHALLENGER_IMG,
  GRANDMASTER: GRANDMASTER_IMG,
  MASTER: MASTER_IMG,
  DIAMOND: DIAMOND_IMG,
  EMERALD: EMERALD_IMG,
  PLATINUM: PLATINUM_IMG,
  GOLD: GOLD_IMG,
  SILVER: SILVER_IMG,
  BRONZE: BRONZE_IMG,
  IRON: IRON_IMG,
};

export function rankTierKey(label) {
  return String(label || '').trim().split(/[\s/]+/)[0].toUpperCase();
}

export function rankColor(label) {
  return RANK_COLORS[rankTierKey(label)] || '#7c5cff';
}

const FULLFRAME_TIERS = new Set(['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM']);

export function rankImg(label) {
  const tier = rankTierKey(label);
  if (!tier || tier === 'UNRANKED' || tier === 'NONE') return null;
  return RANK_IMGS[tier] || null;
}

export function rankEmblemClass(label, base) {
  return FULLFRAME_TIERS.has(rankTierKey(label)) ? `${base} is-fullframe` : base;
}
