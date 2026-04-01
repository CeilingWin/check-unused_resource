// src/renderer/pages/DuplicatePage.tsx
import React, { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useDuplicateStore } from '../stores/useDuplicateStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/common/Button';
import { StatusBar } from '../components/common/StatusBar';
import { DuplicateFilterBar } from '../components/duplicate/DuplicateFilterBar';
import { DuplicateGroupList } from '../components/duplicate/DuplicateGroupList';
import { DuplicateDetail } from '../components/duplicate/DuplicateDetail';
import { DuplicateProgress } from '../components/duplicate/DuplicateProgress';
import { DuplicateSettingsPopup } from '../components/duplicate/DuplicateSettingsPopup';
import { DuplicateSummary } from '../components/duplicate/DuplicateSummary';
import { formatBytes } from '../utils/format';
import styles from './DuplicatePage.module.css';

const RescanIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
    <path d="M14.5 4.5A7 7 0 004 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M5.5 15.5A7 7 0 0016 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M4 3v4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 17v-4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ExportIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
    <rect x="3" y="3" width="14" height="14" rx="2" fill="currentColor" opacity="0.2"/>
    <path d="M10 6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M7 9l3-3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 14h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const SettingsIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
    <circle cx="10" cy="10" r="3" fill="currentColor"/>
    <path d="M10 2a1.5 1.5 0 011.5 1.5v.6a6 6 0 012 1.15l.5-.3a1.5 1.5 0 012 .55l0 0a1.5 1.5 0 01-.55 2l-.5.3a6 6 0 010 2.3l.5.3a1.5 1.5 0 01.55 2l0 0a1.5 1.5 0 01-2 .55l-.5-.3a6 6 0 01-2 1.15v.6A1.5 1.5 0 0110 18h0a1.5 1.5 0 01-1.5-1.5v-.6a6 6 0 01-2-1.15l-.5.3a1.5 1.5 0 01-2-.55l0 0a1.5 1.5 0 01.55-2l.5-.3a6 6 0 010-2.3l-.5-.3a1.5 1.5 0 01-.55-2l0 0a1.5 1.5 0 012-.55l.5.3a6 6 0 012-1.15v-.6A1.5 1.5 0 0110 2z" fill="currentColor" opacity="0.35"/>
  </svg>
);
const BackIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
    <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function DuplicatePage() {
  const projectPath = useAppStore(s => s.projectPath);
  const navigateTo = useAppStore(s => s.navigateTo);

  const scanResult = useDuplicateStore(s => s.scanResult);
  const isScanning = useDuplicateStore(s => s.isScanning);
  const startScan = useDuplicateStore(s => s.startScan);
  const threshold = useDuplicateStore(s => s.threshold);

  const [showSettings, setShowSettings] = useState(false);
  const listPanelRef = useRef<HTMLDivElement>(null);

  const handleScan = () => {
    if (projectPath) {
      startScan(projectPath, threshold);
    }
  };

  const handleExport = () => {
    if (!scanResult) return;
    const lines = ['Group ID,Match Type,File Type,Similarity %,Hamming Distance,File Path,File Size,Width,Height,Wasted Bytes'];
    for (const group of scanResult.groups) {
      for (const file of group.files) {
        lines.push([
          group.id,
          group.matchType,
          group.fileType,
          group.similarity,
          group.hammingDistance,
          `"${file.path}"`,
          file.size,
          file.width ?? '',
          file.height ?? '',
          group.wastedBytes,
        ].join(','));
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'duplicate-scan-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResizerV = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = listPanelRef.current?.offsetWidth || 380;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newWidth = Math.max(200, Math.min(600, startWidth + dx));
      if (listPanelRef.current) listPanelRef.current.style.width = newWidth + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const statsText = scanResult
    ? `${scanResult.stats.totalFiles} files scanned \u00B7 ${scanResult.stats.totalGroups} groups found \u00B7 ${formatBytes(scanResult.stats.totalWastedBytes)} potential savings`
    : '';

  return (
    <div className={styles.page}>
      <PageHeader
        left={
          <>
            <Button variant="icon" onClick={() => navigateTo('home')} title="Back to Home"><BackIcon /></Button>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {projectPath}
            </span>
          </>
        }
        center={scanResult ? <DuplicateFilterBar /> : undefined}
        right={
          <>
            <Button variant="icon" onClick={handleScan} title="Rescan"><RescanIcon /></Button>
            <Button variant="icon" onClick={handleExport} title="Export CSV"><ExportIcon /></Button>
            <Button variant="icon" onClick={() => setShowSettings(!showSettings)} title="Settings"><SettingsIcon /></Button>
          </>
        }
      />

      {!scanResult && !isScanning ? (
        <div className={styles.startScanWrap}>
          <button className={styles.startScanBtn} onClick={handleScan}>Start Duplicate Scan</button>
          <span className={styles.startScanHint}>Scan for duplicate files using content hashing and image similarity</span>
        </div>
      ) : (
        <div className={styles.content}>
          <div ref={listPanelRef} className={styles.panelList}>
            <DuplicateGroupList />
          </div>
          <div className={styles.resizerV} onMouseDown={handleResizerV} />
          <div className={styles.panelDetail}>
            <DuplicateDetail />
          </div>
        </div>
      )}

      {scanResult && <DuplicateSummary />}

      <StatusBar
        text={isScanning ? 'Scanning for duplicates...' : scanResult ? 'Scan complete' : 'Ready'}
        stats={statsText}
      />

      <DuplicateProgress />

      {showSettings && <DuplicateSettingsPopup onClose={() => setShowSettings(false)} />}
    </div>
  );
}
