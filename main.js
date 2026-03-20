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
        backgroundColor: '#0b0e1c',
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#111536',
            symbolColor: '#9fa4c4',
            height: 36
        },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, 'assets', 'icons', 'icon.png'),
        title: 'Cocos Resource Scanner'
    });
    mainWindow.setOpacity(0.97);

    mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

    Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});
