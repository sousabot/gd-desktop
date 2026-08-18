const cache = {
  at: 0,
  byName: new Map(),
  byPlayer: new Map(),
  checked: new Set(),
};
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

function esc(value) {
  return String(value || '').replace(/"/g, '').trim();
}

function addName(map, name, row) {
  const key = norm(name);
  const tight = compact(name);
  if (key) map.set(key, row);
  if (tight && tight !== key) map.set(tight, row);
}

function wikiFileUrl(image) {
  const file = String(image || '').replace(/^File:/i, '').trim();
  if (!file) return '';
  return `https://lol.fandom.com/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=64`;
}

async function cargoJson(params) {
  const search = new URLSearchParams({
    action: 'cargoquery',
    format: 'json',
    origin: '*',
    ...params,
  });
  const res = await fetch(`https://lol.fandom.com/api.php?${search.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RiftDesktop/0.1.11 (Leaguepedia cargo; spectate roster)',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Leaguepedia ${res.status}`);
  const payload = await res.json();
  if (payload?.error) throw new Error(payload.error.info || 'Leaguepedia error');
  return Array.isArray(payload?.cargoquery) ? payload.cargoquery : [];
}

async function wikiApi(params) {
  const search = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const res = await fetch(`https://lol.fandom.com/api.php?${search.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RiftDesktop/0.1.11 (Leaguepedia cargo; spectate roster)',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Leaguepedia ${res.status}`);
  return res.json();
}

function rowFromPlayerTitle(title, teams) {
  const player = String(title.Player || '').trim();
  if (!player) return null;
  const team = String(title.Team || '').trim();
  const org = teams.get(norm(team)) || teams.get(compact(team)) || null;
  return {
    player,
    team,
    short: org?.short || team,
    logo: org?.logo || '',
    role: String(title.Role || '').trim(),
    league: String(title.League || '').trim(),
  };
}

function rememberPlayer(row) {
  if (!row?.player) return;
  cache.byPlayer.set(norm(row.player), row);
  addName(cache.byName, row.player, row);
}

async function cargoAll(params, max = 2000) {
  const rows = [];
  for (let offset = 0; offset < max; offset += 500) {
    const batch = await cargoJson({
      ...params,
      limit: '500',
      offset: String(offset),
    });
    rows.push(...batch);
    if (batch.length < 500) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return rows;
}

async function cargoTeams() {
  const rows = await cargoAll({
    tables: 'Teams',
    fields: 'Name,Short,Image',
    where: 'Image IS NOT NULL',
  }, 1000);
  const map = new Map();
  for (const entry of rows) {
    const title = entry?.title || {};
    const name = String(title.Name || '').trim();
    if (!name) continue;
    const row = {
      name,
      short: String(title.Short || '').trim() || name,
      logo: wikiFileUrl(title.Image),
    };
    addName(map, name, row);
    addName(map, row.short, row);
  }
  return map;
}

async function cargoPlayers() {
  const [playerRows, teams] = await Promise.all([
    cargoAll({
      tables: 'Players',
      fields: 'Player,Team,Role,League,ID',
      where: 'IsRetired=0 AND Team IS NOT NULL',
    }, 2000),
    cargoTeams().catch(() => new Map()),
  ]);
  cache.byName = new Map();
  cache.byPlayer = new Map();
  cache.teams = teams;
  cache.checked = new Set();
  for (const entry of playerRows) {
    const row = rowFromPlayerTitle(entry?.title || {}, teams);
    if (!row) continue;
    rememberPlayer(row);
    addName(cache.byName, entry.title.ID, row);
  }
  return cache.byName;
}

async function loadPros() {
  if (cache.byName.size && Date.now() - cache.at < TTL_MS) return cache.byName;
  try {
    await cargoPlayers();
    cache.at = Date.now();
    return cache.byName;
  } catch {
    return cache.byName;
  }
}

function alreadyKnown(name) {
  return !!(cache.byName.get(norm(name)) || cache.byName.get(compact(name)));
}

async function lookupRedirects(names) {
  const where = names.map((name) => `AllName="${esc(name)}"`).join(' OR ');
  const rows = await cargoJson({
    tables: 'PlayerRedirects',
    fields: 'AllName,OverviewPage',
    where,
    limit: '100',
  });
  for (const entry of rows) {
    const title = entry?.title || {};
    const alias = String(title.AllName || '').trim();
    const page = String(title.OverviewPage || title._pageName || title.Page || '').trim();
    const row = cache.byPlayer.get(norm(page)) || cache.byPlayer.get(compact(page));
    if (row && alias) addName(cache.byName, alias, row);
  }
}

async function lookupCurrentIds(names) {
  const where = names.map((name) => `ID="${esc(name)}"`).join(' OR ');
  const rows = await cargoJson({
    tables: 'Players',
    fields: 'Player,Team,Role,League,ID',
    where: `(${where}) AND IsRetired=0 AND Team IS NOT NULL`,
    limit: '50',
  });
  for (const entry of rows) {
    const row = rowFromPlayerTitle(entry?.title || {}, cache.teams || new Map());
    if (!row) continue;
    rememberPlayer(row);
    addName(cache.byName, entry.title.ID, row);
  }
}

async function lookupSearch(name) {
  const payload = await wikiApi({
    action: 'query',
    list: 'search',
    srsearch: name,
    srlimit: '5',
  });
  const hits = Array.isArray(payload?.query?.search) ? payload.query.search : [];
  const needle = compact(name);
  for (const hit of hits) {
    const title = String(hit.title || '').trim();
    const blob = compact(`${hit.title} ${String(hit.snippet || '').replace(/<[^>]+>/g, '')}`);
    if (!blob.includes(needle)) continue;
    const row = cache.byPlayer.get(norm(title)) || cache.byPlayer.get(compact(title));
    if (row) {
      addName(cache.byName, name, row);
      return;
    }
  }
}

async function resolveMissingNames(names) {
  await loadPros();
  const unique = [...new Set(names.map((name) => String(name || '').trim()).filter(Boolean))];
  const missing = unique.filter((name) => !alreadyKnown(name) && !cache.checked.has(norm(name)));
  if (!missing.length) return cache.byName;

  for (let i = 0; i < missing.length; i += 20) {
    const chunk = missing.slice(i, i + 20);
    try { await lookupRedirects(chunk); } catch { /* keep going */ }
    const still = chunk.filter((name) => !alreadyKnown(name));
    if (still.length) {
      try { await lookupCurrentIds(still); } catch { /* keep going */ }
    }
    const leftover = chunk.filter((name) => !alreadyKnown(name)).slice(0, 8);
    for (const name of leftover) {
      try { await lookupSearch(name); } catch { /* keep going */ }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    chunk.forEach((name) => cache.checked.add(norm(name)));
  }
  return cache.byName;
}

function matchPro(byName, gameName, riotId) {
  const map = byName || cache.byName;
  if (!map?.size) return null;
  const names = [gameName, String(riotId || '').split('#')[0], riotId];
  for (const name of names) {
    const hit = map.get(norm(name)) || map.get(compact(name));
    if (hit) return hit;
  }
  return null;
}

function applyPros(games, byName) {
  return (games || []).map((game) => {
    const players = (game.players || []).map((player) => {
      const hit = matchPro(byName, player.gameName, player.riotId);
      if (!hit) return player;
      return { ...player, pro: { ...(player.pro || {}), ...hit } };
    });
    return {
      ...game,
      players,
      proCount: players.filter((player) => player.pro).length,
    };
  });
}

async function tagGames(games) {
  if (!games?.length) return games || [];
  const names = [];
  games.forEach((game) => {
    (game.players || []).forEach((player) => {
      if (player.gameName) names.push(player.gameName);
      if (player.riotId) names.push(String(player.riotId).split('#')[0]);
    });
  });
  const byName = await resolveMissingNames(names);
  return applyPros(games, byName);
}

module.exports = { loadPros, matchPro, resolveMissingNames, tagGames };
