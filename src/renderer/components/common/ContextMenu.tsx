import React, { useEffect, useRef } from 'react';
import styles from './ContextMenu.module.css';

export interface MenuItem {
  label: string;
  action: string;
  danger?: boolean;
  hidden?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onAction: (action: string) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onAction, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = () => onClose();
    const handleBlur = () => onClose();
    document.addEventListener('click', handleClick);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  let posX = x;
  let posY = y;
  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect();
    if (posX + rect.width > window.innerWidth) posX = window.innerWidth - rect.width - 4;
    if (posY + rect.height > window.innerHeight) posY = window.innerHeight - rect.height - 4;
  }

  const visibleItems = items.filter(item => !item.hidden);

  return (
    <div ref={menuRef} className={styles.menu} style={{ left: posX, top: posY }}>
      {visibleItems.map(item => (
        <div
          key={item.action}
          className={`${styles.item}${item.danger ? ' ' + styles.itemDanger : ''}`}
          onClick={(e) => { e.stopPropagation(); onAction(item.action); onClose(); }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
