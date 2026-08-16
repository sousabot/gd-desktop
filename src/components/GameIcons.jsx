import React, { useEffect, useState } from 'react';
import {
  champIconUrl,
  champLoadingUrl,
  itemIconCdragon,
  itemIconUrl,
  runeIconUrl,
  spellIconUrl,
  useDdragonVersion,
  useRuneIndex,
  useSpellMap,
} from '../services/ddragon';
import './GameIcons.css';

export function ChampionIcon({ name, size = 36, className = '', title }) {
  const version = useDdragonVersion();
  const [src, setSrc] = useState(() => champIconUrl(name, version));
  useEffect(() => { setSrc(champIconUrl(name, version)); }, [name, version]);
  return (
    <img
      src={src}
      alt={name || ''}
      title={title || name}
      className={`gd-champ-icon ${className}`.trim()}
      style={{ width: size, height: size }}
      onError={() => setSrc(champIconUrl('Aatrox', version))}
    />
  );
}

export function ChampionPortrait({ name, className = '' }) {
  const [src, setSrc] = useState(() => (name ? champLoadingUrl(name) : ''));
  const [failed, setFailed] = useState(!name);
  useEffect(() => {
    setSrc(name ? champLoadingUrl(name) : '');
    setFailed(!name);
  }, [name]);
  if (!name || failed) {
    return <div className={`gd-champ-portrait is-empty ${className}`.trim()} />;
  }
  return (
    <img
      src={src}
      alt={name}
      className={`gd-champ-portrait ${className}`.trim()}
      onError={() => setFailed(true)}
    />
  );
}

export function ItemIcon({ id, size = 28, title }) {
  const version = useDdragonVersion();
  const [src, setSrc] = useState(() => (id ? itemIconCdragon(id) : ''));
  useEffect(() => { setSrc(id ? itemIconCdragon(id) : ''); }, [id]);
  if (!id) {
    return <span className="gd-item-empty" style={{ width: size, height: size }} title={title} />;
  }
  return (
    <img
      src={src}
      alt={title || ''}
      title={title || ''}
      className="gd-item-icon"
      style={{ width: size, height: size }}
      onError={() => setSrc(itemIconUrl(id, version))}
    />
  );
}

export function SpellIcon({ id, size = 22 }) {
  const version = useDdragonVersion();
  const map = useSpellMap();
  return (
    <img
      src={spellIconUrl(id, version, map)}
      alt=""
      className="gd-spell-icon"
      style={{ width: size, height: size }}
    />
  );
}

export function RuneIcon({ id, size = 28 }) {
  const index = useRuneIndex();
  const n = Number(id);
  const src = runeIconUrl(n, index);
  const name = index[n]?.name || '';
  if (!src) return <span className="gd-item-empty" style={{ width: size, height: size }} />;
  return (
    <img
      src={src}
      alt={name}
      title={name}
      className="gd-rune-icon"
      style={{ width: size, height: size }}
    />
  );
}
