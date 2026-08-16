const { app, ipcMain, shell } = require('electron');

const REPO = { owner: 'sousabot', repo: 'gd-desktop' };
const RELEASES_API = `https://api.github.com/repos/${REPO.owner}/${REPO.repo}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO.owner}/${REPO.repo}/releases/latest`;
const CHECK_MS = 4 * 60 * 60 * 1000;

function isPortable() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
}

function parseVer(raw) {
  return String(raw || '').replace(/^v/i, '').trim();
}

function isNewer(remote, local) {
  const a = parseVer(remote).split('.').map((n) => Number(n) || 0);
  const b = parseVer(local).split('.').map((n) => Number(n) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

function info() {
  return {
    version: app.getVersion(),
    portable: isPortable(),
    packaged: app.isPackaged,
  };
}

async function latestGithubRelease() {
  const res = await fetch(RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'gd-esports-desktop' },
  });
  if (!res.ok) throw new Error(`GitHub releases ${res.status}`);
  const data = await res.json();
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const setup = assets.find((a) => /setup/i.test(a.name) && /\.exe$/i.test(a.name));
  const portable = assets.find((a) => /portable/i.test(a.name) && /\.exe$/i.test(a.name));
  return {
    version: parseVer(data.tag_name || data.name),
    url: data.html_url || RELEASES_PAGE,
    setupUrl: setup?.browser_download_url || null,
    portableUrl: portable?.browser_download_url || null,
  };
}

function register({ getWindow, prepareQuit }) {
  let last = {
    state: app.isPackaged ? 'idle' : 'dev',
    version: app.getVersion(),
    portable: isPortable(),
  };

  const send = (payload) => {
    last = { ...last, ...payload, version: payload.version || last.version, portable: isPortable() };
    const win = getWindow?.();
    if (win && !win.isDestroyed()) win.webContents.send('update:status', last);
  };

  try { ipcMain.removeHandler('app:info'); } catch { /* first */ }
  try { ipcMain.removeHandler('update:status'); } catch { /* first */ }
  try { ipcMain.removeHandler('update:check'); } catch { /* first */ }
  try { ipcMain.removeHandler('update:install'); } catch { /* first */ }
  try { ipcMain.removeHandler('update:open'); } catch { /* first */ }

  ipcMain.handle('app:info', () => info());
  ipcMain.handle('update:status', () => last);
  ipcMain.handle('update:open', async (_e, url) => {
    await shell.openExternal(url || last.url || RELEASES_PAGE);
    return { ok: true };
  });

  if (!app.isPackaged) {
    ipcMain.handle('update:check', async () => last);
    ipcMain.handle('update:install', () => ({ ok: false, error: 'Dev build.' }));
    return;
  }

  if (isPortable()) {
    const checkPortable = async () => {
      send({ state: 'checking', version: app.getVersion() });
      try {
        const remote = await latestGithubRelease();
        if (isNewer(remote.version, app.getVersion())) {
          send({
            state: 'available',
            version: remote.version,
            current: app.getVersion(),
            url: remote.url,
            setupUrl: remote.setupUrl,
            portableUrl: remote.portableUrl,
            portable: true,
          });
        } else {
          send({ state: 'current', version: app.getVersion() });
        }
      } catch (err) {
        send({ state: 'error', message: err.message || 'Could not check for updates.' });
      }
      return last;
    };
    ipcMain.handle('update:check', () => checkPortable());
    ipcMain.handle('update:install', async () => {
      await shell.openExternal(last.setupUrl || last.url || RELEASES_PAGE);
      return { ok: true, portable: true };
    });
    setTimeout(() => { checkPortable().catch(() => {}); }, 5000);
    setInterval(() => { checkPortable().catch(() => {}); }, CHECK_MS);
    return;
  }

  let updater;
  try {
    updater = require('electron-updater').autoUpdater;
  } catch (err) {
    send({ state: 'error', message: err.message || 'Updater missing.' });
    ipcMain.handle('update:check', async () => last);
    ipcMain.handle('update:install', () => ({ ok: false }));
    return;
  }

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.allowPrerelease = false;
  updater.setFeedURL({ provider: 'github', owner: REPO.owner, repo: REPO.repo });

  updater.on('checking-for-update', () => send({ state: 'checking', version: app.getVersion() }));
  updater.on('update-available', (info) => send({
    state: 'available',
    version: info.version,
    current: app.getVersion(),
  }));
  updater.on('update-not-available', () => send({ state: 'current', version: app.getVersion() }));
  updater.on('download-progress', (progress) => send({
    state: 'downloading',
    percent: Math.round(progress.percent || 0),
    version: last.version,
  }));
  updater.on('update-downloaded', (info) => send({
    state: 'ready',
    version: info.version,
    current: app.getVersion(),
  }));
  updater.on('error', (err) => send({
    state: 'error',
    message: err?.message || 'Update failed.',
  }));

  const check = async () => {
    try {
      await updater.checkForUpdates();
    } catch (err) {
      send({ state: 'error', message: err.message || 'Could not check for updates.' });
    }
    return last;
  };

  ipcMain.handle('update:check', () => check());
  ipcMain.handle('update:install', () => {
    prepareQuit?.();
    updater.quitAndInstall(false, true);
    return { ok: true };
  });

  setTimeout(() => { check().catch(() => {}); }, 5000);
  setInterval(() => { check().catch(() => {}); }, CHECK_MS);
}

module.exports = { register, info };
