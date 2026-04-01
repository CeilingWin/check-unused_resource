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
            <div className={styles.imageWrap}>
              {preview ? <img src={preview} alt={file.path} className={styles.image} /> : <div className={styles.placeholder}>Loading...</div>}
            </div>
            <div className={styles.info}>
              <div className={styles.fileName}>{file.path.split('/').pop()}</div>
              {file.width != null && file.height != null && <div className={styles.dimensions}>{file.width} x {file.height}</div>}
              <div className={styles.fileSize}>{formatBytes(file.size)}</div>
              <div className={styles.filePath}>{file.path}</div>
            </div>
            {isSmallest && <div className={styles.smallestBadge}>Smallest</div>}
          </div>
        );
      })}
    </div>
  );
}
