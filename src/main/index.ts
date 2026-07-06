/**
 * Lucid Browser — Electron main process entry point.
 *
 * Responsibilities:
 * - Window lifecycle and native chrome (minimize, maximize, close)
 * - IPC bridge between renderer and Node/Electron APIs (~90 channels)
 * - Persistent storage via electron-store (history, auth, shortcuts, permissions)
 * - External API proxies (SerpAPI search, ElevenLabs TTS/STT, YouTube transcripts)
 * - File conversion, folder/zip ingestion, Playwright scraping
 * - Download manager, ad blocker, print, screen-share, and keyboard shortcuts
 *
 * IPC naming convention: `domain:action` (e.g. `history:add`, `auth:saveSession`).
 * Renderer access is mediated through `src/preload/index.ts` → `window.electronAPI`.
 */
import { app, shell, BrowserWindow, ipcMain, session, nativeTheme, dialog, Menu, MenuItem, globalShortcut, webContents, clipboard, desktopCapturer } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import type { HistoryEntry, StoreSchema, ThemeType } from '../types/types'
import { resolveHtmlPath } from './util'
import axios from 'axios'
import fs from 'fs';
import { execSync, spawn } from 'child_process'
import { convertFileToText } from './file-converters'
import { processZipFile, processFolderRecursively, flattenFolderStructure } from './folder-utils';
import { scrapeUrl } from './scraper'
import { extractVideoId, fetchTranscript } from './transcript'
import { ElectronBlocker } from '@ghostery/adblocker-electron';
import os from 'os';
import { permissionManager } from './permissionManager'
import { getSerpApiKey, getElevenLabsApiKey, getAuthStoreEncryptionKey } from './env'

// ─── Module state ───────────────────────────────────────────────────────────
// Shared mutable state used across IPC handlers below.

let downloadCounter = 0;
const generateDownloadId = () => {
  return `download_${Date.now()}_${++downloadCounter}`;
};

// Track active download handlers to prevent duplicates
const activeDownloadHandlers = new Set();
let downloads: any[] = []
let downloadItems = new Map()

// Encrypted store for Supabase session tokens (optional AUTH_STORE_ENCRYPTION_KEY).
const authStore = new Store({
  name: 'auth-store',
  encryptionKey: getAuthStoreEncryptionKey(),
  defaults: {
    session: null
  }
});

// Add these type definitions for the auth session
interface SupabaseAuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user?: any;
}

let adBlocker: ElectronBlocker | null = null;
let isAdBlockingEnabled = false;

// Primary browser preferences: navigation history stack and theme.
const store = new Store<StoreSchema>({
  name: 'browser-history',
  defaults: {
    navigationHistory: {
      urls: [''],
      currentIndex: 0
    },
    theme: 'light',
  },
})  

// Define interface for keyboard shortcuts
interface KeyboardShortcut {
  id: string;
  name: string;
  keys: string[];
  action: string;
  isDefault?: boolean;
}


// Path to store shortcuts configuration
const userDataPath = app.getPath('userData');
const shortcutsPath = path.join(userDataPath, 'keyboard-shortcuts.json');

// Initialize the store for keyboard shortcuts
const keyboardShortcutsStore = new Store({
  name: 'keyboard-shortcuts',
  cwd: userDataPath,
  defaults: {
    shortcuts: [
      { 
        id: 'default-1', 
        name: 'Open History Settings', 
        keys: ['Ctrl', 'H'], 
        action: 'open-history', 
        isDefault: true 
      },
      { 
        id: 'default-2', 
        name: 'New Tab', 
        keys: ['Ctrl', 'T'], 
        action: 'add-tab', 
        isDefault: true 
      },
      { 
        id: 'default-3', 
        name: 'New Asterisk', 
        keys: ['Shift', 'T'], 
        action: 'add-asterisk', 
        isDefault: true 
      },
      { 
        id: 'default-4', 
        name: 'Zen Mode', 
        keys: ['Shift', 'Z'], 
        action: 'zen-mode-trigger', 
        isDefault: true 
      },
      { 
        id: 'default-5', 
        name: 'Clipboard Quick Access', 
        keys: ['Shift', 'C'], 
        action: 'clipboard-quick', 
        isDefault: true 
      },
      { 
        id: 'default-6', 
        name: 'Close Tab/Asterisk', 
        keys: ['Ctrl', 'W'], 
        action: 'close-tab', 
        isDefault: true 
      },
      { 
        id: 'default-7', 
        name: 'New Tab Group', 
        keys: ['Shift', 'P'], 
        action: 'pin-tab', 
        isDefault: true 
      },
      { 
        id: 'default-8', 
        name: 'Command Main', 
        keys: ['Ctrl', 'K'], 
        action: 'command-main', 
        isDefault: true 
      },
      { 
        id: 'default-9', 
        name: 'Toggle Sidebar', 
        keys: ['Ctrl', 'B'], 
        action: 'toggle-sidebar', 
        isDefault: true 
      },
      { 
        id: 'default-10', 
        name: 'Switch Tabs', 
        keys: ['Ctrl', 'Tab'], 
        action: 'switch-tabs', 
        isDefault: true 
      },
      { 
        id: 'default-11', 
        name: 'Print', 
        keys: ['Ctrl', 'P'], 
        action: 'print-trigger', 
        isDefault: true 
      },
      { 
        id: 'default-12', 
        name: 'Reload', 
        keys: ['Ctrl', 'R'], 
        action: 'reload-trigger', 
        isDefault: true 
      },
      { 
        id: 'default-13', 
        name: 'Talk to Webpage', 
        keys: ['Ctrl', 'F'], 
        action: 'browser-ai', 
        isDefault: true 
      }
    ]
  }
});

// ─── Downloads ──────────────────────────────────────────────────────────────
// Tracks in-flight downloads and exposes pause/resume/cancel via IPC.
// UI is notified through the `update-downloads` push channel.

function getMainDownloadsPath() {
  if (os.platform() !== "win32") {
    try {
      const output = execSync('xdg-user-dir DOWNLOAD', { encoding: 'utf8' });
      const xdgPath = output.toString().trim();
      if (xdgPath) return xdgPath;
      else return path.join(os.homedir(), 'Downloads');
    } catch (err) {
      return path.join(os.homedir(), 'Downloads');
    }
  }
  return path.join(os.homedir(), 'Downloads');
}

function updateDownloadsUI() {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('update-downloads', downloads);
  });
}

// Downloads IPC handlers
ipcMain.handle('downloads:getAll', () => {
  return downloads;
});

ipcMain.handle('downloads:clearAll', () => {
  downloads = [];
  updateDownloadsUI();
});

ipcMain.handle('downloads:openFileLocation', (_event, downloadId) => {
  const download = downloads.find(d => d.id === downloadId);
  if (download && download.savePath && fs.existsSync(download.savePath)) {
    shell.showItemInFolder(download.savePath);
  }
});

ipcMain.handle('downloads:pause', (_event, downloadId) => {
  const item = downloadItems.get(downloadId);
  if (item && !item.isPaused()) {
    item.pause();
    const download = downloads.find(d => d.id === downloadId);
    if (download) {
      download.state = 'paused';
      updateDownloadsUI();
    }
  }
});

ipcMain.handle('downloads:resume', (_event, downloadId) => {
  const item = downloadItems.get(downloadId);
  if (item && item.canResume() && item.isPaused()) {
    item.resume();
    const download = downloads.find(d => d.id === downloadId);
    if (download) {
      download.state = 'progressing';
      updateDownloadsUI();
    }
  }
});

ipcMain.handle('downloads:cancel', (_event, downloadId) => {
  const item = downloadItems.get(downloadId);
  if (item) {
    item.cancel();
    const download = downloads.find(d => d.id === downloadId);
    if (download) {
      download.state = 'cancelled';
      updateDownloadsUI();
    }
  }
});

ipcMain.handle('downloads:delete', (_event, downloadId) => {
  const download = downloads.find(d => d.id === downloadId);
  if (download) {
    if (download.savePath && fs.existsSync(download.savePath)) {
      try {
        fs.unlinkSync(download.savePath);
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    }
    downloads = downloads.filter(d => d.id !== downloadId);
    downloadItems.delete(downloadId);
    updateDownloadsUI();
  }
});

ipcMain.handle('downloads:redownload', (_event, downloadId) => {
  const download = downloads.find(d => d.id === downloadId);
  if (download && download.url) {
    BrowserWindow.getFocusedWindow()?.webContents.downloadURL(download.url);
  }
});

ipcMain.handle('get-window-sources', async () => {
  console.log('📱 Getting window sources...');
  try {
    const sources = await desktopCapturer.getSources({ 
      types: ['window'],
      thumbnailSize: { width: 150, height: 150 }
    });
    
    const filteredSources = sources.filter(source => 
      source.name && 
      source.name.trim() !== '' && 
      !source.name.includes('Task Switching')
    );
    
    return filteredSources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  } catch (error) {
    console.error('❌ Error getting window sources:', error);
    throw error;
  }
});

// ─── Permissions & screen capture ───────────────────────────────────────────
// Persists per-origin permission grants and handles desktop/window capture
// source enumeration for screen-share flows.

ipcMain.handle('permissions:save', async (_, origin: string, permission: string, granted: boolean) => {
  try {
    const key = `${origin}:${permission}`;
    const status = granted ? 'granted' : 'denied';
    
    // Get existing permissions
    const permissions = store.get('permissions', {}) as Record<string, string>;
    
    // Update permission
    permissions[key] = status;
    
    // Save back to store
    store.set('permissions', permissions);
    
    console.log(`Permission saved: ${key} = ${status}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to save permission:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('permissions:get', async (_, origin: string, permission: string) => {
  try {
    const key = `${origin}:${permission}`;
    const permissions = store.get('permissions', {}) as Record<string, string>;
    return permissions[key] || null;
  } catch (error) {
    console.error('Failed to get permission:', error);
    return null;
  }
});

ipcMain.handle('permissions:getAll', async () => {
  try {
    const permissions = store.get('permissions', {}) as Record<string, string>;
    return permissions;
  } catch (error) {
    console.error('Failed to get all permissions:', error);
    return {};
  }
});

ipcMain.handle('permissions:delete', async (_, origin: string, permission: string) => {
  try {
    const key = `${origin}:${permission}`;
    const permissions = store.get('permissions', {}) as Record<string, string>;
    
    delete permissions[key];
    store.set('permissions', permissions);
    
    console.log(`Permission deleted: ${key}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete permission:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('permissions:clear', async () => {
  try {
    store.set('permissions', {});
    console.log('All permissions cleared');
    return { success: true };
  } catch (error) {
    console.error('Failed to clear permissions:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Permission history handlers
ipcMain.handle('permissions:saveHistory', async (_, historyItem: any) => {
  try {
    const history = store.get('permissionHistory', []) as any[];
    
    // Add new item to beginning of array
    history.unshift({
      ...historyItem,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 items
    if (history.length > 100) {
      history.splice(100);
    }
    
    store.set('permissionHistory', history);
    return { success: true };
  } catch (error) {
    console.error('Failed to save permission history:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('permissions:getHistory', async () => {
  try {
    return store.get('permissionHistory', []) as any[];
  } catch (error) {
    console.error('Failed to get permission history:', error);
    return [];
  }
});

ipcMain.handle('permissions:clearHistory', async () => {
  try {
    store.set('permissionHistory', []);
    return { success: true };
  } catch (error) {
    console.error('Failed to clear permission history:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('get-screen-sources', async () => {
  console.log('🖥️ Getting screen sources...');
  try {
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'],
      thumbnailSize: { width: 150, height: 150 }
    });
    
    return sources.map(source => ({
      id: source.id,
      name: source.name || `Screen ${source.id}`,
      thumbnail: source.thumbnail.toDataURL()
    }));
  } catch (error) {
    console.error('❌ Error getting screen sources:', error);
    throw error;
  }
});

let shareCallback: ((result: any) => void) | null = null;

ipcMain.handle('source-selected', async (_event, sourceId) => {
  console.log('✅ Source selected:', sourceId);
  
  try {
    if (!shareCallback) {
      return { success: false, error: 'No callback available' };
    }

    const allSources = await desktopCapturer.getSources({ 
      types: ['screen', 'window'],
      thumbnailSize: { width: 150, height: 150 }
    });
    
    const selectedSource = allSources.find(s => s.id === sourceId);
    
    if (!selectedSource) {
      throw new Error('Selected source not found');
    }

    shareCallback({
      video: selectedSource,
      audio: false
    });
    shareCallback = null;
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error in source-selected:', error);
    if (shareCallback) {
      shareCallback({});
      shareCallback = null;
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('share-cancelled', async () => {
  console.log('❌ Share cancelled');
  if (shareCallback) {
    shareCallback({});
    shareCallback = null;
  }
  return { success: true };
});

ipcMain.handle('setup-webview-handler', async (_event, webContentsId) => {
  console.log('🔧 Setting up webview handler for:', webContentsId);
  
  try {
    const targetContents = webContents.fromId(webContentsId);
    
    if (!targetContents) {
      throw new Error('Webview webContents not found');
    }
    
    // Set up display media request handler
    targetContents.session.setDisplayMediaRequestHandler((_request, callback) => {
      console.log('🎥 Display media request received');
      shareCallback = callback;
      
      // Send event to show share panel
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('show-share-panel');
      });
    });
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error setting up webview handler:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Track registered shortcuts to clean up later
let registeredShortcuts: string[] = [];

const devToolsState = new Map<number, boolean>();
const tabWebContentsMap = new Map<string, number>();

// ─── Window chrome ──────────────────────────────────────────────────────────
// Frameless window controls and state events forwarded to the renderer.

ipcMain.handle('window-minimize', () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.minimize();
  }
});

ipcMain.handle('window-maximize', () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    if (focusedWindow.isMaximized()) {
      focusedWindow.unmaximize();
    } else {
      focusedWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.close();
  }
});

// Send window state changes to renderer
function setupWindowStateHandlers(mainWindow: BrowserWindow) {
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized');
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized');
  });

  mainWindow.on('focus', () => {
    mainWindow.webContents.send('window-focused');
  });

  mainWindow.on('blur', () => {
    mainWindow.webContents.send('window-blurred');
  });
}

/**
 * Creates the primary BrowserWindow, wires session policies (DNT, spellcheck),
 * registers IPC handlers scoped to this window, and loads the renderer.
 */
function createWindow(): void {

  const preloadPath = join(__dirname, '../preload/index.cjs')
  console.log('ABSOLUTE PRELOAD PATH:', preloadPath)
  console.log('Does preload exist?', require('fs').existsSync(preloadPath))

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    webPreferences: {
      preload: preloadPath,
      sandbox: true, 
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: false,
      spellcheck: true,
      devTools: !app.isPackaged,
    }
  })

  setupWindowStateHandlers(mainWindow);
  permissionManager.setupPermissionHandling();

  session.defaultSession.setPreloads([preloadPath]) 

  const ses = session.fromPartition('persist:main')
  ses.setPreloads([preloadPath])

  ses.setDisplayMediaRequestHandler((_request, callback) => {
  desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
    if (sources.length > 0) {
      callback({ video: sources[0], audio: 'loopback' });
    } else {
      callback({});
    }
  }).catch((_error) => { 
    callback({});
  });
});
  
  console.log(session.defaultSession.serviceWorkers.getAllRunning())

  session.defaultSession.serviceWorkers.on('console-message', (_event, messageDetails) => {
    console.log(
      'Got service worker message',
      messageDetails,
      'from',
      session.defaultSession.serviceWorkers.getFromVersionID(messageDetails.versionId)
    )

    session.defaultSession.cookies
      .get({})
      .then((cookies) => {
        console.log(cookies)
      })
      .catch((error) => {
        console.log(error)
      })
  })

mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
  callback(true);
});

  initializeKeyboardShortcuts();
setTimeout(() => {
  forceResetShortcuts();
  console.log('Forced shortcuts reset after app initialization');
}, 2000);

  setupDNT(session.defaultSession);
  setupDNT(session.fromPartition('persist:main'));  

  session.defaultSession.setSpellCheckerLanguages(['en-US']);

   mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // Open DevTools in a detached window
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  function setupDNT(sessionInstance: Electron.Session) {
    // Always set the DNT header for all requests
    sessionInstance.webRequest.onBeforeSendHeaders(
      { urls: ['<all_urls>'] },
      (details, callback) => {
        // Add DNT header
        details.requestHeaders['DNT'] = '1';
        callback({ requestHeaders: details.requestHeaders });
      }
    );
    
    console.log('DNT headers enforced for web session');
  }

// ─── First-run setup & file dialogs ─────────────────────────────────────────
// Onboarding flag, native open dialogs, and folder/zip ingestion for the editor.

ipcMain.handle('setup:check', async () => {
  const setupCompleted = store.get('setupCompleted', false);
  return setupCompleted;
});

// Reset setup status (for testing or manual resets)
ipcMain.handle('setup:reset', async () => {
  try {
    store.set('setupCompleted', false);
    return true;
  } catch (error) {
    console.error('Failed to reset setup status:', error);
    return false;
  }
});


ipcMain.handle('open-general-file-dialog', async (_event, options?: Electron.OpenDialogOptions) => {
  // First show a dialog asking the user what type they want to upload
  const { response: selectedType } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Select Upload Type',
    message: 'What would you like to upload?',
    buttons: ['File', 'ZIP Archive', 'Folder'],
    defaultId: 0,
    cancelId: -1
  });

  // If user canceled, return null
  if (selectedType === -1) {
    return null;
  }

  let dialogOptions: Electron.OpenDialogOptions = {};
  
  // Configure dialog options based on selection
  switch (selectedType) {
    case 0: // File
      dialogOptions = {
        properties: ['openFile'],
        filters: [
          { name: 'All Supported Files', extensions: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'js', 'py', 'java', 'json', 'md'] },
          { name: 'PDF Files', extensions: ['pdf'] },
          { name: 'Word Documents', extensions: ['docx', 'doc'] },
          { name: 'Excel Sheets', extensions: ['xlsx', 'xls'] },
          { name: 'PowerPoint', extensions: ['pptx', 'ppt'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'Programming Files', extensions: ['js', 'py', 'java', 'c', 'cpp', 'html', 'css'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'Markdown Files', extensions: ['md'] }
        ],
        title: 'Select File'
      };
      break;
    
    case 1: // ZIP Archive
      dialogOptions = {
        properties: ['openFile'],
        filters: [
          { name: 'ZIP Archives', extensions: ['zip', 'ZIP'] }
        ],
        title: 'Select ZIP Archive'
      };
      break;
    
    case 2: // Folder
      dialogOptions = {
        properties: ['openDirectory'],
        title: 'Select Folder'
      };
      break;
  }

  // Apply any additional options passed in
  if (options?.filters) {
    dialogOptions.filters = options.filters;
  }

  // Show file dialog with configured options
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, dialogOptions);

  if (!canceled && filePaths.length > 0) {
    return filePaths[0];
  }
  return null;
});

// 2. Audio-only file dialog
ipcMain.handle('open-audio-file-dialog', async (_event, options?: Electron.OpenDialogOptions) => {
  const dialogOptions: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'] }
    ],
    title: 'Select Audio File'
  };

  // Apply any additional options passed in
  if (options?.filters) {
    dialogOptions.filters = options.filters;
  }

  // Show audio file dialog
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, dialogOptions);

  if (!canceled && filePaths.length > 0) {
    return filePaths[0];
  }
  return null;
});

// 3. Image-only file dialog
ipcMain.handle('open-image-file-dialog', async (_event, options?: Electron.OpenDialogOptions) => {
  const dialogOptions: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [
      { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff'] }
    ],
    title: 'Select Image File'
  };

  // Apply any additional options passed in
  if (options?.filters) {
    dialogOptions.filters = options.filters;
  }

  // Show image file dialog
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, dialogOptions);

  if (!canceled && filePaths.length > 0) {
    return filePaths[0];
  }
  return null;
});

ipcMain.on('start-progress', () => {
  let progress = 0;
  const interval = setInterval(() => {
    if (progress >= 1) {
      mainWindow.setProgressBar(-1); // Hide when done
      clearInterval(interval);
      // Notify renderer that progress is complete
      mainWindow.webContents.send('progress-complete');
    } else {
      mainWindow.setProgressBar(progress);
      // Send progress update to renderer
      mainWindow.webContents.send('progress-update', progress);
      progress += 0.01;
    }
  }, 100);
});

// Optional: Add a handler to manually set progress
ipcMain.handle('set-progress', (_, progressValue: number) => {
  if (progressValue < 0) {
    mainWindow.setProgressBar(-1); // Hide progress bar
  } else {
    mainWindow.setProgressBar(Math.min(1, Math.max(0, progressValue)));
  }
  return true;
});

ipcMain.handle('process-folder-or-zip', async (_event, pathToProcess) => {
  try {
    const stats = fs.statSync(pathToProcess);
    
    // Check if it's a ZIP file
    if (stats.isFile() && path.extname(pathToProcess).toLowerCase() === '.zip') {
      const folderStructure = await processZipFile(pathToProcess);
      return {
        success: true,
        isFolder: true,
        isZip: true,
        data: flattenFolderStructure(folderStructure)
      };
    }
    
    // Check if it's a folder
    else if (stats.isDirectory()) {
      const folderStructure = await processFolderRecursively(pathToProcess);
      return {
        success: true,
        isFolder: true,
        isZip: false,
        data: flattenFolderStructure(folderStructure)
      };
    }
    
    // If it's a regular file, fallback to the existing convertFileToText function
    else {
      const result = await convertFileToText(pathToProcess);
      return result;
    }
  } catch (error) {
    console.error('Error processing folder or ZIP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

async function initializeAdBlocker() {
  try {
    console.log('Initializing ad blocker...');
    adBlocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    
    // Enable by default
    isAdBlockingEnabled = true;
    adBlocker.enableBlockingInSession(session.defaultSession);
    adBlocker.enableBlockingInSession(session.fromPartition('persist:main'));
    
    console.log('Ad blocker initialized and enabled');
  } catch (error) {
    console.error('Failed to initialize ad blocker:', error);
  }
}

// ─── Ad blocker ─────────────────────────────────────────────────────────────
// Ghostery adblocker applied to default and `persist:main` sessions.

ipcMain.handle('adblocker:enable', async () => {
  try {
    if (!adBlocker) {
      await initializeAdBlocker();
    }
    
    if (adBlocker && !isAdBlockingEnabled) {
      adBlocker.enableBlockingInSession(session.defaultSession);
      adBlocker.enableBlockingInSession(session.fromPartition('persist:main'));
      isAdBlockingEnabled = true;
      
      // Save preference
      store.set('adBlockingEnabled', true);
      
      console.log('Ad blocking enabled');
      return { success: true };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to enable ad blocking:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('adblocker:disable', async () => {
  try {
    if (adBlocker && isAdBlockingEnabled) {
      adBlocker.disableBlockingInSession(session.defaultSession);
      adBlocker.disableBlockingInSession(session.fromPartition('persist:main'));
      isAdBlockingEnabled = false;
      
      // Save preference
      store.set('adBlockingEnabled', false);
      
      console.log('Ad blocking disabled');
      return { success: true };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to disable ad blocking:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('adblocker:status', () => {
  return {
    isEnabled: isAdBlockingEnabled,
    isInitialized: adBlocker !== null
  };
});

ipcMain.handle('adblocker:stats', () => {
  if (!adBlocker) {
    return { blockedCount: 0 };
  }
  
  // Get blocking stats if available
  return {
    blockedCount: 0 // The library doesn't expose stats directly, but you could implement counting
  };
});

const savedAdBlockingPreference = store.get('adBlockingEnabled', true);
if (savedAdBlockingPreference) {
  initializeAdBlocker();
}

// ─── File conversion & chat persistence ─────────────────────────────────────
// Converts uploaded files to text for AI context; saves per-tab message history.

ipcMain.handle('convert-file', async (_event, filePath) => {
  try {
    const result = await convertFileToText(filePath);
    return result;
  } catch (error) {
    console.error('Conversion error:', error);
    return { success: false, error: (error instanceof Error ? error.message : String(error)) };
  }
});

  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu();
    
    // Only show spell checker menu for misspelled words
    if (params.misspelledWord) {
      // Add spelling suggestions
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(new MenuItem({
          label: suggestion,
          click: () => {
            mainWindow.webContents.replaceMisspelling(suggestion);
          }
        }));
      }
      
      // Add separator if there are suggestions
      if (params.dictionarySuggestions.length > 0) {
        menu.append(new MenuItem({ type: 'separator' }));
      }
      
      // Add to dictionary option
      menu.append(new MenuItem({
        label: 'Add to Dictionary',
        click: () => {
          session.defaultSession.addWordToSpellCheckerDictionary(params.misspelledWord);
        }
      }));
      
      menu.popup();
    }
  });

  // Add these handlers in index.ts where your other ipcMain handlers are
ipcMain.handle('save-messages', async (_, tabId, messages) => {
  try {
    store.set(`messages.${tabId}`, messages);
    return true;
  } catch (error) {
    console.error('Failed to save messages:', error);
    return false;
  }
});

ipcMain.handle('load-messages', async (_, tabId) => {
  try {
    return store.get(`messages.${tabId}`, []);
  } catch (error) {
    console.error('Failed to load messages:', error);
    return [];
  }
}); 

  // Add this with your other IPC handlers
ipcMain.on('replace-misspelling', (event, suggestion) => {
  const webContents = event.sender;
  webContents.replaceMisspelling(suggestion);
});

  const getSystemTheme = () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  };

  // Spawns the Python location script; returns JSON with coords + Mapbox address.
  ipcMain.handle('get-location', () => {
    return new Promise((resolve, reject) => {
      try {
        checkPythonAvailability();
        
        const pythonPath = getPythonPath();
        const scriptPath = getPythonScriptPath();
        
        if (!fs.existsSync(scriptPath)) {
          throw new Error('Location service script not found');
        }
        
        const pythonProcess = spawn(pythonPath, [scriptPath]);
        
        let dataString = '';
        let errorString = '';
        
        pythonProcess.stdout.on('data', (data) => {
          dataString += data.toString();
        });
  
        pythonProcess.stderr.on('data', (data) => {
          errorString += data.toString();
          console.error(`Python Error: ${data}`);
        });
  
        pythonProcess.on('error', (error) => {
          reject(new Error(`Failed to start Python process: ${error.message}`));
        });
  
        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Python process exited with code ${code}: ${errorString}`));
            return;
          }
          
          try {
            const locationData = JSON.parse(dataString);
            resolve(locationData);
          } catch (e) {
            reject(new Error(`Failed to parse location data: ${e instanceof Error ? e.message : String(e)}`));
          }
        });
  
        setTimeout(() => {
          pythonProcess.kill();
          reject(new Error('Location request timed out'));
        }, 30000);
        
      } catch (error) {
        reject(error);
      }
    });
  });

  ipcMain.handle('cleanup-tab-data', async (_, tabId) => {
    try {
      console.log(`Cleaning up data for tab ${tabId}`);
      
      // Remove messages stored for this tab
      store.delete(`messages.${tabId}`);
      
      // Remove from pinned tabs if present
      const pinnedTabs = store.get('pinnedTabs', []) as string[];
      if (pinnedTabs.includes(tabId)) {
        store.set('pinnedTabs', pinnedTabs.filter(id => id !== tabId));
      }
      
      // Remove from manually set titles if present
      const manuallySetTitles = store.get('manuallySetTitles', []) as string[];
      if (manuallySetTitles.includes(tabId)) {
        store.set('manuallySetTitles', manuallySetTitles.filter(id => id !== tabId));
      }
      
      // Remove any DevTools state
      const webContentsId = tabWebContentsMap.get(tabId);
      if (webContentsId) {
        devToolsState.delete(webContentsId);
        tabWebContentsMap.delete(tabId);
      }
      
      // Clean up any tab-specific state in the store
      // This pattern will match any keys that start with the tab ID
      for (const key of Object.keys(store.store)) {
        if (key.startsWith(`${tabId}.`) || key.endsWith(`.${tabId}`)) {
          store.delete(key);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to cleanup tab data:', error);
      return false;
    }
  });

  ipcMain.handle('get-memory-usage', () => {
    const processMemory = process.memoryUsage();
    return {
      process: processMemory
    };
  });

  ipcMain.handle('toggle-webview-devtools', (_event, webContentsId) => {
    // Get the webview's WebContents if ID provided
    const webContentsObj = webContentsId ? webContents.fromId(webContentsId) : null;
    
    if (webContentsObj) {
      // Check if DevTools is currently open for this specific webContents
      const isDevToolsOpen = webContentsObj.isDevToolsOpened();
      
      if (isDevToolsOpen) {
        webContentsObj.closeDevTools();
        devToolsState.set(webContentsId, false);
      } else {
        webContentsObj.openDevTools({ mode: 'detach' });
        devToolsState.set(webContentsId, true);
      }
      
      // Notify renderer about the new state for this specific webContents
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('devtools-state-changed', webContentsId, !isDevToolsOpen);
      });
      
      return !isDevToolsOpen;
    }
    
    return false;
  });
  
  
  ipcMain.handle('get-devtools-state', (_event, webContentsId) => {
    return devToolsState.get(webContentsId) || false;
  });
  
  ipcMain.handle('close-devtools-for-tab', (_event, tabId) => {
    const webContentsId = tabWebContentsMap.get(tabId);
    if (webContentsId) {
      const webContentsObj = webContents.fromId(webContentsId);
      if (webContentsObj && devToolsState.get(webContentsId)) {
        webContentsObj.closeDevTools();
        devToolsState.set(webContentsId, false);
        return true;
      }
    }
    return false;
  });
  
  ipcMain.handle('map-tab-to-webcontents', (_event, tabId, webContentsId) => {
    console.log(`Mapping tab ${tabId} to webContents ${webContentsId}`);
    tabWebContentsMap.set(tabId, webContentsId);
    return true;
  });
  
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (!focusedWindow) return;
    
    // Get the active tab ID from the renderer
    focusedWindow.webContents.executeJavaScript(`
      document.querySelector('[data-active="true"]')?.getAttribute('data-tab-id')
    `).then(activeTabId => {
      if (!activeTabId) return;
      
      // Get the webContentsId for the active tab
      const webContentsId = tabWebContentsMap.get(activeTabId);
      if (!webContentsId) return;
      
      // Get the webview's WebContents
      const webContentsObj = webContents.fromId(webContentsId);
      if (!webContentsObj) return;
      
      // Check if DevTools is open for this specific tab
      const isDevToolsOpen = webContentsObj.isDevToolsOpened();
      
      // Toggle DevTools based on the current state of THIS tab
      if (isDevToolsOpen) {
        webContentsObj.closeDevTools();
        devToolsState.set(webContentsId, false);
      } else {
        webContentsObj.openDevTools({ mode: 'detach' });
        devToolsState.set(webContentsId, true);
      }
      
      // Notify renderer about the state change
      focusedWindow.webContents.send('devtools-state-changed', webContentsId, !isDevToolsOpen);
    }).catch(err => {
      console.error('Error getting active tab:', err);
      
      // Fallback: toggle DevTools on the main window if we can't determine the active tab
      if (focusedWindow.webContents.isDevToolsOpened()) {
        focusedWindow.webContents.closeDevTools();
      } else {
        focusedWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });
  });
  
  ipcMain.on('user-proceed-anyway', (_event, url) => {
    console.log(`User chose to proceed to potentially unsafe site: ${url}`);
  });

  ipcMain.handle('theme:change', (_event, theme: ThemeType) => {
    if (!mainWindow) return;
    
    const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
    store.set('theme', theme)
  })

  // Setup IPC handlers for store
  ipcMain.handle('store:set', async (_event, key: string, value: unknown) => {
    console.log('Setting store:', key, value) // Debug log
    store.set(key, value)
    return true
  })

  ipcMain.handle('store:get', async (_event, key: string) => {
    const value = store.get(key)
    console.log('Getting store:', key, value) // Debug log
    return value
  })

  ipcMain.handle('scrape-url', async (_event, url: string) => {
    try {
      const result = await scrapeUrl(url);
      return { success: true, data: result };
    } catch (error) {
      console.error('Scraping error:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // ─── Browsing history ─────────────────────────────────────────────────────
  // SQLite-backed history stored in electron-store with search and date filters.

ipcMain.handle('history:add', async (_, historyItem: HistoryEntry) => {
  try {
    // Get existing history
    const history = store.get('browsingHistory', []) as HistoryEntry[];
    
    // Check if URL already exists and update it, or add new entry
    const existingIndex = history.findIndex(item => item.url === historyItem.url);
    
    if (existingIndex >= 0) {
      // Update existing entry
      history[existingIndex] = {
        ...history[existingIndex],
        ...historyItem,
        timestamp: new Date(),
        visitCount: (history[existingIndex].visitCount || 0) + 1
      };
    } else {
      // Add new entry to the beginning
      history.unshift({
        ...historyItem,
        timestamp: new Date(),
        visitCount: 1
      });
    }
    
    // Limit history to 1000 entries
    if (history.length > 1000) {
      history.splice(1000);
    }
    
    // Save back to store
    store.set('browsingHistory', history);
    
    console.log(`Added/updated history entry: ${historyItem.url}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to add history entry:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('history:getAll', async () => {
  try {
    const history = store.get('browsingHistory', []) as HistoryEntry[];
    return history;
  } catch (error) {
    console.error('Failed to get history:', error);
    return [];
  }
});

ipcMain.handle('history:search', async (_, query: string) => {
  try {
    const history = store.get('browsingHistory', []) as HistoryEntry[];
    
    if (!query.trim()) {
      return history;
    }
    
    const searchTerm = query.toLowerCase();
    const filteredHistory = history.filter(entry => 
      entry.url.toLowerCase().includes(searchTerm) ||
      entry.title.toLowerCase().includes(searchTerm)
    );
    
    return filteredHistory;
  } catch (error) {
    console.error('Failed to search history:', error);
    return [];
  }
});

ipcMain.handle('history:delete', async (_, url: string) => {
  try {
    const history = store.get('browsingHistory', []) as HistoryEntry[];
    const filteredHistory = history.filter(entry => entry.url !== url);
    
    store.set('browsingHistory', filteredHistory);
    
    console.log(`Deleted history entry: ${url}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete history entry:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('history:clear', async () => {
  try {
    store.set('browsingHistory', []);
    console.log('Cleared all browsing history');
    return { success: true };
  } catch (error) {
    console.error('Failed to clear history:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('history:deleteByDateRange', async (_, startDate: string, endDate: string) => {
  try {
    const history = store.get('browsingHistory', []) as HistoryEntry[];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const filteredHistory = history.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return !(entryDate >= start && entryDate <= end);
    });
    
    store.set('browsingHistory', filteredHistory);
    
    console.log(`Deleted history entries from ${startDate} to ${endDate}`);
    return { success: true, deletedCount: history.length - filteredHistory.length };
  } catch (error) {
    console.error('Failed to delete history by date range:', error);
    return { success: false, error: (error as Error).message };
  }
});

  ipcMain.handle('fetch-youtube-transcript', async (_, url: string) => {
  try {
    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      return { success: false, error: 'Invalid YouTube URL' };
    }

    // Check if we have a cached result
    const cacheKey = `youtube-transcript-${videoId}`;
    const cachedTranscript = store.get(cacheKey);
    if (cachedTranscript) {
      console.log(`Using cached transcript for video ${videoId}`);
      return { success: true, transcript: cachedTranscript };
    }

    // Fetch video title
    let videoTitle: string | null = null;
    try {
      const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`);
      const titleMatch = response.data.match(/<title>(.*?)<\/title>/);
      if (titleMatch && titleMatch[1]) {
        videoTitle = titleMatch[1].replace(' - YouTube', '');
      }
    } catch (error) {
      console.error('Error fetching video title:', error);
    }

    // Fetch transcript
    const transcript = await fetchTranscript(videoId);
    if (!transcript) {
      return { 
        success: false, 
        error: 'Failed to fetch transcript. The video may not have closed captions available.' 
      };
    }

    // Cache the result
    store.set(cacheKey, transcript);

    return { 
      success: true, 
      videoTitle: videoTitle || 'YouTube Video',
      transcript 
    };
  } catch (error) {
    console.error('Error processing YouTube URL:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An error occurred while fetching the transcript'
    };
  }
});

// ─── SerpAPI search proxies ─────────────────────────────────────────────────
// All search IPC handlers require SERPAPI_API_KEY (or VITE_SERPAPI_API_KEY) in .env.

ipcMain.handle('search-autocomplete', async (_, query: string, locationParams: any) => {
  try {
    const apiKey = getSerpApiKey();
    
    if (!apiKey) {
      throw new Error('SERPAPI_KEY is not configured');
    }

    const params = {
      engine: "google_autocomplete",
      q: query,
      api_key: apiKey,
      location: locationParams?.location,
    };

    console.log('Autocomplete search request:', { 
      url: 'https://serpapi.com/search',
      params: { ...params, api_key: '[REDACTED]' } 
    });

    const response = await axios.get('https://serpapi.com/search', { params });
    
    if (!response.data.suggestions) {
      console.log('No autocomplete suggestions found:', response.data);
      return { suggestions: [] };
    }

    return {
      suggestions: response.data.suggestions.map((suggestion: any) => ({
        suggestion: suggestion.value,
        type: suggestion.type || 'query'
      }))
    };
  } catch (error) {
    console.error('Autocomplete search error:', error);
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data;
      console.error('API error details:', responseData);
      throw new Error(`Autocomplete search failed: ${responseData?.error || error.message}`);
    }
    throw error;
  }
});

// In main.ts, update the YouTube search handler to include Shorts:

ipcMain.handle('search-youtube', async (_, query: string, locationParams: any) => {
  try {
    const apiKey = getSerpApiKey();
    
    // Make two separate API calls - one for regular videos and one for shorts
    const regularParams = {
      engine: "youtube",
      search_query: query,
      api_key: apiKey,
      location: locationParams?.location,
    };

    const shortsParams = {
      engine: "youtube",
      search_query: `${query} #shorts`,  // Add #shorts to specifically search for shorts
      api_key: apiKey,
      location: locationParams?.location,
    };

    console.log('YouTube search request:', {
      url: 'https://serpapi.com/search',
      params: { ...regularParams, api_key: '[REDACTED]' }
    });

    // Make both requests in parallel
    const [regularResponse, shortsResponse] = await Promise.all([
      axios.get('https://serpapi.com/search', { params: regularParams }),
      axios.get('https://serpapi.com/search', { params: shortsParams })
    ]);

    // Process regular videos
    const regularVideos = regularResponse.data.video_results?.map((video: any) => ({
      title: video.title || 'No title available',
      link: video.link,
      thumbnail: video.thumbnail?.static || video.thumbnail,
      duration: video.duration,
      views: video.views,
      uploadedAt: video.published_date,
      channelName: video.channel?.name,
      isShort: false
    })) || [];

    // Process shorts
    const shorts = shortsResponse.data.video_results?.map((video: any) => ({
      title: video.title || 'No title available',
      link: video.link,
      thumbnail: video.thumbnail?.static || video.thumbnail,
      duration: video.duration,
      views: video.views,
      uploadedAt: video.published_date,
      channelName: video.channel?.name,
      isShort: true
    })).filter((video: any) => 
      video.link?.includes('/shorts/') || 
      video.title?.toLowerCase().includes('#shorts') ||
      video.duration?.toLowerCase().includes('short')
    ) || [];

    // Combine and deduplicate results
    const allVideos = [...regularVideos, ...shorts];
    const uniqueVideos = Array.from(new Map(allVideos.map(video => 
      [video.link, video]
    )).values());

    console.log(`Found ${uniqueVideos.length} total videos (${shorts.length} shorts)`);
    return { youtube_results: uniqueVideos };

  } catch (error) {
    console.error('YouTube search error:', error);
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data;
      console.error('API error details:', responseData);
      throw new Error(`YouTube search failed: ${responseData?.error || error.message}`);
    }
    throw error;
  }
});

// ─── Auth persistence ───────────────────────────────────────────────────────
// Encrypted local cache of Supabase session/profile for offline restore.

ipcMain.handle('auth:saveSession', async (_, session: SupabaseAuthSession) => {
  try {
    console.log('Saving Supabase auth session');
    // Optionally encrypt sensitive data before storing
    authStore.set('session', session);
    return { success: true };
  } catch (error) {
    console.error('Failed to save auth session:', error);
    return { success: false, error: (error instanceof Error) ? error.message : String(error) };
  }
});

// Handler to retrieve the stored authentication session
ipcMain.handle('auth:getSession', async () => {
  try {
    const session = authStore.get('session') as SupabaseAuthSession | null;
    console.log('Retrieved auth session:', session ? 'Found' : 'Not found');
    return session;
  } catch (error) {
    console.error('Failed to get auth session:', error);
    return null;
  }
});

// Clear session handler
ipcMain.handle('auth:clearSession', async () => {
  try {
    console.log('Clearing auth session');
    authStore.delete('session');
    
    // Also clear any related profile data
    const keys = authStore.store;
    Object.keys(keys).forEach(key => {
      if (key.startsWith('profile.')) {
        authStore.delete(key);
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to clear auth session:', error);
    return { success: false, error: (error instanceof Error) ? error.message : String(error) };
  }
});

// Save user profile data in Supabase
ipcMain.handle('auth:saveProfile', async (_, userId: string, profile: any) => {
  try {
    console.log('Saving user profile for:', userId);
    authStore.set(`profile.${userId}`, profile);
    return { success: true };
  } catch (error) {
    console.error('Failed to save user profile:', error);
    return { success: false, error: (error instanceof Error) ? error.message : String(error) };
  }
});

// Get user profile data
ipcMain.handle('auth:getProfile', async (_, userId: string) => {
  try {
    const profile = authStore.get(`profile.${userId}`);
    console.log('Retrieved profile for user:', userId, profile ? 'Found' : 'Not found');
    return profile;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
});

// Add this to the setupCompleted check in the existing code
ipcMain.handle('setup:complete', async () => {
  try {
    store.set('setupCompleted', true);
    return true;
  } catch (error) {
    console.error('Failed to mark setup as complete:', error);
    return false;
  }
});

  ipcMain.handle('search-shopping', async (_, query: string, locationParams: any) => {
    try {
      const apiKey = getSerpApiKey();
      
      if (!apiKey) {
        throw new Error('SERPAPI_KEY is not configured');
      }
  
      // Ensure required parameters are present
      if (!query) {
        throw new Error('Query parameter is required');
      }
  
      const params = {
        engine: "google_shopping",
        q: query,
        api_key: apiKey,
        location: locationParams.location,
        google_domain: "google.com",
        device: "desktop",
        output: "json"
      };
  
      console.log('Shopping search request:', { 
        url: 'https://serpapi.com/search',
        params: { ...params, api_key: '[REDACTED]' } 
      });
  
      const response = await axios.get('https://serpapi.com/search', { params });
      
      if (!response.data.shopping_results) {
        console.log('No shopping results found:', response.data);
        return { shopping_results: [] };
      }
  
      const results = response.data.shopping_results.map((product: any) => ({
        title: product.title || '',
        link: product.link || '',
        product_link: product.product_link || product.link || '',
        image: product.thumbnail || '',
        price: {
          raw: product.price || '',
          value: parseFloat(product.extracted_price || '0'),
          currency: product.currency || 'USD'
        },
        rating: product.rating || null,
        reviews: product.reviews || null,
        source: product.source || '',
        description: product.snippet || '',
        shipping: product.shipping || '',
        extensions: product.extensions || []
      }));
  
      console.log(`Found ${results.length} shopping results`);
      return { shopping_results: results };
  
    } catch (error) {
      console.error('Shopping search error:', error);
      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data;
        console.error('API error details:', responseData);
        throw new Error(`Shopping search failed: ${responseData?.error || error.message}`);
      }
      throw error;
    }
  });

  ipcMain.handle('search-maps', async (_, query: string, locationParams: any) => {
    try {
      const apiKey = getSerpApiKey();
      
      if (!apiKey) {
        throw new Error('SERPAPI_KEY is not configured');
      }
  
      const params = {
        engine: "google_maps",
        q: query,
        api_key: apiKey,
        type: "search",
        location: locationParams.location,
        ll: `@${locationParams.latitude},${locationParams.longitude},15.1z`,
        fields: "business_id,title,rating,reviews,address,phone,website,hours,description,gps_coordinates,place_id",  // Add fields parameter
        data: "gps_coordinates,local_results" // Explicitly request GPS coordinates
      };
  
      console.log('SerpAPI request:', { url: 'https://serpapi.com/search', params });
  
      const response = await axios.get('https://serpapi.com/search', { params });
      
      if (!response.data.local_results) {
        console.log('No local results found:', response.data);
        return { local_results: [] };
      }
  
      const results = {
        local_results: response.data.local_results.map((place: any) => {
          // Log each place to see what we're getting
          console.log('Place data:', JSON.stringify(place, null, 2));
          
          return {
            title: place.title,
            rating: place.rating,
            reviews: place.reviews,
            address: place.address,
            website: place.website,
            description: place.description,
            hours: place.hours,
            mapsUrl: place.link,
            // Try to get coordinates from different possible locations in the response
            latitude: place.gps_coordinates?.latitude || place.coordinates?.latitude || place.geometry?.location?.lat,
            longitude: place.gps_coordinates?.longitude || place.coordinates?.longitude || place.geometry?.location?.lng,
            thumbnail: place.thumbnail
          };
        })
      };
  
      console.log('Processed results with coordinates:', 
        results.local_results.map((place: { title: any; latitude: any; longitude: any }) => ({
          title: place.title,
          lat: place.latitude,
          lng: place.longitude
        }))
      );
  
      return results;
    } catch (error) {
      console.error('Maps search error:', error);
      throw error;
    }
  });

  ipcMain.handle('search-videos', async (_, query: string, locationParams: any) => {
    try {
      const apiKey = getSerpApiKey();
      
      if (!apiKey) {
        throw new Error('SERPAPI_KEY is not configured');
      }
  
      const params = {
        engine: "google_videos",
        q: query,
        api_key: apiKey,
        location: locationParams.location,
        num: "60"
      };
  
      const searchUrl = `https://serpapi.com/search.json?${new URLSearchParams(params)}`;
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        video_results: data.video_results.map((video: any) => ({
          title: video.title || 'No title available',
          link: video.link,
          thumbnail: video.thumbnail,
          duration: video.duration,
          platform: video.source || video.platform,
          date: video.date
        }))
      };
    } catch (error) {
      console.error('Video search error:', error);
      throw error;
    }
  });

  ipcMain.handle('search-images', async (_, query: string, locationParams: any) => {
    try {
      const apiKey = getSerpApiKey();
      
      if (!apiKey) {
        throw new Error('SERPAPI_KEY is not configured');
      }
  
      const params = {
        engine: "google_images",
        q: query,
        api_key: apiKey,
        location: locationParams.location,
        num: "60"
      };
      
      const searchUrl = `https://serpapi.com/search.json?${new URLSearchParams(params)}`;
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        images_results: data.images_results.map((img: any) => ({
          original: img.original || img.link,
          thumbnail: img.thumbnail,
          title: img.title || 'No title available',
          source: img.source || 'Unknown source'
        }))
      };
    } catch (error) {
      console.error('Image search error:', error);
      throw error;
    }
  });

  // ─── App lifecycle, speech & page export ──────────────────────────────────
  // Factory reset, ElevenLabs TTS/STT, and save-page-to-disk.

// Factory reset Lucid to its original state
// AKA: Erase Browser
ipcMain.on('factory-reset-app', async (_) => {
    console.log("Clearing: store, premissionStore and keyboardShortcutsStore");

    // Clear history
    store.clear();
    store.set('navigationHistory', {
        urls: [''],
        currentIndex: 0
    });

    store.set('name', 'browser-history');

    keyboardShortcutsStore.clear(); // Clear KB shortcuts

    // Clear Session cache

    try {
        await ses.clearCache();
        await ses.clearStorageData();
        await ses.clearAuthCache();

        console.log('All cache and storage data cleared!');
    } catch (err) {
        console.error('Failed to clear data due to an error:', err);
    }


    console.log("Factory resetted app to default state");
});

ipcMain.on('restart-app', (_) => {
    app.relaunch();
    app.exit(0);
});

ipcMain.handle('generate-speech', async (_event, { text }) => {
  try {
    const apiKey = getElevenLabsApiKey();
    const voiceId = "t0jbNlBVZ17f02VDIeMI"; // Default voice ID (Rachel)
    
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    
    const response = await axios({
      method: 'post',
      url: url,
      data: {
        text: text.substring(0, 10000), // Limit text length
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      },
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer'
    });

    // Save the audio to a temporary file
    const tempFilePath = path.join(app.getPath('temp'), `tts-output-${Date.now()}.mp3`);
    fs.writeFileSync(tempFilePath, response.data);
    
    // Read the file as base64 and create a data URL
    const audioData = fs.readFileSync(tempFilePath).toString('base64');
    const dataUrl = `data:audio/mpeg;base64,${audioData}`;
    
    return { 
      success: true, 
      filePath: tempFilePath, 
      dataUrl: dataUrl 
    };
  } catch (error) {
    console.error('Error generating speech:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate speech'
    };
  }
});

const tempDir = path.join(app.getPath('temp'), 'electron-stt-app');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Handle saving a blob from renderer to a temp file
ipcMain.handle('save-blob', async (_event, blobData) => {
  try {
    // Create a unique filename
    const filename = `recording-${Date.now()}.wav`;
    const filepath = path.join(tempDir, filename);
    
    // Convert base64 to buffer and save
    const base64Data = blobData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filepath, buffer);
    
    return filepath;
  } catch (error) {
    console.error('Error saving blob:', error);
    throw new Error('Failed to save recording: ' + (error instanceof Error ? error.message : String(error)));
  }
});

ipcMain.handle('transcribe-audio', async (_event, filePath, options = {}) => {
  try {
    const apiKey = getElevenLabsApiKey();

    console.log('Transcribing file:', filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Create a form data object for the multipart request
    const FormData = require('form-data');
    const form = new FormData();
    
    // Append the audio file using a Buffer
    const fileBuffer = await fs.promises.readFile(filePath);
    form.append('file', fileBuffer, path.basename(filePath));
    form.append('model_id', 'scribe_v1');
    
    // Set English as default language if not provided
    if (!options) options = {};
    
    // Add language (default to English)
    form.append('language_code', options.language || 'en');
    
    // Add other options if provided
    if (options.tag_audio_events !== undefined) {
      form.append('tag_audio_events', options.tag_audio_events.toString());
    }
    
    if (options.diarize !== undefined) {
      form.append('diarize', options.diarize.toString());
    }

    // Make the API request using node-fetch
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      body: form,
      headers: {
        'xi-api-key': apiKey,
      }
    });
    
    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.detail || `API error: ${response.status}`;
      } catch (e) {
        errorMessage = `API error: ${response.status} - ${errorText}`;
      }
      throw new Error(errorMessage);
    }
    
    // Parse the JSON response
    const data = await response.json();
    
    // Return the transcription data
    return {
      text: data.text,
      language_code: data.language_code,
      language_probability: data.language_probability,
      words: data.words
    };
  } catch (error) {
    console.error('Transcription error:', error);
    return { 
      error: (error instanceof Error) ? error.message : String(error),
      text: '' 
    };
  }
});

ipcMain.handle('save-page', async (event, data) => {
  try {
    const { url, title, webContentsId } = data;
    
    // Get the webContents of the webview
    const webviewContents = webContents.fromId(webContentsId);
    if (!webviewContents) {
      throw new Error('Webview not found');
    }

    // Clean title for filename
    const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    const defaultPath = path.join(getMainDownloadsPath(), `${cleanTitle}.html`);

    // Show save dialog
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (!focusedWindow) {
      return { success: false, error: 'No focused window to show save dialog' };
    }
    const result = await dialog.showSaveDialog(focusedWindow, {
      title: 'Save Webpage',
      defaultPath: defaultPath,
      filters: [
        { name: 'Web Page, Complete', extensions: ['html'] },
        { name: 'Web Page, HTML Only', extensions: ['html'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, error: 'Save canceled by user' };
    }

    const filePath = result.filePath;
    const saveType = 'HTMLComplete'; // Options: 'HTMLOnly', 'HTMLComplete', 'MHTML'

    // Save the page
    await webviewContents.savePage(filePath, saveType);

    return { 
      success: true, 
      filePath: filePath,
      message: 'Page saved successfully'
    };

  } catch (error) {
    console.error('Save page error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

  ipcMain.handle('search-serp', async (_, query: string, locationParams: any) => {
    console.log('Received search request for:', query, 'with location:', locationParams);
    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          api_key: getSerpApiKey(),
          q: query,
          engine: 'google',
          location: locationParams.location,
          num: 100
        }
      });
      return response.data;
    } catch (error) {
      console.error('SerpAPI Error:', error);
      throw error;
    }
  });

  ipcMain.handle('get-env', (_, name: string) => {
    console.log('Getting env variable:', name);
    return process.env[name];
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadURL(resolveHtmlPath('index.html'));
  }
}

// ─── Keyboard shortcuts ─────────────────────────────────────────────────────
// Global accelerators registered via Electron; actions dispatched to renderer
// as CustomEvents (see preload script for the forwarding map).

/**
 * Convert our format of shortcut keys to Electron's accelerator format
 */
function convertToAccelerator(keys: string[]): string | null {
  if (!keys || keys.length === 0) return null;
  
  // Map our key names to Electron's accelerator format
  const keyMap: Record<string, string> = {
    '⌘': 'CommandOrControl',
    'Ctrl': 'CommandOrControl',
    'Alt': 'Alt',
    'Shift': 'Shift',
    'Space': 'Space',
    'Esc': 'Escape',
    'Tab': 'Tab',
    'Enter': 'Return',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'Up': 'Up',
    'Down': 'Down',
    'Left': 'Left',
    'Right': 'Right',
    'Home': 'Home',
    'End': 'End',
    'PageUp': 'PageUp',
    'PageDown': 'PageDown'
  };
  
  // Convert keys to accelerator format
  const acceleratorParts = keys.map(key => {
    // Handle function keys (F1-F12)
    if (key.match(/^F\d+$/)) {
      return key;
    }
    // Handle single-character keys (letters, numbers)
    if (key.length === 1) {
      return key;
    }
    // Handle mapped keys or return the key itself
    return keyMap[key] || key;
  });
  
  return acceleratorParts.join('+');
}

/**
 * Check if the accelerator is a reserved system shortcut
 */
function isReservedShortcut(accelerator: string): boolean {
  const reserved = [
    'CommandOrControl+C',
    'CommandOrControl+V',
    'CommandOrControl+X',
    'CommandOrControl+A',
    'CommandOrControl+Z',
    'Alt+Tab',
    'Alt+F4',
  ];
  
  return reserved.includes(accelerator);
}

/**
 * Save shortcuts to file for persistence
 */function saveShortcuts(shortcuts: KeyboardShortcut[]) {
  try {
    // Only save to electron-store - this is more reliable than file system
    keyboardShortcutsStore.set('shortcuts', shortcuts);
    console.log(`Saved ${shortcuts.length} shortcuts to electron-store`);
    
    // Broadcast the update to all renderers
    broadcastShortcutsUpdated(shortcuts);
  } catch (error) {
    console.error('Error saving shortcuts to store:', error);
  }
}

function getBrowserPaths() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  const paths = {
    chrome: null as string | null,
    firefox: null as string | null,
    safari: null as string | null,
    edge: null as string | null
  };

  switch (platform) {
    case 'win32':
      paths.chrome = path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default');
      paths.edge = path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default');
      paths.firefox = path.join(homeDir, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
      break;
    case 'darwin':
      paths.chrome = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'Default');
      paths.edge = path.join(homeDir, 'Library', 'Application Support', 'Microsoft Edge', 'Default');
      paths.safari = path.join(homeDir, 'Library', 'Safari');
      paths.firefox = path.join(homeDir, 'Library', 'Application Support', 'Firefox', 'Profiles');
      break;
    case 'linux':
      paths.chrome = path.join(homeDir, '.config', 'google-chrome', 'Default');
      paths.firefox = path.join(homeDir, '.mozilla', 'firefox');
      break;
  }

  return paths;
}

// Find Firefox profile directory
function findFirefoxProfile(firefoxDir: string | null): string | null {
  if (!firefoxDir || !fs.existsSync(firefoxDir)) return null;
  
  try {
    const profiles = fs.readdirSync(firefoxDir);
    const defaultProfile = profiles.find(profile => profile.includes('default') || profile.endsWith('.default'));
    return defaultProfile ? path.join(firefoxDir, defaultProfile) : null;
  } catch (error) {
    return null;
  }
}

// SQLite helper function
async function queryDatabase(dbPath: string, query: string): Promise<any[]> {
  const tempDbPath = path.join(os.tmpdir(), `browser_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.db`);
  
  try {
    fs.copyFileSync(dbPath, tempDbPath);
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(tempDbPath, sqlite3.OPEN_READONLY, (err: any) => {
        if (err) {
          try {
            if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
          } catch (e) {}
          reject(err);
          return;
        }

        db.all(query, [], (err: any, rows: any[] | PromiseLike<any[]>) => {
          db.close((closeErr: any) => {
            setTimeout(() => {
              try {
                if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
              } catch (e) {}
            }, 100);
            
            if (err) reject(err);
            else resolve(rows);
          });
        });
      });
    });
  } catch (error) {
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    } catch (e) {}
    throw error;
  }
}

// Chromium-based browsers (Chrome, Edge)
async function importChromiumBookmarks(browserPath: string) {
  const bookmarksPath = path.join(browserPath, 'Bookmarks');
  
  if (!fs.existsSync(bookmarksPath)) {
    throw new Error('Bookmarks file not found');
  }
  
  const bookmarksData = fs.readFileSync(bookmarksPath, 'utf8');
  const bookmarks = JSON.parse(bookmarksData);
  
  const parseFolder = (folder: any): any[] => {
    const items: any[] = [];
    if (folder.children) {
      folder.children.forEach((child: any) => {
        if (child.type === 'url') {
          items.push({
            name: child.name,
            url: child.url,
            dateAdded: new Date(parseInt(child.date_added) / 1000),
            type: 'bookmark'
          });
        } else if (child.type === 'folder') {
          items.push({
            name: child.name,
            type: 'folder',
            children: parseFolder(child)
          });
        }
      });
    }
    return items;
  };
  
  return {
    success: true,
    bookmarks: {
      bookmarkBar: parseFolder(bookmarks.roots.bookmark_bar),
      otherBookmarks: parseFolder(bookmarks.roots.other)
    }
  };
}

async function importChromiumHistory(browserPath: string) {
  const historyPath = path.join(browserPath, 'History');
  
  if (!fs.existsSync(historyPath)) {
    throw new Error('History file not found');
  }
  
  const query = `
    SELECT url, title, visit_count, last_visit_time
    FROM urls
    WHERE visit_count > 0 AND url NOT LIKE 'chrome://%' AND url NOT LIKE 'chrome-extension://%'
    ORDER BY last_visit_time DESC
    LIMIT 1000
  `;
  
  const rows = await queryDatabase(historyPath, query);
  
  const history = rows.map((row: any) => ({
    url: row.url,
    title: row.title || 'No Title',
    visitCount: row.visit_count,
    lastVisit: new Date((row.last_visit_time / 1000000) - 11644473600000)
  }));
  
  return { success: true, history };
}

// Firefox
async function importFirefoxBookmarks(firefoxDir: string | null) {
  const profileDir = findFirefoxProfile(firefoxDir);
  if (!profileDir) {
    throw new Error('Firefox profile not found');
  }
  
  const placesPath = path.join(profileDir, 'places.sqlite');
  if (!fs.existsSync(placesPath)) {
    throw new Error('Firefox places database not found');
  }
  
  const query = `
    SELECT b.title, p.url, b.dateAdded
    FROM moz_bookmarks b
    JOIN moz_places p ON b.fk = p.id
    WHERE b.type = 1 AND p.url IS NOT NULL
    ORDER BY b.dateAdded DESC
    LIMIT 1000
  `;
  
  const rows = await queryDatabase(placesPath, query);
  
  const bookmarks = rows.map((row: any) => ({
    name: row.title || 'No Title',
    url: row.url,
    dateAdded: new Date(row.dateAdded / 1000),
    type: 'bookmark'
  }));
  
  return {
    success: true,
    bookmarks: {
      bookmarkBar: bookmarks,
      otherBookmarks: []
    }
  };
}

async function importFirefoxHistory(firefoxDir: string | null) {
  const profileDir = findFirefoxProfile(firefoxDir);
  if (!profileDir) {
    throw new Error('Firefox profile not found');
  }
  
  const placesPath = path.join(profileDir, 'places.sqlite');
  if (!fs.existsSync(placesPath)) {
    throw new Error('Firefox places database not found');
  }
  
  const query = `
    SELECT url, title, visit_count, last_visit_date
    FROM moz_places
    WHERE visit_count > 0 AND url NOT LIKE 'about:%'
    ORDER BY last_visit_date DESC
    LIMIT 1000
  `;
  
  const rows = await queryDatabase(placesPath, query);
  
  const history = rows.map((row: any) => ({
    url: row.url,
    title: row.title || 'No Title',
    visitCount: row.visit_count,
    lastVisit: new Date(row.last_visit_date / 1000)
  }));
  
  return { success: true, history };
}

// Safari (macOS only)
async function importSafariBookmarks(safariDir: string | null) {
  if (!safariDir) throw new Error('Safari directory not found');
  
  const bookmarksPath = path.join(safariDir, 'Bookmarks.plist');
  
  if (!fs.existsSync(bookmarksPath)) {
    throw new Error('Safari bookmarks not found');
  }
  
  return {
    success: false,
    error: 'Safari bookmarks import not yet implemented'
  };
}

async function importSafariHistory(safariDir: string | null) {
  if (!safariDir) throw new Error('Safari directory not found');
  
  const historyPath = path.join(safariDir, 'History.db');
  
  if (!fs.existsSync(historyPath)) {
    throw new Error('Safari history not found');
  }
  
  const query = `
    SELECT url, title, visit_count, visit_time
    FROM history_items
    WHERE visit_count > 0
    ORDER BY visit_time DESC
    LIMIT 1000
  `;
  
  try {
    const rows = await queryDatabase(historyPath, query);
    
    const history = rows.map((row: any) => ({
      url: row.url,
      title: row.title || 'No Title',
      visitCount: row.visit_count,
      lastVisit: new Date((row.visit_time + 978307200) * 1000) // Safari epoch conversion
    }));
    
    return { success: true, history };
  } catch (error) {
    return { success: false, error: 'Safari history access failed' };
  }
}

// ─── Browser import ─────────────────────────────────────────────────────────
// Detects installed Chromium/Firefox/Safari profiles and imports bookmarks/history.

ipcMain.handle('detect-browsers', async () => {
  const paths = getBrowserPaths();
  const available: Record<string, string> = {};

  // Check Chrome
  if (paths.chrome && fs.existsSync(paths.chrome)) {
    available.chrome = 'Chrome';
  }

  // Check Edge
  if (paths.edge && fs.existsSync(paths.edge)) {
    available.edge = 'Microsoft Edge';
  }

  // Check Firefox
  if (paths.firefox) {
    const firefoxProfile = findFirefoxProfile(paths.firefox);
    if (firefoxProfile) {
      available.firefox = 'Firefox';
    }
  }

  // Check Safari (macOS only)
  if (paths.safari && fs.existsSync(paths.safari)) {
    available.safari = 'Safari';
  }

  return available;
});

ipcMain.handle('import-bookmarks', async (event, browser: string) => {
  try {
    const paths = getBrowserPaths();
    
    switch (browser) {
      case 'chrome':
      case 'edge':
        return await importChromiumBookmarks(paths[browser as keyof typeof paths]!);
      case 'firefox':
        return await importFirefoxBookmarks(paths.firefox);
      case 'safari':
        return await importSafariBookmarks(paths.safari);
      default:
        throw new Error('Unsupported browser');
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('import-history', async (event, browser: string) => {
  try {
    const paths = getBrowserPaths();
    
    switch (browser) {
      case 'chrome':
      case 'edge':
        return await importChromiumHistory(paths[browser as keyof typeof paths]!);
      case 'firefox':
        return await importFirefoxHistory(paths.firefox);
      case 'safari':
        return await importSafariHistory(paths.safari);
      default:
        throw new Error('Unsupported browser');
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});


function forceResetShortcuts() {
  console.log('Force resetting shortcuts...');
  
  // Load the current shortcuts from storage
  const shortcuts = loadShortcuts();
  
  // Completely unregister all shortcuts
  unregisterAllShortcuts();
  
  // Reset all window handlers
  resetWindowShortcuts(shortcuts);
  
  // Register shortcuts again
  if (shortcuts && shortcuts.length > 0) {
    registerShortcuts(shortcuts);
    console.log(`Re-registered ${shortcuts.length} shortcuts`);
  } else {
    console.log('No shortcuts to register');
  }
}

function loadShortcuts(): KeyboardShortcut[] {
  try {
    // Load from electron-store only
    const shortcuts = keyboardShortcutsStore.get('shortcuts') as KeyboardShortcut[];
    console.log(`Loaded ${shortcuts?.length || 0} shortcuts from electron-store`);
    return shortcuts || [];
  } catch (error) {
    console.error('Error loading shortcuts from store:', error);
    return [];
  }
}

/**
 * Unregister all shortcuts
 */
function unregisterAllShortcuts() {
  console.log(`Unregistering ${registeredShortcuts.length} shortcuts`);
  
  // Unregister all individually tracked shortcuts
  registeredShortcuts.forEach(shortcut => {
    try {
      globalShortcut.unregister(shortcut);
      console.log(`Unregistered shortcut: ${shortcut}`);
    } catch (error) {
      console.error(`Error unregistering shortcut ${shortcut}:`, error);
    }
  });
  
  // As a safety measure, also use the unregisterAll method
  try {
    globalShortcut.unregisterAll();
    console.log('Unregistered all global shortcuts');
  } catch (error) {
    console.error('Error unregistering all shortcuts:', error);
  }
  
  // Also remove all window-specific shortcut listeners
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.removeAllListeners('before-input-event');
    console.log('Removed all keyboard listeners from window:', win.id);
  });
  
  // Clear the tracking array
  registeredShortcuts = [];
}

// Finally, add a broadcast mechanism to ensure all renderers know when shortcuts change
function broadcastShortcutsUpdated(shortcuts: any) {
  // Broadcast to all windows
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('shortcuts-updated', shortcuts);
  });
}

/**
 * Clear and re-setup window-specific shortcuts for all windows
 */
function resetWindowShortcuts(shortcuts: any[]) {
  // Get all currently open windows
  BrowserWindow.getAllWindows().forEach(win => {
    // Clear existing listeners by removing all 'before-input-event' listeners
    win.webContents.removeAllListeners('before-input-event');
    
    // Set up new listeners based on current shortcuts, but make it fully dynamic
    win.webContents.on('before-input-event', (event, input) => {
      // Normalize input into our shortcut format for comparison
      const pressedKeys: string[] = [];
      if (input.control || input.meta) pressedKeys.push('Ctrl');
      if (input.alt) pressedKeys.push('Alt');
      if (input.shift) pressedKeys.push('Shift');
      
      // Convert the key name to match our format
      let mainKey = input.key.toUpperCase();
      if (mainKey === ' ') mainKey = 'Space';
      if (mainKey === 'ESCAPE') mainKey = 'Esc';
      if (mainKey === 'ARROWUP') mainKey = 'Up';
      if (mainKey === 'ARROWDOWN') mainKey = 'Down';
      if (mainKey === 'ARROWLEFT') mainKey = 'Left';
      if (mainKey === 'ARROWRIGHT') mainKey = 'Right';
      if (mainKey === 'RETURN') mainKey = 'Enter';
      
      pressedKeys.push(mainKey);
      
      // Check if this key combination matches any of our shortcuts
      const matchingShortcut = shortcuts.find((shortcut: { keys: any[] }) => {
        // Match by length first for performance
        if (shortcut.keys.length !== pressedKeys.length) return false;
        
        // Check if all shortcut keys are present in pressed keys
        return shortcut.keys.every((key: string) => 
          pressedKeys.includes(key) || 
          // Special case for normalized keys
          (key === 'Ctrl' && (pressedKeys.includes('⌘'))) ||
          (key === '⌘' && (pressedKeys.includes('Ctrl')))
        );
      });
      
      if (matchingShortcut) {
        console.log(`Intercepted ${pressedKeys.join('+')} in window, triggering action: ${matchingShortcut.action}`);
        event.preventDefault();
      }
    });
  });
  
  console.log('Reset window-specific shortcuts for all windows with dynamic handler');
}


/**
 * Handle specific shortcut actions in the main process
 */
function handleShortcutAction(action: string) {
  switch (action) {
    case 'open-history':
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('open-history-dialog');
      });
      break;
    case 'add-tab':
      BrowserWindow.getAllWindows().forEach(win => {
         win.webContents.send('add-tab-function');
      });
      break;
    case 'add-asterisk':
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('add-asterisk-function');
      });
      break;
    case 'zen-mode-trigger':
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('zen-mode-function');
      });
      break;
    case 'clipboard-quick':
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('clipboard-function');
      });
      break;
    case 'close-tab':
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('close-tab-function');
      });
      break;
    case 'pin-tab':
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('pin-tab-function');
      });
      break;
    case 'command-main':
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('command-main-function');
      });
      break;
    case 'toggle-sidebar':
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('toggle-sidebar-function');
      });
      break;
    case 'switch-tabs':
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('switch-tabs-function');
      });
      break;
    case 'print-trigger':
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('print-trigger-function');
      });
      break;
    case 'reload-trigger':
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('reload-trigger-function');
      });
      break;
    case 'browser-ai':
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('browser-ai-function');
      });
     break;
  }
}

function registerShortcuts(shortcuts: KeyboardShortcut[]) {
  // First unregister ALL existing shortcuts
  unregisterAllShortcuts();
  
  console.log(`Registering ${shortcuts.length} keyboard shortcuts (application-only)`);
  
  // Apply shortcuts to all existing windows
  BrowserWindow.getAllWindows().forEach(win => {
    // Remove any existing handlers first
    win.webContents.removeAllListeners('before-input-event');
    
    // Add a single handler for all shortcuts
    win.webContents.on('before-input-event', (event, input) => {
      // Skip if the input is not a keyDown event
      if (input.type !== 'keyDown') return;
      
      // Build the key combination that was pressed
      const pressedKeys: string[] = [];
      if (input.control || input.meta) pressedKeys.push('Ctrl');
      if (input.alt) pressedKeys.push('Alt');
      if (input.shift) pressedKeys.push('Shift');
      
      // Convert the key name to match our format
      let mainKey = input.key;
      // Handle special keys
      if (mainKey === ' ') mainKey = 'Space';
      if (mainKey === 'Escape') mainKey = 'Esc';
      if (mainKey === 'ArrowUp') mainKey = 'Up';
      if (mainKey === 'ArrowDown') mainKey = 'Down';
      if (mainKey === 'ArrowLeft') mainKey = 'Left';
      if (mainKey === 'ArrowRight') mainKey = 'Right';
      if (mainKey === 'Return' || mainKey === 'Enter') mainKey = 'Enter';
      
      // Get a single character key in uppercase for matching
      if (mainKey.length === 1) {
        mainKey = mainKey.toUpperCase();
      }
      
      pressedKeys.push(mainKey);
      
      // Check if this matches any of our registered shortcuts
      const matchingShortcut = shortcuts.find(shortcut => {
        // Skip if different number of keys
        if (shortcut.keys.length !== pressedKeys.length) return false;
        
        // Check if all keys match (order-independent)
        return shortcut.keys.every(key => 
          pressedKeys.includes(key) || 
          (key === 'Ctrl' && pressedKeys.includes('⌘')) ||
          (key === '⌘' && pressedKeys.includes('Ctrl'))
        );
      });
      
      if (matchingShortcut) {
        console.log(`Shortcut triggered: ${matchingShortcut.name} (${pressedKeys.join('+')})`);
        event.preventDefault();
        
        // Trigger the action for this shortcut
        handleShortcutAction(matchingShortcut.action);
      }
    });
    
    console.log(`Registered ${shortcuts.length} shortcuts for window ID ${win.id}`);
  });
  
  // Save shortcuts to store for future windows
saveShortcuts(shortcuts);
}

function setupShortcutIPCHandlers() {
  // Remove existing handlers to avoid duplicates
  ipcMain.removeHandler('get-keyboard-shortcuts');
  ipcMain.removeHandler('save-keyboard-shortcuts');
  ipcMain.removeHandler('check-shortcut-valid');
  ipcMain.removeHandler('force-reset-shortcuts');
  
  ipcMain.handle('get-keyboard-shortcuts', async () => {
    const shortcuts = loadShortcuts();
    console.log(`IPC: Returning ${shortcuts.length} shortcuts`);
    return shortcuts;
  });
  
  ipcMain.handle('save-keyboard-shortcuts', async (_, shortcuts: KeyboardShortcut[]) => {
    try {
      console.log('IPC: Received request to update shortcuts:', shortcuts.length);
      
      // Save to store
      saveShortcuts(shortcuts);
      
      // Unregister all existing shortcuts
      unregisterAllShortcuts();
      
      // Register the new shortcuts
      registerShortcuts(shortcuts);
      
      console.log('IPC: Successfully updated shortcuts');
      return true;
    } catch (error) {
      console.error('IPC: Failed to save keyboard shortcuts:', error);
      return false;
    }
  });
  
  ipcMain.handle('check-shortcut-valid', async (_, keys: string[]) => {
    const accelerator = convertToAccelerator(keys);
    if (!accelerator) return { valid: false, message: 'Invalid shortcut format' };
    
    if (isReservedShortcut(accelerator)) {
      return { valid: false, message: 'This shortcut is reserved by the system' };
    }
    
    return { valid: true };
  });
  
  ipcMain.handle('force-reset-shortcuts', async () => {
    try {
      forceResetShortcuts();
      return true;
    } catch (error) {
      console.error('Failed to force reset shortcuts:', error);
      return false;
    }
  });
  
  console.log('Shortcut IPC handlers registered');
}

function initializeKeyboardShortcuts() {
  console.log('Initializing keyboard shortcuts...');
  
  // Load shortcuts from store
  let shortcuts = loadShortcuts();
  
  // If no shortcuts exist, create defaults but don't save them yet
  if (!shortcuts || shortcuts.length === 0) {
    console.log('No shortcuts found, will use defaults');
    shortcuts = keyboardShortcutsStore.get('shortcuts') as KeyboardShortcut[];
    
    // Only save defaults if they don't exist in store
    if (!shortcuts || shortcuts.length === 0) {
      console.log('Creating default shortcuts');
      shortcuts = [
        { id: 'default-1', name: 'Open History Settings', keys: ['Ctrl', 'H'], action: 'open-history', isDefault: true },
        { id: 'default-2', name: 'New Tab', keys: ['Ctrl', 'T'], action: 'add-tab', isDefault: true },
        { id: 'default-3', name: 'New Asterisk', keys: ['Shift', 'T'], action: 'add-asterisk', isDefault: true },
        { id: 'default-4', name: 'Zen Mode', keys: ['Shift', 'Z'], action: 'zen-mode-trigger', isDefault: true },
        { id: 'default-5', name: 'Clipboard Quick Access', keys: ['Shift', 'C'], action: 'clipboard-quick', isDefault: true },
        { id: 'default-6', name: 'Close Tab/Asterisk', keys: ['Ctrl', 'W'], action: 'close-tab', isDefault: true },
        { id: 'default-7', name: 'New Tab Group', keys: ['Shift', 'P'], action: 'pin-tab', isDefault: true },
        { id: 'default-8', name: 'Command Main', keys: ['Ctrl', 'K'], action: 'command-main', isDefault: true },
        { id: 'default-9', name: 'Toggle Sidebar', keys: ['Ctrl', 'B'], action: 'toggle-sidebar', isDefault: true },
        { id: 'default-10', name: 'Switch Tabs', keys: ['Ctrl', 'Tab'], action: 'switch-tabs', isDefault: true },
        { id: 'default-11', name: 'Print', keys: ['Ctrl', 'P'], action: 'print-trigger', isDefault: true },
        { id: 'default-12', name: 'Reload', keys: ['Ctrl', 'R'], action: 'reload-trigger', isDefault: true },
        { id: 'default-13', name: 'Talk to Webpage', keys: ['Ctrl', 'F'], action: 'browser-ai', isDefault: true },
      ];
      saveShortcuts(shortcuts);
    }
  }
  
  // Register the shortcuts
  if (shortcuts && shortcuts.length > 0) {
    registerShortcuts(shortcuts);
    console.log(`Initialized with ${shortcuts.length} shortcuts`);
  }
  
  // Set up IPC handlers
  setupShortcutIPCHandlers();
}


// ─── Location service (Python) ──────────────────────────────────────────────
// Spawns a bundled or system Python script for GPS reverse-geocoding via Mapbox.

function getPythonPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python-embed', 'python.exe');
  }
  return 'python';
}

function getPythonScriptPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python', 'location_service.py');
  }
  return path.join(__dirname, '..', '..', 'python', 'location_service.py');
}

function checkPythonAvailability(): void {
  const pythonPath = getPythonPath();
  
  if (app.isPackaged) {
    if (!fs.existsSync(pythonPath)) {
      throw new Error('Bundled Python not found');
    }
  } else {
    try {
      spawn(pythonPath, ['--version']);
    } catch (error) {
      throw new Error('Python not found in PATH');
    }
  }
}

/** Registers IPC handlers for PDF preview, element capture, and webview printing. */
function setupPrintHandlers() {
  // Generate PDF preview from webview
  ipcMain.handle('print:generatePDFPreview', async (_event, webContentsId) => {
    try {
      console.log(`Generating PDF preview for webContentsId: ${webContentsId}`);
      const targetContents = webContents.fromId(webContentsId);
      
      if (!targetContents) {
        throw new Error(`WebContents not found for ID: ${webContentsId}`);
      }
      
      const pdfOptions = {
        printBackground: true,
        margins: {
          marginType: 'default' as 'default',
        },
        pageSize: 'A4' as 'A4',
      };
      
      console.log('Printing to PDF with options:', pdfOptions);
      const data = await targetContents.printToPDF(pdfOptions);
      return data.toString('base64');
    } catch (error) {
      console.error('Failed to generate PDF preview:', error);
      throw error;
    }
  });

  // Capture element to PDF
  ipcMain.handle('print:captureElementToPDF', async (event, selector, tabId) => {
    try {
      console.log(`Capturing element to PDF: ${selector} for tab: ${tabId}`);
      const sender = event.sender;
      
      // Create a simple PDF capture
      const data = await sender.printToPDF({
        printBackground: true,
        pageSize: 'A4' as 'A4',
        margins: {
          marginType: 'default' as 'default',
        }
      });
      
      return data.toString('base64');
    } catch (error) {
      console.error('Failed to capture element to PDF:', error);
      throw error;
    }
  });

  // Print webContents
  ipcMain.handle('print:printWebContents', async (_event, webContentsId) => {
    try {
      console.log(`Printing webContents: ${webContentsId}`);
      const targetContents = webContents.fromId(webContentsId);
      
      if (!targetContents) {
        throw new Error(`WebContents not found for ID: ${webContentsId}`);
      }
      
      // Call print method with default options
      targetContents.print({}, (success, failureReason) => {
        if (!success) {
          console.error('Print failed:', failureReason);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Failed to print webContents:', error);
      throw error;
    }
  });

  // Print data URL
  ipcMain.handle('print:printDataUrl', async (_event, dataUrl) => {
    try {
      console.log('Printing data URL');
      
      // Create a temporary window to load and print the data URL
      const win = new BrowserWindow({ 
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      
      // Load the data URL
      await win.loadURL(dataUrl);
      
      // Print it
      win.webContents.print({}, (success, failureReason) => {
        // Close the window when done
        win.close();
        
        if (!success) {
          console.error('Print failed:', failureReason);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Failed to print data URL:', error);
      throw error;
    }
  });

  console.log('Print handlers registered successfully');
}

// ─── App bootstrap ──────────────────────────────────────────────────────────
// Electron lifecycle: create window, register print handlers, attach webview policies.

app.whenReady().then(() => {

  try {
    checkPythonAvailability();
    electronApp.setAppUserModelId('com.lucid.browser')
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })
    createWindow();
    setupPrintHandlers();
  } catch (error) {
    dialog.showErrorBox(
      'Startup Error', 
      `Failed to initialize the application: ${error instanceof Error ? error.message : String(error)}\n\n` +
      'Please ensure all components are properly installed.'
    );
    app.quit();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})  

app.on('session-created', (session) => {
  console.log(session)
})

app.on('select-client-certificate', (event, _webContents, _url, list, callback) => {
  event.preventDefault()
  callback(list[0])
})

app.on('certificate-error', (event, webContents, url, error, _certificate, callback) => {
  // Prevent default behavior which would reject the certificate
  event.preventDefault();
  
  // Get the hostname from the URL
  const hostname = new URL(url).hostname;
  
  // Create a threat object for the warning
  const threats = [{ 
    threatType: 'SSL_CERTIFICATE_ERROR', 
    details: error
  }];
  
  // Find the browser window that contains this webContents
  const browserWindow = BrowserWindow.fromWebContents(webContents.hostWebContents || webContents);
  
  if (browserWindow) {
    // Send message to renderer to show the warning popup
    browserWindow.webContents.send('show-security-warning', {
      url: url,
      threats: threats
    });
  }
  
  // Reject the certificate by passing false
  callback(false);
});

app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
    // Prevent duplicate handlers for the same webContents
    const webContentsId = contents.id;
    if (activeDownloadHandlers.has(webContentsId)) {
      console.log('Download handler already exists for webContents:', webContentsId);
      return;
    }
    
    activeDownloadHandlers.add(webContentsId);
    
    contents.session.on('will-download', (event, item, webContents) => {
      const downloadId = generateDownloadId(); // ← Better ID generation
      
      // Check if this download already exists (by URL + filename)
      const existingDownload = downloads.find(d => 
        d.url === item.getURL() && d.filename === item.getFilename() && 
        (d.state === 'progressing' || d.state === 'paused')
      );
      
      if (existingDownload) {
        console.log('Download already exists, skipping duplicate:', item.getURL());
        return;
      }

      const downloadItem = {
        id: downloadId,
        filename: item.getFilename(),
        url: item.getURL(),
        totalBytes: item.getTotalBytes(),
        receivedBytes: 0,
        state: 'progressing',
        startTime: new Date().toISOString(),
        endTime: null,
        savePath: '',
        canResume: item.canResume()
      };

      downloads.unshift(downloadItem);
      downloadItems.set(downloadId, item);
      
      // Set up file path
      const downloadsPath = getMainDownloadsPath();
      const ext = path.extname(downloadItem.filename);
      const nameWithoutExt = path.basename(downloadItem.filename, ext);

      let counter = 1;
      let candidateFilename = downloadItem.filename;
      let candidatePath = path.join(downloadsPath, candidateFilename);
      while (fs.existsSync(candidatePath)) {
        candidateFilename = `${nameWithoutExt} (${counter++})${ext}`;
        candidatePath = path.join(downloadsPath, candidateFilename);
      }

      item.setSavePath(candidatePath);
      downloadItem.savePath = candidatePath;
      downloadItem.filename = candidateFilename;

      // Update handlers - make sure we're updating the RIGHT object
      item.on('updated', (event, state) => {
        // Find the download in the array and update it directly
        const downloadIndex = downloads.findIndex(d => d.id === downloadId);
        if (downloadIndex !== -1) {
          downloads[downloadIndex].receivedBytes = item.getReceivedBytes();
          downloads[downloadIndex].totalBytes = item.getTotalBytes();
          downloads[downloadIndex].state = state;
          downloads[downloadIndex].canResume = item.canResume();
          updateDownloadsUI();
        }
      });

      item.on('done', (event, state) => {
        // Find the download in the array and update it directly
        const downloadIndex = downloads.findIndex(d => d.id === downloadId);
        if (downloadIndex !== -1) {
          downloads[downloadIndex].state = state;
          downloads[downloadIndex].endTime = new Date().toISOString();
          downloads[downloadIndex].canResume = item.canResume();
          updateDownloadsUI();
        }

        if (state === 'completed' || state === 'cancelled') {
          setTimeout(() => {
            downloadItems.delete(downloadId);
          }, 60000);
        }
      });
      
      updateDownloadsUI();
    });

    // Clean up when webContents is destroyed
    contents.on('destroyed', () => {
      activeDownloadHandlers.delete(webContentsId);
    });
  }
    if (contents.getType() === 'webview') {
  // Set up for ALL webContents, not just webviews
  contents.setWindowOpenHandler((details) => {
    // Send to ALL windows
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('create-new-tab', details.url);
    });
    return { action: 'deny' };
  });

  // Add webview specific handlers
  if (contents.getType() === 'webview') {
    console.log('🚀 Main Process - Webview created, setting up handlers')

    contents.on('did-start-loading', () => {
      console.log('🚀 Main Process - Webview started loading')
    })

    contents.on('did-finish-load', () => {
      console.log('🚀 Main Process - Webview finished loading')
      console.log('🚀 Main Process - Preload scripts:', contents.session.getPreloads())
    })
  }

  if (contents.getType() === 'webview') {
    console.log('🚀 Main Process - Webview created, setting up context menu handler');
    
    // Add direct context menu handler for webviews
contents.on('context-menu', (_event, params) => {
      console.log('Context menu event in webview:', contents.id);
      
      const menuTemplate: (Electron.MenuItemConstructorOptions)[] = [];
      
      // Navigation options
      menuTemplate.push({ 
        label: 'Back', 
        enabled: contents.canGoBack(),
        click: () => contents.goBack() 
      });
      
      menuTemplate.push({ 
        label: 'Forward', 
        enabled: contents.canGoForward(),
        click: () => contents.goForward() 
      });
      
      menuTemplate.push({ 
        label: 'Reload', 
        click: () => contents.reload() 
      });
      
      menuTemplate.push({ type: 'separator' });

      menuTemplate.push({ 
        label: 'Share Link', 
        click: () => {
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('open-share-link-dropdown');
          });
        } 
      });
      
      menuTemplate.push({ 
        label: 'Print', 
        click: () => {
          const webContentsId = contents.id;
          console.log('Print requested for webContentsId:', webContentsId);
          
          // Find the browser window that contains this webview
          const browserWindow = BrowserWindow.fromWebContents(contents.hostWebContents || contents);
          if (browserWindow) {
            browserWindow.webContents.send('print-requested', webContentsId);
          }
        } 
      });

      menuTemplate.push({ 
        label: 'Settings', 
        click: () => {
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('open-settings');
          });
        } 
      });
      
      // Add Link handling if available
      if (params.linkURL) {
        menuTemplate.push({ type: 'separator' });
        menuTemplate.push({ 
          label: 'Open Link in New Tab', 
          click: () => {
            BrowserWindow.getAllWindows().forEach(win => {
              win.webContents.send('new-tab-from-context', params.linkURL);
            });
          } 
        });
        menuTemplate.push({ 
          label: 'Copy Link Address', 
          click: () => clipboard.writeText(params.linkURL) 
        });
      }
      
      // Add text handling if there's selected text
      if (params.selectionText) {
        menuTemplate.push({ type: 'separator' });
        menuTemplate.push({ 
          label: 'Copy', 
          click: () => clipboard.writeText(params.selectionText) 
        });
      }
      
      // Add image handling if available
      if (params.srcURL) {
        menuTemplate.push({ type: 'separator' });
        
        // Copy image URL option
        menuTemplate.push({
          label: 'Copy Image Address',
          click: () => clipboard.writeText(params.srcURL)
        });
        
        menuTemplate.push({
          label: 'Download Image',
          click: () => {
            const webContentsObj = contents;
            if (webContentsObj) {
              webContentsObj.downloadURL(params.srcURL);
            }
          }
        });
      }
      
      // Add edit options for input fields
      if (params.isEditable) {
        if (!menuTemplate.some(item => item.label === 'Copy')) {
          menuTemplate.push({ 
            label: 'Copy', 
            role: 'copy' 
          });
        }
        menuTemplate.push({ 
          label: 'Cut', 
          role: 'cut' 
        });
        menuTemplate.push({ 
          label: 'Paste', 
          role: 'paste' 
        });
      }
      
      menuTemplate.push({ type: 'separator' });
      
      menuTemplate.push({ 
        label: 'Zen Mode', 
        click: () => {
          // First send an event to toggle the isZenMode state
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('toggle-zen-mode-state');
          });
          
          // Then send an event to apply the reading mode
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('toggle-zen-mode');
          });
        } 
      });
      
      // Inspect element option
      menuTemplate.push({ 
        label: 'Inspect Element', 
        click: () => {
          if (params.x !== undefined && params.y !== undefined) {
            contents.inspectElement(params.x, params.y);
          }
        } 
      });
      
      const menu = Menu.buildFromTemplate(menuTemplate);
      const browserWindow = BrowserWindow.fromWebContents(contents.hostWebContents);
      if (browserWindow) {
        menu.popup({ window: browserWindow });
      } else {
        menu.popup();
      }
    });
  }
}})

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  unregisterAllShortcuts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})