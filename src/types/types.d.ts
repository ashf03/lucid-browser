export interface NavigationHistory {
  urls: string[]
  currentIndex: number
}

export type ThemeType = 'light' | 'dark' | 'system';

export interface StoreSchema {
  navigationHistory: NavigationHistory
  theme: ThemeType  
}

export interface StoreApi {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
  delete: (key: string) => void
}

export interface IpcStore {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<void>
  delete: (key: string) => Promise<void>
}

export interface IElectronAPI {
  store: IpcStore
  handleNewTab: (url: string) => void
  theme: {
    change: (theme: ThemeType) => Promise<void>
  },
  ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
  };
  spellChecker: {
    replaceMisspelling: (suggestion: string) => void;
  },
  devTools: {
    toggle: (webContentsId: number) => Promise<boolean>;
    getState: (webContentsId: number) => Promise<boolean>;
    closeForTab: (tabId: string) => Promise<boolean>;
    mapTabToWebContents: (tabId: string, webContentsId: number) => Promise<boolean>;
  },
  security: {
    onSecurityWarning: (callback: (arg0: any) => void) => void;
    proceedAnyway: (url: any) => void;
},
messages: {
  save: (tabId: string, messages: any[]) => Promise<boolean>;
  load: (tabId: string) => Promise<any[]>;
};
print: {
  // Generate PDF preview from a webview
  generatePDFPreview: (webContentsId: number) => Promise<string>;
    
  // Capture an element to PDF
  captureElementToPDF: (selector: string, tabId: string) => Promise<string>;
    
  // Print a webview using the system print dialog
  printWebContents: (webContentsId: number) => Promise<void>;
    
  // Print a data URL using the system print dialog
  printDataUrl: (dataUrl: string) => Promise<void>;
};
cleanup: {
  forTab: (tabId: string) => Promise<boolean>;
};
keyboardShortcuts: {
  get: () => Promise<Array<{
    id: string;
    name: string;
    keys: string[];
    action: string;
    isDefault?: boolean;
  }>>;
  save: (shortcuts: Array<{
    id: string;
    name: string;
    keys: string[];
    action: string;
    isDefault?: boolean;
  }>) => Promise<boolean>;
  checkValid: (keys: string[]) => Promise<{ valid: boolean; message?: string }>;
  forceReset: () => Promise<any>
},
  youtube: {
    fetchTranscript: (url: string) => Promise<{
      success: boolean;
      videoTitle?: string;
      transcript?: string;
      error?: string;
    }>;
  };
  factoryResetBrowser: () => void,
restartApp: () => void,
setup: {
    check: () => Promise<any>;
    reset: () => Promise<any>;
    complete: () => Promise<any>
},
 auth: {
    saveSession: (session: any) => Promise<{ success: boolean; error?: string }>;
    getSession: () => Promise<any>;
    clearSession: () => Promise<{ success: boolean; error?: string }>;
    saveProfile: (userId: string, profile: any) => Promise<{ success: boolean; error?: string }>;
    getProfile: (userId: string) => Promise<any>;
  };
  adBlocker: {
    enable: () => Promise<any>;
    disable: () => Promise<any>;
    getStatus: () => Promise<any>;
    getStats: () => Promise<any>;
};
progress: {
    start: () => void;
    setProgress: (value: number) => Promise<any>;
    onUpdate: (callback: (progress: number) => void) => void;
    onComplete: (callback: () => void) => void;
};
window: WindowControls;
  screenShare: {
    getWindowSources: () => Promise<any[]>;
    getScreenSources: () => Promise<any[]>;
    selectSource: (sourceId: string) => Promise<any>;
    cancelShare: () => Promise<any>;
    setupWebviewHandler: (webContentsId: number) => Promise<any>;
  };
permissions: {
  // Core permission storage
  save: (origin: string, permission: string, granted: boolean) => Promise<{ success: boolean; error?: string }>;
  get: (origin: string, permission: string) => Promise<string | null>;
  getAll: () => Promise<Record<string, string>>;
  delete: (origin: string, permission: string) => Promise<{ success: boolean; error?: string }>;
  clear: () => Promise<{ success: boolean; error?: string }>;
  
  // History management
  saveHistory: (historyItem: HistoryItem) => Promise<{ success: boolean; error?: string }>;
  getHistory: () => Promise<HistoryItem[]>;
  clearHistory: () => Promise<{ success: boolean; error?: string }>;
  
  // Legacy methods for compatibility
  sendResponse: (data: { id: number; granted: boolean }) => void;
};
downloads: {
  getAll: () => Promise<any[]>
  clearAll: () => Promise<void>
  openFileLocation: (downloadId: string) => Promise<void>
  pause: (downloadId: string) => Promise<void>
  resume: (downloadId: string) => Promise<void>
  cancel: (downloadId: string) => Promise<void>
  delete: (downloadId: string) => Promise<void>
  redownload: (downloadId: string) => Promise<void>
  onUpdate: (callback: (downloads: any[]) => void) => () => void
};
  browserImport: {
    detectBrowsers: () => Promise<Record<string, string>>;
    importBookmarks: (browser: string) => Promise<BrowserImportResult>;
    importHistory: (browser: string) => Promise<BrowserImportResult>;
  };
   history: {
    add: (entry: HistoryEntry) => Promise<{ success: boolean; error?: string }>;
    getAll: () => Promise<HistoryEntry[]>;
    search: (query: string) => Promise<HistoryEntry[]>;
    delete: (url: string) => Promise<{ success: boolean; error?: string }>;
    clear: () => Promise<{ success: boolean; error?: string }>;
    deleteByDateRange: (startDate: string, endDate: string) => Promise<{ success: boolean; deletedCount?: number; error?: string }>;
  };
}

export interface HistoryEntry {
  url: string;
  title: string;
  timestamp: Date;
  tabId: string;
  visitCount: number;
  favicon?: string;
}

export interface PermissionRequest {
  id: number;
  permission: string;
  displayName: string;
  description: string;
  icon: string;
  origin: string;
  details: any;
}

export interface PermissionHistoryItem {
  permission: string;
  origin: string;
  granted: boolean;
  timestamp: string;
}

export interface WindowControls {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  onMaximized: (callback: () => void) => void;
  onUnmaximized: (callback: () => void) => void;
  onFocused: (callback: () => void) => void;
  onBlurred: (callback: () => void) => void;
}

// Add these interfaces
export interface WebViewElement extends HTMLElement {
  reload: () => void
  getURL: () => string
  loadURL: (url: string) => void
}

export interface WebViewNavigationEvent extends Event {
  url: string
}

export interface PermissionRequest {
  id: number;
  permission: string;
  origin: string;
}

export interface SupabaseAuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user?: SupabaseUser;
}

// Supabase User type
export interface SupabaseUser {
  id: string;
  email?: string;
  created_at?: string;
  [key: string]: any; // For other properties
}

// User Profile type
export interface UserProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  email: string;
  created_at?: string;
  updated_at?: string;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}