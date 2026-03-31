import React from 'react';
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'icon' | 'ghost' | 'danger';
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  return (
    <button className={`${styles[variant]}${className ? ' ' + className : ''}`} {...props}>
      {children}
    </button>
  );
}
