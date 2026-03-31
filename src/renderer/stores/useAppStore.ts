import { create } from 'zustand';
import type { PageName, RecentFolder, AppSettings } from '../types';

interface AppState {
  currentPage: PageName;
  projectPath: string | null;
  recentFolders: RecentFolder[];
  settings: AppSettings;

  navigateTo: (page: PageName) => void;
  openProject: (folderPath: string) => Promise<void>;
  closeProject: () => void;
  loadRecentFolders: () => Promise<void>;
  removeRecentFolder: (folderPath: string) => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 'folder-picker',
  projectPath: null,
  recentFolders: [],
  settings: {
    fontSize: 13,
    codeFontSize: 11,
    enableFilenameMatching: false,
  },

  navigateTo: (page) => set({ currentPage: page }),

  openProject: async (folderPath) => {
    const name = folderPath.split(/[\\/]/).pop() || folderPath;
    await window.api.addRecentFolder({ path: folderPath, name });
    const folders = await window.api.getRecentFolders();
    set({
      projectPath: folderPath,
      currentPage: 'home',
      recentFolders: folders,
    });
  },

  closeProject: () => {
    set({
      projectPath: null,
      currentPage: 'folder-picker',
    });
  },

  loadRecentFolders: async () => {
    const folders = await window.api.getRecentFolders();
    set({ recentFolders: folders });
  },

  removeRecentFolder: async (folderPath) => {
    const folders = await window.api.removeRecentFolder(folderPath);
    set({ recentFolders: folders });
  },

  loadSettings: async () => {
    const settings = await window.api.getSettings();
    set({ settings });
    applyFontSettings(settings);
  },

  updateSettings: async (partial) => {
    const current = get().settings;
    const updated = { ...current, ...partial };
    set({ settings: updated });
    await window.api.saveSettings(updated);
    applyFontSettings(updated);
  },
}));

function applyFontSettings(settings: AppSettings) {
  document.documentElement.style.setProperty('--font-size-base', settings.fontSize + 'px');
  document.documentElement.style.setProperty('--code-font-size', settings.codeFontSize + 'px');
}
