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
