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
        {group.fileType === 'image' ? <ImageCompareGrid files={group.files} /> : <FileCompareList files={group.files} />}
      </div>
    </div>
  );
}
