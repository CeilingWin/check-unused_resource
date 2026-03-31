import React, { useState, useCallback } from 'react';
import type { Reference } from '../../types';
import { escapeHtml } from '../../utils/format';
import { highlightSyntax } from '../../utils/syntax';
import styles from './ReferenceItem.module.css';

const BADGE_MAP: Record<string, { cls: string; label: string }> = {
  json: { cls: styles.badgeJson, label: 'JSON' },
  plist: { cls: styles.badgePlist, label: 'PLIST' },
  'atlas-texture': { cls: styles.badgeAtlas, label: 'ATLAS' },
  'plist-texture': { cls: styles.badgePlist, label: 'PLIST' },
  'filename-match': { cls: styles.badgeFname, label: 'FNAME' },
};

interface ReferenceItemProps {
  reference: Reference;
  projectPath: string;
}

export function ReferenceItem({ reference, projectPath }: ReferenceItemProps) {
  const [copied, setCopied] = useState(false);

  const badge = BADGE_MAP[reference.type] || { cls: styles.badgeJs, label: 'JS' };

  const handleClick = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;

    if (reference.source && projectPath) {
      const fullPath = projectPath + '/' + reference.source;
      window.api.openCodeViewer(fullPath, reference.line || 0);
    }
  }, [reference, projectPath]);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const texts: string[] = [];
    if (reference.context) {
      reference.context.forEach(entry => texts.push(entry.text));
    } else if (reference.snippet) {
      texts.push(reference.snippet);
    }
    navigator.clipboard.writeText(texts.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [reference]);

  const renderCodeBlock = () => {
    if (reference.context && reference.context.length > 0) {
      return reference.context.map((entry, i) => {
        const lineNumStr = entry.lineNum != null ? String(entry.lineNum).padStart(4) : '    ';
        const isHighlight = entry.highlight;
        const isGap = entry.lineNum == null;
        const syntaxText = highlightSyntax(escapeHtml(entry.text));
        const classes = [styles.codeLine];
        if (isHighlight) classes.push(styles.codeLineHighlight);
        if (isGap) classes.push(styles.codeLineGap);

        return (
          <div key={i} className={classes.join(' ')}>
            <span className={styles.codeLinenum}>{lineNumStr}</span>
            <span className={styles.codeText} dangerouslySetInnerHTML={{ __html: syntaxText }} />
          </div>
        );
      });
    }

    const syntaxSnippet = highlightSyntax(escapeHtml(reference.snippet || ''));
    const lineNumStr = reference.line ? String(reference.line).padStart(4) : '    ';
    return (
      <div className={`${styles.codeLine} ${styles.codeLineHighlight}`}>
        <span className={styles.codeLinenum}>{lineNumStr}</span>
        <span className={styles.codeText} dangerouslySetInnerHTML={{ __html: syntaxSnippet }} />
      </div>
    );
  };

  return (
    <div className={styles.item} onClick={handleClick} title="Click to view source file">
      <div className={styles.source}>
        <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
        <span className={styles.file}>{reference.source}</span>
        {reference.line && <span className={styles.line}>:{reference.line}</span>}
        <button
          className={`${styles.copyBtn}${copied ? ' ' + styles.copiedBtn : ''}`}
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? '\u2713' : '\u29C9'}
        </button>
      </div>
      <pre className={styles.codeBlock}>
        {renderCodeBlock()}
      </pre>
    </div>
  );
}
