const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';
const CHROMA_COLORS = 'Jade|Ruby|Sapphire|Emerald|Obsidian|Pearl|Catseye|Tanzanite|Turquoise|Amethyst|Citrine|Peridot|Sandstone|Aquamarine|Rainbow|Pariah';
const CHROMA_PREFIX = new RegExp(`^(${CHROMA_COLORS})(?=[A-Z])`);
const CHROMA_NAME = new RegExp(`^(${CHROMA_COLORS})$`, 'i');

let skinsPromise = null;
let champIndexPromise = null;

export function lcuAssetUrl(lcuPath) {
  if (!lcuPath || typeof lcuPath !== 'string') return '';
  const p = lcuPath.toLowerCase().replace(/^\/+/, '').replace(/^lol-game-data\/assets\//, '');
  return `${CDRAGON}/${p}`;
}

export function getChampionIndex() {
  if (!champIndexPromise) {
    champIndexPromise = fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then((r) => r.json())
      .then((versions) => {
        const version = versions[0];
        return fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)
          .then((r) => r.json())
          .then((json) => {
            const byKey = new Map();
            for (const champ of Object.values(json.data || {})) {
              byKey.set(Number(champ.key), { id: champ.id, name: champ.name, version });
            }
            return { version, byKey };
          });
      })
      .catch(() => ({ version: '', byKey: new Map() }));
  }
  return champIndexPromise;
}

export function getSkinsMeta() {
  if (!skinsPromise) {
    skinsPromise = fetch(`${CDRAGON}/v1/skins.json`)
      .then((r) => r.json())
      .then((raw) => {
        const byId = new Map();
        let total = 0;
        for (const entry of Object.values(raw || {})) {
          if (!entry || !Number.isFinite(Number(entry.id))) continue;
          const id = Number(entry.id);
          const collectible = isCollectibleEntry(entry);
          if (collectible) total += 1;
          byId.set(id, {
            id,
            name: entry.name,
            collectible,
            isBase: !!entry.isBase,
            tile: lcuAssetUrl(entry.loadScreenPath || entry.tilePath || entry.uncenteredSplashPath),
            splash: lcuAssetUrl(entry.uncenteredSplashPath || entry.splashPath),
          });
        }
        return { byId, total };
      })
      .catch(() => ({ byId: new Map(), total: 0 }));
  }
  return skinsPromise;
}

function isCollectibleEntry(entry) {
  if (!entry || entry.isBase) return false;
  const kind = String(entry.skinClassification || '');
  if (kind === 'kRecolor' || kind === 'kChroma') return false;
  const type = String(entry.skinType || '').toLowerCase();
  if (type.includes('chroma')) return false;
  const name = String(entry.name || '').trim();
  if (CHROMA_NAME.test(name)) return false;
  if (/^classic\b/i.test(name)) return false;
  if (/\bchroma\b/i.test(name)) return false;
  if (/\((ruby|sapphire|emerald|obsidian|pearl|jade|catseye|tanzanite|turquoise|rose quartz|amethyst|citrine|peridot|sandstone|pariah)\)/i.test(name)) {
    return false;
  }
  return true;
}

function ddragonId(champId, alias, champion, index) {
  const fromIndex = index?.byKey?.get(Number(champId))?.id;
  if (fromIndex) return fromIndex;
  let id = String(alias || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!id) id = String(champion || '').replace(/['.]/g, '').replace(/[^a-zA-Z0-9]/g, '');
  id = id.replace(CHROMA_PREFIX, '');
  if (id === 'NunuWillump') return 'Nunu';
  if (id === 'Wukong') return 'MonkeyKing';
  if (id === 'Renata') return 'RenataGlasc';
  return id;
}

export function skinImageUrls(skin, meta, index) {
  const id = Number(skin.id);
  const info = meta?.byId?.get(id);
  const champId = Number(skin.champId) || Math.floor(id / 1000);
  const num = id % 1000;
  const alias = ddragonId(champId, skin.alias, skin.champion, index);

  const urls = [];
  if (info?.tile) urls.push(info.tile);
  if (info?.splash) urls.push(info.splash);
  if (Number.isFinite(champId) && champId > 0) {
    urls.push(`https://cdn.communitydragon.org/latest/champion/${champId}/splash-art/centered/skin/${num}`);
    urls.push(`https://cdn.communitydragon.org/latest/champion/${champId}/portrait/skin/${num}`);
  }
  if (alias && Number.isFinite(num)) {
    urls.push(`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${alias}_${num}.jpg`);
    urls.push(`https://cdn.communitydragon.org/latest/champion/${alias}/splash-art/centered/skin/${num}`);
    urls.push(`https://cdn.communitydragon.org/latest/champion/${alias}/portrait/skin/${num}`);
  }
  if (skin.tile) urls.push(skin.tile);
  if (skin.splash) urls.push(skin.splash);
  return [...new Set(urls.filter(Boolean))];
}

export function championIconUrl(champ, index) {
  const champId = Number(champ.id);
  if (Number.isFinite(champId) && champId > 0) {
    return `https://cdn.communitydragon.org/latest/champion/${champId}/square`;
  }
  const alias = ddragonId(champId, champ.alias, champ.name, index);
  const version = index?.version;
  if (alias && version) {
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${alias}.png`;
  }
  if (alias) return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${alias}_0.jpg`;
  return '';
}

export function uniqueChampions(champs, index) {
  const byId = new Map();
  for (const champ of champs || []) {
    const id = Number(champ.id);
    if (!Number.isFinite(id) || id < 1) continue;
    if (index?.byKey?.size && !index.byKey.has(id)) continue;
    const prev = byId.get(id);
    if (!prev || (champ.skins || []).length > (prev.skins || []).length) {
      byId.set(id, {
        ...champ,
        id,
        name: index?.byKey?.get(id)?.name || champ.name,
        alias: index?.byKey?.get(id)?.id || champ.alias,
      });
    }
  }
  return [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
