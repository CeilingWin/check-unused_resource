import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import styles from './SettingsPopup.module.css';

interface SettingsPopupProps {
  onClose: () => void;
}

export function SettingsPopup({ onClose }: SettingsPopupProps) {
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);

  const handleReset = () => {
    updateSettings({ fontSize: 13, codeFontSize: 11, enableFilenameMatching: false });
  };

  return (
    <div className={styles.popup} onClick={e => e.stopPropagation()}>
      <div className={styles.header}>
        <span>Settings</span>
        <button className={styles.closeBtn} onClick={onClose}>{'\u2715'}</button>
      </div>
      <div className={styles.body}>
        <div className={styles.row}>
          <label className={styles.label}>Font size</label>
          <div className={styles.control}>
            <button className={styles.sizeBtn} onClick={() => updateSettings({ fontSize: Math.max(11, settings.fontSize - 1) })}>{'\u2212'}</button>
            <input
              className={styles.slider}
              type="range" min={11} max={20} step={1}
              value={settings.fontSize}
              onChange={e => updateSettings({ fontSize: parseInt(e.target.value) })}
            />
            <button className={styles.sizeBtn} onClick={() => updateSettings({ fontSize: Math.min(20, settings.fontSize + 1) })}>+</button>
            <span className={styles.sizeValue}>{settings.fontSize}px</span>
          </div>
        </div>
        <div className={styles.row}>
          <label className={styles.label}>Code font size</label>
          <div className={styles.control}>
            <button className={styles.sizeBtn} onClick={() => updateSettings({ codeFontSize: Math.max(9, settings.codeFontSize - 1) })}>{'\u2212'}</button>
            <input
              className={styles.slider}
              type="range" min={9} max={18} step={1}
              value={settings.codeFontSize}
              onChange={e => updateSettings({ codeFontSize: parseInt(e.target.value) })}
            />
            <button className={styles.sizeBtn} onClick={() => updateSettings({ codeFontSize: Math.min(18, settings.codeFontSize + 1) })}>+</button>
            <span className={styles.sizeValue}>{settings.codeFontSize}px</span>
          </div>
        </div>
        <hr className={styles.divider} />
        <div className={styles.sectionTitle}>Scan Options</div>
        <div className={styles.row}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={settings.enableFilenameMatching}
              onChange={e => updateSettings({ enableFilenameMatching: e.target.checked })}
            />
            <span>Match by filename in strings</span>
          </label>
        </div>
        <div className={styles.hint}>
          Mark resources as used if their filename (without extension) appears inside a string literal in source code. Re-scan required after changing.
        </div>
        <div className={styles.footer}>
          <button className={styles.resetBtn} onClick={handleReset}>Reset defaults</button>
        </div>
      </div>
    </div>
  );
}
