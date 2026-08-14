// Runs in the Electron MAIN process (plain Node — no CORS restriction).
// Requires RIOT_API_KEY in .env (copy .env.example -> .env and fill it in).
// Dev keys from https://developer.riotgames.com expire every 24h.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const idCache = require('./id-cache');
const matchCache = require('./match-cache');

function envCandidates() {
  const names = ['gd.env', '.env'];
  const dirs = [];
  const addDir = (dir) => { if (dir) dirs.push(dir); };

  addDir(process.resourcesPath);
  addDir(process.execPath && path.dirname(process.execPath));
  addDir(process.env.PORTABLE_EXECUTABLE_DIR);
  addDir(path.join(__dirname, '..'));
  addDir(path.join(__dirname, '..', '..'));
  addDir(process.cwd());
  try { addDir(app.getPath('userData')); } catch { /* before ready */ }

  const files = [];
  dirs.forEach((dir) => names.forEach((name) => files.push(path.join(dir, name))));
  return files;
}

function applyEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq < 1) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key === 'RIOT_API_KEY' || key === 'DISCORD_WEBHOOK_URL' || !process.env[key]) {
      process.env[key] = value;
    }
  });
}

function loadEnv() {
  const found = envCandidates().find((p) => fs.existsSync(p));
  if (found) {
    applyEnvFile(found);
    console.log(`[riot-ipc] Loaded env from ${found}`);
  } else {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    console.warn('[riot-ipc] No gd.env/.env found next to the app.');
  }
  if (process.env.RIOT_API_KEY) {
    process.env.RIOT_API_KEY = process.env.RIOT_API_KEY.trim();
  }
}

loadEnv();

async function riotFetch(url, attempt = 0) {
  if (!process.env.RIOT_API_KEY) loadEnv();
  const key = String(process.env.RIOT_API_KEY || '').trim();
  if (!key) throw new Error('RIOT_API_KEY is not set in .env');

  const res = await fetch(url, { headers: { 'X-Riot-Token': key } });

  if (res.status === 429 && attempt < 2) {
    const retryAfterSec = Number(res.headers.get('retry-after')) || 1;
    // A short Retry-After means we tripped the ~20/sec burst limit — worth
    // waiting out. A long one means the ~100-per-2-minutes budget is blown;
    // don't freeze the UI for up to 2 minutes, fail fast instead so the
    // existing per-feature fallbacks (mock data, masked names, etc.) kick in.
    if (retryAfterSec <= 5) {
      await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
      return riotFetch(url, attempt + 1);
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Riot API ${res.status} ${res.statusText} — ${url}\n${body}`);
  }
  return res.json();
}

// Fetches items in parallel, capped at `limit` in flight at once — fast, but
// stays comfortably under Riot's per-second rate limit instead of firing all
// 10+ requests at the exact same instant.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const BULK_CONCURRENCY = 5;

// account-v1 is global and only accepts europe / americas / asia (not sea).
function accountHost(region) {
  const value = String(region || 'europe').toLowerCase();
  if (value === 'americas' || value === 'na' || value === 'na1' || value === 'br1' || value === 'la1' || value === 'la2') {
    return 'americas';
  }
  if (value === 'asia' || value === 'sea' || value === 'kr' || value === 'jp1' || value === 'oc1') {
    return 'asia';
  }
  return 'europe';
}

const PLATFORM_TO_MATCH_REGION = {
  euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe', me1: 'europe',
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas',
  kr: 'asia', jp1: 'asia',
  oc1: 'sea', sg2: 'sea', ph2: 'sea', tw2: 'sea', th2: 'sea', vn2: 'sea',
};

const ALL_PLATFORMS = Object.keys(PLATFORM_TO_MATCH_REGION);

function apiStatus(err) {
  const match = String(err?.message || '').match(/Riot API (\d+)/);
  return match ? Number(match[1]) : 0;
}

// Reads a cache module once, fetches only ids that are missing or stale, then
// writes the merged result back once. `ttlMs: Infinity` (the default) means
// entries never go stale — correct for match/timeline data, which can't
// change once a game is over. The puuid cache passes its own shorter TTL.
async function cachedBulkFetch(cacheModule, prefix, ids, fetchOne, ttlMs = Infinity) {
  const cache = cacheModule.readCache();
  const now = Date.now();
  const results = new Array(ids.length).fill(null);
  const missing = [];

  ids.forEach((id, i) => {
    const entry = cache[`${prefix}:${id}`];
    const fresh = entry && (ttlMs === Infinity || now - entry.timestamp < ttlMs);
    if (fresh) {
      results[i] = entry.data;
    } else {
      missing.push(i);
    }
  });

  if (missing.length) {
    const fetched = await mapWithConcurrency(missing, BULK_CONCURRENCY, (i) => fetchOne(ids[i]));
    missing.forEach((origIdx, j) => {
      results[origIdx] = fetched[j];
      if (fetched[j]) cache[`${prefix}:${ids[origIdx]}`] = { timestamp: now, data: fetched[j] };
    });
    cacheModule.writeCache(cache);
  }

  return results;
}

module.exports = function registerRiotHandlers(ipcMain) {
  const key = process.env.RIOT_API_KEY;
  if (!key) {
    console.warn('[riot-ipc] RIOT_API_KEY is not set — live Riot data will fail until you add it to .env.');
  } else {
    console.log(`[riot-ipc] API key loaded (${key.slice(0, 8)}…)`);
  }

  // Riot ID rarely changes — cache the single-lookup version too, since
  // re-searching the same player repeatedly (e.g. during dev testing) was
  // re-fetching this every time for no reason.
  async function fetchAccountByRiotId(gameName, tagLine, region) {
    const host = accountHost(region);
    const name = String(gameName || '').trim();
    const tag = String(tagLine || '').trim().replace(/^#/, '');
    if (!name || !tag) throw new Error('Riot API 400 Bad Request — missing Riot ID');

    const cacheKey = `riotid:${host}:${name.toLowerCase()}#${tag.toLowerCase()}`;
    const cache = idCache.readCache();
    const entry = cache[cacheKey];
    if (entry && Date.now() - entry.timestamp < idCache.TTL_MS) return entry.data;

    const data = await riotFetch(
      `https://${host}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
    );
    cache[cacheKey] = { timestamp: Date.now(), data };
    idCache.writeCache(cache);
    return data;
  }

  ipcMain.handle('riot:getAccountByRiotId', (_e, { gameName, tagLine, region }) =>
    fetchAccountByRiotId(gameName, tagLine, region)
  );

  async function findLeagueShard(puuid, preferredPlatform, accountRegion) {
    const cacheKey = `shard:${puuid}`;
    const cache = idCache.readCache();
    const cached = cache[cacheKey];
    if (cached && Date.now() - cached.timestamp < idCache.TTL_MS) return cached.data;

    const preferred = String(preferredPlatform || '').toLowerCase();
    let shard = '';
    try {
      const active = await riotFetch(
        `https://${accountRegion}.api.riotgames.com/riot/account/v1/active-shards/by-game/lol/by-puuid/${puuid}`
      );
      if (active?.activeShard) shard = String(active.activeShard).toLowerCase();
    } catch (err) {
      const status = apiStatus(err);
      if (status === 401 || status === 403 || status === 429) throw err;
    }

    if (!shard) {
      const ordered = [
        preferred,
        ...ALL_PLATFORMS.filter((p) => p !== preferred && PLATFORM_TO_MATCH_REGION[p] === PLATFORM_TO_MATCH_REGION[preferred]),
        ...ALL_PLATFORMS.filter((p) => p !== preferred && PLATFORM_TO_MATCH_REGION[p] !== PLATFORM_TO_MATCH_REGION[preferred]),
      ].filter(Boolean);

      let lastErr;
      for (const platform of ordered) {
        try {
          await riotFetch(`https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`);
          shard = platform;
          break;
        } catch (err) {
          lastErr = err;
          const status = apiStatus(err);
          if (status === 401 || status === 403 || status === 429) throw err;
        }
      }
      if (!shard) throw lastErr || new Error('Riot API 404 Not Found — no League summoner for that Riot ID');
    }

    cache[cacheKey] = { timestamp: Date.now(), data: shard };
    idCache.writeCache(cache);
    return shard;
  }

  function shardInfo(shard, fallbackRegion) {
    return {
      platform: shard,
      region: PLATFORM_TO_MATCH_REGION[shard] || accountHost(fallbackRegion),
    };
  }

  ipcMain.handle('riot:getLeagueShard', async (_e, { puuid, region, platform }) => {
    const shard = await findLeagueShard(puuid, platform, accountHost(region));
    return shardInfo(shard, region);
  });

  ipcMain.handle('riot:linkAccount', async (_e, { gameName, tagLine, region, platform }) => {
    const account = await fetchAccountByRiotId(gameName, tagLine, region);
    const accountRegion = accountHost(region);
    const shard = await findLeagueShard(account.puuid, platform, accountRegion);
    return {
      gameName: account.gameName,
      tagLine: account.tagLine,
      puuid: account.puuid,
      ...shardInfo(shard, region),
    };
  });

  // Not cached: profileIconId here can lag a day behind if changed, which is an
  // acceptable trade-off — same reasoning as the bulk summoner lookup.
  ipcMain.handle('riot:getSummonerByPuuid', async (_e, { puuid, platform }) => {
    const key = `summonerSingle:${puuid}`;
    const cache = idCache.readCache();
    const entry = cache[key];
    if (entry && Date.now() - entry.timestamp < idCache.TTL_MS) return entry.data;

    const data = await riotFetch(`https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`);
    cache[key] = { timestamp: Date.now(), data };
    idCache.writeCache(cache);
    return data;
  });

  ipcMain.handle('riot:getRankedEntries', (_e, { summonerId, platform }) =>
    riotFetch(`https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`)
  );

  // Dev-key friendly: ranked by PUUID directly
  ipcMain.handle('riot:getRankedByPuuid', (_e, { puuid, platform }) =>
    riotFetch(`https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`)
  );

  ipcMain.handle('riot:getRankedByPuuidsBulk', (_e, { puuids, platform }) =>
    cachedBulkFetch(idCache, 'ranked', puuids, (puuid) =>
      riotFetch(`https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`).catch(() => []),
      5 * 60 * 1000
    )
  );

  ipcMain.handle('riot:getMatchIds', (_e, { puuid, region, count = 10, queue }) => {
    const queueParam = queue ? `&queue=${queue}` : '';
    return riotFetch(`https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}${queueParam}`);
  });

  ipcMain.handle('riot:getMatchesBulk', (_e, { matchIds, region }) =>
    cachedBulkFetch(matchCache, 'match', matchIds, (id) =>
      riotFetch(`https://${region}.api.riotgames.com/lol/match/v5/matches/${id}`).catch(() => null)
    )
  );

  // Needed for Gold Diff @15 / K+A Diff @15 — match-v5 alone has no @15min snapshot.
  ipcMain.handle('riot:getTimelinesBulk', (_e, { matchIds, region }) =>
    cachedBulkFetch(matchCache, 'timeline', matchIds, (id) =>
      riotFetch(`https://${region}.api.riotgames.com/lol/match/v5/matches/${id}/timeline`).catch(() => null)
    )
  );

  ipcMain.handle('riot:getActiveGame', (_e, { puuid, platform }) =>
    riotFetch(`https://${platform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`)
  );

  ipcMain.handle('riot:getTopLeague', (_e, { tier, queue = 'RANKED_SOLO_5x5', platform }) =>
    riotFetch(`https://${platform}.api.riotgames.com/lol/league/v4/${tier}leagues/by-queue/${queue}`)
  );

  // league-v4 entries no longer carry a usable summonerName — resolve real
  // Riot IDs (gameName#tagLine) from puuid via account-v1 instead. Cached on
  // disk since these rarely change and resolving 20-50 of them per load adds
  // up fast against Riot's rate limit.
  ipcMain.handle('riot:getAccountsByPuuidsBulk', (_e, { puuids, region }) =>
    cachedBulkFetch(idCache, 'account', puuids, (puuid) =>
      riotFetch(`https://${region}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}`).catch(() => null),
      idCache.TTL_MS
    )
  );

  // Profile icons live on summoner-v4, not account-v1 — a separate cached bulk lookup.
  ipcMain.handle('riot:getSummonersByPuuidsBulk', (_e, { puuids, platform }) =>
    cachedBulkFetch(idCache, 'summoner', puuids, (puuid) =>
      riotFetch(`https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`).catch(() => null),
      idCache.TTL_MS
    )
  );

  // Top-4 champions by mastery points, used as each leaderboard player's
  // "champion pool". Mastery points barely move day to day, so this is safe
  // to cache alongside the other puuid-keyed lookups.
  ipcMain.handle('riot:getChampionMasteryBulk', (_e, { puuids, platform }) =>
    cachedBulkFetch(idCache, 'mastery', puuids, (puuid) =>
      riotFetch(`https://${platform}.api.riotgames.com/lol/champion-mastery/v4/by-puuid/${puuid}/top?count=4`).catch(() => []),
      idCache.TTL_MS
    )
  );

  // Full mastery list for the linked summoner — used for "champions played"
  // vs the live champion roster count from Data Dragon.
  ipcMain.handle('riot:getChampionMasteries', (_e, { puuid, platform }) =>
    cachedBulkFetch(idCache, 'masteryAll', [puuid], (id) =>
      riotFetch(`https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${id}`).catch(() => []),
      idCache.TTL_MS
    ).then((rows) => rows[0] || [])
  );

  // One most-recent ranked-solo match id per player — used purely to read
  // `teamPosition` off it for a "what lane do they play" signal on the
  // leaderboard. Short TTL (not the 24h puuid TTL): a "last match" changes as
  // soon as someone finishes a new game, but caching it for a few minutes
  // means repeat leaderboard visits don't re-spend rate-limit budget re-
  // fetching this on top of accounts/summoners/mastery every single time.
  const LAST_MATCH_TTL_MS = 10 * 60 * 1000;
  ipcMain.handle('riot:getLastMatchIdsBulk', (_e, { puuids, region, queue = 420, count = 20 }) =>
    cachedBulkFetch(idCache, `matchids${count}`, puuids, async (puuid) => {
      try {
        return await riotFetch(`https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}&queue=${queue}`);
      } catch {
        return [];
      }
    }, LAST_MATCH_TTL_MS)
  );

  require('./feedback-ipc')(ipcMain);
};