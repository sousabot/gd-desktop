const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const MODE = { 0: 'Fullscreen', 1: 'Borderless', 2: 'Windowed' };

function guessCfgPaths() {
  const roots = [
    'C:\\Riot Games\\League of Legends',
    path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Riot Games', 'League of Legends'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Riot Games', 'League of Legends'),
    'D:\\Riot Games\\League of Legends',
    'E:\\Riot Games\\League of Legends',
  ];
  return roots.map((root) => path.join(root, 'Config', 'game.cfg'));
}

function cfgFromExe(exePath) {
  if (!exePath) return null;
  const dir = path.dirname(exePath);
  const name = path.basename(dir).toLowerCase();
  if (name === 'game') return path.join(path.dirname(dir), 'Config', 'game.cfg');
  return path.join(dir, 'Config', 'game.cfg');
}

function processExePath(processName) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(null);
      return;
    }
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-Command',
      `(Get-Process -Name '${processName}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)`,
    ], { windowsHide: true, timeout: 2500 }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      resolve(String(stdout || '').trim() || null);
    });
  });
}

async function findGameExe() {
  return processExePath('League of Legends');
}

function parseCompatFlags(raw) {
  return String(raw || '')
    .replace(/^~/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function queryCompatFlags(exePath) {
  return new Promise((resolve) => {
    execFile('reg.exe', [
      'query',
      'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers',
      '/v', exePath,
    ], { windowsHide: true, timeout: 2500 }, (err, stdout) => {
      if (err) {
        resolve([]);
        return;
      }
      const line = String(stdout || '').split(/\r?\n/).find((l) => /REG_SZ/i.test(l)) || '';
      const idx = line.lastIndexOf('REG_SZ');
      resolve(parseCompatFlags(idx >= 0 ? line.slice(idx + 6) : ''));
    });
  });
}

function writeCompatFlags(exePath, flags) {
  const data = flags.length ? `~ ${flags.join(' ')}` : '~';
  return new Promise((resolve, reject) => {
    execFile('reg.exe', [
      'add',
      'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers',
      '/v', exePath,
      '/t', 'REG_SZ',
      '/d', data,
      '/f',
    ], { windowsHide: true, timeout: 2500 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function enableFullscreenOptimizations() {
  const exePath = await findGameExe();
  if (!exePath) return { ok: false, reason: 'League of Legends.exe is not running' };
  const flags = await queryCompatFlags(exePath);
  const had = flags.includes('DISABLEDXMAXIMIZEDWINDOWEDMODE');
  if (!had) return { ok: true, changed: false, exePath };
  const next = flags.filter((f) => f !== 'DISABLEDXMAXIMIZEDWINDOWEDMODE');
  await writeCompatFlags(exePath, next);
  return { ok: true, changed: true, restartGame: true, exePath };
}

async function findGameCfg() {
  const exeNames = ['League of Legends', 'LeagueClientUx', 'LeagueClient'];
  for (const name of exeNames) {
    const exe = await processExePath(name);
    const cfg = cfgFromExe(exe);
    if (cfg && fs.existsSync(cfg)) return cfg;
  }
  return guessCfgPaths().find((p) => fs.existsSync(p)) || null;
}

function parseWindowMode(text) {
  const m = String(text || '').match(/WindowMode\s*=\s*(\d+)/i);
  if (!m) return null;
  return Number(m[1]);
}

function writeWindowMode(text, mode) {
  if (/WindowMode\s*=/i.test(text)) {
    return text.replace(/WindowMode\s*=\s*\d+/i, `WindowMode=${mode}`);
  }
  if (/\[General\]/i.test(text)) {
    return text.replace(/\[General\]/i, `[General]\nWindowMode=${mode}`);
  }
  return `[General]\nWindowMode=${mode}\n${text}`;
}

async function getVideoMode() {
  const cfgPath = await findGameCfg();
  if (!cfgPath) return { cfgPath: null, mode: null, label: 'Unknown' };
  const text = fs.readFileSync(cfgPath, 'utf8');
  const mode = parseWindowMode(text);
  return { cfgPath, mode, label: MODE[mode] || 'Unknown' };
}

async function ensureBorderless() {
  const cfgPath = await findGameCfg();
  if (!cfgPath) {
    return { ok: false, switched: false, reason: 'Could not find League Config\\game.cfg' };
  }
  const text = fs.readFileSync(cfgPath, 'utf8');
  const before = parseWindowMode(text);
  if (before === 1) {
    return { ok: true, switched: false, mode: 1, label: 'Borderless', cfgPath };
  }
  const next = writeWindowMode(text, 1);
  fs.writeFileSync(cfgPath, next);
  return {
    ok: true,
    switched: before === 0 || before === 2 || before == null,
    from: MODE[before] || 'Unknown',
    mode: 1,
    label: 'Borderless',
    cfgPath,
    applyNow: before === 0,
  };
}

module.exports = { getVideoMode, ensureBorderless, enableFullscreenOptimizations, MODE };
