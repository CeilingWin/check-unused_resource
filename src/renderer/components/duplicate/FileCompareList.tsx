// src/renderer/components/duplicate/FileCompareList.tsx
import React, { useEffect, useState } from 'react';
import type { DuplicateFile } from '../../types';
import { formatBytes } from '../../utils/format';
import styles from './FileCompareList.module.css';

interface Props { files: DuplicateFile[]; }

export function FileCompareList({ files }: Props) {
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (files.length > 0) {
      window.api.getPreview(files[0].absPath).then(result => {
        if (!cancelled && result.success && result.type === 'text') {
          const content = result.data!;
          setPreviewContent(content.length > 5000 ? content.substring(0, 5000) + '\n\n... (truncated)' : content);
        }
      });
    }
    return () => { cancelled = true; };
  }, [files]);

  return (
    <div className={styles.container}>
      <div className={styles.fileList}>
        {files.map(file => (
          <div key={file.path} className={styles.fileRow}>
            <span className={styles.fileIcon}>&#128196;</span>
            <span className={styles.filePath}>{file.path}</span>
            <span className={styles.fileSize}>{formatBytes(file.size)}</span>
          </div>
        ))}
      </div>
      {previewContent && (
        <div className={styles.previewSection}>
          <div className={styles.previewHeader}>Content Preview</div>
          <pre className={styles.previewContent}>{previewContent}</pre>
        </div>
      )}
    </div>
  );
}
