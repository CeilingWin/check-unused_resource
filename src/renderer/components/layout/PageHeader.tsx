import React from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}

export function PageHeader({ left, center, right }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      {left && <div className={styles.left}>{left}</div>}
      {center && <div className={styles.center}>{center}</div>}
      {right && <div className={styles.right}>{right}</div>}
    </div>
  );
}
