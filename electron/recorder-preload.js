const fs = require('fs');
const path = require('path');
const { contextBridge, ipcRenderer } = require('electron');

let allowedDir = null;
let outFile = null;
let outFd = null;

function closeOut() {
  if (outFd == null) return;
  try { fs.fsyncSync(outFd); } catch { /* ignore */ }
  try { fs.closeSync(outFd); } catch { /* ignore */ }
  outFd = null;
}

contextBridge.exposeInMainWorld('recorderBridge', {
  onStart: (cb) => {
    ipcRenderer.on('recorder:start', (_e, opts) => {
      closeOut();
      allowedDir = opts?.dir ? path.resolve(String(opts.dir)) : null;
      outFile = null;
      cb(opts);
    });
  },
  onStop: (cb) => {
    ipcRenderer.on('recorder:stop', () => cb());
  },
  onGameTime: (cb) => {
    ipcRenderer.on('recorder:gameTime', (_e, t) => cb(t));
  },
  onFocus: (cb) => {
    ipcRenderer.on('recorder:focus', (_e, focused) => cb(!!focused));
  },
  getSources: () => ipcRenderer.invoke('recorder:listSources'),
  setFile: (name) => {
    if (!allowedDir || !/^(match\.(webm|mp4))$/.test(String(name || ''))) return null;
    closeOut();
    outFile = path.join(allowedDir, name);
    outFd = fs.openSync(outFile, 'w');
    return name;
  },
  append: (bytes) => {
    if (outFd == null || !bytes) return 0;
    const buf = Buffer.from(bytes);
    if (!buf.length) return 0;
    fs.writeSync(outFd, buf);
    return buf.length;
  },
  closeFile: () => {
    closeOut();
    return true;
  },
  started: (info) => ipcRenderer.send('recorder:started', info),
  progress: (info) => ipcRenderer.send('recorder:progress', info),
  chunk: (payload) => ipcRenderer.send('recorder:chunk', payload),
  error: (msg) => ipcRenderer.send('recorder:error', String(msg || 'Recorder error')),
  stopped: () => ipcRenderer.send('recorder:stopped'),
});
