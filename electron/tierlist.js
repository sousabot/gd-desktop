const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const TTL_MS = 6 * 60 * 60 * 1000;
const SAMPLE_PLAYERS = 36;
const MATCHES_PER = 8;
const WAVE_MATCHES = 48;
const POOL_CAP = 160;
const WAVE_MS = 35000;
const TOTAL_MS = 120000;
const LIMIT_COOLDOWN_MS = 90 * 1000;
const PRIOR_GAMES = 12;
const ROLE_LABEL = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'ADC',
  UTILITY: 'Support',
};

const BANDS = {
  challenger: [{ kind: 'league', tier: 'challenger' }],
  grandmaster: [{ kind: 'league', tier: 'grandmaster' }],
  master: [{ kind: 'league', tier: 'master' }],
  master_plus: [{ kind: 'league', tier: 'challenger' }, { kind: 'league', tier: 'grandmaster' }],
  diamond_plus: [{ kind: 'league', tier: 'challenger' }, { kind: 'league', tier: 'grandmaster' }],
  diamond: [{ kind: 'exp', tier: 'DIAMOND', division: 'I' }],
  emerald_plus: [{ kind: 'exp', tier: 'EMERALD', division: 'I' }],
  platinum_plus: [{ kind: 'exp', tier: 'PLATINUM', division: 'I' }],
  gold_plus: [{ kind: 'exp', tier: 'GOLD', division: 'I' }],
};

const inflight = new Map();
let limitedUntil = 0;

function cachePath() {
  return path.join(app.getPath('userData'), 'tierlist-cache.json');
}

function storePath() {
  return path.join(app.getPath('userData'), 'tierlist-games.json');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data));
}

function readAll() {
  return readJson(cachePath(), {});
}

function writeAll(data) {
  writeJson(cachePath(), data);
}

function readStore() {
  return readJson(storePath(), {});
}

function writeStore(data) {
  writeJson(storePath(), data);
}

function cacheKey(platform, rank) {
  return `${platform}:${rank}`;
}

function patchOf(version) {
  const parts = String(version || '').split('.');
  if (parts.length < 2) return '';
  return `${parts[0]}.${parts[1]}`;
}

async function currentPatch() {
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', {
      signal: AbortSignal.timeout(8000),
    });
    const versions = await res.json();
    return patchOf(versions[0]);
  } catch {
    return '';
  }
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function samplePlayers(entries, n) {
  const pool = (entries || []).filter((e) => e?.puuid);
  if (pool.length <= n) return pool;
  const sorted = [...pool].sort((a, b) => (b.leaguePoints || 0) - (a.leaguePoints || 0));
  const chosen = [];
  const seen = new Set();
  const wantTop = Math.min(8, n);
  for (const e of shuffle(sorted.slice(0, 30))) {
    if (chosen.length >= wantTop) break;
    seen.add(e.puuid);
    chosen.push(e);
  }
  for (const e of shuffle(sorted)) {
    if (chosen.length >= n) break;
    if (seen.has(e.puuid)) continue;
    seen.add(e.puuid);
    chosen.push(e);
  }
  return chosen;
}

function sendAll(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try { win.webContents.send(channel, payload); } catch { /* ignore */ }
  }
}

function emitProgress(message) {
  sendAll('tierlist:progress', message);
}

function isLimitedError(err) {
  const msg = String(err?.message || err || '');
  return msg.includes('429') || msg.toLowerCase().includes('rate limit');
}

function markLimited() {
  limitedUntil = Date.now() + LIMIT_COOLDOWN_MS;
}

function stillLimited() {
  return Date.now() < limitedUntil;
}

function wilsonLower(wins, n, z = 1.64) {
  if (n <= 0) return 0;
  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return ((center - margin) / denom) * 100;
}

function bayesRate(wins, n) {
  return ((wins + PRIOR_GAMES * 0.5) / (n + PRIOR_GAMES)) * 100;
}

function compactMatch(match) {
  if (!match?.info || match.info.queueId !== 420) return null;
  const parts = [];
  for (const p of match.info.participants || []) {
    const role = ROLE_LABEL[p.teamPosition];
    if (!role || !p.championName) continue;
    parts.push({ c: p.championName, r: role, w: !!p.win });
  }
  if (parts.length < 8) return null;
  return {
    id: match.metadata?.matchId,
    v: patchOf(match.info.gameVersion),
    parts,
  };
}

function gamesFor(store, key, patch) {
  const row = store[key];
  if (!row?.games?.length) return [];
  if (patch && row.patch && row.patch !== patch) return [];
  return row.games.filter((g) => !patch || !g.v || g.v === patch);
}

function putGames(store, key, patch, games) {
  const prev = store[key]?.patch === patch ? store[key].games || [] : [];
  const have = new Set(prev.map((g) => g.id));
  const next = [...prev];
  for (const game of games) {
    if (!game?.id || have.has(game.id)) continue;
    have.add(game.id);
    next.push(game);
    if (next.length >= POOL_CAP) break;
  }
  store[key] = { patch, games: next.slice(-POOL_CAP), at: Date.now() };
  return store[key];
}

function assignTiers(rows, minGames) {
  const usable = rows.filter((r) => r.games >= minGames);
  const avg = usable.length
    ? usable.reduce((s, r) => s + r.score, 0) / usable.length
    : 50;
  for (const row of rows) {
    row.delta = Number((row.score - avg).toFixed(1));
    row.lowSample = row.games < minGames;
    if (row.lowSample) {
      row.tier = '?';
      continue;
    }
    const d = row.delta;
    if (d >= 2.4) row.tier = 'S+';
    else if (d >= 1.2) row.tier = 'S';
    else if (d >= 0.4) row.tier = 'A';
    else if (d >= -0.8) row.tier = 'B';
    else if (d >= -2) row.tier = 'C';
    else row.tier = 'D';
  }
  rows.sort((a, b) => {
    if (a.lowSample !== b.lowSample) return a.lowSample ? 1 : -1;
    return b.score - a.score || b.games - a.games;
  });
  rows.forEach((row, i) => { row.rank = i + 1; });
}

function summarizeGames(games, { platform, rank, patch, players, extra }) {
  const champRoles = new Map();
  const champTotals = new Map();
  for (const game of games) {
    for (const p of game.parts || []) {
      const key = `${p.c}|${p.r}`;
      const row = champRoles.get(key) || { champion: p.c, role: p.r, games: 0, wins: 0 };
      row.games += 1;
      if (p.w) row.wins += 1;
      champRoles.set(key, row);
      champTotals.set(p.c, (champTotals.get(p.c) || 0) + 1);
    }
  }

  const matchCount = games.length;
  const minGames = Math.max(8, Math.round(matchCount * 0.05));
  const rows = [...champRoles.values()].map((row) => {
    const raw = row.games ? (row.wins / row.games) * 100 : 0;
    const score = wilsonLower(row.wins, row.games);
    const winrate = bayesRate(row.wins, row.games);
    const lanePct = champTotals.get(row.champion)
      ? (row.games / champTotals.get(row.champion)) * 100
      : 0;
    return {
      champion: row.champion,
      role: row.role,
      games: row.games,
      wins: row.wins,
      winrate: Number(winrate.toFixed(1)),
      rawWinrate: Number(raw.toFixed(1)),
      score: Number(score.toFixed(2)),
      pickrate: Number(Math.min(100, matchCount ? (row.games / matchCount) * 100 : 0).toFixed(1)),
      lanePct: Number(lanePct.toFixed(1)),
    };
  });
  assignTiers(rows, minGames);
  const reliable = rows.filter((r) => !r.lowSample).length;
  return {
    platform,
    rank,
    patch: patch || 'live',
    matches: matchCount,
    players: players || 0,
    minGames,
    reliable,
    builtAt: Date.now(),
    rows,
    ...extra,
  };
}

module.exports = function registerTierList(ipcMain, { riotFetch, mapWithConcurrency, matchRegionOf, fetchMatch, matchCache }) {
  async function leagueEntries(platform, spec) {
    try {
      if (spec.kind === 'league') {
        const data = await riotFetch(
          `https://${platform}.api.riotgames.com/lol/league/v4/${spec.tier}leagues/by-queue/RANKED_SOLO_5x5`,
          2,
        );
        return Array.isArray(data?.entries) ? data.entries : [];
      }
      const data = await riotFetch(
        `https://${platform}.api.riotgames.com/lol/league-exp/v4/entries/RANKED_SOLO_5x5/${spec.tier}/${spec.division}?page=1`,
        2,
      );
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (isLimitedError(err)) markLimited();
      return [];
    }
  }

  async function collectIds(platform, rank, region, haveIds, budget) {
    if (stillLimited() || Date.now() > budget) return { unique: [], players: 0 };
    emitProgress('Loading ladder…');
    const specs = BANDS[rank] || BANDS.challenger;
    const groups = [];
    for (const spec of specs) {
      if (Date.now() > budget || stillLimited()) break;
      groups.push(await leagueEntries(platform, spec));
    }
    const pool = [];
    const seen = new Set();
    for (const group of groups) {
      for (const entry of samplePlayers(group, SAMPLE_PLAYERS)) {
        if (seen.has(entry.puuid)) continue;
        seen.add(entry.puuid);
        pool.push(entry);
      }
    }
    const sample = samplePlayers(pool, SAMPLE_PLAYERS);
    const unique = [];
    const have = new Set(haveIds);
    if (!sample.length || stillLimited()) return { unique, players: sample.length };

    emitProgress(`Reading ${sample.length} ladder players…`);
    const idLists = await mapWithConcurrency(sample.map((e) => e.puuid), 2, async (puuid) => {
      if (Date.now() > budget || stillLimited()) return [];
      try {
        return await riotFetch(
          `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${MATCHES_PER}&queue=420`,
          2,
        );
      } catch (err) {
        if (isLimitedError(err)) markLimited();
        return [];
      }
    });
    for (const list of idLists) {
      for (const id of list || []) {
        if (!id || have.has(id)) continue;
        have.add(id);
        unique.push(id);
        if (unique.length >= WAVE_MATCHES) break;
      }
      if (unique.length >= WAVE_MATCHES) break;
    }
    return { unique, players: sample.length };
  }

  async function loadMatches(region, ids, budget) {
    const games = [];
    const bag = matchCache?.readCache?.() || {};
    let loaded = 0;
    await mapWithConcurrency(ids, 2, async (id) => {
      if (Date.now() > budget || stillLimited()) return null;
      try {
        const match = fetchMatch
          ? await fetchMatch(region, id, bag)
          : await riotFetch(`https://${region}.api.riotgames.com/lol/match/v5/matches/${id}`, 2);
        loaded += 1;
        emitProgress(`Loading ranked games ${loaded}/${ids.length}…`);
        const compact = compactMatch(match);
        if (compact) games.push(compact);
        return match;
      } catch (err) {
        if (isLimitedError(err)) markLimited();
        loaded += 1;
        return null;
      }
    });
    try { matchCache?.writeCache?.(bag); } catch { /* ignore */ }
    return games;
  }

  function payloadFromStore(platform, rank, patch, extra = {}) {
    const store = readStore();
    const key = cacheKey(platform, rank);
    const games = gamesFor(store, key, patch);
    return summarizeGames(games, {
      platform,
      rank,
      patch,
      players: extra.players || 0,
      extra,
    });
  }

  async function build({ platform, rank }) {
    const started = Date.now();
    const region = matchRegionOf(platform);
    const patch = await currentPatch();
    const key = cacheKey(platform, rank);
    const store = readStore();
    if (store[key]?.patch && patch && store[key].patch !== patch) {
      store[key] = { patch, games: [], at: Date.now() };
      writeStore(store);
    }

    const emit = (extra) => {
      const payload = payloadFromStore(platform, rank, patch, extra);
      sendAll('tierlist:ready', payload);
      return payload;
    };

    if (stillLimited()) {
      const payload = emit({
        error: 'Rate limit hit. Showing the Challenger sample already saved on this PC.',
        refreshing: false,
      });
      if (payload.rows.length) return payload;
      return {
        ...payload,
        error: 'Rate limit hit. Wait 2 minutes, then rebuild.',
      };
    }

    let players = 0;
    let waves = 0;
    while (Date.now() - started < TOTAL_MS && !stillLimited()) {
      const current = readStore();
      const have = (current[key]?.games || []).map((g) => g.id);
      if (have.length >= POOL_CAP) break;
      const budget = Math.min(started + TOTAL_MS, Date.now() + WAVE_MS);
      const { unique, players: found } = await collectIds(platform, rank, region, have, budget);
      players = Math.max(players, found || 0);
      if (!unique.length) break;
      const games = await loadMatches(region, unique, budget);
      if (games.length) {
        const next = readStore();
        putGames(next, key, patch, games);
        writeStore(next);
      }
      waves += 1;
      const refreshing = (readStore()[key]?.games || []).length < 80 && !stillLimited();
      emit({
        players,
        refreshing,
        error: stillLimited() ? 'Rate limit hit partway through. Sample is still growing on later rebuilds.' : '',
      });
      if (!games.length || unique.length < 4) break;
      if (waves >= 4) break;
    }

    const payload = payloadFromStore(platform, rank, patch, {
      players,
      refreshing: false,
    });
    if (!payload.rows.length) {
      payload.error = stillLimited()
        ? 'Rate limit hit. Wait 2 minutes, then rebuild.'
        : 'Could not sample enough ranked games. Wait a minute and rebuild.';
    } else if (payload.matches < 80) {
      payload.note = `Need about 80+ games for a stable list. This sample is ${payload.matches}. Rebuild later to add more.`;
    }
    return payload;
  }

  function startBuild(platform, rank, key) {
    if (inflight.has(key)) return inflight.get(key);
    const job = build({ platform, rank })
      .then((data) => {
        if (data?.rows?.length || data?.matches) {
          const next = readAll();
          next[key] = { at: Date.now(), data: { ...data, refreshing: false } };
          writeAll(next);
        }
        sendAll('tierlist:ready', data);
        return data;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, job);
    return job;
  }

  async function getTierList({ platform = 'euw1', rank = 'challenger', force = false } = {}) {
    const key = cacheKey(platform, rank);
    const all = readAll();
    const cached = all[key];
    const ttl = cached?.data?.error && !cached?.data?.rows?.length ? 60 * 1000 : TTL_MS;
    const fresh = cached?.data?.rows?.length && Date.now() - cached.at < ttl;
    if (fresh && !force) return cached.data;

    const patch = cached?.data?.patch || '';
    const preview = payloadFromStore(platform, rank, patch, {
      refreshing: true,
      players: cached?.data?.players || 0,
    });
    if (preview.matches >= 8 && !force) {
      startBuild(platform, rank, key);
      return preview;
    }

    return startBuild(platform, rank, key);
  }

  ipcMain.handle('riot:getTierList', async (_e, args) => {
    try {
      return await getTierList(args || {});
    } catch (err) {
      if (isLimitedError(err)) markLimited();
      return {
        platform: args?.platform || 'euw1',
        rank: args?.rank || 'challenger',
        patch: 'live',
        matches: 0,
        players: 0,
        builtAt: Date.now(),
        rows: [],
        error: isLimitedError(err)
          ? 'Rate limit hit. Wait 2 minutes, then try Challenger.'
          : (err?.message || 'Could not build the tier list. Wait a moment and try again.'),
      };
    }
  });
};
