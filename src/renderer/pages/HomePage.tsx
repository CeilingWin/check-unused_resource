import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import { PageHeader } from '../components/layout/PageHeader';
import styles from './HomePage.module.css';

const TOOLS = [
  {
    id: 'scanner' as const,
    icon: '\uD83D\uDD0D',
    iconBg: 'var(--surface-orange)',
    name: 'Scan Unused Resources',
    desc: 'Find and clean up unused resources in your project',
  },
  // Future tools go here
];

export function HomePage() {
  const projectPath = useAppStore(s => s.projectPath);
  const navigateTo = useAppStore(s => s.navigateTo);
  const closeProject = useAppStore(s => s.closeProject);

  return (
    <div className={styles.page}>
      <PageHeader
        left={
          <>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Cocos Toolbox</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)', marginLeft: '8px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {projectPath}
            </span>
          </>
        }
        right={
          <button className={styles.changeFolderBtn} onClick={closeProject}>
            Change Folder
          </button>
        }
      />
      <div className={styles.content}>
        <div className={styles.grid}>
          {TOOLS.map(tool => (
            <div
              key={tool.id}
              className={styles.toolCard}
              onClick={() => navigateTo(tool.id)}
            >
              <div className={styles.toolIcon} style={{ background: tool.iconBg }}>
                {tool.icon}
              </div>
              <div className={styles.toolName}>{tool.name}</div>
              <div className={styles.toolDesc}>{tool.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
