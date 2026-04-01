# Duplicate Resource Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate scan mode that detects duplicate files in `res/`, using SHA-256 for exact matches and perceptual hashing (pHash) for visually identical images.

**Architecture:** New `DuplicateScanner` orchestrator in main process with `FileHasher` and `PerceptualHasher` modules. New `DuplicatePage` in renderer with dedicated Zustand store, group list, and detail panels. Integrated via IPC like the existing unused-resource scanner.

**Tech Stack:** sharp (image processing), Node.js crypto (SHA-256), React + Zustand + CSS Modules (UI)

---

## File Structure

### New files — Main process
- `src/main/scanner/DuplicateScanner.js` — Pipeline orchestrator (4 phases)
- `src/main/scanner/hashers/FileHasher.js` — SHA-256 file hashing
- `src/main/scanner/hashers/PerceptualHasher.js` — pHash: resize, DCT, 64-bit hash, Hamming distance, multi-index

### New files — Renderer
- `src/renderer/pages/DuplicatePage.tsx` + `.module.css` — Main duplicate scan page
- `src/renderer/stores/useDuplicateStore.ts` — Zustand store
- `src/renderer/components/duplicate/DuplicateFilterBar.tsx` + `.module.css`
- `src/renderer/components/duplicate/DuplicateGroupList.tsx` + `.module.css`
- `src/renderer/components/duplicate/DuplicateGroupCard.tsx` + `.module.css`
- `src/renderer/components/duplicate/DuplicateDetail.tsx` + `.module.css`
- `src/renderer/components/duplicate/ImageCompareGrid.tsx` + `.module.css`
- `src/renderer/components/duplicate/FileCompareList.tsx` + `.module.css`
- `src/renderer/components/duplicate/DuplicateSummary.tsx` + `.module.css`
- `src/renderer/components/duplicate/DuplicateSettingsPopup.tsx` + `.module.css`
- `src/renderer/components/duplicate/DuplicateProgress.tsx` + `.module.css`

### Modified files
- `package.json` — Add `sharp` dependency, update electron-builder config
- `src/renderer/types.ts` — Add duplicate-related interfaces
- `src/renderer/pages/HomePage.tsx` — Add "Scan Duplicates" card
- `src/renderer/App.tsx` — Add `duplicate` route
- `src/renderer/stores/useAppStore.ts` — Extend `PageName` type
- `src/main/preload.js` — Add duplicate IPC bridge methods
- `src/main/ipc/scanner.js` — Add duplicate scan IPC handlers
- `src/main/ipc/index.js` — Register duplicate handlers

---

### Task 1: Install sharp & configure build

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install sharp**

```bash
cd c:/Users/Fresher/Desktop/BAT_MAN/check-unused_resource
npm install sharp
```

Expected: sharp added to `dependencies` in package.json.

- [ ] **Step 2: Update electron-builder config to include sharp native bindings**

In `package.json`, update the `"build"` section to include sharp's native files. Change:

```json
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
```

To:

```json
"build": {
    "appId": "com.tools.cocos-resource-scanner",
    "productName": "Cocos Resource Scanner",
    "files": [
      "src/main/**/*",
      "dist/**/*",
      "assets/**/*",
      "node_modules/sharp/**/*"
    ],
    "extraMetadata": {
      "main": "src/main/main.js"
    }
  }
```

- [ ] **Step 3: Verify sharp works in Node.js**

```bash
cd c:/Users/Fresher/Desktop/BAT_MAN/check-unused_resource
node -e "const sharp = require('sharp'); sharp(Buffer.from([0])).metadata().catch(() => console.log('sharp loaded OK'));"
```

Expected: "sharp loaded OK" printed.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add sharp dependency for image perceptual hashing"
```

---

### Task 2: FileHasher — SHA-256 hashing module

**Files:**
- Create: `src/main/scanner/hashers/FileHasher.js`

- [ ] **Step 1: Create hashers directory**

```bash
mkdir -p src/main/scanner/hashers
```

- [ ] **Step 2: Write FileHasher.js**

```javascript
// src/main/scanner/hashers/FileHasher.js
const fs = require('fs');
const crypto = require('crypto');

/**
 * Compute SHA-256 hash of a file.
 * @param {string} filePath - Absolute path to file
 * @returns {string} Hex-encoded SHA-256 hash
 */
function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Group files by their SHA-256 hash.
 * @param {Array<{path: string, absPath: string, size: number}>} files
 * @param {function} onProgress - callback({current, total})
 * @returns {Map<string, Array<{path: string, absPath: string, size: number}>>} hash → files
 */
function groupByHash(files, onProgress) {
  const hashMap = new Map();
  for (let i = 0; i < files.length; i++) {
    if (onProgress && i % 100 === 0) {
      onProgress({ current: i, total: files.length });
    }
    try {
      const hash = hashFile(files[i].absPath);
      files[i].hash = hash;
      if (!hashMap.has(hash)) {
        hashMap.set(hash, []);
      }
      hashMap.get(hash).push(files[i]);
    } catch {
      // Skip unreadable files
    }
  }
  if (onProgress) onProgress({ current: files.length, total: files.length });
  return hashMap;
}

/**
 * Extract duplicate groups from a hash map (groups with 2+ files).
 * @param {Map<string, Array>} hashMap
 * @returns {Array<Array>} Array of duplicate groups
 */
function extractDuplicateGroups(hashMap) {
  const groups = [];
  for (const files of hashMap.values()) {
    if (files.length >= 2) {
      groups.push(files);
    }
  }
  return groups;
}

module.exports = { hashFile, groupByHash, extractDuplicateGroups };
```

- [ ] **Step 3: Verify module loads**

```bash
node -e "const h = require('./src/main/scanner/hashers/FileHasher'); console.log(typeof h.hashFile, typeof h.groupByHash, typeof h.extractDuplicateGroups);"
```

Expected: `function function function`

- [ ] **Step 4: Commit**

```bash
git add src/main/scanner/hashers/FileHasher.js
git commit -m "feat: add FileHasher module for SHA-256 duplicate detection"
```

---

### Task 3: PerceptualHasher — pHash implementation

**Files:**
- Create: `src/main/scanner/hashers/PerceptualHasher.js`

- [ ] **Step 1: Write PerceptualHasher.js**

This is the core algorithm. It implements:
1. DCT-based perceptual hashing (resize 32x32 → DCT → 8x8 low-freq → median threshold → 64-bit hash)
2. Hamming distance comparison
3. Multi-index optimization for fast lookup
4. Dimension grouping

```javascript
// src/main/scanner/hashers/PerceptualHasher.js
const sharp = require('sharp');

const HASH_SIZE = 8;       // 8x8 DCT block → 64-bit hash
const RESIZE_DIM = 32;     // resize images to 32x32 before DCT

/**
 * Compute perceptual hash for a single image file.
 * @param {string} filePath - Absolute path to image
 * @returns {Promise<{hash: BigInt, width: number, height: number}>}
 */
async function computePHash(filePath) {
  const image = sharp(filePath);
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  // Resize to 32x32 grayscale, get raw pixel buffer
  const { data } = await image
    .resize(RESIZE_DIM, RESIZE_DIM, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Convert buffer to 2D matrix
  const matrix = [];
  for (let y = 0; y < RESIZE_DIM; y++) {
    const row = [];
    for (let x = 0; x < RESIZE_DIM; x++) {
      row.push(data[y * RESIZE_DIM + x]);
    }
    matrix.push(row);
  }

  // Apply 2D DCT (Type-II)
  const dctMatrix = dct2d(matrix, RESIZE_DIM);

  // Extract top-left 8x8 block (low frequency coefficients)
  const lowFreq = [];
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      lowFreq.push(dctMatrix[y][x]);
    }
  }

  // Calculate median (excluding DC component at [0][0])
  const sorted = lowFreq.slice(1).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  // Generate 64-bit hash: each coefficient >= median → 1, else → 0
  let hash = BigInt(0);
  for (let i = 0; i < 64; i++) {
    if (lowFreq[i] >= median) {
      hash |= BigInt(1) << BigInt(63 - i);
    }
  }

  return { hash, width, height };
}

/**
 * 2D Discrete Cosine Transform (Type-II).
 * @param {number[][]} matrix - Input pixel matrix
 * @param {number} N - Matrix dimension
 * @returns {number[][]} DCT coefficient matrix
 */
function dct2d(matrix, N) {
  // Precompute cosine table for performance
  const cosTable = [];
  for (let i = 0; i < N; i++) {
    cosTable[i] = [];
    for (let j = 0; j < N; j++) {
      cosTable[i][j] = Math.cos(((2 * j + 1) * i * Math.PI) / (2 * N));
    }
  }

  // 1D DCT on rows
  const temp = [];
  for (let y = 0; y < N; y++) {
    temp[y] = [];
    for (let u = 0; u < N; u++) {
      let sum = 0;
      for (let x = 0; x < N; x++) {
        sum += matrix[y][x] * cosTable[u][x];
      }
      const cu = u === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
      temp[y][u] = cu * sum;
    }
  }

  // 1D DCT on columns
  const result = [];
  for (let v = 0; v < N; v++) {
    result[v] = [];
    for (let u = 0; u < N; u++) {
      let sum = 0;
      for (let y = 0; y < N; y++) {
        sum += temp[y][u] * cosTable[v][y];
      }
      const cv = v === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
      result[v][u] = cv * sum;
    }
  }

  return result;
}

/**
 * Compute Hamming distance between two 64-bit hashes.
 * @param {BigInt} hashA
 * @param {BigInt} hashB
 * @returns {number} Number of differing bits (0-64)
 */
function hammingDistance(hashA, hashB) {
  let xor = hashA ^ hashB;
  let count = 0;
  while (xor > BigInt(0)) {
    count += Number(xor & BigInt(1));
    xor >>= BigInt(1);
  }
  return count;
}

/**
 * Convert Hamming distance to similarity percentage.
 * @param {number} distance
 * @returns {number} 0-100
 */
function distanceToSimilarity(distance) {
  return Math.round((1 - distance / 64) * 1000) / 10;
}

/**
 * Convert BigInt hash to hex string for serialization.
 * @param {BigInt} hash
 * @returns {string} 16-char hex string
 */
function hashToHex(hash) {
  return hash.toString(16).padStart(16, '0');
}

/**
 * Convert hex string back to BigInt hash.
 * @param {string} hex
 * @returns {BigInt}
 */
function hexToHash(hex) {
  return BigInt('0x' + hex);
}

/**
 * Find perceptually similar image groups using multi-index optimization.
 *
 * @param {Array<{path, absPath, size, hash, pHash: BigInt, width, height}>} images
 * @param {number} threshold - Max Hamming distance to consider duplicate (0-10)
 * @returns {Array<{files: Array, hammingDistance: number, similarity: number}>}
 */
function findPerceptualDuplicates(images, threshold) {
  if (images.length < 2) return [];

  // Step 1: Group by dimensions (width x height)
  const dimGroups = new Map();
  for (const img of images) {
    const key = `${img.width}x${img.height}`;
    if (!dimGroups.has(key)) dimGroups.set(key, []);
    dimGroups.get(key).push(img);
  }

  const allPairs = [];

  for (const group of dimGroups.values()) {
    if (group.length < 2) continue;

    // Step 2: Multi-index lookup within each dimension group
    // Split 64-bit hash into 8 blocks of 8 bits
    const BLOCK_COUNT = 8;
    const BLOCK_BITS = 8;
    const requiredMatches = BLOCK_COUNT - threshold; // pigeonhole: at least this many blocks identical

    if (requiredMatches <= 0) {
      // Threshold too high for multi-index, fall back to brute force within dim group
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const dist = hammingDistance(group[i].pHash, group[j].pHash);
          if (dist <= threshold) {
            allPairs.push({ i: group[i], j: group[j], distance: dist });
          }
        }
      }
      continue;
    }

    // Build block lookup tables
    const blockMaps = [];
    for (let b = 0; b < BLOCK_COUNT; b++) {
      blockMaps.push(new Map());
    }

    for (let idx = 0; idx < group.length; idx++) {
      const hash = group[idx].pHash;
      for (let b = 0; b < BLOCK_COUNT; b++) {
        const shift = BigInt((BLOCK_COUNT - 1 - b) * BLOCK_BITS);
        const blockVal = Number((hash >> shift) & BigInt(0xFF));
        if (!blockMaps[b].has(blockVal)) blockMaps[b].set(blockVal, []);
        blockMaps[b].get(blockVal).push(idx);
      }
    }

    // Find candidate pairs
    const checked = new Set();
    for (let idx = 0; idx < group.length; idx++) {
      const hash = group[idx].pHash;
      // Count how many blocks each other image shares with this one
      const candidateCounts = new Map();

      for (let b = 0; b < BLOCK_COUNT; b++) {
        const shift = BigInt((BLOCK_COUNT - 1 - b) * BLOCK_BITS);
        const blockVal = Number((hash >> shift) & BigInt(0xFF));
        const matches = blockMaps[b].get(blockVal) || [];
        for (const otherIdx of matches) {
          if (otherIdx <= idx) continue; // avoid duplicates and self
          candidateCounts.set(otherIdx, (candidateCounts.get(otherIdx) || 0) + 1);
        }
      }

      // Only check pairs with enough matching blocks
      for (const [otherIdx, count] of candidateCounts) {
        if (count < requiredMatches) continue;
        const pairKey = `${idx}-${otherIdx}`;
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);

        const dist = hammingDistance(group[idx].pHash, group[otherIdx].pHash);
        if (dist <= threshold) {
          allPairs.push({ i: group[idx], j: group[otherIdx], distance: dist });
        }
      }
    }
  }

  // Step 3: Merge pairs into groups using union-find
  const parent = new Map();
  function find(key) {
    if (!parent.has(key)) parent.set(key, key);
    if (parent.get(key) !== key) parent.set(key, find(parent.get(key)));
    return parent.get(key);
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  const pairDistances = new Map(); // track max distance within each group

  for (const pair of allPairs) {
    union(pair.i.path, pair.j.path);
  }

  // Build groups
  const groupMap = new Map();
  const imageByPath = new Map();
  for (const img of images) {
    imageByPath.set(img.path, img);
  }

  for (const pair of allPairs) {
    const root = find(pair.i.path);
    if (!groupMap.has(root)) groupMap.set(root, { files: new Set(), maxDistance: 0 });
    const g = groupMap.get(root);
    g.files.add(pair.i.path);
    g.files.add(pair.j.path);
    g.maxDistance = Math.max(g.maxDistance, pair.distance);
  }

  const results = [];
  for (const g of groupMap.values()) {
    const files = Array.from(g.files).map(p => imageByPath.get(p));
    results.push({
      files,
      hammingDistance: g.maxDistance,
      similarity: distanceToSimilarity(g.maxDistance),
    });
  }

  return results;
}

/**
 * Compute pHash for multiple images with progress reporting.
 * @param {Array<{path, absPath, size, hash}>} images
 * @param {function} onProgress
 * @returns {Promise<Array<{path, absPath, size, hash, pHash: BigInt, width, height}>>}
 */
async function computeAllPHashes(images, onProgress) {
  const results = [];
  for (let i = 0; i < images.length; i++) {
    if (onProgress && i % 50 === 0) {
      onProgress({ current: i, total: images.length });
    }
    try {
      const { hash: pHash, width, height } = await computePHash(images[i].absPath);
      results.push({ ...images[i], pHash, width, height });
    } catch {
      // Skip images that can't be processed (corrupt, unsupported)
    }
  }
  if (onProgress) onProgress({ current: images.length, total: images.length });
  return results;
}

module.exports = {
  computePHash,
  computeAllPHashes,
  hammingDistance,
  distanceToSimilarity,
  hashToHex,
  hexToHash,
  findPerceptualDuplicates,
};
```

- [ ] **Step 2: Verify module loads**

```bash
node -e "const p = require('./src/main/scanner/hashers/PerceptualHasher'); console.log(typeof p.computePHash, typeof p.hammingDistance, typeof p.findPerceptualDuplicates);"
```

Expected: `function function function`

- [ ] **Step 3: Quick test — hash a known image if available**

```bash
node -e "
const p = require('./src/main/scanner/hashers/PerceptualHasher');
// Test hamming distance
const a = BigInt('0xFF00FF00FF00FF00');
const b = BigInt('0xFF00FF00FF00FF01');
console.log('Hamming distance:', p.hammingDistance(a, b));
console.log('Similarity:', p.distanceToSimilarity(p.hammingDistance(a, b)) + '%');
console.log('hashToHex:', p.hashToHex(a));
"
```

Expected: Hamming distance: 1, Similarity: 98.4%, hashToHex: ff00ff00ff00ff00

- [ ] **Step 4: Commit**

```bash
git add src/main/scanner/hashers/PerceptualHasher.js
git commit -m "feat: add PerceptualHasher module with pHash, DCT, multi-index optimization"
```

---

### Task 4: DuplicateScanner — Pipeline orchestrator

**Files:**
- Create: `src/main/scanner/DuplicateScanner.js`

- [ ] **Step 1: Write DuplicateScanner.js**

```javascript
// src/main/scanner/DuplicateScanner.js
const fs = require('fs');
const path = require('path');
const { groupByHash, extractDuplicateGroups } = require('./hashers/FileHasher');
const { computeAllPHashes, findPerceptualDuplicates, hashToHex, distanceToSimilarity } = require('./hashers/PerceptualHasher');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif']);

/**
 * Scan for duplicate resources in res/ directory.
 *
 * Pipeline:
 *   Phase 1: Walk res/, classify into image / non-image
 *   Phase 2a: SHA-256 hash all images → exact duplicates
 *   Phase 2b: pHash remaining images → perceptual duplicates
 *   Phase 3: SHA-256 hash non-images → exact duplicates
 *   Phase 4: Aggregate results
 *
 * @param {string} projectRoot - Path to project folder (contains res/)
 * @param {function} onProgress - Progress callback
 * @param {{threshold?: number}} options
 * @returns {Promise<{groups: Array, stats: object}>}
 */
async function scanDuplicates(projectRoot, onProgress, options) {
  const resDir = path.join(projectRoot, 'res');
  const threshold = (options && options.threshold != null) ? options.threshold : 5;
  const progress = (data) => { if (onProgress) onProgress(data); };

  // Phase 1: Walk res/ and classify files
  progress({ phase: 1, message: 'Scanning files...', current: 0, total: 0 });
  const imageFiles = [];
  const nonImageFiles = [];
  walkDir(resDir, resDir, imageFiles, nonImageFiles, progress);

  progress({
    phase: 1,
    message: `Found ${imageFiles.length} images, ${nonImageFiles.length} other files`,
    current: imageFiles.length + nonImageFiles.length,
    total: imageFiles.length + nonImageFiles.length,
  });

  let groupId = 0;
  const allGroups = [];

  // Phase 2a: SHA-256 hash all images → exact duplicates
  progress({ phase: 2, step: 'hashing', message: 'Hashing images...', current: 0, total: imageFiles.length });
  const imageHashMap = groupByHash(imageFiles, (p) => {
    progress({ phase: 2, step: 'hashing', message: `Hashing images (${p.current}/${p.total})...`, current: p.current, total: p.total });
  });

  const exactImageGroups = extractDuplicateGroups(imageHashMap);
  const exactMatchedPaths = new Set();
  for (const group of exactImageGroups) {
    const files = group.map(f => ({
      path: f.path,
      absPath: f.absPath,
      size: f.size,
      hash: f.hash,
      width: null,
      height: null,
      pHash: null,
    }));
    const sizes = files.map(f => f.size);
    const minSize = Math.min(...sizes);
    const wastedBytes = sizes.reduce((sum, s) => sum + s, 0) - minSize;

    allGroups.push({
      id: groupId++,
      matchType: 'exact',
      fileType: 'image',
      similarity: 100,
      hammingDistance: 0,
      files,
      wastedBytes,
    });
    for (const f of group) exactMatchedPaths.add(f.path);
  }

  // Phase 2b: pHash remaining images
  const remainingImages = imageFiles.filter(f => !exactMatchedPaths.has(f.path));
  if (remainingImages.length >= 2) {
    progress({ phase: 2, step: 'perceptual', message: 'Computing perceptual hashes...', current: 0, total: remainingImages.length });

    const pHashedImages = await computeAllPHashes(remainingImages, (p) => {
      progress({ phase: 2, step: 'perceptual', message: `Perceptual hashing (${p.current}/${p.total})...`, current: p.current, total: p.total });
    });

    progress({ phase: 2, step: 'comparing', message: 'Comparing perceptual hashes...', current: 0, total: 0 });
    const perceptualGroups = findPerceptualDuplicates(pHashedImages, threshold);

    for (const pg of perceptualGroups) {
      const files = pg.files.map(f => ({
        path: f.path,
        absPath: f.absPath,
        size: f.size,
        hash: f.hash || '',
        width: f.width,
        height: f.height,
        pHash: f.pHash ? hashToHex(f.pHash) : null,
      }));
      const sizes = files.map(f => f.size);
      const minSize = Math.min(...sizes);
      const wastedBytes = sizes.reduce((sum, s) => sum + s, 0) - minSize;

      allGroups.push({
        id: groupId++,
        matchType: 'perceptual',
        fileType: 'image',
        similarity: pg.similarity,
        hammingDistance: pg.hammingDistance,
        files,
        wastedBytes,
      });
    }
  }

  // Phase 3: SHA-256 hash non-images → exact duplicates
  progress({ phase: 3, message: 'Hashing non-image files...', current: 0, total: nonImageFiles.length });
  const nonImageHashMap = groupByHash(nonImageFiles, (p) => {
    progress({ phase: 3, message: `Hashing files (${p.current}/${p.total})...`, current: p.current, total: p.total });
  });

  const exactNonImageGroups = extractDuplicateGroups(nonImageHashMap);
  for (const group of exactNonImageGroups) {
    const files = group.map(f => ({
      path: f.path,
      absPath: f.absPath,
      size: f.size,
      hash: f.hash,
      width: null,
      height: null,
      pHash: null,
    }));
    const sizes = files.map(f => f.size);
    const minSize = Math.min(...sizes);
    const wastedBytes = sizes.reduce((sum, s) => sum + s, 0) - minSize;

    allGroups.push({
      id: groupId++,
      matchType: 'exact',
      fileType: 'non-image',
      similarity: 100,
      hammingDistance: 0,
      files,
      wastedBytes,
    });
  }

  // Phase 4: Aggregate stats
  const exactGroups = allGroups.filter(g => g.matchType === 'exact').length;
  const perceptualGroups = allGroups.filter(g => g.matchType === 'perceptual').length;
  const totalWastedBytes = allGroups.reduce((sum, g) => sum + g.wastedBytes, 0);

  const stats = {
    totalFiles: imageFiles.length + nonImageFiles.length,
    totalGroups: allGroups.length,
    exactGroups,
    perceptualGroups,
    totalWastedBytes,
    imageFiles: imageFiles.length,
    nonImageFiles: nonImageFiles.length,
  };

  progress({ phase: 4, message: 'Scan complete', current: 1, total: 1 });

  return { groups: allGroups, stats, settings: { threshold } };
}

/**
 * Recursively walk directory and classify files.
 */
function walkDir(dir, resDir, imageFiles, nonImageFiles, progress) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkDir(fullPath, resDir, imageFiles, nonImageFiles, progress);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    const relPath = path.relative(path.dirname(resDir), fullPath).replace(/\\/g, '/');
    let size = 0;
    try {
      size = fs.statSync(fullPath).size;
    } catch { /* skip */ }

    const fileInfo = { path: relPath, absPath: fullPath, size };

    if (IMAGE_EXTENSIONS.has(ext)) {
      imageFiles.push(fileInfo);
    } else {
      nonImageFiles.push(fileInfo);
    }
  }
}

module.exports = { scanDuplicates };
```

- [ ] **Step 2: Verify module loads**

```bash
node -e "const d = require('./src/main/scanner/DuplicateScanner'); console.log(typeof d.scanDuplicates);"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add src/main/scanner/DuplicateScanner.js
git commit -m "feat: add DuplicateScanner pipeline orchestrator (4-phase)"
```

---

### Task 5: IPC handlers + Preload bridge

**Files:**
- Modify: `src/main/ipc/scanner.js` (add duplicate handlers)
- Modify: `src/main/preload.js` (add duplicate bridge)

- [ ] **Step 1: Add duplicate IPC handlers to scanner.js**

At the top of `src/main/ipc/scanner.js`, add the import (after the existing require for `resolveReferences`):

```javascript
const { scanDuplicates } = require('../scanner/DuplicateScanner');
```

At the end of the `registerScannerHandlers` function (before the closing `}`), add:

```javascript
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
```

- [ ] **Step 2: Add duplicate bridge to preload.js**

At the end of the `contextBridge.exposeInMainWorld('api', { ... })` object in `src/main/preload.js`, add (before the closing `});`):

```javascript
  // Duplicate scanner
  scanDuplicates: (folderPath, options) => ipcRenderer.invoke('duplicate:start-scan', folderPath, options),
  onDuplicateScanProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('duplicate:scan-progress', listener);
    return () => ipcRenderer.removeListener('duplicate:scan-progress', listener);
  },
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/scanner.js src/main/preload.js
git commit -m "feat: add IPC handlers and preload bridge for duplicate scanning"
```

---

### Task 6: TypeScript types + Window API declarations

**Files:**
- Modify: `src/renderer/types.ts`

- [ ] **Step 1: Add duplicate types to types.ts**

At the end of `src/renderer/types.ts`, before the `declare global` block, add:

```typescript
// Duplicate scan types
export interface DuplicateFile {
  path: string;
  absPath: string;
  size: number;
  width: number | null;
  height: number | null;
  hash: string;
  pHash: string | null;
}

export interface DuplicateGroup {
  id: number;
  matchType: 'exact' | 'perceptual';
  fileType: 'image' | 'non-image';
  similarity: number;
  hammingDistance: number;
  files: DuplicateFile[];
  wastedBytes: number;
}

export interface DuplicateScanStats {
  totalFiles: number;
  totalGroups: number;
  exactGroups: number;
  perceptualGroups: number;
  totalWastedBytes: number;
  imageFiles: number;
  nonImageFiles: number;
}

export interface DuplicateScanResult {
  groups: DuplicateGroup[];
  stats: DuplicateScanStats;
  settings: { threshold: number };
}
```

- [ ] **Step 2: Update PageName type**

Change line 63:

```typescript
export type PageName = 'folder-picker' | 'home' | 'scanner';
```

To:

```typescript
export type PageName = 'folder-picker' | 'home' | 'scanner' | 'duplicate';
```

- [ ] **Step 3: Add duplicate API methods to Window interface**

In the `window.api` interface inside `declare global`, add after the `onScanProgress` line:

```typescript
      scanDuplicates: (path: string, options: { threshold: number }) => Promise<{ success: boolean; data?: DuplicateScanResult; message?: string }>;
      onDuplicateScanProgress: (callback: (data: { phase?: number; step?: string; message?: string; current?: number; total?: number }) => void) => () => void;
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/types.ts
git commit -m "feat: add TypeScript types for duplicate scan feature"
```

---

### Task 7: useDuplicateStore — Zustand store

**Files:**
- Create: `src/renderer/stores/useDuplicateStore.ts`

- [ ] **Step 1: Write useDuplicateStore.ts**

```typescript
// src/renderer/stores/useDuplicateStore.ts
import { create } from 'zustand';
import type { DuplicateGroup, DuplicateScanResult, DuplicateScanStats } from '../types';

type FileTypeFilter = 'all' | 'image' | 'non-image';
type MatchTypeFilter = 'all' | 'exact' | 'perceptual';

interface DuplicateState {
  scanResult: DuplicateScanResult | null;
  isScanning: boolean;
  scanProgress: { phase: number; step?: string; message: string; current: number; total: number } | null;
  selectedGroupId: number | null;
  fileTypeFilter: FileTypeFilter;
  matchTypeFilter: MatchTypeFilter;
  searchQuery: string;
  threshold: number;

  startScan: (projectPath: string, threshold: number) => Promise<void>;
  setSelectedGroupId: (id: number | null) => void;
  setFileTypeFilter: (filter: FileTypeFilter) => void;
  setMatchTypeFilter: (filter: MatchTypeFilter) => void;
  setSearchQuery: (query: string) => void;
  setThreshold: (threshold: number) => void;
  reset: () => void;
}

export const useDuplicateStore = create<DuplicateState>((set, get) => ({
  scanResult: null,
  isScanning: false,
  scanProgress: null,
  selectedGroupId: null,
  fileTypeFilter: 'all',
  matchTypeFilter: 'all',
  searchQuery: '',
  threshold: 5,

  startScan: async (projectPath, threshold) => {
    set({ isScanning: true, scanProgress: null, scanResult: null, selectedGroupId: null });

    const cleanup = window.api.onDuplicateScanProgress((progress) => {
      set({
        scanProgress: {
          phase: progress.phase || 0,
          step: progress.step,
          message: progress.message || 'Working...',
          current: progress.current || 0,
          total: progress.total || 0,
        },
      });
    });

    try {
      const result = await window.api.scanDuplicates(projectPath, { threshold });
      if (result.success && result.data) {
        set({ scanResult: result.data });
      }
    } finally {
      cleanup();
      set({ isScanning: false, scanProgress: null });
    }
  },

  setSelectedGroupId: (id) => set({ selectedGroupId: id }),
  setFileTypeFilter: (filter) => set({ fileTypeFilter: filter }),
  setMatchTypeFilter: (filter) => set({ matchTypeFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setThreshold: (threshold) => set({ threshold }),

  reset: () => set({
    scanResult: null,
    isScanning: false,
    scanProgress: null,
    selectedGroupId: null,
    fileTypeFilter: 'all',
    matchTypeFilter: 'all',
    searchQuery: '',
    threshold: 5,
  }),
}));

export function getFilteredGroups(state: DuplicateState): DuplicateGroup[] {
  if (!state.scanResult) return [];

  return state.scanResult.groups.filter(group => {
    if (state.fileTypeFilter !== 'all' && group.fileType !== state.fileTypeFilter) return false;
    if (state.matchTypeFilter !== 'all' && group.matchType !== state.matchTypeFilter) return false;

    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      const hasMatch = group.files.some(f => f.path.toLowerCase().includes(query));
      if (!hasMatch) return false;
    }

    return true;
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stores/useDuplicateStore.ts
git commit -m "feat: add useDuplicateStore for duplicate scan state management"
```

---

### Task 8: HomePage update + App routing

**Files:**
- Modify: `src/renderer/pages/HomePage.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/stores/useAppStore.ts`

- [ ] **Step 1: Add duplicate tool card to HomePage.tsx**

In `src/renderer/pages/HomePage.tsx`, change the `TOOLS` array (lines 6-15) from:

```typescript
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
```

To:

```typescript
const TOOLS = [
  {
    id: 'scanner' as const,
    icon: '\uD83D\uDD0D',
    iconBg: 'var(--surface-orange)',
    name: 'Scan Unused Resources',
    desc: 'Find and clean up unused resources in your project',
  },
  {
    id: 'duplicate' as const,
    icon: '\uD83D\uDDC2\uFE0F',
    iconBg: 'var(--surface-blue, #2a4a7f)',
    name: 'Scan Duplicate Resources',
    desc: 'Detect duplicate files using content hashing and image similarity',
  },
];
```

- [ ] **Step 2: Add duplicate route to App.tsx**

In `src/renderer/App.tsx`, add the import:

```typescript
import { DuplicatePage } from './pages/DuplicatePage';
```

Add a new case in the switch statement (after `case 'scanner':`):

```typescript
    case 'duplicate':
      return <DuplicatePage />;
```

- [ ] **Step 3: Update useAppStore openProject to also reset duplicate store**

In `src/renderer/stores/useAppStore.ts`, add the import at line 3:

```typescript
import { useDuplicateStore } from './useDuplicateStore';
```

In the `openProject` method, add after line 33 (`useScannerStore.getState().reset();`):

```typescript
    useDuplicateStore.getState().reset();
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/pages/HomePage.tsx src/renderer/App.tsx src/renderer/stores/useAppStore.ts
git commit -m "feat: add duplicate scan entry point in HomePage and App routing"
```

---

### Task 9: DuplicateProgress component

**Files:**
- Create: `src/renderer/components/duplicate/DuplicateProgress.tsx`
- Create: `src/renderer/components/duplicate/DuplicateProgress.module.css`

- [ ] **Step 1: Create duplicate components directory**

```bash
mkdir -p src/renderer/components/duplicate
```

- [ ] **Step 2: Write DuplicateProgress.tsx**

Re-use the same pattern as `ScanProgress.tsx` but connected to the duplicate store.

```tsx
// src/renderer/components/duplicate/DuplicateProgress.tsx
import React from 'react';
import { useDuplicateStore } from '../../stores/useDuplicateStore';
import styles from './DuplicateProgress.module.css';

export function DuplicateProgress() {
  const isScanning = useDuplicateStore(s => s.isScanning);
  const progress = useDuplicateStore(s => s.scanProgress);

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

- [ ] **Step 3: Write DuplicateProgress.module.css**

Copy the same styles from `ScanProgress.module.css`:

```bash
cp src/renderer/components/scanner/ScanProgress.module.css src/renderer/components/duplicate/DuplicateProgress.module.css
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/duplicate/DuplicateProgress.tsx src/renderer/components/duplicate/DuplicateProgress.module.css
git commit -m "feat: add DuplicateProgress overlay component"
```

---

### Task 10: DuplicateFilterBar component

**Files:**
- Create: `src/renderer/components/duplicate/DuplicateFilterBar.tsx`
- Create: `src/renderer/components/duplicate/DuplicateFilterBar.module.css`

- [ ] **Step 1: Write DuplicateFilterBar.tsx**

```tsx
// src/renderer/components/duplicate/DuplicateFilterBar.tsx
import React from 'react';
import { useDuplicateStore } from '../../stores/useDuplicateStore';
import styles from './DuplicateFilterBar.module.css';

const FILE_TYPE_OPTIONS = [
  { label: 'All Types', value: 'all' as const },
  { label: 'Images', value: 'image' as const },
  { label: 'Non-images', value: 'non-image' as const },
];

const MATCH_TYPE_OPTIONS = [
  { label: 'All Matches', value: 'all' as const },
  { label: 'Exact', value: 'exact' as const },
  { label: 'Perceptual', value: 'perceptual' as const },
];

export function DuplicateFilterBar() {
  const fileTypeFilter = useDuplicateStore(s => s.fileTypeFilter);
  const matchTypeFilter = useDuplicateStore(s => s.matchTypeFilter);
  const searchQuery = useDuplicateStore(s => s.searchQuery);
  const setFileTypeFilter = useDuplicateStore(s => s.setFileTypeFilter);
  const setMatchTypeFilter = useDuplicateStore(s => s.setMatchTypeFilter);
  const setSearchQuery = useDuplicateStore(s => s.setSearchQuery);

  return (
    <div className={styles.bar}>
      <select
        className={styles.select}
        value={fileTypeFilter}
        onChange={e => setFileTypeFilter(e.target.value as any)}
      >
        {FILE_TYPE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        className={styles.select}
        value={matchTypeFilter}
        onChange={e => setMatchTypeFilter(e.target.value as any)}
      >
        {MATCH_TYPE_OPTIONS.map(o => (
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

- [ ] **Step 2: Write DuplicateFilterBar.module.css**

Copy from FilterBar.module.css as base:

```bash
cp src/renderer/components/scanner/FilterBar.module.css src/renderer/components/duplicate/DuplicateFilterBar.module.css
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/duplicate/DuplicateFilterBar.tsx src/renderer/components/duplicate/DuplicateFilterBar.module.css
git commit -m "feat: add DuplicateFilterBar component"
```

---

### Task 11: DuplicateGroupCard + DuplicateGroupList

**Files:**
- Create: `src/renderer/components/duplicate/DuplicateGroupCard.tsx`
- Create: `src/renderer/components/duplicate/DuplicateGroupCard.module.css`
- Create: `src/renderer/components/duplicate/DuplicateGroupList.tsx`
- Create: `src/renderer/components/duplicate/DuplicateGroupList.module.css`

- [ ] **Step 1: Write DuplicateGroupCard.tsx**

```tsx
// src/renderer/components/duplicate/DuplicateGroupCard.tsx
import React from 'react';
import type { DuplicateGroup } from '../../types';
import { formatBytes } from '../../utils/format';
import styles from './DuplicateGroupCard.module.css';

interface Props {
  group: DuplicateGroup;
  isSelected: boolean;
  onClick: () => void;
}

export const DuplicateGroupCard = React.memo(function DuplicateGroupCard({ group, isSelected, onClick }: Props) {
  const fileNames = group.files.map(f => f.path.split('/').pop()).join(', ');
  const truncatedNames = fileNames.length > 80 ? fileNames.substring(0, 77) + '...' : fileNames;

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
      onClick={onClick}
    >
      <div className={styles.header}>
        <span className={`${styles.badge} ${group.matchType === 'exact' ? styles.badgeExact : styles.badgePerceptual}`}>
          {group.matchType === 'exact' ? 'Exact' : 'Perceptual'}
        </span>
        <span className={styles.fileCount}>{group.files.length} files</span>
      </div>
      <div className={styles.meta}>
        <span className={styles.similarity}>Similarity: {group.similarity}%</span>
        <span className={styles.wasted}>Wasted: {formatBytes(group.wastedBytes)}</span>
      </div>
      <div className={styles.fileNames}>{truncatedNames}</div>
    </div>
  );
});
```

- [ ] **Step 2: Write DuplicateGroupCard.module.css**

```css
/* src/renderer/components/duplicate/DuplicateGroupCard.module.css */
.card {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--transition);
}
.card:hover {
  background: rgba(255, 255, 255, 0.04);
}
.cardSelected {
  background: rgba(245, 166, 35, 0.08);
  border-left: 3px solid var(--accent);
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.5px;
}
.badgeExact {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
}
.badgePerceptual {
  background: rgba(245, 166, 35, 0.15);
  color: #f5a623;
}

.fileCount {
  font-size: 11px;
  color: var(--text-muted);
}

.meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.similarity {}
.wasted {
  color: var(--text-orange, #f5a623);
}

.fileNames {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 3: Write DuplicateGroupList.tsx**

```tsx
// src/renderer/components/duplicate/DuplicateGroupList.tsx
import React from 'react';
import { useDuplicateStore, getFilteredGroups } from '../../stores/useDuplicateStore';
import { DuplicateGroupCard } from './DuplicateGroupCard';
import styles from './DuplicateGroupList.module.css';

export function DuplicateGroupList() {
  const state = useDuplicateStore();
  const groups = getFilteredGroups(state);
  const selectedGroupId = useDuplicateStore(s => s.selectedGroupId);
  const setSelectedGroupId = useDuplicateStore(s => s.setSelectedGroupId);

  // Sort by wasted bytes descending
  const sorted = [...groups].sort((a, b) => b.wastedBytes - a.wastedBytes);

  if (sorted.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Duplicate Groups</div>
        <div className={styles.empty}>No duplicate groups found</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Duplicate Groups ({sorted.length})</div>
      <div className={styles.list}>
        {sorted.map(group => (
          <DuplicateGroupCard
            key={group.id}
            group={group}
            isSelected={selectedGroupId === group.id}
            onClick={() => setSelectedGroupId(group.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write DuplicateGroupList.module.css**

```css
/* src/renderer/components/duplicate/DuplicateGroupList.module.css */
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.header {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  background: var(--bg-tertiary);
}

.list {
  flex: 1;
  overflow-y: auto;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 13px;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/duplicate/DuplicateGroupCard.tsx src/renderer/components/duplicate/DuplicateGroupCard.module.css src/renderer/components/duplicate/DuplicateGroupList.tsx src/renderer/components/duplicate/DuplicateGroupList.module.css
git commit -m "feat: add DuplicateGroupCard and DuplicateGroupList components"
```

---

### Task 12: ImageCompareGrid + FileCompareList + DuplicateDetail

**Files:**
- Create: `src/renderer/components/duplicate/ImageCompareGrid.tsx`
- Create: `src/renderer/components/duplicate/ImageCompareGrid.module.css`
- Create: `src/renderer/components/duplicate/FileCompareList.tsx`
- Create: `src/renderer/components/duplicate/FileCompareList.module.css`
- Create: `src/renderer/components/duplicate/DuplicateDetail.tsx`
- Create: `src/renderer/components/duplicate/DuplicateDetail.module.css`

- [ ] **Step 1: Write ImageCompareGrid.tsx**

```tsx
// src/renderer/components/duplicate/ImageCompareGrid.tsx
import React, { useEffect, useState } from 'react';
import type { DuplicateFile } from '../../types';
import { formatBytes } from '../../utils/format';
import styles from './ImageCompareGrid.module.css';

interface Props {
  files: DuplicateFile[];
}

interface PreviewData {
  path: string;
  data: string;
}

export function ImageCompareGrid({ files }: Props) {
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const loadPreviews = async () => {
      const newPreviews = new Map<string, string>();
      for (const file of files) {
        if (cancelled) return;
        try {
          const result = await window.api.getPreview(file.absPath);
          if (result.success && result.type === 'image') {
            newPreviews.set(file.path, result.data!);
          }
        } catch { /* skip */ }
      }
      if (!cancelled) setPreviews(newPreviews);
    };
    loadPreviews();
    return () => { cancelled = true; };
  }, [files]);

  const minSize = Math.min(...files.map(f => f.size));

  return (
    <div className={styles.grid}>
      {files.map(file => {
        const isSmallest = file.size === minSize;
        const preview = previews.get(file.path);
        return (
          <div key={file.path} className={`${styles.item} ${isSmallest ? styles.itemSmallest : ''}`}>
            <div className={styles.imageWrap}>
              {preview
                ? <img src={preview} alt={file.path} className={styles.image} />
                : <div className={styles.placeholder}>Loading...</div>
              }
            </div>
            <div className={styles.info}>
              <div className={styles.fileName}>{file.path.split('/').pop()}</div>
              {file.width != null && file.height != null && (
                <div className={styles.dimensions}>{file.width} x {file.height}</div>
              )}
              <div className={styles.fileSize}>{formatBytes(file.size)}</div>
              <div className={styles.filePath}>{file.path}</div>
            </div>
            {isSmallest && <div className={styles.smallestBadge}>Smallest</div>}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Write ImageCompareGrid.module.css**

```css
/* src/renderer/components/duplicate/ImageCompareGrid.module.css */
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px;
}

.item {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 180px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--bg-tertiary);
  transition: border-color var(--transition);
}
.itemSmallest {
  border-color: rgba(76, 175, 80, 0.5);
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.15);
}

.imageWrap {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.placeholder {
  color: var(--text-muted);
  font-size: 12px;
}

.info {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fileName {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dimensions {
  font-size: 11px;
  color: var(--text-secondary);
}

.fileSize {
  font-size: 11px;
  color: var(--text-secondary);
}

.filePath {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.smallestBadge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(76, 175, 80, 0.85);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.5px;
}
```

- [ ] **Step 3: Write FileCompareList.tsx**

```tsx
// src/renderer/components/duplicate/FileCompareList.tsx
import React, { useEffect, useState } from 'react';
import type { DuplicateFile } from '../../types';
import { formatBytes } from '../../utils/format';
import styles from './FileCompareList.module.css';

interface Props {
  files: DuplicateFile[];
}

export function FileCompareList({ files }: Props) {
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (files.length > 0) {
      window.api.getPreview(files[0].absPath).then(result => {
        if (!cancelled && result.success && result.type === 'text') {
          const content = result.data!;
          setPreviewContent(content.length > 5000 ? content.substring(0, 5000) + '\n\n... (truncated)' : content);
        }
      });
    }
    return () => { cancelled = true; };
  }, [files]);

  return (
    <div className={styles.container}>
      <div className={styles.fileList}>
        {files.map(file => (
          <div key={file.path} className={styles.fileRow}>
            <span className={styles.fileIcon}>&#128196;</span>
            <span className={styles.filePath}>{file.path}</span>
            <span className={styles.fileSize}>{formatBytes(file.size)}</span>
          </div>
        ))}
      </div>
      {previewContent && (
        <div className={styles.previewSection}>
          <div className={styles.previewHeader}>Content Preview</div>
          <pre className={styles.previewContent}>{previewContent}</pre>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write FileCompareList.module.css**

```css
/* src/renderer/components/duplicate/FileCompareList.module.css */
.container {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fileList {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fileRow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.fileIcon {
  font-size: 14px;
  flex-shrink: 0;
}

.filePath {
  flex: 1;
  font-family: var(--font-mono);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fileSize {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.previewSection {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.previewHeader {
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
}

.previewContent {
  padding: 10px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
```

- [ ] **Step 5: Write DuplicateDetail.tsx**

```tsx
// src/renderer/components/duplicate/DuplicateDetail.tsx
import React from 'react';
import { useDuplicateStore } from '../../stores/useDuplicateStore';
import { ImageCompareGrid } from './ImageCompareGrid';
import { FileCompareList } from './FileCompareList';
import { formatBytes } from '../../utils/format';
import styles from './DuplicateDetail.module.css';

export function DuplicateDetail() {
  const scanResult = useDuplicateStore(s => s.scanResult);
  const selectedGroupId = useDuplicateStore(s => s.selectedGroupId);

  const group = scanResult?.groups.find(g => g.id === selectedGroupId) ?? null;

  if (!group) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Detail</div>
        <div className={styles.empty}>Select a group to view details</div>
      </div>
    );
  }

  const totalSize = group.files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={`${styles.badge} ${group.matchType === 'exact' ? styles.badgeExact : styles.badgePerceptual}`}>
          {group.matchType === 'exact' ? 'Exact Match' : 'Perceptual Match'}
        </span>
        <span className={styles.meta}>
          {group.files.length} files &middot; {formatBytes(totalSize)} total &middot; {formatBytes(group.wastedBytes)} wasted
        </span>
        {group.matchType === 'perceptual' && (
          <span className={styles.meta}>
            Hamming: {group.hammingDistance} &middot; Similarity: {group.similarity}%
          </span>
        )}
      </div>
      <div className={styles.body}>
        {group.fileType === 'image'
          ? <ImageCompareGrid files={group.files} />
          : <FileCompareList files={group.files} />
        }
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write DuplicateDetail.module.css**

```css
/* src/renderer/components/duplicate/DuplicateDetail.module.css */
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.header {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-tertiary);
  flex-wrap: wrap;
}

.badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.5px;
}
.badgeExact {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
}
.badgePerceptual {
  background: rgba(245, 166, 35, 0.15);
  color: #f5a623;
}

.meta {
  font-size: 11px;
  color: var(--text-secondary);
}

.body {
  flex: 1;
  overflow-y: auto;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 13px;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/duplicate/ImageCompareGrid.tsx src/renderer/components/duplicate/ImageCompareGrid.module.css src/renderer/components/duplicate/FileCompareList.tsx src/renderer/components/duplicate/FileCompareList.module.css src/renderer/components/duplicate/DuplicateDetail.tsx src/renderer/components/duplicate/DuplicateDetail.module.css
git commit -m "feat: add DuplicateDetail, ImageCompareGrid, and FileCompareList components"
```

---

### Task 13: DuplicateSummary component

**Files:**
- Create: `src/renderer/components/duplicate/DuplicateSummary.tsx`
- Create: `src/renderer/components/duplicate/DuplicateSummary.module.css`

- [ ] **Step 1: Write DuplicateSummary.tsx**

```tsx
// src/renderer/components/duplicate/DuplicateSummary.tsx
import React from 'react';
import { useDuplicateStore } from '../../stores/useDuplicateStore';
import { formatBytes } from '../../utils/format';
import styles from './DuplicateSummary.module.css';

export function DuplicateSummary() {
  const stats = useDuplicateStore(s => s.scanResult?.stats);

  if (!stats) return null;

  const totalDuplicateFiles = useDuplicateStore(s =>
    s.scanResult?.groups.reduce((sum, g) => sum + g.files.length, 0) ?? 0
  );

  return (
    <div className={styles.bar}>
      <span>Total: {stats.totalGroups} groups</span>
      <span className={styles.sep}>&middot;</span>
      <span>{totalDuplicateFiles} files</span>
      <span className={styles.sep}>&middot;</span>
      <span>Exact: {stats.exactGroups}</span>
      <span className={styles.sep}>&middot;</span>
      <span>Perceptual: {stats.perceptualGroups}</span>
      <span className={styles.sep}>&middot;</span>
      <span className={styles.savings}>Potential savings: {formatBytes(stats.totalWastedBytes)}</span>
    </div>
  );
}
```

- [ ] **Step 2: Write DuplicateSummary.module.css**

```css
/* src/renderer/components/duplicate/DuplicateSummary.module.css */
.bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
}

.sep {
  color: var(--text-muted);
}

.savings {
  color: var(--accent);
  font-weight: 600;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/duplicate/DuplicateSummary.tsx src/renderer/components/duplicate/DuplicateSummary.module.css
git commit -m "feat: add DuplicateSummary stats bar component"
```

---

### Task 14: DuplicateSettingsPopup component

**Files:**
- Create: `src/renderer/components/duplicate/DuplicateSettingsPopup.tsx`
- Create: `src/renderer/components/duplicate/DuplicateSettingsPopup.module.css`

- [ ] **Step 1: Write DuplicateSettingsPopup.tsx**

```tsx
// src/renderer/components/duplicate/DuplicateSettingsPopup.tsx
import React from 'react';
import { useDuplicateStore } from '../../stores/useDuplicateStore';
import styles from './DuplicateSettingsPopup.module.css';

interface Props {
  onClose: () => void;
}

export function DuplicateSettingsPopup({ onClose }: Props) {
  const threshold = useDuplicateStore(s => s.threshold);
  const setThreshold = useDuplicateStore(s => s.setThreshold);

  return (
    <div className={styles.popup} onClick={e => e.stopPropagation()}>
      <div className={styles.header}>
        <span>Duplicate Scan Settings</span>
        <button className={styles.closeBtn} onClick={onClose}>{'\u2715'}</button>
      </div>
      <div className={styles.body}>
        <div className={styles.row}>
          <label className={styles.label}>Similarity Threshold (Hamming Distance)</label>
          <div className={styles.control}>
            <input
              className={styles.slider}
              type="range" min={0} max={10} step={1}
              value={threshold}
              onChange={e => setThreshold(parseInt(e.target.value))}
            />
            <span className={styles.value}>{threshold}</span>
          </div>
        </div>
        <div className={styles.hint}>
          0 = pixel-perfect only &middot; 5 = allows compression changes (default) &middot; 10 = broadly similar
        </div>
        <div className={styles.hint}>
          Lower values = fewer matches, higher precision. Higher values = more matches, may include false positives. Re-scan required after changing.
        </div>
        <div className={styles.footer}>
          <button className={styles.resetBtn} onClick={() => setThreshold(5)}>Reset to default (5)</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write DuplicateSettingsPopup.module.css**

Copy from SettingsPopup.module.css:

```bash
cp src/renderer/components/scanner/SettingsPopup.module.css src/renderer/components/duplicate/DuplicateSettingsPopup.module.css
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/duplicate/DuplicateSettingsPopup.tsx src/renderer/components/duplicate/DuplicateSettingsPopup.module.css
git commit -m "feat: add DuplicateSettingsPopup with threshold slider"
```

---

### Task 15: DuplicatePage — Main page component

**Files:**
- Create: `src/renderer/pages/DuplicatePage.tsx`
- Create: `src/renderer/pages/DuplicatePage.module.css`

- [ ] **Step 1: Write DuplicatePage.tsx**

```tsx
// src/renderer/pages/DuplicatePage.tsx
import React, { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useDuplicateStore } from '../stores/useDuplicateStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/common/Button';
import { StatusBar } from '../components/common/StatusBar';
import { DuplicateFilterBar } from '../components/duplicate/DuplicateFilterBar';
import { DuplicateGroupList } from '../components/duplicate/DuplicateGroupList';
import { DuplicateDetail } from '../components/duplicate/DuplicateDetail';
import { DuplicateProgress } from '../components/duplicate/DuplicateProgress';
import { DuplicateSettingsPopup } from '../components/duplicate/DuplicateSettingsPopup';
import { DuplicateSummary } from '../components/duplicate/DuplicateSummary';
import { formatBytes } from '../utils/format';
import styles from './DuplicatePage.module.css';

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

export function DuplicatePage() {
  const projectPath = useAppStore(s => s.projectPath);
  const navigateTo = useAppStore(s => s.navigateTo);

  const scanResult = useDuplicateStore(s => s.scanResult);
  const isScanning = useDuplicateStore(s => s.isScanning);
  const startScan = useDuplicateStore(s => s.startScan);
  const threshold = useDuplicateStore(s => s.threshold);

  const [showSettings, setShowSettings] = useState(false);
  const listPanelRef = useRef<HTMLDivElement>(null);

  const handleScan = () => {
    if (projectPath) {
      startScan(projectPath, threshold);
    }
  };

  const handleExport = () => {
    if (!scanResult) return;
    const lines = ['Group ID,Match Type,File Type,Similarity %,Hamming Distance,File Path,File Size,Width,Height,Wasted Bytes'];
    for (const group of scanResult.groups) {
      for (const file of group.files) {
        lines.push([
          group.id,
          group.matchType,
          group.fileType,
          group.similarity,
          group.hammingDistance,
          `"${file.path}"`,
          file.size,
          file.width ?? '',
          file.height ?? '',
          group.wastedBytes,
        ].join(','));
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'duplicate-scan-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResizerV = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = listPanelRef.current?.offsetWidth || 380;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newWidth = Math.max(200, Math.min(600, startWidth + dx));
      if (listPanelRef.current) listPanelRef.current.style.width = newWidth + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const statsText = scanResult
    ? `${scanResult.stats.totalFiles} files scanned \u00B7 ${scanResult.stats.totalGroups} groups found \u00B7 ${formatBytes(scanResult.stats.totalWastedBytes)} potential savings`
    : '';

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
        center={scanResult ? <DuplicateFilterBar /> : undefined}
        right={
          <>
            <Button variant="icon" onClick={handleScan} title="Rescan"><RescanIcon /></Button>
            <Button variant="icon" onClick={handleExport} title="Export CSV"><ExportIcon /></Button>
            <Button variant="icon" onClick={() => setShowSettings(!showSettings)} title="Settings"><SettingsIcon /></Button>
          </>
        }
      />

      {!scanResult && !isScanning ? (
        <div className={styles.startScanWrap}>
          <button className={styles.startScanBtn} onClick={handleScan}>Start Duplicate Scan</button>
          <span className={styles.startScanHint}>Scan for duplicate files using content hashing and image similarity</span>
        </div>
      ) : (
        <div className={styles.content}>
          <div ref={listPanelRef} className={styles.panelList}>
            <DuplicateGroupList />
          </div>
          <div className={styles.resizerV} onMouseDown={handleResizerV} />
          <div className={styles.panelDetail}>
            <DuplicateDetail />
          </div>
        </div>
      )}

      {scanResult && <DuplicateSummary />}

      <StatusBar
        text={isScanning ? 'Scanning for duplicates...' : scanResult ? 'Scan complete' : 'Ready'}
        stats={statsText}
      />

      <DuplicateProgress />

      {showSettings && <DuplicateSettingsPopup onClose={() => setShowSettings(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: Write DuplicatePage.module.css**

```css
/* src/renderer/pages/DuplicatePage.module.css */
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

.panelList {
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
.resizerV:hover::after {
  background: var(--accent);
  box-shadow: 0 0 8px rgba(245, 166, 35, 0.3);
}

.panelDetail {
  flex: 1;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

- [ ] **Step 3: Commit**

```bash
git add src/renderer/pages/DuplicatePage.tsx src/renderer/pages/DuplicatePage.module.css
git commit -m "feat: add DuplicatePage with full layout, export, and settings"
```

---

### Task 16: Build and verify

- [ ] **Step 1: Build the renderer**

```bash
cd c:/Users/Fresher/Desktop/BAT_MAN/check-unused_resource
npm run build
```

Expected: Build succeeds without TypeScript or compilation errors.

- [ ] **Step 2: Fix any build errors**

If there are TypeScript errors, fix them based on the error messages. Common issues:
- Missing imports
- Type mismatches between IPC data and TypeScript interfaces
- CSS module import issues

- [ ] **Step 3: Run the app**

```bash
npm run dev
```

Verify:
1. HomePage shows two cards: "Scan Unused Resources" and "Scan Duplicate Resources"
2. Clicking "Scan Duplicate Resources" navigates to DuplicatePage
3. "Start Duplicate Scan" button appears
4. Clicking it triggers the scan with progress overlay
5. Results show grouped duplicates in left panel
6. Clicking a group shows detail in right panel
7. Image groups show thumbnail grid
8. Non-image groups show file list with preview
9. Summary bar shows stats at bottom
10. Export CSV downloads correctly
11. Settings popup lets you adjust threshold

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors for duplicate scan feature"
```

---

### Task 17: Populate image dimensions for exact-match image groups

**Files:**
- Modify: `src/main/scanner/DuplicateScanner.js`

The exact-match image groups currently have `width: null` and `height: null`. We need to read dimensions using `sharp` for better display.

- [ ] **Step 1: Add dimension reading to exact image groups**

At the top of `src/main/scanner/DuplicateScanner.js`, add:

```javascript
const sharp = require('sharp');
```

After the `exactImageGroups` loop (where `allGroups.push(...)` for exact image groups), add a pass to populate dimensions:

```javascript
  // Populate dimensions for exact image groups
  for (const group of allGroups) {
    if (group.fileType === 'image') {
      for (const file of group.files) {
        if (file.width == null) {
          try {
            const meta = await sharp(file.absPath).metadata();
            file.width = meta.width || null;
            file.height = meta.height || null;
          } catch { /* skip */ }
        }
      }
    }
  }
```

Place this block right after the Phase 3 non-image processing (before Phase 4 aggregation).

- [ ] **Step 2: Commit**

```bash
git add src/main/scanner/DuplicateScanner.js
git commit -m "feat: populate image dimensions for exact-match groups"
```

---

### Task 18: Final integration test

- [ ] **Step 1: Full end-to-end test**

```bash
npm run build && npm run dev
```

Test checklist:
1. Open a Cocos project with `res/` directory
2. From HomePage, click "Scan Duplicate Resources"
3. Click "Start Duplicate Scan"
4. Verify progress overlay shows phase progression
5. After scan completes, verify left panel shows grouped duplicates sorted by wasted size
6. Click an image group → verify thumbnails display in right panel with dimensions and sizes
7. Click a non-image group → verify file list with content preview
8. Test filters: Images Only, Non-images Only, Exact, Perceptual
9. Test search bar
10. Test Export CSV → open the file and verify format
11. Test Settings → change threshold → rescan
12. Navigate Back → verify returns to HomePage
13. Test "Scan Unused Resources" still works correctly (no regression)

- [ ] **Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete duplicate resource detection feature"
```
