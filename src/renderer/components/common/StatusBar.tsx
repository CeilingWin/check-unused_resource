import React from 'react';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  text: string;
  stats?: string;
}

export function StatusBar({ text, stats }: StatusBarProps) {
  return (
    <div className={styles.statusbar}>
      <span>{text}</span>
      {stats && <span className={styles.stats}>{stats}</span>}
    </div>
  );
}
