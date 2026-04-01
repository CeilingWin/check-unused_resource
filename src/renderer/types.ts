export interface Resource {
  path: string;
  absPath: string;
  type: string;
  size: number;
  used: boolean;
  references: Reference[];
}

export interface Reference {
  source: string;
  line: number | null;
  snippet: string;
  type: string;
  context?: ContextEntry[];
}

export interface ContextEntry {
  lineNum: number | null;
  text: string;
  highlight?: boolean;
}

export interface ScanStats {
  totalResources: number;
  usedCount: number;
  unusedCount: number;
  filenameMatchCount?: number;
}

export interface ScanResult {
  resourceList: Resource[];
  stats: ScanStats;
}

export interface RecentFolder {
  path: string;
  name: string;
  lastOpened: number;
}

export interface AppSettings {
  fontSize: number;
  codeFontSize: number;
  enableFilenameMatching: boolean;
}

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  resource?: Resource;
  children?: Map<string, TreeNode>;
}

export interface DeleteResult {
  path: string;
  success: boolean;
  size?: number;
  error?: string;
}

export type PageName = 'folder-picker' | 'home' | 'scanner' | 'duplicate';

// Duplicate scan types
export interface DuplicateFile {
  path: string;
  absPath: string;
  size: number;
  width: number | null;
  height: number | null;
  hash: string;
  pHash: string | null;
}

export interface DuplicateGroup {
  id: number;
  matchType: 'exact' | 'perceptual';
  fileType: 'image' | 'non-image';
  similarity: number;
  hammingDistance: number;
  files: DuplicateFile[];
  wastedBytes: number;
}

export interface DuplicateScanStats {
  totalFiles: number;
  totalGroups: number;
  exactGroups: number;
  perceptualGroups: number;
  totalWastedBytes: number;
  imageFiles: number;
  nonImageFiles: number;
}

export interface DuplicateScanResult {
  groups: DuplicateGroup[];
  stats: DuplicateScanStats;
  settings: { threshold: number };
}

// Window API type declarations
declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<{ success: boolean; path?: string; reason?: string; message?: string }>;
      getRecentFolders: () => Promise<RecentFolder[]>;
      addRecentFolder: (entry: { path: string; name?: string }) => Promise<RecentFolder[]>;
      removeRecentFolder: (path: string) => Promise<RecentFolder[]>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<{ success: boolean }>;
      scanProject: (path: string, options: { filenameMatch: boolean }) => Promise<{ success: boolean; data?: ScanResult; message?: string }>;
      getPreview: (filePath: string) => Promise<{ success: boolean; type?: string; data?: string; size?: number; fileName?: string; message?: string }>;
      showItemInFolder: (filePath: string) => Promise<{ success: boolean }>;
      openCodeViewer: (filePath: string, highlightLine: number) => Promise<{ success: boolean; message?: string }>;
      deleteFiles: (filePaths: string[]) => Promise<{ success: boolean; results: DeleteResult[]; message?: string }>;
      onScanProgress: (callback: (data: { message?: string; current?: number; total?: number }) => void) => () => void;
      scanDuplicates: (path: string, options: { threshold: number }) => Promise<{ success: boolean; data?: DuplicateScanResult; message?: string }>;
      onDuplicateScanProgress: (callback: (data: { phase?: number; step?: string; message?: string; current?: number; total?: number }) => void) => () => void;
    };
    codeViewerAPI: {
      onFileData: (callback: (data: { filePath: string; content: string; highlightLine: number | null; totalLines: number }) => void) => void;
    };
  }
}
