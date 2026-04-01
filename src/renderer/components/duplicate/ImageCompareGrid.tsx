// src/renderer/components/duplicate/ImageCompareGrid.tsx
import React, { useEffect, useState } from 'react';
import type { DuplicateFile } from '../../types';
import { formatBytes } from '../../utils/format';
import styles from './ImageCompareGrid.module.css';

interface Props { files: DuplicateFile[]; }

export function ImageCompareGrid({ files }: Props) {
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const loadPreviews = async () => {
      const newPreviews = new Map<string, string>();
      for (const file of files) {
        if (cancelled) return;
        try {
          const result = await window.api.getPreview(file.absPath);
          if (result.success && result.type === 'image') newPreviews.set(file.path, result.data!);
        } catch { /* skip */ }
      }
      if (!cancelled) setPreviews(newPreviews);
    };
    loadPreviews();
    return () => { cancelled = true; };
  }, [files]);

  const minSize = Math.min(...files.map(f => f.size));

  return (
    <div className={styles.grid}>
      {files.map(file => {
        const isSmallest = file.size === minSize;
        const preview = previews.get(file.path);
        return (
          <div key={file.path} className={`${styles.item} ${isSmallest ? styles.itemSmallest : ''}`}>
            {isSmallest && <div className={styles.smallestBadge}>Smallest</div>}
            <div className={styles.imageWrap}>
              {preview
                ? <img src={preview} alt={file.path} className={styles.image} />
                : <div className={styles.placeholder}>Loading...</div>
              }
            </div>
            <div className={styles.info}>
              <div className={styles.fileName} title={file.path}>{file.path.split('/').pop()}</div>
              {file.width != null && file.height != null && (
                <div className={styles.dimensions}>{file.width} × {file.height}px</div>
              )}
              <div className={styles.fileSize}>{formatBytes(file.size)}</div>
              <div className={styles.filePath} title={file.absPath}>{file.path}</div>
            </div>
            <button
              className={styles.revealBtn}
              title="Show in File Explorer"
              onClick={() => window.api.showItemInFolder(file.absPath)}
            >
              <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
                <rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M1 7h14" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M1 6.5l3-2.5h3l1 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
              Show in Explorer
            </button>
          </div>
        );
      })}
    </div>
  );
}
