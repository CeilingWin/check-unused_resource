const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { resolveReferences } = require('./scanner/ReferenceResolver');

function registerIpcHandlers() {
    // Select folder dialog
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

    // Scan project
    ipcMain.handle('scan-project', async (event, folderPath) => {
        const win = BrowserWindow.getFocusedWindow();

        try {
            const result = resolveReferences(folderPath, (progress) => {
                if (win && !win.isDestroyed()) {
                    win.webContents.send('scan-progress', progress);
                }
            });

            return { success: true, data: result };
        } catch (err) {
            return { success: false, message: err.message };
        }
    });

    // Get file preview
    ipcMain.handle('get-preview', async (_event, filePath) => {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, message: 'File not found' };
            }

            const ext = path.extname(filePath).toLowerCase();
            const stat = fs.statSync(filePath);

            // Images → base64 data URL
            if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext)) {
                const data = fs.readFileSync(filePath);
                const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                    : ext === '.png' ? 'image/png'
                    : ext === '.gif' ? 'image/gif'
                    : ext === '.webp' ? 'image/webp'
                    : 'image/png';
                return {
                    success: true,
                    type: 'image',
                    data: `data:${mime};base64,${data.toString('base64')}`,
                    size: stat.size,
                    fileName: path.basename(filePath)
                };
            }

            // Audio → file path for <audio> element
            if (['.mp3', '.ogg', '.wav', '.m4a'].includes(ext)) {
                return {
                    success: true,
                    type: 'audio',
                    data: filePath,
                    size: stat.size,
                    fileName: path.basename(filePath)
                };
            }

            // Text files (JSON, plist, JS, shader, xml, atlas, etc.) → read as text
            const maxSize = 512 * 1024; // 512KB limit for text preview
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
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

module.exports = { registerIpcHandlers };
