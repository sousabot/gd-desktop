const WEBHOOK_RE = /^https:\/\/(?:[\w.-]+\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/i;

function clip(value, max) {
  return String(value || '').trim().slice(0, max);
}

module.exports = function registerFeedbackHandlers(ipcMain) {
  try { ipcMain.removeHandler('app:sendFeedback'); } catch { /* first register */ }
  ipcMain.handle('app:sendFeedback', async (_e, payload = {}) => {
    const webhook = String(process.env.DISCORD_WEBHOOK_URL || '').trim();
    if (!webhook) {
      throw new Error('Add DISCORD_WEBHOOK_URL to .env, then restart the app.');
    }
    if (!WEBHOOK_RE.test(webhook)) {
      throw new Error('DISCORD_WEBHOOK_URL in .env is not a valid Discord webhook.');
    }

    const kind = payload.kind === 'feedback' ? 'Feedback' : 'Bug';
    const title = clip(payload.title, 120);
    const message = clip(payload.message, 1800);
    if (!title || !message) {
      throw new Error('Title and details are required.');
    }

    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'GD Desktop',
        embeds: [{
          title: `${kind}: ${title}`,
          description: message,
          color: kind === 'Bug' ? 0xff5c68 : 0x7c5cff,
          fields: [
            { name: 'Type', value: kind, inline: true },
            { name: 'Riot ID', value: clip(payload.riotId, 80) || 'Not linked', inline: true },
            { name: 'Page', value: clip(payload.page, 80) || '/', inline: true },
            { name: 'Contact', value: clip(payload.contact, 80) || '—', inline: true },
            { name: 'App', value: clip(payload.appVersion, 40) || '0.1.0', inline: true },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Discord webhook failed (${res.status}). ${body.slice(0, 180)}`);
    }
    return { ok: true };
  });
};
