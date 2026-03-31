import React, { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useScannerStore } from '../stores/useScannerStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/common/Button';
import { StatusBar } from '../components/common/StatusBar';
import { ContextMenu, MenuItem } from '../components/common/ContextMenu';
import { FilterBar } from '../components/scanner/FilterBar';
import { TreeView } from '../components/scanner/TreeView';
import { PreviewPanel } from '../components/scanner/PreviewPanel';
import { ReferencesPanel } from '../components/scanner/ReferencesPanel';
import { ScanProgress } from '../components/scanner/ScanProgress';
import { SettingsPopup } from '../components/scanner/SettingsPopup';
import { DeleteConfirmModal } from '../components/scanner/DeleteConfirmModal';
import { DeleteReportModal } from '../components/scanner/DeleteReportModal';
import type { TreeNode, Resource, DeleteResult } from '../types';
import styles from './ScannerPage.module.css';

// SVG icons for toolbar buttons (same as original)
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

function collectNodeFiles(node: TreeNode): Resource[] {
  const files: Resource[] = [];
  if (node.isDir && node.children) {
    for (const child of node.children.values()) {
      files.push(...collectNodeFiles(child));
    }
  } else if (node.resource) {
    files.push(node.resource);
  }
  return files;
}

export function ScannerPage() {
  const projectPath = useAppStore(s => s.projectPath);
  const settings = useAppStore(s => s.settings);
  const navigateTo = useAppStore(s => s.navigateTo);

  const scanResult = useScannerStore(s => s.scanResult);
  const isScanning = useScannerStore(s => s.isScanning);
  const startScan = useScannerStore(s => s.startScan);
  const deleteFilesAction = useScannerStore(s => s.deleteFiles);
  const removeDeletedFromResults = useScannerStore(s => s.removeDeletedFromResults);

  const [showSettings, setShowSettings] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode; type: 'file' | 'dir' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ resources: Resource[]; folderPath?: string } | null>(null);
  const [deleteReport, setDeleteReport] = useState<{ deleted: DeleteResult[]; failed: DeleteResult[] } | null>(null);

  const treePanelRef = useRef<HTMLDivElement>(null);
  const refPanelRef = useRef<HTMLDivElement>(null);

  const handleScan = () => {
    if (projectPath) {
      startScan(projectPath, settings.enableFilenameMatching);
    }
  };

  const handleExport = () => {
    if (!scanResult) return;
    const lines = ['Status,Path,Type,Size,References'];
    for (const res of scanResult.resourceList) {
      const status = res.used ? 'USED' : 'UNUSED';
      const refs = res.references.map(r => `${r.source}:${r.line}`).join('; ');
      lines.push(`${status},"${res.path}",${res.type},${res.size},"${refs}"`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resource-scan-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode, type: 'file' | 'dir') => {
    setContextMenu({ x: e.clientX, y: e.clientY, node, type });
  }, []);

  const handleContextAction = useCallback((action: string) => {
    if (!contextMenu) return;
    const { node, type } = contextMenu;

    if (action === 'delete-file' && type === 'file' && node.resource) {
      setDeleteConfirm({ resources: [node.resource] });
    } else if (action === 'delete-unused' && type === 'dir') {
      const files = collectNodeFiles(node);
      const unused = files.filter(f => !f.used);
      if (unused.length === 0) {
        alert('No unused files found in this folder.');
        return;
      }
      setDeleteConfirm({ resources: unused, folderPath: node.path });
    }
    setContextMenu(null);
  }, [contextMenu]);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const { deleted, failed } = await deleteFilesAction(deleteConfirm.resources);
    setDeleteConfirm(null);

    const deletedPaths = deleted.map(r => r.path);
    removeDeletedFromResults(deletedPaths);
    setDeleteReport({ deleted, failed });
  };

  // Horizontal resizer for tree panel
  const handleResizerV = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = treePanelRef.current?.offsetWidth || 380;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newWidth = Math.max(200, Math.min(800, startWidth + dx));
      if (treePanelRef.current) treePanelRef.current.style.width = newWidth + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Vertical resizer for reference panel
  const handleResizerH = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = refPanelRef.current?.offsetHeight || 260;

    const onMove = (ev: MouseEvent) => {
      const dy = startY - ev.clientY;
      const newHeight = Math.max(100, Math.min(500, startHeight + dy));
      if (refPanelRef.current) refPanelRef.current.style.height = newHeight + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const statsText = scanResult
    ? `${scanResult.stats.totalResources} total \u00B7 ${scanResult.stats.usedCount} used \u00B7 ${scanResult.stats.unusedCount} unused${scanResult.stats.filenameMatchCount ? ` \u00B7 ${scanResult.stats.filenameMatchCount} filename-matched` : ''}`
    : '';

  const contextMenuItems: MenuItem[] = [
    { label: '\uD83D\uDCCB View details', action: 'view-details' },
    { label: '\uD83D\uDDD1\uFE0F Delete this file', action: 'delete-file', danger: true, hidden: contextMenu?.type !== 'file' },
    { label: '\uD83D\uDDD1\uFE0F Delete unused resources', action: 'delete-unused', danger: true, hidden: contextMenu?.type !== 'dir' },
  ];

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
        center={scanResult ? <FilterBar /> : undefined}
        right={
          <>
            <Button variant="icon" onClick={handleScan} title="Rescan"><RescanIcon /></Button>
            <Button variant="icon" onClick={handleExport} title="Export report"><ExportIcon /></Button>
            <Button variant="icon" onClick={() => setShowSettings(!showSettings)} title="Settings"><SettingsIcon /></Button>
          </>
        }
      />

      {!scanResult && !isScanning ? (
        <div className={styles.startScanWrap}>
          <button className={styles.startScanBtn} onClick={handleScan}>Start Scan</button>
          <span className={styles.startScanHint}>Scan project resources to find unused files</span>
        </div>
      ) : (
        <div className={styles.content}>
          <div ref={treePanelRef} className={styles.panelTree}>
            <TreeView onContextMenu={handleContextMenu} />
          </div>
          <div className={styles.resizerV} onMouseDown={handleResizerV} />
          <div className={styles.panelDetail}>
            <PreviewPanel />
            <div className={styles.resizerH} onMouseDown={handleResizerH} />
            <div ref={refPanelRef}>
              <ReferencesPanel />
            </div>
          </div>
        </div>
      )}

      <StatusBar
        text={isScanning ? 'Scanning...' : scanResult ? 'Scan complete' : 'Ready'}
        stats={statsText}
      />

      <ScanProgress />

      {showSettings && <SettingsPopup onClose={() => setShowSettings(false)} />}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          resources={deleteConfirm.resources}
          folderPath={deleteConfirm.folderPath}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {deleteReport && (
        <DeleteReportModal
          deleted={deleteReport.deleted}
          failed={deleteReport.failed}
          onClose={() => setDeleteReport(null)}
        />
      )}
    </div>
  );
}
