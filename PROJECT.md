# PROJECT.md — Cocos Resource Scanner v2.0

> Last updated: 2026-04-02

## Overview

Electron desktop app for Cocos2d-JS game projects. Two scan modes:
1. **Unused Resource Scanner** — finds files in `res/` not referenced in `src/`
2. **Duplicate Resource Scanner** — finds exact + perceptually similar duplicate files in `res/`

**Tech Stack:** Electron 28, React 18, Zustand, TypeScript, Vite, CSS Modules, Node.js (CommonJS in main process), sharp

---

## Directory Structure

```
check-unused_resource/
├── package.json               # Dependencies (sharp, zustand, react, electron-builder)
├── tsconfig.json
├── vite.config.ts             # Renderer build config
├── vite.code-viewer.config.ts # Code viewer build config
├── scripts/
│   └── dev.js
├── src/
│   ├── main/                  # Electron main process (CommonJS)
│   │   ├── main.js            # Entry, creates BrowserWindow
│   │   ├── preload.js         # Exposes window.api to renderer
│   │   ├── preload-code-viewer.js
│   │   ├── store.js           # electron-store (recent folders, settings)
│   │   ├── ipc/
│   │   │   ├── index.js       # Registers all IPC handlers
│   │   │   ├── app.js         # App-level handlers (recent folders, settings)
│   │   │   └── scanner.js     # Scan IPC handlers (scan-project, duplicate:start-scan, get-preview, delete-files, open-code-viewer)
│   │   └── scanner/
│   │       ├── ReferenceResolver.js  # Unused-resource scan orchestrator (7 phases)
│   │       ├── ResourceScanner.js    # Walks res/, classifies files
│   │       ├── PatternMatcher.js     # Reference matching logic
│   │       ├── DuplicateScanner.js   # Duplicate scan orchestrator (4 phases)
│   │       ├── hashers/
│   │       │   ├── FileHasher.js     # SHA-256 hashing; groupByHash, extractDuplicateGroups
│   │       │   └── PerceptualHasher.js # pHash (DCT), Hamming distance, multi-index, union-find
│   │       └── parsers/
│   │           ├── ConstResolver.js
│   │           ├── JsCodeParser.js
│   │           ├── JsonUIParser.js
│   │           └── PlistParser.js
│   ├── renderer/              # React renderer (TypeScript + CSS Modules)
│   │   ├── App.tsx            # Route switcher (folder-picker | home | scanner | duplicate*)
│   │   ├── main.tsx
│   │   ├── index.html
│   │   ├── types.ts           # Shared TS interfaces + Window API declarations
│   │   ├── css-modules.d.ts
│   │   ├── pages/
│   │   │   ├── FolderPickerPage.tsx + .module.css
│   │   │   ├── HomePage.tsx + .module.css
│   │   │   ├── ScannerPage.tsx + .module.css
│   │   │   └── DuplicatePage.tsx + .module.css  # Duplicate scan page
│   │   ├── stores/
│   │   │   ├── useAppStore.ts         # currentPage, projectPath, recentFolders, settings
│   │   │   ├── useScannerStore.ts     # scan results, selected resource, filters
│   │   │   └── useDuplicateStore.ts   # duplicate scan state, filters, getFilteredGroups
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── layout/
│   │   │   ├── scanner/
│   │   │   └── duplicate/
│   │   │       ├── DuplicateProgress.tsx + .module.css     # Scan progress overlay
│   │   │       ├── DuplicateFilterBar.tsx + .module.css    # Type/match/search filters
│   │   │       ├── DuplicateGroupCard.tsx + .module.css    # Single group card in list
│   │   │       ├── DuplicateGroupList.tsx + .module.css    # Sorted list of groups
│   │   │       ├── DuplicateDetail.tsx + .module.css       # Right-panel detail container
│   │   │       ├── ImageCompareGrid.tsx + .module.css      # Image preview cards grid
│   │   │       ├── FileCompareList.tsx + .module.css       # Non-image file list + text preview
│   │   │       ├── DuplicateSummary.tsx + .module.css      # Bottom stats bar
│   │   │       └── DuplicateSettingsPopup.tsx + .module.css # Hamming threshold slider popup
│   │   ├── styles/
│   │   └── utils/
│   └── code-viewer/           # Standalone code viewer window
│       ├── main.tsx
│       ├── index.html
│       ├── CodeViewer.tsx
│       └── CodeViewer.module.css
└── examples/
    ├── res/                   # Sample Cocos resources
    └── src/                   # Sample JS source files
```



---

## IPC Channels

| Channel | Direction | Handler file | Description |
|---|---|---|---|
| `select-folder` | invoke | app.js | Opens folder picker dialog, validates res/ + src/ |
| `get-recent-folders` | invoke | app.js | Returns recent folder list |
| `add-recent-folder` | invoke | app.js | Adds entry to recent folders |
| `remove-recent-folder` | invoke | app.js | Removes from recent folders |
| `get-settings` | invoke | app.js | Returns app settings |
| `save-settings` | invoke | app.js | Saves app settings |
| `scan-project` | invoke | scanner.js | Runs unused-resource scan |
| `scan-progress` | send (main→renderer) | scanner.js | Progress events during scan |
| `get-preview` | invoke | scanner.js | Returns file preview (image/audio/text) |
| `delete-files` | invoke | scanner.js | Deletes files from disk |
| `open-code-viewer` | invoke | scanner.js | Opens code viewer window |
| `code-viewer-data` | send (main→renderer) | scanner.js | Sends file data to code viewer window |
| `duplicate:start-scan` | invoke | scanner.js | Runs duplicate scan pipeline |
| `duplicate:scan-progress` | send (main→renderer) | scanner.js | Progress events during duplicate scan |

---

## Preload APIs (`window.api`)

| Method | IPC Channel | Returns |
|---|---|---|
| `selectFolder()` | select-folder | `{success, path?, reason?, message?}` |
| `getRecentFolders()` | get-recent-folders | `RecentFolder[]` |
| `addRecentFolder(entry)` | add-recent-folder | `RecentFolder[]` |
| `removeRecentFolder(path)` | remove-recent-folder | `RecentFolder[]` |
| `getSettings()` | get-settings | `AppSettings` |
| `saveSettings(settings)` | save-settings | `{success}` |
| `scanProject(path, opts)` | scan-project | `{success, data?: ScanResult}` |
| `getPreview(filePath)` | get-preview | `{success, type, data, size, fileName}` |
| `openCodeViewer(path, line)` | open-code-viewer | `{success}` |
| `deleteFiles(paths)` | delete-files | `{success, results}` |
| `onScanProgress(cb)` | scan-progress | unsubscribe fn |
| `scanDuplicates(path, opts)` | duplicate:start-scan | `{success, data?: DuplicateScanResult}` |
| `onDuplicateScanProgress(cb)` | duplicate:scan-progress | unsubscribe fn |

---

## Key Data Structures (`src/renderer/types.ts`)

### Unused-resource scan
- `Resource` — `{path, absPath, type, size, used, references[]}`
- `Reference` — `{source, line, snippet, type, context?}`
- `ScanResult` — `{resourceList, stats}`
- `ScanStats` — `{totalResources, usedCount, unusedCount}`

### Duplicate scan
- `DuplicateFile` — `{path, absPath, size, width, height, hash, pHash}`
- `DuplicateGroup` — `{id, matchType, fileType, similarity, hammingDistance, files[], wastedBytes}`
- `DuplicateScanStats` — `{totalFiles, totalGroups, exactGroups, perceptualGroups, totalWastedBytes, imageFiles, nonImageFiles}`
- `DuplicateScanResult` — `{groups[], stats, settings: {threshold}}`

### App types
- `PageName` — `'folder-picker' | 'home' | 'scanner' | 'duplicate'`
- `RecentFolder` — `{path, name, lastOpened}`
- `AppSettings` — `{fontSize, codeFontSize, enableFilenameMatching}`
- `DeleteResult` — `{path, success, size?, error?}`
- `TreeNode` — `{name, path, isDir, resource?, children?}`

---

## Zustand Stores

### `useAppStore` (`stores/useAppStore.ts`)
| State | Type | Description |
|---|---|---|
| `currentPage` | `PageName` | Active page |
| `projectPath` | `string\|null` | Selected project |
| `recentFolders` | `RecentFolder[]` | Recent projects |
| `settings` | `AppSettings` | App settings |

Actions: `navigateTo`, `openProject`, `closeProject`, `loadRecentFolders`, `removeRecentFolder`, `loadSettings`, `updateSettings`

### `useScannerStore` (`stores/useScannerStore.ts`)
Manages unused-resource scan state: results, selected resource, filter mode, search query, file type filter.

### `useDuplicateStore` (`stores/useDuplicateStore.ts`)
| State | Type | Description |
|---|---|---|
| `scanResult` | `DuplicateScanResult\|null` | Last scan result |
| `isScanning` | `boolean` | Scan in progress |
| `scanProgress` | `{phase, message, current, total}\|null` | Progress data |
| `selectedGroupId` | `number\|null` | Currently selected group |
| `fileTypeFilter` | `'all'\|'image'\|'non-image'` | File type filter |
| `matchTypeFilter` | `'all'\|'exact'\|'perceptual'` | Match type filter |
| `searchQuery` | `string` | Path search query |
| `threshold` | `number` | Hamming distance threshold (default 5) |

Actions: `startScan(projectPath, threshold)`, `setSelectedGroupId`, `setFileTypeFilter`, `setMatchTypeFilter`, `setSearchQuery`, `setThreshold`, `reset`

Helper export: `getFilteredGroups(state)` — filters groups by all active filters

---

## Scanner Architecture

### Unused-Resource Pipeline (`ReferenceResolver.js`)
7 phases: scan resources → collect JS files → parse Cocos JSONs → build const map → parse JS files → match references → resolve companion textures

### Duplicate Scanner Pipeline (`DuplicateScanner.js`)
5 phases:
1. Walk `res/`, classify → `imageFiles[]` + `nonImageFiles[]`
2a. SHA-256 hash images → exact duplicate groups; track matched paths
2b. pHash remaining images → perceptual duplicate groups (DCT + multi-index + union-find)
3. SHA-256 hash non-images → exact duplicate groups
3.5. Enrich exact image groups with `width`/`height` via `sharp().metadata()`
4. Aggregate stats

### `FileHasher.js`
- `hashFile(filePath)` → SHA-256 hex string
- `groupByHash(files, onProgress)` → `Map<hash → files[]>`
- `extractDuplicateGroups(hashMap)` → `Array[]` (groups with 2+ files)

### `PerceptualHasher.js`
- `computePHash(filePath)` → `{hash: BigInt, width, height}` (32×32 grayscale → 2D DCT → 8×8 low-freq → 64-bit hash)
- `computeAllPHashes(images, onProgress)` → enriched images array
- `hammingDistance(a, b)` → bit count of XOR
- `distanceToSimilarity(distance)` → 0–100%
- `hashToHex(hash)` / `hexToHash(hex)` — serialization
- `findPerceptualDuplicates(images, threshold)` → groups via dimension grouping + multi-index + union-find

---

## UI Screens & Pages

| Page | File | Route `PageName` |
|---|---|---|
| Folder Picker | `FolderPickerPage.tsx` | `folder-picker` |
| Home | `HomePage.tsx` | `home` |
| Unused Resource Scanner | `ScannerPage.tsx` | `scanner` |
| Duplicate Scanner | `DuplicatePage.tsx` | `duplicate` |

---

## CSS Theme (dark)
- Primary bg: `#1e1e1e`, secondary: `#252525`, surface: `#2d2d2d`
- Text: `#e0e0e0`, muted: `#a0a0a0`
- Accent: `#2196F3`
- Status: green `#4caf50`, red `#f44336`
- CSS Modules per component; global vars in `styles/`
