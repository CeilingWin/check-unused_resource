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

export type PageName = 'folder-picker' | 'home' | 'scanner';

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
      openCodeViewer: (filePath: string, highlightLine: number) => Promise<{ success: boolean; message?: string }>;
      deleteFiles: (filePaths: string[]) => Promise<{ success: boolean; results: DeleteResult[]; message?: string }>;
      onScanProgress: (callback: (data: { message?: string; current?: number; total?: number }) => void) => () => void;
    };
    codeViewerAPI: {
      onFileData: (callback: (data: { filePath: string; content: string; highlightLine: number | null; totalLines: number }) => void) => void;
    };
  }
}
