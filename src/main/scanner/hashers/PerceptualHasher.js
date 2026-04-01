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
