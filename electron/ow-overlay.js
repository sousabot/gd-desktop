const { app, BrowserWindow } = require('electron');
const path = require('path');
const { loadPos } = require('./overlay-pos');

// League of Legends (game process). Launcher is 10902 — we dismiss that.
const LOL_GAME_ID = 5426;
const OVERLAY_NAME = 'gd-benchmark';
const EDIT_HOTKEY = 'gd-edit-overlay';
const OVERLAY_W = 252;
const OVERLAY_H = 336;

let electronApp = null;
let api = null;
let ready = false;
let wanted = false;
let injected = false;
let overlayWin = null;
let clickThrough = true;
let editing = false;
let editHotkeyCb = null;
let lastError = '';
let lastGameName = '';
let statusCb = null;
let starting = false;
let packagePhase = 'idle';
let pollTimer = null;

function overlayUrl() {
  const host = electronApp || app;
  if (host.isPackaged) {
    return { file: path.join(__dirname, '..', 'dist', 'index.html'), hash: '/overlay' };
  }
  return { url: 'http://localhost:5173/#/overlay' };
}

function emitStatus() {
  const status = getStatus();
  try { statusCb?.(status); } catch { /* ignore */ }
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try { win.webContents.send('overlay:status', status); } catch { /* ignore */ }
    try { win.webContents.send('overlay:attached', !!injected); } catch { /* ignore */ }
  }
}

function getBrowserWindow() {
  return overlayWin?.window || null;
}

function applyPassthrough() {
  if (!overlayWin) return;
  const through = clickThrough && !editing;
  try {
    overlayWin.overlayOptions.passthrough = through ? 'passThrough' : 'noPassThrough';
    overlayWin.overlayOptions.ignoreKeyboardInput = !editing;
  } catch { /* ignore */ }
}

function setEditing(on) {
  editing = !!on;
  applyPassthrough();
  const win = getBrowserWindow();
  if (win && !win.isDestroyed() && editing) {
    try { win.focus(); } catch { /* ignore */ }
  }
}

function getPosition() {
  const win = getBrowserWindow();
  if (!win || win.isDestroyed()) return null;
  const b = win.getBounds();
  return { x: Math.round(b.x), y: Math.round(b.y) };
}

function startDrag(sender) {
  if (!editing) return;
  const target = (sender && api?.fromWebContents?.(sender)) || overlayWin;
  if (!target?.startDragging) return;
  try { target.startDragging(); } catch { /* ignore */ }
}

function syncEditHotkey() {
  if (!api?.hotkeys) return;
  try { api.hotkeys.unregister?.(EDIT_HOTKEY); } catch { /* ignore */ }
  if (!wanted || !editHotkeyCb) return;
  const onHotkey = (_hotkey, state) => {
    if (state === 'pressed') editHotkeyCb();
  };
  try {
    api.hotkeys.register({
      name: EDIT_HOTKEY,
      keyCode: 'KeyB',
      modifiers: { ctrl: true },
      passthrough: false,
    }, onHotkey);
  } catch {
    try {
      api.hotkeys.register({
        name: EDIT_HOTKEY,
        keyCode: 66,
        modifiers: { ctrl: true },
        passthrough: false,
      }, onHotkey);
    } catch (err) {
      console.warn('[overlay] Ctrl+B hotkey failed', err?.message || err);
    }
  }
}

function onEditHotkey(cb) {
  editHotkeyCb = cb;
  syncEditHotkey();
}

async function createInGameWindow() {
  if (!api || !wanted) return;
  const existing = api.getAllWindows?.()?.find((w) => w.name === OVERLAY_NAME);
  if (existing) {
    overlayWin = existing;
    try { existing.window.show(); } catch { /* ignore */ }
    applyPassthrough();
    emitStatus();
    return;
  }

  const pos = loadPos();
  overlayWin = await api.createWindow({
    name: OVERLAY_NAME,
    width: OVERLAY_W,
    height: OVERLAY_H,
    x: pos.x,
    y: pos.y,
    show: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    passthrough: (clickThrough && !editing) ? 'passThrough' : 'noPassThrough',
    ignoreKeyboardInput: !editing,
    strictToGameWindow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const win = overlayWin.window;
  const target = overlayUrl();
  if (target.file) await win.loadFile(target.file, { hash: target.hash });
  else await win.loadURL(target.url);
  win.show();
  applyPassthrough();
  win.on('closed', () => {
    overlayWin = null;
  });
  emitStatus();
}

function closeInGameWindow() {
  if (!overlayWin) return;
  try { overlayWin.window.close(); } catch { /* ignore */ }
  overlayWin = null;
}

function isLolGame(gameInfo) {
  const id = Number(gameInfo?.id);
  const classId = Number(gameInfo?.classId);
  const name = String(gameInfo?.name || '');
  return id === LOL_GAME_ID
    || classId === LOL_GAME_ID
    || classId === 54261
    || /league of legends/i.test(name);
}

async function handleGameLaunched(event, gameInfo) {
  console.log('[overlay] game-launched', gameInfo?.id, gameInfo?.classId, gameInfo?.name, gameInfo?.type, 'wanted=', wanted);
  if (!wanted) {
    event.dismiss();
    return;
  }
  if (gameInfo?.type && gameInfo.type !== 'Game') {
    event.dismiss();
    return;
  }
  if (gameInfo && !isLolGame(gameInfo) && gameInfo.supported !== true) {
    event.dismiss();
    return;
  }
  try {
    if (gameInfo?.processInfo?.isElevated && api.installHighElevationHelper) {
      const installed = await api.isHighElevationHelperInstalled?.();
      if (!installed) await api.installHighElevationHelper();
    }
    lastError = '';
    event.inject();
  } catch (err) {
    lastError = err?.message || String(err);
    emitStatus();
    event.dismiss();
  }
}

function bindEvents() {
  api.removeAllListeners?.();
  api.on('game-launched', (event, gameInfo) => {
    handleGameLaunched(event, gameInfo).catch((err) => {
      lastError = err?.message || String(err);
      emitStatus();
      try { event.dismiss(); } catch { /* ignore */ }
    });
  });
  api.on('game-injected', (gameInfo) => {
    injected = true;
    lastError = '';
    lastGameName = gameInfo?.name || 'League of Legends';
    console.log('[overlay] injected into', lastGameName);
    createInGameWindow().then(emitStatus);
  });
  api.on('game-injection-error', (_gameInfo, error) => {
    injected = false;
    lastError = String(error || 'injection failed');
    console.warn('[overlay] injection error:', lastError);
    emitStatus();
  });
  api.on('game-exit', () => {
    injected = false;
    closeInGameWindow();
    emitStatus();
  });
  api.on('game-focus-changed', (_window, _game, focus) => {
    const win = getBrowserWindow();
    if (!win || win.isDestroyed()) return;
    try {
      if (focus) win.show();
      else win.hide();
    } catch { /* ignore */ }
  });
}

function onPackageReady() {
  api = app.overwolf?.packages?.overlay || null;
  if (!api || ready) return;
  ready = true;
  packagePhase = 'ready';
  lastError = '';
  bindEvents();
  syncEditHotkey();
  api.registerGames({ gamesIds: [LOL_GAME_ID, 54261], includeUnsupported: true });
  console.log('[overlay] Overwolf overlay package ready, registered LoL', LOL_GAME_ID);
  emitStatus();
  if (wanted) tryInjectExisting();
}

function stringArgs(args) {
  return args
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean);
}

function bindPackageEvents(packages) {
  packages.on('loading', (...args) => {
    packagePhase = 'loading';
    console.log('[overlay] package loading', stringArgs(args));
    emitStatus();
  });
  packages.on('ready', (...args) => {
    console.log('[overlay] package ready event', stringArgs(args));
    packagePhase = 'ready';
    lastError = '';
    if (app.overwolf?.packages?.overlay) onPackageReady();
  });
  packages.on('failed-to-initialize', (...args) => {
    const names = stringArgs(args);
    lastError = `overlay engine failed (${names.join(' ') || 'unknown'})`;
    packagePhase = 'failed';
    console.warn('[overlay] failed-to-initialize', names);
    emitStatus();
  });
  packages.on('crashed', (...args) => {
    lastError = 'overlay engine crashed';
    packagePhase = 'crashed';
    console.warn('[overlay] crashed', args);
    emitStatus();
  });
}

function startPoll() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (ready) {
      clearInterval(pollTimer);
      pollTimer = null;
      return;
    }
    if (app.overwolf?.packages?.overlay) onPackageReady();
  }, 1000);
}

function init(hostApp) {
  electronApp = hostApp || app;
  if (starting) return isAvailable();
  starting = true;
  if (!isAvailable()) {
    lastError = 'not running Overwolf Electron';
    emitStatus();
    return false;
  }
  try { app.overwolf.disableAnonymousAnalytics?.(); } catch { /* ignore */ }
  console.log('[overlay] ow-electron uid', process.env.OVERWOLF_APP_UID || app.overwolf?.uid);
  bindPackageEvents(app.overwolf.packages);
  if (app.overwolf.packages.overlay) onPackageReady();
  startPoll();
  return true;
}

function tryInjectExisting() {
  if (!api?.requestGameInjection) return;
  api.requestGameInjection(LOL_GAME_ID).catch((err) => {
    console.log('[overlay] late inject skipped', err?.message || err);
  });
  api.requestGameInjection(54261).catch(() => { /* ignore */ });
}

function isAvailable() {
  return !!(app.overwolf && app.overwolf.packages);
}

function setWanted(next) {
  wanted = !!next;
  syncEditHotkey();
  if (!wanted) {
    editing = false;
    closeInGameWindow();
    emitStatus();
    return;
  }
  if (ready) {
    if (injected) createInGameWindow();
    else tryInjectExisting();
  }
  emitStatus();
}

function hasOwCreds() {
  return !!(process.env.OW_DEV_KEY || (process.env.OW_CLI_EMAIL && process.env.OW_CLI_API_KEY));
}

function credsHint() {
  if (hasOwCreds()) return '';
  return 'Overwolf blocked the overlay: add OW_CLI_EMAIL and OW_CLI_API_KEY (or OW_DEV_KEY) from https://dev.overwolf.com Profile → API Keys to .env, then restart.';
}

function getStatus() {
  return {
    engine: isAvailable() ? 'overwolf' : 'desktop',
    ready,
    wanted,
    injected,
    phase: packagePhase,
    gameName: lastGameName,
    error: lastError || (!ready ? credsHint() : ''),
    hasCreds: hasOwCreds(),
  };
}

function setClickThrough(next) {
  clickThrough = !!next;
  applyPassthrough();
  return clickThrough;
}

function setIgnoreMouse(ignore) {
  if (!overlayWin) return;
  if (editing || !clickThrough) {
    overlayWin.overlayOptions.passthrough = 'noPassThrough';
    return;
  }
  overlayWin.overlayOptions.passthrough = ignore ? 'passThrough' : 'noPassThrough';
}

module.exports = {
  init,
  isAvailable,
  isReady: () => ready,
  isWanted: () => wanted,
  isInjected: () => injected,
  isOpen: () => !!(getBrowserWindow() && !getBrowserWindow().isDestroyed()),
  setWanted,
  getStatus,
  onStatus: (cb) => { statusCb = cb; },
  onEditHotkey,
  setEditing,
  getPosition,
  startDrag,
  setClickThrough,
  getClickThrough: () => clickThrough,
  setIgnoreMouse,
  closeInGameWindow,
};
