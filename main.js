const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./src/main/ipc-handlers');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        backgroundColor: '#1e1e1e',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, 'assets', 'icons', 'icon.png'),
        title: 'Cocos Resource Scanner'
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                { role: 'quit' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { role: 'resetZoom' }
            ]
        }
    ]);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});
