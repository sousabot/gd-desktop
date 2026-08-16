const fs = require('fs');
const path = require('path');
const os = require('os');

const CLUSTER = Buffer.from([0x1f, 0x43, 0xb6, 0x75]);
const INFO = Buffer.from([0x15, 0x49, 0xa9, 0x66]);
const DURATION_HDR = Buffer.from([0x44, 0x89, 0x88]);

function readVint(buf, i) {
  if (i < 0 || i >= buf.length) return null;
  const b0 = buf[i];
  if (b0 === 0) return null;
  let width = 1;
  let mask = 0x80;
  while (width <= 8 && (b0 & mask) === 0) {
    mask >>= 1;
    width++;
  }
  if (i + width > buf.length) return null;
  let value = b0 & (mask - 1);
  let unknown = (b0 & (mask - 1)) === (mask - 1);
  for (let k = 1; k < width; k++) {
    value = (value << 8) | buf[i + k];
    if (buf[i + k] !== 0xff) unknown = false;
  }
  if (width === 1) unknown = b0 === 0xff;
  return { value, width, unknown };
}

function writeVint(value, width) {
  const out = Buffer.alloc(width);
  let v = value;
  for (let k = width - 1; k >= 0; k--) {
    out[k] = v & 0xff;
    v >>= 8;
  }
  out[0] |= (0x80 >> (width - 1));
  return out;
}

function readId(buf, i) {
  if (i < 0 || i >= buf.length) return null;
  const b0 = buf[i];
  if (b0 === 0) return null;
  let width = 1;
  let mask = 0x80;
  while (width <= 4 && (b0 & mask) === 0) {
    mask >>= 1;
    width++;
  }
  if (i + width > buf.length) return null;
  let id = 0;
  for (let k = 0; k < width; k++) id = (id << 8) | buf[i + k];
  return { id, width };
}

function durationElement(durationMs) {
  const payload = Buffer.alloc(8);
  payload.writeDoubleBE(Number(durationMs) || 0);
  return Buffer.concat([DURATION_HDR, payload]);
}

function patchHeaderDuration(header, durationMs) {
  const dur = durationElement(durationMs);
  let existing = header.indexOf(DURATION_HDR);
  if (existing < 0) {
    const alt = header.indexOf(Buffer.from([0x44, 0x89]));
    if (alt >= 0 && header[alt + 2] >= 0x81 && header[alt + 2] <= 0x88) existing = alt;
  }
  if (existing >= 0 && existing + 11 <= header.length && header[existing + 2] === 0x88) {
    const next = Buffer.from(header);
    dur.copy(next, existing);
    return next;
  }

  const infoAt = header.indexOf(INFO);
  if (infoAt < 0) return header;
  const size = readVint(header, infoAt + 4);
  if (!size) return header;

  const insertAt = infoAt + 4 + size.width;
  if (size.unknown) {
    return Buffer.concat([header.subarray(0, insertAt), dur, header.subarray(insertAt)]);
  }

  const newSize = size.value + dur.length;
  if (size.width === 1 && newSize > 127) {
    return Buffer.concat([
      header.subarray(0, infoAt + 4),
      writeVint(newSize, 2),
      dur,
      header.subarray(insertAt),
    ]);
  }
  const next = Buffer.concat([
    header.subarray(0, insertAt),
    dur,
    header.subarray(insertAt),
  ]);
  const vintWidth = size.width === 1 && newSize <= 127 ? 1 : size.width;
  writeVint(newSize, vintWidth).copy(next, infoAt + 4);
  return next;
}

function readUintBE(buf, start, len) {
  let n = 0;
  for (let i = 0; i < len; i++) n = (n << 8) | buf[start + i];
  return n >>> 0;
}

function writeUintBE(buf, start, len, value) {
  let v = Math.max(0, value) >>> 0;
  for (let i = len - 1; i >= 0; i--) {
    buf[start + i] = v & 0xff;
    v >>= 8;
  }
}

function simpleBlockIsKey(buf, dataStart, dataLen) {
  if (dataLen < 4 || dataStart + 3 >= buf.length) return false;
  const track = readVint(buf, dataStart);
  if (!track || dataStart + track.width + 2 >= buf.length) return false;
  const flags = buf[dataStart + track.width + 2];
  return (flags & 0x80) === 0x80;
}

function inspectCluster(buf, idx) {
  const size = readVint(buf, idx + 4);
  if (!size) return { time: 0, payload: idx + 4, keyframe: idx === 0 };
  const payload = idx + 4 + size.width;
  const end = size.unknown
    ? Math.min(buf.length, payload + 4096)
    : Math.min(buf.length, payload + size.value);
  let i = payload;
  let time = 0;
  let tStart;
  let tLen;
  let keyframe = false;
  while (i < end) {
    const id = readId(buf, i);
    if (!id) break;
    const vint = readVint(buf, i + id.width);
    if (!vint) break;
    const dataStart = i + id.width + vint.width;
    if (id.id === 0xe7 && !vint.unknown && vint.value >= 1 && vint.value <= 8) {
      time = readUintBE(buf, dataStart, vint.value);
      tStart = dataStart;
      tLen = vint.value;
    } else if ((id.id === 0xa3 || id.id === 0xa1) && !vint.unknown) {
      if (simpleBlockIsKey(buf, dataStart, vint.value)) keyframe = true;
    }
    if (vint.unknown) break;
    const next = dataStart + vint.value;
    if (next <= i) break;
    i = next;
  }
  return { time, payload, size, tStart, tLen, keyframe };
}

function findClusters(buf) {
  const clusters = [];
  let offset = 0;
  let guard = 0;
  while (offset < buf.length && guard++ < 200000) {
    const idx = buf.indexOf(CLUSTER, offset);
    if (idx < 0) break;
    const meta = inspectCluster(buf, idx);
    clusters.push({
      offset: idx,
      time: meta.time,
      tStart: meta.tStart,
      tLen: meta.tLen,
      size: meta.size,
      keyframe: !!meta.keyframe || clusters.length === 0,
    });
    if (meta.size && !meta.size.unknown) {
      offset = idx + 4 + meta.size.width + meta.size.value;
      if (offset <= idx) offset = idx + 4;
    } else {
      offset = idx + 4;
    }
  }
  return clusters;
}

function shiftClusterTimecodes(buf, base) {
  const out = Buffer.from(buf);
  const clusters = findClusters(out);
  const origin = base == null ? (clusters[0]?.time || 0) : base;
  for (const c of clusters) {
    if (!c.tStart || !c.tLen) continue;
    writeUintBE(out, c.tStart, c.tLen, Math.max(0, c.time - origin));
  }
  return {
    buf: out,
    base: origin,
    clusters: clusters.map((c) => ({ ...c, time: Math.max(0, c.time - origin) })),
  };
}

function pickClusterIndex(clusters, startMs, durationMs) {
  const lastTime = clusters[clusters.length - 1]?.time || 0;
  const dur = Math.max(durationMs || 0, lastTime, 1);
  const useTime = lastTime > 400 && lastTime > dur * 0.3 && lastTime < dur * 3;
  let from;
  if (useTime) {
    from = 0;
    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].time <= startMs) from = i;
      else break;
    }
  } else {
    const ratio = Math.min(1, Math.max(0, startMs / dur));
    from = Math.min(clusters.length - 1, Math.round(ratio * (clusters.length - 1)));
  }
  for (let i = from; i >= 0; i--) {
    if (clusters[i].keyframe) return i;
  }
  return 0;
}

function clusterClockSec(clusters, idx, durationMs) {
  const lastTime = clusters[clusters.length - 1]?.time || 0;
  const durSec = Math.max((durationMs || 0) / 1000, lastTime / 1000, 0.1);
  if (lastTime > 400) return (clusters[idx].time || 0) / 1000;
  return (idx / Math.max(1, clusters.length - 1)) * durSec;
}

function sliceWebmBuffer(buf, startMs, durationMs) {
  const data = Buffer.from(buf);
  const first = data.indexOf(CLUSTER);
  if (first < 0) {
    return { buf: patchHeaderDuration(data, durationMs || 1000), startMs: 0 };
  }

  let header = Buffer.from(data.subarray(0, first));
  const clusters = findClusters(data);
  if (!clusters.length) {
    return { buf: patchHeaderDuration(data, durationMs || 1000), startMs: 0 };
  }

  const start = Math.max(0, Number(startMs) || 0);
  const from = pickClusterIndex(clusters, start, durationMs);
  const sliceStart = clusters[from].offset;
  const origin = clusters[from].time;
  const startSec = clusterClockSec(clusters, from, durationMs);
  let body = Buffer.from(data.subarray(sliceStart));
  const shifted = shiftClusterTimecodes(body, origin);
  body = shifted.buf;

  const last = shifted.clusters[shifted.clusters.length - 1];
  const sliceDur = Math.max(1000, (last ? last.time : 0) + 1000);
  header = patchHeaderDuration(header, sliceDur);
  return { buf: Buffer.concat([header, body]), startMs: startSec * 1000 };
}

function patchWebmBuffer(buf, durationMs) {
  const data = Buffer.from(buf);
  const shifted = shiftClusterTimecodes(data);
  const last = shifted.clusters[shifted.clusters.length - 1];
  const dur = durationMs > 0 ? durationMs : ((last ? last.time : 0) + 1000);
  const first = shifted.buf.indexOf(CLUSTER);
  if (first < 0) return patchHeaderDuration(shifted.buf, dur);
  const header = patchHeaderDuration(shifted.buf.subarray(0, first), dur);
  return Buffer.concat([header, shifted.buf.subarray(first)]);
}

async function sliceWebmFile(filePath, startSec, durationSec) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  if (buf.length < 32) return null;
  const sliced = sliceWebmBuffer(
    buf,
    Math.max(0, Number(startSec) || 0) * 1000,
    Math.max(0, Number(durationSec) || 0) * 1000,
  );
  const outPath = path.join(
    os.tmpdir(),
    `gd-seek-${path.basename(filePath, path.extname(filePath))}-${Date.now()}.webm`,
  );
  fs.writeFileSync(outPath, sliced.buf);
  return { path: outPath, start: (sliced.startMs || 0) / 1000 };
}

function patchWebmFile(filePath, durationMs) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const buf = fs.readFileSync(filePath);
  if (buf.length < 32) return false;
  const next = patchWebmBuffer(buf, durationMs);
  if (next.equals(buf)) return false;
  fs.writeFileSync(filePath, next);
  return true;
}

module.exports = {
  patchWebmBuffer,
  patchWebmFile,
  sliceWebmBuffer,
  sliceWebmFile,
  shiftClusterTimecodes,
};
