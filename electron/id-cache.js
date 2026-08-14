// Runs in the Electron MAIN process. Caches puuid -> {gameName, tagLine} and
// puuid -> {profileIconId} lookups on disk so repeat page loads (the
// leaderboard especially) don't re-resolve the same 20-50 players every
// single time and burn through Riot's rate limit for no reason.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const TTL_MS = 24 * 60 * 60 * 1000; // Riot IDs and profile icons rarely change day to day

function cachePath() {
  return path.join(app.getPath('userData'), 'puuid-cache.json');
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(cachePath(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeCache(data) {
  fs.writeFileSync(cachePath(), JSON.stringify(data, null, 2));
}

module.exports = { readCache, writeCache, TTL_MS };