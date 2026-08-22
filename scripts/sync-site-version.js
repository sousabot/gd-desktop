#!/usr/bin/env node
/** Sync docs/config.js version from package.json */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const cfgPath = path.join(root, 'docs', 'config.js');
let src = fs.readFileSync(cfgPath, 'utf8');
const next = src.replace(/version:\s*'[^']+'/, `version: '${pkg.version}'`);
if (next === src) {
  console.warn('config.js version line not updated — check format');
} else {
  fs.writeFileSync(cfgPath, next);
  console.log(`docs/config.js → v${pkg.version}`);
}
