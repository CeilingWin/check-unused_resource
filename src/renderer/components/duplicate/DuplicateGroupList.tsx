// src/renderer/components/duplicate/DuplicateGroupList.tsx
import React from 'react';
import { useDuplicateStore, getFilteredGroups } from '../../stores/useDuplicateStore';
import { DuplicateGroupCard } from './DuplicateGroupCard';
import styles from './DuplicateGroupList.module.css';

export function DuplicateGroupList() {
  const state = useDuplicateStore();
  const groups = getFilteredGroups(state);
  const selectedGroupId = useDuplicateStore(s => s.selectedGroupId);
  const setSelectedGroupId = useDuplicateStore(s => s.setSelectedGroupId);
  const sorted = [...groups].sort((a, b) => b.wastedBytes - a.wastedBytes);

  if (sorted.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Duplicate Groups</div>
        <div className={styles.empty}>No duplicate groups found</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Duplicate Groups ({sorted.length})</div>
      <div className={styles.list}>
        {sorted.map(group => (
          <DuplicateGroupCard
            key={group.id}
            group={group}
            isSelected={selectedGroupId === group.id}
            onClick={() => setSelectedGroupId(group.id)}
          />
        ))}
      </div>
    </div>
  );
}
