export const REGIONS = [
  { label: 'Europe West (EUW)', region: 'europe', platform: 'euw1' },
  { label: 'Europe Nordic & East (EUNE)', region: 'europe', platform: 'eun1' },
  { label: 'North America (NA)', region: 'americas', platform: 'na1' },
  { label: 'Brazil (BR)', region: 'americas', platform: 'br1' },
  { label: 'Latin America North (LAN)', region: 'americas', platform: 'la1' },
  { label: 'Latin America South (LAS)', region: 'americas', platform: 'la2' },
  { label: 'Korea (KR)', region: 'asia', platform: 'kr' },
  { label: 'Japan (JP)', region: 'asia', platform: 'jp1' },
  { label: 'Oceania (OCE)', region: 'sea', platform: 'oc1' },
  { label: 'Turkey (TR)', region: 'europe', platform: 'tr1' },
  { label: 'Russia (RU)', region: 'europe', platform: 'ru' },
  { label: 'Middle East (ME)', region: 'europe', platform: 'me1' },
  { label: 'Singapore (SG)', region: 'sea', platform: 'sg2' },
  { label: 'Philippines (PH)', region: 'sea', platform: 'ph2' },
  { label: 'Taiwan (TW)', region: 'sea', platform: 'tw2' },
  { label: 'Thailand (TH)', region: 'sea', platform: 'th2' },
  { label: 'Vietnam (VN)', region: 'sea', platform: 'vn2' },
];

export function parseRiotIdInput(nameInput = '', tagInput = '') {
  let gameName = String(nameInput || '').trim();
  let tagLine = String(tagInput || '').trim().replace(/^#/, '');
  if (gameName.includes('#')) {
    const [name, tag] = gameName.split('#');
    gameName = (name || '').trim();
    tagLine = (tag || tagLine).trim();
  }
  return {
    gameName,
    tagLine: tagLine.toUpperCase(),
  };
}

export function linkErrorMessage(err) {
  const msg = String(err?.message || err || '');
  if (msg.includes('RIOT_API_KEY is not set')) {
    return 'Riot API key is not set. Add RIOT_API_KEY to .env and restart the app.';
  }
  if (msg.includes(' 401 ') || msg.includes(' 403 ')) {
    return 'Riot API key is missing or expired. Get a new key at developer.riotgames.com, put it in .env, and restart the app.';
  }
  if (msg.includes(' 429 ')) {
    return 'Riot rate limit hit. Wait about a minute and try again.';
  }
  if (msg.includes(' 404 ') || msg.toLowerCase().includes('not found')) {
    return 'Could not find that Riot ID. Check the name and tag (for example Name#EUW).';
  }
  return 'Could not link that account. Check the name, tag, and that the app was restarted after changing .env.';
}
