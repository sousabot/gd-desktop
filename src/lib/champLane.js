// Typical solo-queue lane for a champion. Used when match teamPosition is
// missing (rate-limit, ARAM, etc.) so leaderboard/live still have a lane.
export const TYPICAL_LANE = {
  Jinx: 'ADC', Caitlyn: 'ADC', KaiSa: 'ADC', Ashe: 'ADC', Jhin: 'ADC',
  Ezreal: 'ADC', Lucian: 'ADC', Tristana: 'ADC', Vayne: 'ADC', Xayah: 'ADC',
  Aphelios: 'ADC', Zeri: 'ADC', Smolder: 'ADC', MissFortune: 'ADC', Sivir: 'ADC',
  Draven: 'ADC', Kalista: 'ADC', KogMaw: 'ADC', Twitch: 'ADC', Varus: 'ADC',
  Nilah: 'ADC',
  Thresh: 'Support', Lulu: 'Support', Nami: 'Support', Nautilus: 'Support',
  Leona: 'Support', Blitzcrank: 'Support', Pyke: 'Support', Rakan: 'Support',
  Karma: 'Support', Seraphine: 'Support', Milio: 'Support', Renata: 'Support',
  Soraka: 'Support', Sona: 'Support', Janna: 'Support', Yuumi: 'Support',
  Braum: 'Support', Alistar: 'Support', Rell: 'Support', Bard: 'Support',
  Poppy: 'Support', Taric: 'Support', Zilean: 'Support', Zyra: 'Support',
  Morgana: 'Support', Senna: 'Support',
  LeeSin: 'Jungle', Viego: 'Jungle', Graves: 'Jungle', Kindred: 'Jungle',
  Hecarim: 'Jungle', Vi: 'Jungle', JarvanIV: 'Jungle', Elise: 'Jungle',
  Nidalee: 'Jungle', KhaZix: 'Jungle', Belveth: 'Jungle', Ivern: 'Jungle',
  Amumu: 'Jungle', Zac: 'Jungle', Sejuani: 'Jungle', Nocturne: 'Jungle',
  Kayn: 'Jungle', Evelynn: 'Jungle', Rengar: 'Jungle', RekSai: 'Jungle',
  Lillia: 'Jungle', Briar: 'Jungle', Warwick: 'Jungle', MasterYi: 'Jungle',
  XinZhao: 'Jungle', Nunu: 'Jungle', Shyvana: 'Jungle', Skarner: 'Jungle',
  Aatrox: 'Top', Camille: 'Top', Darius: 'Top', Fiora: 'Top', Gangplank: 'Top',
  Garen: 'Top', Gnar: 'Top', Illaoi: 'Top', Jax: 'Top', KSante: 'Top',
  Malphite: 'Top', Mordekaiser: 'Top', Nasus: 'Top', Ornn: 'Top', Renekton: 'Top',
  Riven: 'Top', Rumble: 'Top', Sett: 'Top', Shen: 'Top', Sion: 'Top',
  Tryndamere: 'Top', Urgot: 'Top', Yorick: 'Top', Ambessa: 'Top', Olaf: 'Top',
  Kennen: 'Top', Jayce: 'Top', Gwen: 'Top', Wukong: 'Top', Volibear: 'Top',
  Ahri: 'Mid', Akali: 'Mid', Anivia: 'Mid', Annie: 'Mid', AurelionSol: 'Mid',
  Azir: 'Mid', Cassiopeia: 'Mid', Fizz: 'Mid', Kassadin: 'Mid', Katarina: 'Mid',
  Leblanc: 'Mid', Lissandra: 'Mid', Malzahar: 'Mid', Orianna: 'Mid', Syndra: 'Mid',
  Qiyana: 'Mid', TwistedFate: 'Mid', Veigar: 'Mid', Vex: 'Mid', Viktor: 'Mid',
  Vladimir: 'Mid', Yasuo: 'Mid', Zed: 'Mid', Zoe: 'Mid', Hwei: 'Mid', Aurora: 'Mid',
  Sylas: 'Mid', Ryze: 'Mid', Yone: 'Mid', Taliyah: 'Mid', Galio: 'Mid',
  Corki: 'Mid', Xerath: 'Mid', Velkoz: 'Mid', Neeko: 'Mid', Ekko: 'Mid',
  Akshan: 'Mid', Mel: 'Mid', Irelia: 'Mid',
};

// Extra roles a champ can actually play. Used so ADC advice never suggests Irelia.
export const FLEX_ROLES = {
  Yasuo: ['ADC'],
  Yone: ['Top'],
  Lucian: ['Mid'],
  Tristana: ['Mid'],
  Corki: ['ADC'],
  KaiSa: ['Mid'],
  Ziggs: ['ADC'],
  Seraphine: ['ADC', 'Mid'],
  Swain: ['Support', 'Mid'],
  Brand: ['Support', 'Mid'],
  Velkoz: ['Support', 'Mid'],
  Xerath: ['ADC', 'Support'],
  Karma: ['Mid'],
  Senna: ['ADC'],
  Quinn: ['ADC'],
  Vayne: ['Top'],
  Kayle: ['Mid'],
  Vladimir: ['Top'],
  Sylas: ['Jungle'],
  Irelia: ['Top'],
  Akshan: ['ADC'],
  Graves: ['Top'],
  Poppy: ['Jungle', 'Top'],
  Sett: ['Support'],
  Pantheon: ['Support', 'Jungle', 'Mid'],
};

export function typicalLane(champion) {
  const name = typeof champion === 'string' ? champion : champion?.champion;
  return TYPICAL_LANE[name] || null;
}

export function playsRole(champion, role) {
  const key = typeof champion === 'string' ? champion : champion?.key || champion?.name || champion?.champion;
  if (!key || !role) return false;
  if (TYPICAL_LANE[key] === role) return true;
  return (FLEX_ROLES[key] || []).includes(role);
}

export function roleFromChampions(names = []) {
  const votes = {};
  names.filter(Boolean).forEach((name, i) => {
    const role = typicalLane(name);
    if (!role) return;
    votes[role] = (votes[role] || 0) + (4 - Math.min(i, 3));
  });
  return Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
