// Rift Score — Rift.lol performance rating (0–100).
// Built from that game's box score, role-weighted. Not Riot's metric and not DPM.gg's.

const ROLE_KEYS = {
  TOP: 'TOP',
  JUNGLE: 'JUNGLE',
  JNG: 'JUNGLE',
  MIDDLE: 'MIDDLE',
  MID: 'MIDDLE',
  BOTTOM: 'BOTTOM',
  BOT: 'BOTTOM',
  ADC: 'BOTTOM',
  UTILITY: 'UTILITY',
  SUPPORT: 'UTILITY',
  SUP: 'UTILITY',
};

const WEIGHTS = {
  TOP:     { kda: 0.26, kp: 0.16, dmg: 0.22, csm: 0.20, vis: 0.08, win: 0.08 },
  JUNGLE:  { kda: 0.24, kp: 0.22, dmg: 0.16, csm: 0.14, vis: 0.16, win: 0.08 },
  MIDDLE:  { kda: 0.26, kp: 0.18, dmg: 0.24, csm: 0.16, vis: 0.08, win: 0.08 },
  BOTTOM:  { kda: 0.26, kp: 0.18, dmg: 0.26, csm: 0.16, vis: 0.06, win: 0.08 },
  UTILITY: { kda: 0.22, kp: 0.28, dmg: 0.08, csm: 0.04, vis: 0.30, win: 0.08 },
  ARAM:    { kda: 0.32, kp: 0.28, dmg: 0.32, csm: 0.00, vis: 0.00, win: 0.08 },
  DEFAULT: { kda: 0.26, kp: 0.20, dmg: 0.20, csm: 0.14, vis: 0.12, win: 0.08 },
};

// par = typical decent game (~55). excellent = smash game (~100).
const BENCH = {
  TOP:     { kda: [2.4, 5.0], kp: [0.42, 0.70], dmg: [0.20, 0.32], csm: [7.0, 9.5], vis: [0.7, 1.4] },
  JUNGLE:  { kda: [2.8, 5.5], kp: [0.52, 0.78], dmg: [0.18, 0.30], csm: [5.2, 8.0], vis: [1.1, 2.0] },
  MIDDLE:  { kda: [2.8, 5.5], kp: [0.48, 0.75], dmg: [0.24, 0.36], csm: [7.4, 10.0], vis: [0.7, 1.4] },
  BOTTOM:  { kda: [3.0, 6.0], kp: [0.52, 0.78], dmg: [0.26, 0.38], csm: [8.0, 10.5], vis: [0.6, 1.2] },
  UTILITY: { kda: [2.8, 6.0], kp: [0.62, 0.88], dmg: [0.10, 0.20], csm: [1.2, 2.5], vis: [1.8, 3.2] },
  ARAM:    { kda: [3.0, 6.5], kp: [0.55, 0.82], dmg: [0.20, 0.32], csm: [1, 1], vis: [1, 1] },
  DEFAULT: { kda: [2.6, 5.2], kp: [0.50, 0.75], dmg: [0.20, 0.32], csm: [6.0, 9.0], vis: [0.9, 1.8] },
};

const ARAM_QUEUE = 450;

export function normalizeRole(position) {
  return ROLE_KEYS[String(position || '').toUpperCase()] || 'DEFAULT';
}

function profileFor(role, queueId) {
  if (Number(queueId) === ARAM_QUEUE) return 'ARAM';
  return WEIGHTS[role] ? role : 'DEFAULT';
}

function scale(value, par, excellent) {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return 0;
  if (excellent <= par) return v >= par ? 55 : (v / par) * 55;
  if (v <= par) return (v / par) * 55;
  const t = (v - par) / (excellent - par);
  return Math.min(100, 55 + t * 45);
}

export function computeGdScore({
  kda = 0,
  kp = 0,
  damageShare = 0,
  csm = 0,
  visionPerMin = 0,
  win = false,
  role = '',
  queueId = 0,
} = {}) {
  const lane = normalizeRole(role);
  const key = profileFor(lane, queueId);
  const w = WEIGHTS[key];
  const b = BENCH[key];
  const parts = {
    kda: scale(kda, b.kda[0], b.kda[1]),
    kp: scale(kp, b.kp[0], b.kp[1]),
    dmg: scale(damageShare, b.dmg[0], b.dmg[1]),
    csm: w.csm ? scale(csm, b.csm[0], b.csm[1]) : 50,
    vis: w.vis ? scale(visionPerMin, b.vis[0], b.vis[1]) : 50,
    win: win ? 100 : 38,
  };
  const raw =
    parts.kda * w.kda +
    parts.kp * w.kp +
    parts.dmg * w.dmg +
    parts.csm * w.csm +
    parts.vis * w.vis +
    parts.win * w.win;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function gdScoreFromParticipant(p, match) {
  if (!p || !match?.info) return 50;
  const mins = Math.max(1, (match.info.gameDuration || 1) / 60);
  const team = match.info.participants.filter((pp) => pp.teamId === p.teamId);
  const teamKills = team.reduce((sum, pp) => sum + (pp.kills || 0), 0);
  const teamDamage = team.reduce((sum, pp) => sum + (pp.totalDamageDealtToChampions || 0), 0);
  const damage = p.totalDamageDealtToChampions || 0;
  return computeGdScore({
    kda: (p.kills + p.assists) / Math.max(1, p.deaths),
    kp: teamKills > 0 ? (p.kills + p.assists) / teamKills : 0,
    damageShare: teamDamage ? damage / teamDamage : 0,
    csm: ((p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0)) / mins,
    visionPerMin: (p.visionScore || 0) / mins,
    win: !!p.win,
    role: p.teamPosition || p.individualPosition || '',
    queueId: match.info.queueId,
  });
}

export const GD_SCORE_HINT =
  'Rift Score (0–100): role-weighted from KDA, kill participation, damage share, CS/min, vision, and result.';
