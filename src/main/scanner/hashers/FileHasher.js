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
