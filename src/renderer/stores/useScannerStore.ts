import { create } from 'zustand';
import type { Resource, ScanResult, ScanStats, DeleteResult } from '../types';

interface ScannerState {
  scanResult: ScanResult | null;
  isScanning: boolean;
  scanProgress: { message: string; current: number; total: number } | null;
  selectedFile: Resource | null;
  filterMode: 'all' | 'used' | 'unused';
  fileTypeFilter: string;
  searchQuery: string;

  startScan: (projectPath: string, filenameMatch: boolean) => Promise<void>;
  selectFile: (resource: Resource | null) => void;
  setFilterMode: (mode: 'all' | 'used' | 'unused') => void;
  setFileTypeFilter: (type: string) => void;
  setSearchQuery: (query: string) => void;
  deleteFiles: (resources: Resource[]) => Promise<{ deleted: DeleteResult[]; failed: DeleteResult[] }>;
  removeDeletedFromResults: (deletedPaths: string[]) => void;
  reset: () => void;
}

export const useScannerStore = create<ScannerState>((set, get) => ({
  scanResult: null,
  isScanning: false,
  scanProgress: null,
  selectedFile: null,
  filterMode: 'all',
  fileTypeFilter: 'all',
  searchQuery: '',

  startScan: async (projectPath, filenameMatch) => {
    set({ isScanning: true, scanProgress: null, scanResult: null, selectedFile: null });

    const cleanup = window.api.onScanProgress((progress) => {
      set({ scanProgress: { message: progress.message || 'Working...', current: progress.current || 0, total: progress.total || 0 } });
    });

    try {
      const result = await window.api.scanProject(projectPath, { filenameMatch });
      if (result.success && result.data) {
        set({ scanResult: result.data });
      }
    } finally {
      cleanup();
      set({ isScanning: false, scanProgress: null });
    }
  },

  selectFile: (resource) => set({ selectedFile: resource }),

  setFilterMode: (mode) => set({ filterMode: mode }),

  setFileTypeFilter: (type) => set({ fileTypeFilter: type }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  deleteFiles: async (resources) => {
    const absPaths = resources.map(r => r.absPath);
    const result = await window.api.deleteFiles(absPaths);

    const deleted = result.results.filter(r => r.success);
    const failed = result.results.filter(r => !r.success);

    return { deleted, failed };
  },

  removeDeletedFromResults: (deletedPaths) => {
    const { scanResult } = get();
    if (!scanResult) return;

    const deletedSet = new Set(deletedPaths.map(p => p.replace(/\\/g, '/')));
    const resourceList = scanResult.resourceList.filter(res => {
      const absNorm = res.absPath.replace(/\\/g, '/');
      return !deletedSet.has(absNorm);
    });

    const usedCount = resourceList.filter(r => r.used).length;
    const stats: ScanStats = {
      ...scanResult.stats,
      totalResources: resourceList.length,
      usedCount,
      unusedCount: resourceList.length - usedCount,
    };

    set({ scanResult: { resourceList, stats }, selectedFile: null });
  },

  reset: () => set({
    scanResult: null,
    isScanning: false,
    scanProgress: null,
    selectedFile: null,
    filterMode: 'all',
    fileTypeFilter: 'all',
    searchQuery: '',
  }),
}));

export function getFilteredResources(state: ScannerState): Resource[] {
  if (!state.scanResult) return [];

  return state.scanResult.resourceList.filter(res => {
    if (state.filterMode === 'used' && !res.used) return false;
    if (state.filterMode === 'unused' && res.used) return false;

    if (state.fileTypeFilter !== 'all') {
      const resType = res.type === 'cocos-json' ? 'json' : res.type;
      if (resType !== state.fileTypeFilter) return false;
    }

    if (state.searchQuery && !res.path.toLowerCase().includes(state.searchQuery.toLowerCase())) return false;

    return true;
  });
}
