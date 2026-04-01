const { ipcMain, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { resolveReferences } = require('../scanner/ReferenceResolver');
const { scanDuplicates } = require('../scanner/DuplicateScanner');

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function registerScannerHandlers(mainWindow) {
  ipcMain.handle('scan-project', async (event, folderPath, options) => {
    try {
      const result = resolveReferences(folderPath, (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('scan-progress', progress);
        }
      }, options);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-preview', async (_event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, message: 'File not found' };
      }

      const ext = path.extname(filePath).toLowerCase();
      const stat = fs.statSync(filePath);

      if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext)) {
        const data = fs.readFileSync(filePath);
        const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
          : ext === '.png' ? 'image/png'
          : ext === '.gif' ? 'image/gif'
          : ext === '.webp' ? 'image/webp'
          : ext === '.bmp' ? 'image/bmp'
          : 'image/png';
        return {
          success: true,
          type: 'image',
          data: `data:${mime};base64,${data.toString('base64')}`,
          size: stat.size,
          fileName: path.basename(filePath)
        };
      }

      if (['.mp3', '.ogg', '.wav', '.m4a'].includes(ext)) {
        return {
          success: true,
          type: 'audio',
          data: filePath,
          size: stat.size,
          fileName: path.basename(filePath)
        };
      }

      const maxSize = 512 * 1024;
      if (stat.size > maxSize) {
        return {
          success: true,
          type: 'text',
          data: '[File too large for preview (' + formatBytes(stat.size) + ')]',
          size: stat.size,
          fileName: path.basename(filePath)
        };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        success: true,
        type: 'text',
        data: content,
        size: stat.size,
        fileName: path.basename(filePath)
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('delete-files', async (_event, filePaths) => {
    const results = [];
    for (const filePath of filePaths) {
      try {
        if (!fs.existsSync(filePath)) {
          results.push({ path: filePath, success: false, error: 'File not found' });
          continue;
        }
        const stat = fs.statSync(filePath);
        fs.unlinkSync(filePath);
        results.push({ path: filePath, success: true, size: stat.size });
      } catch (err) {
        results.push({ path: filePath, success: false, error: err.message });
      }
    }
    return { success: true, results };
  });

  ipcMain.handle('open-code-viewer', async (_event, filePath, highlightLine) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, message: 'File not found' };
      }

      const maxSize = 2 * 1024 * 1024;
      const stat = fs.statSync(filePath);
      if (stat.size > maxSize) {
        return { success: false, message: 'File too large to display (' + formatBytes(stat.size) + ')' };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const totalLines = content.split('\n').length;
      const fileName = path.basename(filePath);

      const viewerWin = new BrowserWindow({
        width: 900,
        height: 700,
        minWidth: 500,
        minHeight: 400,
        backgroundColor: '#13151F',
        parent: mainWindow || undefined,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
          color: '#1A1C2B',
          symbolColor: '#8A8FA8',
          height: 36
        },
        webPreferences: {
          preload: path.join(__dirname, '..', 'preload-code-viewer.js'),
          contextIsolation: true,
          nodeIntegration: false
        },
        title: fileName + ' (Read Only)'
      });
      viewerWin.setOpacity(0.97);

      viewerWin.loadFile(path.join(__dirname, '..', '..', '..', 'dist', 'code-viewer', 'index.html'));

      viewerWin.webContents.on('did-finish-load', () => {
        viewerWin.webContents.send('code-viewer-data', {
          filePath,
          content,
          highlightLine: highlightLine || null,
          totalLines
        });
      });

      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('duplicate:start-scan', async (_event, folderPath, options) => {
    try {
      const result = await scanDuplicates(folderPath, (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('duplicate:scan-progress', progress);
        }
      }, options);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
}

module.exports = { registerScannerHandlers };
