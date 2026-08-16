const fs = require('fs');
const path = require('path');

const REC = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-rune-recommendations.json';
const SUM = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json';
const POS = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support' };

async function main() {
  const [rec, sum] = await Promise.all([
    fetch(REC).then((r) => r.json()),
    fetch(SUM).then((r) => r.json()),
  ]);
  const champs = (Array.isArray(sum) ? sum : Object.values(sum))
    .filter((c) => c && c.id > 0 && c.alias && !String(c.alias).startsWith('Jade_'));
  const recBy = new Map(rec.map((r) => [r.championId, r]));
  const out = {};
  for (const c of champs) {
    const row = recBy.get(c.id);
    if (!row) continue;
    const byRole = {};
    for (const p of row.runeRecommendations || []) {
      if (p.mapId !== 11) continue;
      const role = POS[p.position];
      if (!role) continue;
      if (!byRole[role]) byRole[role] = [];
      byRole[role].push({
        p: p.primaryPerkStyleId,
        s: p.secondaryPerkStyleId,
        k: (p.perkIds || []).slice(0, 9),
        sp: p.summonerSpellIds || [4, 14],
      });
    }
    if (Object.keys(byRole).length) out[c.alias] = byRole;
  }
  const dest = path.join(__dirname, '..', 'src', 'data', 'runePages.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out));
  console.log('wrote', dest, Object.keys(out).length, 'champs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
