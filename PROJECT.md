# Cocos Resource Scanner — Project Architecture

> **Auto-generated project documentation. AI must update this file after every code change.**
> Last updated: 2026-03-31 (add README.md user documentation)

## Overview

**Name**: Cocos Resource Scanner v1.0.0
**Tech**: Electron 28 + vanilla JS/HTML/CSS
**Purpose**: Scan Cocos2d-JS projects to find unused resources in `res/` by analyzing `src/` code references.

---

## Directory Structure

```
check-unused_resource/
├── main.js                            # Electron main process entry
├── preload.js                         # Preload for main window (window.api)
├── preload-code-viewer.js             # Preload for code viewer (window.codeViewerAPI)
├── package.json                       # App manifest (electron-builder)
├── README.md                          # User documentation & usage guide
│
├── src/
│   ├── main/
│   │   ├── ipc-handlers.js            # All IPC channel handlers
│   │   └── scanner/
│   │       ├── ReferenceResolver.js   # 8-phase scan orchestrator
│   │       ├── ResourceScanner.js     # Resource file discovery + categorization
│   │       ├── PatternMatcher.js      # Match references → resources
│   │       └── parsers/
│   │           ├── ConstResolver.js   # JS constant extraction & resolution
│   │           ├── JsCodeParser.js    # JS file reference parsing (4 patterns)
│   │           ├── JsonUIParser.js    # Cocos Studio JSON layout parsing
│   │           └── PlistParser.js     # Apple plist sprite sheet parsing
│   │
│   └── renderer/
│       ├── index.html                 # Main UI layout
│       ├── app.js                     # Renderer logic (~900 lines)
│       ├── code-viewer.html           # Read-only code viewer window
│       ├── code-viewer.js             # Code viewer logic
│       └── styles/
│           ├── main.css               # App layout, colors, reference styles
│           ├── tree.css               # File tree view styles
│           └── code-viewer.css        # Code viewer window styles
│
└── examples/                          # Sample Cocos2d project for testing
    ├── res/                           # Sample resources (images, json, sounds, etc.)
    └── src/                           # Sample JS source code
```

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│           MAIN PROCESS (main.js)                 │
│  createWindow() → BrowserWindow(preload.js)      │
│  registerIpcHandlers() from ipc-handlers.js      │
└──────────────┬────────────────────┬──────────────┘
          IPC invoke            IPC send
               │                    │
┌──────────────▼────────────────────▼──────────────┐
│         RENDERER (app.js via index.html)         │
│  Tree view │ Preview panel │ Reference panel     │
│  Filters   │ Settings      │ Export              │
└──────────────────────┬───────────────────────────┘
                       │ click reference
┌──────────────────────▼───────────────────────────┐
│   CODE VIEWER WINDOW (code-viewer.js)            │
│   Read-only source display + line highlight      │
│   Preload: preload-code-viewer.js                │
└──────────────────────────────────────────────────┘
```

---

## IPC Channels

| Channel | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `select-folder` | renderer→main | — | Opens folder dialog, validates `res/`+`src/` |
| | reply | `{success, path, reason, message}` | |
| `scan-project` | renderer→main | `(folderPath, {filenameMatch})` | Runs 8-phase scan |
| | reply | `{success, data: {resourceList, stats}}` | |
| `scan-progress` | main→renderer | `{phase, message, current, total}` | Progress events during scan |
| `get-preview` | renderer→main | `(filePath)` | Get file content for preview |
| | reply | `{success, type, data, size, fileName}` | type: image/audio/text |
| `open-code-viewer` | renderer→main | `(filePath, highlightLine)` | Opens code viewer window |
| `delete-files` | renderer→main | `(filePaths[])` | Deletes array of files from disk |
| | reply | `{success, results: [{path, success, size?, error?}]}` | Per-file results |
| `code-viewer-data` | main→viewer | `{filePath, content, highlightLine, totalLines}` | Sends file content to viewer |

---

## Preload APIs

### `window.api` (preload.js → main window)
```js
selectFolder()                          → Promise<{success, path, ...}>
scanProject(folderPath, options)        → Promise<{success, data, ...}>
getPreview(filePath)                    → Promise<{success, type, data, ...}>
openCodeViewer(filePath, highlightLine) → Promise<{success, ...}>
deleteFiles(filePaths)                  → Promise<{success, results[]}>
onScanProgress(callback)               → unsubscribe function
```

### `window.codeViewerAPI` (preload-code-viewer.js → viewer window)
```js
onFileData(callback)  // receives {filePath, content, highlightLine, totalLines}
```

---

## Scanning Pipeline (8 Phases)

1. **Scan Resources** — Walk `res/`, detect file types, identify Cocos Studio JSONs
2. **Collect JS Files** — Walk `src/`, gather all `.js` files
3. **Parse Cocos JSONs** — Extract `FileData.Path`, `FileData.Plist`, `UsedResources`
4. **Build Constant Map** — Extract `ROOT_PATH = "res/..."` definitions, resolve chains
5. **Parse JS Files** — 5 detection patterns: direct paths, constant concat, API calls (incl. initWithFile/setTexture/addImage), variable suffix, relative path concatenation (`"path/" + var + ".ext"`)
5b. **Extract Search Paths** — Detect `addSearchPath()` calls in JS source (e.g., `res/`, `res/common/`, `res/Board/`)
6. **Match References** — Exact match, wildcard expansion, relative path suffix matching, **search path resolution** + companion textures (atlas→png, plist→png) + optional filename matching (word-boundary aware: basename must be bounded by non-alphanumeric chars or string edges)
7. **Build Results** — Generate `{resourceList, stats}` with used/unused status

---

## Key Data Structures

### Resource
```js
{ path, type, size, absPath, used, references[] }
// type: 'image'|'audio'|'json'|'cocos-json'|'plist'|'atlas'|'font'|'shader'|'xml'|'file'
```

### Reference
```js
{ source, line, snippet, type, context[], isPattern, isRelative }
// type: 'js'|'json'|'plist-texture'|'atlas-texture'|'filename-match'
// context: [{lineNum, text, highlight}]
```

### Stats
```js
{ totalResources, usedCount, unusedCount, totalReferences,
  cocosJsonCount, jsFileCount, constCount, filenameMatchCount }
```

---

## Renderer State (app.js)

```js
scanResult     // {resourceList[], stats}
projectPath    // selected folder path
selectedFile   // currently selected resource
filterMode     // 'all'|'used'|'unused'
searchQuery    // search input text
fileTypeFilter // 'all'|'image'|'audio'|'json'|'plist'|'atlas'|'font'|'shader'|'file'
```

### Key Functions
| Function | Purpose |
|----------|---------|
| `init()` | Setup event listeners, filter bar, resizer, settings |
| `selectFolder()` / `startScan()` | Folder selection → scan workflow |
| `buildFilterBar()` | Create filter/search UI |
| `renderTree()` → `buildTreeData()` → `renderTreeNode()` | Tree view rendering |
| `selectFile(resource)` | Show preview + references for a file |
| `showPreview(resource)` | Display image/audio/text preview |
| `showReferences(resource)` | Render reference list, clickable → code viewer |
| `exportReport()` | Generate CSV download |
| `setupResizer()` | Panel drag-resize (horizontal + vertical) |
| `initSettings()` | Font size sliders, filename match toggle |
| `highlightSyntax(html)` | JS syntax coloring (comments, strings, keywords, namespaces, numbers) |
| `copyRefCode(btn)` | Copy code from reference block |
| `showContextMenu(e, node, type)` | Show right-click context menu on tree item |
| `handleViewDetails(target)` | Show detail modal (file size or folder stats) |
| `handleDeleteUnused(target)` | Confirm & delete unused files in folder |
| `executeDelete(unusedFiles)` | Execute deletion, show report, update state |
| `collectNodeFiles(node)` | Recursively collect all file resources under a tree node |

---

## UI Screens & Panels

1. **Folder Picker** (`#folder-picker`) — Landing screen with "Select Project Folder" button
2. **Main App** (`#main-app`)
   - **Topbar** — Folder button, path, filters (All/Used/Unused), type dropdown, search, rescan/export/settings
   - **Tree Panel** (`#panel-tree`) — File tree with expandable dirs, status badges, file icons
   - **Preview Panel** (`#preview-panel`) — Image/audio/text preview
   - **Reference Panel** (`#reference-panel`) — Clickable reference items with code blocks
   - **Status Bar** — Scan status + stats
3. **Settings Popup** (`#settings-popup`) — Font sizes, code font size, filename match toggle
4. **Code Viewer Window** — Separate window, read-only, line numbers, syntax highlighting, target line scroll+highlight
5. **Context Menu** (`#tree-context-menu`) — Right-click on tree items: "Xem chi tiết" (view details), "Xoá unused resources" (delete unused, folders only)
6. **Details Modal** (`#details-modal`) — Shows file size or folder file counts (used/unused when in All mode) + total size
7. **Delete Confirm Modal** (`#delete-confirm-modal`) — Confirmation before deleting unused files
8. **Delete Report Modal** (`#delete-report-modal`) — Post-delete report: deleted count, freed space, file list

---

## Settings (localStorage)

| Key | Range | Default |
|-----|-------|---------|
| `crs-font-size` | 11–20 | 13 |
| `crs-code-font-size` | 9–18 | 11 |
| `crs-filename-match` | boolean | false |

---

## CSS Theme

Dark theme with CSS custom properties. Key variables:
- Backgrounds: `--bg-primary` (#1e1e1e) → `--bg-active` (#3a3a3a)
- Text: `--text-primary` (#e0e0e0), `--text-secondary` (#a0a0a0), `--text-muted` (#6a6a6a)
- Accent: `--accent` (#2196F3), Status: `--green` (#4caf50), `--red` (#f44336)
- Fonts: system UI + monospace (Cascadia Code/Fira Code/Consolas)
- Adjustable via settings: `--font-size-base`, `--code-font-size`
