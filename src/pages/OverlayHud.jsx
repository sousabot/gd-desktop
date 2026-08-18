import React, { useEffect, useState } from 'react';
import MARK from '../assets/logo-mark.png';
import './OverlayHud.css';

const MOCK = {
  inGame: true,
  gameTime: 197,
  you: { level: 1, cs: 0, goldTotal: 210 * (197 / 60), vision: 0 },
};

const XP_AT_LEVEL = [0, 0, 280, 660, 1140, 1720, 2400, 3180, 4060, 5040, 6120, 7300, 8580, 9960, 11440, 13020, 14700, 16480, 18360];

function targets(minutes) {
  const m = Math.max(0.2, minutes);
  const gpm = 380 + Math.min(m, 6) * 18 + Math.max(0, m - 6) * 3;
  const csm = 6.2 + Math.min(m, 15) * 0.1;
  const vis = 0.45 + Math.min(m, 20) * 0.065;
  const lvl = Math.min(18, 1 + m * 0.92);
  const expXp = XP_AT_LEVEL[Math.min(18, Math.floor(lvl))] + (lvl % 1) * 400;
  const expPct = Math.min(100, (expXp / 18360) * 100);
  return { gpm, csm, vis, lvl, expPct };
}

function rowsFromSnap(snap) {
  const you = snap.you || {};
  const minutes = Math.max(0.2, (snap.gameTime || 0) / 60);
  const t = targets(minutes);
  const gpm = (you.goldTotal ?? you.gold ?? 0) / minutes;
  const cs = Number(you.cs);
  const csm = (Number.isFinite(cs) ? cs : 0) / minutes;
  const vis = (you.vision || 0) / minutes;
  const lvl = you.level || 1;
  const xpNow = XP_AT_LEVEL[Math.min(18, lvl)] || 0;
  const xpPct = Math.min(100, (xpNow / 18360) * 100);
  return [
    { key: 'GPM', current: Math.round(gpm), target: Math.round(t.gpm), fmt: (n) => String(n) },
    { key: 'CSM', current: csm, target: t.csm, fmt: (n) => n.toFixed(2) },
    { key: 'XP', current: xpPct, target: t.expPct, fmt: (n) => `${Math.round(n)}%` },
    { key: 'VISION', current: vis, target: t.vis, fmt: (n) => n.toFixed(2) },
    { key: 'LVL', current: lvl, target: t.lvl, fmt: (n) => String(Math.round(n)) },
  ];
}

function HudCard({ snap, clickThrough, onClose, attached, applyHint, editing }) {
  const rows = rowsFromSnap(snap);

  return (
    <div
      className={`ov-bench${editing ? ' is-edit' : ''}`}
      onMouseDown={() => editing && window.liveClient?.startDrag?.()}
      onMouseEnter={() => window.liveClient?.setIgnoreMouse(false)}
      onMouseLeave={() => clickThrough && !editing && window.liveClient?.setIgnoreMouse(true)}
    >
      <div className="ov-tab">Benchmark</div>
      <span className="ov-c ov-c--tl" />
      <span className="ov-c ov-c--tr" />
      <span className="ov-c ov-c--bl" />
      <span className="ov-c ov-c--br" />

      <div className="ov-drag">
        <img className="ov-mark" src={MARK} alt="" />
        <span className="ov-brand">RIFT.LOL</span>
        {onClose && (
          <button type="button" className="ov-close" onClick={onClose} aria-label="Close overlay">×</button>
        )}
      </div>

      <ul className="ov-rows">
        {rows.map((row) => {
          const behind = row.current + 0.001 < row.target;
          return (
            <li key={row.key}>
              <span className="ov-label">{row.key}</span>
              <span className={`ov-now${behind ? ' is-low' : ' is-ok'}`}>{row.fmt(row.current)}</span>
              <span className="ov-sep">/</span>
              <span className="ov-tgt">{row.fmt(row.target)}</span>
            </li>
          );
        })}
      </ul>
      {editing && <p className="ov-edit-hint">Drag to move · Ctrl+B to lock</p>}
      {attached === false && !editing && <p className="ov-hint">not on League window</p>}
      {applyHint && !editing && <p className="ov-hint">{applyHint}</p>}
    </div>
  );
}

export default function OverlayHud({ preview = false }) {
  const [snap, setSnap] = useState(preview ? MOCK : { inGame: false });
  const [clickThrough, setClickThrough] = useState(true);
  const [editing, setEditing] = useState(false);
  const [attached, setAttached] = useState(null);
  const [applyHint, setApplyHint] = useState('');

  useEffect(() => {
    if (preview) return undefined;
    document.documentElement.classList.add('rift-overlay');
    window.liveClient?.getClickThrough?.().then((v) => setClickThrough(v !== false));
    window.liveClient?.isEditMode?.().then((v) => setEditing(!!v));
    const offEdit = window.liveClient?.onEditMode?.((v) => setEditing(!!v));
    window.liveClient?.getStatus?.().then((st) => {
      if (st?.engine === 'overwolf') setApplyHint(st.injected ? '' : 'Waiting to inject into League');
      else if (st?.engine !== 'overwolf' && window.liveClient?.getVideoHint) {
        window.liveClient.getVideoHint().then((v) => {
          if (v?.applyNow) setApplyHint('Esc → Video → Borderless → Apply');
        });
      }
    });
    const offStatus = window.liveClient?.onStatus?.((st) => {
      if (st?.engine === 'overwolf') setApplyHint(st.injected ? '' : (st.error || 'Waiting to inject into League'));
    });
    const offVideo = window.liveClient?.onVideoHint?.((v) => {
      if (v?.applyNow && v?.engine !== 'overwolf') setApplyHint('Esc → Video → Borderless → Apply');
    });
    window.liveClient?.isAttached?.().then((v) => setAttached(!!v));
    const offAttach = window.liveClient?.onAttached?.((v) => setAttached(!!v));
    let alive = true;
    const tick = async () => {
      if (!window.liveClient?.getSnapshot) return;
      const next = await window.liveClient.getSnapshot();
      if (alive) setSnap(next || { inGame: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
      offStatus?.();
      offVideo?.();
      offAttach?.();
      offEdit?.();
      document.documentElement.classList.remove('rift-overlay');
    };
  }, [preview]);

  if (preview) {
    return (
      <div className="ov-preview">
        <HudCard snap={MOCK} clickThrough={false} />
      </div>
    );
  }

  return (
    <div className="ov-root">
      {snap.inGame ? (
        <HudCard
          snap={snap}
          clickThrough={clickThrough}
          attached={attached}
          applyHint={applyHint}
          editing={editing}
          onClose={() => window.liveClient?.closeOverlay()}
        />
      ) : (
        <div
          className={`ov-wait${editing ? ' is-edit' : ''}`}
          onMouseDown={() => editing && window.liveClient?.startDrag?.()}
          onMouseEnter={() => window.liveClient?.setIgnoreMouse(false)}
          onMouseLeave={() => clickThrough && !editing && window.liveClient?.setIgnoreMouse(true)}
        >
          <div className="ov-tab">Benchmark</div>
          <p>Waiting for a League game on this PC.</p>
          {editing && <p className="ov-edit-hint">Drag to move · Ctrl+B to lock</p>}
          <button type="button" onClick={() => window.liveClient?.closeOverlay()}>Close</button>
        </div>
      )}
    </div>
  );
}
