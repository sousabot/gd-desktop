import React, { useEffect, useState } from 'react';
import OverlayHud from './OverlayHud';
import './Overlays.css';

export default function Overlays() {
  const [open, setOpen] = useState(false);
  const [clickThrough, setClickThrough] = useState(true);
  const [inGame, setInGame] = useState(false);
  const [video, setVideo] = useState(null);
  const [status, setStatus] = useState(null);
  const hasApi = typeof window !== 'undefined' && !!window.liveClient;

  const refresh = async () => {
    if (!window.liveClient) return;
    const [isOpen, through, snap, mode, st] = await Promise.all([
      window.liveClient.isOverlayOpen(),
      window.liveClient.getClickThrough(),
      window.liveClient.getSnapshot(),
      window.liveClient.getVideoMode?.() || Promise.resolve(null),
      window.liveClient.getStatus?.() || Promise.resolve(null),
    ]);
    setOpen(!!isOpen);
    setClickThrough(through !== false);
    setInGame(!!snap?.inGame);
    if (mode) setVideo(mode);
    if (st) setStatus(st);
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  const toggle = async () => {
    if (!window.liveClient) return;
    if (open) await window.liveClient.closeOverlay();
    else {
      const result = await window.liveClient.openOverlay();
      if (result?.video) setVideo(result.video);
    }
    refresh();
  };

  const toggleClick = async () => {
    if (!window.liveClient) return;
    const next = await window.liveClient.setClickThrough(!clickThrough);
    setClickThrough(!!next);
  };

  const modeLabel = video?.label;

  return (
    <div className="ovp-page">
      <header className="ovp-head">
        <div>
          <h1>Overlays</h1>
          <p>In-game Benchmark HUD for this PC. Uses League’s local Live Client Data — no Riot cloud key.</p>
        </div>
      </header>

      <section className="ovp-panel">
        <div className="ovp-row">
          <div>
            <h2>In-game HUD</h2>
            <p className="ovp-status">
              Overlay is <strong>{open ? 'on' : 'off'}</strong>
              {hasApi ? ` · ${inGame ? 'game detected' : 'waiting for a match'}` : ' · restart the desktop app to enable'}
              {status?.engine === 'overwolf'
                ? ` · ${status.injected ? `in-game${status.gameName ? ` (${status.gameName})` : ''}` : status.ready ? 'waiting to inject' : (status.phase === 'failed' ? 'overlay engine failed' : 'loading overlay engine')}`
                : modeLabel ? ` · League video: ${video?.label || modeLabel}` : ''}
              {status?.error ? ` · ${status.error}` : ''}
            </p>
          </div>
          <button type="button" className={`ovp-btn${open ? ' is-on' : ''}`} onClick={toggle} disabled={!hasApi}>
            {open ? 'Hide overlay' : 'Show overlay'}
          </button>
        </div>

        <label className="ovp-check">
          <input type="checkbox" checked={clickThrough} onChange={toggleClick} disabled={!hasApi} />
          Click-through (clicks go to League; hover the top bar to drag or close)
        </label>
        <p className="ovp-status">
          With the overlay on, press <strong>Ctrl+B</strong> in League to unlock the HUD, drag it, then Ctrl+B again to lock.
          Shop may still open — close it and keep dragging.
        </p>

        <div className="ovp-warn">
          {status?.engine === 'overwolf'
            ? (status?.error
              ? status.error
              : 'Fullscreen is fine. The HUD appears in-game after the overlay engine injects. Keep Rift.lol open until status says in-game, then click back into the match.')
            : 'This session is running as stock Electron, so Fullscreen still cannot show the HUD. Fully quit and run npm run dev again so Overwolf Electron starts.'}
        </div>
      </section>

      <section className="ovp-panel">
        <h2>Preview</h2>
        <OverlayHud preview />
      </section>
    </div>
  );
}
