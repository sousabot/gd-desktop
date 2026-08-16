export function parsePlayerSearch(searchParams) {
  const name = searchParams.get('name');
  const tag = searchParams.get('tag');
  const q = searchParams.get('q');
  if (name && tag) return `${name}#${tag}`;
  if (name) return `${name}#`;
  if (q) return q;
  return '';
}

export function parseRiotId(raw, fallbackTag = '') {
  const text = String(raw || '').trim();
  if (!text) return null;
  const hash = text.lastIndexOf('#');
  if (hash === -1) {
    if (!fallbackTag) return null;
    return { gameName: text, tagLine: fallbackTag };
  }
  const gameName = text.slice(0, hash).trim();
  const tagLine = text.slice(hash + 1).trim() || fallbackTag;
  if (!gameName || !tagLine) return null;
  return { gameName, tagLine };
}

export function playerSearchPath(riotId, fallbackTag = '') {
  const parsed = parseRiotId(riotId, fallbackTag);
  if (!parsed) return '/';
  return `/?name=${encodeURIComponent(parsed.gameName)}&tag=${encodeURIComponent(parsed.tagLine)}`;
}

export function playerQuery(riotId, fallbackTag = '') {
  const path = playerSearchPath(riotId, fallbackTag);
  const i = path.indexOf('?');
  return i >= 0 ? path.slice(i) : '';
}
