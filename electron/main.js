const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const registerStatsHandlers = require('./stats-store');
const registerFeedbackHandlers = require('./feedback-ipc');
const overlay = require('./overlay');
const recorder = require('./recorder');
const { getLiveSnapshot, getLiveRoster } = require('./live-client');
const { getVideoMode, ensureBorderless, enableFullscreenOptimizations } = require('./league-config');

try { app.overwolf?.disableAnonymousAnalytics?.(); } catch { /* stock Electron */ }

app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar');
app.setAppUserModelId('com.riftlol.desktop');
recorder.prepare();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow;
let tray = null;
let quitting = false;

function iconPath() {
  return path.join(__dirname, 'icon.png');
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  mainWindow.setSkipTaskbar(false);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  createTray();
  mainWindow.hide();
  mainWindow.setSkipTaskbar(true);
}

function quitApp() {
  quitting = true;
  if (tray) {
    try { tray.destroy(); } catch { /* ignore */ }
    tray = null;
  }
  app.quit();
}

function createTray() {
  if (tray) return;
  let image = nativeImage.createFromPath(iconPath());
  if (image.isEmpty()) image = nativeImage.createEmpty();
  else image = image.resize({ width: 32, height: 32 });
  tray = new Tray(image);
  tray.setToolTip('Rift.lol');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Rift.lol', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Close', click: () => quitApp() },
  ]));
  tray.on('click', () => showMainWindow());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0b0e16',
    icon: path.join(__dirname, 'icon.png'),
    frame: false,
    transparent: false,
    roundedCorners: true,
    hasShadow: true,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.center();
  mainWindow.on('maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
  });
  mainWindow.on('enter-full-screen', () => mainWindow.setFullScreen(false));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    hideToTray();
  });
  mainWindow.on('closed', () => {
    overlay.closeOverlayWindow();
    recorder.destroy();
    mainWindow = null;
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
});
ipcMain.on('window:close', () => hideToTray());
ipcMain.handle('window:isMaximized', () => false);

ipcMain.handle('live:snapshot', () => getLiveSnapshot());
ipcMain.handle('live:roster', () => getLiveRoster());
ipcMain.handle('overlay:open', async () => {
  if (!overlay.isEnabled()) return { open: false, disabled: true };
  if (overlay.usingOverwolf()) {
    overlay.createOverlayWindow(app, { engine: 'overwolf' });
    return { open: true, video: overlay.getStatus() };
  }
  const fso = await enableFullscreenOptimizations().catch((err) => ({ ok: false, reason: err.message }));
  const borderless = await ensureBorderless().catch((err) => ({ ok: false, reason: err.message }));
  const video = {
    ...borderless,
    fso,
    applyNow: !!borderless?.applyNow,
    restartGame: !!fso?.restartGame,
    engine: 'desktop',
  };
  overlay.createOverlayWindow(app, video);
  return { open: true, video };
});
ipcMain.handle('overlay:close', () => {
  overlay.closeOverlayWindow();
  return { open: false };
});
ipcMain.handle('overlay:isOpen', () => overlay.isOverlayOpen());
ipcMain.handle('overlay:getClickThrough', () => overlay.getClickThrough());
ipcMain.handle('overlay:setClickThrough', (_e, value) => overlay.setClickThrough(value));
ipcMain.handle('overlay:attached', () => overlay.isAttached());
ipcMain.handle('overlay:videoHint', () => overlay.getLastVideo());
ipcMain.handle('overlay:status', () => overlay.getStatus());
ipcMain.handle('overlay:videoMode', () => getVideoMode());
ipcMain.handle('overlay:useBorderless', () => ensureBorderless());
ipcMain.on('overlay:ignoreMouse', (_e, ignore) => overlay.setIgnoreMouse(ignore));
ipcMain.handle('overlay:getEditMode', () => overlay.isEditing());
ipcMain.handle('overlay:toggleEdit', () => overlay.toggleEditMode());
ipcMain.on('overlay:startDrag', (e) => overlay.startDrag(e.sender));

app.on('second-instance', () => showMainWindow());

app.whenReady().then(() => {
  if (!gotLock) return;
  overlay.init(app);
  const riotIpc = require('./riot-ipc');
  riotIpc(ipcMain);
  require('./lcu').register(ipcMain);
  require('./probuilds').register(ipcMain);
  require('./spectate').register(ipcMain, { riotFetch: riotIpc.riotFetch });
  registerStatsHandlers(ipcMain);
  registerFeedbackHandlers(ipcMain);
  require('./season-peak')(ipcMain);
  recorder.register(ipcMain);
  require('./updater').register({
    getWindow: () => mainWindow,
    prepareQuit: () => { quitting = true; },
  });
  createTray();
  createWindow();

  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('will-quit', () => {
  overlay.unregisterHotkeys();
  try { globalShortcut.unregisterAll(); } catch { /* ignore */ }
  if (tray) {
    try { tray.destroy(); } catch { /* ignore */ }
    tray = null;
  }
});

app.on('window-all-closed', () => {
  // Stay in the tray. Real exit is tray → Close.
});