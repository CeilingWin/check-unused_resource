import React from 'react';
import { createRoot } from 'react-dom/client';
import { CodeViewer } from './CodeViewer';
import './CodeViewer.module.css';

const root = createRoot(document.getElementById('root')!);
root.render(<CodeViewer />);
