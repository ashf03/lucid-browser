/**
 * Intercepts Electron session permission requests and routes them to the renderer
 * for user approval (camera, mic, geolocation, notifications, screen capture).
 *
 * Flow: webview requests permission → PermissionManager queues a prompt →
 * renderer shows PermissionDialog → user choice sent back via IPC →
 * session callback invoked with grant/deny.
 */
import { app, BrowserWindow, session, ipcMain, desktopCapturer } from 'electron';

interface PermissionRequestData {
  id: number;
  permission: string;
  displayName: string;
  description: string;
  icon: string;
  origin: string;
  details: any;
}

export class PermissionManager {
  private pendingRequests = new Map<number, any>();
  private requestCounter = 0;
  private permissionHistory = new Map<string, boolean>();

  constructor() {
    this.setupIpcHandlers();
  }

  // Permission data mapping
  private getPermissionData(permission: string, details: any = {}) {
    const permissionMap = {
      'camera': { 
        displayName: 'Camera', 
        description: 'Access your camera', 
        icon: '📹' 
      },
      'microphone': { 
        displayName: 'Microphone', 
        description: 'Access your microphone', 
        icon: '🎤' 
      },
      'display-capture': { 
        displayName: 'Screen Share', 
        description: 'Share your screen', 
        icon: '🖥️' 
      },
      'geolocation': { 
        displayName: 'Location', 
        description: 'Access your location', 
        icon: '📍' 
      },
      'notifications': { 
        displayName: 'Notifications', 
        description: 'Show notifications', 
        icon: '🔔' 
      },
      'clipboard-read': { 
        displayName: 'Read Clipboard', 
        description: 'Read clipboard content', 
        icon: '📋' 
      },
      'clipboard-write': { 
        displayName: 'Write Clipboard', 
        description: 'Write to clipboard', 
        icon: '📝' 
      },
      'midi': { 
        displayName: 'MIDI', 
        description: 'Access MIDI devices', 
        icon: '🎹' 
      },
      'usb': { 
        displayName: 'USB', 
        description: 'Access USB devices', 
        icon: '🔌' 
      },
      'bluetooth': { 
        displayName: 'Bluetooth', 
        description: 'Access Bluetooth devices', 
        icon: '📶' 
      }
    };

    const data = permissionMap[permission as keyof typeof permissionMap] || {
      displayName: 'Unknown Permission',
      description: 'Grant unknown permission',
      icon: '❓'
    };

    return { permission, ...data };
  }

  // Get origin from URL
  private getOrigin(url: string) {
    try {
      return new URL(url).origin;
    } catch {
      return url || 'Unknown';
    }
  }

  // Format origin for display
  private formatOrigin(origin: string) {
    try {
      const url = new URL(origin);
      return url.hostname.replace('www.', '');
    } catch {
      return origin;
    }
  }

  // Send permission request to renderer
  private sendPermissionRequest(requestData: PermissionRequestData) {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('permission-request', requestData);
    });
  }

  // Handle standard permission requests
  private handleStandardPermission(webContents: Electron.WebContents, permission: string, callback: (granted: boolean) => void, details: any) {
    const requestId = ++this.requestCounter;
    const origin = this.getOrigin(webContents.getURL());
    
    this.pendingRequests.set(requestId, { 
      callback,
      type: 'standard',
      permission,
      origin
    });

    const permissionData = this.getPermissionData(permission, details);
    
    this.sendPermissionRequest({
      id: requestId,
      permission: permissionData.permission,
      displayName: permissionData.displayName,
      description: permissionData.description,
      icon: permissionData.icon,
      origin: this.formatOrigin(origin),
      details: details || {}
    });
  }

  // Handle display media (screen share) requests
  private async handleDisplayMediaRequest(request: any, callback: (result: any) => void) {
    const requestId = ++this.requestCounter;
    const origin = 'Screen Share Request';
    
    this.pendingRequests.set(requestId, {
      callback,
      type: 'display-media',
      originalRequest: request,
      permission: 'display-capture',
      origin
    });

    this.sendPermissionRequest({
      id: requestId,
      permission: 'display-capture',
      displayName: 'Screen Share',
      description: 'Allow screen sharing access',
      icon: '🖥️',
      origin: 'Screen Share Request',
      details: {
        video: request.video !== false,
        audio: request.audio === true,
        preferCurrentTab: request.preferCurrentTab === true
      }
    });
  }

  // Handle display media response
  private async handleDisplayMediaResponse(granted: boolean, callback: any, originalRequest: any) {
    if (!granted) {
      callback({});
      return;
    }

    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 150, height: 150 }
      });

      if (sources.length === 0) {
        console.warn('No screen sources available');
        callback({});
        return;
      }

      // Find the best source (prefer primary screen)
      let selectedSource = sources.find(source => 
        source.id.startsWith('screen:') && source.name.includes('1')
      ) || sources.find(source => 
        source.id.startsWith('screen:')
      ) || sources[0];

      console.log(`Selected screen source: ${selectedSource.name} (${selectedSource.id})`);

      const result: any = {};
      
      if (originalRequest.video !== false) {
        result.video = {
          id: selectedSource.id,
          name: selectedSource.name
        };
      }
      
      if (originalRequest.audio === true) {
        result.audio = {
          id: selectedSource.id,
          name: selectedSource.name
        };
      }

      callback(result);
    } catch (error) {
      console.error('Error getting desktop sources:', error);
      callback({});
    }
  }

  // Setup IPC handlers
  private setupIpcHandlers() {
    // Handle permission responses from renderer
    ipcMain.on('permission-response', async (event, data) => {
      const request = this.pendingRequests.get(data.id);
      if (!request) return;

      // Store permission decision for history
      const key = `${request.origin}:${request.permission}`;
      this.permissionHistory.set(key, data.granted);

      try {
        switch (request.type) {
          case 'standard':
            request.callback(data.granted);
            break;
          case 'display-media':
            await this.handleDisplayMediaResponse(data.granted, request.callback, request.originalRequest);
            break;
          default:
            request.callback(data.granted);
        }
      } catch (error) {
        console.error('Error handling permission response:', error);
        request.callback(false);
      }

      this.pendingRequests.delete(data.id);
    });

    // Get permission history
    ipcMain.handle('get-permission-history', () => {
      return Array.from(this.permissionHistory.entries());
    });

    // Clear permission history
    ipcMain.on('clear-permission-history', () => {
      this.permissionHistory.clear();
    });
  }

  // Setup comprehensive permission handling
  public setupPermissionHandling() {
    const defaultSession = session.defaultSession;

    // Standard permission request handler - ALWAYS show dialog
    defaultSession.setPermissionRequestHandler(
      (webContents, permission, callback, details) => {
        this.handleStandardPermission(webContents, permission, callback, details);
      }
    );

// In PermissionManager class, update the permission check handler:
defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
  try {
    const origin = this.getOrigin(requestingOrigin || (webContents ? webContents.getURL() : ''));
    const key = `${origin}:${permission}`;
    
    // Use the same store instance as the main process
    const Store = require('electron-store');
    const store = new Store({ name: 'browser-history' }); // Same name as main store
    const storedPermissions = store.get('permissions', {});
    
    const storedPermission = storedPermissions[key];
    
    if (storedPermission === 'granted') {
      console.log(`✅ Permission check: ${key} = granted (from storage)`);
      return true;
    } else if (storedPermission === 'denied') {
      console.log(`❌ Permission check: ${key} = denied (from storage)`);
      return false;
    }
    
    console.log(`❓ Permission check: ${key} = no stored permission, showing dialog`);
    return false;
  } catch (error) {
    console.error('Error checking stored permission:', error);
    return false;
  }
});

    // Display media (screen share) handler - ALWAYS show dialog
    defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
      await this.handleDisplayMediaRequest(request, callback);
    });

    // Handle webview permissions
    app.on('web-contents-created', (event, contents) => {
      // Handle permission requests from webviews
      contents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
        this.handleStandardPermission(webContents, permission, callback, details);
      });

      // Handle display media for webviews
      contents.session.setDisplayMediaRequestHandler(async (request, callback) => {
        await this.handleDisplayMediaRequest(request, callback);
      });

      // Ensure webview permission checks also always return false
      contents.session.setPermissionCheckHandler(() => {
        return false;
      });
    });

    console.log('Permission handling setup complete');
  }
}

// Create and export a singleton instance
export const permissionManager = new PermissionManager();