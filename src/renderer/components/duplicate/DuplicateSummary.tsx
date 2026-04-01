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
