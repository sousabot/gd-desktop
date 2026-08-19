// Riot match-v5 has no LP delta. We only record a number when we can
// actually see it: same-rank LP change after exactly one new ranked game,
// or the League client's last-game notification.

function mapKey(riotId, mode) {
  return `rift-lp-games:${String(riotId || '').toLowerCase()}:${mode}`;
}

function snapKey(riotId, mode) {
  return `rift-lp-snap:${String(riotId || '').toLowerCase()}:${mode}`;
}

// Ranked games move tens of LP, not thousands. U.GG sends a sentinel
// (e.g. -9992) on old matches where they have no delta — same junk on
// wins and losses. Snapshot logic already uses ±50.
const MAX_LP_DELTA = 80;

export function isPlausibleLpDelta(value) {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 && Math.abs(n) <= MAX_LP_DELTA;
}

export function readLpMap(riotId, mode) {
  try {
    const raw = JSON.parse(localStorage.getItem(mapKey(riotId, mode)) || '{}');
    if (!raw || typeof raw !== 'object') return {};
    const clean = {};
    for (const [id, value] of Object.entries(raw)) {
      if (isPlausibleLpDelta(value)) clean[id] = Math.round(Number(value));
    }
    return clean;
  } catch {
    return {};
  }
}

export function rememberLpDelta(riotId, mode, matchId, lpDelta) {
  if (!riotId || !mode || !matchId) return;
  if (!isPlausibleLpDelta(lpDelta)) return;
  const map = readLpMap(riotId, mode);
  map[matchId] = Math.round(Number(lpDelta));
  try {
    localStorage.setItem(mapKey(riotId, mode), JSON.stringify(map));
  } catch { /* quota */ }
}

export function formatLpDelta(value, estimated = false) {
  if (!isPlausibleLpDelta(value)) return null;
  const rounded = Math.round(Number(value));
  return `${estimated ? '~' : ''}${rounded > 0 ? '+' : ''}${rounded} LP`;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function estimateLpDelta({ win, visibleMmr, hiddenMmr, lobbyMmr } = {}) {
  const me = Number.isFinite(Number(hiddenMmr)) ? Number(hiddenMmr)
    : Number.isFinite(Number(visibleMmr)) ? Number(visibleMmr)
      : null;
  const opp = Number.isFinite(Number(lobbyMmr)) ? Number(lobbyMmr) : me;
  if (me == null || opp == null) return win ? 18 : -16;
  const expected = 1 / (1 + 10 ** ((opp - me) / 400));
  const raw = Math.round(20 * ((win ? 1 : 0) - expected));
  if (win) return clamp(raw || 12, 8, 32);
  return -clamp(Math.abs(raw) || 12, 8, 32);
}

function lobbyMmrNear(lobbyMmrs, endedAt) {
  const t = Number(endedAt);
  if (!Number.isFinite(t) || !Array.isArray(lobbyMmrs)) return null;
  let best = null;
  let bestDiff = 45 * 60 * 1000;
  for (const row of lobbyMmrs) {
    const at = Number(row?.at);
    const mmr = Number(row?.mmr);
    if (!Number.isFinite(at) || !Number.isFinite(mmr)) continue;
    const diff = Math.abs(at - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = mmr;
    }
  }
  return best;
}

const ESTIMATE_WITHIN_MS = 14 * 24 * 60 * 60 * 1000;

export function attachEstimatedLp(games, { visibleMmr, hiddenMmr, lobbyMmrs } = {}) {
  const list = Array.isArray(games) ? games : [];
  const now = Date.now();
  return list.map((g) => {
    if (isPlausibleLpDelta(g?.lpDelta)) return g;
    if (g?.queueId !== 420 && g?.queueId !== 440) return g;
    if ((Number(g.durationMin) || 0) < 5) return g;
    const ended = Number(g.endedAt);
    if (!Number.isFinite(ended) || now - ended > ESTIMATE_WITHIN_MS) return g;
    const lpDeltaEst = estimateLpDelta({
      win: g.win,
      visibleMmr,
      hiddenMmr,
      lobbyMmr: lobbyMmrNear(lobbyMmrs, ended),
    });
    return { ...g, lpDeltaEst };
  });
}

export function matchNumericId(matchId) {
  const s = String(matchId || '');
  const m = s.match(/_(\d+)$/);
  if (m) return m[1];
  return /^\d+$/.test(s) ? s : '';
}

export function applyTrackedLp(games, lpByNumericId, riotId, mode) {
  const map = lpByNumericId && typeof lpByNumericId === 'object' ? lpByNumericId : {};
  if (!Object.keys(map).length) return games;
  return games.map((g) => {
    const id = matchNumericId(g.matchId);
    const n = Number(id ? map[id] : null);
    if (!isPlausibleLpDelta(n)) return g;
    rememberLpDelta(riotId, mode, g.matchId, n);
    return { ...g, lpDelta: Math.round(n), lpDeltaEst: null };
  });
}

export function applyLpNotes(games, notes, riotId, mode, queueId) {
  const list = Array.isArray(games) ? games : [];
  const ranked = queueId == null ? list : list.filter((g) => g.queueId === queueId);
  const used = new Set();
  const next = {};
  for (const note of notes || []) {
    const delta = Math.round(Number(note?.lpDelta));
    if (!isPlausibleLpDelta(delta)) continue;
    const gid = note.gameId != null ? String(note.gameId) : '';
    let target = gid
      ? ranked.find((g) => matchNumericId(g.matchId) === gid)
      : null;
    if (!target) target = ranked.find((g) => g.matchId && !used.has(g.matchId));
    if (!target?.matchId) continue;
    used.add(target.matchId);
    next[target.matchId] = delta;
    rememberLpDelta(riotId, mode, target.matchId, delta);
  }
  if (!Object.keys(next).length) return list;
  return list.map((g) => (
    next[g.matchId] != null ? { ...g, lpDelta: next[g.matchId], lpDeltaEst: null } : g
  ));
}

export function syncMatchLp({ riotId, mode, lp, tier, division, games, queueId } = {}) {
  const list = Array.isArray(games) ? games : [];
  if (!riotId || !mode) {
    return list.map((g) => ({ ...g, lpDelta: g.lpDelta ?? null }));
  }

  const ranked = list.filter((g) => queueId == null || g.queueId === queueId);
  const newest = ranked[0];
  const lpNow = Number(lp);

  try {
    const prev = JSON.parse(localStorage.getItem(snapKey(riotId, mode)) || 'null');
    if (
      prev
      && newest?.matchId
      && prev.newestMatchId
      && prev.newestMatchId !== newest.matchId
      && Number.isFinite(lpNow)
      && Number.isFinite(Number(prev.lp))
    ) {
      let newCount = 0;
      for (const g of ranked) {
        if (g.matchId === prev.newestMatchId) break;
        newCount += 1;
      }
      const sameLine = String(prev.tier || '') === String(tier || '')
        && String(prev.division || '') === String(division || '');
      const delta = lpNow - Number(prev.lp);
      if (
        newCount === 1
        && sameLine
        && delta !== 0
        && delta >= -50
        && delta <= 50
      ) {
        rememberLpDelta(riotId, mode, newest.matchId, delta);
      }
    }
  } catch { /* ignore */ }

  if (newest?.matchId && Number.isFinite(lpNow)) {
    try {
      localStorage.setItem(snapKey(riotId, mode), JSON.stringify({
        newestMatchId: newest.matchId,
        lp: lpNow,
        tier: tier || null,
        division: division || null,
        at: Date.now(),
      }));
    } catch { /* quota */ }
  }

  const map = readLpMap(riotId, mode);
  return list.map((g) => ({
    ...g,
    lpDelta: map[g.matchId] != null ? map[g.matchId] : (g.lpDelta ?? null),
  }));
}
