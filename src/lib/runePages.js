import { typicalLane } from './champLane';
import bundled from '../data/runePages.json';

const CDRAGON_REC = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-rune-recommendations.json';
const CDRAGON_SUM = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json';

const POS = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support' };

const ALIAS = {
  Fiddlesticks: 'FiddleSticks',
  Wukong: 'MonkeyKing',
  RenataGlasc: 'Renata',
  KhaZix: 'Khazix',
  KaiSa: 'Kaisa',
  ChoGath: 'Chogath',
  VelKoz: 'Velkoz',
};

const KEYSTONE = {
  8005: 'Press the Attack',
  8008: 'Lethal Tempo',
  8010: 'Conqueror',
  8021: 'Fleet Footwork',
  8112: 'Electrocute',
  8128: 'Dark Harvest',
  8214: 'Summon Aery',
  8229: 'Arcane Comet',
  8230: "Stormraider's Surge",
  8351: 'Glacial Augment',
  8360: 'Unsealed Spellbook',
  8369: 'First Strike',
  8437: 'Grasp',
  8439: 'Aftershock',
  8465: 'Guardian',
  8992: 'Deathfire Touch',
  9923: 'Hail of Blades',
};

const TREE = {
  8000: 'Precision',
  8100: 'Domination',
  8200: 'Sorcery',
  8300: 'Inspiration',
  8400: 'Resolve',
};

const POKE_KEYS = new Set([8369, 8021, 8229, 8214, 8992]);
const FIGHT_KEYS = new Set([8005, 8112, 8010, 9923, 8128]);
const PAGE_IDS = ['lane', 'fight', 'comp'];

let cache = bundled;
let pending = null;

export function indexRecommendations(rec, summary) {
  const champs = (Array.isArray(summary) ? summary : Object.values(summary || {}))
    .filter((c) => c && c.id > 0 && c.alias && !String(c.alias).startsWith('Jade_'));
  const recBy = new Map((Array.isArray(rec) ? rec : []).map((r) => [r.championId, r]));
  const out = {};
  for (const c of champs) {
    const row = recBy.get(c.id);
    if (!row) continue;
    const byRole = {};
    for (const p of row.runeRecommendations || []) {
      if (p.mapId !== 11) continue;
      const role = POS[p.position];
      if (!role) continue;
      if (!byRole[role]) byRole[role] = [];
      byRole[role].push({
        p: p.primaryPerkStyleId,
        s: p.secondaryPerkStyleId,
        k: (p.perkIds || []).slice(0, 9),
        sp: p.summonerSpellIds || [4, 14],
      });
    }
    if (Object.keys(byRole).length) out[c.alias] = byRole;
  }
  return out;
}

export function refreshRunePages() {
  if (!pending) {
    pending = Promise.all([
      fetch(CDRAGON_REC).then((r) => r.json()),
      fetch(CDRAGON_SUM).then((r) => r.json()),
    ]).then(([rec, sum]) => {
      const next = indexRecommendations(rec, sum);
      if (next && Object.keys(next).length > 100) cache = next;
      return cache;
    }).catch(() => cache);
  }
  return pending;
}

function champBlock(key) {
  if (!key) return null;
  if (cache[key]) return cache[key];
  const mapped = ALIAS[key];
  if (mapped && cache[mapped]) return cache[mapped];
  const lower = String(key).toLowerCase();
  const hit = Object.keys(cache).find((k) => k.toLowerCase() === lower);
  return hit ? cache[hit] : null;
}

export function riotPagesFor(champKey, role) {
  const block = champBlock(champKey);
  if (!block) return [];
  return block[role] || block[typicalLane(champKey)] || Object.values(block)[0] || [];
}

function labelFor(row, used) {
  const base = KEYSTONE[row.k?.[0]] || 'Runes';
  const n = (used.get(base) || 0) + 1;
  used.set(base, n);
  if (n === 1) return base;
  const tree = TREE[row.s];
  return tree ? `${base} · ${tree}` : `${base} ${n}`;
}

function orderSpells(spells) {
  const ids = (spells || []).filter(Boolean);
  if (ids.includes(4)) return [4, ...ids.filter((id) => id !== 4)].slice(0, 2);
  return ids.slice(0, 2);
}

export function specsFromRiot(rows, profile, role) {
  const used = new Map();
  const vs = profile?.laneName;
  return (rows || []).slice(0, 3).map((row, i) => {
    const label = labelFor(row, used);
    const keystone = row.k?.[0];
    let why = i === 0 ? `Most used ${role} page` : `${label} alternative`;
    if (vs && POKE_KEYS.has(keystone) && profile.lanePoke) why = `Poke / gold into ${vs}`;
    if (vs && FIGHT_KEYS.has(keystone) && profile.laneAllIn) why = `All-in vs ${vs}`;
    if ((profile?.tanks || 0) >= 2 && (row.k || []).includes(8017)) why = 'Cut Down into their tanks';
    return {
      id: PAGE_IDS[i] || `alt${i}`,
      label,
      why,
      primaryStyleId: row.p,
      subStyleId: row.s,
      selectedPerkIds: row.k,
      spells: orderSpells(row.sp),
      note: why,
    };
  });
}

export function recommendRiotPage(specs, profile) {
  if (!specs?.length) return null;
  const key = (s) => s.selectedPerkIds?.[0];
  if (profile?.lanePoke) {
    const hit = specs.find((s) => POKE_KEYS.has(key(s)));
    if (hit) return hit.id;
  }
  if (profile?.laneAllIn) {
    const hit = specs.find((s) => FIGHT_KEYS.has(key(s)));
    if (hit) return hit.id;
  }
  if ((profile?.tanks || 0) >= 2) {
    const hit = specs.find((s) => (s.selectedPerkIds || []).includes(8017));
    if (hit) return hit.id;
  }
  return specs[0].id;
}
