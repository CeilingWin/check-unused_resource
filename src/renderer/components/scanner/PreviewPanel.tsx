import React, { useEffect, useState } from 'react';
import { useScannerStore } from '../../stores/useScannerStore';
import { formatBytes } from '../../utils/format';
import styles from './PreviewPanel.module.css';

interface PreviewData {
  type: string;
  data: string;
  size: number;
  fileName: string;
}

export function PreviewPanel() {
  const selectedFile = useScannerStore(s => s.selectedFile);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    window.api.getPreview(selectedFile.absPath).then(result => {
      if (cancelled) return;
      setLoading(false);
      if (!result.success) {
        setError(result.message || 'Cannot preview');
      } else {
        setPreview({
          type: result.type!,
          data: result.data!,
          size: result.size!,
          fileName: result.fileName!,
        });
      }
    });

    return () => { cancelled = true; };
  }, [selectedFile?.absPath]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Preview</div>
      <div className={styles.body}>
        {!selectedFile && <div className={styles.empty}>Select a file to preview</div>}
        {loading && <div className={styles.empty}>Loading...</div>}
        {error && <div className={styles.empty}>Cannot preview: {error}</div>}
        {preview && preview.type === 'image' && (
          <div className={styles.imageWrap}>
            <img src={preview.data} alt={preview.fileName} />
            <div className={styles.imageInfo}>{preview.fileName} &middot; {formatBytes(preview.size)}</div>
          </div>
        )}
        {preview && preview.type === 'audio' && (
          <div className={styles.audioWrap}>
            <div>
              <div className={styles.audioInfo}>{preview.fileName} &middot; {formatBytes(preview.size)}</div>
              <audio controls src={`file://${preview.data.replace(/\\/g, '/')}`} />
            </div>
          </div>
        )}
        {preview && preview.type === 'text' && (
          <pre className={styles.textPreview}>
            {preview.data.length > 50000 ? preview.data.substring(0, 50000) + '\n\n... (truncated)' : preview.data}
          </pre>
        )}
      </div>
    </div>
  );
}
