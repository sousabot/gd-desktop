const KEY = 'gd-recent-ids';
const MAX = 5;

export function readRecentPlayers() {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(rows) ? rows.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberPlayer(riotId) {
  const id = String(riotId || '').trim();
  if (!id || !id.includes('#') || id.toLowerCase().startsWith('unknown')) return;
  const next = [id, ...readRecentPlayers().filter((x) => x.toLowerCase() !== id.toLowerCase())].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
}
