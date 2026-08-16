const { BrowserWindow, globalShortcut } = require('electron');
const desktop = require('./desktop-overlay');
const ow = require('./ow-overlay');
const { loadPos, savePos } = require('./overlay-pos');
const editHotkey = require('./edit-hotkey');

const EDIT_ACCEL = 'CommandOrControl+B';
const ENABLED = false;

let electronApp = null;
let lastVideo = null;
let clickThrough = true;
let editing = false;
let lastToggleAt = 0;

function usingOverwolf() {
  return ow.isAvailable();
}

function emitEdit() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try { win.webContents.send('overlay:editMode', editing); } catch { /* ignore */ }
  }
}

function applyInputMode() {
  const through = clickThrough && !editing;
  ow.setClickThrough(through);
  desktop.setClickThrough(through);
}

function syncDesktopHotkey() {
  try { globalShortcut.unregister(EDIT_ACCEL); } catch { /* ignore */ }
  if (!isOverlayOpen() || ow.isInjected()) return;
  try {
    globalShortcut.register(EDIT_ACCEL, () => {
      if (isOverlayOpen()) toggleEditMode();
    });
  } catch (err) {
    console.warn('[overlay] desktop Ctrl+B failed', err?.message || err);
  }
}

function persistPosition() {
  const pos = ow.isInjected() ? ow.getPosition() : desktop.captureInset();
  if (!pos) return;
  const saved = savePos(pos);
  desktop.setInset(saved);
}

function toggleEditMode(force) {
  if (!isOverlayOpen() && force !== false) return editing;
  const now = Date.now();
  if (typeof force !== 'boolean' && now - lastToggleAt < 320) return editing;
  if (typeof force !== 'boolean') lastToggleAt = now;
  editing = typeof force === 'boolean' ? force : !editing;
  desktop.setEditing(editing);
  ow.setEditing(editing);
  applyInputMode();
  if (!editing) persistPosition();
  emitEdit();
  return editing;
}

function init(app) {
  electronApp = app;
  if (!ENABLED) return;
  desktop.setInset(loadPos());
  ow.init(app);
  ow.onEditHotkey(() => toggleEditMode());
  ow.onStatus((status) => {
    if (status.injected && ow.isWanted()) {
      desktop.closeOverlayWindow();
    }
    syncDesktopHotkey();
  });
}

function startEditHotkeys() {
  editHotkey.start(() => {
    if (isOverlayOpen()) toggleEditMode();
  });
  syncDesktopHotkey();
}

function createOverlayWindow(app, video) {
  if (!ENABLED) return { open: false, disabled: true };
  electronApp = app;
  if (video) lastVideo = video;
  ow.setWanted(true);
  if (ow.isInjected()) {
    desktop.closeOverlayWindow();
    startEditHotkeys();
    return { open: true, engine: 'overwolf' };
  }
  const win = desktop.createOverlayWindow(app, video);
  startEditHotkeys();
  return win;
}

function closeOverlayWindow() {
  if (editing) toggleEditMode(false);
  ow.setWanted(false);
  ow.closeInGameWindow();
  desktop.closeOverlayWindow();
  editHotkey.stop();
  syncDesktopHotkey();
}

function isOverlayOpen() {
  if (!ENABLED) return false;
  return ow.isWanted() || desktop.isOverlayOpen() || ow.isOpen();
}

function setClickThrough(next) {
  clickThrough = !!next;
  applyInputMode();
  return clickThrough;
}

function getClickThrough() {
  return clickThrough;
}

function setIgnoreMouse(ignore) {
  if (editing) {
    if (ow.isInjected()) ow.setIgnoreMouse(false);
    else desktop.setIgnoreMouse(false);
    return;
  }
  if (ow.isInjected()) ow.setIgnoreMouse(ignore);
  else desktop.setIgnoreMouse(ignore);
}

function startDrag(sender) {
  if (!editing) return;
  if (ow.isInjected()) ow.startDrag(sender);
}

function isAttached() {
  return ow.isInjected() || desktop.isAttached();
}

function getLastVideo() {
  return lastVideo;
}

function getStatus() {
  if (!ENABLED) return { engine: 'off', ready: false, wanted: false, injected: false, phase: 'disabled' };
  return ow.getStatus();
}

function isEditing() {
  return editing;
}

function unregisterHotkeys() {
  editHotkey.stop();
  try { globalShortcut.unregister(EDIT_ACCEL); } catch { /* ignore */ }
}

module.exports = {
  ENABLED,
  isEnabled: () => ENABLED,
  init,
  usingOverwolf,
  createOverlayWindow,
  closeOverlayWindow,
  isOverlayOpen,
  setClickThrough,
  getClickThrough,
  setIgnoreMouse,
  startDrag,
  toggleEditMode,
  isEditing,
  isAttached,
  getLastVideo,
  getStatus,
  unregisterHotkeys,
};
