const DEFAULT_PROXY = 'https://gd-desktop.onrender.com';

function pickEnv(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function normalizeEnv() {
  if (!process.env.RIFT_API_URL && process.env.GD_API_URL) {
    process.env.RIFT_API_URL = process.env.GD_API_URL;
  }
  if (!process.env.RIFT_APP_TOKEN && process.env.GD_APP_TOKEN) {
    process.env.RIFT_APP_TOKEN = process.env.GD_APP_TOKEN;
  }
  if (!process.env.RIFT_USE_LOCAL_KEY && process.env.GD_USE_LOCAL_KEY) {
    process.env.RIFT_USE_LOCAL_KEY = process.env.GD_USE_LOCAL_KEY;
  }
  if (process.env.RIFT_API_URL) {
    process.env.RIFT_API_URL = String(process.env.RIFT_API_URL).trim().replace(/\/$/, '');
  }
  if (process.env.RIFT_APP_TOKEN) {
    process.env.RIFT_APP_TOKEN = String(process.env.RIFT_APP_TOKEN).trim();
  }
}

function apiUrl() {
  return pickEnv('RIFT_API_URL', 'GD_API_URL').replace(/\/$/, '');
}

function appToken() {
  return pickEnv('RIFT_APP_TOKEN', 'GD_APP_TOKEN');
}

function useLocalKey() {
  return pickEnv('RIFT_USE_LOCAL_KEY', 'GD_USE_LOCAL_KEY') === '1';
}

module.exports = {
  DEFAULT_PROXY,
  pickEnv,
  normalizeEnv,
  apiUrl,
  appToken,
  useLocalKey,
};
