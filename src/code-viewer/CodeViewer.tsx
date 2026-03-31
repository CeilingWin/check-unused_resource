import React, { useEffect, useState, useRef } from 'react';
import styles from './CodeViewer.module.css';

const TOKEN_RE = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(var|let|const|function|return|if|else|for|while|new|this|class|extends|import|export|from|true|false|null|undefined|typeof|instanceof)\b|\b(cc|sp|ccs)\b|\b(\d+(?:\.\d+)?)\b/gm;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightSyntax(escapedHtml: string): string {
  return escapedHtml.replace(TOKEN_RE, (match, comment, str, kw, ns, num) => {
    if (comment) return `<span class="syn-cmt">${comment}</span>`;
    if (str) return `<span class="syn-str">${str}</span>`;
    if (kw) return `<span class="syn-kw">${kw}</span>`;
    if (ns) return `<span class="syn-ns">${ns}</span>`;
    if (num) return `<span class="syn-num">${num}</span>`;
    return match;
  });
}

interface FileData {
  filePath: string;
  content: string;
  highlightLine: number | null;
  totalLines: number;
}

export function CodeViewer() {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.codeViewerAPI.onFileData((data) => {
      setFileData(data);
    });
  }, []);

  useEffect(() => {
    if (fileData?.highlightLine && highlightRef.current) {
      requestAnimationFrame(() => {
        highlightRef.current?.scrollIntoView({ block: 'center' });
      });
    }
  }, [fileData]);

  if (!fileData) {
    return <div className={styles.loading}>Loading...</div>;
  }

  const lines = fileData.content.split('\n');
  const padWidth = String(lines.length).length;

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.filePath}>{fileData.filePath}</span>
        <span className={styles.fileInfo}>{fileData.totalLines} lines</span>
      </div>
      <div className={styles.codeContainer}>
        <pre className={styles.codeContent}>
          {lines.map((line, i) => {
            const lineNum = i + 1;
            const isHighlight = lineNum === fileData.highlightLine;
            return (
              <div
                key={i}
                ref={isHighlight ? highlightRef : undefined}
                className={`${styles.line}${isHighlight ? ' ' + styles.lineHighlight : ''}`}
              >
                <span className={styles.lineNum}>{String(lineNum).padStart(padWidth)}</span>
                <span
                  className={styles.lineText}
                  dangerouslySetInnerHTML={{ __html: highlightSyntax(escapeHtml(line)) }}
                />
              </div>
            );
          })}
        </pre>
      </div>
    </>
  );
}
