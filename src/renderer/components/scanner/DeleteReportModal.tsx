import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { formatBytes } from '../../utils/format';
import type { DeleteResult } from '../../types';

interface DeleteReportModalProps {
  deleted: DeleteResult[];
  failed: DeleteResult[];
  onClose: () => void;
}

export function DeleteReportModal({ deleted, failed, onClose }: DeleteReportModalProps) {
  const totalDeleted = deleted.reduce((sum, r) => sum + (r.size || 0), 0);

  return (
    <Modal
      title="Deletion Report"
      large
      onClose={onClose}
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div style={{ padding: '14px 16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Deleted successfully</span>
          <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>{deleted.length} file{deleted.length !== 1 ? 's' : ''}</strong>
        </div>
        {failed.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Failed</span>
            <strong style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>{failed.length} file{failed.length !== 1 ? 's' : ''}</strong>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Space freed</span>
          <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatBytes(totalDeleted)}</strong>
        </div>
      </div>

      {deleted.length > 0 && (
        <>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>Deleted files:</div>
          <div style={{ maxHeight: '300px', overflowY: 'auto', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            {deleted.map(r => {
              const relPath = r.path.replace(/\\/g, '/');
              const displayPath = relPath.split('/res/').pop() || relPath;
              return (
                <div key={r.path} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '12px' }} title={relPath}>res/{displayPath}</span>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{formatBytes(r.size || 0)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {failed.length > 0 && (
        <>
          <div style={{ fontWeight: 600, margin: '10px 0 6px', color: 'var(--red)' }}>Failed to delete:</div>
          <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            {failed.map(r => (
              <div key={r.path} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px' }}>
                <span>{r.path.replace(/\\/g, '/')}</span>
                <span style={{ color: 'var(--red)' }}>{r.error}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
