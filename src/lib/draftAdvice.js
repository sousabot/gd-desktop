import { TYPICAL_LANE, playsRole } from './champLane';
import { riotPagesFor, specsFromRiot, recommendRiotPage } from './runePages';

const TREES = {
  precision: 8000,
  domination: 8100,
  sorcery: 8200,
  inspiration: 8300,
  resolve: 8400,
};

const ROLE_RUNES = {
  Top: {
    primaryStyleId: 8000,
    subStyleId: 8400,
    selectedPerkIds: [8010, 9111, 9104, 8014, 8444, 8451, 5005, 5008, 5011],
    spells: [12, 4],
    note: 'Conqueror fighter page. Swap Grasp if you are a tank.',
  },
  Jungle: {
    primaryStyleId: 8000,
    subStyleId: 8100,
    selectedPerkIds: [8010, 9111, 9104, 8014, 8140, 8105, 5005, 5008, 5011],
    spells: [11, 4],
    note: 'Conqueror clear + fights. Hail of Blades if you are an assassin jungler.',
  },
  Mid: {
    primaryStyleId: 8100,
    subStyleId: 8200,
    selectedPerkIds: [8112, 8143, 8140, 8106, 8226, 8233, 5008, 5008, 5011],
    spells: [4, 14],
    note: 'Electrocute burst. Comet if you are a long-range mage.',
  },
  ADC: {
    primaryStyleId: 8000,
    subStyleId: 8200,
    selectedPerkIds: [8008, 9111, 9104, 8014, 8233, 8236, 5005, 5008, 5011],
    spells: [4, 7],
    note: 'Lethal Tempo lane. PTA into squishy bot lanes.',
  },
  Support: {
    primaryStyleId: 8200,
    subStyleId: 8400,
    selectedPerkIds: [8214, 8226, 8210, 8237, 8444, 8453, 5008, 5001, 5011],
    spells: [4, 14],
    note: 'Aery enchanter. Aftershock if you are a tank support.',
  },
};

const CHAMP_RUNES = {
  Ahri: { ...ROLE_RUNES.Mid, selectedPerkIds: [8112, 8143, 8140, 8106, 8226, 8210, 5008, 5008, 5011], note: 'Electrocute charm trades.' },
  Azir: { primaryStyleId: 8000, subStyleId: 8200, selectedPerkIds: [8010, 8009, 9104, 8014, 8226, 8233, 5008, 5008, 5011], spells: [4, 12], note: 'Conqueror soldiers.' },
  Syndra: { primaryStyleId: 8200, subStyleId: 8100, selectedPerkIds: [8229, 8226, 8210, 8237, 8140, 8106, 5008, 5008, 5011], spells: [4, 12], note: 'Comet poke; Electrocute if you all-in.' },
  Orianna: { primaryStyleId: 8200, subStyleId: 8300, selectedPerkIds: [8229, 8226, 8210, 8237, 8345, 8347, 5008, 5008, 5011], spells: [4, 12], note: 'Comet + biscuits.' },
  Viktor: { primaryStyleId: 8200, subStyleId: 8300, selectedPerkIds: [8229, 8226, 8210, 8237, 8345, 8347, 5008, 5008, 5011], spells: [4, 12], note: 'Comet poke into First Strike if they are passive.' },
  Yasuo: { primaryStyleId: 8000, subStyleId: 8400, selectedPerkIds: [8008, 9111, 9104, 8014, 8473, 8242, 5005, 5001, 5011], spells: [4, 14], note: 'Lethal Tempo + Bone Plating.' },
  Yone: { primaryStyleId: 8000, subStyleId: 8400, selectedPerkIds: [8008, 9111, 9104, 8014, 8473, 8451, 5005, 5001, 5011], spells: [4, 14], note: 'Lethal Tempo fighter.' },
  Zed: { ...ROLE_RUNES.Mid, selectedPerkIds: [8112, 8143, 8140, 8106, 8304, 8347, 5008, 5008, 5011], subStyleId: 8300, note: 'Electrocute + boots/insight.' },
  Akali: { ...ROLE_RUNES.Mid, note: 'Electrocute assassin.' },
  Fizz: { ...ROLE_RUNES.Mid, selectedPerkIds: [8112, 8143, 8140, 8106, 8304, 8347, 5008, 5008, 5011], subStyleId: 8300, note: 'Electrocute all-in.' },
  Leblanc: { ...ROLE_RUNES.Mid, note: 'Electrocute burst.' },
  Katarina: { primaryStyleId: 8000, subStyleId: 8100, selectedPerkIds: [8010, 9111, 9105, 8299, 8140, 8106, 5008, 5008, 5011], spells: [4, 14], note: 'Conqueror resets.' },
  Sylas: { primaryStyleId: 8000, subStyleId: 8400, selectedPerkIds: [8010, 8009, 9105, 8014, 8444, 8451, 5008, 5008, 5011], spells: [4, 12], note: 'Conqueror skirmisher.' },
  Hwei: { primaryStyleId: 8200, subStyleId: 8300, selectedPerkIds: [8229, 8226, 8210, 8237, 8345, 8347, 5008, 5008, 5011], spells: [4, 12], note: 'Comet artist.' },
  Jinx: { ...ROLE_RUNES.ADC, note: 'Lethal Tempo rockets.' },
  Tristana: { ...ROLE_RUNES.ADC, note: 'Lethal Tempo jump trades.' },
  Twitch: { ...ROLE_RUNES.ADC, note: 'Lethal Tempo invis picks.' },
  Sivir: { primaryStyleId: 8000, subStyleId: 8200, selectedPerkIds: [8008, 9111, 9104, 8014, 8226, 8236, 5005, 5008, 5011], spells: [4, 7], note: 'Lethal Tempo shove and spell shield.' },
  Zeri: { ...ROLE_RUNES.ADC, note: 'Lethal Tempo kiting.' },
  KaiSa: { primaryStyleId: 8000, subStyleId: 8100, selectedPerkIds: [8008, 9111, 9104, 8014, 8140, 8135, 5005, 5008, 5011], spells: [4, 7], note: 'Lethal Tempo evolve.' },
  Ezreal: { primaryStyleId: 8000, subStyleId: 8300, selectedPerkIds: [8010, 8009, 9103, 8014, 8345, 8347, 5008, 5008, 5011], spells: [4, 7], note: 'Conqueror poke.' },
  Caitlyn: { primaryStyleId: 8000, subStyleId: 8200, selectedPerkIds: [8008, 8009, 9103, 8014, 8233, 8236, 5005, 5008, 5011], spells: [4, 21], note: 'Lethal Tempo + Sorcery. First Strike is the poke alt.' },
  MissFortune: { primaryStyleId: 8300, subStyleId: 8200, selectedPerkIds: [8369, 8321, 8345, 8316, 8226, 8236, 5008, 5008, 5011], spells: [4, 7], note: 'First Strike gold page.' },
  Jhin: { primaryStyleId: 8000, subStyleId: 8200, selectedPerkIds: [8021, 8009, 9103, 8014, 8233, 8236, 5008, 5008, 5011], spells: [4, 7], note: 'Fleet Footwork lane.' },
  Lucian: { primaryStyleId: 8000, subStyleId: 8100, selectedPerkIds: [8005, 8009, 9104, 8014, 8143, 8135, 5005, 5008, 5011], spells: [4, 7], note: 'Press the Attack trades.' },
  Ashe: { primaryStyleId: 8000, subStyleId: 8200, selectedPerkIds: [8008, 8009, 9104, 8014, 8233, 8236, 5005, 5008, 5011], spells: [4, 7], note: 'Lethal Tempo kiting.' },
  Varus: { primaryStyleId: 8000, subStyleId: 8200, selectedPerkIds: [8008, 8009, 9103, 8014, 8233, 8236, 5005, 5008, 5011], spells: [4, 7], note: 'Lethal Tempo on-hit.' },
  Thresh: { primaryStyleId: 8400, subStyleId: 8300, selectedPerkIds: [8439, 8463, 8473, 8242, 8306, 8347, 5007, 5001, 5011], spells: [4, 14], note: 'Aftershock hook.' },
  Nautilus: { primaryStyleId: 8400, subStyleId: 8300, selectedPerkIds: [8439, 8463, 8473, 8242, 8306, 8347, 5007, 5001, 5011], spells: [4, 14], note: 'Aftershock engage.' },
  Lulu: { ...ROLE_RUNES.Support, note: 'Aery enchanter.' },
  Milio: { ...ROLE_RUNES.Support, note: 'Aery range.' },
  LeeSin: { primaryStyleId: 8000, subStyleId: 8100, selectedPerkIds: [8010, 9111, 9104, 8014, 8140, 8105, 5005, 5008, 5011], spells: [11, 4], note: 'Conqueror skirmish.' },
  Viego: { ...ROLE_RUNES.Jungle, note: 'Conqueror resets.' },
  Graves: { primaryStyleId: 8100, subStyleId: 8000, selectedPerkIds: [8128, 8143, 8140, 8135, 9104, 8014, 5005, 5008, 5011], spells: [11, 4], note: 'Dark Harvest snowball.' },
  Aatrox: { primaryStyleId: 8000, subStyleId: 8400, selectedPerkIds: [8010, 9111, 9105, 8299, 8444, 8451, 5008, 5008, 5011], spells: [12, 4], note: 'Conqueror lane.' },
  Camille: { primaryStyleId: 8000, subStyleId: 8400, selectedPerkIds: [8010, 9111, 9104, 8014, 8473, 8242, 5005, 5008, 5011], spells: [12, 4], note: 'Conqueror + Bone Plating.' },
  Malphite: { primaryStyleId: 8200, subStyleId: 8400, selectedPerkIds: [8229, 8226, 8210, 8237, 8473, 8451, 5008, 5001, 5011], spells: [12, 4], note: 'Comet poke into ult.' },
  Darius: { primaryStyleId: 8000, subStyleId: 8400, selectedPerkIds: [8010, 9111, 9104, 8299, 8473, 8451, 5008, 5001, 5011], spells: [6, 4], note: 'Conqueror dunks.' },
};

const COUNTERS = {
  Yasuo: ['Malphite', 'Renekton', 'Annie', 'Pantheon', 'Poppy', 'Veigar'],
  Yone: ['Malphite', 'Renekton', 'Poppy', 'Annie', 'Irelia'],
  Zed: ['Malzahar', 'Lissandra', 'Vladimir', 'Kayle', 'Sylas', 'Ahri'],
  Akali: ['Malzahar', 'Galio', 'Lissandra', 'Diana'],
  Fizz: ['Galio', 'Lissandra', 'Malzahar', 'Anivia'],
  Leblanc: ['Galio', 'Malzahar', 'Kassadin', 'Sylas'],
  Katarina: ['Galio', 'Malzahar', 'Lissandra', 'Annie'],
  Syndra: ['Fizz', 'Yasuo', 'Zed', 'Talon', 'Ekko', 'Ahri'],
  Azir: ['Fizz', 'Yasuo', 'Zed', 'Talon', 'Xerath'],
  Orianna: ['Yasuo', 'Zed', 'Fizz', 'Talon', 'Ahri'],
  Viktor: ['Yasuo', 'Fizz', 'Zed', 'Talon', 'Ahri'],
  Ahri: ['Yasuo', 'Irelia', 'Malzahar', 'Galio', 'Zed'],
  Hwei: ['Fizz', 'Yasuo', 'Zed', 'Talon', 'Akali'],
  Veigar: ['Fizz', 'Zed', 'Talon', 'Kassadin'],
  Xerath: {
    Mid: ['Fizz', 'Yasuo', 'Zed', 'Irelia', 'Akali', 'Talon'],
    ADC: ['Ezreal', 'Sivir', 'Zeri', 'Twitch', 'KaiSa', 'Caitlyn', 'Smolder', 'Varus'],
    Support: ['Pyke', 'Rell', 'Nautilus', 'Bard', 'Rakan', 'Leona'],
  },
  Lux: {
    Mid: ['Fizz', 'Yasuo', 'Zed', 'Talon', 'Akali'],
    ADC: ['Ezreal', 'Sivir', 'Zeri', 'Twitch', 'Draven', 'KaiSa'],
    Support: ['Pyke', 'Nautilus', 'Rell', 'Blitzcrank'],
  },
  Ziggs: {
    Mid: ['Yasuo', 'Fizz', 'Zed', 'Talon'],
    ADC: ['Ezreal', 'Sivir', 'Zeri', 'Twitch', 'Draven'],
  },
  Velkoz: {
    Mid: ['Fizz', 'Yasuo', 'Zed', 'Akali'],
    ADC: ['Ezreal', 'Sivir', 'Zeri', 'Twitch', 'KaiSa'],
    Support: ['Pyke', 'Nautilus', 'Rell', 'Bard'],
  },
  Brand: {
    Mid: ['Fizz', 'Yasuo', 'Zed'],
    ADC: ['Ezreal', 'Sivir', 'Twitch', 'Draven', 'KaiSa'],
    Support: ['Pyke', 'Rell', 'Nautilus', 'Bard'],
  },
  Malzahar: ['Kassadin', 'Vladimir', 'Talon', 'Qiyana', 'Ekko'],
  Galio: ['Vladimir', 'Swain', 'Kassadin', 'Anivia'],
  Irelia: ['Renekton', 'Pantheon', 'Poppy', 'Sett', 'Malphite'],
  Malphite: ['Mordekaiser', 'KSante', 'Camille', 'Gwen', 'Kayle'],
  Darius: ['Quinn', 'Vayne', 'Gwen', 'Kayle', 'Ornn'],
  Aatrox: ['Fiora', 'Jax', 'Gwen', 'Kayle', 'Renekton'],
  Fiora: ['Malphite', 'Poppy', 'Kennen', 'Pantheon', 'Renekton'],
  Camille: ['Fiora', 'Jax', 'Renekton', 'Poppy', 'Ornn'],
  Garen: ['Vayne', 'Kayle', 'Gwen', 'Fiora', 'Teemo'],
  Sett: ['Vayne', 'Gwen', 'Kayle', 'Ornn', 'KSante'],
  Jax: ['Malphite', 'Quinn', 'Gnar', 'Kayle', 'Ornn'],
  Jinx: ['Draven', 'Caitlyn', 'Nilah', 'Kalista'],
  KaiSa: ['Caitlyn', 'Draven', 'Ashe', 'Varus'],
  Ezreal: ['Draven', 'Caitlyn', 'Kalista', 'Nilah'],
  Jhin: ['Draven', 'Samira', 'Nilah', 'Kalista'],
  Caitlyn: ['Draven', 'Samira', 'Nilah', 'Kalista'],
  MissFortune: ['Draven', 'Caitlyn', 'Nilah', 'Kalista', 'Twitch'],
  Ashe: ['Draven', 'Caitlyn', 'Samira', 'Nilah'],
  Thresh: ['Morgana', 'Blitzcrank', 'Pyke', 'Rakan'],
  Nautilus: ['Morgana', 'Janna', 'Lulu', 'Milio'],
  Blitzcrank: ['Morgana', 'Thresh', 'Leona'],
  Lulu: ['Pyke', 'Nautilus', 'Blitzcrank', 'Leona'],
  Alistar: ['Morgana', 'Janna', 'Lulu', 'Milio', 'Rakan'],
  LeeSin: ['Jax', 'Kindred', 'Graves', 'Nidalee', 'Karthus'],
  Graves: ['Kindred', 'Nidalee', 'Karthus', 'Lillia'],
  Viego: ['Jax', 'Kindred', 'Graves', 'Sejuani'],
  KhaZix: ['Kindred', 'Nidalee', 'RekSai', 'Sejuani'],
  Rammus: ['Kindred', 'Graves', 'Lillia', 'Karthus', 'Morgana'],
  Qiyana: ['Malzahar', 'Lissandra', 'Galio', 'Annie'],
};

function countersFor(enemyKey, role) {
  const entry = COUNTERS[enemyKey];
  if (!entry) return [];
  if (Array.isArray(entry)) return entry.filter((name) => playsRole(name, role));
  return entry[role] || [];
}

export const DUO_ROLE = {
  ADC: 'Support',
  Support: 'ADC',
  Jungle: 'Mid',
  Mid: 'Jungle',
};

const BAN_TARGETS = {
  Top: ['Irelia', 'Gwen', 'Fiora', 'Camille', 'Aatrox', 'Kayle', 'Yorick', 'Rumble'],
  Jungle: ['LeeSin', 'Graves', 'KhaZix', 'Nidalee', 'Rammus', 'Lillia', 'MasterYi', 'Evelynn'],
  Mid: ['Yasuo', 'Yone', 'Akali', 'Zed', 'Leblanc', 'Fizz', 'Katarina', 'Sylas'],
  ADC: ['Draven', 'Caitlyn', 'Kalista', 'Xerath', 'Ziggs', 'Nilah', 'Samira', 'Jhin'],
  Support: ['Blitzcrank', 'Pyke', 'Nautilus', 'Thresh', 'Leona', 'Morgana', 'Rell', 'Bard'],
};

const PAIR_SYNERGY = {
  'Xayah|Rakan': 5, 'Rakan|Xayah': 5,
  'Jinx|Lulu': 4, 'Lulu|Jinx': 4,
  'Jinx|Milio': 3, 'Milio|Jinx': 3,
  'KaiSa|Nautilus': 3, 'Nautilus|KaiSa': 3,
  'KaiSa|Alistar': 3, 'Alistar|KaiSa': 3,
  'KaiSa|Leona': 2, 'Leona|KaiSa': 2,
  'Samira|Nautilus': 4, 'Nautilus|Samira': 4,
  'Samira|Alistar': 3, 'Alistar|Samira': 3,
  'Nilah|Nautilus': 3, 'Nautilus|Nilah': 3,
  'Caitlyn|Lux': 3, 'Lux|Caitlyn': 3,
  'Caitlyn|Morgana': 2, 'Morgana|Caitlyn': 2,
  'Ezreal|Yuumi': 2, 'Yuumi|Ezreal': 2,
  'Ezreal|Karma': 2, 'Karma|Ezreal': 2,
  'Sivir|Karma': 3, 'Karma|Sivir': 3,
  'Sivir|Lulu': 2, 'Lulu|Sivir': 2,
  'Tristana|Lulu': 3, 'Lulu|Tristana': 3,
  'Tristana|Nami': 2, 'Nami|Tristana': 2,
  'Ashe|Zyra': 2, 'Zyra|Ashe': 2,
  'Jhin|Lux': 2, 'Lux|Jhin': 2,
  'LeeSin|Yasuo': 3, 'Yasuo|LeeSin': 3,
  'LeeSin|Yone': 2, 'Yone|LeeSin': 2,
  'LeeSin|Sylas': 2, 'Sylas|LeeSin': 2,
  'Sejuani|Orianna': 3, 'Orianna|Sejuani': 3,
  'Sejuani|Viktor': 2, 'Viktor|Sejuani': 2,
  'Graves|Azir': 2, 'Azir|Graves': 2,
  'Kindred|Orianna': 2, 'Orianna|Kindred': 2,
  'Lillia|Karthus': 2,
  'Malphite|Yasuo': 3, 'Yasuo|Malphite': 3,
};

const ENGAGE_ADC = new Set(['Samira', 'Nilah', 'KaiSa', 'Tristana', 'Draven', 'Kalista']);
const SIEGE_ADC = new Set(['Caitlyn', 'Ezreal', 'Jinx', 'Sivir', 'Varus', 'Ashe', 'Zeri', 'Aphelios', 'Smolder']);
const ENCHANTER = new Set(['Lulu', 'Milio', 'Nami', 'Janna', 'Soraka', 'Sona', 'Yuumi', 'Karma']);
const ENGAGE_SUP = new Set(['Nautilus', 'Leona', 'Alistar', 'Rell', 'Blitzcrank', 'Thresh', 'Pyke', 'Rakan']);
const POKE_SUP = new Set(['Xerath', 'Lux', 'Brand', 'Velkoz', 'Zyra', 'Karma', 'Senna']);
const EARLY_JG = new Set(['LeeSin', 'Elise', 'XinZhao', 'Pantheon', 'RekSai', 'JarvanIV', 'Nidalee', 'Vi', 'Rammus']);
const SCALING_JG = new Set(['Kindred', 'Graves', 'Karthus', 'Lillia', 'MasterYi', 'Evelynn', 'Belveth', 'Kayn']);
const ASSASSIN_MID = new Set(['Zed', 'Akali', 'Qiyana', 'Talon', 'Fizz', 'Leblanc', 'Katarina', 'Ekko']);
const CONTROL_MID = new Set(['Orianna', 'Viktor', 'Azir', 'Syndra', 'Anivia', 'TwistedFate', 'Hwei', 'Ahri', 'Aurora']);

export function duoLink(champKey, allyKey, role) {
  if (!champKey || !allyKey) return null;
  const pair = PAIR_SYNERGY[`${champKey}|${allyKey}`];
  if (pair) return { score: pair, reason: `Synergy with ${allyKey}` };
  if (role === 'ADC') {
    if (ENGAGE_ADC.has(champKey) && ENGAGE_SUP.has(allyKey)) return { score: 3, reason: `All-in with ${allyKey}` };
    if (SIEGE_ADC.has(champKey) && ENCHANTER.has(allyKey)) return { score: 3, reason: `Peel from ${allyKey}` };
    if (SIEGE_ADC.has(champKey) && POKE_SUP.has(allyKey)) return { score: 2, reason: `Poke lane with ${allyKey}` };
    if (ENGAGE_ADC.has(champKey) && ENCHANTER.has(allyKey)) return { score: 1, reason: `${allyKey} can still peel` };
  }
  if (role === 'Support') {
    if (ENGAGE_SUP.has(champKey) && ENGAGE_ADC.has(allyKey)) return { score: 3, reason: `All-in with ${allyKey}` };
    if (ENCHANTER.has(champKey) && SIEGE_ADC.has(allyKey)) return { score: 3, reason: `Peel for ${allyKey}` };
    if (POKE_SUP.has(champKey) && SIEGE_ADC.has(allyKey)) return { score: 2, reason: `Poke with ${allyKey}` };
  }
  if (role === 'Jungle') {
    if (EARLY_JG.has(champKey) && ASSASSIN_MID.has(allyKey)) return { score: 3, reason: `Early ganks with ${allyKey}` };
    if (SCALING_JG.has(champKey) && CONTROL_MID.has(allyKey)) return { score: 3, reason: `Scale with ${allyKey}` };
    if (EARLY_JG.has(champKey) && CONTROL_MID.has(allyKey)) return { score: 1, reason: `Cover ${allyKey} early` };
  }
  if (role === 'Mid') {
    if (ASSASSIN_MID.has(champKey) && EARLY_JG.has(allyKey)) return { score: 3, reason: `Roam with ${allyKey}` };
    if (CONTROL_MID.has(champKey) && SCALING_JG.has(allyKey)) return { score: 3, reason: `Scale with ${allyKey}` };
  }
  return null;
}

function poolBoost(champ, pool, role) {
  if (!pool || (!Object.keys(pool.mastery || {}).length && !Object.keys(pool.recent || {}).length)) {
    return { score: 0, reason: null };
  }
  const rec = pool.recent?.[champ.id];
  const mas = pool.mastery?.[champ.id];
  const roleGames = rec?.roles?.[role] || 0;
  const games = rec?.games || 0;
  if (roleGames >= 3 || games >= 5) return { score: 6, reason: 'In your pool' };
  if (roleGames >= 1 || games >= 2) return { score: 4, reason: 'You play this' };
  if ((mas?.level || 0) >= 6 || (mas?.points || 0) >= 50000) return { score: 3, reason: 'High mastery' };
  if ((mas?.level || 0) >= 4 || (mas?.points || 0) >= 15000) return { score: 2, reason: 'Mastery champ' };
  if (mas) return { score: 0, reason: null };
  return { score: -2, reason: null };
}

function shardVs(enemyTags = [], profile = null) {
  if (profile?.cc >= 2 || profile?.assassins >= 2) return 5013;
  if (enemyTags.includes('Mage') || (profile?.ap || 0) >= 3) return 5001;
  if (enemyTags.includes('Assassin')) return 5010;
  return 5008;
}

function defenseShard(profile, enemyTags = []) {
  if (profile?.cc >= 2) return 5013;
  if (enemyTags.includes('Mage') || (profile?.ap || 0) >= 3) return 5011;
  return 5011;
}

const POKE = new Set(['Xerath', 'Ziggs', 'Lux', 'Velkoz', 'Caitlyn', 'Varus', 'Jayce', 'Nidalee', 'Kennen', 'Hwei', 'Viktor', 'Orianna', 'Ezreal', 'Ashe', 'Jhin', 'Heimerdinger']);
const ALLIN = new Set(['Draven', 'Leona', 'Nautilus', 'Alistar', 'Rell', 'Pyke', 'Darius', 'Renekton', 'Irelia', 'Yasuo', 'Yone', 'Zed', 'Fizz', 'Pantheon', 'Kalista', 'Samira', 'Nilah', 'Sett', 'Olaf', 'Rengar', 'KhaZix']);
const HEAVY_CC = new Set(['Nautilus', 'Leona', 'Alistar', 'Rell', 'Amumu', 'Sejuani', 'Maokai', 'Morgana', 'Lissandra', 'Ashe', 'Rammus', 'Ornn', 'Braum']);

function compProfile(enemies = [], enemyLane = null) {
  const rows = Array.isArray(enemies) ? enemies.filter((e) => e && (e.name || e.key || e.tags)) : [];
  const names = rows.map((e) => e.name || e.key).filter(Boolean);
  const tags = rows.flatMap((e) => e.tags || []);
  const laneName = enemyLane?.name || enemyLane?.key || null;
  const laneTags = enemyLane?.tags || [];
  return {
    tanks: tags.filter((t) => t === 'Tank').length,
    assassins: tags.filter((t) => t === 'Assassin').length,
    mages: tags.filter((t) => t === 'Mage').length,
    ap: tags.filter((t) => t === 'Mage' || t === 'Support').length,
    ad: tags.filter((t) => t === 'Marksman' || t === 'Fighter' || t === 'Assassin').length,
    cc: names.filter((n) => HEAVY_CC.has(n)).length,
    lanePoke: POKE.has(laneName) || laneTags.includes('Mage'),
    laneAllIn: ALLIN.has(laneName) || laneTags.includes('Assassin') || laneTags.includes('Fighter'),
    laneName,
    laneTags,
  };
}

function finishPage(champKey, role, spec) {
  const ids = [...(spec.selectedPerkIds || [])];
  while (ids.length < 9) ids.push(5008);
  ids[6] = spec.offenseShard ?? ids[6] ?? 5008;
  ids[7] = spec.flexShard ?? ids[7] ?? 5008;
  ids[8] = spec.defenseShard ?? ids[8] ?? 5011;
  const label = spec.label || 'Lane';
  return {
    id: spec.id,
    label,
    why: spec.why || '',
    recommended: !!spec.recommended,
    name: `Rift ${String(champKey || 'Draft').slice(0, 12 - label.length)} ${label}`.slice(0, 20),
    primaryStyleId: spec.primaryStyleId,
    subStyleId: spec.subStyleId,
    selectedPerkIds: ids.slice(0, 9),
    spells: spec.spells || ROLE_RUNES[role]?.spells || [4, 14],
    note: spec.note || spec.why || '',
  };
}

function recommendKind(profile, role) {
  if ((profile.tanks || 0) >= 2) return 'comp';
  if (profile.lanePoke && (role === 'ADC' || role === 'Mid' || role === 'Top' || role === 'Support')) return 'lane';
  if (profile.laneAllIn) return 'fight';
  if ((profile.assassins || 0) >= 2 || (profile.cc || 0) >= 2) return 'comp';
  return 'lane';
}

function pagesForRole(champKey, role, profile) {
  const base = CHAMP_RUNES[champKey] || ROLE_RUNES[role] || ROLE_RUNES.Mid;
  const flex = shardVs(profile.laneTags, profile);
  const def = defenseShard(profile, profile.laneTags);
  const vsName = profile.laneName || 'this matchup';
  const laneWhy = profile.lanePoke
    ? `Sustain / space into ${vsName}`
    : profile.laneAllIn
      ? `Trade setup vs ${vsName}`
      : `Standard lane vs ${vsName}`;
  const fightWhy = profile.laneAllIn
    ? `All-in vs ${vsName}`
    : 'Kill pressure in lane';
  const compWhy = profile.tanks >= 2
    ? 'Cut tanks in teamfights'
    : profile.assassins >= 2
      ? 'Survive their dive'
      : profile.cc >= 2
        ? 'Tenacity vs their CC'
        : 'Better in 5v5s';

  if (role === 'ADC') {
    const ltInsp = new Set(['Tristana', 'Jinx', 'Twitch', 'Zeri', 'Smolder', 'Aphelios', 'Xayah']);
    if (ltInsp.has(champKey)) {
      const lanePerks = profile.lanePoke
        ? [8008, 9111, 9104, 8014, 8345, 8347, 5005, flex, def]
        : [8008, 9111, 9104, 8014, 8304, 8345, 5005, flex, def];
      const laneWhyInsp = profile.lanePoke
        ? `Biscuits into ${vsName}`
        : 'Inspiration lane (boots + biscuits)';
      return [
        { id: 'lane', label: 'Lane', why: laneWhyInsp, primaryStyleId: 8000, subStyleId: 8300, selectedPerkIds: lanePerks, spells: [4, 7], note: laneWhyInsp },
        { id: 'fight', label: 'Fight', why: fightWhy, primaryStyleId: 8000, subStyleId: 8100, selectedPerkIds: [8005, 9111, 9104, 8014, 8143, 8135, 5005, 5008, def], spells: [4, 14], note: fightWhy },
        { id: 'comp', label: 'Comp', why: profile.tanks >= 2 ? 'Sorcery + Cut Down in 5v5s' : 'Sorcery scaling in 5v5s', primaryStyleId: 8000, subStyleId: 8200, selectedPerkIds: profile.tanks >= 2
          ? [8008, 9111, 9104, 8017, 8233, 8236, 5005, 5008, def]
          : [8008, 9111, 9104, 8014, 8233, 8236, 5005, 5008, def], spells: [4, 7], note: 'Sorcery for mid-late game' },
      ];
    }
    const laneSub = profile.lanePoke || profile.laneAllIn ? 8400 : 8200;
    const lanePerks = profile.lanePoke
      ? [8021, 9101, 9104, 8017, 8473, 8444, 5005, flex, def]
      : profile.laneAllIn
        ? [8008, 9111, 9104, 8014, 8473, 8242, 5005, flex, def]
        : [8008, 9111, 9104, 8014, 8233, 8236, 5005, flex, def];
    return [
      { id: 'lane', label: 'Lane', why: laneWhy, primaryStyleId: 8000, subStyleId: laneSub, selectedPerkIds: lanePerks, spells: [4, 7], note: laneWhy },
      { id: 'fight', label: 'Fight', why: fightWhy, primaryStyleId: 8000, subStyleId: 8100, selectedPerkIds: [8005, 9111, 9104, 8014, 8143, 8135, 5005, 5008, def], spells: [4, 14], note: fightWhy },
      { id: 'comp', label: 'Comp', why: compWhy, primaryStyleId: 8000, subStyleId: profile.assassins >= 2 || profile.cc >= 2 ? 8400 : 8200, selectedPerkIds: profile.tanks >= 2
        ? [8008, 9111, 9104, 8017, 8233, 8236, 5005, 5008, def]
        : profile.assassins >= 2 || profile.cc >= 2
          ? [8008, 9111, 9104, 8014, 8473, 8242, 5005, flex, 5013]
          : [8008, 9111, 9103, 8017, 8233, 8236, 5005, 5008, def], spells: [4, 7], note: compWhy },
    ];
  }

  if (role === 'Mid') {
    const mage = (base.primaryStyleId === 8200) || ['Syndra', 'Orianna', 'Viktor', 'Hwei', 'Azir', 'Ahri'].includes(champKey);
    return [
      { id: 'lane', label: 'Lane', why: laneWhy, primaryStyleId: profile.lanePoke && mage ? 8200 : (base.primaryStyleId || 8100), subStyleId: profile.laneAllIn ? 8400 : (profile.lanePoke ? 8300 : (base.subStyleId || 8200)), selectedPerkIds: mage
        ? (profile.lanePoke
          ? [8229, 8226, 8210, 8237, 8345, 8347, 5008, flex, def]
          : [base.selectedPerkIds[0] || 8229, 8226, 8210, 8237, 8140, 8106, 5008, flex, def])
        : (profile.laneAllIn
          ? [8112, 8143, 8140, 8106, 8473, 8242, 5008, flex, def]
          : [8112, 8143, 8140, 8106, 8226, 8233, 5008, flex, def]), spells: [4, 14], note: laneWhy },
      { id: 'fight', label: 'Fight', why: fightWhy, primaryStyleId: 8100, subStyleId: 8300, selectedPerkIds: [8112, 8143, 8140, 8106, 8304, 8347, 5008, 5008, def], spells: [4, 14], note: fightWhy },
      { id: 'comp', label: 'Comp', why: compWhy, primaryStyleId: mage ? 8200 : 8100, subStyleId: profile.tanks >= 2 ? 8000 : 8400, selectedPerkIds: mage
        ? [8229, 8226, 8210, 8236, 8473, 8451, 5008, flex, def]
        : [8112, 8143, 8140, 8106, 8473, 8242, 5008, flex, def], spells: [4, 12], note: compWhy },
    ];
  }

  if (role === 'Support') {
    const engage = ENGAGE_SUP.has(champKey);
    return [
      { id: 'lane', label: 'Lane', why: laneWhy, primaryStyleId: engage ? 8400 : 8200, subStyleId: 8300, selectedPerkIds: engage
        ? [8439, 8463, 8473, 8242, 8306, 8347, 5007, flex, def]
        : [8214, 8226, 8210, 8237, 8345, 8347, 5008, flex, def], spells: [4, 14], note: laneWhy },
      { id: 'fight', label: 'Fight', why: fightWhy, primaryStyleId: engage ? 8400 : 8100, subStyleId: 8000, selectedPerkIds: engage
        ? [8439, 8401, 8473, 8242, 9111, 8014, 5007, 5008, def]
        : [8112, 8126, 8140, 8106, 9111, 8014, 5008, 5008, def], spells: [4, 14], note: fightWhy },
      { id: 'comp', label: 'Comp', why: compWhy, primaryStyleId: engage ? 8400 : 8200, subStyleId: 8400, selectedPerkIds: engage
        ? [8439, 8463, 8429, 8242, 8444, 8453, 5007, flex, def]
        : [8214, 8226, 8210, 8236, 8444, 8453, 5008, flex, def], spells: [4, 3], note: compWhy },
    ];
  }

  if (role === 'Jungle') {
    return [
      { id: 'lane', label: 'Clear', why: 'Fast clear into early path', primaryStyleId: base.primaryStyleId || 8000, subStyleId: 8100, selectedPerkIds: [base.selectedPerkIds[0] || 8010, 9111, 9104, 8014, 8140, 8105, 5005, flex, def], spells: [11, 4], note: 'Fast clear into early path' },
      { id: 'fight', label: 'Fight', why: fightWhy, primaryStyleId: 8000, subStyleId: 8100, selectedPerkIds: [8010, 9111, 9104, 8014, 8143, 8105, 5005, 5008, def], spells: [11, 4], note: fightWhy },
      { id: 'comp', label: 'Comp', why: compWhy, primaryStyleId: 8000, subStyleId: 8400, selectedPerkIds: profile.tanks >= 2
        ? [8010, 9111, 9104, 8017, 8473, 8451, 5005, 5008, def]
        : [8010, 9111, 9104, 8014, 8473, 8242, 5005, flex, def], spells: [11, 4], note: compWhy },
    ];
  }

  return [
    { id: 'lane', label: 'Lane', why: laneWhy, primaryStyleId: base.primaryStyleId || 8000, subStyleId: profile.lanePoke || profile.laneAllIn ? 8400 : (base.subStyleId || 8400), selectedPerkIds: profile.lanePoke
      ? [8010, 8009, 9105, 8014, 8444, 8473, 5008, flex, def]
      : [base.selectedPerkIds[0] || 8010, 9111, 9104, 8014, 8473, 8451, 5008, flex, def], spells: [12, 4], note: laneWhy },
    { id: 'fight', label: 'Fight', why: fightWhy, primaryStyleId: 8000, subStyleId: 8100, selectedPerkIds: [8010, 9111, 9104, 8299, 8143, 8106, 5008, 5008, def], spells: [12, 14], note: fightWhy },
    { id: 'comp', label: 'Comp', why: compWhy, primaryStyleId: 8000, subStyleId: 8400, selectedPerkIds: profile.tanks >= 2
      ? [8010, 9111, 9104, 8017, 8429, 8451, 5008, 5008, def]
      : [8010, 9111, 9104, 8014, 8473, 8242, 5008, flex, def], spells: [12, 4], note: compWhy },
  ];
}

export function runePagesFor(champKey, role = 'Mid', ctx = {}) {
  const profile = compProfile(ctx.enemies || [], ctx.enemyLane || null);
  const riot = riotPagesFor(champKey, role);
  const specs = riot.length
    ? specsFromRiot(riot, profile, role)
    : pagesForRole(champKey, role, profile);
  const rec = riot.length
    ? recommendRiotPage(specs, profile)
    : recommendKind(profile, role);
  return specs.map((spec) => finishPage(champKey, role, {
    ...spec,
    recommended: spec.id === rec,
  }));
}

export function runesFor(champKey, role = 'Mid', enemyTags = [], ctx = {}) {
  const pages = runePagesFor(champKey, role, {
    ...ctx,
    enemyLane: ctx.enemyLane || { tags: enemyTags },
  });
  return pages.find((p) => p.recommended) || pages[0];
}

function classEdge(youTags, enemyTags, role) {
  if (role === 'ADC' && youTags.includes('Marksman') && enemyTags.includes('Mage')) {
    return { score: 2, reason: 'Marksmen can space artillery mages' };
  }
  if (role === 'ADC' && youTags.includes('Marksman') && enemyTags.includes('Tank')) {
    return { score: -1, reason: 'Tanks can stall ADC lanes' };
  }
  if (role !== 'ADC' && youTags.includes('Assassin') && enemyTags.includes('Mage')) {
    return { score: 2, reason: 'Assassins punish immobile mages' };
  }
  if (youTags.includes('Tank') && enemyTags.includes('Assassin')) {
    return { score: 2, reason: 'Tanks eat assassin all-ins' };
  }
  if (youTags.includes('Mage') && enemyTags.includes('Assassin')) {
    return { score: -1, reason: 'Assassins can jump you' };
  }
  if (role !== 'ADC' && youTags.includes('Fighter') && enemyTags.includes('Marksman')) {
    return { score: 1, reason: 'Fighters can dive marksmen' };
  }
  return null;
}

export function adviseDraft({
  role = 'Mid',
  youChamp = null,
  enemyLane = null,
  allyDuo = null,
  enemies = [],
  bans = [],
  taken = [],
  owned = [],
  pickable = [],
  catalog = [],
  pool = null,
  offMeta = false,
} = {}) {
  const blocked = new Set([...bans, ...taken].map(Number).filter((id) => id > 0));
  const ownedSet = new Set((owned || []).map(Number));
  const pickableSet = new Set((pickable || []).map(Number));
  const enemyNames = enemies.map((e) => e.name).filter(Boolean);
  const enemyLaneName = enemyLane?.name || null;
  const enemyTags = enemyLane?.tags || [];
  const allyKey = allyDuo?.name || allyDuo?.key || null;
  const classic = enemyLaneName ? countersFor(enemyLaneName, role) : [];

  const scored = catalog
    .filter((c) => {
      if (!(c?.id > 0) || blocked.has(c.id)) return false;
      if (playsRole(c.key, role)) return true;
      if (!offMeta) return false;
      const mas = pool?.mastery?.[c.id];
      const rec = pool?.recent?.[c.id];
      return (mas?.level || 0) >= 3 || (rec?.games || 0) >= 1;
    })
    .map((c) => {
      const lane = TYPICAL_LANE[c.key] || TYPICAL_LANE[c.name] || null;
      let score = 0;
      const reasons = [];
      if (lane === role) score += 5;
      else score += 1;
      if (!ownedSet.size || ownedSet.has(c.id)) {
        score += 2;
      } else {
        score -= 4;
        reasons.push('Not owned');
      }
      if (pickableSet.size && !pickableSet.has(c.id)) {
        score -= 8;
      }
      if (classic.includes(c.key) || classic.includes(c.name)) {
        score += 6;
        reasons.push(`Strong into ${enemyLaneName}`);
      }
      const edge = classEdge(c.tags || [], enemyTags, role);
      if (edge) {
        score += edge.score;
        if (edge.score > 0) reasons.push(edge.reason);
      }
      const duo = duoLink(c.key, allyKey, role);
      if (duo) {
        score += duo.score;
        reasons.push(duo.reason);
      }
      const comfort = poolBoost(c, pool, role);
      score += comfort.score;
      if (comfort.reason) reasons.push(comfort.reason);
      const ap = enemies.filter((e) => (e.tags || []).includes('Mage')).length;
      const ad = enemies.filter((e) => (e.tags || []).includes('Marksman') || (e.tags || []).includes('Fighter')).length;
      if (ap >= 3 && (c.tags || []).includes('Tank') && (role === 'Top' || role === 'Support' || role === 'Jungle')) {
        score += 1;
        reasons.push('Comp is AP-heavy');
      }
      if (ad >= 3 && (c.tags || []).includes('Tank') && (role === 'Top' || role === 'Support' || role === 'Jungle')) {
        score += 1;
        reasons.push('Comp is AD-heavy');
      }
      return { ...c, lane, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  const picks = scored.filter((c) => c.score > 0).slice(0, 10);
  const locked = youChamp?.key || youChamp?.name || null;
  const runes = locked ? runesFor(locked, role, enemyTags) : (picks[0] ? runesFor(picks[0].key, role, enemyTags) : runesFor(null, role, enemyTags));

  return {
    role,
    enemyLaneName,
    allyKey,
    enemyNames,
    classic,
    picks,
    runes,
    disclaimer: 'Rift Draft advice from matchup notes, your pool, and duo tags — not an official Riot winrate.',
  };
}

export function adviseBans({
  role = 'Mid',
  bans = [],
  bannable = [],
  catalog = [],
  pool = null,
} = {}) {
  const banned = new Set((bans || []).map(Number).filter((id) => id > 0));
  const bannableSet = new Set((bannable || []).map(Number));
  const targets = BAN_TARGETS[role] || [];
  const comfortIds = new Set();
  Object.entries(pool?.recent || {}).forEach(([id, rec]) => {
    if ((rec.roles?.[role] || 0) >= 2 || (rec.games || 0) >= 4) comfortIds.add(Number(id));
  });

  const scored = catalog
    .filter((c) => c?.id > 0 && !banned.has(c.id) && targets.includes(c.key))
    .filter((c) => !comfortIds.has(c.id))
    .filter((c) => !bannableSet.size || bannableSet.has(c.id))
    .map((c) => {
      const idx = targets.indexOf(c.key);
      return {
        ...c,
        score: 12 - idx,
        reasons: [`Priority ${role} ban`],
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 3);
}

export function isBanPhase(session) {
  if (!session?.inSelect) return false;
  const acting = String(session.acting?.type || '').toLowerCase();
  if (acting === 'ban') return true;
  if (acting === 'pick') return false;
  const phase = String(session.phase || '').toUpperCase();
  if (phase.includes('FINAL') || phase.includes('PLAN') || phase.includes('GAME')) return false;
  const pickCount = [...(session.allies || []), ...(session.enemies || [])]
    .filter((p) => Number(p.championId) > 0).length;
  const banCount = (session.bans || []).length;
  return pickCount === 0 && banCount < 10;
}

export function catalogFromIndex(byId) {
  return Object.values(byId || {}).map((c) => ({
    id: c.id,
    key: c.key,
    name: c.name,
    tags: c.tags || [],
    info: c.info || {},
  }));
}

export const DRAFT_ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

function champKeyOf(c) {
  return c?.key || c?.name || null;
}

export function padSeats(seats = []) {
  const leftover = [];
  const byRole = {};
  (seats || []).forEach((seat) => {
    const role = DRAFT_ROLES.includes(seat?.position) ? seat.position : null;
    if (role && !byRole[role]) byRole[role] = seat;
    else leftover.push(seat);
  });
  return DRAFT_ROLES.map((role) => {
    if (byRole[role]) return { ...byRole[role], position: role };
    const extra = leftover.shift();
    if (extra) return { ...extra, position: extra.position || role };
    return {
      cellId: `empty-${role}`,
      position: role,
      championId: 0,
      intentId: 0,
      shownId: 0,
      name: null,
      displayName: null,
      tags: [],
      locked: false,
    };
  });
}

export function matchupGrade(you, enemy, role) {
  const youKey = champKeyOf(you);
  if (!youKey) return null;
  const enemyKey = champKeyOf(enemy);
  if (!enemyKey) return null;
  const vs = countersFor(enemyKey, role);
  const them = countersFor(youKey, role);
  if (vs.includes(youKey) || vs.includes(you?.name)) {
    return { grade: 'S', why: `Strong into ${enemy.name || enemyKey}` };
  }
  if (them.includes(enemyKey) || them.includes(enemy?.name)) {
    return { grade: 'C', why: `${enemy.name || enemyKey} is a known problem` };
  }
  const edge = classEdge(you.tags || [], enemy.tags || [], role);
  if (edge?.score >= 2) return { grade: 'A', why: edge.reason };
  if (edge?.score === 1) return { grade: 'B', why: edge.reason };
  if (edge?.score < 0) return { grade: 'C', why: edge.reason };
  return null;
}

export function draftLean(allies = [], enemies = []) {
  const a = padSeats(allies);
  const e = padSeats(enemies);
  let score = 0;
  let compared = 0;
  a.forEach((seat, i) => {
    const grade = matchupGrade(seat, e[i], seat.position);
    if (!grade) return;
    compared += 1;
    if (grade.grade === 'S') score += 2;
    else if (grade.grade === 'A') score += 1;
    else if (grade.grade === 'C') score -= 1;
  });
  if (compared < 2) return { ready: false, ally: 50, enemy: 50, compared };
  const shift = Math.max(-12, Math.min(12, score * 3));
  return { ready: true, ally: 50 + shift, enemy: 50 - shift, compared };
}

const TAG_SKETCH = {
  Assassin: { early: 3, mid: 2, late: 1, dealt: 3, taken: 1 },
  Fighter: { early: 2, mid: 3, late: 2, dealt: 2, taken: 2 },
  Mage: { early: 1, mid: 3, late: 2, dealt: 3, taken: 1 },
  Marksman: { early: 1, mid: 2, late: 3, dealt: 3, taken: 1 },
  Tank: { early: 2, mid: 2, late: 2, dealt: 1, taken: 3 },
  Support: { early: 2, mid: 2, late: 2, dealt: 1, taken: 2 },
};

function teamSketch(seats = []) {
  const acc = { early: 0, mid: 0, late: 0, dealt: 0, taken: 0, n: 0 };
  (seats || []).forEach((seat) => {
    if (!champKeyOf(seat) && !(seat.tags || []).length) return;
    acc.n += 1;
    const tags = seat.tags || [];
    const info = seat.info || {};
    const weights = tags.reduce((sum, tag) => {
      const row = TAG_SKETCH[tag];
      if (!row) return sum;
      return {
        early: sum.early + row.early,
        mid: sum.mid + row.mid,
        late: sum.late + row.late,
        dealt: sum.dealt + row.dealt,
        taken: sum.taken + row.taken,
      };
    }, { early: 0, mid: 0, late: 0, dealt: 0, taken: 0 });
    const tagCount = Math.max(1, tags.filter((t) => TAG_SKETCH[t]).length);
    acc.early += weights.early / tagCount;
    acc.mid += weights.mid / tagCount;
    acc.late += weights.late / tagCount;
    acc.dealt += (weights.dealt / tagCount) + ((info.attack || 0) + (info.magic || 0)) / 10;
    acc.taken += (weights.taken / tagCount) + (info.defense || 0) / 10;
  });
  return acc;
}

function sketchRow(a, e, key) {
  const tot = (a[key] || 0) + (e[key] || 0);
  if (!tot || !a.n || !e.n) return { ally: 50, enemy: 50, ready: false };
  const ally = Math.round((100 * a[key]) / tot);
  return { ally, enemy: 100 - ally, ready: true };
}

export function compareSketch(allies = [], enemies = []) {
  const a = teamSketch(allies);
  const e = teamSketch(enemies);
  return {
    early: sketchRow(a, e, 'early'),
    mid: sketchRow(a, e, 'mid'),
    late: sketchRow(a, e, 'late'),
    taken: sketchRow(a, e, 'taken'),
    dealt: sketchRow(a, e, 'dealt'),
  };
}
