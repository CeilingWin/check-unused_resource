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
        onChange={e => setFileTypeFilter(e.target.value as 'all' | 'image' | 'non-image')}
      >
        {FILE_TYPE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        className={styles.select}
        value={matchTypeFilter}
        onChange={e => setMatchTypeFilter(e.target.value as 'all' | 'exact' | 'perceptual')}
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
