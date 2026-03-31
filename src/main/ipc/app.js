const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const store = require('../store');

function registerAppHandlers() {
  ipcMain.handle('select-folder', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Cocos2d-JS Project Folder'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, reason: 'canceled' };
    }

    const folderPath = result.filePaths[0];
    const resExists = fs.existsSync(path.join(folderPath, 'res'));
    const srcExists = fs.existsSync(path.join(folderPath, 'src'));

    if (!resExists || !srcExists) {
      return {
        success: false,
        reason: 'invalid',
        message: 'Selected folder must contain both "res/" and "src/" directories.'
      };
    }

    return { success: true, path: folderPath };
  });

  ipcMain.handle('get-recent-folders', () => {
    return store.get('recentFolders', []);
  });

  ipcMain.handle('add-recent-folder', (_event, entry) => {
    const folders = store.get('recentFolders', []);
    const filtered = folders.filter(f => f.path !== entry.path);
    filtered.unshift({
      path: entry.path,
      name: entry.name || path.basename(entry.path),
      lastOpened: Date.now()
    });
    const trimmed = filtered.slice(0, 10);
    store.set('recentFolders', trimmed);
    return trimmed;
  });

  ipcMain.handle('remove-recent-folder', (_event, folderPath) => {
    const folders = store.get('recentFolders', []);
    const filtered = folders.filter(f => f.path !== folderPath);
    store.set('recentFolders', filtered);
    return filtered;
  });

  ipcMain.handle('get-settings', () => {
    return store.get('settings');
  });

  ipcMain.handle('save-settings', (_event, settings) => {
    store.set('settings', settings);
    return { success: true };
  });
}

module.exports = { registerAppHandlers };
