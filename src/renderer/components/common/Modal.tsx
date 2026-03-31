import React from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  title: string;
  large?: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function Modal({ title, large, onClose, footer, children }: ModalProps) {
  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${styles.box}${large ? ' ' + styles.boxLarge : ''}`}>
        <div className={styles.header}>{title}</div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
