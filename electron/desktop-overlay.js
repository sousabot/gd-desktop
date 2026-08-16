const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { getLeagueBounds, startLeagueWatcher, stopLeagueWatcher } = require('./league-window');
const { loadPos } = require('./overlay-pos');

const OVERLAY_W = 252;
const OVERLAY_H = 336;

let overlayWindow = null;
let clickThrough = true;
let editing = false;
let inset = null;
let lastTarget = null;
let followTimer = null;
let lastPos = '';
let attached = false;
let lastVideo = null;

function sendVideo(video) {
  if (video) lastVideo = video;
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  try { overlayWindow.webContents.send('overlay:video', lastVideo); } catch { /* ignore */ }
}

function overlayUrl(app) {
  if (app.isPackaged) {
    return { file: path.join(__dirname, '..', 'dist', 'index.html'), hash: '/overlay' };
  }
  return { url: 'http://localhost:5173/#/overlay' };
}

function applyClickThrough() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (editing || !clickThrough) overlayWindow.setIgnoreMouseEvents(false);
  else overlayWindow.setIgnoreMouseEvents(true, { forward: true });
}

function setInset(next) {
  const x = Number(next?.x);
  const y = Number(next?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return getInset();
  inset = { x: Math.round(x), y: Math.round(y) };
  lastPos = '';
  return getInset();
}

function getInset() {
  if (!inset) inset = loadPos();
  return { x: inset.x, y: inset.y };
}

function setEditing(on) {
  editing = !!on;
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  applyClickThrough();
  try { overlayWindow.setMovable(true); } catch { /* ignore */ }
  if (editing) {
    try { overlayWindow.focus(); } catch { /* ignore */ }
  }
}

function captureInset() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return getInset();
  const b = overlayWindow.getBounds();
  const originSrc = lastTarget || screen.getPrimaryDisplay().bounds;
  const origin = toDip(originSrc.x, originSrc.y);
  return setInset({ x: b.x - origin.x, y: b.y - origin.y });
}

function toDip(x, y) {
  if (typeof screen.screenToDipPoint === 'function') {
    return screen.screenToDipPoint({ x, y });
  }
  const d = screen.getDisplayNearestPoint({ x, y });
  const s = d.scaleFactor || 1;
  return { x: x / s, y: y / s };
}

function hideOverlay() {
  attached = false;
  lastPos = '';
  if (overlayWindow.isVisible()) overlayWindow.hide();
  try { overlayWindow.webContents.send('overlay:attached', false); } catch { /* ignore */ }
}

function pinToLeague(bounds) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;

  const leagueFocused = !!bounds?.focused;
  const gameRunning = !!bounds?.running;
  const hasGame = !!(bounds?.hasRect && gameRunning);
  const dragging = editing && overlayWindow.isFocused();

  // Only sit on the League game window. Hide over Cursor, Chrome, the client, etc.
  if (!leagueFocused && !dragging) {
    hideOverlay();
    return;
  }

  const target = hasGame
    ? bounds
    : (lastTarget || screen.getPrimaryDisplay().bounds);

  lastTarget = target;
  attached = hasGame;
  try { overlayWindow.webContents.send('overlay:attached', attached); } catch { /* ignore */ }
  if (!overlayWindow.isVisible()) overlayWindow.showInactive();
  if (editing) {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    return;
  }
  const origin = toDip(target.x, target.y);
  const pos = getInset();
  const x = Math.round(origin.x + pos.x);
  const y = Math.round(origin.y + pos.y);
  const key = `${x},${y}`;
  if (key === lastPos) {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    return;
  }
  lastPos = key;
  overlayWindow.setBounds({ x, y, width: OVERLAY_W, height: OVERLAY_H }, false);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
}

function startFollow() {
  if (followTimer) clearInterval(followTimer);
  startLeagueWatcher();
  const tick = async () => {
    const bounds = await getLeagueBounds();
    pinToLeague(bounds);
  };
  tick();
  followTimer = setInterval(tick, 400);
}

function stopFollow() {
  if (followTimer) clearInterval(followTimer);
  followTimer = null;
  lastPos = '';
  attached = false;
}

function createOverlayWindow(app, video) {
  if (video) lastVideo = video;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    sendVideo(lastVideo);
    startFollow();
    return overlayWindow;
  }

  overlayWindow = new BrowserWindow({
    width: OVERLAY_W,
    height: OVERLAY_H,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    focusable: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setMenuBarVisibility(false);

  const target = overlayUrl(app);
  if (target.file) overlayWindow.loadFile(target.file, { hash: target.hash });
  else overlayWindow.loadURL(target.url);

  overlayWindow.once('ready-to-show', () => {
    applyClickThrough();
    sendVideo(lastVideo);
    startFollow();
  });
  overlayWindow.on('moved', () => {
    if (editing) captureInset();
  });
  overlayWindow.on('closed', () => {
    stopFollow();
    stopLeagueWatcher();
    overlayWindow = null;
    editing = false;
  });
  return overlayWindow;
}

function closeOverlayWindow() {
  stopFollow();
  stopLeagueWatcher();
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
  overlayWindow = null;
}

function isOverlayOpen() {
  return !!(overlayWindow && !overlayWindow.isDestroyed());
}

function setClickThrough(next) {
  clickThrough = !!next;
  applyClickThrough();
  return clickThrough;
}

function getClickThrough() {
  return clickThrough;
}

function setIgnoreMouse(ignore) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (editing || !clickThrough) {
    overlayWindow.setIgnoreMouseEvents(false);
    return;
  }
  if (ignore) overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  else overlayWindow.setIgnoreMouseEvents(false);
}

module.exports = {
  createOverlayWindow,
  closeOverlayWindow,
  isOverlayOpen,
  setClickThrough,
  getClickThrough,
  setIgnoreMouse,
  setEditing,
  setInset,
  getInset,
  captureInset,
  isAttached: () => attached,
  getLastVideo: () => lastVideo,
};
