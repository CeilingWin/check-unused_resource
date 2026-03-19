const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    scanProject: (folderPath) => ipcRenderer.invoke('scan-project', folderPath),
    getPreview: (filePath) => ipcRenderer.invoke('get-preview', filePath),

    onScanProgress: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('scan-progress', listener);
        return () => ipcRenderer.removeListener('scan-progress', listener);
    }
});
