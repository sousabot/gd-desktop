import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Replays.css';
import { useI18n } from '../i18n/LocaleContext';

const api = typeof window !== 'undefined' ? window.replaysAPI : null;
const NO_SEGS = [];
const transcodeCache = new Map();

function fmtTime(s) {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtWhen(ms) {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function dayKey(ms) {
  const d = new Date(ms || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key, t) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const same = date.toDateString() === today.toDateString();
  if (same) return t('replays.today');
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (date.toDateString() === yest.toDateString()) return t('replays.yesterday');
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function normChamp(name = '') {
  return String(name).replace(/[^a-zA-Z0-9]/g, '').replace(/^./, (c) => c.toUpperCase());
}

function champIcon(name) {
  if (!name) return '';
  return `https://cdn.communitydragon.org/latest/champion/${encodeURIComponent(name)}/square`;
}

function splashImg(name) {
  const id = normChamp(name) || 'Corki';
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`;
}

function modeLabel(mode) {
  const key = String(mode || '').toUpperCase();
  if (key === 'CLASSIC') return "Summoner's Rift";
  if (key === 'PRACTICETOOL') return 'Practice tool';
  if (key === 'ARAM') return 'ARAM';
  return mode || 'Match';
}

function flattenClips(matches) {
  const items = [];
  for (const match of matches) {
    if (match.matchFile) {
      items.push({
        id: `${match.id}:match`,
        match,
        clip: { file: match.matchFile, duration: match.duration, label: 'Full match' },
        champion: match.champion,
        label: 'Full match',
        duration: match.duration || 0,
        at: match.startedAt,
        gameTime: 0,
        startAt: 0,
        full: true,
      });
    }
    for (const clip of match.clips || []) {
      items.push({
        id: `${match.id}:${clip.id}`,
        match,
        clip,
        champion: match.champion,
        label: clip.label || 'Kill',
        duration: clip.duration || 12,
        at: match.startedAt,
        gameTime: clip.gameTime,
        startAt: clip.start || 0,
      });
    }
  }
  return items;
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8.5 6.8v10.4L18 12 8.5 6.8Z" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M7 6h3.2v12H7V6Zm6.8 0H17v12h-3.2V6Z" />
    </svg>
  );
}
function IconFs() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" d="M8 5H5v3M16 5h3v3M8 19H5v-3M16 19h3v-3" />
    </svg>
  );
}

function pickSegment(segments, t) {
  if (!segments?.length) return null;
  let found = segments[0];
  for (const seg of segments) {
    if (t >= (Number(seg.start) || 0) - 0.05) found = seg;
    else break;
  }
  return found;
}

function ReplayPlayer({ src, durationHint, label, startAt = 0, segments = [], markers = [], onClose }) {
  const videoRef = useRef(null);
  const volumeRef = useRef(1);
  const segStartRef = useRef(Number(segments[0]?.start) || 0);
  const blobTried = useRef(false);
  const blobUrl = useRef(null);
  const srcRef = useRef(src);
  const [localSrc, setLocalSrc] = useState(segments[0]?.url || src);
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(Number(durationHint) || 0);
  const [volume, setVolume] = useState(1);
  const [fs, setFs] = useState(false);
  const [scrub, setScrub] = useState(null);

  const len = Math.max(duration, Number(durationHint) || 0, 0.1);
  const shown = scrub != null ? scrub : time;
  const pct = Math.min(100, (shown / len) * 100);
  const segKey = (segments || []).map((s) => s.url || s.file).join('|');
  const hasSegs = segments.length > 1;

  useEffect(() => {
    const first = segments[0]?.url || src;
    blobTried.current = false;
    srcRef.current = src;
    if (blobUrl.current) {
      URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = null;
    }
    setLocalSrc(first);
    segStartRef.current = Number(segments[0]?.start) || 0;
    setTime(0);
    setScrub(null);
    setPaused(true);
    setDuration(Number(durationHint) || 0);
  }, [src, durationHint, startAt, segKey]);

  useEffect(() => () => {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (fs) setFs(false);
        else onClose?.();
      }
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fs, onClose, paused]);

  async function loadSeekableBlob() {
    const original = srcRef.current;
    if (blobTried.current || !String(original).startsWith('gdreplay:')) return false;
    blobTried.current = true;
    try {
      const res = await fetch(original);
      const blob = await res.blob();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = URL.createObjectURL(blob);
      setLocalSrc(blobUrl.current);
      return true;
    } catch {
      return false;
    }
  }

  async function onLoaded() {
    const el = videoRef.current;
    if (!el) return;
    el.muted = volumeRef.current <= 0;
    el.volume = volumeRef.current;
    el.playbackRate = 1;
    const play = () => el.play().then(() => setPaused(false)).catch(() => setPaused(true));
    const base = Number(startAt) || 0;
    if (Number.isFinite(el.duration) && el.duration > 0.4 && el.duration < 36000) {
      setDuration(el.duration);
    }
    const seekEnd = el.seekable?.length ? el.seekable.end(el.seekable.length - 1) : 0;
    const unseekable = !Number.isFinite(el.duration) || el.duration === Infinity || seekEnd < 0.5;
    if (unseekable && String(localSrc).startsWith('gdreplay:')) {
      if (await loadSeekableBlob()) return;
    }
    if (base > 0.05) {
      el.addEventListener('seeked', play, { once: true });
      try { el.currentTime = base; } catch { play(); }
      return;
    }
    play();
  }

  function togglePlay() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.muted = volumeRef.current <= 0;
      el.playbackRate = 1;
      el.play().then(() => setPaused(false)).catch(() => {});
    } else {
      el.pause();
      setPaused(true);
    }
  }

  function clipTime(el) {
    const abs = hasSegs
      ? (segStartRef.current + (el.currentTime || 0))
      : (el.currentTime || 0);
    return Math.max(0, abs - (Number(startAt) || 0));
  }

  function seekTo(raw, { end } = {}) {
    const el = videoRef.current;
    const t = Math.max(0, Math.min(len, Number(raw)));
    if (end) {
      setScrub(null);
      setTime(t);
    } else {
      setScrub(t);
    }
    if (!el) return;
    const abs = (Number(startAt) || 0) + t;
    if (hasSegs) {
      const seg = pickSegment(segments, abs);
      if (!seg?.url) return;
      segStartRef.current = Number(seg.start) || 0;
      if (seg.url !== localSrc) {
        setLocalSrc(seg.url);
        return;
      }
      try { el.currentTime = Math.max(0, abs - segStartRef.current); } catch { /* ignore */ }
      return;
    }
    try { el.currentTime = abs; } catch { /* ignore */ }
    const want = abs;
    window.setTimeout(() => {
      const node = videoRef.current;
      if (!node || blobTried.current) return;
      if (Math.abs((node.currentTime || 0) - want) > 1.25) loadSeekableBlob();
    }, 280);
  }

  return (
    <div className={`rp-player${fs ? ' is-fs' : ''}`}>
      <div className="rp-stage" onDoubleClick={() => setFs((v) => !v)}>
        {label ? <span className="rp-badge">{label}</span> : null}
        <video
          ref={videoRef}
          key={localSrc}
          src={localSrc}
          preload="auto"
          onLoadedMetadata={onLoaded}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onTimeUpdate={(e) => {
            if (scrub != null) return;
            const node = e.currentTarget;
            const mediaLen = Number.isFinite(node.duration) && node.duration > 0.4 && node.duration < 36000
              ? node.duration
              : 0;
            if (mediaLen && mediaLen < len) setDuration(mediaLen);
            const rel = clipTime(node);
            if (node.ended) {
              setPaused(true);
              setTime(mediaLen || rel);
              return;
            }
            setTime(rel);
          }}
          onClick={togglePlay}
        />
        {paused ? (
          <button type="button" className="rp-play-big" onClick={togglePlay} aria-label="Play">
            <IconPlay />
          </button>
        ) : null}
      </div>
      <div className="rp-controls">
        <button type="button" className="rp-icon-btn" onClick={togglePlay} aria-label={paused ? 'Play' : 'Pause'}>
          {paused ? <IconPlay /> : <IconPause />}
        </button>
        <span className="rp-time">{fmtTime(shown)}</span>
        <div className="rp-seek-wrap">
          <div className="rp-seek-fill" style={{ width: `${pct}%` }} />
          {markers.map((mark, i) => (
            <span
              key={`${mark}-${i}`}
              className="rp-mark"
              style={{ left: `${Math.min(100, (Number(mark) / len) * 100)}%` }}
            />
          ))}
          <input
            className="rp-seek"
            type="range"
            min="0"
            max={len}
            step="0.1"
            value={Math.min(shown, len)}
            onInput={(e) => seekTo(e.currentTarget.value)}
            onChange={(e) => seekTo(e.currentTarget.value)}
            onPointerUp={(e) => seekTo(e.currentTarget.value, { end: true })}
            onMouseUp={(e) => seekTo(e.currentTarget.value, { end: true })}
            onKeyUp={(e) => seekTo(e.currentTarget.value, { end: true })}
          />
        </div>
        <span className="rp-time">{fmtTime(len)}</span>
        <input
          className="rp-vol"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            volumeRef.current = v;
            if (videoRef.current) {
              videoRef.current.muted = v <= 0;
              videoRef.current.volume = v;
            }
          }}
          aria-label="Volume"
        />
        <button type="button" className="rp-icon-btn" onClick={() => setFs((v) => !v)} aria-label="Fullscreen">
          <IconFs />
        </button>
      </div>
    </div>
  );
}

export default function Replays() {
  const { t } = useI18n();
  const [status, setStatus] = useState(null);
  const [matches, setMatches] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [champFilter, setChampFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [preparing, setPreparing] = useState(false);

  const items = useMemo(() => flattenClips(matches).map((item) => (
    item.full ? { ...item, label: t('replays.fullMatch'), clip: { ...item.clip, label: t('replays.fullMatch') } } : item
  )), [matches, t]);
  const champs = useMemo(() => [...new Set(items.map((i) => i.champion).filter(Boolean))].sort(), [items]);
  const days = useMemo(() => [...new Set(items.map((i) => dayKey(i.at)))], [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (champFilter !== 'all' && item.champion !== champFilter) return false;
      if (dayFilter !== 'all' && dayKey(item.at) !== dayFilter) return false;
      if (q && !`${item.label} ${item.champion}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, champFilter, dayFilter]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of filtered) {
      const key = dayKey(item.at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return [...map.entries()];
  }, [filtered]);

  async function refreshList() {
    if (!api) return;
    const list = await api.list();
    setMatches(Array.isArray(list) ? list : []);
  }

  useEffect(() => {
    if (!api) return undefined;
    let off = () => {};
    (async () => {
      const st = await api.getStatus();
      setStatus(st);
      await refreshList();
    })();
    off = api.onStatus((next) => {
      setStatus(next);
      refreshList();
    });
    const tick = setInterval(refreshList, 4000);
    return () => {
      off();
      clearInterval(tick);
    };
  }, []);

  async function playItem(item) {
    if (!api) return;
    const ownClip = !item.full && /^clips\//i.test(String(item.clip?.file || '').replace(/\\/g, '/'));
    const rel = ownClip
      ? item.clip.file
      : (item.match.matchFile || item.clip?.file || item.match.segments?.[0]?.file);
    if (!rel) return;
    setPreparing(true);
    try {
      const duration = item.full ? (item.match.duration || item.duration || 0) : (item.duration || 12);
      const prepared = api.prepare
        ? await api.prepare({ id: item.match.id, rel, duration: item.match.duration || duration })
        : { url: await api.fileUrl(item.match.id, rel), duration };
      const url = prepared.seekableUrl || prepared.url;
      setPlaying({
        matchId: item.match.id,
        url,
        label: item.label,
        rel,
        duration: prepared.duration || duration,
        startAt: ownClip || item.full ? 0 : (item.clip?.start || item.startAt || 0),
        segments: NO_SEGS,
        markers: item.full ? (item.match.clips || []).map((c) => Number(c.start) || 0) : [],
        item,
      });
    } finally {
      setPreparing(false);
    }
  }

  function toggleSelectMode() {
    setSelecting((on) => {
      if (on) setSelected(new Set());
      return !on;
    });
  }

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected(new Set(filtered.map((item) => item.id)));
  }

  function onCardClick(item) {
    if (selecting) toggleSelected(item.id);
    else playItem(item);
  }

  async function confirmDelete() {
    if (!api || !pendingDelete) return;
    setBusy(true);
    if (pendingDelete.type === 'items') {
      const payload = pendingDelete.items.map((item) => ({
        matchId: item.match.id,
        clipId: item.clip?.id,
        full: !!item.full,
      }));
      await api.deleteItems(payload);
      const gone = new Set(pendingDelete.items.map((item) => item.id));
      if (playing && gone.has(playing.item?.id)) setPlaying(null);
      if (playing && pendingDelete.items.some((item) => item.match.id === playing.matchId && item.full)) {
        setPlaying(null);
      }
    } else {
      await api.deleteMatch(pendingDelete.id);
      if (playing?.matchId === pendingDelete.id) setPlaying(null);
    }
    setPendingDelete(null);
    setSelecting(false);
    setSelected(new Set());
    await refreshList();
    setBusy(false);
  }

  function askDeleteSelected() {
    const picked = filtered.filter((item) => selected.has(item.id));
    if (!picked.length) return;
    setPendingDelete({ type: 'items', items: picked });
  }

  if (!api) {
    return (
      <div className="rp-page">
        <div className="rp-empty">
          <h2>{t('replays.needAppTitle')}</h2>
          <p>{t('replays.needApp')}</p>
        </div>
      </div>
    );
  }

  const recording = !!status?.recording;
  const pausedRec = !!status?.paused || String(status?.warning || '').startsWith('Paused');
  const finalizing = !!status?.finalizing || String(status?.warning || '').includes('Finalizing');
  const inGame = !!status?.inGame;

  return (
    <div className="rp-page">
      <header className="rp-head">
        <div>
          <h1>{t('replays.title')} <span>{t('replays.beta', { n: items.length, clips: items.length === 1 ? t('replays.clip') : t('replays.clips') })}</span></h1>
          <p>{t('replays.blurb')}</p>
        </div>
        <div className="rp-head-actions">
          {recording ? (
            <button
              type="button"
              className="rp-btn rp-btn-stop"
              onClick={async () => {
                setBusy(true);
                try {
                  await api.stop();
                  await refreshList();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy || finalizing}
            >
              {finalizing ? t('replays.finalizing') : t('replays.stop')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`rp-btn rp-btn-ghost${status?.autoRecord ? ' is-on' : ''}`}
                onClick={async () => {
                  if (!api?.setSettings) return;
                  const next = await api.setSettings({ autoRecord: !status?.autoRecord });
                  setStatus((prev) => ({ ...(prev || {}), autoRecord: !!next?.autoRecord }));
                }}
              >
                {status?.autoRecord ? t('replays.autoOn') : t('replays.autoOff')}
              </button>
              <button
                type="button"
                className="rp-btn rp-btn-ghost"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.start();
                    await refreshList();
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                {t('replays.recordNow')}
              </button>
            </>
          )}
          <button type="button" className="rp-btn rp-btn-ghost" onClick={() => api.openFolder()}>{t('replays.openFolder')}</button>
          {selecting ? (
            <>
              <button type="button" className="rp-btn rp-btn-ghost" onClick={selectAllFiltered} disabled={!filtered.length}>{t('replays.selectAll')}</button>
              <button
                type="button"
                className="rp-btn rp-btn-stop"
                onClick={askDeleteSelected}
                disabled={busy || !selected.size}
              >
                {t('replays.delete')}{selected.size ? ` (${selected.size})` : ''}
              </button>
              <button type="button" className="rp-btn rp-btn-ghost" onClick={toggleSelectMode}>{t('replays.cancel')}</button>
            </>
          ) : (
            <button type="button" className="rp-btn rp-btn-ghost" onClick={toggleSelectMode} disabled={!items.length}>{t('replays.select')}</button>
          )}
        </div>
      </header>

      <div className="rp-toolbar">
        <div className={`rp-live${finalizing ? ' is-live' : recording ? ' is-rec' : inGame ? ' is-live' : ''}`}>
          <span className="rp-dot" />
          {finalizing
            ? t('replays.finalizeNote')
            : recording
              ? (pausedRec
                ? t('replays.recPaused')
                : t('replays.recLive', { champ: status.champion || '', time: fmtTime(status.gameTime) }))
              : inGame ? t('replays.inGame') : t('replays.waiting')}
        </div>
      </div>

      {status?.error ? <div className="rp-banner is-err">{status.error}</div> : null}
      {status?.warning && !status?.error ? <div className="rp-banner">{status.warning}</div> : null}
      {preparing ? <div className="rp-banner">{t('replays.preparing')}</div> : null}

      <div className="rp-filters">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('replays.search')}
        />
        <select value={champFilter} onChange={(e) => setChampFilter(e.target.value)}>
          <option value="all">{t('replays.allChamps')}</option>
          {champs.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
          <option value="all">{t('replays.byDay')}</option>
          {days.map((d) => <option key={d} value={d}>{dayLabel(d, t)}</option>)}
        </select>
      </div>

      {playing ? (
        <div className="rp-watch">
          <ReplayPlayer
            src={playing.url}
            durationHint={playing.duration}
            label={playing.label}
            startAt={playing.startAt || 0}
            segments={playing.segments || NO_SEGS}
            markers={playing.markers || []}
            onClose={() => setPlaying(null)}
          />
          <div className="rp-watch-meta">
            <img src={champIcon(playing.item?.champion)} alt="" />
            <div>
              <strong>{playing.item?.champion || 'Clip'}</strong>
              <span>{playing.label} · {modeLabel(playing.item?.match?.gameMode)}</span>
            </div>
            <button type="button" className="rp-btn rp-btn-ghost" onClick={() => setPlaying(null)}>{t('replays.close')}</button>
            <button type="button" className="rp-btn rp-btn-ghost" onClick={() => setPendingDelete({ type: 'match', id: playing.matchId })}>{t('replays.delete')}</button>
          </div>
        </div>
      ) : null}

      {!items.length ? (
        <div className="rp-empty">
          <h2>{t('replays.emptyTitle')}</h2>
          <p>{t('replays.empty')}</p>
        </div>
      ) : !filtered.length ? (
        <div className="rp-empty">
          <h2>{t('replays.noMatchTitle')}</h2>
          <p>{t('replays.noMatch')}</p>
        </div>
      ) : (
        groups.map(([key, group]) => (
          <section key={key} className="rp-group">
            <h2>{dayLabel(key, t)} <span>{group.length} {group.length === 1 ? t('replays.clip') : t('replays.clips')}</span></h2>
            <div className="rp-grid">
              {group.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`rp-card${playing?.item?.id === item.id ? ' is-on' : ''}${selecting && selected.has(item.id) ? ' is-pick' : ''}${selecting ? ' is-selecting' : ''}`}
                  onClick={() => onCardClick(item)}
                >
                  <div className="rp-card-art">
                    <img src={splashImg(item.champion)} alt="" />
                    {selecting ? (
                      <span className={`rp-card-check${selected.has(item.id) ? ' is-on' : ''}`} aria-hidden="true" />
                    ) : (
                      <span className="rp-card-play"><IconPlay /></span>
                    )}
                    <span className="rp-badge">{item.label}</span>
                    <span className="rp-card-dur">{fmtTime(item.duration)}</span>
                  </div>
                  <div className="rp-card-meta">
                    <img src={champIcon(item.champion)} alt="" />
                    <div>
                      <strong>{item.champion || 'Unknown'}</strong>
                      <span>{item.match.error || `${modeLabel(item.match.gameMode)} · ${fmtWhen(item.at)}`}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {pendingDelete ? (
        <div className="rp-modal" role="dialog">
          <div className="rp-modal-card">
            <h3>
              {pendingDelete.type === 'items'
                ? `Delete ${pendingDelete.items.length} clip${pendingDelete.items.length === 1 ? '' : 's'}?`
                : 'Delete this recording and its clips?'}
            </h3>
            <p>This can't be undone.</p>
            <div className="rp-modal-actions">
              <button type="button" className="rp-btn rp-btn-ghost" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button type="button" className="rp-btn rp-btn-stop" onClick={confirmDelete} disabled={busy}>Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
