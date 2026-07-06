import { contextBridge, ipcRenderer } from 'electron'
import type { HistoryEntry, IElectronAPI, ThemeType } from '../types/types'
        
        // Custom error for debugging IPC calls
        class IPCError extends Error {
          constructor(method: string, error: unknown) {
            super(`IPC ${method} failed: ${error}`)
            this.name = 'IPCError'
          }
        }
        
        // Expose the store API to the renderer process
        const api: IElectronAPI = {
          store: {
            set: async (key: string, value: unknown) => {
              try {
                console.log('IPC store:set called with:', { key, value })
                const result = await ipcRenderer.invoke('store:set', key, value)
                console.log('IPC store:set result:', result)
                return result
              } catch (error) {
                console.error('IPC store:set error:', error)
                throw new IPCError('store:set', error)
              }
            },
            get: async (key: string) => {
              try {
                console.log('IPC store:get called with:', key)
                const result = await ipcRenderer.invoke('store:get', key)
                console.log('IPC store:get result:', result)
                return result
              } catch (error) {
                console.error('IPC store:get error:', error)
                throw new IPCError('store:get', error)
              }
            },
            delete: async (key: string) => {
              try {
                return await ipcRenderer.invoke('store:delete', key)
              } catch (error) {
                throw new IPCError('store:delete', error)
              }
            }
          },
          auth: {
  saveSession: async (session: any) => {
    try {
      return await ipcRenderer.invoke('auth:saveSession', session);
    } catch (error) {
      console.error('IPC auth:saveSession error:', error);
      throw new IPCError('auth:saveSession', error);
    }
  },
  getSession: async () => {
    try {
      return await ipcRenderer.invoke('auth:getSession');
    } catch (error) {
      console.error('IPC auth:getSession error:', error);
      throw new IPCError('auth:getSession', error);
    }
  },
  clearSession: async () => {
    try {
      return await ipcRenderer.invoke('auth:clearSession');
    } catch (error) {
      console.error('IPC auth:clearSession error:', error);
      throw new IPCError('auth:clearSession', error);
    }
  },
  saveProfile: async (userId: string, profile: any) => {
    try {
      return await ipcRenderer.invoke('auth:saveProfile', userId, profile);
    } catch (error) {
      console.error('IPC auth:saveProfile error:', error);
      throw new IPCError('auth:saveProfile', error);
    }
  },
  getProfile: async (userId: string) => {
    try {
      return await ipcRenderer.invoke('auth:getProfile', userId);
    } catch (error) {
      console.error('IPC auth:getProfile error:', error);
      throw new IPCError('auth:getProfile', error);
    }
  }
},
setup: {
  check: () => ipcRenderer.invoke('setup:check'),
  reset: () => ipcRenderer.invoke('setup:reset'),
  complete: () => ipcRenderer.invoke('setup:complete')
},
          handleNewTab: (url: string) => {
            console.log('🚀 Preload - handleNewTab called with URL:', url)
            ipcRenderer.sendToHost('new-tab', url)
          },
          theme: {
            change: async (theme: ThemeType) => {
              try {
                return await ipcRenderer.invoke('theme:change', theme)
              } catch (error) {
                throw new IPCError('theme:change', error)
              }
            }
          },
          ipcRenderer: {
            invoke: (channel: string, ...args: any[]) => {
              const validChannels = [
                'search-serp',
                'search-images',
                'search-videos',
                'search-maps',
                'get-location',
                'get-memory-usage',
                'search-shopping',
                'search-youtube',
                'search-autocomplete',
                'open-general-file-dialog',
                'open-audio-file-dialog',
                'open-image-file-dialog',
                'convert-file',
                'generate-speech',
                'process-folder-or-zip',
                'save-blob',
                'transcribe-audio',
                'scrape-url',
                'fetch-youtube-transcript',
                'adblocker:enable',
                'adblocker:disable',
                'adblocker:status', 
                'adblocker:stats',
                      'navigate-floating-input',
      'move-floating-input',
        'get-window-sources',
  'get-screen-sources',
  'source-selected',
  'share-cancelled',
  'setup-webview-handler',
    'get-permission-history',
  'clear-permission-history',
    'permissions:save',
  'permissions:get', 
  'permissions:getAll',
  'permissions:delete',
  'permissions:clear',
  'permissions:saveHistory',
  'permissions:getHistory',
  'permissions:clearHistory',
  'downloads:getAll',
'downloads:clearAll', 
'downloads:openFileLocation',
'downloads:pause',
'downloads:resume',
'downloads:cancel',
'downloads:delete',
'downloads:redownload',
'save-page',
  'detect-browsers',
  'import-bookmarks', 
  'import-history',
    'history:add',
  'history:getAll', 
  'history:search',
  'history:delete',
  'history:clear',
  'history:deleteByDateRange',
              ];
              if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
              }
              throw new Error(`Unauthorized IPC channel: ${channel}`);
            }
          },
          spellChecker: {
            replaceMisspelling: (suggestion: string) => {
              ipcRenderer.send('replace-misspelling', suggestion)
            }
          },
          browserImport: {
  detectBrowsers: async () => {
    try {
      return await ipcRenderer.invoke('detect-browsers');
    } catch (error) {
      throw new IPCError('detect-browsers', error);
    }
  },
  importBookmarks: async (browser: string) => {
    try {
      return await ipcRenderer.invoke('import-bookmarks', browser);
    } catch (error) {
      throw new IPCError('import-bookmarks', error);
    }
  },
  importHistory: async (browser: string) => {
    try {
      return await ipcRenderer.invoke('import-history', browser);
    } catch (error) {
      throw new IPCError('import-history', error);
    }
  }
},
  history: {
    add: async (entry: HistoryEntry) => {
      try {
        return await ipcRenderer.invoke('history:add', entry);
      } catch (error) {
        throw new IPCError('history:add', error);
      }
    },
    getAll: async () => {
      try {
        return await ipcRenderer.invoke('history:getAll');
      } catch (error) {
        throw new IPCError('history:getAll', error);
      }
    },
    search: async (query: string) => {
      try {
        return await ipcRenderer.invoke('history:search', query);
      } catch (error) {
        throw new IPCError('history:search', error);
      }
    },
    delete: async (url: string) => {
      try {
        return await ipcRenderer.invoke('history:delete', url);
      } catch (error) {
        throw new IPCError('history:delete', error);
      }
    },
    clear: async () => {
      try {
        return await ipcRenderer.invoke('history:clear');
      } catch (error) {
        throw new IPCError('history:clear', error);
      }
    },
    deleteByDateRange: async (startDate: string, endDate: string) => {
      try {
        return await ipcRenderer.invoke('history:deleteByDateRange', startDate, endDate);
      } catch (error) {
        throw new IPCError('history:deleteByDateRange', error);
      }
    },
  },
          devTools: {
            toggle: (webContentsId: number) => 
              ipcRenderer.invoke('toggle-webview-devtools', webContentsId),
            getState: (webContentsId: number) => 
              ipcRenderer.invoke('get-devtools-state', webContentsId),
            closeForTab: (tabId: string) => 
              ipcRenderer.invoke('close-devtools-for-tab', tabId),
            mapTabToWebContents: (tabId: string, webContentsId: number) => 
              ipcRenderer.invoke('map-tab-to-webcontents', tabId, webContentsId),
          },
          downloads: {
  getAll: () => ipcRenderer.invoke('downloads:getAll'),
  clearAll: () => ipcRenderer.invoke('downloads:clearAll'),
  openFileLocation: (downloadId: string) => ipcRenderer.invoke('downloads:openFileLocation', downloadId),
  pause: (downloadId: string) => ipcRenderer.invoke('downloads:pause', downloadId),
  resume: (downloadId: string) => ipcRenderer.invoke('downloads:resume', downloadId),
  cancel: (downloadId: string) => ipcRenderer.invoke('downloads:cancel', downloadId),
  delete: (downloadId: string) => ipcRenderer.invoke('downloads:delete', downloadId),
  redownload: (downloadId: string) => ipcRenderer.invoke('downloads:redownload', downloadId),
  onUpdate: (callback: (downloads: any[]) => void) => {
    ipcRenderer.on('update-downloads', (event, downloads) => callback(downloads));
    return () => ipcRenderer.removeAllListeners('update-downloads');
  }
},
          security: {
            onSecurityWarning: (callback: (arg0: any) => void) => {
              ipcRenderer.on('show-security-warning', (event, data) => callback(data));
            },
            
            proceedAnyway: (url: any) => {
              ipcRenderer.send('user-proceed-anyway', url);
            }
          },
          messages: {
            save: (tabId: string, messages: any[]) => 
              ipcRenderer.invoke('save-messages', tabId, messages),
            load: (tabId: string) => 
              ipcRenderer.invoke('load-messages', tabId)
          },
permissions: {
  // Save a permission decision
  save: async (origin: string, permission: string, granted: boolean) => {
    try {
      return await ipcRenderer.invoke('permissions:save', origin, permission, granted);
    } catch (error) {
      throw new IPCError('permissions:save', error);
    }
  },

  // Get a specific permission status
  get: async (origin: string, permission: string) => {
    try {
      return await ipcRenderer.invoke('permissions:get', origin, permission);
    } catch (error) {
      throw new IPCError('permissions:get', error);
    }
  },

  // Get all permissions
  getAll: async () => {
    try {
      return await ipcRenderer.invoke('permissions:getAll');
    } catch (error) {
      throw new IPCError('permissions:getAll', error);
    }
  },

  // Delete a specific permission
  delete: async (origin: string, permission: string) => {
    try {
      return await ipcRenderer.invoke('permissions:delete', origin, permission);
    } catch (error) {
      throw new IPCError('permissions:delete', error);
    }
  },

  // Clear all permissions
  clear: async () => {
    try {
      return await ipcRenderer.invoke('permissions:clear');
    } catch (error) {
      throw new IPCError('permissions:clear', error);
    }
  },

  // History methods
  saveHistory: async (historyItem: any) => {
    try {
      return await ipcRenderer.invoke('permissions:saveHistory', historyItem);
    } catch (error) {
      throw new IPCError('permissions:saveHistory', error);
    }
  },

  getHistory: async () => {
    try {
      return await ipcRenderer.invoke('permissions:getHistory');
    } catch (error) {
      throw new IPCError('permissions:getHistory', error);
    }
  },

  clearHistory: async () => {
    try {
      return await ipcRenderer.invoke('permissions:clearHistory');
    } catch (error) {
      throw new IPCError('permissions:clearHistory', error);
    }
  },

  // Keep existing methods for compatibility
  sendResponse: (data: { id: number; granted: boolean }) => {
    ipcRenderer.send('permission-response', data);
  }
},

          print: {
            // Generate PDF preview from a webview
            generatePDFPreview: (webContentsId: number) => 
              ipcRenderer.invoke('print:generatePDFPreview', webContentsId),
              
            // Capture an element to PDF
            captureElementToPDF: (selector: string, tabId: string) => 
              ipcRenderer.invoke('print:captureElementToPDF', selector, tabId),
              
            // Print a webview using the system print dialog
            printWebContents: (webContentsId: number) => 
              ipcRenderer.invoke('print:printWebContents', webContentsId),
              
            // Print a data URL using the system print dialog
            printDataUrl: (dataUrl: string) => 
              ipcRenderer.invoke('print:printDataUrl', dataUrl),
          },
          cleanup: {
            forTab: (tabId: any) => ipcRenderer.invoke('cleanup-tab-data', tabId)
          },
          keyboardShortcuts: {
            get: async () => {
              try {
                return await ipcRenderer.invoke('get-keyboard-shortcuts');
              } catch (error) {
                console.error('IPC get-keyboard-shortcuts error:', error);
                throw new IPCError('get-keyboard-shortcuts', error);
              }
            },
            save: async (shortcuts) => {
              try {
                return await ipcRenderer.invoke('save-keyboard-shortcuts', shortcuts);
              } catch (error) {
                console.error('IPC save-keyboard-shortcuts error:', error);
                throw new IPCError('save-keyboard-shortcuts', error);
              }
            },
            checkValid: async (keys) => {
              try {
                return await ipcRenderer.invoke('check-shortcut-valid', keys);
              } catch (error) {
                console.error('IPC check-shortcut-valid error:', error);
                throw new IPCError('check-shortcut-valid', error);
              }
            },
            forceReset: async () => {
              try {
                return await ipcRenderer.invoke('force-reset-shortcuts');
              } catch (error) {
                console.error('IPC force-reset-shortcuts error:', error);
                throw new IPCError('force-reset-shortcuts', error);
              }
            }
          },
          youtube: {
            fetchTranscript: (url: string) => ipcRenderer.invoke('fetch-youtube-transcript', url)
          },
      factoryResetBrowser: () => ipcRenderer.send('factory-reset-app'),
    restartApp: () => ipcRenderer.send('restart-app'),
    adBlocker: {
  enable: () => ipcRenderer.invoke('adblocker:enable'),
  disable: () => ipcRenderer.invoke('adblocker:disable'),
  getStatus: () => ipcRenderer.invoke('adblocker:status'),
  getStats: () => ipcRenderer.invoke('adblocker:stats')
},
progress: {
  start: () => ipcRenderer.send('start-progress'),
  setProgress: (value: number) => ipcRenderer.invoke('set-progress', value),
  onUpdate: (callback: (progress: number) => void) => {
    ipcRenderer.on('progress-update', (_, progress) => callback(progress));
  },
  onComplete: (callback: () => void) => {
    ipcRenderer.on('progress-complete', () => callback());
  },
},
    window: {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),
    onMaximized: (callback: () => void) => {
      ipcRenderer.on('window-maximized', callback);
    },
    onUnmaximized: (callback: () => void) => {
      ipcRenderer.on('window-unmaximized', callback);
    },
    onFocused: (callback: () => void) => {
      ipcRenderer.on('window-focused', callback);
    },
    onBlurred: (callback: () => void) => {
      ipcRenderer.on('window-blurred', callback);
    }
  },
    screenShare: {
    getWindowSources: async () => {
      try {
        return await ipcRenderer.invoke('get-window-sources');
      } catch (error) {
        throw new IPCError('get-window-sources', error);
      }
    },
    getScreenSources: async () => {
      try {
        return await ipcRenderer.invoke('get-screen-sources');
      } catch (error) {
        throw new IPCError('get-screen-sources', error);
      }
    },
    selectSource: async (sourceId: string) => {
      try {
        return await ipcRenderer.invoke('source-selected', sourceId);
      } catch (error) {
        throw new IPCError('source-selected', error);
      }
    },
    cancelShare: async () => {
      try {
        return await ipcRenderer.invoke('share-cancelled');
      } catch (error) {
        throw new IPCError('share-cancelled', error);
      }
    },
    setupWebviewHandler: async (webContentsId: number) => {
      try {
        return await ipcRenderer.invoke('setup-webview-handler', webContentsId);
      } catch (error) {
        throw new IPCError('setup-webview-handler', error);
      }
    }
  },
        }

        ipcRenderer.on('window-maximized', () => {
  document.dispatchEvent(new CustomEvent('window-maximized'));
});

ipcRenderer.on('window-unmaximized', () => {
  document.dispatchEvent(new CustomEvent('window-unmaximized'));
});

ipcRenderer.on('window-focused', () => {
  document.dispatchEvent(new CustomEvent('window-focused'));
});

ipcRenderer.on('window-blurred', () => {
  document.dispatchEvent(new CustomEvent('window-blurred'));
});

        ipcRenderer.on('progress-update', (_, progress) => {
  document.dispatchEvent(new CustomEvent('progress-update', { 
    detail: { progress } 
  }));
});

ipcRenderer.on('progress-complete', () => {
  document.dispatchEvent(new CustomEvent('progress-complete'));
});
        
        ipcRenderer.on('show-permission-prompt', (_, data) => {
          // Dispatch a custom event that the renderer can listen for
          document.dispatchEvent(new CustomEvent('show-permission-prompt', { 
            detail: data 
          }));
        });
        
        ipcRenderer.on('devtools-state-changed', (_, webContentsId, isOpen) => {
          document.dispatchEvent(new CustomEvent('devtools-state-changed', { 
            detail: { webContentsId, isOpen }
          }));
        });
        
        ipcRenderer.on('toggle-webview-devtools', () => {
          document.dispatchEvent(new CustomEvent('toggle-webview-devtools'));
        });
        
        ipcRenderer.on('new-tab-from-context', (_, url) => {
          document.dispatchEvent(new CustomEvent('new-tab-from-context', { 
            detail: { url } 
          }));
        });

        // Add this to your preload script after the existing IPC listeners
ipcRenderer.on('navigate-main-view', (_, url) => {
  console.log('Received navigation event from floating input:', url);
  // Dispatch a custom event that the SimpleBrowser can listen for
  window.dispatchEvent(new CustomEvent('navigate-main-view', { 
    detail: url 
  }));
});

ipcRenderer.on('browser:create-new-tab', (_, url) => {
  console.log('Received create new tab event:', url);
  document.dispatchEvent(new CustomEvent('browser:create-new-tab', { 
    detail: { url } 
  }));
});

        
        // Add listener for Zen Mode toggle from context menu
        ipcRenderer.on('toggle-zen-mode', () => {
          document.dispatchEvent(new CustomEvent('toggle-zen-mode'));
        });
        
        ipcRenderer.on('toggle-zen-mode-state', () => {
          document.dispatchEvent(new CustomEvent('toggle-zen-mode-state'));
        });
        
        ipcRenderer.on('open-share-link-dropdown', () => {
          document.dispatchEvent(new CustomEvent('open-share-link-dropdown'));
        });
        
        ipcRenderer.on('open-settings', () => {
          document.dispatchEvent(new CustomEvent('open-settings'));
        });
        
        ipcRenderer.on('show-security-warning', (_, data) => {
          document.dispatchEvent(new CustomEvent('show-security-warning', { 
            detail: data 
          }));
        });

        ipcRenderer.on('print-requested', (_, webContentsId) => {
          console.log('Forwarding print request to renderer for webContentsId:', webContentsId);
          // Dispatch a custom event to the renderer
          window.dispatchEvent(new CustomEvent('print-requested', { 
            detail: webContentsId 
          }));
        });
        
        // Add this specifically for the history dialog shortcut (Ctrl+H)
        ipcRenderer.on('open-history-dialog', () => {
          console.log('History shortcut (Ctrl+H) triggered');
          document.dispatchEvent(new CustomEvent('openSettingsDialog', { 
            detail: { selectedTab: 1 } // Tab index for history
          }));
        });

        ipcRenderer.on('add-tab-function', () => {
          console.log('adding new tab');
          document.dispatchEvent(new CustomEvent('addTab'));
        });

        ipcRenderer.on('add-asterisk-function', () => {
          console.log('adding new asterisk tab');
          document.dispatchEvent(new CustomEvent('addAsterisk'));
        });

        ipcRenderer.on('zen-mode-function', () => {
          console.log('turning on zen mode');
          document.dispatchEvent(new CustomEvent('ZenModeOn'));
        });

        ipcRenderer.on('clipboard-function', () => {
          console.log('opening clipboard quick access');
          document.dispatchEvent(new CustomEvent('ClipboardTurnOn'));
        });

        ipcRenderer.on('create-new-tab', (_, url) => {
  console.log('Received create new tab event:', url);
  document.dispatchEvent(new CustomEvent('create-new-tab', { 
    detail: { url } 
  }));
});

        ipcRenderer.on('close-tab-function', () => {
          console.log('closing tab');
          document.dispatchEvent(new CustomEvent('closeTab'));
        });

        ipcRenderer.on('pin-tab-function', () => {
          console.log('toggling pin tabs');
          document.dispatchEvent(new CustomEvent('pinTab'));
        });

        ipcRenderer.on('command-main-function', () => {
          console.log('toggling command main');
          document.dispatchEvent(new CustomEvent('commandMain'));
        });

        ipcRenderer.on('toggle-sidebar-function', () => {
          console.log('toggling sidebar');
          document.dispatchEvent(new CustomEvent('toggleSidebar'));
        });

        ipcRenderer.on('switch-tabs-function', () => {
          console.log('switching tabs');
          document.dispatchEvent(new CustomEvent('switchTabs'));
        });

        ipcRenderer.on('print-trigger-function', () => {
          console.log('printing');
          document.dispatchEvent(new CustomEvent('printTrigger'));
        });

        ipcRenderer.on('reload-trigger-function', () => {
          console.log('reloading');
          document.dispatchEvent(new CustomEvent('reloadTrigger'));
        });

        ipcRenderer.on('browser-ai-function', () => {
          console.log('ai browser function');
          document.dispatchEvent(new CustomEvent('browserAI'));
        });
        
        ipcRenderer.on('shortcuts-updated', (_, shortcuts) => {
          console.log('Received shortcuts update from main process');
          // Dispatch a custom event with the updated shortcuts
          document.dispatchEvent(new CustomEvent('shortcuts-updated', { 
            detail: { shortcuts } 
          }));
          
          // Also dispatch to window for components that might listen there
          window.dispatchEvent(new CustomEvent('shortcuts-updated', { 
            detail: { shortcuts } 
          }));
        });

        ipcRenderer.on('show-share-panel', () => {
  console.log('📨 Received show-share-panel event');
  document.dispatchEvent(new CustomEvent('show-share-panel'));
});

ipcRenderer.on('permission-request', (_, data) => {
  console.log('🔒 Received permission request:', data);
  // Dispatch a custom event that the PermissionManager component can listen for
  document.dispatchEvent(new CustomEvent('permission-request', { 
    detail: data 
  }));
});
        
        contextBridge.exposeInMainWorld('electronAPI', api)