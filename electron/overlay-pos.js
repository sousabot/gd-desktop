const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT = { x: 18, y: 48 };

function filePath() {
  return path.join(app.getPath('userData'), 'overlay-pos.json');
}

function loadPos() {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath(), 'utf8'));
    const x = Number(raw?.x);
    const y = Number(raw?.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x: Math.round(x), y: Math.round(y) };
  } catch { /* first run */ }
  return { ...DEFAULT };
}

function savePos(pos) {
  const x = Number(pos?.x);
  const y = Number(pos?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return loadPos();
  const next = { x: Math.round(x), y: Math.round(y) };
  try { fs.writeFileSync(filePath(), JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

module.exports = { DEFAULT, loadPos, savePos };
