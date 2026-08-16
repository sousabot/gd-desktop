const { spawn } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, 'edit-hotkey.ps1');

let child = null;
let onHotkey = null;
let stopping = false;
let restartTimer = null;

function start(cb) {
  onHotkey = cb;
  if (process.platform !== 'win32') return;
  stopping = false;
  if (child) return;

  child = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', SCRIPT,
  ], { windowsHide: true });

  let buf = '';
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || '';
    for (const line of lines) {
      if (String(line).trim() !== 'HOTKEY') continue;
      try { onHotkey?.(); } catch { /* ignore */ }
    }
  });
  child.stderr.on('data', () => { /* compile noise */ });
  child.on('exit', () => {
    child = null;
    if (stopping) return;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      start(onHotkey);
    }, 800);
  });
}

function stop() {
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

module.exports = { start, stop };
