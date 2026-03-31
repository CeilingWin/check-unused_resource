import React from 'react';
import { useScannerStore } from '../../stores/useScannerStore';
import styles from './ScanProgress.module.css';

export function ScanProgress() {
  const isScanning = useScannerStore(s => s.isScanning);
  const progress = useScannerStore(s => s.scanProgress);

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
