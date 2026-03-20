const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    scanProject: (folderPath, options) => ipcRenderer.invoke('scan-project', folderPath, options),
    getPreview: (filePath) => ipcRenderer.invoke('get-preview', filePath),

    onScanProgress: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('scan-progress', listener);
        return () => ipcRenderer.removeListener('scan-progress', listener);
    },

    openCodeViewer: (filePath, highlightLine) => ipcRenderer.invoke('open-code-viewer', filePath, highlightLine),
    deleteFiles: (filePaths) => ipcRenderer.invoke('delete-files', filePaths)
});
