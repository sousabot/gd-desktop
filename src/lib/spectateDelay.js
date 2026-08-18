export const SPECTATE_DELAY_SEC = 180;

export function spectateWaitSec(gameStartTime, now = Date.now()) {
  const start = Number(gameStartTime);
  if (!start) return 0;
  const elapsed = Math.floor((now - start) / 1000);
  return Math.max(0, SPECTATE_DELAY_SEC - elapsed);
}

export function fmtClock(seconds = 0) {
  const n = Math.max(0, Math.floor(seconds));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}
