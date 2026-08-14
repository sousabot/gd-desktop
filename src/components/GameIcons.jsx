import React, { useEffect, useState } from 'react';
import {
  champIconUrl,
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

export function ItemIcon({ id, size = 28 }) {
  const version = useDdragonVersion();
  if (!id) {
    return <span className="gd-item-empty" style={{ width: size, height: size }} />;
  }
  return (
    <img
      src={itemIconUrl(id, version)}
      alt=""
      className="gd-item-icon"
      style={{ width: size, height: size }}
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
  const src = runeIconUrl(id, index);
  if (!src) return <span className="gd-item-empty" style={{ width: size, height: size }} />;
  return (
    <img
      src={src}
      alt={index[id]?.name || ''}
      title={index[id]?.name}
      className="gd-rune-icon"
      style={{ width: size, height: size }}
    />
  );
}
