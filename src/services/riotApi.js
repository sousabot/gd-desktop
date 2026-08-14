import { MOCK_PROFILE, MOCK_TOP_LEAGUE, MOCK_LIVE_GAME } from './mockData';
import { getDdragonVersion } from './ddragon';

const hasBridge = typeof window !== 'undefined' && !!window.riotAPI;

export function isLive() { return hasBridge; }

// Champion Mastery gives numeric championIds, but champion-splash/icon URLs
// (and ChampThumb) key off the ddragon name string — resolve that mapping
// once and reuse it everywhere.
let championMetaPromise = null;
function getChampionMeta() {
  if (!championMetaPromise) {
    championMetaPromise = getDdragonVersion()
      .then((v) => fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion.json`))
      .then((r) => r.json())
      .then((data) => {
        const map = {};
        const names = {};
        Object.values(data.data).forEach((c) => {
          map[c.key] = c.id;
          names[c.id] = c.name;
        });
        return { map, names, total: Object.keys(data.data).length };
      })
      .catch(() => ({ map: {}, names: {}, total: 0 }));
  }
  return championMetaPromise;
}

const ROLE_LABELS = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support' };

export async function getSummonerDashboard({ gameName, tagLine, region = 'europe', platform = 'euw1', queue = 420, count = 20 }) {
  if (!hasBridge) return MOCK_PROFILE;

  const matchCount = Math.min(Math.max(Number(count) || 20, 1), 100);

  try {
    // Step 1: account (puuid)
    const account = await window.riotAPI.getAccountByRiotId({ gameName, tagLine, region });

    let resolvedRegion = region;
    let resolvedPlatform = platform;
    if (window.riotAPI.getLeagueShard) {
      try {
        const shard = await window.riotAPI.getLeagueShard({
          puuid: account.puuid,
          region,
          platform,
        });
        if (shard?.platform) resolvedPlatform = shard.platform;
        if (shard?.region) resolvedRegion = shard.region;
      } catch (e) {
        console.warn('[riotApi] Shard lookup failed, using selected server:', e.message);
      }
    }

    const matchIds = await window.riotAPI.getMatchIds({
      puuid: account.puuid,
      region: resolvedRegion,
      count: matchCount,
      queue: queue || undefined,
    });
    const timelineIds = (matchIds || []).slice(0, 10);

    const [matches, timelines] = await Promise.all([
      window.riotAPI.getMatchesBulk({ matchIds, region: resolvedRegion }),
      window.riotAPI.getTimelinesBulk({ matchIds: timelineIds, region: resolvedRegion }).catch((e) => {
        console.warn('[riotApi] Timeline fetch failed, @15 stats will show as unavailable:', e.message);
        return [];
      }),
    ]);

    // Step 3 & 4: summoner + ranked-by-puuid don't depend on each other either.
    const [summonerResult, rankedResult, masteryResult, champMeta] = await Promise.all([
      window.riotAPI.getSummonerByPuuid({ puuid: account.puuid, platform: resolvedPlatform }).then(
        (value) => ({ status: 'fulfilled', value }),
        (reason) => ({ status: 'rejected', reason })
      ),
      window.riotAPI.getRankedByPuuid({ puuid: account.puuid, platform: resolvedPlatform }).then(
        (value) => ({ status: 'fulfilled', value }),
        (reason) => ({ status: 'rejected', reason })
      ),
      window.riotAPI.getChampionMasteries
        ? window.riotAPI.getChampionMasteries({ puuid: account.puuid, platform: resolvedPlatform }).catch(() => [])
        : Promise.resolve([]),
      getChampionMeta(),
    ]);

    const summoner = summonerResult.status === 'fulfilled' ? summonerResult.value : null;
    if (summonerResult.status === 'rejected') {
      console.warn('[riotApi] Summoner fetch failed:', summonerResult.reason?.message);
    }

    let ranked = [];
    if (rankedResult.status === 'fulfilled') {
      ranked = rankedResult.value;
    } else {
      console.warn('[riotApi] getRankedByPuuid failed, trying summonerId:', rankedResult.reason?.message);
      if (summoner?.id) {
        try {
          ranked = await window.riotAPI.getRankedEntries({ summonerId: summoner.id, platform: resolvedPlatform });
        } catch (e2) {
          console.warn('[riotApi] getRankedEntries also failed:', e2.message);
        }
      }
    }

    // Step 5: ladder position (#N) — only exists for Master+ tiers; Riot has no
    // global ladder rank for Diamond and below.
    let ladderRank = null;
    const soloEntry = ranked.find((r) => r.queueType === 'RANKED_SOLO_5x5');
    if (soloEntry && ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(soloEntry.tier)) {
      try {
        const league = await window.riotAPI.getTopLeague({ tier: soloEntry.tier.toLowerCase(), platform: resolvedPlatform });
        const sorted = [...league.entries].sort((a, b) => b.leaguePoints - a.leaguePoints);
        const idx = sorted.findIndex((e) => e.puuid === account.puuid || e.summonerId === summoner?.id);
        if (idx !== -1) ladderRank = idx + 1;
      } catch (e) {
        console.warn('[riotApi] Ladder rank lookup failed:', e.message);
      }
    }

    return await normalizeDashboard({
      account, summoner, ranked, matches, timelines, ladderRank,
      puuid: account.puuid,
      platform: resolvedPlatform,
      collections: {
        played: Array.isArray(masteryResult) ? masteryResult.length : 0,
        total: champMeta.total || 0,
      },
    });
  } catch (err) {
    console.error('[riotApi] Live fetch failed:', err);
    throw err;
  }
}

export async function getLatestMatchReview({ gameName, tagLine, region = 'europe', platform = 'euw1' }) {
  if (!hasBridge) return MOCK_PROFILE.recentGames?.[0] || null;
  try {
    const account = await window.riotAPI.getAccountByRiotId({ gameName, tagLine, region });
    let resolvedRegion = region;
    let resolvedPlatform = platform;
    if (window.riotAPI.getLeagueShard) {
      try {
        const shard = await window.riotAPI.getLeagueShard({ puuid: account.puuid, region, platform });
        if (shard?.platform) resolvedPlatform = shard.platform;
        if (shard?.region) resolvedRegion = shard.region;
      } catch { /* keep selected server */ }
    }
    const matchIds = await window.riotAPI.getMatchIds({
      puuid: account.puuid,
      region: resolvedRegion,
      count: 1,
    });
    if (!matchIds?.length) return null;
    const [matches, timelines] = await Promise.all([
      window.riotAPI.getMatchesBulk({ matchIds, region: resolvedRegion }),
      window.riotAPI.getTimelinesBulk({ matchIds, region: resolvedRegion }).catch(() => []),
    ]);
    const dash = await normalizeDashboard({
      account, summoner: null, ranked: [], matches, timelines,
      puuid: account.puuid, platform: resolvedPlatform, skipDeltas: true,
    });
    return dash.recentGames?.[0] || null;
  } catch (err) {
    console.warn('[riotApi] Latest match review failed:', err.message);
    return null;
  }
}

export async function comparePlayers(leftLookup, rightLookup) {
  const [left, right] = await Promise.all([
    getSummonerDashboard({ ...leftLookup, queue: 420, count: 20 }),
    getSummonerDashboard({ ...rightLookup, queue: 420, count: 20 }),
  ]);
  const rightByChamp = Object.fromEntries((right.championPool || []).map((c) => [c.champion, c]));
  const overlap = (left.championPool || [])
    .filter((c) => rightByChamp[c.champion])
    .map((c) => ({
      champion: c.champion,
      left: c,
      right: rightByChamp[c.champion],
    }));
  return { left, right, overlap };
}

export async function getActiveGame({ gameName, tagLine, region = 'europe', platform = 'euw1' }) {
  if (!hasBridge) return null;
  try {
    const account = await window.riotAPI.getAccountByRiotId({ gameName, tagLine, region });
    return await window.riotAPI.getActiveGame({ puuid: account.puuid, platform });
  } catch {
    return null;
  }
}

function soloRank(entries = []) {
  const solo = entries.find((r) => r.queueType === 'RANKED_SOLO_5x5') || entries[0];
  if (!solo) return { rank: 'Unranked', lp: null, wins: null, losses: null };
  const division = solo.rank && !['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(solo.tier)
    ? ` ${solo.rank}`
    : '';
  return {
    rank: `${solo.tier}${division}`,
    lp: solo.leaguePoints ?? null,
    wins: solo.wins ?? null,
    losses: solo.losses ?? null,
  };
}

function streakFromResults(results) {
  if (!results.length) return 0;
  const first = results[0];
  let n = 0;
  for (const win of results) {
    if (win !== first) break;
    n += 1;
  }
  return first ? n : -n;
}

async function liveMatchExtras(puuids, championIdByPuuid, region, queue = 420) {
  if (!window.riotAPI.getLastMatchIdsBulk) return {};
  const lists = await window.riotAPI.getLastMatchIdsBulk({
    puuids, region, queue, count: 10,
  }).catch(() => []);
  const unique = [...new Set((lists || []).flat().filter(Boolean))];
  const matches = unique.length
    ? await window.riotAPI.getMatchesBulk({ matchIds: unique, region }).catch(() => [])
    : [];
  const byMatchId = {};
  unique.forEach((id, i) => { byMatchId[id] = matches[i]; });

  const extras = {};
  puuids.forEach((puuid, i) => {
    const champId = championIdByPuuid[puuid];
    let champGames = 0;
    let champWins = 0;
    const roles = {};
    const results = [];
    (lists[i] || []).forEach((matchId) => {
      const self = byMatchId[matchId]?.info?.participants?.find((p) => p.puuid === puuid);
      if (!self) return;
      results.push(!!self.win);
      if (self.championId === champId) {
        champGames += 1;
        if (self.win) champWins += 1;
      }
      const pos = self.teamPosition || self.individualPosition;
      if (pos && ROLE_LABELS[pos]) roles[pos] = (roles[pos] || 0) + 1;
    });
    const topRole = Object.entries(roles).sort((a, b) => b[1] - a[1])[0];
    extras[puuid] = {
      champGames,
      champWins,
      champWr: champGames ? (champWins / champGames) * 100 : null,
      role: topRole ? ROLE_LABELS[topRole[0]] : null,
      streak: streakFromResults(results),
      last3: results.slice(0, 3),
      dodge: streakFromResults(results) <= -3,
    };
  });
  return extras;
}

export async function getLiveGame({ gameName, tagLine, region = 'europe', platform = 'euw1' }) {
  if (!hasBridge) return MOCK_LIVE_GAME;
  try {
    const account = await window.riotAPI.getAccountByRiotId({ gameName, tagLine, region });
    let raw;
    try {
      raw = await window.riotAPI.getActiveGame({ puuid: account.puuid, platform });
    } catch {
      return null;
    }
    if (!raw?.participants?.length) return null;

    const puuids = raw.participants.map((p) => p.puuid).filter(Boolean);
    const histQueue = [420, 440].includes(raw.gameQueueConfigId) ? raw.gameQueueConfigId : 420;
    const champIdByPuuid = {};
    raw.participants.forEach((p) => { if (p.puuid) champIdByPuuid[p.puuid] = p.championId; });

    const [champMeta, accounts, rankedLists, extras] = await Promise.all([
      getChampionMeta(),
      window.riotAPI.getAccountsByPuuidsBulk({ puuids, region }).catch(() => []),
      window.riotAPI.getRankedByPuuidsBulk
        ? window.riotAPI.getRankedByPuuidsBulk({ puuids, platform }).catch(() => [])
        : Promise.all(puuids.map((puuid) =>
          window.riotAPI.getRankedByPuuid({ puuid, platform }).catch(() => [])
        )),
      liveMatchExtras(puuids, champIdByPuuid, region, histQueue).catch(() => ({})),
    ]);

    const players = raw.participants.map((p, i) => {
      const acc = accounts[i];
      const name = p.riotIdGameName || acc?.gameName || p.summonerName || 'Unknown';
      const tag = p.riotIdTagline || acc?.tagLine || '';
      const ranked = soloRank(rankedLists[i] || []);
      const extra = extras[p.puuid] || {};
      const hasSmite = p.spell1Id === 11 || p.spell2Id === 11;
      const champId = champMeta.map[String(p.championId)] || 'Aatrox';
      return {
        puuid: p.puuid,
        teamId: p.teamId,
        champion: champId,
        championName: champMeta.names?.[champId] || champId,
        profileIconId: p.profileIconId,
        spell1Id: p.spell1Id,
        spell2Id: p.spell2Id,
        keystone: p.perks?.perkIds?.[0] || null,
        primaryStyle: p.perks?.perkStyle || null,
        subStyle: p.perks?.perkSubStyle || null,
        gameName: name,
        tagLine: tag,
        riotId: tag ? `${name}#${tag}` : name,
        isSelf: p.puuid === account.puuid,
        role: hasSmite ? 'Jungle' : extra.role || null,
        champGames: extra.champGames || 0,
        champWins: extra.champWins || 0,
        champWr: extra.champWr,
        streak: extra.streak || 0,
        last3: extra.last3 || [],
        dodge: !!extra.dodge,
        ...ranked,
      };
    });

    return {
      gameId: raw.gameId,
      queueId: raw.gameQueueConfigId,
      queueName: QUEUE_NAMES[raw.gameQueueConfigId] || 'Custom',
      gameLength: raw.gameLength || 0,
      bans: (raw.bannedChampions || []).map((b) => ({
        teamId: b.teamId,
        champion: champMeta.map[String(b.championId)] || null,
      })),
      blue: players.filter((p) => p.teamId === 100),
      red: players.filter((p) => p.teamId === 200),
    };
  } catch (err) {
    console.warn('[riotApi] Live game enrich failed:', err.message);
    return null;
  }
}

const NAME_ICON_LIMIT = 50; // names + profile icons for the full table
const MATCH_LIMIT = 20;     // role / KDA / most-played champs need match fetches

export async function getTopLeague({ tier = 'challenger', queue = 'RANKED_SOLO_5x5', platform = 'euw1', region = 'europe' }) {
  if (!hasBridge) return MOCK_TOP_LEAGUE;
  try {
    const data = await window.riotAPI.getTopLeague({ tier, queue, platform });
    const top = data.entries
      .sort((a, b) => b.leaguePoints - a.leaguePoints)
      .slice(0, NAME_ICON_LIMIT);

    const iconPuuids = top.map((e) => e.puuid);
    const matchPuuids = top.slice(0, MATCH_LIMIT).map((e) => e.puuid);

    const GAMES_PER_PLAYER = 6;
    const [accounts, summoners, recentMatchIdLists, masteries, ddVersion, champMeta] = await Promise.all([
      window.riotAPI.getAccountsByPuuidsBulk({ puuids: iconPuuids, region }).catch((e) => {
        console.warn('[riotApi] Leaderboard name resolution failed, falling back to masked IDs:', e.message);
        return [];
      }),
      window.riotAPI.getSummonersByPuuidsBulk({ puuids: iconPuuids, platform }).catch((e) => {
        console.warn('[riotApi] Leaderboard icon resolution failed:', e.message);
        return [];
      }),
      window.riotAPI.getLastMatchIdsBulk({ puuids: matchPuuids, region, count: 10 }).catch((e) => {
        console.warn('[riotApi] Leaderboard match history failed:', e.message);
        return [];
      }),
      window.riotAPI.getChampionMasteryBulk({ puuids: matchPuuids, platform }).catch((e) => {
        console.warn('[riotApi] Leaderboard mastery fallback failed:', e.message);
        return [];
      }),
      getDdragonVersion(),
      getChampionMeta(),
    ]);

    const idsByPlayer = matchPuuids.map((_, i) => {
      const raw = recentMatchIdLists[i];
      const ids = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      return ids.filter(Boolean).slice(0, GAMES_PER_PLAYER);
    });

    const uniqueMatchIds = [];
    const seen = new Set();
    idsByPlayer.forEach((ids) => {
      ids.forEach((id) => {
        if (!seen.has(id)) {
          seen.add(id);
          uniqueMatchIds.push(id);
        }
      });
    });

    const matchById = {};
    const CHUNK = 10;
    for (let i = 0; i < uniqueMatchIds.length; i += CHUNK) {
      const chunk = uniqueMatchIds.slice(i, i + CHUNK);
      const batch = await window.riotAPI.getMatchesBulk({ matchIds: chunk, region }).catch(() => []);
      (batch || []).forEach((m) => { if (m?.metadata?.matchId) matchById[m.metadata.matchId] = m; });
    }

    return top.map((e, i) => {
      const acc = accounts[i];
      const summ = summoners[i];
      const ids = idsByPlayer[i] || [];
      const champCounts = {};
      const roleCounts = {};
      let kills = 0, deaths = 0, assists = 0, games = 0;

      ids.forEach((id) => {
        const match = matchById[id];
        const self = match?.info.participants.find((pp) => pp.puuid === e.puuid);
        if (!self) return;
        games += 1;
        champCounts[self.championName] = (champCounts[self.championName] || 0) + 1;
        if (self.teamPosition) {
          roleCounts[self.teamPosition] = (roleCounts[self.teamPosition] || 0) + 1;
        }
        kills += self.kills;
        deaths += self.deaths;
        assists += self.assists;
      });

      let topChampions = Object.entries(champCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
        .slice(0, 4);

      if (!topChampions.length) {
        topChampions = (masteries[i] || [])
          .map((mm) => champMeta.map[String(mm.championId)])
          .filter(Boolean)
          .slice(0, 4);
      }

      const topRole = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const kda = games ? ((kills + assists) / Math.max(1, deaths)).toFixed(1) : null;

      return {
        rank: i + 1,
        summonerName: acc ? `${acc.gameName}#${acc.tagLine}` : (e.puuid?.slice(0, 8) ?? 'Unknown'),
        profileIconId: summ?.profileIconId ?? null,
        profileIconUrl: summ?.profileIconId != null
          ? `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${summ.profileIconId}.png`
          : null,
        role: topRole ? (ROLE_LABELS[topRole] || null) : null,
        kda,
        topChampions,
        lp: e.leaguePoints,
        wins: e.wins,
        losses: e.losses,
      };
    });
  } catch (err) {
    console.error('[riotApi] Leaderboard fetch failed, falling back to mock:', err);
    return MOCK_TOP_LEAGUE;
  }
}

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

const QUEUE_NAMES = {
  420: 'Solo/Duo',
  440: 'Flex',
  400: 'Normal',
  430: 'Normal',
  450: 'ARAM',
  480: 'Swiftplay',
  700: 'Clash',
};

// Gold Diff @15 and K+A Diff @15 are computed against the opposing player in the
// same role (teamPosition), using the match timeline (match-v5 has no @15 snapshot).
function computeAt15(timeline, match, self) {
  if (!timeline?.info?.frames?.length || !self.teamPosition) {
    return { goldDiff15: null, kaDiff15: null };
  }

  const selfId = self.participantId;
  const opp = match.info.participants.find(
    (pp) => pp.teamId !== self.teamId && pp.teamPosition === self.teamPosition
  );
  if (!opp) return { goldDiff15: null, kaDiff15: null };
  const oppId = opp.participantId;

  const frames = timeline.info.frames;
  const frameAt15 = frames.filter((f) => f.timestamp <= FIFTEEN_MIN_MS).pop();
  if (!frameAt15) return { goldDiff15: null, kaDiff15: null };

  const selfFrame = frameAt15.participantFrames[String(selfId)];
  const oppFrame  = frameAt15.participantFrames[String(oppId)];
  const goldDiff15 = selfFrame && oppFrame ? selfFrame.totalGold - oppFrame.totalGold : null;

  let selfKA = 0, oppKA = 0;
  for (const f of frames) {
    if (f.timestamp > FIFTEEN_MIN_MS) break;
    for (const ev of f.events || []) {
      if (ev.type !== 'CHAMPION_KILL' || ev.timestamp > FIFTEEN_MIN_MS) continue;
      if (ev.killerId === selfId) selfKA++;
      if ((ev.assistingParticipantIds || []).includes(selfId)) selfKA++;
      if (ev.killerId === oppId) oppKA++;
      if ((ev.assistingParticipantIds || []).includes(oppId)) oppKA++;
    }
  }

  return { goldDiff15, kaDiff15: selfKA - oppKA };
}

// Riot doesn't expose an early/mid/late "phase score" — this is a heuristic we
// build from the same gold-diff-vs-lane-opponent data used for Gold Diff @15,
// snapshotted at three points in the game and mapped onto a 0-100 scale.
// It's an approximation for the score rings, not an official Riot metric.
const PHASE_BOUNDARIES = { early: 15 * 60 * 1000, mid: 25 * 60 * 1000 };
const PHASE_NEUTRAL = 50;

function goldDiffAtTimestamp(timeline, selfId, oppId, ts) {
  if (!timeline?.info?.frames?.length) return null;
  const frame = timeline.info.frames.filter((f) => f.timestamp <= ts).pop();
  if (!frame) return null;
  const selfFrame = frame.participantFrames[String(selfId)];
  const oppFrame  = frame.participantFrames[String(oppId)];
  return selfFrame && oppFrame ? selfFrame.totalGold - oppFrame.totalGold : null;
}

function computePhaseScores(timeline, match, self) {
  const neutral = { early: PHASE_NEUTRAL, mid: PHASE_NEUTRAL, late: PHASE_NEUTRAL };
  if (!timeline?.info?.frames?.length || !self.teamPosition) return neutral;

  const opp = match.info.participants.find(
    (pp) => pp.teamId !== self.teamId && pp.teamPosition === self.teamPosition
  );
  if (!opp) return neutral;

  const selfId = self.participantId;
  const oppId  = opp.participantId;
  const lastFrame = timeline.info.frames[timeline.info.frames.length - 1];
  const endTs = Math.max(lastFrame?.timestamp ?? PHASE_BOUNDARIES.mid, PHASE_BOUNDARIES.mid);

  const toScore = (diff) =>
    diff === null ? PHASE_NEUTRAL : Math.round(Math.min(100, Math.max(0, PHASE_NEUTRAL + diff / 30)));

  return {
    early: toScore(goldDiffAtTimestamp(timeline, selfId, oppId, PHASE_BOUNDARIES.early)),
    mid:   toScore(goldDiffAtTimestamp(timeline, selfId, oppId, PHASE_BOUNDARIES.mid)),
    late:  toScore(goldDiffAtTimestamp(timeline, selfId, oppId, endTs)),
  };
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DELTA_STAT_KEYS = ['kda', 'dpmScore', 'kp', 'csm', 'visionScore', 'gpm', 'goldDiff15', 'kaDiff15'];
const DELTA_DECIMALS  = { kda: 1, dpmScore: 1, kp: 2, csm: 1, visionScore: 1, gpm: 0, goldDiff15: 0, kaDiff15: 0 };

function flatDeltas() {
  const out = {};
  DELTA_STAT_KEYS.forEach((k) => { out[k] = { delta: '+0.0', dir: 'flat' }; });
  return out;
}

// Compares this batch's averages against the last saved snapshot to produce
// real "vs il y a 1w" deltas. Only overwrites the saved snapshot once a full
// week has actually passed — otherwise every reload would reset the
// comparison point to "a few seconds ago" instead of a week ago.
async function computeWeeklyDeltas(riotId, currentStats) {
  const result = flatDeltas();
  if (!hasBridge || !window.riotAPI.getStatSnapshot) return result;

  try {
    const snapshot = await window.riotAPI.getStatSnapshot({ riotId });

    if (snapshot?.stats) {
      DELTA_STAT_KEYS.forEach((k) => {
        const prev = snapshot.stats[k];
        const curr = currentStats[k];
        if (prev === null || prev === undefined || curr === null || curr === undefined) return;
        const diff = curr - prev;
        const decimals = DELTA_DECIMALS[k];
        const rounded = Number(diff.toFixed(decimals));
        result[k] = {
          delta: (rounded >= 0 ? '+' : '') + rounded.toFixed(decimals),
          dir: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat',
        };
      });
    }

    const isStale = !snapshot || (Date.now() - snapshot.timestamp) >= ONE_WEEK_MS;
    if (isStale) {
      await window.riotAPI.saveStatSnapshot({ riotId, stats: currentStats });
    }
  } catch (e) {
    console.warn('[riotApi] Weekly delta snapshot failed:', e.message);
  }

  return result;
}

async function normalizeDashboard({
  account, summoner, ranked, matches, timelines = [], ladderRank = null, puuid,
  platform = 'euw1', collections = { played: 0, total: 0 }, skipDeltas = false,
}) {
  const solo = ranked.find((r) => r.queueType === 'RANKED_SOLO_5x5');
  const region = ({ euw1: 'EUW', na1: 'NA', kr: 'KR' })[platform] || 'EUW';

  const recentGames = matches.map((m, idx) => {
    const p = m.info.participants.find((pp) => pp.puuid === puuid);
    if (!p) return null;
    const mins = Math.max(1, m.info.gameDuration / 60);
    const kda = ((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(1);
    const teamKills = m.info.participants
      .filter((pp) => pp.teamId === p.teamId)
      .reduce((sum, pp) => sum + pp.kills, 0);
    const { goldDiff15, kaDiff15 } = computeAt15(timelines[idx], m, p);
    const phases = computePhaseScores(timelines[idx], m, p);
    const allyTeam = [
      p.championName,
      ...m.info.participants
        .filter((pp) => pp.teamId === p.teamId && pp.puuid !== puuid)
        .map((pp) => pp.championName),
    ];
    const enemyTeam = m.info.participants
      .filter((pp) => pp.teamId !== p.teamId)
      .map((pp) => pp.championName);
    const primary = p.perks?.styles?.find((s) => s.description === 'primaryStyle') || p.perks?.styles?.[0];
    const sub = p.perks?.styles?.find((s) => s.description === 'subStyle') || p.perks?.styles?.[1];
    const primaryPerks = (primary?.selections || []).map((s) => s.perk);
    const subPerks = (sub?.selections || []).map((s) => s.perk);

    return {
      matchId:      m.metadata.matchId,
      win:          p.win,
      champion:     p.championName,
      kills:        p.kills,
      deaths:       p.deaths,
      assists:      p.assists,
      cs:           p.totalMinionsKilled + p.neutralMinionsKilled,
      durationMin:  Math.floor(mins),
      durationSec:  Math.round(m.info.gameDuration % 60),
      kda,
      ago:          timeAgo(m.info.gameEndTimestamp),
      lp:           Math.min(99, Math.round((p.kills + p.assists) * 3)),
      queueLabel:   QUEUE_NAMES[m.info.queueId] || 'Other',
      queueType:    QUEUE_NAMES[m.info.queueId] || 'Other',
      region,
      dpm:          p.totalDamageDealtToChampions / mins,
      gpm:          p.goldEarned / mins,
      visionPerMin: p.visionScore / mins,
      kp:           teamKills > 0 ? (p.kills + p.assists) / teamKills : 0,
      goldDiff15,
      kaDiff15,
      earlyScore:   phases.early,
      midScore:     phases.mid,
      lateScore:    phases.late,
      deaths4:      p.deaths,
      killsAssists: p.kills + p.assists,
      csm:          p.totalMinionsKilled + p.neutralMinionsKilled,
      allyTeam,
      enemyTeam,
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
      spells: [p.summoner1Id, p.summoner2Id],
      runes: {
        keystone: primaryPerks[0] || null,
        primary: primary?.style || null,
        sub: sub?.style || null,
        perks: [...primaryPerks, ...subPerks],
      },
    };
  }).filter(Boolean);

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const kdaVal   = avg(recentGames.map((g) => (g.kills + g.assists) / Math.max(1, g.deaths)));
  const csPerMin = avg(recentGames.map((g) => g.cs / Math.max(1, g.durationMin)));
  const dpmVal    = avg(recentGames.map((g) => g.dpm));
  const gpmVal    = avg(recentGames.map((g) => g.gpm));
  const visionVal = avg(recentGames.map((g) => g.visionPerMin));
  const kpVal     = avg(recentGames.map((g) => g.kp));

  const gd15Vals = recentGames.map((g) => g.goldDiff15).filter((v) => v !== null);
  const ka15Vals = recentGames.map((g) => g.kaDiff15).filter((v) => v !== null);
  const gd15Val  = gd15Vals.length ? avg(gd15Vals) : null;
  const ka15Val  = ka15Vals.length ? avg(ka15Vals) : null;
  const fmtSigned = (v) => (v >= 0 ? '+' : '') + Math.round(v);

  const champMap = {};
  recentGames.forEach((g) => {
    if (!champMap[g.champion]) champMap[g.champion] = { wins: 0, losses: 0, kdas: [], css: [] };
    champMap[g.champion][g.win ? 'wins' : 'losses']++;
    champMap[g.champion].kdas.push((g.kills + g.assists) / Math.max(1, g.deaths));
    champMap[g.champion].css.push(g.cs / Math.max(1, g.durationMin));
  });
  const championPool = Object.entries(champMap)
    .sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses))
    .map(([champion, d]) => {
      const games = d.wins + d.losses;
      return {
        champion,
        games,
        wins: d.wins,
        losses: d.losses,
        wr: games ? (d.wins / games) * 100 : 0,
        kda: avg(d.kdas).toFixed(1),
        cs: avg(d.css).toFixed(1),
      };
    });
  const championPerformance = championPool.slice(0, 3).map((d) => ({
    champion: d.champion,
    record: `${d.wins}W-${d.losses}L`,
    wins: d.wins,
    losses: d.losses,
    kda: `${d.kda} KDA`,
    cs: `${d.games}/20`,
  }));

  const last = recentGames[0] || null;
  const avgDeaths = avg(recentGames.map((g) => g.deaths));
  const lensScore = Math.max(0, Math.min(100, Math.round(100 - avgDeaths * 8)));
  const lensSeries = recentGames.map((g) => Math.max(0, Math.min(100, 100 - g.deaths * 8))).reverse();

  const riotId = `${account.gameName}#${account.tagLine}`;
  const deltas = skipDeltas ? flatDeltas() : await computeWeeklyDeltas(riotId, {
    kda: kdaVal, dpmScore: dpmVal, kp: kpVal, csm: csPerMin,
    visionScore: visionVal, gpm: gpmVal, goldDiff15: gd15Val, kaDiff15: ka15Val,
  });

  return {
    riotId,
    profileIconId: summoner?.profileIconId ?? 29,
    summonerLevel: summoner?.summonerLevel ?? null,
    rank:          solo ? `${solo.tier}` : 'Unranked',
    ladderRank,
    lp:            solo?.leaguePoints ?? 0,
    wins:          solo?.wins ?? 0,
    losses:        solo?.losses ?? 0,
    stats: {
      kda:               kdaVal.toFixed(1),
      kdaDelta:          deltas.kda.delta, kdaDeltaDir: deltas.kda.dir,
      dpmScore:          dpmVal.toFixed(1), dpmDelta: deltas.dpmScore.delta, dpmDeltaDir: deltas.dpmScore.dir,
      kp:                kpVal.toFixed(2),  kpDelta:  deltas.kp.delta,  kpDeltaDir:  deltas.kp.dir,
      csm:               csPerMin.toFixed(1),
      csmDelta:          deltas.csm.delta, csmDeltaDir: deltas.csm.dir,
      visionScore:       visionVal.toFixed(1), visionDelta: deltas.visionScore.delta, visionDeltaDir: deltas.visionScore.dir,
      gpm:               gpmVal.toFixed(0), gpmDelta: deltas.gpm.delta, gpmDeltaDir: deltas.gpm.dir,
      goldDiff15:        gd15Val !== null ? fmtSigned(gd15Val) : '—', goldDiff15Delta: deltas.goldDiff15.delta, goldDiff15DeltaDir: deltas.goldDiff15.dir,
      kaDiff15:          ka15Val !== null ? fmtSigned(ka15Val) : '—', kaDiff15Delta:   deltas.kaDiff15.delta,   kaDiff15DeltaDir:   deltas.kaDiff15.dir,
    },
    sparklines: {
      kda:        recentGames.map((g) => (g.kills + g.assists) / Math.max(1, g.deaths)),
      dpmScore:   recentGames.map((g) => g.dpm),
      kp:         recentGames.map((g) => g.kp),
      csm:        recentGames.map((g) => g.cs / Math.max(1, g.durationMin)),
      vision:     recentGames.map((g) => g.visionPerMin),
      gpm:        recentGames.map((g) => g.gpm),
      goldDiff15: recentGames.map((g) => g.goldDiff15 ?? 0),
      kaDiff15:   recentGames.map((g) => g.kaDiff15 ?? 0),
    },
    lastGame: last,
    recentGames,
    championPool,
    championPerformance,
    collections,
    lens: {
      score: lensScore,
      series: lensSeries.length ? lensSeries : [50],
      avgDeaths: Number(avgDeaths.toFixed(1)),
    },
  };
}

function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}