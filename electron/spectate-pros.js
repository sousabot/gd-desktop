const cache = { at: 0, byName: new Map() };
const TTL_MS = 6 * 60 * 60 * 1000;

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['.`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value) {
  return norm(value).replace(/\s+/g, '');
}

function addName(map, name, row) {
  const key = norm(name);
  const tight = compact(name);
  if (key) map.set(key, row);
  if (tight && tight !== key) map.set(tight, row);
}

async function cargoPlayers() {
  const params = new URLSearchParams({
    action: 'cargoquery',
    format: 'json',
    origin: '*',
    limit: '500',
    tables: 'Players',
    fields: 'Player,Team,Role,League,ID',
    where: 'IsRetired=0 AND Team IS NOT NULL',
  });
  const res = await fetch(`https://lol.fandom.com/api.php?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'GDEsportsDesktop/0.1.2 (Leaguepedia cargo; spectate roster)',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Leaguepedia ${res.status}`);
  const payload = await res.json();
  const rows = Array.isArray(payload?.cargoquery) ? payload.cargoquery : [];
  const map = new Map();
  for (const entry of rows) {
    const title = entry?.title || {};
    const player = String(title.Player || '').trim();
    if (!player) continue;
    const row = {
      player,
      team: String(title.Team || '').trim(),
      role: String(title.Role || '').trim(),
      league: String(title.League || '').trim(),
    };
    addName(map, player, row);
    addName(map, title.ID, row);
  }
  return map;
}

async function loadPros() {
  if (cache.byName.size && Date.now() - cache.at < TTL_MS) return cache.byName;
  try {
    const byName = await cargoPlayers();
    cache.at = Date.now();
    cache.byName = byName;
    return byName;
  } catch {
    return cache.byName;
  }
}

function matchPro(byName, gameName, riotId) {
  if (!byName?.size) return null;
  const names = [gameName, String(riotId || '').split('#')[0]];
  for (const name of names) {
    const hit = byName.get(norm(name)) || byName.get(compact(name));
    if (hit) return hit;
  }
  return null;
}

module.exports = { loadPros, matchPro };
