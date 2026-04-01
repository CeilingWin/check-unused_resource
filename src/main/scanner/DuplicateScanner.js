// src/main/scanner/DuplicateScanner.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
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

  // Phase 3.5: Populate dimensions for exact-match image groups (pHash groups already have width/height)
  const exactImageGroupsToEnrich = allGroups.filter(g => g.fileType === 'image' && g.matchType === 'exact');
  if (exactImageGroupsToEnrich.length > 0) {
    progress({ phase: 3, message: 'Reading image dimensions...', current: 0, total: exactImageGroupsToEnrich.length });
    for (let i = 0; i < exactImageGroupsToEnrich.length; i++) {
      const group = exactImageGroupsToEnrich[i];
      for (const file of group.files) {
        if (file.width == null) {
          try {
            const meta = await sharp(file.absPath).metadata();
            file.width = meta.width || null;
            file.height = meta.height || null;
          } catch (_) {
            // ignore metadata errors
          }
        }
      }
      progress({ phase: 3, message: `Reading image dimensions (${i + 1}/${exactImageGroupsToEnrich.length})...`, current: i + 1, total: exactImageGroupsToEnrich.length });
    }
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
