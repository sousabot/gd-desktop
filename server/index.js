// GD Esports API proxy — holds the Riot key on the server.
// Desktop builds call this instead of talking to Riot with a key in the .exe.
//
// Local:  npm run server
// Host:   Render / Railway / Fly — set RIOT_API_KEY (and optional DISCORD_WEBHOOK_URL, GD_APP_TOKEN)

const http = require('http');
const path = require('path');
const { URL } = require('url');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PORT = Number(process.env.PORT) || 8787;
const TOKEN = String(process.env.GD_APP_TOKEN || '').trim();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 80;
const hits = new Map();

function clip(value, max) {
  return String(value || '').trim().slice(0, max);
}

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket.remoteAddress || 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  const row = hits.get(ip) || { count: 0, start: now };
  if (now - row.start > WINDOW_MS) {
    row.count = 0;
    row.start = now;
  }
  row.count += 1;
  hits.set(ip, row);
  return row.count > MAX_PER_WINDOW;
}

function isRiotUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && /^[\w.-]+\.api\.riotgames\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 50_000) {
        reject(new Error('Payload too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(json);
}

function authorized(req) {
  if (!TOKEN) return true;
  const header = String(req.headers.authorization || '');
  return header === `Bearer ${TOKEN}`;
}

async function proxyRiot(url) {
  const key = String(process.env.RIOT_API_KEY || '').trim();
  if (!key) {
    const err = new Error('RIOT_API_KEY is not set on the server');
    err.status = 500;
    throw err;
  }
  const res = await fetch(url, { headers: { 'X-Riot-Token': key } });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* keep text */ }
  return { status: res.status, ok: res.ok, statusText: res.statusText, data };
}

async function postDiscord(payload) {
  const webhook = String(process.env.DISCORD_WEBHOOK_URL || '').trim();
  if (!webhook) {
    const err = new Error('DISCORD_WEBHOOK_URL is not set on the server');
    err.status = 500;
    throw err;
  }
  const kind = payload.kind === 'feedback' ? 'Feedback' : 'Bug';
  const title = clip(payload.title, 120);
  const message = clip(payload.message, 1800);
  if (!title || !message) {
    const err = new Error('Title and details are required.');
    err.status = 400;
    throw err;
  }
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'GD Desktop',
      embeds: [{
        title: `${kind}: ${title}`,
        description: message,
        color: kind === 'Bug' ? 0xff5c68 : 0x7c5cff,
        fields: [
          { name: 'Type', value: kind, inline: true },
          { name: 'Riot ID', value: clip(payload.riotId, 80) || 'Not linked', inline: true },
          { name: 'Page', value: clip(payload.page, 80) || '/', inline: true },
          { name: 'Contact', value: clip(payload.contact, 80) || '—', inline: true },
          { name: 'App', value: clip(payload.appVersion, 40) || '0.1.0', inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Discord webhook failed (${res.status}). ${body.slice(0, 180)}`);
    err.status = 502;
    throw err;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    send(res, 200, {
      ok: true,
      service: 'gd-desktop-api',
      riotKeyConfigured: Boolean(String(process.env.RIOT_API_KEY || '').trim()),
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/riot.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('b3ba387c-aed8-4287-85ce-0d12bb1d02d2');
    return;
  }

  if (rateLimited(clientIp(req))) {
    send(res, 429, { error: 'Rate limit — wait a minute and try again.' });
    return;
  }

  if (!authorized(req)) {
    console.log(`[gd-api] ${req.method} ${url.pathname} -> 401 unauthorized`);
    send(res, 401, { error: 'Unauthorized' });
    return;
  }

  try {
    if (req.method === 'GET' && url.pathname === '/v1/status') {
      const result = await proxyRiot('https://euw1.api.riotgames.com/lol/status/v4/platform-data');
      console.log(`[gd-api] GET /v1/status -> ${result.status}`);
      send(res, 200, { ok: result.ok, riotStatus: result.status, riotStatusText: result.statusText });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/riot') {
      const body = await readJson(req);
      if (!isRiotUrl(body.url)) {
        send(res, 400, { error: 'Only Riot API URLs are allowed.' });
        return;
      }
      const result = await proxyRiot(body.url);
      console.log(`[gd-api] POST /v1/riot -> ${result.status} ${result.statusText}`);
      send(res, result.ok ? 200 : result.status, result.ok
        ? { data: result.data }
        : { error: `Riot API ${result.status} ${result.statusText}`, data: result.data });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/feedback') {
      await postDiscord(await readJson(req));
      send(res, 200, { ok: true });
      return;
    }

    send(res, 404, { error: 'Not found' });
  } catch (err) {
    console.log(`[gd-api] ${req.method} ${url.pathname} -> ${err.status || 500}`);
    send(res, err.status || 500, { error: err.message || 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`[gd-api] listening on :${PORT}`);
  if (!process.env.RIOT_API_KEY) console.warn('[gd-api] RIOT_API_KEY is not set');
});
