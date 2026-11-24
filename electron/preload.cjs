const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fabinavDesktop', {
  isElectron: true,
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  },
  minimizeWindow: () => ipcRenderer.send('fabinav:win-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('fabinav:win-toggle-maximize'),
  closeWindow: () => ipcRenderer.send('fabinav:win-close'),
  capturePage: () => ipcRenderer.invoke('fabinav:capture-page'),
  checkForUpdates: () => ipcRenderer.invoke('fabinav:check-updates'),
  installUpdate: () => ipcRenderer.invoke('fabinav:install-update'),
  openUninstallSettings: () => ipcRenderer.invoke('fabinav:open-uninstall'),
  pickAndLoadExtension: () => ipcRenderer.invoke('fabinav:ext-pick-unpacked'),
  removeNativeExtension: (nativeId, localPath) =>
    ipcRenderer.invoke('fabinav:ext-remove', nativeId, localPath),
  onWindowState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('fabinav:window-state', listener);
    return () => ipcRenderer.removeListener('fabinav:window-state', listener);
  },
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('fabinav:update-status', listener);
    return () => ipcRenderer.removeListener('fabinav:update-status', listener);
  },
  onOpenUrlInTab: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, url) => callback(url);
    ipcRenderer.on('fabinav:webview-new-tab', listener);
    return () => ipcRenderer.removeListener('fabinav:webview-new-tab', listener);
  }
});
