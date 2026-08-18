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

function normKeystone(name) {
  return String(name || '')
    .replace(/\[\[|\]\]/g, '')
    .replace(/^file:/i, '')
    .replace(/\.png$/i, '')
    .replace(/['’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const KEYSTONE_BY_NORM = Object.fromEntries(
  Object.entries(KEYSTONE_ID).map(([label, id]) => [normKeystone(label), id]),
);

export function keystoneId(name) {
  const n = normKeystone(name);
  if (!n) return null;
  if (KEYSTONE_BY_NORM[n]) return KEYSTONE_BY_NORM[n];
  const hit = Object.keys(KEYSTONE_BY_NORM).find((key) => n.includes(key) || key.includes(n));
  return hit ? KEYSTONE_BY_NORM[hit] : null;
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

function tallyItems(rows) {
  const counts = new Map();
  (rows || []).forEach((row) => {
    buildItemNames(row.items).forEach((name) => {
      const cur = counts.get(name) || { name, n: 0, w: 0 };
      cur.n += 1;
      if (row.won === true) cur.w += 1;
      counts.set(name, cur);
    });
  });
  const known = (rows || []).some((row) => row.won === true || row.won === false);
  return [...counts.values()]
    .sort((a, b) => {
      if (known) {
        const ar = a.w / a.n;
        const br = b.w / b.n;
        if (br !== ar) return br - ar;
      }
      return b.n - a.n;
    })
    .slice(0, 6);
}

export function itemsForKeystone(rows = [], perkId) {
  const all = rows || [];
  if (!all.length) {
    return { items: [], games: 0, wins: 0, matched: false, mixed: false, hasResults: false, hasWins: false };
  }
  const keyed = perkId ? all.filter((row) => keystoneId(row.keystone) === perkId) : [];
  const mixed = !keyed.length;
  const sample = mixed ? all : keyed;
  const items = tallyItems(sample);
  const wins = sample.filter((row) => row.won === true).length;
  const known = sample.some((row) => row.won === true || row.won === false);
  return {
    items,
    games: sample.length,
    wins,
    matched: !mixed,
    mixed,
    hasResults: items.length > 0,
    hasWins: known,
  };
}

const WIKI_ROLE = { Top: 'Top', Jungle: 'Jungle', Mid: 'Mid', ADC: 'Bot', Support: 'Support' };

function cargoWhere(champion, role) {
  const name = String(champion || '').replace(/"/g, '').trim();
  const wikiRole = WIKI_ROLE[role] || role || '';
  if (wikiRole) return `Champion="${name}" AND IngameRole="${wikiRole}" AND DateTime_UTC IS NOT NULL`;
  return `Champion="${name}" AND DateTime_UTC IS NOT NULL`;
}

function mapWikiRows(payload) {
  const rows = Array.isArray(payload?.cargoquery) ? payload.cargoquery : [];
  return rows.map((entry, i) => {
    const row = entry?.title || {};
    const link = String(row.Link || '').trim();
    return {
      id: `${link || 'p'}-${row.DateTime_UTC || i}`,
      player: link.replace(/\s*\(.*\)$/, '').trim() || link,
      team: row.Team || '',
      role: row.IngameRole || '',
      at: row.DateTime_UTC || '',
      items: String(row.Items || '').split(';').map((part) => part.trim()).filter(Boolean),
      keystone: row.KeystoneRune || '',
      primary: row.PrimaryTree || '',
      secondary: row.SecondaryTree || '',
    };
  }).filter((row) => row.player);
}

async function cargoQuery(champion, role) {
  const params = new URLSearchParams({
    action: 'cargoquery',
    format: 'json',
    origin: '*',
    limit: '25',
    tables: 'ScoreboardPlayers',
    fields: 'Link,Team,Champion,IngameRole,DateTime_UTC,Items,KeystoneRune,PrimaryTree,SecondaryTree',
    where: cargoWhere(champion, role),
    order_by: 'DateTime_UTC DESC',
  });
  const res = await fetch(`https://lol.fandom.com/api.php?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Leaguepedia ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.info || 'Leaguepedia cargo error');
  return mapWikiRows(json);
}

export async function fetchProbuilds({ champion, role } = {}) {
  const name = String(champion || '').trim();
  if (!name) return { ok: true, rows: [] };
  try {
    let rows = role ? await cargoQuery(name, role) : [];
    if (!rows.length) rows = await cargoQuery(name, '');
    return { ok: true, rows, source: 'Leaguepedia' };
  } catch (err) {
    return { ok: false, rows: [], error: err.message || 'Could not load pro builds.' };
  }
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
