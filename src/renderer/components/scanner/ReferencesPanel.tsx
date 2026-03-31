import React from 'react';
import { useScannerStore } from '../../stores/useScannerStore';
import { useAppStore } from '../../stores/useAppStore';
import { ReferenceItem } from './ReferenceItem';
import styles from './ReferencesPanel.module.css';

export function ReferencesPanel() {
  const selectedFile = useScannerStore(s => s.selectedFile);
  const projectPath = useAppStore(s => s.projectPath);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>References</div>
      <div className={styles.body}>
        {!selectedFile && <div className={styles.empty}>Select a file to see references</div>}
        {selectedFile && (!selectedFile.references || selectedFile.references.length === 0) && (
          <div className={`${styles.empty} ${styles.noRefs}`}>
            {'\u2717'} No references found — this resource appears unused
          </div>
        )}
        {selectedFile && selectedFile.references && selectedFile.references.length > 0 && (
          selectedFile.references.map((ref, i) => (
            <ReferenceItem key={`${ref.source}-${ref.line}-${i}`} reference={ref} projectPath={projectPath || ''} />
          ))
        )}
      </div>
    </div>
  );
}
