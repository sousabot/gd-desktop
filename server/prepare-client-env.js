const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dest = path.join(__dirname, '..', 'client.env');
const src = path.join(__dirname, '..', 'client.env.example');
if (!fs.existsSync(dest)) {
  fs.copyFileSync(src, dest);
  console.log('[prepare-client-env] created client.env from example');
}

function readEnv(file) {
  const map = {};
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
    const eq = trimmed.indexOf('=');
    map[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  });
  return map;
}

function upsert(file, key, value) {
  const raw = fs.readFileSync(file, 'utf8');
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(raw)) {
    fs.writeFileSync(file, raw.replace(re, `${key}=${value}`));
    return;
  }
  fs.writeFileSync(file, `${raw.replace(/\s*$/, '')}\n${key}=${value}\n`);
}

const env = readEnv(dest);
if (!env.GD_API_URL) {
  upsert(dest, 'GD_API_URL', 'https://gd-desktop.onrender.com');
  console.log('[prepare-client-env] set GD_API_URL to the hosted proxy');
}
if (!env.GD_APP_TOKEN) {
  const token = crypto.randomBytes(24).toString('hex');
  upsert(dest, 'GD_APP_TOKEN', token);
  console.log('[prepare-client-env] generated GD_APP_TOKEN. Set the same value on Render:');
  console.log(`  GD_APP_TOKEN=${token}`);
}
