const { loadPros, matchPro } = require('./spectate-pros');

const QUEUE_NAMES = {
  420: 'Solo/Duo',
  440: 'Flex',
  400: 'Normal',
  430: 'Normal',
  450: 'ARAM',
  480: 'Swiftplay',
  700: 'Clash',
};

const PLATFORM_LABEL = {
  euw1: 'EUW', eun1: 'EUNE', na1: 'NA', br1: 'BR', la1: 'LAN', la2: 'LAS',
  kr: 'KR', jp1: 'JP', oc1: 'OCE', tr1: 'TR', ru: 'RU', me1: 'ME',
  sg2: 'SG', ph2: 'PH', tw2: 'TW', th2: 'TH', vn2: 'VN',
};

const DEFAULT_PLATFORMS = ['euw1', 'kr', 'na1'];
const RANKED_QUEUES = new Set([420, 440, 700]);
const TIER_RANK = { CHALLENGER: 3, GRANDMASTER: 2, MASTER: 1 };

let champMeta = { at: 0, map: {} };

function isNotFound(err) {
  return err?.status === 404 || /(?:Proxy |Riot API )?404\b/i.test(String(err?.message || err || ''));
}

function isRateLimited(err) {
  return err?.status === 429 || /(?:Proxy |Riot API )?429\b/i.test(String(err?.message || err || '')) || /rate limit/i.test(String(err?.message || ''));
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  const n = Math.min(Math.max(1, limit), Math.max(1, items.length));
  await Promise.all(Array.from({ length: items.length ? n : 0 }, worker));
  return results;
}

async function championMap() {
  if (champMeta.map && Date.now() - champMeta.at < 12 * 60 * 60 * 1000) return champMeta.map;
  try {
    const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', {
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.json());
    const ver = versions?.[0];
    const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ver}/data/en_US/champion.json`, {
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.json());
    const map = {};
    Object.values(data.data || {}).forEach((c) => { map[c.key] = c.id; });
    champMeta = { at: Date.now(), map };
    return map;
  } catch {
    return champMeta.map || {};
  }
}

async function getActiveGame(riotFetch, platform, puuid) {
  try {
    return await riotFetch(`https://${platform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

async function getLeague(riotFetch, platform, tier) {
  try {
    return await riotFetch(`https://${platform}.api.riotgames.com/lol/league/v4/${tier}leagues/by-queue/RANKED_SOLO_5x5`);
  } catch (err) {
    if (isNotFound(err)) return { entries: [] };
    throw err;
  }
}

function depthFor(platforms) {
  if (platforms.length > 1) return { challenger: 20, grandmaster: 8 };
  return { challenger: 60, grandmaster: 24 };
}

function leaguePlayers(data, cap, tier) {
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  return entries
    .filter((e) => e?.puuid)
    .sort((a, b) => (b.leaguePoints || 0) - (a.leaguePoints || 0))
    .slice(0, cap)
    .map((e) => ({
      puuid: e.puuid,
      lp: e.leaguePoints || 0,
      tier: String(tier || e.tier || 'CHALLENGER').toUpperCase(),
      rank: e.rank || 'I',
    }));
}

function participantName(p) {
  const gameName = p.riotIdGameName || String(p.riotId || '').split('#')[0] || p.summonerName || '';
  const tagLine = p.riotIdTagline || (String(p.riotId || '').includes('#') ? String(p.riotId).split('#')[1] : '');
  const riotId = (gameName && tagLine) ? `${gameName}#${tagLine}` : (p.riotId || gameName);
  return { gameName, tagLine, riotId };
}

function summarizeRank(players) {
  const known = players.filter((p) => p.tier && TIER_RANK[p.tier]);
  if (!known.length) return { tier: '', lp: null, known: 0, label: '' };
  known.sort((a, b) => (TIER_RANK[b.tier] - TIER_RANK[a.tier]) || (b.lp || 0) - (a.lp || 0));
  const top = known[0];
  const same = known.filter((p) => p.tier === top.tier);
  const lp = same.length >= 2
    ? Math.round(same.reduce((n, p) => n + (p.lp || 0), 0) / same.length)
    : top.lp;
  const approx = same.length >= 2;
  return {
    tier: top.tier,
    lp,
    known: known.length,
    approx,
    label: lp != null
      ? `${titleCase(top.tier)}${approx ? ' ~' : ' '}${lp} LP`
      : titleCase(top.tier),
  };
}

function titleCase(value) {
  return String(value || '').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function publicPlayer(p) {
  return {
    puuid: p.puuid || '',
    teamId: p.teamId,
    championId: p.championId,
    champion: p.champion,
    gameName: p.gameName,
    tagLine: p.tagLine,
    riotId: p.riotId,
    pro: p.pro || null,
    lp: p.lp ?? null,
    tier: p.tier || '',
  };
}

function toGame(raw, platform, champs, ranks, pros, fetchedAt) {
  const players = (raw.participants || []).map((p) => {
    const names = participantName(p);
    const rank = ranks.get(p.puuid) || {};
    return {
      puuid: p.puuid || '',
      teamId: p.teamId,
      championId: p.championId,
      champion: champs[String(p.championId)] || '',
      ...names,
      pro: matchPro(pros, names.gameName, names.riotId),
      lp: rank.lp ?? null,
      tier: rank.tier || '',
    };
  });
  const rank = summarizeRank(players);
  const queueId = raw.gameQueueConfigId || 0;
  return {
    gameId: String(raw.gameId),
    platformId: raw.platformId || String(platform).toUpperCase(),
    platform,
    regionLabel: PLATFORM_LABEL[platform] || String(platform).toUpperCase(),
    queueId,
    queueName: QUEUE_NAMES[queueId] || raw.gameMode || 'Game',
    gameStartTime: raw.gameStartTime || 0,
    fetchedAt,
    encryptionKey: raw.observers?.encryptionKey || '',
    players: players.map(publicPlayer),
    rank,
    proCount: players.filter((p) => p.pro).length,
  };
}

function pickPlatforms(raw) {
  if (!raw) return DEFAULT_PLATFORMS.slice();
  const list = String(raw)
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter((p) => PLATFORM_LABEL[p]);
  return list.length ? [...new Set(list)] : DEFAULT_PLATFORMS.slice();
}

function createScanner({ riotFetch }) {
  const cache = new Map();
  const keys = new Map();
  let scanning = false;
  let lastError = '';

  function remember(games) {
    for (const game of games) {
      if (game.encryptionKey) {
        keys.set(`${game.platformId}:${game.gameId}`, {
          encryptionKey: game.encryptionKey,
          platformId: game.platformId,
          gameId: game.gameId,
          queueId: game.queueId,
          rawPlatform: game.platform,
        });
      }
    }
  }

  function strip(games) {
    return games.map((g) => {
      const { encryptionKey, ...rest } = g;
      return rest;
    });
  }

  async function scanPlatform(platform, depth, champs, pros, ranks) {
    const fetchedAt = Date.now();
    const [challenger, grandmaster] = await Promise.all([
      getLeague(riotFetch, platform, 'challenger'),
      getLeague(riotFetch, platform, 'grandmaster'),
    ]);
    const pool = [
      ...leaguePlayers(challenger, depth.challenger, 'CHALLENGER'),
      ...leaguePlayers(grandmaster, depth.grandmaster, 'GRANDMASTER'),
    ];
    const seenPuuid = new Set();
    const unique = pool.filter((p) => {
      if (seenPuuid.has(p.puuid)) return false;
      seenPuuid.add(p.puuid);
      ranks.set(p.puuid, p);
      return true;
    });

    const found = new Map();
    const inGame = new Set();
    let limited = false;
    await mapWithConcurrency(unique, 3, async (player) => {
      if (limited || inGame.has(player.puuid)) return;
      try {
        const raw = await getActiveGame(riotFetch, platform, player.puuid);
        if (!raw?.gameId) return;
        const id = String(raw.gameId);
        if (found.has(id)) return;
        if (!RANKED_QUEUES.has(Number(raw.gameQueueConfigId))) return;
        const game = toGame(raw, platform, champs, ranks, pros, fetchedAt);
        found.set(id, game);
        game.players.forEach((p) => { if (p.puuid) inGame.add(p.puuid); });
      } catch (err) {
        if (isNotFound(err)) return;
        if (isRateLimited(err) || /\b(401|403)\b/.test(String(err.message || ''))) {
          limited = true;
          lastError = isRateLimited(err)
            ? 'Rate limit hit while scanning live games.'
            : 'Riot blocked the live-game scan.';
          return;
        }
      }
    });
    return { games: [...found.values()], limited };
  }

  async function refresh(platforms) {
    const list = pickPlatforms(platforms.join ? platforms.join(',') : platforms);
    const key = list.slice().sort().join(',');
    if (scanning) return cache.get(key) || emptySnap(list, true);
    scanning = true;
    lastError = '';
    try {
      const depth = depthFor(list);
      const [champs, pros] = await Promise.all([championMap(), loadPros()]);
      const ranks = new Map();
      const games = [];
      let limited = false;
      for (const platform of list) {
        const part = await scanPlatform(platform, depth, champs, pros, ranks);
        games.push(...part.games);
        if (part.limited) {
          limited = true;
          break;
        }
      }
      remember(games);
      const snap = {
        ok: true,
        games: strip(games),
        updatedAt: Date.now(),
        platforms: list,
        scanning: false,
        limited,
        source: 'riot-ladder',
        note: limited ? lastError : '',
        trackedPros: pros.size || 0,
      };
      cache.set(key, snap);
      return snap;
    } catch (err) {
      lastError = err.message || 'Could not scan live games.';
      const prev = cache.get(key);
      if (prev?.games?.length) {
        return { ...prev, scanning: false, note: lastError };
      }
      return {
        ok: false,
        games: [],
        updatedAt: Date.now(),
        platforms: list,
        scanning: false,
        error: lastError,
        source: 'riot-ladder',
      };
    } finally {
      scanning = false;
    }
  }

  function emptySnap(platforms, busy) {
    return {
      ok: true,
      games: [],
      updatedAt: 0,
      platforms,
      scanning: busy || scanning,
      source: 'riot-ladder',
      trackedPros: 0,
    };
  }

  function snapshot(platforms, opts = {}) {
    const list = pickPlatforms(Array.isArray(platforms) ? platforms.join(',') : platforms);
    const key = list.slice().sort().join(',');
    const hit = cache.get(key);
    const base = hit ? { ...hit, scanning: scanning || hit.scanning } : emptySnap(list, scanning);
    if (!opts.keys) return base;
    return {
      ...base,
      games: (base.games || []).map((g) => {
        const launch = getLaunch(g.platformId, g.gameId);
        return launch?.encryptionKey ? { ...g, encryptionKey: launch.encryptionKey } : g;
      }),
    };
  }

  function getLaunch(platformId, gameId) {
    return keys.get(`${String(platformId || '').toUpperCase()}:${String(gameId)}`) || null;
  }

  function storeLaunch(game) {
    if (!game?.encryptionKey || !game.gameId) return;
    keys.set(`${String(game.platformId).toUpperCase()}:${String(game.gameId)}`, {
      encryptionKey: game.encryptionKey,
      platformId: game.platformId,
      gameId: String(game.gameId),
      queueId: game.queueId,
      rawPlatform: game.platform,
    });
  }

  async function start(intervalMs = 120000) {
    refresh(DEFAULT_PLATFORMS).catch(() => {});
    setInterval(() => {
      refresh(DEFAULT_PLATFORMS).catch(() => {});
    }, intervalMs);
  }

  function ingest(payload) {
    if (!payload?.games) return;
    for (const game of payload.games) storeLaunch(game);
    const list = payload.platforms || DEFAULT_PLATFORMS;
    const key = list.slice().sort().join(',');
    cache.set(key, {
      ...payload,
      games: strip(payload.games),
      scanning: false,
    });
  }

  return {
    refresh,
    snapshot,
    getLaunch,
    storeLaunch,
    ingest,
    start,
    DEFAULT_PLATFORMS,
    pickPlatforms,
  };
}

module.exports = { createScanner, pickPlatforms: (raw) => pickPlatforms(raw), DEFAULT_PLATFORMS, PLATFORM_LABEL };
