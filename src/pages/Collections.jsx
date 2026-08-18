import React, { useEffect, useMemo, useState } from 'react';
import { championIconUrl, getChampionIndex, getSkinsMeta, skinImageUrls, uniqueChampions } from '../lib/skinArt';
import { useI18n } from '../i18n/LocaleContext';
import './Collections.css';

function fmtRp(n) {
  return `${Number(n || 0).toLocaleString()} RP`;
}

const CHROMA_ONLY = /^(Jade|Ruby|Sapphire|Emerald|Obsidian|Pearl|Catseye|Tanzanite|Turquoise|Amethyst)$/i;

function rarityClass(rarity) {
  const key = String(rarity || '').toLowerCase();
  if (key.includes('ultimate') || key.includes('exalted')) return 'is-ultimate';
  if (key.includes('mythic') || key.includes('transcendent')) return 'is-mythic';
  if (key.includes('legendary')) return 'is-legendary';
  if (key.includes('epic')) return 'is-epic';
  return '';
}

function SkinCard({ skin, meta, champIndex }) {
  const urls = useMemo(() => skinImageUrls(skin, meta, champIndex), [skin, meta, champIndex]);
  const [urlIndex, setUrlIndex] = useState(0);
  const src = urls[urlIndex];

  useEffect(() => {
    setUrlIndex(0);
  }, [skin.id, urls[0]]);

  return (
    <article className={`cl-card ${rarityClass(skin.rarity)}`}>
      {src ? (
        <img
          src={src}
          alt=""
          onError={() => setUrlIndex((i) => i + 1)}
        />
      ) : (
        <div className="cl-card-ph" />
      )}
      <div className="cl-card-meta">
        <strong>{skin.name}</strong>
        <span>{skin.champion}{skin.rp ? ` · ${fmtRp(skin.rp)}` : ''}</span>
      </div>
    </article>
  );
}

function ChampCard({ champ, champIndex }) {
  const [src, setSrc] = useState(() => championIconUrl(champ, champIndex));
  const fallback = champIndex?.byKey?.get(Number(champ.id));
  const png = fallback?.version
    ? `https://ddragon.leagueoflegends.com/cdn/${fallback.version}/img/champion/${fallback.id}.png`
    : '';

  useEffect(() => {
    setSrc(championIconUrl(champ, champIndex));
  }, [champ.id, champIndex]);

  return (
    <article className={`cl-champ${champ.owned ? '' : ' is-locked'}`}>
      {src ? (
        <img
          src={src}
          alt=""
          onError={() => {
            if (png && src !== png) setSrc(png);
            else setSrc('');
          }}
        />
      ) : (
        <div className="cl-champ-ph" />
      )}
      <div>
        <strong>{champ.name}</strong>
        <span>{champ.owned ? `${champ.skinsOwned} / ${champ.skinsTotal} skins` : 'Not owned'}</span>
      </div>
    </article>
  );
}

export default function Collections() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({ byId: new Map(), total: 0 });
  const [champIndex, setChampIndex] = useState({ version: '', byKey: new Map() });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('skins');
  const hasApi = typeof window !== 'undefined' && !!window.lcuAPI;

  const load = async (force = false) => {
    if (!window.lcuAPI) {
      setLoading(false);
      setData({ connected: false, reason: 'no-api' });
      return;
    }
    setLoading(true);
    try {
      const next = await window.lcuAPI.getCollections(force);
      setData(next);
    } catch {
      setData({ connected: false, reason: 'inventory-failed' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getSkinsMeta().then(setMeta);
    getChampionIndex().then(setChampIndex);
    load(false);
    const id = setInterval(() => load(false), 20000);
    return () => clearInterval(id);
  }, []);

  const q = query.trim().toLowerCase();
  const champs = useMemo(
    () => uniqueChampions(data?.champions || [], champIndex),
    [data, champIndex],
  );

  const ownedSkins = useMemo(() => {
    const rows = [];
    for (const champ of champs) {
      for (const skin of champ.skins || []) {
        if (!skin.owned) continue;
        const info = meta.byId.get(Number(skin.id));
        if (info && !info.collectible) continue;
        if (!info && (skin.isBase || skin.isChroma || /^classic\b/i.test(skin.name || ''))) continue;
        if (CHROMA_ONLY.test(skin.name || '')) continue;
        rows.push({
          ...skin,
          champion: champ.name,
          alias: champ.alias,
          champId: champ.id,
        });
      }
    }

    const byId = new Map();
    for (const row of rows) {
      const id = Number(row.id);
      const prev = Number.isFinite(id) ? byId.get(id) : null;
      if (!prev || (row.rp || 0) > (prev.rp || 0)) byId.set(id, row);
    }

    const byName = new Map();
    for (const row of byId.values()) {
      const key = `${String(row.champion || '').toLowerCase()}::${String(row.name || '').toLowerCase().trim()}`;
      const prev = byName.get(key);
      if (!prev || (row.rp || 0) > (prev.rp || 0)) byName.set(key, row);
    }

    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [champs, meta]);

  const filteredSkins = q
    ? ownedSkins.filter((s) => `${s.name} ${s.champion}`.toLowerCase().includes(q))
    : ownedSkins;

  const filteredChamps = useMemo(() => {
    if (!q) return champs;
    return champs.filter((c) => String(c.name).toLowerCase().includes(q));
  }, [champs, q]);

  const waiting = !data?.connected;
  const reason = data?.reason || 'client-closed';
  const waitText = {
    'no-api': t('collections.clientClosed'),
    'not-logged-in': t('collections.clientClosed'),
    'inventory-failed': t('collections.invFail'),
    'client-closed': t('collections.clientClosed'),
  }[reason] || t('collections.clientClosed');

  const skinsOwned = ownedSkins.length;
  const skinsTotal = meta.total || data?.skinsTotal || 0;

  return (
    <div className="cl-page">
      <header className="cl-head">
        <div>
          <h1>{t('collections.title')}</h1>
          <p>
            {data?.connected
              ? t('collections.fromClient', { name: data.summoner?.displayName || data.summoner?.gameName || 'logged in' })
              : t('collections.offline')}
          </p>
        </div>
        <button type="button" className="cl-refresh" onClick={() => load(true)} disabled={loading || !hasApi}>
          {loading ? t('collections.loading') : t('collections.refresh')}
        </button>
      </header>

      {waiting ? (
        <div className="cl-empty">
          <h2>{loading ? t('collections.checkingTitle') : t('collections.disconnected')}</h2>
          <p>{loading ? t('collections.checking') : waitText}</p>
        </div>
      ) : (
        <>
          <section className="cl-stats">
            <div>
              <strong>{skinsOwned}</strong>
              <span>/ {skinsTotal} {t('collections.skins')}</span>
            </div>
            <div>
              <strong>{champs.filter((c) => c.owned).length}</strong>
              <span>/ {champs.length} {t('collections.champions')}</span>
            </div>
            <div>
              <strong>{fmtRp(data.rpValue)}</strong>
              <span>catalog value</span>
            </div>
          </section>

          <div className="cl-toolbar">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('collections.search')}
            />
            <div className="cl-tabs">
              <button type="button" className={tab === 'skins' ? 'is-on' : ''} onClick={() => setTab('skins')}>
                Skins
              </button>
              <button type="button" className={tab === 'champs' ? 'is-on' : ''} onClick={() => setTab('champs')}>
                Champions
              </button>
            </div>
          </div>

          {tab === 'skins' ? (
            <div className="cl-grid">
              {filteredSkins.map((skin) => (
                <SkinCard key={skin.id} skin={skin} meta={meta} champIndex={champIndex} />
              ))}
              {!filteredSkins.length && (
                <p className="cl-none">No owned skins match that search.</p>
              )}
            </div>
          ) : (
            <div className="cl-champs">
              {filteredChamps.map((champ) => (
                <ChampCard key={champ.id} champ={champ} champIndex={champIndex} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
