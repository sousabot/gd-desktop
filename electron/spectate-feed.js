const { loadPros, matchPro, tagGames } = require('./spectate-pros');

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

async function getFeatured(riotFetch, platform) {
  try {
    const data = await riotFetch(`https://${platform}.api.riotgames.com/lol/spectator/v5/featured-games`);
    return Array.isArray(data?.gameList) ? data.gameList : [];
  } catch {
    return [];
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
  if (platforms.length > 1) return { challenger: 80, grandmaster: 40 };
  return { challenger: 200, grandmaster: 80 };
}

function probeBudget(platformCount) {
  return platformCount > 1 ? 72 : 120;
}

function interleave(queues) {
  const out = [];
  let i = 0;
  let more = true;
  while (more) {
    more = false;
    for (const queue of queues) {
      if (i < queue.length) {
        out.push(queue[i]);
        more = true;
      }
    }
    i += 1;
  }
  return out;
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
  const inflight = new Set();
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
          gameStartTime: game.gameStartTime || 0,
          puuid: game.players?.find((p) => p.puuid)?.puuid || '',
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

  function gameKey(game) {
    return `${String(game.platformId || '').toUpperCase()}:${String(game.gameId)}`;
  }

  function writeCache(list, games, extra = {}) {
    remember(games);
    const key = list.slice().sort().join(',');
    const snap = {
      ok: true,
      games: strip(games),
      updatedAt: Date.now(),
      platforms: list,
      source: 'riot-ladder',
      note: extra.limited ? lastError : '',
      trackedPros: extra.trackedPros || 0,
      ...extra,
    };
    cache.set(key, snap);
    if (list.length > 1) {
      list.forEach((platform) => {
        cache.set(platform, {
          ...snap,
          platforms: [platform],
          games: snap.games.filter((g) => g.platform === platform),
        });
      });
    }
    return snap;
  }

  async function refresh(platforms) {
    const list = pickPlatforms(platforms.join ? platforms.join(',') : platforms);
    const key = list.slice().sort().join(',');
    if (inflight.has(key)) return cache.get(key) || emptySnap(list, true);
    inflight.add(key);
    lastError = '';
    const prevGames = cache.get(key)?.games || [];
    if (prevGames.length) writeCache(list, prevGames, { scanning: true, limited: false });
    try {
      const depth = depthFor(list);
      const [champs, pros] = await Promise.all([championMap(), loadPros()]);
      const ranks = new Map();
      const found = new Map();
      const inGame = new Set();
      let limited = false;

      const addGame = (game) => {
        if (!game?.gameId) return;
        const id = gameKey(game);
        if (found.has(id)) return;
        found.set(id, game);
        (game.players || []).forEach((p) => { if (p.puuid) inGame.add(p.puuid); });
        writeCache(list, [...found.values()], {
          scanning: true,
          limited,
          trackedPros: pros.size || 0,
        });
      };

      const ladders = await mapWithConcurrency(list, list.length, async (platform) => {
        try {
          const [challenger, grandmaster] = await Promise.all([
            getLeague(riotFetch, platform, 'challenger'),
            getLeague(riotFetch, platform, 'grandmaster'),
          ]);
          return { platform, challenger, grandmaster };
        } catch (err) {
          if (isRateLimited(err)) {
            limited = true;
            lastError = 'Rate limit hit while scanning live games.';
          }
          return { platform, challenger: { entries: [] }, grandmaster: { entries: [] } };
        }
      });

      const queues = ladders.map((row) => {
        const pool = [
          ...leaguePlayers(row.challenger, depth.challenger, 'CHALLENGER'),
          ...leaguePlayers(row.grandmaster, depth.grandmaster, 'GRANDMASTER'),
        ];
        const unique = [];
        pool.forEach((player) => {
          if (ranks.has(player.puuid)) return;
          ranks.set(player.puuid, player);
          unique.push({ ...player, platform: row.platform });
        });
        return unique;
      });

      const featured = await mapWithConcurrency(list, list.length, async (platform) => ({
        platform,
        games: await getFeatured(riotFetch, platform),
      }));
      const fetchedAt = Date.now();
      featured.forEach((row) => {
        row.games.forEach((raw) => {
          if (!RANKED_QUEUES.has(Number(raw.gameQueueConfigId))) return;
          const onLadder = (raw.participants || []).some((p) => p.puuid && ranks.has(p.puuid));
          if (!onLadder) return;
          addGame(toGame(raw, row.platform, champs, ranks, pros, fetchedAt));
        });
      });

      const toProbe = interleave(queues)
        .filter((player) => !inGame.has(player.puuid))
        .slice(0, probeBudget(list.length));

      await mapWithConcurrency(toProbe, 6, async (player) => {
        if (limited || inGame.has(player.puuid)) return;
        try {
          const raw = await getActiveGame(riotFetch, player.platform, player.puuid);
          if (!raw?.gameId) return;
          if (!RANKED_QUEUES.has(Number(raw.gameQueueConfigId))) return;
          addGame(toGame(raw, player.platform, champs, ranks, pros, Date.now()));
        } catch (err) {
          if (isNotFound(err)) return;
          if (isRateLimited(err) || /\b(401|403)\b/.test(String(err.message || ''))) {
            limited = true;
            lastError = isRateLimited(err)
              ? 'Rate limit hit while scanning live games.'
              : 'Riot blocked the live-game scan.';
          }
        }
      });

      if (limited) {
        prevGames.forEach((game) => {
          const id = gameKey(game);
          if (!found.has(id)) found.set(id, game);
        });
      }

      const tagged = await tagGames([...found.values()]);
      return writeCache(list, tagged, {
        scanning: false,
        limited,
        trackedPros: pros.size || 0,
      });
    } catch (err) {
      lastError = err.message || 'Could not scan live games.';
      const prev = cache.get(key);
      if (prev?.games?.length) {
        return writeCache(list, prev.games, { scanning: false, limited: true, trackedPros: prev.trackedPros || 0 });
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
      inflight.delete(key);
    }
  }

  function emptySnap(platforms, busy) {
    return {
      ok: true,
      games: [],
      updatedAt: 0,
      platforms,
      scanning: !!busy || inflight.has(platforms.slice().sort().join(',')),
      source: 'riot-ladder',
      trackedPros: 0,
    };
  }

  function snapshot(platforms, opts = {}) {
    const list = pickPlatforms(Array.isArray(platforms) ? platforms.join(',') : platforms);
    const key = list.slice().sort().join(',');
    let hit = cache.get(key);
    if (!hit && list.length === 1) {
      for (const [cacheKey, snap] of cache) {
        if (!cacheKey.includes(list[0]) || !snap?.games) continue;
        hit = {
          ...snap,
          platforms: list,
          games: snap.games.filter((g) => g.platform === list[0]),
        };
        break;
      }
    }
    const base = hit
      ? { ...hit, scanning: inflight.has(key) || hit.scanning }
      : emptySnap(list, inflight.has(key));
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
      gameStartTime: game.gameStartTime || 0,
      puuid: game.players?.find((p) => p.puuid)?.puuid || game.puuid || '',
    });
  }

  async function start(intervalMs = 180000) {
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
      scanning: !!payload.scanning,
    });
  }

  async function decorate(payload) {
    if (!payload?.games?.length) return payload;
    return {
      ...payload,
      games: await tagGames(payload.games),
    };
  }

  return {
    refresh,
    snapshot,
    getLaunch,
    storeLaunch,
    ingest,
    decorate,
    start,
    DEFAULT_PLATFORMS,
    pickPlatforms,
  };
}

module.exports = { createScanner, pickPlatforms: (raw) => pickPlatforms(raw), DEFAULT_PLATFORMS, PLATFORM_LABEL };
