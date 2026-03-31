# Refactor: Electron + React + Zustand

## Overview

Refactor the Cocos Resource Scanner from vanilla JS to React + Zustand architecture, enabling multi-tool extensibility. The app will evolve from a single-purpose scanner to a toolbox platform where new tools can be added with minimal friction.

### Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | Renderer rewrite + restructure main | Scanner engine works well, no need to rewrite. Main process needs tool-oriented structure |
| Bundler | Vite | Fast HMR, simple config, best DX for React |
| Styling | CSS Modules + ZPS design tokens | Scoped styles per component, keep existing design system |
| Routing | State-based with Zustand | No URL routing needed in Electron, simpler than React Router |
| Code viewer | Keep multi-window | User preference, separate BrowserWindow |
| Recent folders | electron-store | Persistent, accessible from main process |
| Approach | Big bang rewrite | Clean result, codebase small enough (~983 lines renderer) |

---

## 1. Directory Structure

```
check-unused_resource/
├── package.json
├── vite.config.ts                  # Vite config for renderer
├── vite.code-viewer.config.ts      # Vite config for code-viewer window
├── electron-builder.yml            # Build config (extracted from package.json)
├── src/
│   ├── main/                       # Electron main process
│   │   ├── main.js                 # Entry: window creation, app lifecycle
│   │   ├── preload.js              # Preload for main window
│   │   ├── preload-code-viewer.js  # Preload for code viewer
│   │   ├── store.js                # electron-store (recent folders, settings)
│   │   ├── ipc/
│   │   │   ├── index.js            # registerAllHandlers()
│   │   │   ├── app.js              # select-folder, recent-folders, settings
│   │   │   └── scanner.js          # scan-project, get-preview, delete-files
│   │   └── services/
│   │       └── scanner/            # UNCHANGED - existing scanner engine
│   │           ├── ReferenceResolver.js
│   │           ├── ResourceScanner.js
│   │           ├── PatternMatcher.js
│   │           └── parsers/
│   │               ├── JsCodeParser.js
│   │               ├── JsonUIParser.js
│   │               ├── ConstResolver.js
│   │               └── PlistParser.js
│   ├── renderer/                   # React app (main window)
│   │   ├── index.html
│   │   ├── main.tsx                # React root
│   │   ├── App.tsx                 # State-based router
│   │   ├── stores/
│   │   │   ├── useAppStore.ts      # Navigation, recent folders, settings
│   │   │   └── useScannerStore.ts  # Scan state, results, filters
│   │   ├── pages/
│   │   │   ├── FolderPickerPage.tsx
│   │   │   ├── HomePage.tsx
│   │   │   └── ScannerPage.tsx
│   │   ├── components/
│   │   │   ├── common/             # Button, Modal, ContextMenu, StatusBar
│   │   │   ├── scanner/            # TreeView, Preview, References, FilterBar...
│   │   │   └── layout/             # PageHeader
│   │   └── styles/
│   │       ├── tokens.css          # CSS variables (from main.css)
│   │       └── global.css          # Reset, fonts, base styles
│   └── code-viewer/                # React app (code viewer window)
│       ├── index.html
│       ├── main.tsx
│       ├── CodeViewer.tsx
│       └── CodeViewer.module.css
├── examples/                       # Unchanged
└── assets/                         # Icons, etc.
```

### Extensibility pattern

Adding a new tool requires:
1. `src/main/ipc/<tool>.js` — IPC handlers
2. `src/renderer/stores/use<Tool>Store.ts` — state
3. `src/renderer/pages/<Tool>Page.tsx` — page
4. `src/renderer/components/<tool>/` — components
5. Register in `ipc/index.js` + add card in `HomePage` + add page in `App.tsx`

---

## 2. Main Process Restructure

### main.js

Only handles app lifecycle: create window, app.ready, app.quit. No business logic.

Window creation:
- Main window: loads Vite dev server in dev, `dist/renderer/index.html` in prod
- Code viewer: loads Vite dev server port 5174 in dev, `dist/code-viewer/index.html` in prod
- Detection via `app.isPackaged`

### ipc/index.js

```javascript
function registerAllHandlers(mainWindow) {
  registerAppHandlers(mainWindow);
  registerScannerHandlers(mainWindow);
  // Future: registerDuplicateFinderHandlers(mainWindow);
}
```

### ipc/app.js

New handlers for:
- `select-folder` — native dialog (moved from ipc-handlers.js)
- `get-recent-folders` — read from electron-store
- `add-recent-folder` — save to electron-store (max 10, dedup by path)
- `remove-recent-folder` — remove from electron-store
- `get-settings` — read from electron-store
- `save-settings` — write to electron-store

### ipc/scanner.js

Existing handlers moved here:
- `scan-project` — calls ReferenceResolver (unchanged)
- `get-preview` — file read for preview (unchanged)
- `open-code-viewer` — creates code viewer BrowserWindow (unchanged)
- `delete-files` — delete files with report (unchanged)
- `scan-progress` — send event (unchanged)

### store.js

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
        previewFontSize: 13,
        enableFilenameMatching: false
      }
    }
  }
});
```

---

## 3. Zustand Stores

### useAppStore

```typescript
interface AppState {
  currentPage: 'folder-picker' | 'home' | 'scanner';
  projectPath: string | null;
  recentFolders: { path: string; name: string; lastOpened: number }[];
  settings: {
    fontSize: number;
    previewFontSize: number;
    enableFilenameMatching: boolean;
  };

  navigateTo: (page: string) => void;
  openProject: (path: string) => void;
  closeProject: () => void;
  loadRecentFolders: () => Promise<void>;
  removeRecentFolder: (path: string) => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
}
```

- `openProject` — sets projectPath, calls `addRecentFolder` IPC, navigates to 'home'
- `closeProject` — clears projectPath, navigates to 'folder-picker'
- Settings synced to electron-store via IPC on every change

### useScannerStore

```typescript
interface ScannerState {
  scanResult: { resourceList: Resource[]; stats: Stats } | null;
  isScanning: boolean;
  scanProgress: { percent: number; stage: string } | null;
  selectedFile: Resource | null;
  filterMode: 'all' | 'used' | 'unused';
  fileTypeFilter: string;
  searchQuery: string;

  filteredResources: () => Resource[];
  startScan: (projectPath: string, options: object) => Promise<void>;
  selectFile: (resource: Resource | null) => void;
  setFilter: (mode: string) => void;
  setFileTypeFilter: (type: string) => void;
  setSearchQuery: (query: string) => void;
  exportReport: () => Promise<void>;
  deleteFiles: (paths: string[]) => Promise<void>;
  reset: () => void;
}
```

- `startScan` — subscribes to `onScanProgress`, calls `scanProject` IPC, stores cleanup function, unsubscribes when done
- `filteredResources` — derived getter, applies filterMode + fileTypeFilter + searchQuery
- `reset` — called when leaving scanner page, clears all scanner state
- Components call store actions only, never `window.api` directly

---

## 4. React Pages & Components

### FolderPickerPage

- Large "Open Folder" button (center)
- Recent folders list below (folder name + path + relative time)
- Click recent folder → `openProject(path)`
- X button on each to remove
- Disabled state if folder no longer exists

### HomePage

- Header: project path + "Change Folder" button
- Grid of tool cards (icon + name + short description)
- Currently 1 card: "Scan Unused Resources"
- Click card → `navigateTo('scanner')`

### ScannerPage

- PageHeader with back button → `navigateTo('home')`
- "Start Scan" button to begin scanning (not auto-start, user may want to adjust settings first)
- 3-panel layout: TreeView (left) | Preview (top-right) | References (bottom-right)
- FilterBar at top
- StatusBar at bottom
- Resizable panels (mouse events, local state)
- Settings popup
- Context menu
- Delete confirmation/report modals

### Components

```
components/
├── common/
│   ├── Button.tsx
│   ├── Modal.tsx
│   ├── ContextMenu.tsx
│   └── StatusBar.tsx
├── scanner/
│   ├── FilterBar.tsx
│   ├── TreeView.tsx
│   ├── TreeRow.tsx
│   ├── PreviewPanel.tsx
│   ├── ReferencesPanel.tsx
│   ├── ReferenceItem.tsx
│   ├── ScanProgress.tsx
│   ├── DeleteConfirmModal.tsx
│   ├── DeleteReportModal.tsx
│   ├── SettingsPopup.tsx
│   └── ExportButton.tsx
└── layout/
    └── PageHeader.tsx
```

### Code Viewer Window

- Separate Vite entry: `src/code-viewer/`
- `CodeViewer.tsx` — receives data via `window.codeViewerAPI.onFileData()`
- Syntax highlighting as utility function (shared logic from current app.js/code-viewer.js)
- Line numbers, auto-scroll to highlighted line

---

## 5. Preload API

### preload.js (main window)

```javascript
contextBridge.exposeInMainWorld('api', {
  // App
  selectFolder: ()                 => ipcRenderer.invoke('select-folder'),
  getRecentFolders: ()             => ipcRenderer.invoke('get-recent-folders'),
  addRecentFolder: (entry)         => ipcRenderer.invoke('add-recent-folder', entry),
  removeRecentFolder: (path)       => ipcRenderer.invoke('remove-recent-folder', path),
  getSettings: ()                  => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings)         => ipcRenderer.invoke('save-settings', settings),

  // Scanner
  scanProject: (path, options)     => ipcRenderer.invoke('scan-project', path, options),
  getPreview: (filePath)           => ipcRenderer.invoke('get-preview', filePath),
  openCodeViewer: (filePath, line) => ipcRenderer.invoke('open-code-viewer', filePath, line),
  deleteFiles: (filePaths)         => ipcRenderer.invoke('delete-files', filePaths),
  onScanProgress: (callback)       => {
    ipcRenderer.on('scan-progress', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('scan-progress');
  },
});
```

### preload-code-viewer.js (unchanged)

```javascript
contextBridge.exposeInMainWorld('codeViewerAPI', {
  onFileData: (callback) => {
    ipcRenderer.on('code-viewer-data', (_, data) => callback(data));
  }
});
```

---

## 6. Vite & Build Config

### vite.config.ts (renderer)

- Root: `src/renderer`
- Output: `dist/renderer`
- Base: `./` (relative paths for Electron)
- Plugin: `@vitejs/plugin-react`
- CSS Modules: camelCase locals convention

### vite.code-viewer.config.ts

- Root: `src/code-viewer`
- Output: `dist/code-viewer`
- Base: `./`
- Plugin: `@vitejs/plugin-react`

### Scripts

```
dev           = concurrently renderer + code-viewer + electron
dev:renderer  = vite (port 5173)
dev:code-viewer = vite (port 5174)
dev:electron  = wait-on + electron .
build         = build:renderer + build:code-viewer
package       = build + electron-builder
```

### New dependencies

```
dependencies: react, react-dom, electron-store, zustand
devDependencies: @vitejs/plugin-react, vite, typescript,
                 @types/react, @types/react-dom, concurrently, wait-on
```

---

## 7. Migration Mapping

| Vanilla JS (app.js) | React destination |
|---|---|
| `selectFolder()` | `FolderPickerPage` + `useAppStore.openProject()` |
| `startScan()` | `useScannerStore.startScan()` |
| `buildFilterBar()` | `<FilterBar />` |
| `renderTree()` | `<TreeView />` + `useScannerStore.filteredResources()` |
| `selectFile()` | `useScannerStore.selectFile()` |
| `showPreview()` | `<PreviewPanel />` |
| `showReferences()` | `<ReferencesPanel />` |
| `exportReport()` | `useScannerStore.exportReport()` |
| `executeDelete()` | `useScannerStore.deleteFiles()` + `<DeleteConfirmModal />` |
| `initSettings()` | `<SettingsPopup />` + `useAppStore.settings` |
| Global state vars | Zustand stores |
| DOM manipulation | React re-render |
| Event listeners | React event handlers + useEffect |

## 8. What Does NOT Change

- `src/main/services/scanner/*` — entire scanner engine, 0 changes
- Syntax highlighting logic — extracted as utility, reused in both windows
- ZPS design tokens — migrated to `tokens.css`, same CSS variables
- electron-builder — only update file paths
- IPC channel names for scanner — same names, same data formats
