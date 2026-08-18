const https = require('https');

const PLATFORM_TO_OPGG = {
  euw1: 'euw',
  na1: 'na',
  kr: 'kr',
  eun1: 'eune',
  br1: 'br',
  jp1: 'jp',
  la1: 'lan',
  la2: 'las',
  oc1: 'oce',
  tr1: 'tr',
  ru: 'ru',
  ph2: 'ph',
  sg2: 'sg',
  th2: 'th',
  tw2: 'tw',
  vn2: 'vn',
  me1: 'me',
};

const cache = new Map();
const TTL_MS = 30 * 60 * 1000;

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 Rift.lol',
      },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(`season-peak ${res.statusCode}`);
          err.status = res.statusCode;
          reject(err);
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch (err) { reject(err); }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('season-peak timeout'));
    });
    req.on('error', reject);
  });
}

function highFromEntry(entry) {
  const info = entry?.high_rank_info;
  if (!info?.tier) return null;
  return {
    tier: info.tier,
    division: info.division,
    lp: info.lp,
  };
}

async function getSeasonPeak({ puuid, platform, flex = false } = {}) {
  const id = String(puuid || '').trim();
  if (!id) return null;
  const region = PLATFORM_TO_OPGG[String(platform || '').toLowerCase()] || 'euw';
  const queue = flex ? 'flex' : 'solo';
  const cacheKey = `${region}:${id}:${queue}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const url = `https://lol-api-summoner.op.gg/api/v3/${region}/summoners/${encodeURIComponent(id)}?hl=en_US`;
  const json = await httpsGetJson(url);
  const data = json?.data || json;
  const want = flex ? 'FLEXRANKED' : 'SOLORANKED';
  const row = (data?.current_season_high_tiers?.rank_entries || []).find((entry) => entry?.game_type === want);
  const peak = highFromEntry(row);
  cache.set(cacheKey, { at: Date.now(), data: peak });
  return peak;
}

function register(ipcMain) {
  ipcMain.handle('peak:seasonHigh', async (_e, args) => {
    try {
      return await getSeasonPeak(args || {});
    } catch {
      return null;
    }
  });
}

module.exports = register;
