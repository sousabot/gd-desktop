import React, { useEffect, useMemo, useState } from 'react';
import { ItemIcon, ChampionIcon, ChampionPortrait, RuneIcon, SpellIcon } from '../components/GameIcons';
import RoleIcon from '../components/RoleIcon';
import {
  adviseDraft,
  adviseBans,
  catalogFromIndex,
  compareSketch,
  draftLean,
  duoLink,
  isBanPhase,
  matchupGrade,
  padSeats,
  runePagesFor,
  DUO_ROLE,
} from '../lib/draftAdvice';
import { typicalLane } from '../lib/champLane';
import { refreshRunePages } from '../lib/runePages';
import { getDdragonVersion, useRuneTrees, champSpellImgUrl, champPassiveImgUrl, useItemNameIndex } from '../services/ddragon';
import { getDraftPool } from '../services/riotApi';
import { coreItemNames, buildItemNames, resolveItemId, keystoneId, timeAgo, treeId } from '../lib/probuilds';
import { useSession } from '../state/SessionContext';
import './Draft.css';

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
const POS_FROM_LCU = { Top: 'Top', Jungle: 'Jungle', Mid: 'Mid', ADC: 'ADC', Support: 'Support' };
const COMP_ROWS = [
  ['early', 'Early game'],
  ['mid', 'Mid game'],
  ['late', 'Late game'],
  ['taken', 'Damage taken'],
  ['dealt', 'Damage dealt'],
];

function phaseLabel(phase) {
  const p = String(phase || '').toUpperCase();
  if (p.includes('BAN')) return 'Bans';
  if (p.includes('FINAL')) return 'Lock in';
  if (p.includes('GAME')) return 'Game starting';
  if (p.includes('PLAN')) return 'Planning';
  if (p.includes('IN_GAME') || p.includes('INPROGRESS')) return 'In game';
  return 'Pick';
}

function enrichSeat(seat, catalog) {
  if (!seat) return seat;
  const meta = catalog.find((c) => (
    c.id === seat.shownId
    || c.id === seat.championId
    || c.key === seat.name
  ));
  return {
    ...seat,
    name: seat.name || meta?.key || null,
    displayName: seat.displayName || meta?.name || null,
    tags: (seat.tags && seat.tags.length) ? seat.tags : (meta?.tags || []),
    info: meta?.info || {},
  };
}

function damageMix(champ) {
  const ad = Number(champ?.info?.attack) || 0;
  const ap = Number(champ?.info?.magic) || 0;
  const tot = ad + ap;
  if (tot <= 0) {
    const tags = champ?.tags || [];
    const phys = tags.some((t) => t === 'Marksman' || t === 'Fighter' || t === 'Assassin' || t === 'Tank');
    const mag = tags.includes('Mage') || tags.includes('Support');
    if (phys && mag) return { ad: 50, ap: 50 };
    if (mag) return { ad: 20, ap: 80 };
    if (phys) return { ad: 80, ap: 20 };
    return { ad: 50, ap: 50 };
  }
  return { ad: Math.round((100 * ad) / tot), ap: 100 - Math.round((100 * ad) / tot) };
}

function banIds(session) {
  return (session?.bans || []).map((b) => (typeof b === 'object' ? b.id : b)).filter((id) => Number(id) > 0);
}

function useProbuilds(champion, role) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('idle');
  useEffect(() => {
    if (!champion || !window.probuildsAPI?.list) {
      setRows([]);
      setStatus('idle');
      return undefined;
    }
    let alive = true;
    setStatus('loading');
    window.probuildsAPI.list({ champion, role }).then((res) => {
      if (!alive) return;
      setRows(res.rows || []);
      setStatus(res.ok ? 'ready' : 'error');
    }).catch(() => {
      if (!alive) return;
      setRows([]);
      setStatus('error');
    });
    return () => { alive = false; };
  }, [champion, role]);
  return { rows, status };
}

export default function Draft() {
  const { session: account } = useSession();
  const trees = useRuneTrees();
  const [session, setSession] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [role, setRole] = useState('Mid');
  const [runeMsg, setRuneMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [focusKey, setFocusKey] = useState(null);
  const [pool, setPool] = useState({ mastery: {}, recent: {} });
  const [roleLocked, setRoleLocked] = useState(false);
  const [runeOption, setRuneOption] = useState(null);
  const [runeTick, setRuneTick] = useState(0);
  const [imported, setImported] = useState({ runes: false, spells: false, pageId: null });
  const [masteryOnly, setMasteryOnly] = useState(false);
  const [pickMsg, setPickMsg] = useState('');
  const [kit, setKit] = useState(null);

  useEffect(() => {
    let alive = true;
    getDdragonVersion()
      .then((v) => fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion.json`))
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const byId = {};
        Object.values(data.data || {}).forEach((c) => {
          byId[Number(c.key)] = {
            id: Number(c.key),
            key: c.id,
            name: c.name,
            tags: c.tags || [],
            info: c.info || {},
          };
        });
        setCatalog(catalogFromIndex(byId));
      })
      .catch(() => { if (alive) setCatalogError('Could not load the champion list.'); });
    refreshRunePages().then(() => { if (alive) setRuneTick((n) => n + 1); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!account?.gameName || !account?.tagLine) {
      setPool({ mastery: {}, recent: {} });
      return undefined;
    }
    let alive = true;
    getDraftPool({
      gameName: account.gameName,
      tagLine: account.tagLine,
      region: account.region || 'europe',
      platform: account.platform || 'euw1',
    }).then((next) => { if (alive) setPool(next); }).catch(() => {
      if (alive) setPool({ mastery: {}, recent: {} });
    });
    return () => { alive = false; };
  }, [account?.gameName, account?.tagLine, account?.region, account?.platform]);

  useEffect(() => {
    if (!window.lcuAPI?.getChampSelect) return undefined;
    let alive = true;
    const tick = async () => {
      try {
        const next = await window.lcuAPI.getChampSelect();
        if (alive) setSession(next);
      } catch {
        if (alive) setSession({ connected: false, inSelect: false });
      }
    };
    tick();
    const id = setInterval(tick, 1200);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const live = !!session?.inSelect;
  const you = session?.you || null;

  useEffect(() => {
    setRoleLocked(false);
  }, [you?.cellId, session?.inSelect, session?.source]);

  useEffect(() => {
    if (roleLocked) return;
    const next = POS_FROM_LCU[you?.position];
    if (next) setRole(next);
  }, [you?.position, roleLocked]);

  const activeRole = role;
  const enemies = live ? (session.enemies || []).map((s) => enrichSeat(s, catalog)) : [];
  const allies = live ? (session.allies || []).map((s) => enrichSeat(s, catalog)) : [];
  const enemyLane = live
    ? enemies.find((e) => e.position === activeRole && e.shownId)
      || enemies.find((e) => e.shownId && typicalLane(e.name) === activeRole)
      || null
    : null;
  const allyDuo = live
    ? allies.find((a) => !a.isYou && a.position === DUO_ROLE[activeRole] && a.shownId) || null
    : null;

  const youChamp = live && (you?.championId || you?.intentId || you?.shownId)
    ? catalog.find((c) => c.id === (you.championId || you.intentId || you.shownId))
    : null;

  const lockedIn = live && Number(you?.championId) > 0;
  const banPhase = live && isBanPhase(session);

  useEffect(() => {
    setFocusKey(null);
  }, [banPhase, activeRole, you?.championId]);

  const advice = useMemo(() => adviseDraft({
    role: activeRole,
    youChamp,
    enemyLane: enemyLane ? { name: enemyLane.key || enemyLane.name, tags: enemyLane.tags || [] } : null,
    allyDuo: allyDuo ? { name: allyDuo.name || allyDuo.key, tags: allyDuo.tags || [] } : null,
    enemies: live ? enemies.filter((e) => e.name).map((e) => ({ name: e.name, tags: e.tags || [] })) : [],
    bans: live ? banIds(session) : [],
    taken: live ? [...allies, ...enemies].map((p) => p.championId).filter(Boolean) : [],
    owned: live ? session.owned : catalog.map((c) => c.id),
    pickable: live ? session.pickable : [],
    catalog,
    pool,
  }), [live, activeRole, youChamp, enemyLane, allyDuo, enemies, allies, session, catalog, pool]);

  const banAdvice = useMemo(() => adviseBans({
    role: activeRole,
    bans: live ? banIds(session) : [],
    bannable: live ? (session.bannable || []) : [],
    catalog,
    pool,
  }), [activeRole, live, session, catalog, pool]);

  const suggestions = useMemo(() => {
    const rows = banPhase ? banAdvice : advice.picks;
    if (!masteryOnly) return rows;
    return rows.filter((c) => (pool.mastery?.[c.id]?.level || 0) >= 3);
  }, [banPhase, banAdvice, advice.picks, masteryOnly, pool]);
  const featured = suggestions.find((c) => c.key === focusKey) || suggestions[0] || null;
  const allyBoard = useMemo(() => padSeats(allies), [allies]);
  const enemyBoard = useMemo(() => padSeats(enemies), [enemies]);
  const lean = useMemo(() => draftLean(allyBoard, enemyBoard), [allyBoard, enemyBoard]);
  const sketch = useMemo(() => compareSketch(allyBoard, enemyBoard), [allyBoard, enemyBoard]);

  const lockedName = lockedIn ? youChamp?.key : null;
  const runeFocus = live ? (lockedName || focusKey || youChamp?.key || advice.picks[0]?.key) : null;
  const pickChamp = catalog.find((c) => c.key === runeFocus) || youChamp || null;
  const pickGrade = matchupGrade(pickChamp, enemyLane, activeRole);
  const runePages = useMemo(() => {
    if (!runeFocus) return [];
    return runePagesFor(runeFocus, activeRole, {
      enemyLane: enemyLane ? { name: enemyLane.key || enemyLane.name, tags: enemyLane.tags || [] } : null,
      enemies: live
        ? enemies.filter((e) => e.name).map((e) => ({ name: e.name, tags: e.tags || [] }))
        : [],
    });
  }, [runeFocus, activeRole, enemyLane, enemies, live, runeTick]);
  const runes = runePages.find((p) => p.id === runeOption) || runePages.find((p) => p.recommended) || runePages[0];

  useEffect(() => {
    setRuneOption(null);
    setImported({ runes: false, spells: false, pageId: null });
  }, [runeFocus]);

  useEffect(() => {
    if (!lockedIn || !youChamp?.key) {
      setKit(null);
      return undefined;
    }
    let alive = true;
    getDdragonVersion()
      .then((v) => fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion/${youChamp.key}.json`))
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const c = data.data?.[youChamp.key];
        setKit(c ? { version: data.version, passive: c.passive, spells: c.spells || [] } : null);
      })
      .catch(() => { if (alive) setKit(null); });
    return () => { alive = false; };
  }, [lockedIn, youChamp?.key]);

  const sendRunes = async () => {
    if (!window.lcuAPI?.applyRunes || !runes) return;
    setSending(true);
    setRuneMsg('');
    try {
      const result = await window.lcuAPI.applyRunes(runes);
      if (result.ok) {
        setImported({ runes: true, spells: !!result.spells, pageId: runes.id });
        setRuneMsg(result.spells
          ? 'Runes and summoners sent to League.'
          : 'Rune page sent to League.');
      } else {
        setRuneMsg(result.error || 'Could not write runes.');
      }
    } catch (err) {
      setRuneMsg(err.message || 'Could not write runes.');
    } finally {
      setSending(false);
    }
  };

  const runesImported = imported.runes && imported.pageId === runes?.id;
  const spellsImported = imported.spells && imported.pageId === runes?.id;
  const canAct = !!session?.acting;
  const hasMastery = Object.keys(pool.mastery || {}).length > 0;

  const hoverChamp = async (champ) => {
    if (!champ) return;
    setFocusKey(champ.key);
    if (!window.lcuAPI?.selectChamp) return;
    const result = await window.lcuAPI.selectChamp({ championId: champ.id, lock: false });
    if (!result.ok && result.error) setPickMsg(result.error);
    else setPickMsg('');
  };

  const lockChamp = async (champ) => {
    if (!champ || !window.lcuAPI?.selectChamp) return;
    setFocusKey(champ.key);
    const result = await window.lcuAPI.selectChamp({ championId: champ.id, lock: true });
    setPickMsg(result.ok
      ? (banPhase ? `Banned ${champ.name}.` : `Locked ${champ.name}.`)
      : (result.error || 'Could not lock that champion.'));
  };

  const status = live
    ? 'In champ select'
    : session?.source === 'in-game' || String(session?.gameflow || '').toUpperCase().includes('INPROGRESS')
      ? 'In game'
      : session?.connected
        ? 'Waiting'
        : 'League closed';

  const waitCopy = !session?.connected
    ? { title: 'Waiting for match to start', body: 'Open the League client and queue. Draft opens when champion select starts.' }
    : session?.source === 'in-game' || String(session?.gameflow || '').toUpperCase().includes('INPROGRESS')
      ? { title: 'In game', body: 'Draft will open again in the next champion select.' }
      : { title: 'Waiting for match to start', body: 'Queue into a match. This page fills in when champion select starts.' };

  return (
    <div className="dr-page">
      <div className="dr-head">
        <div>
          <h1>Draft</h1>
          <p className="dr-sub">
            {live
              ? `${banPhase ? 'Ban phase' : phaseLabel(session.phase)} · ${activeRole}${allyDuo?.displayName ? ` · duo ${allyDuo.displayName}` : ''}`
              : waitCopy.body}
          </p>
        </div>
        <div className={`dr-pill${live ? ' is-live' : session?.connected ? ' is-idle' : ''}`}>
          {status}
        </div>
      </div>

      {catalogError ? <p className="dr-hint">{catalogError}</p> : null}

      {!live ? (
        <div className="dr-wait">
          <strong>{waitCopy.title}</strong>
          <p>{waitCopy.body}</p>
        </div>
      ) : (
        <>
          <DraftBoard
            bans={session.bans}
            allies={allyBoard}
            enemies={enemyBoard}
            lean={lean}
            sketch={sketch}
          />

          <section className="dr-your">
            <div className="dr-your-head">
              <h2>Your pick</h2>
              <span>GD matchup notes · Riot recommended pages</span>
            </div>

            {lockedIn ? (
              <Loadout
                pickChamp={pickChamp}
                pickGrade={pickGrade}
                activeRole={activeRole}
                roles={ROLES}
                onRole={(r) => { setRole(r); setRoleLocked(true); }}
                runePages={runePages}
                runes={runes}
                onRune={setRuneOption}
                runesImported={runesImported}
                spellsImported={spellsImported}
                trees={trees}
                kit={kit}
                sending={sending}
                onSend={sendRunes}
                runeMsg={runeMsg}
                disclaimer={advice.disclaimer}
                proChamp={pickChamp?.name}
              />
            ) : (
              <PickSuggestions
                banPhase={banPhase}
                suggestions={suggestions}
                featured={featured}
                enemyLane={enemyLane}
                activeRole={activeRole}
                masteryOnly={masteryOnly}
                hasMastery={hasMastery}
                canAct={canAct}
                pickMsg={pickMsg}
                onMastery={() => setMasteryOnly((v) => !v)}
                onHover={hoverChamp}
                onLock={() => lockChamp(featured)}
                pool={pool}
                disclaimer={advice.disclaimer}
                proChamp={featured?.name}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ProbuildsList({ champion, role }) {
  const { rows, status } = useProbuilds(champion, role);
  const itemsByName = useItemNameIndex();
  const [openId, setOpenId] = useState(null);
  useEffect(() => { setOpenId(null); }, [champion, role]);
  if (!champion) return null;
  const open = rows.find((row) => row.id === openId) || null;

  if (open) {
    const items = buildItemNames(open.items).map((name) => ({
      name,
      id: resolveItemId(name, itemsByName),
    }));
    const key = keystoneId(open.keystone);
    const primary = treeId(open.primary);
    const sub = treeId(open.secondary);
    return (
      <div className="dr-side-card dr-pro dr-pro-page">
        <button type="button" className="dr-pro-back" onClick={() => setOpenId(null)}>
          ← Probuilds
        </button>
        <div className="dr-pro-page-who">
          <strong>{open.player}</strong>
          <em>{[open.team, timeAgo(open.at)].filter(Boolean).join(' · ')}</em>
        </div>
        <h4>Items this game</h4>
        <div className="dr-pro-build">
          {items.length ? items.map((item, i) => (
            <span key={`${open.id}-${item.id || item.name}-${i}`} className="dr-pro-slot" title={item.name}>
              <ItemIcon id={item.id} size={36} title={item.name} />
              <em>{item.name}</em>
            </span>
          )) : <p className="dr-empty">No items listed on that scoreboard.</p>}
        </div>
        <h4>Runes</h4>
        <div className="dr-pro-page-runes">
          {key ? <RuneIcon id={key} size={32} /> : null}
          {primary ? <RuneIcon id={primary} size={20} /> : null}
          {sub ? <RuneIcon id={sub} size={20} /> : null}
          <span>{[open.keystone, open.primary, open.secondary].filter(Boolean).join(' · ')}</span>
        </div>
        <p className="dr-pro-src">End-game items from the Leaguepedia scoreboard — not a path we invented.</p>
      </div>
    );
  }

  return (
    <div className="dr-side-card dr-pro">
      <h3>Probuilds</h3>
      {status === 'loading' && !rows.length ? <p className="dr-empty">Loading recent pro games…</p> : null}
      {status === 'error' ? <p className="dr-empty">Could not reach Leaguepedia.</p> : null}
      {status === 'ready' && !rows.length ? (
        <p className="dr-empty">No recent pro games on this champion.</p>
      ) : null}
      {rows.map((row) => {
        const cores = coreItemNames(row.items)
          .map((name) => ({ name, id: resolveItemId(name, itemsByName) }))
          .filter((item) => item.id);
        const key = keystoneId(row.keystone);
        const sub = treeId(row.secondary);
        return (
          <button
            key={row.id}
            type="button"
            className="dr-pro-row"
            title={`${row.team || ''} ${row.at || ''}`.trim()}
            onClick={() => setOpenId(row.id)}
          >
            <div className="dr-pro-who">
              <strong>{row.player}</strong>
              <em>{[row.team, timeAgo(row.at)].filter(Boolean).join(' · ')}</em>
            </div>
            <span className="dr-pro-runes">
              {key ? <RuneIcon id={key} size={26} /> : null}
              {sub ? <RuneIcon id={sub} size={16} /> : null}
            </span>
            <span className="dr-pro-items">
              {cores.map((item) => (
                <ItemIcon key={`${row.id}-${item.id}`} id={item.id} size={26} title={item.name} />
              ))}
            </span>
          </button>
        );
      })}
      <p className="dr-pro-src">Leaguepedia scoreboards · click a row for the full item list</p>
    </div>
  );
}

function PickSuggestions({
  banPhase,
  suggestions,
  featured,
  enemyLane,
  activeRole,
  masteryOnly,
  hasMastery,
  canAct,
  pickMsg,
  onMastery,
  onHover,
  onLock,
  pool,
  disclaimer,
  proChamp,
}) {
  return (
    <div className="dr-picks-wrap">
      <div className="dr-rec-tools">
        <button type="button" className="dr-lock" onClick={onLock} disabled={!featured || !canAct}>
          {banPhase ? 'Ban' : 'Lock'}
        </button>
        <button
          type="button"
          className={`dr-filter${masteryOnly ? ' is-on' : ''}`}
          onClick={onMastery}
          disabled={!hasMastery}
          title={hasMastery ? 'Only champions at mastery 3 or higher' : 'Link an account to filter by mastery'}
        >
          Mastery 3+
        </button>
        <span className="dr-rec-role" title={activeRole}>
          <RoleIcon role={activeRole} size={16} />
        </span>
      </div>

      {!suggestions.length ? (
        <p className="dr-empty">
          {banPhase ? 'No ban suggestions left for this role.' : 'Waiting on the lobby.'}
        </p>
      ) : (
        <div className="dr-recs">
          {suggestions.map((c) => {
            const grade = matchupGrade(c, enemyLane, activeRole);
            const on = featured?.id === c.id;
            const mix = damageMix(c);
            const mastery = pool.mastery?.[c.id]?.level || 0;
            return (
              <button
                key={c.id}
                type="button"
                className={`dr-rec${on ? ' is-on' : ''}`}
                onClick={() => onHover(c)}
              >
                <span className="dr-rec-art">
                  <ChampionPortrait name={c.key} />
                  {grade?.grade ? (
                    <span className={`dr-rec-score is-${grade.grade}`}>{grade.grade}</span>
                  ) : null}
                </span>
                {on ? (
                  <span className="dr-rec-meta">
                    <strong>{c.name}</strong>
                    <em>{grade?.why || c.reasons[0] || `${activeRole} pick`}</em>
                    {mastery ? <em>Mastery {mastery}</em> : null}
                    <span className="dr-mix" title="Riot champion ratings, not live damage">
                      <i className="is-ad" style={{ width: `${mix.ad}%` }} />
                      <i className="is-ap" style={{ width: `${mix.ap}%` }} />
                    </span>
                    <small>AD {mix.ad} · AP {mix.ap}</small>
                  </span>
                ) : (
                  <span className="dr-rec-name">{c.name}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {pickMsg ? <p className="dr-hint">{pickMsg}</p> : null}
      <ProbuildsList champion={proChamp} role={activeRole} />
      <p className="dr-disclaimer">{disclaimer}</p>
    </div>
  );
}

function Loadout({
  pickChamp,
  pickGrade,
  activeRole,
  roles,
  onRole,
  runePages,
  runes,
  onRune,
  runesImported,
  spellsImported,
  trees,
  kit,
  sending,
  onSend,
  runeMsg,
  disclaimer,
  proChamp,
}) {
  return (
    <>
      <div className="dr-your-select">
        <div className={`dr-your-champ${pickGrade?.grade ? ` is-${pickGrade.grade}` : ''}`}>
          {pickChamp ? <ChampionIcon name={pickChamp.key} size={52} /> : <span className="dr-your-champ-empty" />}
          {pickGrade?.grade ? (
            <span className={`dr-your-grade is-${pickGrade.grade}`} title={pickGrade.why}>{pickGrade.grade}</span>
          ) : null}
        </div>
        <div className="dr-your-roles">
          {roles.map((r) => (
            <button
              key={r}
              type="button"
              className={r === activeRole ? 'is-on' : ''}
              title={r}
              onClick={() => onRole(r)}
            >
              <RoleIcon role={r} size={18} />
            </button>
          ))}
        </div>
      </div>

      <div className="dr-your-grid">
        <aside className="dr-your-side">
          <div className="dr-side-card">
            <h3>Builds</h3>
            {!runePages.length ? (
              <p className="dr-empty">No rune page for this champion yet.</p>
            ) : runePages.map((page) => {
              const on = runes?.id === page.id;
              return (
                <button
                  key={page.id}
                  type="button"
                  className={`dr-build${on ? ' is-on' : ''}${page.recommended ? ' is-rec' : ''}`}
                  onClick={() => onRune(page.id)}
                >
                  <RuneIcon id={page.selectedPerkIds?.[0]} size={28} />
                  <div>
                    <strong>{page.label}</strong>
                    <em>{page.why}</em>
                  </div>
                  <span className="dr-build-spells">
                    {(page.spells || []).map((id) => (
                      <SpellIcon key={`${page.id}-sp-${id}`} id={id} size={18} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <ProbuildsList champion={proChamp} role={activeRole} />
        </aside>

        <div className="dr-your-main">
          <div className="dr-block">
            <header>
              <h3>Summoners</h3>
              {spellsImported ? <span className="dr-imported">Imported</span> : null}
            </header>
            <div className="dr-summs">
              {(runes?.spells || []).map((id) => (
                <SpellIcon key={`sum-${id}`} id={id} size={40} />
              ))}
              {!runes?.spells?.length ? <p className="dr-empty">No summoner page yet.</p> : null}
            </div>
          </div>

          {kit?.spells?.length ? (
            <div className="dr-block">
              <header>
                <h3>Abilities</h3>
              </header>
              <div className="dr-kit">
                {kit.passive?.image?.full ? (
                  <img
                    src={champPassiveImgUrl(kit.passive.image.full, kit.version)}
                    alt={kit.passive.name}
                    title={kit.passive.name}
                  />
                ) : null}
                {kit.spells.map((spell) => (
                  <img
                    key={spell.id}
                    src={champSpellImgUrl(spell.image.full, kit.version)}
                    alt={spell.name}
                    title={spell.name}
                  />
                ))}
              </div>
              <p className="dr-hint">Champion kit — not a skill-order sample.</p>
            </div>
          ) : null}

          <div className="dr-block dr-block-runes">
            <header>
              <h3>Runes</h3>
              {runesImported ? <span className="dr-imported">Imported</span> : null}
            </header>
            <RuneTree page={runes} trees={trees} />
            {runes?.note ? <p className="dr-note">{runes.note}</p> : null}
          </div>

          <button type="button" className="dr-send" onClick={onSend} disabled={sending || !runes}>
            {sending ? 'Sending…' : `Send ${runes?.label || 'page'} to League`}
          </button>
          {runeMsg ? <p className="dr-hint">{runeMsg}</p> : null}
          <p className="dr-disclaimer">{disclaimer}</p>
        </div>
      </div>
    </>
  );
}

function DraftBoard({ bans, allies, enemies, lean, sketch }) {
  return (
    <div className="dr-overview">
      <LeanBar lean={lean} />
      <div className="dr-board">
        <TeamStrip seats={allies} others={enemies} />
        <div className="dr-comps">
          {COMP_ROWS.map(([key, label]) => (
            <CompRow key={key} label={label} row={sketch[key]} />
          ))}
        </div>
        <TeamStrip seats={enemies} others={allies} enemy />
      </div>
      <BanRow bans={bans} />
    </div>
  );
}

function TeamStrip({ seats, others, enemy }) {
  return (
    <div className={`dr-strip${enemy ? ' is-enemy' : ''}`}>
      <div className="dr-ports">
        {seats.map((seat, i) => (
          <DraftPortrait
            key={seat.cellId || `${enemy ? 'e' : 'a'}-${i}`}
            seat={seat}
            enemy={enemy}
            grade={matchupGrade(seat, others[i], seat.position)}
          />
        ))}
      </div>
      <LaneRow seats={seats} />
    </div>
  );
}

function LaneRow({ seats }) {
  return (
    <div className="dr-lanes">
      {seats.map((seat, i) => {
        const next = seats[i + 1];
        const link = next
          ? (duoLink(seat.name, next.name, seat.position) || duoLink(next.name, seat.name, next.position))
          : null;
        const plus = link && link.score >= 2;
        return (
          <span
            key={seat.cellId || `lane-${i}`}
            className={`dr-lane${plus ? ' has-plus' : ''}`}
            title={plus ? link.reason : seat.position}
          >
            <RoleIcon role={seat.position} size={14} />
            {plus ? <em>++</em> : null}
          </span>
        );
      })}
    </div>
  );
}

function LeanBar({ lean }) {
  return (
    <div className={`dr-lean${lean.ready ? '' : ' is-wait'}`}>
      <b className="is-ally">{lean.ready ? `${lean.ally}%` : '—'}</b>
      <div className="dr-lean-mid">
        <span>Draft lean</span>
        <div className="dr-lean-track">
          <i className="is-ally" style={{ width: `${lean.ally}%` }} />
          <i className="is-enemy" style={{ width: `${lean.enemy}%` }} />
        </div>
        <em>{lean.ready ? 'Matchup notes, not a live winrate' : 'Waiting on picks'}</em>
      </div>
      <b className="is-enemy">{lean.ready ? `${lean.enemy}%` : '—'}</b>
    </div>
  );
}

function CompRow({ label, row }) {
  return (
    <div className={`dr-comp${row.ready ? '' : ' is-wait'}`}>
      <span>{label}</span>
      <div className="dr-comp-track">
        <i className="is-ally" style={{ width: `${row.ally}%` }} />
        <i className="is-enemy" style={{ width: `${row.enemy}%` }} />
      </div>
    </div>
  );
}

function DraftPortrait({ seat, enemy, grade }) {
  return (
    <div
      className={`dr-port${seat.isYou ? ' is-you' : ''}${enemy ? ' is-enemy' : ''}${seat.locked ? ' is-locked' : ''}`}
      title={grade?.why || seat.displayName || seat.position}
    >
      <ChampionPortrait name={seat.name} />
      {grade?.grade ? (
        <span className={`dr-port-grade is-${grade.grade}`} title={grade.why}>{grade.grade}</span>
      ) : null}
    </div>
  );
}

function BanRow({ bans }) {
  const list = (bans || []).filter((b) => (typeof b === 'object' ? b.key : b));
  if (!list.length) return null;
  return (
    <div className="dr-bans">
      <span>Bans</span>
      {list.map((b, i) => (
        <ChampionIcon key={b.id || i} name={b.key} size={28} title={b.name || b.key} />
      ))}
    </div>
  );
}

function RuneTree({ page, trees }) {
  if (!page) return <p className="dr-empty">No rune page yet.</p>;
  const selected = new Set((page.selectedPerkIds || []).map(Number));
  const shards = (page.selectedPerkIds || []).slice(6);
  if (!trees?.length) {
    return (
      <div className="dr-runes-fallback">
        {(page.selectedPerkIds || []).map((id, i) => (
          <RuneIcon key={`fb-${i}-${id}`} id={id} size={i < 1 ? 34 : 24} />
        ))}
      </div>
    );
  }
  const primary = trees.find((t) => t.id === page.primaryStyleId);
  const secondary = trees.find((t) => t.id === page.subStyleId);
  return (
    <div className="dr-tree">
      <TreeColumn tree={primary} selected={selected} />
      <TreeColumn tree={secondary} selected={selected} skipKeystones />
      <div className="dr-shards">
        {shards.map((id, i) => (
          <RuneIcon key={`shard-${i}-${id}`} id={id} size={22} />
        ))}
      </div>
    </div>
  );
}

function TreeColumn({ tree, selected, skipKeystones }) {
  if (!tree) return <div className="dr-tree-col is-empty" />;
  const slots = skipKeystones ? (tree.slots || []).slice(1) : (tree.slots || []);
  return (
    <div className="dr-tree-col">
      <strong>{tree.name}</strong>
      {slots.map((slot, i) => (
        <div key={`${tree.id}-${i}`} className={`dr-tree-row${i === 0 && !skipKeystones ? ' is-key' : ''}`}>
          {(slot.runes || []).map((rune) => (
            <span key={rune.id} className={selected.has(rune.id) ? 'is-on' : ''}>
              <RuneIcon id={rune.id} size={i === 0 && !skipKeystones ? 34 : 24} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
