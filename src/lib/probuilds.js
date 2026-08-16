const KEYSTONE_ID = {
  'Press the Attack': 8005,
  'Lethal Tempo': 8008,
  Conqueror: 8010,
  'Fleet Footwork': 8021,
  Electrocute: 8112,
  Predator: 8124,
  'Dark Harvest': 8128,
  'Hail of Blades': 9923,
  'Summon Aery': 8214,
  'Arcane Comet': 8229,
  'Phase Rush': 8230,
  "Stormraider's Surge": 8230,
  'Glacial Augment': 8351,
  'Unsealed Spellbook': 8360,
  'First Strike': 8369,
  Grasp: 8437,
  'Grasp of the Undying': 8437,
  Aftershock: 8439,
  Guardian: 8465,
};

const TREE_ID = {
  Precision: 8000,
  Domination: 8100,
  Sorcery: 8200,
  Inspiration: 8300,
  Resolve: 8400,
};

const SKIP_ITEM = /potion|elixir|ward|oracle lens|farsight|biscuit|stopwatch|control ward|stealth ward|slightly magical|^boots$/i;

// Same item, later name — so Leaguepedia scoreboards get current icons.
const ITEM_ALIASES = {
  'liandrys anguish': 'liandrys torment',
  'ludens tempest': 'ludens companion',
  'ludens echoes': 'ludens companion',
  'navori quickblades': 'navori flickerblade',
  'mikaels crucible': 'mikaels blessing',
  moonstone: 'moonstone renewer',
  'staff of flowing waters': 'staff of flowing water',
};

function normItem(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\s+/g, ' ');
}

export function keystoneId(name) {
  return KEYSTONE_ID[name] || null;
}

export function treeId(name) {
  return TREE_ID[name] || null;
}

export function buildItemNames(items = []) {
  return items.filter((name) => name && !SKIP_ITEM.test(name));
}

export function coreItemNames(items = []) {
  return buildItemNames(items).slice(0, 3);
}

export function resolveItemId(name, index = {}) {
  const key = normItem(name);
  if (!key) return null;
  const mapped = ITEM_ALIASES[key] || key;
  return index[mapped] || index[key] || index[String(name || '').trim().toLowerCase()] || null;
}

export function timeAgo(value) {
  const stamp = Date.parse(String(value || '').replace(' ', 'T') + 'Z');
  if (!Number.isFinite(stamp)) return '';
  const mins = Math.max(0, Math.round((Date.now() - stamp) / 60000));
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 21) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
}
