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
const apiUrl = env.RIFT_API_URL || env.GD_API_URL;
const token = env.RIFT_APP_TOKEN || env.GD_APP_TOKEN;
if (!apiUrl) {
  upsert(dest, 'RIFT_API_URL', 'https://gd-desktop.onrender.com');
  console.log('[prepare-client-env] set RIFT_API_URL to the hosted proxy');
} else if (!env.RIFT_API_URL && env.GD_API_URL) {
  upsert(dest, 'RIFT_API_URL', env.GD_API_URL);
}
if (!token) {
  const generated = crypto.randomBytes(24).toString('hex');
  upsert(dest, 'RIFT_APP_TOKEN', generated);
  console.log('[prepare-client-env] generated RIFT_APP_TOKEN. Set the same value on Render:');
  console.log(`  RIFT_APP_TOKEN=${generated}`);
} else if (!env.RIFT_APP_TOKEN && env.GD_APP_TOKEN) {
  upsert(dest, 'RIFT_APP_TOKEN', env.GD_APP_TOKEN);
}
