const cache = new Map();
const TTL_MS = 20 * 60 * 1000;
const LANE = { Top: 'top', Jungle: 'jungle', Mid: 'middle', ADC: 'bottom', Support: 'support' };
const TREE = [8000, 8100, 8200, 8300, 8400];
const BOOTS = new Set([3006, 3009, 3010, 3020, 3047, 3111, 3117, 3158, 2422, 3171, 3513]);
const PETS = new Set([1101, 1102, 1103]);
const STARTERS = new Set([
  1054, 1055, 1056, 1082, 1083, 1101, 1102, 1103,
  2003, 2031, 3070, 3850, 3851, 3854, 3855, 3858, 3859,
  3862, 3863, 3865, 3866, 3867, 1035, 1039, 1041, 1036, 1028, 1027,
]);
const SLUG = {
  MonkeyKing: 'wukong',
  Wukong: 'wukong',
  DrMundo: 'drmundo',
  ChoGath: 'chogath',
  KaiSa: 'kaisa',
  KhaZix: 'khazix',
  VelKoz: 'velkoz',
  LeBlanc: 'leblanc',
  Nunu: 'nunu',
  RekSai: 'reksai',
  BelVeth: 'belveth',
  JarvanIV: 'jarvaniv',
  TwistedFate: 'twistedfate',
  MasterYi: 'masteryi',
  MissFortune: 'missfortune',
  TahmKench: 'tahmkench',
  AurelionSol: 'aurelionsol',
  LeeSin: 'leesin',
  XinZhao: 'xinzhao',
};

function slugOf(champion) {
  const key = String(champion || '').trim();
  if (SLUG[key]) return SLUG[key];
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function styleId(index) {
  return TREE[Number(index)] || TREE[0];
}

function parsePath(row) {
  if (!Array.isArray(row) || row.length < 2) return null;
  const ids = String(row[0] || '').split('_').map(Number).filter((id) => id > 0);
  const games = Number(row[1]) || 0;
  const wins = Number(row[2]) || 0;
  if (!ids.length || games <= 0) return null;
  return { ids, games, wins, wr: (wins / games) * 100 };
}

function topBoot(rows) {
  const ranked = (rows || []).map(parsePath).filter((p) => p && BOOTS.has(p.ids[0]));
  ranked.sort((a, b) => b.games - a.games);
  return ranked[0]?.ids[0] || null;
}

function startersFrom(rows) {
  const found = [];
  const seen = new Set();
  for (const row of rows || []) {
    const path = parsePath(row);
    if (!path) continue;
    for (const id of path.ids) {
      if (!STARTERS.has(id) || seen.has(id)) continue;
      seen.add(id);
      found.push(id);
      if (found.length >= 3) return found;
    }
  }
  return found;
}

function situationalFor(core, rows) {
  const prefix = `${core.join('_')}_`;
  const extra = [];
  const seen = new Set(core);
  for (const row of rows || []) {
    const path = parsePath(row);
    if (!path || !String(row[0]).startsWith(prefix)) continue;
    const id = path.ids[path.ids.length - 1];
    if (!id || seen.has(id) || BOOTS.has(id)) continue;
    seen.add(id);
    extra.push({ id, games: path.games, wins: path.wins, wr: path.wr });
    if (extra.length >= 4) break;
  }
  extra.sort((a, b) => b.games - a.games);
  return extra;
}

function perkIdsOf(arr, max) {
  const out = [];
  for (const v of arr || []) {
    const id = Number(Array.isArray(v) ? v[0] : v);
    if (!Number.isFinite(id) || id <= 0) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

function runePage(summary, key, spells) {
  const pack = summary?.runes?.[key];
  if (!pack?.set?.pri) return null;
  const pri = perkIdsOf(pack.set.pri, 4);
  const sec = perkIdsOf(pack.set.sec, 2);
  const mod = perkIdsOf(pack.set.mod, 3);
  const selectedPerkIds = [...pri, ...sec, ...mod];
  if (selectedPerkIds.length < 6) return null;
  while (selectedPerkIds.length < 9) selectedPerkIds.push(5008);
  return {
    name: 'Rift Draft',
    primaryStyleId: styleId(pack.page?.pri),
    subStyleId: styleId(pack.page?.sec),
    selectedPerkIds: selectedPerkIds.slice(0, 9),
    spells: (spells || []).slice(0, 2),
    games: Number(pack.n) || 0,
    wr: Number(pack.wr) || 0,
  };
}

function parseEarly(row) {
  if (!Array.isArray(row) || row.length < 2) return null;
  const ids = String(row[0] || '').split('_').map(Number).filter((id) => id > 0);
  const wr = Number(row[1]) || 0;
  const games = Number(row[row.length - 1]) || 0;
  if (!ids.length || games <= 0) return null;
  return { ids, wr, games };
}

function junglePet(earlySet) {
  const tally = new Map();
  for (const row of earlySet || []) {
    const path = parseEarly(row);
    if (!path || !PETS.has(path.ids[0])) continue;
    const cur = tally.get(path.ids[0]) || { id: path.ids[0], games: 0, wr: 0, wrGames: 0 };
    cur.games += path.games;
    if (path.games > cur.wrGames) {
      cur.wr = path.wr;
      cur.wrGames = path.games;
    }
    tally.set(path.ids[0], cur);
  }
  return [...tally.values()].sort((a, b) => b.games - a.games)[0] || null;
}

function prioFromSeq(seq, games, wr) {
  const counts = { 1: 0, 2: 0, 3: 0 };
  const order = [];
  for (const ch of String(seq)) {
    if (ch !== '1' && ch !== '2' && ch !== '3') continue;
    counts[ch] += 1;
    if (counts[ch] === 5 && !order.includes(ch)) order.push(ch);
  }
  if (order.length < 3) return null;
  const letters = order.map((n) => ({ 1: 'Q', 2: 'W', 3: 'E' }[n]));
  return { id: letters.join(''), order: letters, games, wr };
}

function parseSkillPriorities(html) {
  const byId = new Map();
  const prioRe = /"([QWE]{3})",(\d{3,}),(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = prioRe.exec(html))) {
    const id = m[1];
    if (new Set(id).size !== 3) continue;
    const games = Number(m[2]);
    const wr = Number(m[3]);
    if (games < 80 || wr < 35 || wr > 75) continue;
    const prev = byId.get(id);
    if (!prev || games > prev.games) byId.set(id, { id, order: id.split(''), games, wr });
  }
  if (!byId.size) {
    const seqRe = /\b([1234]{15}),(\d{3,}),(\d+(?:\.\d+)?)/g;
    while ((m = seqRe.exec(html))) {
      const parsed = prioFromSeq(m[1], Number(m[2]), Number(m[3]));
      if (!parsed || parsed.games < 80) continue;
      const prev = byId.get(parsed.id);
      if (!prev || parsed.games > prev.games) byId.set(parsed.id, parsed);
    }
  }
  return [...byId.values()].sort((a, b) => b.games - a.games);
}

async function httpGetText(url) {
  const headers = {
    accept: 'text/html',
    origin: 'https://lolalytics.com',
    referer: 'https://lolalytics.com/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
  let res;
  try {
    const { net } = require('electron');
    res = await net.fetch(url, { headers });
  } catch {
    res = await fetch(url, { headers });
  }
  if (!res.ok) throw new Error(`lolalytics ${res.status}`);
  return res.text();
}

async function fetchSkillPriorities(slug, lane) {
  const html = await httpGetText(`https://lolalytics.com/lol/${slug}/build/?lane=${lane}`);
  return parseSkillPriorities(html);
}

function pickSkill(list, wantWr) {
  if (!list?.length) return null;
  if (!wantWr) return list[0];
  const floor = Math.max(80, Math.round((list[0].games || 0) * 0.12));
  const ranked = list.filter((s) => s.games >= floor).sort((a, b) => b.wr - a.wr || b.games - a.games);
  const best = ranked[0];
  if (best && best.id !== list[0].id) return best;
  return list[1] || list[0];
}

function pickPaths(itemSet3) {
  const paths = (itemSet3 || []).map(parsePath).filter(Boolean);
  if (!paths.length) return [];
  paths.sort((a, b) => b.games - a.games);
  const most = paths[0];
  const floor = Math.max(80, Math.round(most.games * 0.12));
  const wrSorted = paths.filter((p) => p.games >= floor).sort((a, b) => b.wr - a.wr || b.games - a.games);
  const bestWr = wrSorted[0] && wrSorted[0].ids.join('_') !== most.ids.join('_')
    ? wrSorted[0]
    : paths[1] || null;
  return [most, bestWr].filter(Boolean);
}

async function httpGet(url) {
  const headers = {
    accept: 'application/json',
    origin: 'https://lolalytics.com',
    referer: 'https://lolalytics.com/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
  let res;
  try {
    const { net } = require('electron');
    res = await net.fetch(url, { headers });
  } catch {
    res = await fetch(url, { headers });
  }
  if (!res.ok) throw new Error(`lolalytics ${res.status}`);
  return res.json();
}

function megaUrl(ep, slug, lane) {
  const q = new URLSearchParams({
    ep,
    c: slug,
    lane,
    tier: 'emerald_plus',
  });
  return `https://a1.lolalytics.com/mega/?${q.toString()}`;
}

async function fetchMetaBuilds({ champion, role, spells } = {}) {
  const slug = slugOf(champion);
  const lane = LANE[role] || 'middle';
  if (!slug) return { ok: false, builds: [] };
  const key = `${slug}|${lane}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  try {
    const [runeJson, itemJson, earlyJson, skills] = await Promise.all([
      httpGet(megaUrl('rune', slug, lane)),
      httpGet(megaUrl('build-itemset', slug, lane)),
      httpGet(megaUrl('build-earlyset', slug, lane)).catch(() => null),
      fetchSkillPriorities(slug, lane).catch(() => []),
    ]);
    const sets = itemJson?.itemSets || {};
    const paths = pickPaths(sets.itemSet3);
    const boot = topBoot(sets.itemBootSet1);
    const start = startersFrom(sets.itemSet1).filter((id) => !PETS.has(id));
    const pet = junglePet(earlyJson?.earlySet);
    const pickRunes = runePage(runeJson?.summary, 'pick', spells);
    const winRunes = runePage(runeJson?.summary, 'win', spells);
    const builds = paths.map((path, i) => {
      const runes = i === 0 ? pickRunes : (winRunes || pickRunes);
      return {
        id: i === 0 ? 'most' : 'wr',
        label: i === 0 ? 'Most played' : 'Highest winrate',
        games: path.games,
        wr: path.wr,
        core: path.ids.slice(0, 3),
        boots: boot,
        starters: start,
        pet: pet || null,
        skills: pickSkill(skills, i > 0),
        extra: situationalFor(path.ids.slice(0, 3), sets.itemSet4 || sets.itemSet5),
        runes,
        source: 'Lolalytics emerald+',
      };
    });
    const data = { ok: true, builds, source: 'Lolalytics' };
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    return { ok: false, builds: [], error: err.message || 'Could not load builds.' };
  }
}

function register(ipcMain) {
  ipcMain.handle('meta:builds', (_e, args) => fetchMetaBuilds(args || {}));
}

module.exports = register;
