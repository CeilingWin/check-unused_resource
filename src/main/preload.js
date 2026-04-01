const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // App
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getRecentFolders: () => ipcRenderer.invoke('get-recent-folders'),
  addRecentFolder: (entry) => ipcRenderer.invoke('add-recent-folder', entry),
  removeRecentFolder: (folderPath) => ipcRenderer.invoke('remove-recent-folder', folderPath),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Scanner
  scanProject: (folderPath, options) => ipcRenderer.invoke('scan-project', folderPath, options),
  getPreview: (filePath) => ipcRenderer.invoke('get-preview', filePath),
  openCodeViewer: (filePath, highlightLine) => ipcRenderer.invoke('open-code-viewer', filePath, highlightLine),
  deleteFiles: (filePaths) => ipcRenderer.invoke('delete-files', filePaths),
  onScanProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('scan-progress', listener);
    return () => ipcRenderer.removeListener('scan-progress', listener);
  },

  // Duplicate scanner
  scanDuplicates: (folderPath, options) => ipcRenderer.invoke('duplicate:start-scan', folderPath, options),
  onDuplicateScanProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('duplicate:scan-progress', listener);
    return () => ipcRenderer.removeListener('duplicate:scan-progress', listener);
  },
});
