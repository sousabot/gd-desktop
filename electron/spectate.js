const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { execFile } = require('child_process');
const { createScanner } = require('./spectate-feed');
const lcu = require('./lcu');

const DEFAULT_PROXY = 'https://gd-desktop.onrender.com';
const SPECTATE_HOST = {
  NA1: 'spectator.na.lol.pvp.net:8080',
  BR1: 'spectator.br.lol.pvp.net:80',
  LA1: 'spectator.la1.lol.pvp.net:80',
  LA2: 'spectator.la2.lol.pvp.net:80',
  OC1: 'spectator.oc1.lol.pvp.net:80',
  KR: 'spectator.kr.lol.pvp.net:80',
  EUN1: 'spectator.eu.lol.pvp.net:8080',
  EUW1: 'spectator.euw1.lol.pvp.net:8080',
  TR1: 'spectator.tr.lol.pvp.net:80',
  RU: 'spectator.ru.lol.pvp.net:80',
  JP1: 'spectator.jp1.lol.pvp.net:8080',
  PH2: 'spectator.ph2.lol.pvp.net:80',
  SG2: 'spectator.sg2.lol.pvp.net:80',
  TH2: 'spectator.th2.lol.pvp.net:80',
  TW2: 'spectator.tw2.lol.pvp.net:80',
  VN2: 'spectator.vn2.lol.pvp.net:80',
  ME1: 'spectator.me1.lol.pvp.net:80',
};

function proxyBase() {
  if (String(process.env.GD_USE_LOCAL_KEY || '').trim() === '1') return '';
  return String(process.env.GD_API_URL || DEFAULT_PROXY).trim().replace(/\/$/, '');
}

function proxyHeaders() {
  return {
    'User-Agent': 'GD-Esports-Desktop/0.1',
    ...(process.env.GD_APP_TOKEN ? { Authorization: `Bearer ${process.env.GD_APP_TOKEN}` } : {}),
  };
}

async function fetchProxyList(platforms) {
  const base = proxyBase();
  if (!base) return null;
  const qs = new URLSearchParams({ platforms: platforms.join(',') });
  const res = await fetch(`${base}/v1/spectate?${qs.toString()}`, {
    headers: proxyHeaders(),
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Proxy ${res.status}: ${body.error || res.statusText}`);
  }
  return res.json();
}

function processPath(name) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve('');
      return;
    }
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-Command',
      `(Get-Process -Name '${name}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)`,
    ], { windowsHide: true, timeout: 2500 }, (err, stdout) => {
      resolve(err ? '' : String(stdout || '').trim());
    });
  });
}

function guessRoots() {
  return [
    'C:\\Riot Games\\League of Legends',
    path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Riot Games', 'League of Legends'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Riot Games', 'League of Legends'),
    'D:\\Riot Games\\League of Legends',
    'E:\\Riot Games\\League of Legends',
  ];
}

async function findGameExe() {
  const ux = await processPath('LeagueClientUx');
  if (ux) {
    const exe = path.join(path.dirname(ux), 'Game', 'League of Legends.exe');
    if (fs.existsSync(exe)) return exe;
  }
  for (const root of guessRoots()) {
    const exe = path.join(root, 'Game', 'League of Legends.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return '';
}

function spawnSpectate(game) {
  return findGameExe().then((exe) => {
    if (!exe) return { ok: false, error: 'Could not find League of Legends.exe.' };
    const platformId = String(game.platformId || '').toUpperCase();
    const host = SPECTATE_HOST[platformId] || `spectator.${String(game.rawPlatform || platformId).toLowerCase()}.lol.pvp.net:8080`;
    const arg = `spectator ${host} ${game.encryptionKey} ${game.gameId} ${platformId}`;
    const child = spawn(exe, [arg], {
      cwd: path.dirname(exe),
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();
    return { ok: true, via: 'exe' };
  });
}

function register(ipcMain, { riotFetch }) {
  const scanner = createScanner({ riotFetch });
  const inflight = new Map();

  async function list(args = {}) {
    const platforms = scanner.pickPlatforms(args.platforms || args.platform || '');
    const key = platforms.slice().sort().join(',');
    const force = !!args.force;

    try {
      const remote = await fetchProxyList(platforms);
      if (remote && Array.isArray(remote.games)) {
        scanner.ingest(remote);
        if (!force) {
          return {
            ...remote,
            games: scanner.snapshot(platforms).games,
            source: remote.source || 'proxy',
          };
        }
      }
    } catch {
      /* old proxy or offline — scan from this app */
    }

    const snap = scanner.snapshot(platforms);
    const stale = force || !snap.updatedAt || Date.now() - snap.updatedAt > 75000;
    if (stale) {
      if (!inflight.has(key)) {
        inflight.set(key, scanner.refresh(platforms).finally(() => inflight.delete(key)));
      }
      if (!snap.games?.length) {
        try {
          return await inflight.get(key);
        } catch (err) {
          return { ok: false, games: [], error: err.message || 'Could not load live games.', scanning: false };
        }
      }
      return { ...snap, scanning: true };
    }
    return snap;
  }

  async function launch(args = {}) {
    const gameId = String(args.gameId || '');
    const platformId = String(args.platformId || '').toUpperCase();
    const packed = scanner.getLaunch(platformId, gameId);
    if (!packed?.encryptionKey) {
      return { ok: false, error: 'That game is no longer in the live list. Refresh, then try again.' };
    }
    const viaLcu = await lcu.launchSpectate(packed);
    if (viaLcu.ok) return viaLcu;
    if (viaLcu.reason === 'busy' || viaLcu.reason === 'no-client') return viaLcu;
    try {
      const spawned = await spawnSpectate(packed);
      if (spawned.ok) return spawned;
      return { ok: false, error: viaLcu.error || spawned.error };
    } catch (err) {
      return { ok: false, error: viaLcu.error || err.message || 'Could not start spectator.' };
    }
  }

  ipcMain.handle('spectate:list', (_e, args) => list(args || {}));
  ipcMain.handle('spectate:launch', (_e, args) => launch(args || {}));
}

module.exports = { register };
