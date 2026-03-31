import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { formatBytes } from '../../utils/format';
import type { Resource } from '../../types';

interface DeleteConfirmModalProps {
  resources: Resource[];
  folderPath?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({ resources, folderPath, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const totalSize = resources.reduce((sum, f) => sum + (f.size || 0), 0);
  const isSingle = resources.length === 1;

  return (
    <Modal
      title="Confirm Delete"
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Delete</Button>
        </>
      }
    >
      {isSingle ? (
        <>
          <p>Are you sure you want to delete this file?</p>
          <p><strong style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{resources[0].path}</strong></p>
          <p>Size: <strong>{formatBytes(resources[0].size)}</strong></p>
        </>
      ) : (
        <>
          <p>Delete <strong style={{ color: 'var(--red)' }}>{resources.length}</strong> unused file{resources.length !== 1 ? 's' : ''}{folderPath ? ` in ${folderPath}` : ''}?</p>
          <p>Total size: <strong>{formatBytes(totalSize)}</strong></p>
        </>
      )}
      <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>This action cannot be undone.</p>
    </Modal>
  );
}
