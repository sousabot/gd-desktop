const GEM = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/rarity-gem-icons';
const ASSET = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images';

export const RP_ICON = `${ASSET}/icon-rp-24.png`;
export const LEGACY_ICON = `${ASSET}/po-legacy-icon.png`;

export const RARITY_TIERS = [
  { id: 'Regular', gem: `${GEM}/0_large.png` },
  { id: 'Rare', gem: `${GEM}/1_large.png` },
  { id: 'Epic', gem: `${GEM}/epic.png` },
  { id: 'Legendary', gem: `${GEM}/legendary.png` },
  { id: 'Mythic', gem: `${GEM}/mythic.png` },
  { id: 'Ultimate', gem: `${GEM}/ultimate.png` },
  { id: 'Transcendent', gem: `${GEM}/transcendent.png` },
  { id: 'Exalted', gem: `${GEM}/exalted.png` },
];

const TIER_BY_ID = new Map(RARITY_TIERS.map((row) => [row.id, row]));
const TIER_RANK = new Map(RARITY_TIERS.map((row, i) => [row.id, i]));

export function rarityFromRaw(raw) {
  const key = String(raw || '').replace(/^k/i, '').toLowerCase();
  if (key.includes('exalted')) return 'Exalted';
  if (key.includes('transcendent')) return 'Transcendent';
  if (key.includes('ultimate')) return 'Ultimate';
  if (key.includes('mythic')) return 'Mythic';
  if (key.includes('legendary')) return 'Legendary';
  if (key.includes('epic')) return 'Epic';
  if (key.includes('rare')) return 'Rare';
  return 'Regular';
}

export function rarityGem(rarity) {
  return TIER_BY_ID.get(rarityFromRaw(rarity))?.gem || RARITY_TIERS[0].gem;
}

export function rarityRank(rarity) {
  return TIER_RANK.get(rarityFromRaw(rarity)) ?? 0;
}

export function rarityClassName(rarity) {
  const key = rarityFromRaw(rarity).toLowerCase();
  return `is-${key}`;
}
