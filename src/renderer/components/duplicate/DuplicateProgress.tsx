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
