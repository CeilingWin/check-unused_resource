import React, { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Button } from '../components/common/Button';
import { timeAgo } from '../utils/format';
import styles from './FolderPickerPage.module.css';

export function FolderPickerPage() {
  const recentFolders = useAppStore(s => s.recentFolders);
  const openProject = useAppStore(s => s.openProject);
  const loadRecentFolders = useAppStore(s => s.loadRecentFolders);
  const removeRecentFolder = useAppStore(s => s.removeRecentFolder);

  useEffect(() => {
    loadRecentFolders();
  }, []);

  const handleSelectFolder = async () => {
    const result = await window.api.selectFolder();
    if (!result.success) {
      if (result.reason === 'invalid') {
        alert(result.message);
      }
      return;
    }
    openProject(result.path!);
  };

  const handleOpenRecent = (folderPath: string) => {
    openProject(folderPath);
  };

  const handleRemoveRecent = (e: React.MouseEvent, folderPath: string) => {
    e.stopPropagation();
    removeRecentFolder(folderPath);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon}>
          <svg viewBox="0 0 32 32" fill="none" width="32" height="32">
            <path d="M4 8c0-1.7 1.3-3 3-3h6l3 3h9c1.7 0 3 1.3 3 3v13c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3V8z" fill="rgba(255,255,255,0.9)"/>
            <path d="M4 12h24v12c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3V12z" fill="rgba(255,255,255,0.6)"/>
            <circle cx="16" cy="18" r="3" fill="rgba(255,255,255,0.4)"/>
          </svg>
        </div>
        <h1 className={styles.title}>Cocos Toolbox</h1>
        <p className={styles.desc}>Tools for managing your Cocos2d-JS game projects</p>
        <Button onClick={handleSelectFolder}>Select Project Folder</Button>
        <p className={styles.hint}>Folder must contain <code>res/</code> and <code>src/</code> directories</p>
      </div>

      {recentFolders.length > 0 && (
        <div className={styles.recentSection}>
          <div className={styles.recentTitle}>Recent Projects</div>
          {recentFolders.map(folder => (
            <div
              key={folder.path}
              className={styles.recentItem}
              onClick={() => handleOpenRecent(folder.path)}
            >
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className={styles.recentName}>{folder.name}</div>
                <div className={styles.recentPath}>{folder.path}</div>
              </div>
              <span className={styles.recentTime}>{timeAgo(folder.lastOpened)}</span>
              <button
                className={styles.removeBtn}
                onClick={(e) => handleRemoveRecent(e, folder.path)}
                title="Remove from recent"
              >
                {'\u2715'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
