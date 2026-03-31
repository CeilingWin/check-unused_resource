const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { registerAllHandlers } = require('./ipc');

let mainWindow;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#13151F',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1A1C2B',
      symbolColor: '#8A8FA8',
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '..', '..', 'assets', 'icons', 'icon.png'),
    title: 'Cocos Resource Scanner'
  });
  mainWindow.setOpacity(0.97);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html'));
  }

  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();
  registerAllHandlers(mainWindow);
});

app.on('window-all-closed', () => {
  app.quit();
});
