const TIER_BASE = {
  IRON: 0,
  BRONZE: 400,
  SILVER: 800,
  GOLD: 1200,
  PLATINUM: 1600,
  EMERALD: 2000,
  DIAMOND: 2400,
  MASTER: 2800,
  GRANDMASTER: 2800,
  CHALLENGER: 2800,
};

const DIV_LP = { IV: 0, III: 100, II: 200, I: 300 };

function parseLp(lp) {
  if (lp == null || lp === '') return null;
  const n = Number(lp);
  return Number.isFinite(n) ? n : null;
}

const DIV_FROM_NUM = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

function normalizeDivision(division) {
  if (division == null || division === '') return null;
  const raw = String(division).trim();
  if (DIV_FROM_NUM[raw] || DIV_FROM_NUM[Number(raw)]) {
    return DIV_FROM_NUM[raw] || DIV_FROM_NUM[Number(raw)];
  }
  return raw.toUpperCase();
}

export function estimateRankMmr(tier, division, lp) {
  const t = String(tier || '').toUpperCase();
  const base = TIER_BASE[t];
  if (base == null) return null;
  const apex = t === 'MASTER' || t === 'GRANDMASTER' || t === 'CHALLENGER';
  const div = apex ? 0 : (DIV_LP[normalizeDivision(division) || ''] ?? 0);
  const points = parseLp(lp);
  return base + div + (points == null ? 0 : points);
}

export function mmrFromTierInfo(info, { missingLp = 0 } = {}) {
  if (!info?.tier) return null;
  const points = parseLp(info.lp);
  return estimateRankMmr(info.tier, info.division, points == null ? missingLp : points);
}

export function averageLobbyMmr(perGameMmrs = []) {
  const vals = perGameMmrs.filter((n) => Number.isFinite(n));
  if (!vals.length) return null;
  let weight = 1;
  let weighted = 0;
  let total = 0;
  for (const value of vals) {
    weighted += value * weight;
    total += weight;
    weight *= 0.85;
  }
  return Math.round(weighted / total);
}

export function estimateMmrFromRecord(visibleMmr, wins, losses) {
  if (visibleMmr == null || !Number.isFinite(visibleMmr)) return null;
  const w = Number(wins);
  const l = Number(losses);
  if (!Number.isFinite(w) || !Number.isFinite(l) || w + l < 8) return null;
  const prior = 10;
  const wr = (w + prior * 0.5) / (w + l + prior);
  if (wr <= 0.02 || wr >= 0.98) return Math.round(visibleMmr + (wr > 0.5 ? 400 : -400));
  const offset = 400 * Math.log10(wr / (1 - wr));
  return Math.round(visibleMmr + offset);
}

export function resolveEstimatedMmr({ visibleMmr, wins, losses, lobbyMmrs } = {}) {
  const lobby = averageLobbyMmr(lobbyMmrs);
  if (lobby != null) return lobby;
  return estimateMmrFromRecord(visibleMmr, wins, losses);
}

export function formatMmr(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value).toLocaleString('en-US');
}

const TIER_ORDER = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'];
const DIV_ORDER = ['IV', 'III', 'II', 'I'];

function titleTier(tier) {
  const t = String(tier || '');
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function mmrToRank(mmr) {
  if (mmr == null || !Number.isFinite(mmr)) return null;
  const n = Math.max(0, Math.round(mmr));
  if (n >= 2800) {
    const lp = n - 2800;
    return {
      tier: 'MASTER',
      division: null,
      lp,
      short: `${lp} LP`,
      label: `Master ${lp} LP`,
    };
  }
  const tierIdx = Math.min(TIER_ORDER.length - 1, Math.floor(n / 400));
  const within = n - tierIdx * 400;
  const divIdx = Math.min(3, Math.floor(within / 100));
  const lp = within - divIdx * 100;
  const tier = TIER_ORDER[tierIdx];
  const division = DIV_ORDER[divIdx];
  return {
    tier,
    division,
    lp,
    short: `${division} · ${lp} LP`,
    label: `${titleTier(tier)} ${division} · ${lp} LP`,
  };
}

export function rankToShort(rank) {
  const { tier, division, lp } = rank || {};
  const t = String(tier || '').toUpperCase();
  if (!t || !TIER_BASE[t]) return null;
  const apex = t === 'MASTER' || t === 'GRANDMASTER' || t === 'CHALLENGER';
  const lpNum = parseLp(lp);
  if (apex) return lpNum != null ? `${lpNum} LP` : titleTier(t);
  const div = String(division || '').toUpperCase();
  if (div && lpNum != null) return `${div} · ${lpNum} LP`;
  if (div) return div;
  return lpNum != null ? `${lpNum} LP` : titleTier(t);
}

export function rankSnapshot(tier, division, lp) {
  const t = String(tier || '').toUpperCase();
  if (!TIER_BASE[t]) return null;
  const apex = t === 'MASTER' || t === 'GRANDMASTER' || t === 'CHALLENGER';
  const div = apex ? null : normalizeDivision(division);
  const lpNum = parseLp(lp);
  const mmr = estimateRankMmr(t, div, lpNum);
  if (mmr == null) return null;
  return {
    tier: t,
    division: div,
    lp: lpNum,
    mmr,
    lpKnown: lpNum != null,
  };
}

export function betterPeak(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  if ((b.mmr || 0) !== (a.mmr || 0)) return (b.mmr || 0) > (a.mmr || 0) ? b : a;
  if (b.lpKnown && !a.lpKnown) return b;
  return a;
}

export function mergePeakRank(...rows) {
  return rows.filter(Boolean).reduce((best, row) => betterPeak(best, row), null);
}

export function peakFromLcuPack(pack, queueType) {
  if (!pack) return [];
  const out = [];
  const highest = rankSnapshot(pack.highestTier, pack.highestDivision, null);
  if (highest) out.push(highest);
  for (const note of pack.notes || []) {
    if (queueType && note.queueType && note.queueType !== queueType) continue;
    const after = rankSnapshot(note.tier, note.division, note.lp);
    if (after) out.push(after);
    if (note.lp != null && note.lpDelta != null) {
      const beforeLp = note.lp - note.lpDelta;
      if (beforeLp >= 0 && beforeLp < 2000) {
        const before = rankSnapshot(note.tier, note.division, beforeLp);
        if (before) out.push(before);
      }
    }
  }
  return out;
}

export function displayPeakShort(peak, current) {
  return rankToShort(mergePeakRank(peak, current));
}
