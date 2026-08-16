// Runs in the Electron MAIN process. Match and timeline data for a completed
// game never changes, so this cache has no TTL — once fetched, a matchId is
// cached forever (capped at MAX_ENTRIES to keep the file from growing
// unbounded across many different players tested over time).

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_ENTRIES = 1200;

function cachePath() {
  return path.join(app.getPath('userData'), 'match-cache.json');
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(cachePath(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeCache(data) {
  const keys = Object.keys(data);
  if (keys.length > MAX_ENTRIES) {
    // Cheap eviction: drop the oldest-inserted entries beyond the cap.
    for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete data[k];
  }
  fs.writeFileSync(cachePath(), JSON.stringify(data));
}

module.exports = { readCache, writeCache };