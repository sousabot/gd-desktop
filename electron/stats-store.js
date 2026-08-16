// Runs in the Electron MAIN process. Persists one JSON file in the app's
// userData folder so "vs il y a 1w" deltas survive app restarts.
// Format: { "<riotId>": { timestamp: <ms>, stats: { kda, gdScore, ... } } }

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function storePath() {
  return path.join(app.getPath('userData'), 'stat-snapshots.json');
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeStore(data) {
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2));
}

module.exports = function registerStatsHandlers(ipcMain) {
  ipcMain.handle('stats:getSnapshot', (_e, { riotId }) => {
    const store = readStore();
    return store[riotId] || null;
  });

  ipcMain.handle('stats:saveSnapshot', (_e, { riotId, stats }) => {
    const store = readStore();
    store[riotId] = { timestamp: Date.now(), stats };
    writeStore(store);
    return true;
  });
};