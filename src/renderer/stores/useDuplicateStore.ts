// src/renderer/stores/useDuplicateStore.ts
import { create } from 'zustand';
import type { DuplicateGroup, DuplicateScanResult } from '../types';

type FileTypeFilter = 'all' | 'image' | 'non-image';
type MatchTypeFilter = 'all' | 'exact' | 'perceptual';

interface DuplicateState {
  scanResult: DuplicateScanResult | null;
  isScanning: boolean;
  scanProgress: { phase: number; step?: string; message: string; current: number; total: number } | null;
  selectedGroupId: number | null;
  fileTypeFilter: FileTypeFilter;
  matchTypeFilter: MatchTypeFilter;
  searchQuery: string;
  threshold: number;

  startScan: (projectPath: string, threshold: number) => Promise<void>;
  setSelectedGroupId: (id: number | null) => void;
  setFileTypeFilter: (filter: FileTypeFilter) => void;
  setMatchTypeFilter: (filter: MatchTypeFilter) => void;
  setSearchQuery: (query: string) => void;
  setThreshold: (threshold: number) => void;
  reset: () => void;
}

export const useDuplicateStore = create<DuplicateState>((set) => ({
  scanResult: null,
  isScanning: false,
  scanProgress: null,
  selectedGroupId: null,
  fileTypeFilter: 'all',
  matchTypeFilter: 'all',
  searchQuery: '',
  threshold: 5,

  startScan: async (projectPath, threshold) => {
    set({ isScanning: true, scanProgress: null, scanResult: null, selectedGroupId: null });

    const cleanup = window.api.onDuplicateScanProgress((progress) => {
      set({
        scanProgress: {
          phase: progress.phase || 0,
          step: progress.step,
          message: progress.message || 'Working...',
          current: progress.current || 0,
          total: progress.total || 0,
        },
      });
    });

    try {
      const result = await window.api.scanDuplicates(projectPath, { threshold });
      if (result.success && result.data) {
        set({ scanResult: result.data });
      }
    } finally {
      cleanup();
      set({ isScanning: false, scanProgress: null });
    }
  },

  setSelectedGroupId: (id) => set({ selectedGroupId: id }),
  setFileTypeFilter: (filter) => set({ fileTypeFilter: filter }),
  setMatchTypeFilter: (filter) => set({ matchTypeFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setThreshold: (threshold) => set({ threshold }),

  reset: () => set({
    scanResult: null,
    isScanning: false,
    scanProgress: null,
    selectedGroupId: null,
    fileTypeFilter: 'all',
    matchTypeFilter: 'all',
    searchQuery: '',
    threshold: 3,
  }),
}));

export function getFilteredGroups(state: DuplicateState): DuplicateGroup[] {
  if (!state.scanResult) return [];

  return state.scanResult.groups.filter(group => {
    if (state.fileTypeFilter !== 'all' && group.fileType !== state.fileTypeFilter) return false;
    if (state.matchTypeFilter !== 'all' && group.matchType !== state.matchTypeFilter) return false;

    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      const hasMatch = group.files.some(f => f.path.toLowerCase().includes(query));
      if (!hasMatch) return false;
    }

    return true;
  });
}
