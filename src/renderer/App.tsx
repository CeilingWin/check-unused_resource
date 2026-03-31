import React, { useEffect } from 'react';
import { useAppStore } from './stores/useAppStore';
import { FolderPickerPage } from './pages/FolderPickerPage';
import { HomePage } from './pages/HomePage';
import { ScannerPage } from './pages/ScannerPage';

export function App() {
  const currentPage = useAppStore(s => s.currentPage);
  const loadSettings = useAppStore(s => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  switch (currentPage) {
    case 'folder-picker':
      return <FolderPickerPage />;
    case 'home':
      return <HomePage />;
    case 'scanner':
      return <ScannerPage />;
    default:
      return <FolderPickerPage />;
  }
}
