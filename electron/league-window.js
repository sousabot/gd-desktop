const { spawn } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, 'find-league.ps1');

let child = null;
let latest = null;
let stopping = false;
let restartTimer = null;

function parseLine(line) {
  const parts = String(line || '').trim().split(/\s+/).map(Number);
  if (parts.length < 6 || parts.some((n) => !Number.isFinite(n))) return null;
  const [left, top, right, bottom, focused, running] = parts;
  const width = right - left;
  const height = bottom - top;
  return {
    x: left,
    y: top,
    width,
    height,
    focused: focused === 1,
    running: running === 1,
    hasRect: width >= 200 && height >= 200,
  };
}

function stopLeagueWatcher() {
  stopping = true;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (child) {
    try { child.kill(); } catch { /* ignore */ }
    child = null;
  }
}

function startLeagueWatcher() {
  if (process.platform !== 'win32') return;
  stopping = false;
  if (child) return;

  child = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', SCRIPT,
    '-GdPid', String(process.pid),
  ], { windowsHide: true });

  let buf = '';
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || '';
    for (const line of lines) {
      const parsed = parseLine(line);
      if (parsed) latest = parsed;
    }
  });
  child.stderr.on('data', () => { /* ignore compile noise */ });
  child.on('exit', () => {
    child = null;
    if (stopping) return;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      startLeagueWatcher();
    }, 800);
  });
}

function getLeagueBounds() {
  startLeagueWatcher();
  return Promise.resolve(latest);
}

module.exports = { getLeagueBounds, startLeagueWatcher, stopLeagueWatcher };
