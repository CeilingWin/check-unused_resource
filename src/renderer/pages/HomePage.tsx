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
            <span className={styles.projectPath}>
              {projectPath}
            </span>
          </>
        }
        right={
          <button className={styles.closeProjectBtn} onClick={closeProject} title="Close project">
            <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
              <path d="M2 8h8M7 5l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Close Project
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
