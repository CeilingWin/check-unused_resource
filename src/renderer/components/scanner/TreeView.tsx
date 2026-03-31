import React, { useMemo } from 'react';
import type { Resource, TreeNode } from '../../types';
import { useScannerStore, getFilteredResources } from '../../stores/useScannerStore';
import { TreeRowComponent } from './TreeRow';
import styles from './TreeView.module.css';

function buildTreeData(resourceList: Resource[]): TreeNode {
  const root: TreeNode = { name: 'res', children: new Map(), isDir: true, path: 'res' };

  for (const res of resourceList) {
    const parts = res.path.split('/');
    let current = root;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.children!.set(part, {
          name: part,
          isDir: false,
          resource: res,
          path: res.path,
        });
      } else {
        if (!current.children!.has(part)) {
          current.children!.set(part, {
            name: part,
            isDir: true,
            children: new Map(),
            path: parts.slice(0, i + 1).join('/'),
          });
        }
        current = current.children!.get(part)!;
      }
    }
  }

  return root;
}

interface TreeViewProps {
  onContextMenu: (e: React.MouseEvent, node: TreeNode, type: 'file' | 'dir') => void;
}

export function TreeView({ onContextMenu }: TreeViewProps) {
  const scanResult = useScannerStore(s => s.scanResult);
  const filterMode = useScannerStore(s => s.filterMode);
  const fileTypeFilter = useScannerStore(s => s.fileTypeFilter);
  const searchQuery = useScannerStore(s => s.searchQuery);
  const selectedFile = useScannerStore(s => s.selectedFile);
  const selectFile = useScannerStore(s => s.selectFile);

  const filteredResources = useMemo(
    () => getFilteredResources({ scanResult, filterMode, fileTypeFilter, searchQuery } as Parameters<typeof getFilteredResources>[0]),
    [scanResult, filterMode, fileTypeFilter, searchQuery]
  );

  const tree = useMemo(() => buildTreeData(filteredResources), [filteredResources]);

  return (
    <div className={styles.container}>
      <TreeRowComponent
        node={tree}
        depth={0}
        isRoot
        selectedPath={selectedFile?.path || null}
        onSelect={selectFile}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}
