# React + Zustand Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Electron renderer from vanilla JS to React + Zustand, restructure main process for multi-tool extensibility, and add recent folders + home page.

**Architecture:** Vite builds two React entries (renderer + code-viewer). Main process restructured with modular IPC handlers and electron-store for persistence. Zustand manages navigation and per-tool state. Scanner engine unchanged.

**Tech Stack:** Electron 28, React 18, Zustand 4, Vite 5, TypeScript, CSS Modules, electron-store

---

## File Structure

### New files to create:
```
vite.config.ts                          # Vite config for main renderer
vite.code-viewer.config.ts              # Vite config for code viewer window
tsconfig.json                           # TypeScript config
src/main/main.js                        # New entry point (replaces root main.js)
src/main/preload.js                     # New preload (replaces root preload.js)
src/main/preload-code-viewer.js         # New preload (replaces root preload-code-viewer.js)
src/main/store.js                       # electron-store instance
src/main/ipc/index.js                   # Handler registration
src/main/ipc/app.js                     # App-level handlers
src/main/ipc/scanner.js                 # Scanner handlers
src/renderer/index.html                 # Vite entry HTML
src/renderer/main.tsx                   # React root
src/renderer/App.tsx                    # State-based router
src/renderer/types.ts                   # Shared TypeScript types
src/renderer/utils/syntax.ts            # Syntax highlighting utility
src/renderer/utils/format.ts            # formatBytes, escapeHtml utilities
src/renderer/stores/useAppStore.ts      # App-level state
src/renderer/stores/useScannerStore.ts  # Scanner state
src/renderer/styles/tokens.css          # Design tokens (CSS variables)
src/renderer/styles/global.css          # Reset, fonts, base styles
src/renderer/pages/FolderPickerPage.tsx
src/renderer/pages/FolderPickerPage.module.css
src/renderer/pages/HomePage.tsx
src/renderer/pages/HomePage.module.css
src/renderer/pages/ScannerPage.tsx
src/renderer/pages/ScannerPage.module.css
src/renderer/components/common/Button.tsx
src/renderer/components/common/Button.module.css
src/renderer/components/common/Modal.tsx
src/renderer/components/common/Modal.module.css
src/renderer/components/common/ContextMenu.tsx
src/renderer/components/common/ContextMenu.module.css
src/renderer/components/common/StatusBar.tsx
src/renderer/components/common/StatusBar.module.css
src/renderer/components/layout/PageHeader.tsx
src/renderer/components/layout/PageHeader.module.css
src/renderer/components/scanner/FilterBar.tsx
src/renderer/components/scanner/FilterBar.module.css
src/renderer/components/scanner/TreeView.tsx
src/renderer/components/scanner/TreeView.module.css
src/renderer/components/scanner/TreeRow.tsx
src/renderer/components/scanner/PreviewPanel.tsx
src/renderer/components/scanner/PreviewPanel.module.css
src/renderer/components/scanner/ReferencesPanel.tsx
src/renderer/components/scanner/ReferencesPanel.module.css
src/renderer/components/scanner/ReferenceItem.tsx
src/renderer/components/scanner/ReferenceItem.module.css
src/renderer/components/scanner/ScanProgress.tsx
src/renderer/components/scanner/ScanProgress.module.css
src/renderer/components/scanner/DeleteConfirmModal.tsx
src/renderer/components/scanner/DeleteReportModal.tsx
src/renderer/components/scanner/SettingsPopup.tsx
src/renderer/components/scanner/SettingsPopup.module.css
src/code-viewer/index.html              # Code viewer Vite entry
src/code-viewer/main.tsx                # Code viewer React root
src/code-viewer/CodeViewer.tsx          # Code viewer component
src/code-viewer/CodeViewer.module.css   # Code viewer styles
```

### Files to modify:
```
package.json                            # Update scripts, dependencies, main entry
```

### Files to delete (after migration complete):
```
main.js                                 # Replaced by src/main/main.js
preload.js                              # Replaced by src/main/preload.js
preload-code-viewer.js                  # Replaced by src/main/preload-code-viewer.js
src/main/ipc-handlers.js               # Split into src/main/ipc/app.js + scanner.js
src/renderer/index.html                 # Replaced by new src/renderer/index.html
src/renderer/app.js                     # Replaced by React components
src/renderer/code-viewer.html           # Replaced by src/code-viewer/index.html
src/renderer/code-viewer.js             # Replaced by src/code-viewer/CodeViewer.tsx
src/renderer/styles/main.css            # Split into tokens.css + global.css + modules
src/renderer/styles/tree.css            # Migrated into CSS modules
src/renderer/styles/code-viewer.css     # Migrated into CodeViewer.module.css
```

---

### Task 1: Project Setup — Dependencies & Config

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vite.code-viewer.config.ts`

- [ ] **Step 1: Install dependencies**

```bash
cd /c/Users/Fresher/Desktop/BAT_MAN/check-unused_resource
npm install react react-dom zustand electron-store
npm install -D @vitejs/plugin-react vite typescript @types/react @types/react-dom concurrently wait-on
```

- [ ] **Step 2: Create tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/renderer/*"]
    }
  },
  "include": ["src/renderer/**/*", "src/code-viewer/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vite.config.ts**

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
});
```

- [ ] **Step 4: Create vite.code-viewer.config.ts**

Create `vite.code-viewer.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/code-viewer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist/code-viewer',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 5: Update package.json**

Update `package.json` — change main entry and scripts:

```json
{
  "name": "cocos-resource-scanner",
  "version": "2.0.0",
  "description": "Toolbox for Cocos2d-JS game projects",
  "main": "src/main/main.js",
  "scripts": {
    "dev": "concurrently -n renderer,viewer,electron \"npm run dev:renderer\" \"npm run dev:code-viewer\" \"npm run dev:electron\"",
    "dev:renderer": "vite --config vite.config.ts",
    "dev:code-viewer": "vite --config vite.code-viewer.config.ts --port 5174",
    "dev:electron": "wait-on http://localhost:5173 http://localhost:5174 && electron .",
    "build": "npm run build:renderer && npm run build:code-viewer",
    "build:renderer": "vite build --config vite.config.ts",
    "build:code-viewer": "vite build --config vite.code-viewer.config.ts",
    "package": "npm run build && electron-builder"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.4.0",
    "typescript": "^5.3.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "concurrently": "^8.2.0",
    "wait-on": "^7.2.0"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "electron-store": "^8.1.0"
  },
  "build": {
    "appId": "com.tools.cocos-resource-scanner",
    "productName": "Cocos Resource Scanner",
    "files": [
      "src/main/**/*",
      "dist/**/*",
      "assets/**/*"
    ],
    "extraMetadata": {
      "main": "src/main/main.js"
    }
  }
}
```

- [ ] **Step 6: Verify dependencies install**

```bash
npm install
```

Expected: Clean install, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vite.code-viewer.config.ts
git commit -m "chore: add React, Zustand, Vite, TypeScript dependencies and configs"
```

---

### Task 2: Main Process Restructure — electron-store & IPC Modules

**Files:**
- Create: `src/main/store.js`
- Create: `src/main/ipc/index.js`
- Create: `src/main/ipc/app.js`
- Create: `src/main/ipc/scanner.js`

- [ ] **Step 1: Create electron-store instance**

Create `src/main/store.js`:

```javascript
const Store = require('electron-store');

const store = new Store({
  schema: {
    recentFolders: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          name: { type: 'string' },
          lastOpened: { type: 'number' }
        }
      }
    },
    settings: {
      type: 'object',
      default: {
        fontSize: 13,
        codeFontSize: 11,
        enableFilenameMatching: false
      },
      properties: {
        fontSize: { type: 'number' },
        codeFontSize: { type: 'number' },
        enableFilenameMatching: { type: 'boolean' }
      }
    }
  }
});

module.exports = store;
```

- [ ] **Step 2: Create IPC app handlers**

Create `src/main/ipc/app.js`:

```javascript
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
```

- [ ] **Step 3: Create IPC scanner handlers**

Create `src/main/ipc/scanner.js`:

```javascript
const { ipcMain, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { resolveReferences } = require('../scanner/ReferenceResolver');

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

      const { app } = require('electron');
      const isDev = !app.isPackaged;

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

      if (isDev) {
        viewerWin.loadURL('http://localhost:5174');
      } else {
        viewerWin.loadFile(path.join(__dirname, '..', '..', 'dist', 'code-viewer', 'index.html'));
      }

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
}

module.exports = { registerScannerHandlers };
```

- [ ] **Step 4: Create IPC index**

Create `src/main/ipc/index.js`:

```javascript
const { registerAppHandlers } = require('./app');
const { registerScannerHandlers } = require('./scanner');

function registerAllHandlers(mainWindow) {
  registerAppHandlers();
  registerScannerHandlers(mainWindow);
}

module.exports = { registerAllHandlers };
```

- [ ] **Step 5: Commit**

```bash
git add src/main/store.js src/main/ipc/
git commit -m "refactor: restructure main process with modular IPC handlers and electron-store"
```

---

### Task 3: New Main Entry & Preload Scripts

**Files:**
- Create: `src/main/main.js`
- Create: `src/main/preload.js`
- Create: `src/main/preload-code-viewer.js`

- [ ] **Step 1: Create new main.js**

Create `src/main/main.js`:

```javascript
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
```

- [ ] **Step 2: Create new preload.js**

Create `src/main/preload.js`:

```javascript
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
});
```

- [ ] **Step 3: Create new preload-code-viewer.js**

Create `src/main/preload-code-viewer.js`:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codeViewerAPI', {
  onFileData: (callback) => {
    ipcRenderer.on('code-viewer-data', (_event, data) => callback(data));
  }
});
```

- [ ] **Step 4: Verify main process loads**

```bash
cd /c/Users/Fresher/Desktop/BAT_MAN/check-unused_resource
npx electron . --no-sandbox 2>&1 | head -5
```

The app should launch (it won't load the renderer yet since Vite isn't running, but the process should start without crashes).

Press Ctrl+C to close after verifying.

- [ ] **Step 5: Commit**

```bash
git add src/main/main.js src/main/preload.js src/main/preload-code-viewer.js
git commit -m "feat: add new main entry point with dev/prod mode detection and updated preloads"
```

---

### Task 4: TypeScript Types & Utility Functions

**Files:**
- Create: `src/renderer/types.ts`
- Create: `src/renderer/utils/syntax.ts`
- Create: `src/renderer/utils/format.ts`

- [ ] **Step 1: Create shared types**

Create `src/renderer/types.ts`:

```typescript
export interface Resource {
  path: string;
  absPath: string;
  type: string;
  size: number;
  used: boolean;
  references: Reference[];
}

export interface Reference {
  source: string;
  line: number | null;
  snippet: string;
  type: string;
  context?: ContextEntry[];
}

export interface ContextEntry {
  lineNum: number | null;
  text: string;
  highlight?: boolean;
}

export interface ScanStats {
  totalResources: number;
  usedCount: number;
  unusedCount: number;
  filenameMatchCount?: number;
}

export interface ScanResult {
  resourceList: Resource[];
  stats: ScanStats;
}

export interface RecentFolder {
  path: string;
  name: string;
  lastOpened: number;
}

export interface AppSettings {
  fontSize: number;
  codeFontSize: number;
  enableFilenameMatching: boolean;
}

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  resource?: Resource;
  children?: Map<string, TreeNode>;
}

export interface DeleteResult {
  path: string;
  success: boolean;
  size?: number;
  error?: string;
}

export type PageName = 'folder-picker' | 'home' | 'scanner';

// Window API type declarations
declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<{ success: boolean; path?: string; reason?: string; message?: string }>;
      getRecentFolders: () => Promise<RecentFolder[]>;
      addRecentFolder: (entry: { path: string; name?: string }) => Promise<RecentFolder[]>;
      removeRecentFolder: (path: string) => Promise<RecentFolder[]>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<{ success: boolean }>;
      scanProject: (path: string, options: { filenameMatch: boolean }) => Promise<{ success: boolean; data?: ScanResult; message?: string }>;
      getPreview: (filePath: string) => Promise<{ success: boolean; type?: string; data?: string; size?: number; fileName?: string; message?: string }>;
      openCodeViewer: (filePath: string, highlightLine: number) => Promise<{ success: boolean; message?: string }>;
      deleteFiles: (filePaths: string[]) => Promise<{ success: boolean; results: DeleteResult[]; message?: string }>;
      onScanProgress: (callback: (data: { message?: string; current?: number; total?: number }) => void) => () => void;
    };
    codeViewerAPI: {
      onFileData: (callback: (data: { filePath: string; content: string; highlightLine: number | null; totalLines: number }) => void) => void;
    };
  }
}
```

- [ ] **Step 2: Create syntax highlighting utility**

Create `src/renderer/utils/syntax.ts`:

```typescript
const TOKEN_RE = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(var|let|const|function|return|if|else|for|while|new|this|class|extends|import|export|from|true|false|null|undefined|typeof|instanceof)\b|\b(cc|sp|ccs)\b|\b(\d+(?:\.\d+)?)\b/gm;

export function highlightSyntax(escapedHtml: string): string {
  return escapedHtml.replace(TOKEN_RE, (match, comment, str, kw, ns, num) => {
    if (comment) return `<span class="syn-cmt">${comment}</span>`;
    if (str) return `<span class="syn-str">${str}</span>`;
    if (kw) return `<span class="syn-kw">${kw}</span>`;
    if (ns) return `<span class="syn-ns">${ns}</span>`;
    if (num) return `<span class="syn-num">${num}</span>`;
    return match;
  });
}
```

- [ ] **Step 3: Create format utilities**

Create `src/renderer/utils/format.ts`:

```typescript
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/types.ts src/renderer/utils/
git commit -m "feat: add TypeScript types and shared utility functions"
```

---

### Task 5: CSS — Design Tokens & Global Styles

**Files:**
- Create: `src/renderer/styles/tokens.css`
- Create: `src/renderer/styles/global.css`

- [ ] **Step 1: Create design tokens**

Create `src/renderer/styles/tokens.css` — extract all CSS variables from existing `main.css`:

```css
:root {
  /* ZPS Brand Core */
  --zps-brand-red: #E8341A;
  --zps-brand-orange: #F5A623;
  --zps-brand-gradient: linear-gradient(135deg, #E8341A 0%, #F5A623 100%);

  /* Background System */
  --bg-primary: #13151F;
  --bg-secondary: #1A1C2B;
  --bg-surface: #252836;
  --bg-hover: #2E3148;
  --bg-active: #363A52;
  --bg-elevated: #2E3148;

  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: #8A8FA8;
  --text-muted: #5A5F7A;

  /* Accent Colors */
  --accent: #F5A623;
  --accent-hover: #FFBA42;
  --accent-dim: rgba(245, 166, 35, 0.15);
  --accent-green: #00D68F;
  --accent-purple: #7C4DFF;
  --accent-blue: #4A90D9;
  --green: #00D68F;
  --green-hover: #00C280;
  --red: #E8341A;
  --orange: #F5A623;

  /* Semantic */
  --success: #00D68F;
  --warning: #F5A623;
  --danger: #E8341A;

  /* Border */
  --border: rgba(255, 255, 255, 0.08);
  --border-hover: rgba(255, 255, 255, 0.14);

  /* Shape */
  --radius-sm: 8px;
  --radius: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-pill: 9999px;

  /* Typography */
  --font: 'Inter', 'Be Vietnam Pro', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
  --font-mono: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  --font-size-base: 13px;
  --code-font-size: 11px;

  /* Shadows */
  --shadow-card: 0 4px 16px rgba(0, 0, 0, 0.3);
  --shadow-popup: 0 8px 32px rgba(0, 0, 0, 0.45);
  --shadow-hover: 0 8px 24px rgba(0, 0, 0, 0.4);

  /* Chromatic surfaces */
  --surface-red: linear-gradient(135deg, rgba(232, 52, 26, 0.12), rgba(232, 52, 26, 0.03));
  --surface-green: linear-gradient(135deg, rgba(0, 214, 143, 0.12), rgba(0, 214, 143, 0.03));
  --surface-orange: linear-gradient(135deg, rgba(245, 166, 35, 0.12), rgba(245, 166, 35, 0.03));

  /* Transition */
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-snap: cubic-bezier(0, 0, 0.2, 1);
  --transition: 200ms var(--ease-smooth);
  --transition-fast: 100ms var(--ease-snap);
  --transition-bounce: 300ms var(--ease-bounce);

  /* Gradient card */
  --gradient-card: linear-gradient(135deg, #252836 0%, #1A1C2B 100%);

  /* Syntax highlighting */
  --syn-str: #ce9178;
  --syn-kw: #569cd6;
  --syn-num: #b5cea8;
  --syn-ns: #4ec9b0;
  --syn-cmt: #6a9955;
}
```

- [ ] **Step 2: Create global styles**

Create `src/renderer/styles/global.css`:

```css
@import './tokens.css';

/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

html, body, #root {
  height: 100%;
  font-family: var(--font);
  font-size: var(--font-size-base);
  color: var(--text-primary);
  background: var(--bg-primary);
  overflow: hidden;
  user-select: none;
  line-height: 1.5;
}

code {
  font-family: var(--font-mono);
  background: var(--bg-surface);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid var(--border);
  color: var(--accent);
}

/* Syntax highlighting tokens (global — used in dangerouslySetInnerHTML) */
.syn-str { color: var(--syn-str); }
.syn-kw { color: var(--syn-kw); }
.syn-num { color: var(--syn-num); }
.syn-ns { color: var(--syn-ns); }
.syn-cmt { color: var(--syn-cmt); font-style: italic; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-pill);
}
::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
::-webkit-scrollbar-corner { background: transparent; }
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/styles/tokens.css src/renderer/styles/global.css
git commit -m "feat: extract design tokens and global styles for React renderer"
```

---

### Task 6: Zustand Stores

**Files:**
- Create: `src/renderer/stores/useAppStore.ts`
- Create: `src/renderer/stores/useScannerStore.ts`

- [ ] **Step 1: Create useAppStore**

Create `src/renderer/stores/useAppStore.ts`:

```typescript
import { create } from 'zustand';
import type { PageName, RecentFolder, AppSettings } from '../types';

interface AppState {
  currentPage: PageName;
  projectPath: string | null;
  recentFolders: RecentFolder[];
  settings: AppSettings;

  navigateTo: (page: PageName) => void;
  openProject: (folderPath: string) => Promise<void>;
  closeProject: () => void;
  loadRecentFolders: () => Promise<void>;
  removeRecentFolder: (folderPath: string) => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 'folder-picker',
  projectPath: null,
  recentFolders: [],
  settings: {
    fontSize: 13,
    codeFontSize: 11,
    enableFilenameMatching: false,
  },

  navigateTo: (page) => set({ currentPage: page }),

  openProject: async (folderPath) => {
    const name = folderPath.split(/[\\/]/).pop() || folderPath;
    await window.api.addRecentFolder({ path: folderPath, name });
    const folders = await window.api.getRecentFolders();
    set({
      projectPath: folderPath,
      currentPage: 'home',
      recentFolders: folders,
    });
  },

  closeProject: () => {
    set({
      projectPath: null,
      currentPage: 'folder-picker',
    });
  },

  loadRecentFolders: async () => {
    const folders = await window.api.getRecentFolders();
    set({ recentFolders: folders });
  },

  removeRecentFolder: async (folderPath) => {
    const folders = await window.api.removeRecentFolder(folderPath);
    set({ recentFolders: folders });
  },

  loadSettings: async () => {
    const settings = await window.api.getSettings();
    set({ settings });
    applyFontSettings(settings);
  },

  updateSettings: async (partial) => {
    const current = get().settings;
    const updated = { ...current, ...partial };
    set({ settings: updated });
    await window.api.saveSettings(updated);
    applyFontSettings(updated);
  },
}));

function applyFontSettings(settings: AppSettings) {
  document.documentElement.style.setProperty('--font-size-base', settings.fontSize + 'px');
  document.documentElement.style.setProperty('--code-font-size', settings.codeFontSize + 'px');
}
```

- [ ] **Step 2: Create useScannerStore**

Create `src/renderer/stores/useScannerStore.ts`:

```typescript
import { create } from 'zustand';
import type { Resource, ScanResult, ScanStats, DeleteResult } from '../types';

interface ScannerState {
  scanResult: ScanResult | null;
  isScanning: boolean;
  scanProgress: { message: string; current: number; total: number } | null;
  selectedFile: Resource | null;
  filterMode: 'all' | 'used' | 'unused';
  fileTypeFilter: string;
  searchQuery: string;

  startScan: (projectPath: string, filenameMatch: boolean) => Promise<void>;
  selectFile: (resource: Resource | null) => void;
  setFilterMode: (mode: 'all' | 'used' | 'unused') => void;
  setFileTypeFilter: (type: string) => void;
  setSearchQuery: (query: string) => void;
  deleteFiles: (resources: Resource[]) => Promise<{ deleted: DeleteResult[]; failed: DeleteResult[] }>;
  removeDeletedFromResults: (deletedPaths: string[]) => void;
  reset: () => void;
}

export const useScannerStore = create<ScannerState>((set, get) => ({
  scanResult: null,
  isScanning: false,
  scanProgress: null,
  selectedFile: null,
  filterMode: 'all',
  fileTypeFilter: 'all',
  searchQuery: '',

  startScan: async (projectPath, filenameMatch) => {
    set({ isScanning: true, scanProgress: null, scanResult: null, selectedFile: null });

    const cleanup = window.api.onScanProgress((progress) => {
      set({ scanProgress: { message: progress.message || 'Working...', current: progress.current || 0, total: progress.total || 0 } });
    });

    try {
      const result = await window.api.scanProject(projectPath, { filenameMatch });
      if (result.success && result.data) {
        set({ scanResult: result.data });
      }
    } finally {
      cleanup();
      set({ isScanning: false, scanProgress: null });
    }
  },

  selectFile: (resource) => set({ selectedFile: resource }),

  setFilterMode: (mode) => set({ filterMode: mode }),

  setFileTypeFilter: (type) => set({ fileTypeFilter: type }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  deleteFiles: async (resources) => {
    const absPaths = resources.map(r => r.absPath);
    const result = await window.api.deleteFiles(absPaths);

    const deleted = result.results.filter(r => r.success);
    const failed = result.results.filter(r => !r.success);

    return { deleted, failed };
  },

  removeDeletedFromResults: (deletedPaths) => {
    const { scanResult } = get();
    if (!scanResult) return;

    const deletedSet = new Set(deletedPaths.map(p => p.replace(/\\/g, '/')));
    const resourceList = scanResult.resourceList.filter(res => {
      const absNorm = res.absPath.replace(/\\/g, '/');
      return !deletedSet.has(absNorm);
    });

    const usedCount = resourceList.filter(r => r.used).length;
    const stats: ScanStats = {
      ...scanResult.stats,
      totalResources: resourceList.length,
      usedCount,
      unusedCount: resourceList.length - usedCount,
    };

    set({ scanResult: { resourceList, stats }, selectedFile: null });
  },

  reset: () => set({
    scanResult: null,
    isScanning: false,
    scanProgress: null,
    selectedFile: null,
    filterMode: 'all',
    fileTypeFilter: 'all',
    searchQuery: '',
  }),
}));

export function getFilteredResources(state: ScannerState): Resource[] {
  if (!state.scanResult) return [];

  return state.scanResult.resourceList.filter(res => {
    if (state.filterMode === 'used' && !res.used) return false;
    if (state.filterMode === 'unused' && res.used) return false;

    if (state.fileTypeFilter !== 'all') {
      const resType = res.type === 'cocos-json' ? 'json' : res.type;
      if (resType !== state.fileTypeFilter) return false;
    }

    if (state.searchQuery && !res.path.toLowerCase().includes(state.searchQuery.toLowerCase())) return false;

    return true;
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stores/
git commit -m "feat: add Zustand stores for app navigation and scanner state"
```

---

### Task 7: Common Components

**Files:**
- Create: `src/renderer/components/common/Button.tsx` + `.module.css`
- Create: `src/renderer/components/common/Modal.tsx` + `.module.css`
- Create: `src/renderer/components/common/ContextMenu.tsx` + `.module.css`
- Create: `src/renderer/components/common/StatusBar.tsx` + `.module.css`
- Create: `src/renderer/components/layout/PageHeader.tsx` + `.module.css`

- [ ] **Step 1: Create Button component**

Create `src/renderer/components/common/Button.module.css`:

```css
.primary {
  background: var(--accent-green);
  color: #fff;
  border: none;
  padding: 12px 36px;
  border-radius: var(--radius-pill);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition);
  box-shadow: 0 4px 16px rgba(0, 214, 143, 0.3);
  letter-spacing: 0.3px;
}
.primary:hover {
  box-shadow: 0 6px 24px rgba(0, 214, 143, 0.4);
  transform: translateY(-1px);
  filter: brightness(1.1);
}
.primary:active {
  transform: scale(0.97) translateY(0);
}

.icon {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  padding: 6px 10px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}
.icon:hover {
  background: var(--bg-hover);
  color: #fff;
  transform: scale(1.05);
}
.icon:active { transform: scale(0.95); }

.ghost {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 8px 18px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition);
  font-weight: 500;
}
.ghost:hover {
  border-color: var(--border-hover);
  color: #fff;
  background: var(--bg-hover);
}

.danger {
  background: var(--danger);
  color: #fff;
  border: none;
  padding: 8px 22px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
  transition: all var(--transition);
}
.danger:hover { filter: brightness(1.1); box-shadow: 0 2px 8px rgba(232, 52, 26, 0.3); }
.danger:active { transform: scale(0.97); }
```

Create `src/renderer/components/common/Button.tsx`:

```tsx
import React from 'react';
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'icon' | 'ghost' | 'danger';
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  return (
    <button className={`${styles[variant]}${className ? ' ' + className : ''}`} {...props}>
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Create Modal component**

Create `src/renderer/components/common/Modal.module.css`:

```css
.overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 20000;
  background: rgba(19, 21, 31, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.box {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  min-width: 380px;
  max-width: 520px;
  box-shadow: var(--shadow-popup);
  animation: modalEnter 300ms var(--ease-bounce);
}

.boxLarge {
  min-width: 480px;
  max-width: 700px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

@keyframes modalEnter {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.header {
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
}

.body {
  padding: 18px 20px;
  color: var(--text-primary);
  font-size: var(--font-size-base);
  line-height: 1.6;
  overflow-y: auto;
}

.footer {
  padding: 12px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--border);
}
```

Create `src/renderer/components/common/Modal.tsx`:

```tsx
import React from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  title: string;
  large?: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function Modal({ title, large, onClose, footer, children }: ModalProps) {
  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${styles.box}${large ? ' ' + styles.boxLarge : ''}`}>
        <div className={styles.header}>{title}</div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ContextMenu component**

Create `src/renderer/components/common/ContextMenu.module.css`:

```css
.menu {
  position: fixed;
  z-index: 10000;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px 0;
  min-width: 220px;
  box-shadow: var(--shadow-popup);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  animation: contextMenuEnter 150ms var(--ease-bounce);
}

@keyframes contextMenuEnter {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.item {
  padding: 8px 18px;
  font-size: var(--font-size-base);
  color: var(--text-primary);
  cursor: pointer;
  white-space: nowrap;
  border-radius: var(--radius-sm);
  margin: 1px 6px;
  transition: background 150ms var(--ease-smooth);
  display: flex;
  align-items: center;
  gap: 8px;
}
.item:hover {
  background: var(--bg-hover);
}
.itemDanger {
  color: var(--danger);
}
.itemDanger:hover {
  background: rgba(232, 52, 26, 0.12);
}
```

Create `src/renderer/components/common/ContextMenu.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import styles from './ContextMenu.module.css';

export interface MenuItem {
  label: string;
  action: string;
  danger?: boolean;
  hidden?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onAction: (action: string) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onAction, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = () => onClose();
    const handleBlur = () => onClose();
    document.addEventListener('click', handleClick);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  let posX = x;
  let posY = y;
  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect();
    if (posX + rect.width > window.innerWidth) posX = window.innerWidth - rect.width - 4;
    if (posY + rect.height > window.innerHeight) posY = window.innerHeight - rect.height - 4;
  }

  const visibleItems = items.filter(item => !item.hidden);

  return (
    <div ref={menuRef} className={styles.menu} style={{ left: posX, top: posY }}>
      {visibleItems.map(item => (
        <div
          key={item.action}
          className={`${styles.item}${item.danger ? ' ' + styles.itemDanger : ''}`}
          onClick={(e) => { e.stopPropagation(); onAction(item.action); onClose(); }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create StatusBar component**

Create `src/renderer/components/common/StatusBar.module.css`:

```css
.statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 16px;
  background: linear-gradient(90deg, #1A1C2B 0%, #252836 100%);
  color: var(--text-secondary);
  font-size: 12px;
  height: 28px;
  flex-shrink: 0;
  border-top: 1px solid var(--border);
}

.stats {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
}
```

Create `src/renderer/components/common/StatusBar.tsx`:

```tsx
import React from 'react';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  text: string;
  stats?: string;
}

export function StatusBar({ text, stats }: StatusBarProps) {
  return (
    <div className={styles.statusbar}>
      <span>{text}</span>
      {stats && <span className={styles.stats}>{stats}</span>}
    </div>
  );
}
```

- [ ] **Step 5: Create PageHeader component**

Create `src/renderer/components/layout/PageHeader.module.css`:

```css
.header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  padding-right: 140px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  gap: 12px;
  height: 48px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.header button, .header select, .header input {
  -webkit-app-region: no-drag;
}

.left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.center {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: center;
}

.right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.subtitle {
  color: var(--text-muted);
  font-size: 12px;
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}
```

Create `src/renderer/components/layout/PageHeader.tsx`:

```tsx
import React from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}

export function PageHeader({ left, center, right }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      {left && <div className={styles.left}>{left}</div>}
      {center && <div className={styles.center}>{center}</div>}
      {right && <div className={styles.right}>{right}</div>}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/common/ src/renderer/components/layout/
git commit -m "feat: add common UI components — Button, Modal, ContextMenu, StatusBar, PageHeader"
```

---

### Task 8: Scanner Components

**Files:**
- Create all files in `src/renderer/components/scanner/`

- [ ] **Step 1: Create FilterBar**

Create `src/renderer/components/scanner/FilterBar.module.css`:

```css
.bar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filterBtn {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 5px 14px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
  font-weight: 500;
}
.filterBtn:hover {
  border-color: var(--border-hover);
  color: #fff;
  background: var(--bg-hover);
}
.filterBtnActive {
  background: var(--zps-brand-gradient);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 2px 8px rgba(232, 52, 26, 0.25);
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 4px;
}

.select {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 3px 6px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  width: 110px;
  outline: none;
  transition: all var(--transition);
  font-family: var(--font);
}

.search {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  width: 180px;
  outline: none;
  transition: all var(--transition);
  font-family: var(--font);
}
.search:focus {
  border-color: var(--accent);
  background: var(--bg-surface);
  box-shadow: 0 0 0 3px rgba(245, 166, 35, 0.15);
}
.search::placeholder { color: var(--text-muted); }
```

Create `src/renderer/components/scanner/FilterBar.tsx`:

```tsx
import React from 'react';
import { useScannerStore } from '../../stores/useScannerStore';
import styles from './FilterBar.module.css';

const FILTERS = [
  { label: 'All', value: 'all' as const },
  { label: '\u2713 Used', value: 'used' as const },
  { label: '\u2717 Unused', value: 'unused' as const },
];

const TYPE_OPTIONS = [
  { label: 'All Types', value: 'all' },
  { label: 'Images', value: 'image' },
  { label: 'Audio', value: 'audio' },
  { label: 'JSON', value: 'json' },
  { label: 'Plist', value: 'plist' },
  { label: 'Atlas', value: 'atlas' },
  { label: 'Fonts', value: 'font' },
  { label: 'Shaders', value: 'shader' },
  { label: 'Other', value: 'file' },
];

export function FilterBar() {
  const filterMode = useScannerStore(s => s.filterMode);
  const fileTypeFilter = useScannerStore(s => s.fileTypeFilter);
  const searchQuery = useScannerStore(s => s.searchQuery);
  const setFilterMode = useScannerStore(s => s.setFilterMode);
  const setFileTypeFilter = useScannerStore(s => s.setFileTypeFilter);
  const setSearchQuery = useScannerStore(s => s.setSearchQuery);

  return (
    <div className={styles.bar}>
      {FILTERS.map(f => (
        <button
          key={f.value}
          className={`${styles.filterBtn}${filterMode === f.value ? ' ' + styles.filterBtnActive : ''}`}
          onClick={() => setFilterMode(f.value)}
        >
          {f.label}
        </button>
      ))}
      <span className={styles.divider} />
      <select
        className={styles.select}
        value={fileTypeFilter}
        onChange={e => setFileTypeFilter(e.target.value)}
      >
        {TYPE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <input
        className={styles.search}
        type="text"
        placeholder="Search files..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create TreeView and TreeRow**

Create `src/renderer/components/scanner/TreeView.module.css`:

```css
.container {
  overflow: auto;
  height: 100%;
  padding: 4px 0;
}

.node { cursor: pointer; user-select: none; }

.row {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  gap: 4px;
  transition: all 150ms var(--ease-smooth);
  white-space: nowrap;
  border-radius: var(--radius-sm);
  margin: 1px 6px;
  border: 1px solid transparent;
}
.row:hover { background: var(--bg-hover); }
.rowSelected {
  background: rgba(245, 166, 35, 0.1);
  border-color: rgba(245, 166, 35, 0.2);
  border-left: 2px solid var(--accent);
}

.indent { display: inline-block; width: 18px; flex-shrink: 0; }

.arrow {
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; color: var(--text-muted); flex-shrink: 0;
  transition: transform 200ms var(--ease-smooth);
}
.arrowExpanded { transform: rotate(90deg); }
.arrowHidden { visibility: hidden; }

.icon {
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; flex-shrink: 0;
}

.name {
  flex: 1;
  font-size: var(--font-size-base);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.status {
  font-size: 10px; width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%; flex-shrink: 0; margin-left: auto; font-weight: 700;
}
.statusUsed { color: var(--success); }
.statusUnused { color: var(--danger); }

.summary {
  font-size: 10px; color: var(--text-muted);
  margin-left: 4px; flex-shrink: 0;
  font-family: var(--font-mono); font-weight: 500;
}

.children { display: none; }
.childrenExpanded { display: block; }
```

Create `src/renderer/components/scanner/TreeRow.tsx`:

```tsx
import React from 'react';
import type { TreeNode, Resource } from '../../types';
import styles from './TreeView.module.css';

const ICON_MAP: Record<string, string> = {
  image: '\uD83D\uDDBC\uFE0F',
  audio: '\uD83D\uDD0A',
  json: '{}',
  'cocos-json': '{}',
  plist: '\uD83D\uDCCB',
  atlas: '\uD83D\uDDFA\uFE0F',
  font: '\uD83D\uDD24',
  shader: '\u2728',
  xml: '\uD83D\uDCC4',
  anim: '\uD83C\uDFAC',
  file: '\uD83D\uDCC4',
};

function getFileIcon(type: string): string {
  return ICON_MAP[type] || '\uD83D\uDCC4';
}

function countDirStatus(node: TreeNode): { total: number; unused: number } {
  let total = 0, unused = 0;
  if (!node.children) return { total, unused };
  for (const child of node.children.values()) {
    if (child.isDir) {
      const sub = countDirStatus(child);
      total += sub.total;
      unused += sub.unused;
    } else {
      total++;
      if (child.resource && !child.resource.used) unused++;
    }
  }
  return { total, unused };
}

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  isRoot?: boolean;
  selectedPath: string | null;
  onSelect: (resource: Resource) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode, type: 'file' | 'dir') => void;
}

export function TreeRowComponent({ node, depth, isRoot, selectedPath, onSelect, onContextMenu }: TreeRowProps) {
  const [expanded, setExpanded] = React.useState(!!isRoot);

  if (node.isDir) {
    const counts = countDirStatus(node);
    const sorted = node.children
      ? Array.from(node.children.values()).sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
      : [];

    return (
      <div className={styles.node}>
        <div
          className={styles.row}
          onClick={() => setExpanded(!expanded)}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node, 'dir'); }}
        >
          {Array.from({ length: depth }, (_, i) => (
            <span key={i} className={styles.indent} />
          ))}
          <span className={`${styles.arrow}${expanded ? ' ' + styles.arrowExpanded : ''}`}>{'\u25B6'}</span>
          <span className={styles.icon}>{expanded ? '\uD83D\uDCC2' : '\uD83D\uDCC1'}</span>
          <span className={styles.name}>{node.name}</span>
          {counts.total > 0 && (
            <span className={styles.summary} title={`${counts.unused} unused of ${counts.total}`}>
              {counts.unused}/{counts.total}
            </span>
          )}
        </div>
        <div className={expanded ? styles.childrenExpanded : styles.children}>
          {sorted.map(child => (
            <TreeRowComponent
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      </div>
    );
  }

  // File node
  const resource = node.resource!;
  const isSelected = selectedPath === resource.path;

  return (
    <div className={styles.node}>
      <div
        className={`${styles.row}${isSelected ? ' ' + styles.rowSelected : ''}`}
        onClick={() => onSelect(resource)}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node, 'file'); }}
      >
        {Array.from({ length: depth }, (_, i) => (
          <span key={i} className={styles.indent} />
        ))}
        <span className={`${styles.arrow} ${styles.arrowHidden}`}>{'\u25B6'}</span>
        <span className={styles.icon}>{getFileIcon(resource.type)}</span>
        <span className={styles.name}>{node.name}</span>
        <span className={`${styles.status} ${resource.used ? styles.statusUsed : styles.statusUnused}`}>
          {resource.used ? '\u2713' : '\u2717'}
        </span>
      </div>
    </div>
  );
}
```

Create `src/renderer/components/scanner/TreeView.tsx`:

```tsx
import React, { useMemo } from 'react';
import type { Resource, TreeNode } from '../../types';
import { useScannerStore, getFilteredResources } from '../../stores/useScannerStore';
import { TreeRowComponent } from './TreeRow';
import styles from './TreeView.module.css';

function buildTreeData(resourceList: Resource[]): TreeNode {
  const root: TreeNode = { name: 'res', children: new Map(), isDir: true, path: 'res' };

  for (const res of resourceList) {
    const parts = res.path.split('/');
    let current = root;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.children!.set(part, {
          name: part,
          isDir: false,
          resource: res,
          path: res.path,
        });
      } else {
        if (!current.children!.has(part)) {
          current.children!.set(part, {
            name: part,
            isDir: true,
            children: new Map(),
            path: parts.slice(0, i + 1).join('/'),
          });
        }
        current = current.children!.get(part)!;
      }
    }
  }

  return root;
}

interface TreeViewProps {
  onContextMenu: (e: React.MouseEvent, node: TreeNode, type: 'file' | 'dir') => void;
}

export function TreeView({ onContextMenu }: TreeViewProps) {
  const state = useScannerStore();
  const selectedFile = useScannerStore(s => s.selectedFile);
  const selectFile = useScannerStore(s => s.selectFile);

  const filteredResources = useMemo(() => getFilteredResources(state), [
    state.scanResult, state.filterMode, state.fileTypeFilter, state.searchQuery
  ]);

  const tree = useMemo(() => buildTreeData(filteredResources), [filteredResources]);

  return (
    <div className={styles.container}>
      <TreeRowComponent
        node={tree}
        depth={0}
        isRoot
        selectedPath={selectedFile?.path || null}
        onSelect={selectFile}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create PreviewPanel**

Create `src/renderer/components/scanner/PreviewPanel.module.css`:

```css
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 150px;
}
.header {
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.body {
  flex: 1;
  overflow: auto;
  padding: 12px;
}
.empty {
  color: var(--text-muted);
  text-align: center;
  padding: 48px 24px;
  font-size: 13px;
}
.imageWrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
}
.imageWrap img {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
  background: repeating-conic-gradient(var(--bg-hover) 0% 25%, var(--bg-surface) 0% 50%) 50% / 16px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.imageInfo {
  color: var(--text-muted);
  font-size: 11px;
  font-family: var(--font-mono);
}
.audioWrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
.audioWrap audio { width: 100%; max-width: 400px; }
.audioInfo {
  margin-bottom: 8px;
  color: var(--text-secondary);
}
.textPreview {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
}
```

Create `src/renderer/components/scanner/PreviewPanel.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { useScannerStore } from '../../stores/useScannerStore';
import { formatBytes } from '../../utils/format';
import styles from './PreviewPanel.module.css';

interface PreviewData {
  type: string;
  data: string;
  size: number;
  fileName: string;
}

export function PreviewPanel() {
  const selectedFile = useScannerStore(s => s.selectedFile);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    window.api.getPreview(selectedFile.absPath).then(result => {
      if (cancelled) return;
      setLoading(false);
      if (!result.success) {
        setError(result.message || 'Cannot preview');
      } else {
        setPreview({
          type: result.type!,
          data: result.data!,
          size: result.size!,
          fileName: result.fileName!,
        });
      }
    });

    return () => { cancelled = true; };
  }, [selectedFile?.absPath]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Preview</div>
      <div className={styles.body}>
        {!selectedFile && <div className={styles.empty}>Select a file to preview</div>}
        {loading && <div className={styles.empty}>Loading...</div>}
        {error && <div className={styles.empty}>Cannot preview: {error}</div>}
        {preview && preview.type === 'image' && (
          <div className={styles.imageWrap}>
            <img src={preview.data} alt={preview.fileName} />
            <div className={styles.imageInfo}>{preview.fileName} &middot; {formatBytes(preview.size)}</div>
          </div>
        )}
        {preview && preview.type === 'audio' && (
          <div className={styles.audioWrap}>
            <div>
              <div className={styles.audioInfo}>{preview.fileName} &middot; {formatBytes(preview.size)}</div>
              <audio controls src={`file://${preview.data.replace(/\\/g, '/')}`} />
            </div>
          </div>
        )}
        {preview && preview.type === 'text' && (
          <pre className={styles.textPreview}>
            {preview.data.length > 50000 ? preview.data.substring(0, 50000) + '\n\n... (truncated)' : preview.data}
          </pre>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ReferenceItem and ReferencesPanel**

Create `src/renderer/components/scanner/ReferenceItem.module.css`:

```css
.item {
  padding: 10px 12px;
  border-radius: var(--radius);
  margin-bottom: 8px;
  background: var(--bg-surface);
  cursor: pointer;
  transition: all var(--transition);
  border: 1px solid transparent;
}
.item:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.source {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badgeJson { background: rgba(0, 214, 143, 0.15); color: #00D68F; }
.badgeJs { background: rgba(245, 166, 35, 0.15); color: #F5A623; }
.badgePlist { background: rgba(124, 77, 255, 0.15); color: #7C4DFF; }
.badgeAtlas { background: rgba(74, 144, 217, 0.15); color: #4A90D9; }
.badgeFname { background: rgba(232, 52, 26, 0.15); color: #E8341A; }
.file {
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
  color: var(--accent);
}
.line {
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
  color: var(--text-muted);
}
.copyBtn {
  margin-left: auto;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 6px;
  line-height: 1;
  transition: all var(--transition);
}
.copyBtn:hover { color: var(--text-primary); border-color: var(--text-secondary); background: var(--bg-hover); }
.copiedBtn { color: var(--success); border-color: var(--success); }
.codeBlock {
  font-family: var(--font-mono);
  font-size: var(--code-font-size);
  line-height: 1.6;
  margin: 6px 0 0 0;
  padding: 8px 0;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  user-select: text;
  -webkit-user-select: text;
  border: 1px solid var(--border);
}
.codeLine {
  display: flex;
  padding: 0 10px 0 0;
  white-space: pre;
}
.codeLineHighlight {
  background: rgba(245, 166, 35, 0.1);
  border-left: 2px solid var(--accent);
}
.codeLineGap {
  color: var(--text-muted);
  font-style: italic;
  justify-content: center;
  padding: 0;
  font-size: 10px;
}
.codeLinenum {
  display: inline-block;
  min-width: 40px;
  text-align: right;
  padding-right: 12px;
  color: var(--text-muted);
  user-select: none;
  flex-shrink: 0;
  opacity: 0.5;
}
.codeText {
  flex: 1;
  color: #d4d4d4;
}
```

Create `src/renderer/components/scanner/ReferenceItem.tsx`:

```tsx
import React, { useState, useCallback } from 'react';
import type { Reference } from '../../types';
import { escapeHtml } from '../../utils/format';
import { highlightSyntax } from '../../utils/syntax';
import styles from './ReferenceItem.module.css';

const BADGE_MAP: Record<string, { cls: string; label: string }> = {
  json: { cls: styles.badgeJson, label: 'JSON' },
  plist: { cls: styles.badgePlist, label: 'PLIST' },
  'atlas-texture': { cls: styles.badgeAtlas, label: 'ATLAS' },
  'plist-texture': { cls: styles.badgePlist, label: 'PLIST' },
  'filename-match': { cls: styles.badgeFname, label: 'FNAME' },
};

interface ReferenceItemProps {
  reference: Reference;
  projectPath: string;
}

export function ReferenceItem({ reference, projectPath }: ReferenceItemProps) {
  const [copied, setCopied] = useState(false);

  const badge = BADGE_MAP[reference.type] || { cls: styles.badgeJs, label: 'JS' };

  const handleClick = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;

    if (reference.source && projectPath) {
      const fullPath = projectPath + '/' + reference.source;
      window.api.openCodeViewer(fullPath, reference.line || 0);
    }
  }, [reference, projectPath]);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const texts: string[] = [];
    if (reference.context) {
      reference.context.forEach(entry => texts.push(entry.text));
    } else if (reference.snippet) {
      texts.push(reference.snippet);
    }
    navigator.clipboard.writeText(texts.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [reference]);

  const renderCodeBlock = () => {
    if (reference.context && reference.context.length > 0) {
      return reference.context.map((entry, i) => {
        const lineNumStr = entry.lineNum != null ? String(entry.lineNum).padStart(4) : '    ';
        const isHighlight = entry.highlight;
        const isGap = entry.lineNum == null;
        const syntaxText = highlightSyntax(escapeHtml(entry.text));
        const classes = [styles.codeLine];
        if (isHighlight) classes.push(styles.codeLineHighlight);
        if (isGap) classes.push(styles.codeLineGap);

        return (
          <div key={i} className={classes.join(' ')}>
            <span className={styles.codeLinenum}>{lineNumStr}</span>
            <span className={styles.codeText} dangerouslySetInnerHTML={{ __html: syntaxText }} />
          </div>
        );
      });
    }

    const syntaxSnippet = highlightSyntax(escapeHtml(reference.snippet || ''));
    const lineNumStr = reference.line ? String(reference.line).padStart(4) : '    ';
    return (
      <div className={`${styles.codeLine} ${styles.codeLineHighlight}`}>
        <span className={styles.codeLinenum}>{lineNumStr}</span>
        <span className={styles.codeText} dangerouslySetInnerHTML={{ __html: syntaxSnippet }} />
      </div>
    );
  };

  return (
    <div className={styles.item} onClick={handleClick} title="Click to view source file">
      <div className={styles.source}>
        <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
        <span className={styles.file}>{reference.source}</span>
        {reference.line && <span className={styles.line}>:{reference.line}</span>}
        <button
          className={`${styles.copyBtn}${copied ? ' ' + styles.copiedBtn : ''}`}
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? '\u2713' : '\u29C9'}
        </button>
      </div>
      <pre className={styles.codeBlock}>
        {renderCodeBlock()}
      </pre>
    </div>
  );
}
```

Create `src/renderer/components/scanner/ReferencesPanel.module.css`:

```css
.panel {
  height: 260px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid var(--border);
}
.header {
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.body {
  flex: 1;
  overflow: auto;
  padding: 12px;
}
.empty {
  color: var(--text-muted);
  text-align: center;
  padding: 48px 24px;
  font-size: 13px;
}
.noRefs {
  color: var(--danger);
}
```

Create `src/renderer/components/scanner/ReferencesPanel.tsx`:

```tsx
import React from 'react';
import { useScannerStore } from '../../stores/useScannerStore';
import { useAppStore } from '../../stores/useAppStore';
import { ReferenceItem } from './ReferenceItem';
import styles from './ReferencesPanel.module.css';

export function ReferencesPanel() {
  const selectedFile = useScannerStore(s => s.selectedFile);
  const projectPath = useAppStore(s => s.projectPath);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>References</div>
      <div className={styles.body}>
        {!selectedFile && <div className={styles.empty}>Select a file to see references</div>}
        {selectedFile && (!selectedFile.references || selectedFile.references.length === 0) && (
          <div className={`${styles.empty} ${styles.noRefs}`}>
            {'\u2717'} No references found — this resource appears unused
          </div>
        )}
        {selectedFile && selectedFile.references && selectedFile.references.length > 0 && (
          selectedFile.references.map((ref, i) => (
            <ReferenceItem key={`${ref.source}-${ref.line}-${i}`} reference={ref} projectPath={projectPath || ''} />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create ScanProgress**

Create `src/renderer/components/scanner/ScanProgress.module.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(19, 21, 31, 0.88);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  flex-direction: column;
  gap: 20px;
}
.spinner {
  width: 44px; height: 44px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.text { color: var(--text-secondary); font-size: 14px; font-weight: 500; }
.barWrap {
  width: 320px; height: 4px;
  background: var(--bg-hover);
  border-radius: var(--radius-pill);
  overflow: hidden;
}
.bar {
  height: 100%;
  background: var(--zps-brand-gradient);
  transition: width 200ms ease;
  border-radius: var(--radius-pill);
  box-shadow: 0 0 12px rgba(232, 52, 26, 0.3);
}
```

Create `src/renderer/components/scanner/ScanProgress.tsx`:

```tsx
import React from 'react';
import { useScannerStore } from '../../stores/useScannerStore';
import styles from './ScanProgress.module.css';

export function ScanProgress() {
  const isScanning = useScannerStore(s => s.isScanning);
  const progress = useScannerStore(s => s.scanProgress);

  if (!isScanning) return null;

  const percent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className={styles.overlay}>
      <div className={styles.spinner} />
      <div className={styles.text}>{progress?.message || 'Scanning...'}</div>
      <div className={styles.barWrap}>
        <div className={styles.bar} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create DeleteConfirmModal and DeleteReportModal**

Create `src/renderer/components/scanner/DeleteConfirmModal.tsx`:

```tsx
import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { formatBytes } from '../../utils/format';
import type { Resource } from '../../types';

interface DeleteConfirmModalProps {
  resources: Resource[];
  folderPath?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({ resources, folderPath, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const totalSize = resources.reduce((sum, f) => sum + (f.size || 0), 0);
  const isSingle = resources.length === 1;

  return (
    <Modal
      title="Confirm Delete"
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Delete</Button>
        </>
      }
    >
      {isSingle ? (
        <>
          <p>Are you sure you want to delete this file?</p>
          <p><strong style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{resources[0].path}</strong></p>
          <p>Size: <strong>{formatBytes(resources[0].size)}</strong></p>
        </>
      ) : (
        <>
          <p>Delete <strong style={{ color: 'var(--red)' }}>{resources.length}</strong> unused file{resources.length !== 1 ? 's' : ''}{folderPath ? ` in ${folderPath}` : ''}?</p>
          <p>Total size: <strong>{formatBytes(totalSize)}</strong></p>
        </>
      )}
      <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>This action cannot be undone.</p>
    </Modal>
  );
}
```

Create `src/renderer/components/scanner/DeleteReportModal.tsx`:

```tsx
import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { formatBytes } from '../../utils/format';
import type { DeleteResult } from '../../types';

interface DeleteReportModalProps {
  deleted: DeleteResult[];
  failed: DeleteResult[];
  onClose: () => void;
}

export function DeleteReportModal({ deleted, failed, onClose }: DeleteReportModalProps) {
  const totalDeleted = deleted.reduce((sum, r) => sum + (r.size || 0), 0);

  return (
    <Modal
      title="Deletion Report"
      large
      onClose={onClose}
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div style={{ padding: '14px 16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Deleted successfully</span>
          <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>{deleted.length} file{deleted.length !== 1 ? 's' : ''}</strong>
        </div>
        {failed.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Failed</span>
            <strong style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>{failed.length} file{failed.length !== 1 ? 's' : ''}</strong>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Space freed</span>
          <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatBytes(totalDeleted)}</strong>
        </div>
      </div>

      {deleted.length > 0 && (
        <>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>Deleted files:</div>
          <div style={{ maxHeight: '300px', overflowY: 'auto', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            {deleted.map(r => {
              const relPath = r.path.replace(/\\/g, '/');
              const displayPath = relPath.split('/res/').pop() || relPath;
              return (
                <div key={r.path} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '12px' }} title={relPath}>res/{displayPath}</span>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{formatBytes(r.size || 0)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {failed.length > 0 && (
        <>
          <div style={{ fontWeight: 600, margin: '10px 0 6px', color: 'var(--red)' }}>Failed to delete:</div>
          <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            {failed.map(r => (
              <div key={r.path} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px' }}>
                <span>{r.path.replace(/\\/g, '/')}</span>
                <span style={{ color: 'var(--red)' }}>{r.error}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
```

- [ ] **Step 7: Create SettingsPopup**

Create `src/renderer/components/scanner/SettingsPopup.module.css`:

```css
.popup {
  position: fixed;
  top: 54px;
  right: 14px;
  width: 340px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-popup);
  z-index: 500;
  user-select: none;
  animation: settingsEnter 300ms var(--ease-bounce);
}
@keyframes settingsEnter {
  from { opacity: 0; transform: scale(0.95) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 14px; font-weight: 700; color: var(--text-primary);
}
.closeBtn {
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  font-size: 14px; padding: 4px 6px; border-radius: 6px;
  transition: all var(--transition);
}
.closeBtn:hover { color: var(--text-primary); background: var(--bg-hover); }
.body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.row { display: flex; align-items: center; gap: 10px; }
.label { font-size: 13px; color: var(--text-secondary); min-width: 110px; font-weight: 500; }
.control { display: flex; align-items: center; gap: 6px; flex: 1; }
.sizeBtn {
  background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-primary);
  width: 28px; height: 28px; border-radius: var(--radius-sm); cursor: pointer;
  font-size: 14px; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all var(--transition);
}
.sizeBtn:hover { background: var(--bg-hover); border-color: var(--accent); color: var(--accent); }
.slider { flex: 1; accent-color: var(--accent); height: 4px; cursor: pointer; }
.sizeValue {
  font-family: var(--font-mono); font-size: 11px; color: var(--accent);
  min-width: 32px; text-align: right; font-weight: 600;
}
.divider { border: none; border-top: 1px solid var(--border); margin: 2px 0; }
.sectionTitle {
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.08em;
}
.checkboxLabel {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  font-size: 13px; color: var(--text-primary); user-select: none;
}
.checkboxLabel input { accent-color: var(--accent); width: 16px; height: 16px; cursor: pointer; }
.hint {
  font-size: 11px; color: var(--text-muted); line-height: 1.4;
  padding-left: 24px; margin-top: -6px;
}
.footer {
  border-top: 1px solid var(--border); padding-top: 12px;
  display: flex; justify-content: flex-end;
}
.resetBtn {
  background: none; border: 1px solid var(--border); color: var(--text-muted);
  font-size: 12px; padding: 6px 14px; border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition); font-weight: 500;
}
.resetBtn:hover { border-color: var(--danger); color: var(--danger); background: rgba(232, 52, 26, 0.08); }
```

Create `src/renderer/components/scanner/SettingsPopup.tsx`:

```tsx
import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import styles from './SettingsPopup.module.css';

interface SettingsPopupProps {
  onClose: () => void;
}

export function SettingsPopup({ onClose }: SettingsPopupProps) {
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);

  const handleReset = () => {
    updateSettings({ fontSize: 13, codeFontSize: 11, enableFilenameMatching: false });
  };

  return (
    <div className={styles.popup} onClick={e => e.stopPropagation()}>
      <div className={styles.header}>
        <span>Settings</span>
        <button className={styles.closeBtn} onClick={onClose}>{'\u2715'}</button>
      </div>
      <div className={styles.body}>
        <div className={styles.row}>
          <label className={styles.label}>Font size</label>
          <div className={styles.control}>
            <button className={styles.sizeBtn} onClick={() => updateSettings({ fontSize: Math.max(11, settings.fontSize - 1) })}>{'\u2212'}</button>
            <input
              className={styles.slider}
              type="range" min={11} max={20} step={1}
              value={settings.fontSize}
              onChange={e => updateSettings({ fontSize: parseInt(e.target.value) })}
            />
            <button className={styles.sizeBtn} onClick={() => updateSettings({ fontSize: Math.min(20, settings.fontSize + 1) })}>+</button>
            <span className={styles.sizeValue}>{settings.fontSize}px</span>
          </div>
        </div>
        <div className={styles.row}>
          <label className={styles.label}>Code font size</label>
          <div className={styles.control}>
            <button className={styles.sizeBtn} onClick={() => updateSettings({ codeFontSize: Math.max(9, settings.codeFontSize - 1) })}>{'\u2212'}</button>
            <input
              className={styles.slider}
              type="range" min={9} max={18} step={1}
              value={settings.codeFontSize}
              onChange={e => updateSettings({ codeFontSize: parseInt(e.target.value) })}
            />
            <button className={styles.sizeBtn} onClick={() => updateSettings({ codeFontSize: Math.min(18, settings.codeFontSize + 1) })}>+</button>
            <span className={styles.sizeValue}>{settings.codeFontSize}px</span>
          </div>
        </div>
        <hr className={styles.divider} />
        <div className={styles.sectionTitle}>Scan Options</div>
        <div className={styles.row}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={settings.enableFilenameMatching}
              onChange={e => updateSettings({ enableFilenameMatching: e.target.checked })}
            />
            <span>Match by filename in strings</span>
          </label>
        </div>
        <div className={styles.hint}>
          Mark resources as used if their filename (without extension) appears inside a string literal in source code. Re-scan required after changing.
        </div>
        <div className={styles.footer}>
          <button className={styles.resetBtn} onClick={handleReset}>Reset defaults</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/scanner/
git commit -m "feat: add all scanner components — FilterBar, TreeView, Preview, References, Settings, Modals"
```

---

### Task 9: Pages — FolderPickerPage, HomePage, ScannerPage

**Files:**
- Create: `src/renderer/pages/FolderPickerPage.tsx` + `.module.css`
- Create: `src/renderer/pages/HomePage.tsx` + `.module.css`
- Create: `src/renderer/pages/ScannerPage.tsx` + `.module.css`

- [ ] **Step 1: Create FolderPickerPage**

Create `src/renderer/pages/FolderPickerPage.module.css`:

```css
.page {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  position: relative;
  overflow: hidden;
  -webkit-app-region: drag;
}
.page button, .page a {
  -webkit-app-region: no-drag;
}

.page::before {
  content: '';
  position: absolute;
  width: 500px; height: 500px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(232, 52, 26, 0.08) 0%, rgba(245, 166, 35, 0.04) 40%, transparent 70%);
  top: 50%; left: 50%;
  transform: translate(-50%, -55%);
  pointer-events: none;
}

.card {
  text-align: center;
  max-width: 480px;
  background: var(--gradient-card);
  padding: 48px 44px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  position: relative;
  z-index: 1;
}

.icon {
  width: 64px; height: 64px;
  margin: 0 auto 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-lg);
  background: var(--zps-brand-gradient);
  box-shadow: 0 8px 24px rgba(232, 52, 26, 0.25);
}

.title {
  font-size: 24px; font-weight: 800;
  margin-bottom: 8px; color: #fff;
  letter-spacing: -0.3px; line-height: 1.2;
}

.desc {
  color: var(--text-secondary);
  margin-bottom: 32px;
  font-size: 14px; line-height: 1.5;
}

.hint {
  margin-top: 20px;
  color: var(--text-muted);
  font-size: 12px; line-height: 1.4;
}

.recentSection {
  width: 100%;
  max-width: 480px;
  margin-top: 24px;
  position: relative;
  z-index: 1;
}

.recentTitle {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 8px;
  padding-left: 4px;
}

.recentItem {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 6px;
  cursor: pointer;
  transition: all var(--transition);
  gap: 10px;
}
.recentItem:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.recentName {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}

.recentPath {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.recentTime {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.removeBtn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  transition: all var(--transition);
  flex-shrink: 0;
}
.removeBtn:hover {
  color: var(--danger);
  background: rgba(232, 52, 26, 0.1);
}
```

Create `src/renderer/pages/FolderPickerPage.tsx`:

```tsx
import React, { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Button } from '../components/common/Button';
import { timeAgo } from '../utils/format';
import styles from './FolderPickerPage.module.css';

export function FolderPickerPage() {
  const recentFolders = useAppStore(s => s.recentFolders);
  const openProject = useAppStore(s => s.openProject);
  const loadRecentFolders = useAppStore(s => s.loadRecentFolders);
  const removeRecentFolder = useAppStore(s => s.removeRecentFolder);

  useEffect(() => {
    loadRecentFolders();
  }, []);

  const handleSelectFolder = async () => {
    const result = await window.api.selectFolder();
    if (!result.success) {
      if (result.reason === 'invalid') {
        alert(result.message);
      }
      return;
    }
    openProject(result.path!);
  };

  const handleOpenRecent = (folderPath: string) => {
    openProject(folderPath);
  };

  const handleRemoveRecent = (e: React.MouseEvent, folderPath: string) => {
    e.stopPropagation();
    removeRecentFolder(folderPath);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon}>
          <svg viewBox="0 0 32 32" fill="none" width="32" height="32">
            <path d="M4 8c0-1.7 1.3-3 3-3h6l3 3h9c1.7 0 3 1.3 3 3v13c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3V8z" fill="rgba(255,255,255,0.9)"/>
            <path d="M4 12h24v12c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3V12z" fill="rgba(255,255,255,0.6)"/>
            <circle cx="16" cy="18" r="3" fill="rgba(255,255,255,0.4)"/>
          </svg>
        </div>
        <h1 className={styles.title}>Cocos Toolbox</h1>
        <p className={styles.desc}>Tools for managing your Cocos2d-JS game projects</p>
        <Button onClick={handleSelectFolder}>Select Project Folder</Button>
        <p className={styles.hint}>Folder must contain <code>res/</code> and <code>src/</code> directories</p>
      </div>

      {recentFolders.length > 0 && (
        <div className={styles.recentSection}>
          <div className={styles.recentTitle}>Recent Projects</div>
          {recentFolders.map(folder => (
            <div
              key={folder.path}
              className={styles.recentItem}
              onClick={() => handleOpenRecent(folder.path)}
            >
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className={styles.recentName}>{folder.name}</div>
                <div className={styles.recentPath}>{folder.path}</div>
              </div>
              <span className={styles.recentTime}>{timeAgo(folder.lastOpened)}</span>
              <button
                className={styles.removeBtn}
                onClick={(e) => handleRemoveRecent(e, folder.path)}
                title="Remove from recent"
              >
                {'\u2715'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create HomePage**

Create `src/renderer/pages/HomePage.module.css`:

```css
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  -webkit-app-region: drag;
}
.content button, .content a {
  -webkit-app-region: no-drag;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 280px));
  gap: 20px;
  justify-content: center;
  max-width: 900px;
}

.toolCard {
  background: var(--gradient-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 28px 24px;
  cursor: pointer;
  transition: all var(--transition);
  text-align: center;
}
.toolCard:hover {
  border-color: var(--accent);
  transform: translateY(-4px);
  box-shadow: var(--shadow-hover);
}

.toolIcon {
  width: 56px; height: 56px;
  margin: 0 auto 16px;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius);
  font-size: 28px;
}

.toolName {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.toolDesc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.changeFolderBtn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all var(--transition);
  font-family: var(--font-mono);
}
.changeFolderBtn:hover {
  color: var(--accent);
  background: var(--bg-hover);
}
```

Create `src/renderer/pages/HomePage.tsx`:

```tsx
import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import { PageHeader } from '../components/layout/PageHeader';
import styles from './HomePage.module.css';

const TOOLS = [
  {
    id: 'scanner' as const,
    icon: '\uD83D\uDD0D',
    iconBg: 'var(--surface-orange)',
    name: 'Scan Unused Resources',
    desc: 'Find and clean up unused resources in your project',
  },
  // Future tools go here
];

export function HomePage() {
  const projectPath = useAppStore(s => s.projectPath);
  const navigateTo = useAppStore(s => s.navigateTo);
  const closeProject = useAppStore(s => s.closeProject);

  return (
    <div className={styles.page}>
      <PageHeader
        left={
          <>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Cocos Toolbox</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)', marginLeft: '8px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {projectPath}
            </span>
          </>
        }
        right={
          <button className={styles.changeFolderBtn} onClick={closeProject}>
            Change Folder
          </button>
        }
      />
      <div className={styles.content}>
        <div className={styles.grid}>
          {TOOLS.map(tool => (
            <div
              key={tool.id}
              className={styles.toolCard}
              onClick={() => navigateTo(tool.id)}
            >
              <div className={styles.toolIcon} style={{ background: tool.iconBg }}>
                {tool.icon}
              </div>
              <div className={styles.toolName}>{tool.name}</div>
              <div className={styles.toolDesc}>{tool.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ScannerPage**

Create `src/renderer/pages/ScannerPage.module.css`:

```css
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.panelTree {
  width: 380px;
  min-width: 250px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  overflow: hidden;
}

.resizerV {
  width: 3px;
  cursor: col-resize;
  background: transparent;
  transition: background var(--transition);
  flex-shrink: 0;
  position: relative;
}
.resizerV::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0; left: 0; right: 0;
  background: var(--border);
}
.resizerV:hover::after, .resizerVActive::after {
  background: var(--accent);
  box-shadow: 0 0 8px rgba(245, 166, 35, 0.3);
}

.panelDetail {
  flex: 1;
  min-width: 300px;
  display: flex;
  flex-direction: column;
}

.resizerH {
  height: 3px;
  cursor: row-resize;
  background: transparent;
  transition: background var(--transition);
  flex-shrink: 0;
  position: relative;
}
.resizerH::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0; left: 0; right: 0;
  background: var(--border);
}
.resizerH:hover::after, .resizerHActive::after {
  background: var(--accent);
  box-shadow: 0 0 8px rgba(245, 166, 35, 0.3);
}

.startScanWrap {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  flex-direction: column;
  gap: 16px;
}

.startScanBtn {
  background: var(--zps-brand-gradient);
  color: #fff;
  border: none;
  padding: 14px 40px;
  border-radius: var(--radius-pill);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition);
  box-shadow: 0 4px 16px rgba(232, 52, 26, 0.3);
  letter-spacing: 0.3px;
}
.startScanBtn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(232, 52, 26, 0.4);
  filter: brightness(1.1);
}
.startScanBtn:active {
  transform: scale(0.97);
}

.startScanHint {
  color: var(--text-muted);
  font-size: 13px;
}
```

Create `src/renderer/pages/ScannerPage.tsx`:

```tsx
import React, { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useScannerStore } from '../stores/useScannerStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/common/Button';
import { StatusBar } from '../components/common/StatusBar';
import { ContextMenu, MenuItem } from '../components/common/ContextMenu';
import { FilterBar } from '../components/scanner/FilterBar';
import { TreeView } from '../components/scanner/TreeView';
import { PreviewPanel } from '../components/scanner/PreviewPanel';
import { ReferencesPanel } from '../components/scanner/ReferencesPanel';
import { ScanProgress } from '../components/scanner/ScanProgress';
import { SettingsPopup } from '../components/scanner/SettingsPopup';
import { DeleteConfirmModal } from '../components/scanner/DeleteConfirmModal';
import { DeleteReportModal } from '../components/scanner/DeleteReportModal';
import type { TreeNode, Resource, DeleteResult } from '../types';
import styles from './ScannerPage.module.css';

// SVG icons for toolbar buttons (same as original)
const RescanIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
    <path d="M14.5 4.5A7 7 0 004 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M5.5 15.5A7 7 0 0016 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M4 3v4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 17v-4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ExportIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
    <rect x="3" y="3" width="14" height="14" rx="2" fill="currentColor" opacity="0.2"/>
    <path d="M10 6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M7 9l3-3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 14h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const SettingsIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
    <circle cx="10" cy="10" r="3" fill="currentColor"/>
    <path d="M10 2a1.5 1.5 0 011.5 1.5v.6a6 6 0 012 1.15l.5-.3a1.5 1.5 0 012 .55l0 0a1.5 1.5 0 01-.55 2l-.5.3a6 6 0 010 2.3l.5.3a1.5 1.5 0 01.55 2l0 0a1.5 1.5 0 01-2 .55l-.5-.3a6 6 0 01-2 1.15v.6A1.5 1.5 0 0110 18h0a1.5 1.5 0 01-1.5-1.5v-.6a6 6 0 01-2-1.15l-.5.3a1.5 1.5 0 01-2-.55l0 0a1.5 1.5 0 01.55-2l.5-.3a6 6 0 010-2.3l-.5-.3a1.5 1.5 0 01-.55-2l0 0a1.5 1.5 0 012-.55l.5.3a6 6 0 012-1.15v-.6A1.5 1.5 0 0110 2z" fill="currentColor" opacity="0.35"/>
  </svg>
);
const BackIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
    <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function collectNodeFiles(node: TreeNode): Resource[] {
  const files: Resource[] = [];
  if (node.isDir && node.children) {
    for (const child of node.children.values()) {
      files.push(...collectNodeFiles(child));
    }
  } else if (node.resource) {
    files.push(node.resource);
  }
  return files;
}

export function ScannerPage() {
  const projectPath = useAppStore(s => s.projectPath);
  const settings = useAppStore(s => s.settings);
  const navigateTo = useAppStore(s => s.navigateTo);

  const scanResult = useScannerStore(s => s.scanResult);
  const isScanning = useScannerStore(s => s.isScanning);
  const startScan = useScannerStore(s => s.startScan);
  const deleteFilesAction = useScannerStore(s => s.deleteFiles);
  const removeDeletedFromResults = useScannerStore(s => s.removeDeletedFromResults);

  const [showSettings, setShowSettings] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode; type: 'file' | 'dir' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ resources: Resource[]; folderPath?: string } | null>(null);
  const [deleteReport, setDeleteReport] = useState<{ deleted: DeleteResult[]; failed: DeleteResult[] } | null>(null);

  const treePanelRef = useRef<HTMLDivElement>(null);
  const refPanelRef = useRef<HTMLDivElement>(null);

  const handleScan = () => {
    if (projectPath) {
      startScan(projectPath, settings.enableFilenameMatching);
    }
  };

  const handleExport = () => {
    if (!scanResult) return;
    const lines = ['Status,Path,Type,Size,References'];
    for (const res of scanResult.resourceList) {
      const status = res.used ? 'USED' : 'UNUSED';
      const refs = res.references.map(r => `${r.source}:${r.line}`).join('; ');
      lines.push(`${status},"${res.path}",${res.type},${res.size},"${refs}"`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resource-scan-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode, type: 'file' | 'dir') => {
    setContextMenu({ x: e.clientX, y: e.clientY, node, type });
  }, []);

  const handleContextAction = useCallback((action: string) => {
    if (!contextMenu) return;
    const { node, type } = contextMenu;

    if (action === 'delete-file' && type === 'file' && node.resource) {
      setDeleteConfirm({ resources: [node.resource] });
    } else if (action === 'delete-unused' && type === 'dir') {
      const files = collectNodeFiles(node);
      const unused = files.filter(f => !f.used);
      if (unused.length === 0) {
        alert('No unused files found in this folder.');
        return;
      }
      setDeleteConfirm({ resources: unused, folderPath: node.path });
    }
    setContextMenu(null);
  }, [contextMenu]);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const { deleted, failed } = await deleteFilesAction(deleteConfirm.resources);
    setDeleteConfirm(null);

    const deletedPaths = deleted.map(r => r.path);
    removeDeletedFromResults(deletedPaths);
    setDeleteReport({ deleted, failed });
  };

  // Horizontal resizer for tree panel
  const handleResizerV = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = treePanelRef.current?.offsetWidth || 380;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newWidth = Math.max(200, Math.min(800, startWidth + dx));
      if (treePanelRef.current) treePanelRef.current.style.width = newWidth + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Vertical resizer for reference panel
  const handleResizerH = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = refPanelRef.current?.offsetHeight || 260;

    const onMove = (ev: MouseEvent) => {
      const dy = startY - ev.clientY;
      const newHeight = Math.max(100, Math.min(500, startHeight + dy));
      if (refPanelRef.current) refPanelRef.current.style.height = newHeight + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const statsText = scanResult
    ? `${scanResult.stats.totalResources} total \u00B7 ${scanResult.stats.usedCount} used \u00B7 ${scanResult.stats.unusedCount} unused${scanResult.stats.filenameMatchCount ? ` \u00B7 ${scanResult.stats.filenameMatchCount} filename-matched` : ''}`
    : '';

  const contextMenuItems: MenuItem[] = [
    { label: '\uD83D\uDCCB View details', action: 'view-details' },
    { label: '\uD83D\uDDD1\uFE0F Delete this file', action: 'delete-file', danger: true, hidden: contextMenu?.type !== 'file' },
    { label: '\uD83D\uDDD1\uFE0F Delete unused resources', action: 'delete-unused', danger: true, hidden: contextMenu?.type !== 'dir' },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        left={
          <>
            <Button variant="icon" onClick={() => navigateTo('home')} title="Back to Home"><BackIcon /></Button>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {projectPath}
            </span>
          </>
        }
        center={scanResult ? <FilterBar /> : undefined}
        right={
          <>
            <Button variant="icon" onClick={handleScan} title="Rescan"><RescanIcon /></Button>
            <Button variant="icon" onClick={handleExport} title="Export report"><ExportIcon /></Button>
            <Button variant="icon" onClick={() => setShowSettings(!showSettings)} title="Settings"><SettingsIcon /></Button>
          </>
        }
      />

      {!scanResult && !isScanning ? (
        <div className={styles.startScanWrap}>
          <button className={styles.startScanBtn} onClick={handleScan}>Start Scan</button>
          <span className={styles.startScanHint}>Scan project resources to find unused files</span>
        </div>
      ) : (
        <div className={styles.content}>
          <div ref={treePanelRef} className={styles.panelTree}>
            <TreeView onContextMenu={handleContextMenu} />
          </div>
          <div className={styles.resizerV} onMouseDown={handleResizerV} />
          <div className={styles.panelDetail}>
            <PreviewPanel />
            <div className={styles.resizerH} onMouseDown={handleResizerH} />
            <div ref={refPanelRef}>
              <ReferencesPanel />
            </div>
          </div>
        </div>
      )}

      <StatusBar
        text={isScanning ? 'Scanning...' : scanResult ? 'Scan complete' : 'Ready'}
        stats={statsText}
      />

      <ScanProgress />

      {showSettings && <SettingsPopup onClose={() => setShowSettings(false)} />}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          resources={deleteConfirm.resources}
          folderPath={deleteConfirm.folderPath}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {deleteReport && (
        <DeleteReportModal
          deleted={deleteReport.deleted}
          failed={deleteReport.failed}
          onClose={() => setDeleteReport(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/pages/
git commit -m "feat: add FolderPickerPage with recent folders, HomePage with tool grid, ScannerPage with full scanner UI"
```

---

### Task 10: App Shell — Entry Points & Router

**Files:**
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/index.html`

- [ ] **Step 1: Create App.tsx (state-based router)**

Create `src/renderer/App.tsx`:

```tsx
import React, { useEffect } from 'react';
import { useAppStore } from './stores/useAppStore';
import { FolderPickerPage } from './pages/FolderPickerPage';
import { HomePage } from './pages/HomePage';
import { ScannerPage } from './pages/ScannerPage';

export function App() {
  const currentPage = useAppStore(s => s.currentPage);
  const loadSettings = useAppStore(s => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  switch (currentPage) {
    case 'folder-picker':
      return <FolderPickerPage />;
    case 'home':
      return <HomePage />;
    case 'scanner':
      return <ScannerPage />;
    default:
      return <FolderPickerPage />;
  }
}
```

- [ ] **Step 2: Create main.tsx**

Create `src/renderer/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

- [ ] **Step 3: Create renderer index.html**

Create `src/renderer/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: file:; media-src 'self' file:; script-src 'self' http://localhost:*; connect-src ws://localhost:*;">
  <title>Cocos Toolbox</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.tsx src/renderer/main.tsx src/renderer/index.html
git commit -m "feat: add React entry point, App router, and renderer HTML"
```

---

### Task 11: Code Viewer Window (React)

**Files:**
- Create: `src/code-viewer/index.html`
- Create: `src/code-viewer/main.tsx`
- Create: `src/code-viewer/CodeViewer.tsx`
- Create: `src/code-viewer/CodeViewer.module.css`

- [ ] **Step 1: Create code-viewer index.html**

Create `src/code-viewer/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' http://localhost:*; connect-src ws://localhost:*;">
  <title>Code Viewer</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

- [ ] **Step 2: Create code-viewer main.tsx**

Create `src/code-viewer/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CodeViewer } from './CodeViewer';
import './CodeViewer.module.css';

const root = createRoot(document.getElementById('root')!);
root.render(<CodeViewer />);
```

- [ ] **Step 3: Create CodeViewer.module.css**

Create `src/code-viewer/CodeViewer.module.css` — migrate from existing `code-viewer.css`:

```css
:root {
  --bg-primary: #13151F;
  --bg-secondary: #1A1C2B;
  --bg-surface: #252836;
  --bg-hover: #2E3148;
  --text-primary: #FFFFFF;
  --text-secondary: #8A8FA8;
  --text-muted: #5A5F7A;
  --accent: #F5A623;
  --border: rgba(255, 255, 255, 0.08);
  --font: 'Inter', 'Be Vietnam Pro', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
  --font-mono: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  --code-font-size: 13px;
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  height: 100%;
  font-family: var(--font);
  color: var(--text-primary);
  background: var(--bg-primary);
  overflow: hidden;
}

/* Syntax highlighting tokens (global — used in dangerouslySetInnerHTML) */
:global(.syn-str) { color: #ce9178; }
:global(.syn-kw) { color: #569cd6; }
:global(.syn-num) { color: #b5cea8; }
:global(.syn-ns) { color: #4ec9b0; }
:global(.syn-cmt) { color: #6a9955; font-style: italic; }

.toolbar {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 16px; padding-right: 140px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  user-select: none; flex-shrink: 0;
  -webkit-app-region: drag;
}

.filePath {
  font-family: var(--font-mono);
  font-size: 13px; color: var(--accent);
  white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; flex: 1;
}

.fileInfo {
  font-size: 12px; color: var(--text-muted); white-space: nowrap;
}

.codeContainer {
  flex: 1; overflow: auto; height: calc(100% - 40px);
}

.codeContent {
  font-family: var(--font-mono);
  font-size: var(--code-font-size);
  line-height: 1.7; margin: 0; padding: 8px 0;
  min-width: fit-content;
}

.line {
  display: flex; padding: 0 16px 0 0;
  white-space: pre; min-height: 1.7em;
  transition: background 100ms;
}
.line:hover { background: rgba(255, 255, 255, 0.025); }

.lineHighlight {
  background: rgba(245, 166, 35, 0.1);
  border-left: 3px solid var(--accent);
}
.lineHighlight:hover { background: rgba(245, 166, 35, 0.15); }

.lineNum {
  display: inline-block; min-width: 55px;
  text-align: right; padding-right: 16px;
  color: var(--text-muted); user-select: none;
  flex-shrink: 0; opacity: 0.5;
}
.lineHighlight .lineNum { color: var(--text-secondary); opacity: 0.8; }

.lineText { flex: 1; color: #d4d4d4; }

.codeContainer::-webkit-scrollbar { width: 6px; height: 6px; }
.codeContainer::-webkit-scrollbar-track { background: transparent; }
.codeContainer::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 9999px; }
.codeContainer::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
.codeContainer::-webkit-scrollbar-corner { background: transparent; }

.loading { color: var(--text-muted); font-style: italic; padding: 40px; text-align: center; }
```

- [ ] **Step 4: Create CodeViewer.tsx**

Create `src/code-viewer/CodeViewer.tsx`:

```tsx
import React, { useEffect, useState, useRef } from 'react';
import styles from './CodeViewer.module.css';

const TOKEN_RE = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(var|let|const|function|return|if|else|for|while|new|this|class|extends|import|export|from|true|false|null|undefined|typeof|instanceof)\b|\b(cc|sp|ccs)\b|\b(\d+(?:\.\d+)?)\b/gm;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightSyntax(escapedHtml: string): string {
  return escapedHtml.replace(TOKEN_RE, (match, comment, str, kw, ns, num) => {
    if (comment) return `<span class="syn-cmt">${comment}</span>`;
    if (str) return `<span class="syn-str">${str}</span>`;
    if (kw) return `<span class="syn-kw">${kw}</span>`;
    if (ns) return `<span class="syn-ns">${ns}</span>`;
    if (num) return `<span class="syn-num">${num}</span>`;
    return match;
  });
}

interface FileData {
  filePath: string;
  content: string;
  highlightLine: number | null;
  totalLines: number;
}

export function CodeViewer() {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.codeViewerAPI.onFileData((data) => {
      setFileData(data);
    });
  }, []);

  useEffect(() => {
    if (fileData?.highlightLine && highlightRef.current) {
      requestAnimationFrame(() => {
        highlightRef.current?.scrollIntoView({ block: 'center' });
      });
    }
  }, [fileData]);

  if (!fileData) {
    return <div className={styles.loading}>Loading...</div>;
  }

  const lines = fileData.content.split('\n');
  const padWidth = String(lines.length).length;

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.filePath}>{fileData.filePath}</span>
        <span className={styles.fileInfo}>{fileData.totalLines} lines</span>
      </div>
      <div className={styles.codeContainer}>
        <pre className={styles.codeContent}>
          {lines.map((line, i) => {
            const lineNum = i + 1;
            const isHighlight = lineNum === fileData.highlightLine;
            return (
              <div
                key={i}
                ref={isHighlight ? highlightRef : undefined}
                className={`${styles.line}${isHighlight ? ' ' + styles.lineHighlight : ''}`}
              >
                <span className={styles.lineNum}>{String(lineNum).padStart(padWidth)}</span>
                <span
                  className={styles.lineText}
                  dangerouslySetInnerHTML={{ __html: highlightSyntax(escapeHtml(line)) }}
                />
              </div>
            );
          })}
        </pre>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Fix code-viewer main.tsx import**

Update `src/code-viewer/main.tsx` — the CSS import should not use module import since it's global:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CodeViewer } from './CodeViewer';
import './CodeViewer.module.css';

const root = createRoot(document.getElementById('root')!);
root.render(<CodeViewer />);
```

Note: The CSS module file has `:root` and global styles that need to apply. Since CodeViewer.module.css uses `:global()` selectors for syntax classes, the import works as-is.

- [ ] **Step 6: Commit**

```bash
git add src/code-viewer/
git commit -m "feat: add React-based code viewer window with syntax highlighting"
```

---

### Task 12: Clean Up Old Files & Final Wiring

**Files:**
- Delete: old root-level files and old renderer files
- Modify: `package.json` if needed

- [ ] **Step 1: Delete old files**

```bash
cd /c/Users/Fresher/Desktop/BAT_MAN/check-unused_resource
rm -f main.js preload.js preload-code-viewer.js
rm -f src/main/ipc-handlers.js
rm -f src/renderer/app.js src/renderer/code-viewer.js src/renderer/code-viewer.html
rm -f src/renderer/styles/main.css src/renderer/styles/tree.css src/renderer/styles/code-viewer.css
```

- [ ] **Step 2: Remove old index.html (replaced by new Vite one)**

The old `src/renderer/index.html` has been replaced by the new one created in Task 10. Verify the new one is in place:

```bash
head -5 src/renderer/index.html
```

Expected: Should show `<!DOCTYPE html>` with `<div id="root">` and `<script type="module" src="./main.tsx">`.

- [ ] **Step 3: Move scanner files to services directory**

The scanner files are currently at `src/main/scanner/`. The IPC handler in `src/main/ipc/scanner.js` imports from `../scanner/ReferenceResolver`. This path is correct — no move needed. The scanner stays at `src/main/scanner/` (not `src/main/services/scanner/` as originally planned — simpler to keep existing path).

Verify the import path is correct:

```bash
grep "require" src/main/ipc/scanner.js | head -3
```

Expected: `require('../scanner/ReferenceResolver')` — matches existing `src/main/scanner/` location.

- [ ] **Step 4: Verify dev mode runs**

```bash
cd /c/Users/Fresher/Desktop/BAT_MAN/check-unused_resource
npm run dev
```

Expected: Three processes start (renderer on 5173, code-viewer on 5174, electron loads). The app should show the FolderPickerPage.

- [ ] **Step 5: Verify production build**

```bash
npm run build
```

Expected: `dist/renderer/` and `dist/code-viewer/` directories created with built assets.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: complete React + Zustand migration — remove old vanilla JS renderer files"
```

---

### Task 13: Smoke Test & Bug Fixes

- [ ] **Step 1: Test folder picker flow**

1. Launch app with `npm run dev`
2. Click "Select Project Folder" → select `examples/` directory
3. Verify it navigates to HomePage
4. Verify recent folder appears on FolderPickerPage when going back

- [ ] **Step 2: Test scanner flow**

1. From HomePage, click "Scan Unused Resources"
2. Click "Start Scan" button
3. Verify progress overlay appears
4. Verify tree view renders with resources
5. Click a resource → verify preview and references load
6. Test filter buttons (All, Used, Unused)
7. Test type filter dropdown
8. Test search input

- [ ] **Step 3: Test code viewer**

1. Click a reference item → verify code viewer window opens
2. Verify syntax highlighting works
3. Verify highlighted line is scrolled into view

- [ ] **Step 4: Test settings**

1. Click settings icon → verify popup appears
2. Change font size → verify UI updates
3. Close and reopen app → verify settings persist

- [ ] **Step 5: Test delete flow**

1. Right-click an unused file → "Delete this file"
2. Verify confirmation modal
3. Confirm → verify report modal and tree updates

- [ ] **Step 6: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
