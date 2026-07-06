/**
 * Thin wrapper around permissions:* IPC channels.
 * Persists grant/deny decisions and permission history in electron-store.
 */
export interface PermissionResult {
  success: boolean;
  error?: string;
}

export interface StoredPermission {
  origin: string;
  permission: string;
  status: 'granted' | 'denied';
  timestamp: string;
}

export class PermissionService {
  /**
   * Save a permission decision
   */
  static async savePermission(
    origin: string, 
    permission: string, 
    granted: boolean
  ): Promise<PermissionResult> {
    try {
      const result = await window.electronAPI.permissions.save(origin, permission, granted);
      
      // Also save to history
      await this.addToHistory({
        permission,
        origin,
        granted,
        timestamp: new Date().toLocaleString()
      });
      
      // Dispatch event to notify other components
      document.dispatchEvent(new CustomEvent('permissions-changed', {
        detail: { origin, permission, granted }
      }));
      
      return result;
    } catch (error) {
      console.error('Failed to save permission:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get a specific permission status
   */
  static async getPermission(origin: string, permission: string): Promise<string | null> {
    try {
      return await window.electronAPI.permissions.get(origin, permission);
    } catch (error) {
      console.error('Failed to get permission:', error);
      return null;
    }
  }

  /**
   * Get all permissions
   */
  static async getAllPermissions(): Promise<Record<string, string>> {
    try {
      return await window.electronAPI.permissions.getAll();
    } catch (error) {
      console.error('Failed to get all permissions:', error);
      return {};
    }
  }

  /**
   * Delete a specific permission
   */
  static async deletePermission(origin: string, permission: string): Promise<PermissionResult> {
    try {
      const result = await window.electronAPI.permissions.delete(origin, permission);
      
      // Dispatch event to notify other components
      document.dispatchEvent(new CustomEvent('permissions-changed', {
        detail: { origin, permission, deleted: true }
      }));
      
      return result;
    } catch (error) {
      console.error('Failed to delete permission:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Clear all permissions
   */
  static async clearAllPermissions(): Promise<PermissionResult> {
    try {
      const result = await window.electronAPI.permissions.clear();
      
      // Dispatch event to notify other components
      document.dispatchEvent(new CustomEvent('permissions-changed', {
        detail: { cleared: true }
      }));
      
      return result;
    } catch (error) {
      console.error('Failed to clear permissions:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Add item to permission history
   */
  static async addToHistory(item: any): Promise<PermissionResult> {
    try {
      return await window.electronAPI.permissions.saveHistory(item);
    } catch (error) {
      console.error('Failed to save to history:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get permission history
   */
  static async getHistory(): Promise<any[]> {
    try {
      return await window.electronAPI.permissions.getHistory();
    } catch (error) {
      console.error('Failed to get history:', error);
      return [];
    }
  }

  /**
   * Clear permission history
   */
  static async clearHistory(): Promise<PermissionResult> {
    try {
      return await window.electronAPI.permissions.clearHistory();
    } catch (error) {
      console.error('Failed to clear history:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Parse stored permissions into a more usable format
   */
  static parseStoredPermissions(stored: Record<string, string>): StoredPermission[] {
    return Object.entries(stored).map(([key, status]) => {
      const [origin, permission] = key.split(':');
      return {
        origin,
        permission,
        status: status as 'granted' | 'denied',
        timestamp: new Date().toLocaleString() // We don't store timestamp in the key, so use current time
      };
    });
  }

  /**
   * Group permissions by origin
   */
  static groupPermissionsByOrigin(stored: Record<string, string>): Record<string, Array<{permission: string, status: string}>> {
    const grouped: Record<string, Array<{permission: string, status: string}>> = {};
    
    Object.entries(stored).forEach(([key, status]) => {
      const [origin, permission] = key.split(':');
      if (!grouped[origin]) {
        grouped[origin] = [];
      }
      grouped[origin].push({ permission, status });
    });
    
    return grouped;
  }
}