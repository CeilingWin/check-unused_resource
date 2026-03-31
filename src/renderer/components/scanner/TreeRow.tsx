import React from 'react';
import type { TreeNode, Resource } from '../../types';
import styles from './TreeView.module.css';

const ICON_MAP: Record<string, string> = {
  image: '\uD83D\uDDBC\uFE0F',
  audio: '\uD83D\uDD0A',
  json: '{}',
  'cocos-json': '{}',
  plist: '\uD83D\uDCCB',
  atlas: '\uD83D\uDDFA\uFE0F',
  font: '\uD83D\uDD24',
  shader: '\u2728',
  xml: '\uD83D\uDCC4',
  anim: '\uD83C\uDFAC',
  file: '\uD83D\uDCC4',
};

function getFileIcon(type: string): string {
  return ICON_MAP[type] || '\uD83D\uDCC4';
}

function countDirStatus(node: TreeNode): { total: number; unused: number } {
  let total = 0, unused = 0;
  if (!node.children) return { total, unused };
  for (const child of node.children.values()) {
    if (child.isDir) {
      const sub = countDirStatus(child);
      total += sub.total;
      unused += sub.unused;
    } else {
      total++;
      if (child.resource && !child.resource.used) unused++;
    }
  }
  return { total, unused };
}

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  isRoot?: boolean;
  selectedPath: string | null;
  onSelect: (resource: Resource) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode, type: 'file' | 'dir') => void;
}

const TreeRowComponent = React.memo(function TreeRowInner({ node, depth, isRoot, selectedPath, onSelect, onContextMenu }: TreeRowProps) {
  const [expanded, setExpanded] = React.useState(!!isRoot);

  if (node.isDir) {
    const counts = countDirStatus(node);
    const sorted = node.children
      ? Array.from(node.children.values()).sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
      : [];

    return (
      <div className={styles.node}>
        <div
          className={styles.row}
          onClick={() => setExpanded(!expanded)}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node, 'dir'); }}
        >
          {Array.from({ length: depth }, (_, i) => (
            <span key={i} className={styles.indent} />
          ))}
          <span className={`${styles.arrow}${expanded ? ' ' + styles.arrowExpanded : ''}`}>{'\u25B6'}</span>
          <span className={styles.icon}>{expanded ? '\uD83D\uDCC2' : '\uD83D\uDCC1'}</span>
          <span className={styles.name}>{node.name}</span>
          {counts.total > 0 && (
            <span className={styles.summary} title={`${counts.unused} unused of ${counts.total}`}>
              {counts.unused}/{counts.total}
            </span>
          )}
        </div>
        <div className={expanded ? styles.childrenExpanded : styles.children}>
          {sorted.map(child => (
            <TreeRowComponent
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      </div>
    );
  }

  // File node
  const resource = node.resource!;
  const isSelected = selectedPath === resource.path;

  return (
    <div className={styles.node}>
      <div
        className={`${styles.row}${isSelected ? ' ' + styles.rowSelected : ''}`}
        onClick={() => onSelect(resource)}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node, 'file'); }}
      >
        {Array.from({ length: depth }, (_, i) => (
          <span key={i} className={styles.indent} />
        ))}
        <span className={`${styles.arrow} ${styles.arrowHidden}`}>{'\u25B6'}</span>
        <span className={styles.icon}>{getFileIcon(resource.type)}</span>
        <span className={styles.name}>{node.name}</span>
        <span className={`${styles.status} ${resource.used ? styles.statusUsed : styles.statusUnused}`}>
          {resource.used ? '\u2713' : '\u2717'}
        </span>
      </div>
    </div>
  );
});

export { TreeRowComponent };
