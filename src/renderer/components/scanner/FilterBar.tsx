import React from 'react';
import { useScannerStore } from '../../stores/useScannerStore';
import styles from './FilterBar.module.css';

const FILTERS = [
  { label: 'All', value: 'all' as const },
  { label: '\u2713 Used', value: 'used' as const },
  { label: '\u2717 Unused', value: 'unused' as const },
];

const TYPE_OPTIONS = [
  { label: 'All Types', value: 'all' },
  { label: 'Images', value: 'image' },
  { label: 'Audio', value: 'audio' },
  { label: 'JSON', value: 'json' },
  { label: 'Plist', value: 'plist' },
  { label: 'Atlas', value: 'atlas' },
  { label: 'Fonts', value: 'font' },
  { label: 'Shaders', value: 'shader' },
  { label: 'Other', value: 'file' },
];

export function FilterBar() {
  const filterMode = useScannerStore(s => s.filterMode);
  const fileTypeFilter = useScannerStore(s => s.fileTypeFilter);
  const searchQuery = useScannerStore(s => s.searchQuery);
  const setFilterMode = useScannerStore(s => s.setFilterMode);
  const setFileTypeFilter = useScannerStore(s => s.setFileTypeFilter);
  const setSearchQuery = useScannerStore(s => s.setSearchQuery);

  return (
    <div className={styles.bar}>
      {FILTERS.map(f => (
        <button
          key={f.value}
          className={`${styles.filterBtn}${filterMode === f.value ? ' ' + styles.filterBtnActive : ''}`}
          onClick={() => setFilterMode(f.value)}
        >
          {f.label}
        </button>
      ))}
      <span className={styles.divider} />
      <select
        className={styles.select}
        value={fileTypeFilter}
        onChange={e => setFileTypeFilter(e.target.value)}
      >
        {TYPE_OPTIONS.map(o => (
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
