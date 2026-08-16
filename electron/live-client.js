const https = require('https');

const LIVE_URL = 'https://127.0.0.1:2999/liveclientdata/allgamedata';
const INTERESTING = new Set([
  'FirstBlood',
  'Multikill',
  'Ace',
  'DragonKill',
  'HeraldKill',
  'BaronKill',
  'HordeKill',
  'TurretKilled',
  'InhibKilled',
  'DragonSoulGiven',
]);

function nameMatches(name, keys) {
  const n = normName(name);
  if (!n) return false;
  if (keys.has(n)) return true;
  const hash = n.lastIndexOf('#');
  if (hash > 0 && keys.has(n.slice(0, hash))) return true;
  for (const key of keys) {
    if (key && (n === key || n.startsWith(`${key}#`) || key.startsWith(`${n}#`))) return true;
  }
  return false;
}

function recorderEventsFromRaw(raw, youRow, active) {
  const keys = new Set([...playerKeys(youRow), ...playerKeys(active)]);
  const events = (raw.events && raw.events.Events) || [];
  const out = [];
  for (const ev of events) {
    if (ev.EventName === 'ChampionKill' && nameMatches(ev.KillerName, keys)) {
      out.push({
        id: ev.EventID,
        type: 'kill',
        label: ev.VictimName ? `Kill · ${ev.VictimName}` : 'Kill',
        time: ev.EventTime || 0,
      });
      continue;
    }
    if (ev.EventName === 'Multikill' && nameMatches(ev.KillerName, keys)) {
      out.push({
        id: ev.EventID,
        type: 'multikill',
        label: ev.KillStreak ? `${ev.KillStreak}x kill` : 'Multikill',
        time: ev.EventTime || 0,
      });
      continue;
    }
    if (ev.EventName === 'FirstBlood' && nameMatches(ev.Recipient || ev.KillerName, keys)) {
      out.push({
        id: ev.EventID,
        type: 'firstblood',
        label: 'First blood',
        time: ev.EventTime || 0,
      });
    }
  }
  return out;
}

function fetchLiveJson(url = LIVE_URL) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      rejectUnauthorized: false,
      timeout: 700,
      headers: { Accept: 'application/json' },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Live client ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch (err) { reject(err); }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Live client timeout'));
    });
    req.on('error', reject);
  });
}

function playerName(p = {}) {
  return p.riotId || [p.riotIdGameName, p.riotIdTagLine].filter(Boolean).join('#') || p.summonerName || '';
}

function normName(s) {
  return String(s || '').trim().toLowerCase();
}

function playerKeys(p = {}) {
  const riotId = normName(p.riotId);
  const gameName = normName(p.riotIdGameName);
  const tag = normName(p.riotIdTagLine);
  const summoner = normName(p.summonerName);
  const keys = new Set();
  if (riotId) keys.add(riotId);
  if (gameName && tag) keys.add(`${gameName}#${tag}`);
  if (gameName) keys.add(gameName);
  if (summoner) {
    keys.add(summoner);
    const hash = summoner.lastIndexOf('#');
    if (hash > 0) keys.add(summoner.slice(0, hash));
  }
  return keys;
}

function samePlayer(a, b) {
  const A = playerKeys(a);
  const B = playerKeys(b);
  for (const key of A) {
    if (B.has(key)) return true;
  }
  return false;
}

function findYouRow(raw) {
  const active = raw.activePlayer || {};
  const players = raw.allPlayers || [];
  return players.find((p) => samePlayer(active, p))
    || players.find((p) => !p.isBot)
    || players[0]
    || {};
}

function readCs(...sources) {
  let best = 0;
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const key of ['creepScore', 'cs', 'minionsKilled', 'totalMinionsKilled']) {
      const n = Number(src[key]);
      if (Number.isFinite(n) && n > best) best = n;
    }
    const jungle = Number(src.neutralMinionsKilled ?? src.jungleMinionsKilled);
    const lane = Number(src.totalMinionsKilled ?? src.minionsKilled);
    if (Number.isFinite(jungle) && Number.isFinite(lane) && jungle + lane > best) {
      best = jungle + lane;
    }
  }
  return best;
}

function formatEvent(ev) {
  if (!ev) return '';
  if (ev.EventName === 'DragonKill') {
    const kind = ev.DragonType || 'Dragon';
    return ev.Stolen ? `${kind} stolen` : kind;
  }
  if (ev.EventName === 'HeraldKill') return ev.Stolen ? 'Herald stolen' : 'Herald';
  if (ev.EventName === 'BaronKill') return ev.Stolen ? 'Baron stolen' : 'Baron';
  if (ev.EventName === 'HordeKill') return 'Voidgrubs';
  if (ev.EventName === 'TurretKilled') return 'Turret';
  if (ev.EventName === 'InhibKilled') return 'Inhib';
  if (ev.EventName === 'DragonSoulGiven') return `${ev.DragonType || 'Dragon'} soul`;
  if (ev.EventName === 'FirstBlood') return 'First blood';
  if (ev.EventName === 'Ace') return 'Ace';
  if (ev.EventName === 'Multikill') return ev.KillStreak ? `${ev.KillStreak}x` : 'Multikill';
  return ev.EventName;
}

function snapshotFromRaw(raw, extraScores) {
  const active = raw.activePlayer || {};
  const youRow = findYouRow(raw);
  const youName = playerName(active) || playerName(youRow) || 'You';
  const scores = youRow.scores || {};
  const stats = active.championStats || {};
  const items = (youRow.items || [])
    .filter((it) => it && it.itemID)
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
    .map((it) => it.itemID);
  const events = ((raw.events && raw.events.Events) || [])
    .filter((ev) => INTERESTING.has(ev.EventName))
    .slice(-5)
    .map((ev) => ({
      id: ev.EventID,
      name: formatEvent(ev),
      time: ev.EventTime || 0,
    }));

  const itemGold = (youRow.items || []).reduce((sum, it) => {
    if (!it?.itemID) return sum;
    return sum + (Number(it.price) || 0) * Math.max(1, Number(it.count) || 1);
  }, 0);

  return {
    inGame: true,
    gameTime: raw.gameData?.gameTime || 0,
    gameMode: raw.gameData?.gameMode || '',
    you: {
      name: youName || playerName(youRow) || 'You',
      champion: youRow.championName || '',
      level: youRow.level || active.level || 1,
      kills: scores.kills || 0,
      deaths: scores.deaths || 0,
      assists: scores.assists || 0,
      cs: readCs(scores, extraScores, youRow, active, active.scores),
      gold: Math.floor(active.currentGold || 0),
      goldTotal: itemGold + Math.floor(active.currentGold || 0),
      vision: Number(scores.wardScore) || 0,
      items,
      hp: Math.round(stats.currentHealth || 0),
      hpMax: Math.round(stats.maxHealth || 0),
      resource: Math.round(stats.resourceValue || 0),
      resourceMax: Math.round(stats.resourceMax || 0),
      resourceType: stats.resourceType || '',
    },
    events,
  };
}

async function fetchPlayerScores(riotId) {
  if (!riotId) return null;
  const url = `https://127.0.0.1:2999/liveclientdata/playerscores?riotId=${encodeURIComponent(riotId)}`;
  try {
    return await fetchLiveJson(url);
  } catch {
    return null;
  }
}

async function getLiveSnapshot() {
  try {
    const raw = await fetchLiveJson();
    if (!raw || !raw.gameData) return { inGame: false };
    const riotId = playerName(raw.activePlayer) || playerName(findYouRow(raw));
    const extraScores = await fetchPlayerScores(riotId);
    return snapshotFromRaw(raw, extraScores);
  } catch {
    return { inGame: false };
  }
}

async function getRecorderTick() {
  try {
    const raw = await fetchLiveJson();
    if (!raw || !raw.gameData) return { inGame: false };
    const youRow = findYouRow(raw);
    const active = raw.activePlayer || {};
    return {
      inGame: true,
      gameTime: raw.gameData?.gameTime || 0,
      gameMode: raw.gameData?.gameMode || '',
      you: playerName(active) || playerName(youRow) || 'You',
      champion: youRow.championName || '',
      events: recorderEventsFromRaw(raw, youRow, active),
    };
  } catch {
    return { inGame: false };
  }
}

async function getLiveRoster() {
  try {
    const raw = await fetchLiveJson();
    const players = raw?.allPlayers || [];
    if (!players.length) return { inGame: false, players: [] };
    const youRow = findYouRow(raw);
    return {
      inGame: true,
      gameTime: raw.gameData?.gameTime || 0,
      players: players.map((p) => ({
        champion: p.championName || '',
        riotId: playerName(p),
        gameName: p.riotIdGameName || '',
        tagLine: p.riotIdTagLine || p.riotIdTagline || '',
        team: p.team || '',
        items: (p.items || []).map((it) => it.itemID).filter(Boolean),
        cs: readCs(p.scores, p),
        position: p.position || '',
        isYou: samePlayer(p, youRow) || samePlayer(p, raw.activePlayer),
      })),
    };
  } catch {
    return { inGame: false, players: [] };
  }
}

module.exports = { getLiveSnapshot, getRecorderTick, getLiveRoster };
