const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codeViewerAPI', {
  onFileData: (callback) => {
    ipcRenderer.on('code-viewer-data', (_event, data) => callback(data));
  }
});
