import { useEffect, useState } from 'react';

const FALLBACK_VERSION = '14.24.1';
let cached = FALLBACK_VERSION;
let pending = null;

export function getDdragonVersion() {
  if (!pending) {
    pending = fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then((r) => r.json())
      .then((versions) => {
        cached = versions[0] || FALLBACK_VERSION;
        return cached;
      })
      .catch(() => cached);
  }
  return pending;
}

export function useDdragonVersion() {
  const [version, setVersion] = useState(cached);
  useEffect(() => {
    getDdragonVersion().then(setVersion);
  }, []);
  return version;
}

export function champIconUrl(name, version = cached) {
  const id = String(name || 'Aatrox').replace(/[^a-zA-Z0-9]/g, '').replace(/^./, (c) => c.toUpperCase());
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`;
}

export function profileIconUrl(id, version = cached) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${id}.png`;
}

export function itemIconUrl(id, version = cached) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`;
}

export const PLATFORM_LABELS = { euw1: 'EUW', na1: 'NA', kr: 'KR' };
export function platformLabel(platform) {
  return PLATFORM_LABELS[platform] || 'EUW';
}

const SPELL_FALLBACK = {
  1: 'SummonerBoost',
  3: 'SummonerExhaust',
  4: 'SummonerFlash',
  6: 'SummonerHaste',
  7: 'SummonerHeal',
  11: 'SummonerSmite',
  12: 'SummonerTeleport',
  13: 'SummonerMana',
  14: 'SummonerDot',
  21: 'SummonerBarrier',
  32: 'SummonerSnowball',
  39: 'SummonerSnowURFSnowball_Mark',
};

let spellMapPromise = null;
export function getSpellMap() {
  if (!spellMapPromise) {
    spellMapPromise = getDdragonVersion()
      .then((v) => fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/summoner.json`))
      .then((r) => r.json())
      .then((data) => {
        const byId = { ...SPELL_FALLBACK };
        Object.values(data.data || {}).forEach((s) => { byId[Number(s.key)] = s.id; });
        return byId;
      })
      .catch(() => ({ ...SPELL_FALLBACK }));
  }
  return spellMapPromise;
}

export function useSpellMap() {
  const [map, setMap] = useState(SPELL_FALLBACK);
  useEffect(() => { getSpellMap().then(setMap); }, []);
  return map;
}

export function spellIconUrl(spellId, version = cached, spellMap = SPELL_FALLBACK) {
  const id = spellMap[Number(spellId)] || SPELL_FALLBACK[Number(spellId)] || 'SummonerFlash';
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${id}.png`;
}

let runeIndexPromise = null;
export function getRuneIndex() {
  if (!runeIndexPromise) {
    runeIndexPromise = getDdragonVersion()
      .then((v) => fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/runesReforged.json`))
      .then((r) => r.json())
      .then((trees) => {
        const byId = {};
        (trees || []).forEach((tree) => {
          byId[tree.id] = { name: tree.name, icon: tree.icon };
          (tree.slots || []).forEach((slot) => {
            (slot.runes || []).forEach((rune) => {
              byId[rune.id] = { name: rune.name, icon: rune.icon };
            });
          });
        });
        return byId;
      })
      .catch(() => ({}));
  }
  return runeIndexPromise;
}

export function useRuneIndex() {
  const [index, setIndex] = useState({});
  useEffect(() => { getRuneIndex().then(setIndex); }, []);
  return index;
}

export function runeIconUrl(id, index = {}) {
  const icon = index[id]?.icon;
  if (!icon) return null;
  return `https://ddragon.leagueoflegends.com/cdn/img/${icon}`;
}
