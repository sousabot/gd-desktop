const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('riotAPI', {
  linkAccount: (args) => ipcRenderer.invoke('riot:linkAccount', args),
  getLeagueShard: (args) => ipcRenderer.invoke('riot:getLeagueShard', args),
  getAccountByRiotId: (args) => ipcRenderer.invoke('riot:getAccountByRiotId', args),
  getSummonerByPuuid: (args) => ipcRenderer.invoke('riot:getSummonerByPuuid', args),
  getRankedEntries:  (args) => ipcRenderer.invoke('riot:getRankedEntries', args),
  getRankedByPuuid:  (args) => ipcRenderer.invoke('riot:getRankedByPuuid', args),
  getRankedByPuuidsBulk: (args) => ipcRenderer.invoke('riot:getRankedByPuuidsBulk', args),
  getMatchIds: (args) => ipcRenderer.invoke('riot:getMatchIds', args),
  getMatchesBulk: (args) => ipcRenderer.invoke('riot:getMatchesBulk', args),
  getTimelinesBulk: (args) => ipcRenderer.invoke('riot:getTimelinesBulk', args),
  getActiveGame: (args) => ipcRenderer.invoke('riot:getActiveGame', args),
  getTopLeague: (args) => ipcRenderer.invoke('riot:getTopLeague', args),
  getAccountsByPuuidsBulk: (args) => ipcRenderer.invoke('riot:getAccountsByPuuidsBulk', args),
  getSummonersByPuuidsBulk: (args) => ipcRenderer.invoke('riot:getSummonersByPuuidsBulk', args),
  getChampionMasteryBulk: (args) => ipcRenderer.invoke('riot:getChampionMasteryBulk', args),
  getChampionMasteries: (args) => ipcRenderer.invoke('riot:getChampionMasteries', args),
  getLastMatchIdsBulk: (args) => ipcRenderer.invoke('riot:getLastMatchIdsBulk', args),
  getStatSnapshot:  (args) => ipcRenderer.invoke('stats:getSnapshot', args),
  saveStatSnapshot: (args) => ipcRenderer.invoke('stats:saveSnapshot', args),
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (cb) => {
    const handler = (_e, value) => cb(value);
    ipcRenderer.on('window:maximized', handler);
    return () => ipcRenderer.removeListener('window:maximized', handler);
  },
});

contextBridge.exposeInMainWorld('gdAPI', {
  sendFeedback: (payload) => ipcRenderer.invoke('app:sendFeedback', payload),
});