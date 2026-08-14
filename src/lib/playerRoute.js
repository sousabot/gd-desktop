export function parsePlayerSearch(searchParams) {
  const name = searchParams.get('name');
  const tag = searchParams.get('tag');
  const q = searchParams.get('q');
  if (name) return `${name}#${tag || 'EUW'}`;
  if (q) return q;
  return '';
}

export function parseRiotId(raw, fallbackTag = 'EUW') {
  const text = String(raw || '').trim();
  if (!text) return null;
  const hash = text.lastIndexOf('#');
  if (hash === -1) return { gameName: text, tagLine: fallbackTag };
  const gameName = text.slice(0, hash).trim();
  const tagLine = text.slice(hash + 1).trim() || fallbackTag;
  if (!gameName) return null;
  return { gameName, tagLine };
}

export function playerSearchPath(riotId, fallbackTag = 'EUW') {
  const raw = String(riotId || '').trim();
  if (!raw) return '/';
  const [gameName, tagLine] = raw.split('#');
  const name = (gameName || raw).trim();
  const tag = (tagLine || fallbackTag).trim();
  return `/?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`;
}

export function playerQuery(riotId, fallbackTag = 'EUW') {
  const path = playerSearchPath(riotId, fallbackTag);
  const i = path.indexOf('?');
  return i >= 0 ? path.slice(i) : '';
}
