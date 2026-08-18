const cache = new Map();
const TTL_MS = 30 * 60 * 1000;
const ROLE = { Top: 'Top', Jungle: 'Jungle', Mid: 'Mid', ADC: 'Bot', Support: 'Support' };
const FIELDS = 'Link,Team,Champion,IngameRole,DateTime_UTC,Items,KeystoneRune,PrimaryTree,SecondaryTree';

function esc(value) {
  return String(value || '').replace(/"/g, '');
}

function cargoUrl({ champion, role, since }) {
  let where = role
    ? `Champion="${esc(champion)}" AND IngameRole="${esc(role)}" AND DateTime_UTC IS NOT NULL`
    : `Champion="${esc(champion)}" AND DateTime_UTC IS NOT NULL`;
  if (since) where += ` AND DateTime_UTC >= "${esc(since)}"`;
  const params = new URLSearchParams({
    action: 'cargoquery',
    format: 'json',
    origin: '*',
    limit: '25',
    tables: 'ScoreboardPlayers',
    fields: FIELDS,
    where,
    order_by: 'DateTime_UTC DESC',
  });
  return `https://lol.fandom.com/api.php?${params.toString()}`;
}

function splitList(value, sep) {
  return String(value || '')
    .split(sep)
    .map((part) => part.trim())
    .filter(Boolean);
}

function playerName(link) {
  const raw = String(link || '').trim();
  const cut = raw.replace(/\s*\(.*\)$/, '').trim();
  return cut || raw;
}

function mapRows(payload) {
  const rows = Array.isArray(payload?.cargoquery) ? payload.cargoquery : [];
  return rows.map((entry, i) => {
    const row = entry?.title || {};
    return {
      id: `${row.Link || 'p'}-${row.DateTime_UTC || i}`,
      player: playerName(row.Link),
      team: row.Team || '',
      role: row.IngameRole || '',
      at: row.DateTime_UTC || '',
      items: splitList(row.Items, ';'),
      keystone: row.KeystoneRune || '',
      primary: row.PrimaryTree || '',
      secondary: row.SecondaryTree || '',
    };
  }).filter((row) => row.player);
}

async function query(champion, role, since) {
  const url = cargoUrl({ champion, role, since });
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RiftDesktop/0.1.11 (https://github.com/sousabot/rift-desktop; draft-probuilds)',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Leaguepedia ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.info || 'Leaguepedia cargo error');
  return mapRows(json);
}

function sinceStamp(days) {
  if (!days) return '';
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
}

async function listProbuilds({ champion, role } = {}) {
  const name = String(champion || '').trim();
  if (!name) return { ok: true, rows: [] };
  const wikiRole = ROLE[role] || role || '';
  const key = `${name}|${wikiRole}|55`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  try {
    const recent = sinceStamp(55);
    let rows = wikiRole ? await query(name, wikiRole, recent) : await query(name, '', recent);
    if (!rows.length && wikiRole) rows = await query(name, wikiRole, '');
    const data = { ok: true, rows, source: 'Leaguepedia' };
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    return { ok: false, rows: [], error: err.message || 'Could not load pro builds.' };
  }
}

function register(ipcMain) {
  ipcMain.handle('probuilds:list', (_e, args) => listProbuilds(args || {}));
}

module.exports = { listProbuilds, register };
