// src/renderer/components/duplicate/DuplicateSettingsPopup.tsx
import React from 'react';
import { useDuplicateStore } from '../../stores/useDuplicateStore';
import styles from './DuplicateSettingsPopup.module.css';

interface Props { onClose: () => void; }

export function DuplicateSettingsPopup({ onClose }: Props) {
  const threshold = useDuplicateStore(s => s.threshold);
  const setThreshold = useDuplicateStore(s => s.setThreshold);

  return (
    <div className={styles.popup} onClick={e => e.stopPropagation()}>
      <div className={styles.header}>
        <span>Duplicate Scan Settings</span>
        <button className={styles.closeBtn} onClick={onClose}>{'\u2715'}</button>
      </div>
      <div className={styles.body}>
        <div className={styles.row}>
          <label className={styles.label}>Similarity Threshold (Hamming Distance)</label>
          <div className={styles.control}>
            <input
              className={styles.slider}
              type="range" min={0} max={10} step={1}
              value={threshold}
              onChange={e => setThreshold(parseInt(e.target.value))}
            />
            <span className={styles.value}>{threshold}</span>
          </div>
        </div>
        <div className={styles.hint}>
          0 = pixel-perfect only &middot; 5 = allows compression changes (default) &middot; 10 = broadly similar
        </div>
        <div className={styles.hint}>
          Lower values = fewer matches, higher precision. Higher values = more matches, may include false positives. Re-scan required after changing.
        </div>
        <div className={styles.footer}>
          <button className={styles.resetBtn} onClick={() => setThreshold(5)}>Reset to default (5)</button>
        </div>
      </div>
    </div>
  );
}
