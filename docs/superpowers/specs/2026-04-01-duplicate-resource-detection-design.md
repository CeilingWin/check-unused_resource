# Duplicate Resource Detection — Design Spec

## Overview

Extend the Cocos Resource Scanner tool with a **separate scan mode** that detects duplicate resources in the `res/` directory. Image files are compared using perceptual hashing (pHash) to catch duplicates even after compression (e.g., pingo). Non-image files are compared using SHA-256 byte-to-byte hashing. Results are report-only — no auto-delete or auto-replace.

## Requirements Summary

| Requirement | Decision |
|---|---|
| Scope | Entire `res/` directory |
| Action on duplicates | Report only |
| Integration | Separate scan mode (not combined with unused scan) |
| Image comparison | pHash with configurable Hamming distance threshold |
| Non-image comparison | SHA-256 exact byte match |
| Expected scale | 5,000 - 20,000 images |

## 1. Scan Pipeline

Four-phase pipeline orchestrated by `DuplicateScanner.js`:

### Phase 1 — Collect & Classify

Walk the entire `res/` directory recursively. Classify each file:
- **Image files**: `.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.gif` → Phase 2
- **Non-image files**: everything else → Phase 3

### Phase 2 — Image Duplicate Detection (two steps)

**Step 2a — Exact match (SHA-256):**
- Compute SHA-256 hash for every image file
- Group files with identical hashes → these are exact duplicates (byte-for-byte identical)
- Remove these from the pool before Step 2b

**Step 2b — Perceptual match (pHash):**
- For remaining images, compute perceptual hash:
  1. Resize to 32x32 grayscale using `sharp`
  2. Apply 2D DCT (Discrete Cosine Transform)
  3. Take top-left 8x8 block (64 low-frequency coefficients)
  4. Calculate median of 64 values
  5. Each value >= median → 1, else → 0 → 64-bit hash
- Compare all pairs using Hamming distance (XOR + popcount)
- Group images with distance <= threshold (default: 5) into duplicate groups

**Optimizations for scale (5K-20K images):**
1. Exact duplicates removed first (reduces pHash pool significantly)
2. Group by image dimensions — only compare images with same width x height (biggest win)
3. Multi-index lookup: split 64-bit hash into 8x8-bit blocks. By pigeonhole principle, two hashes with distance ≤5 must share at least 3 identical blocks. Build lookup tables per block → compare only candidates that share enough blocks. Reduces O(n^2) to near O(n) in practice.
4. Batch processing with `sharp` pipeline (leverages libvips thread pool)

### Phase 3 — Non-image Duplicate Detection

- Compute SHA-256 hash for each non-image file
- Group files with identical hashes → exact duplicates

### Phase 4 — Aggregate Results

- Merge Phase 2 and Phase 3 results into a unified list of duplicate groups
- Each group contains: file list, match type (exact/perceptual), similarity score, wasted bytes
- Wasted bytes = total group size - size of smallest file in group

### Similarity Score

Convert Hamming distance to percentage:
```
similarity = (1 - hammingDistance / 64) * 100
```
- Distance 0 → 100% (pixel-perfect structure match)
- Distance 5 → 92.2% (typical pingo compression range)
- Distance 10 → 84.4%
- Exact hash matches → 100%

## 2. UI Integration — Entry Point & Navigation

### Updated Flow

```
FolderPickerPage → HomePage → ScannerPage (unused scan)
                            → DuplicatePage (duplicate scan)
```

**HomePage changes:** Add a second card/button alongside "Scan Unused Resources":
- **"Scan Unused Resources"** — existing flow, unchanged
- **"Scan Duplicate Resources"** — opens DuplicatePage

**DuplicatePage** is a completely new page, separate from ScannerPage:
- Different display logic (grouped duplicates vs. tree of unused)
- Different store state (duplicate groups vs. resource list)
- Avoids complicating the existing ScannerPage

### Settings

Displayed in a settings popup on DuplicatePage (consistent with ScannerPage's SettingsPopup pattern):
- **Similarity threshold**: slider 0-10 (Hamming distance), default 5
- Label: 0 = pixel-perfect only, 5 = allows compression changes, 10 = broadly similar

## 3. Visualization — DuplicatePage Layout

### 3.1 Top Bar

Matches ScannerPage style:
- Buttons: **Rescan**, **Export CSV**, **Settings**, **Back**
- **Filter bar**:
  - File type: All / Images Only / Non-images Only
  - Match type: All / Exact Match / Perceptual Match
  - Search: filter by filename

### 3.2 Left Panel — Duplicate Group List

Scrollable list of groups, each rendered as a card/row:

```
┌─────────────────────────────────────┐
│ Group #1 — Perceptual Match (3 files)│
│ Similarity: 96%  │ Wasted: 245 KB   │
│ icon_gem.png, icon_gem_v2.png, ...  │
├─────────────────────────────────────┤
│ Group #2 — Exact Match (2 files)    │
│ Similarity: 100% │ Wasted: 128 KB   │
│ bg_lobby.json, bg_lobby_copy.json   │
└─────────────────────────────────────┘
```

- **Color badge**: green = Exact Match, orange = Perceptual Match
- **Wasted size**: total group size minus smallest file size
- **Default sort**: wasted size descending (biggest waste first)
- Click a group → show details in Right Panel

### 3.3 Right Panel — Group Detail

**For image groups — grid comparison:**

```
┌──────────────────────────────────────────┐
│  Group #1 — Perceptual Match             │
│  Hamming Distance: 2  │  Similarity: 96% │
├──────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │ [thumb]  │  │ [thumb]  │  │ [thumb]  │ │
│  └─────────┘  └─────────┘  └─────────┘  │
│  icon_gem.png  icon_gem_v2  icon_gem_old │
│  128x128       128x128      128x128     │
│  45 KB         32 KB        58 KB       │
│  res/Lobby/    res/Event/   res/Old/    │
└──────────────────────────────────────────┘
```

Each image shows:
- Preview thumbnail (base64 data URI)
- Filename
- Pixel dimensions (width x height)
- File size in bytes
- Full relative path

The smallest file (by size) gets a subtle highlight as a visual hint (report only, no action).

**For non-image groups — file list:**

```
┌──────────────────────────────────────────┐
│  Group #2 — Exact Match                  │
├──────────────────────────────────────────┤
│  📄 res/Config/bg_lobby.json    128 KB   │
│  📄 res/Old/bg_lobby_copy.json  128 KB   │
│                                          │
│  [Preview: content of first file]        │
└──────────────────────────────────────────┘
```

- List all files with size
- Preview content of the first file (since all are identical)

### 3.4 Summary Bar (bottom)

```
Total: 45 duplicate groups │ 120 files │ Exact: 30 │ Perceptual: 15 │ Potential savings: 12.5 MB
```

## 4. Technical Architecture

### 4.1 New Files

**Main process (scanner engine):**
- `src/main/scanner/DuplicateScanner.js` — Pipeline orchestrator. Coordinates 4 phases, emits progress via IPC.
- `src/main/scanner/hashers/FileHasher.js` — SHA-256 hashing using Node.js built-in `crypto` module.
- `src/main/scanner/hashers/PerceptualHasher.js` — pHash implementation: resize via `sharp`, DCT computation, 64-bit hash generation, Hamming distance comparison, multi-index optimization.

**IPC handlers (added to existing files):**
- `src/main/ipc/scanner.js` — New handlers: `duplicate:start-scan`, `duplicate:get-preview`. New events: `duplicate:scan-progress`, `duplicate:scan-complete`.

**Renderer (React + TypeScript):**
- `src/renderer/pages/DuplicatePage.tsx` — Main page component
- `src/renderer/components/duplicate/DuplicateGroupList.tsx` — Left panel, scrollable group list
- `src/renderer/components/duplicate/DuplicateGroupCard.tsx` — Individual group card/row
- `src/renderer/components/duplicate/DuplicateDetail.tsx` — Right panel container
- `src/renderer/components/duplicate/ImageCompareGrid.tsx` — Image thumbnail grid comparison
- `src/renderer/components/duplicate/FileCompareList.tsx` — Non-image file list comparison
- `src/renderer/components/duplicate/DuplicateFilterBar.tsx` — Filter controls
- `src/renderer/components/duplicate/DuplicateSummary.tsx` — Bottom summary statistics bar
- `src/renderer/stores/useDuplicateStore.ts` — Zustand store for duplicate scan state

### 4.2 Data Structures

```typescript
interface DuplicateGroup {
  id: number;
  matchType: 'exact' | 'perceptual';
  fileType: 'image' | 'non-image';
  similarity: number;          // 0-100%
  hammingDistance?: number;     // only for perceptual matches
  files: DuplicateFile[];
  wastedBytes: number;         // total size - smallest file size
}

interface DuplicateFile {
  path: string;                // relative: "res/Lobby/icon.png"
  absPath: string;
  size: number;                // bytes
  width?: number;              // image only
  height?: number;             // image only
  hash: string;                // SHA-256
  pHash?: string;              // perceptual hash hex string, image only
}

interface DuplicateScanResult {
  groups: DuplicateGroup[];
  stats: {
    totalFiles: number;
    totalGroups: number;
    exactGroups: number;
    perceptualGroups: number;
    totalWastedBytes: number;
    imageFiles: number;
    nonImageFiles: number;
  };
  settings: {
    threshold: number;
  };
}
```

### 4.3 Dependencies

**New:**
- **`sharp`** — Native image processing (resize, grayscale, raw pixel buffer). Widely used, supports Windows/Mac/Linux. Requires electron-builder config for native module bundling.

**No other new dependencies.** DCT and Hamming distance are self-implemented (~50 lines of code).

### 4.4 IPC Data Flow

```
User clicks "Scan Duplicates" on HomePage
  → Navigate to DuplicatePage
  → User clicks "Start Scan" (or auto-start)
  → IPC: duplicate:start-scan { resDir, threshold }
  → DuplicateScanner.scan(resDir, options)
    → Phase 1: Walk res/, classify files
       ← IPC emit: duplicate:scan-progress { phase: 1, message, current, total }
    → Phase 2a: SHA-256 all images → exact groups
       ← IPC emit: duplicate:scan-progress { phase: 2, step: 'hashing', current, total }
    → Phase 2b: pHash remaining → perceptual groups
       ← IPC emit: duplicate:scan-progress { phase: 2, step: 'perceptual', current, total }
    → Phase 3: SHA-256 non-images → exact groups
       ← IPC emit: duplicate:scan-progress { phase: 3, current, total }
    → Phase 4: Aggregate
  → IPC: duplicate:scan-complete → DuplicateScanResult
  → useDuplicateStore.setScanResult(result)
  → DuplicatePage re-renders with results
```

### 4.5 Preload Bridge

Add to `src/main/preload.js`:
```javascript
duplicate: {
  startScan: (resDir, options) => ipcRenderer.invoke('duplicate:start-scan', resDir, options),
  getPreview: (filePath) => ipcRenderer.invoke('duplicate:get-preview', filePath),
  onProgress: (callback) => ipcRenderer.on('duplicate:scan-progress', callback),
  onComplete: (callback) => ipcRenderer.on('duplicate:scan-complete', callback),
}
```

## 5. pHash Algorithm Detail

### Hash Generation (per image)

```
Input image (any size, any format)
  → sharp: resize(32, 32).grayscale().raw()
  → 32x32 matrix of pixel values (0-255)
  → Apply 2D DCT (Type-II)
  → Extract top-left 8x8 block (low frequency components)
  → Calculate median of 64 DCT coefficient values
  → Each value >= median → bit 1, else → bit 0
  → Output: 64-bit hash (stored as hex string)
```

**Why DCT?** Low-frequency components capture the "structure" of the image — layout, dominant tones. High-frequency components represent fine detail, noise, and compression artifacts. Taking the 8x8 top-left block preserves the essence while ignoring compression differences.

### Hamming Distance Comparison

```javascript
distance = popcount(hashA XOR hashB)
```

- Distance 0: structurally identical images
- Distance 1-5: nearly identical (compression, quality changes) — **pingo range**
- Distance 6-10: similar images (minor edits)
- Distance >10: different images

### Multi-index Optimization

For N images with default threshold T=5:

**Primary optimization — dimension grouping:**
- Only compare images with identical width x height. This is the biggest win: a 128x128 icon never compares against a 1024x768 background.

**Secondary optimization — multi-index lookup:**
1. Split each 64-bit hash into 8 blocks of 8 bits each
2. For each block position, build a Map<8-bit-value, Set<imageIndex>>
3. By pigeonhole principle: if Hamming distance ≤ T, at least (8 - T) blocks must be identical. For T=5, at least 3 of 8 blocks are identical.
4. For each image, find candidates that share at least 3 identical block positions
5. Only compute full Hamming distance for candidate pairs

For higher thresholds (T=6-10), fewer identical blocks are guaranteed, so more candidates pass the filter — but dimension grouping still keeps the total manageable.

Combined, these reduce comparisons from O(n^2) to near O(n) in practice.

## 6. Export

**CSV export** includes:
- Group ID, match type, similarity %, Hamming distance
- File path, file size, dimensions (for images)
- Wasted bytes per group

Format: one row per file, grouped by Group ID.
