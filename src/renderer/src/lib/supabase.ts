/**
 * Supabase client configured for Electron.
 *
 * Uses a custom storage adapter that persists sessions through main-process IPC
 * (auth:saveSession / auth:getSession) instead of localStorage.
 */
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
}

// Define types
export type UserProfile = {
  id: string;
  name: string;
  avatar_url: string | null;
  email: string;
  created_at: string;
  updated_at: string;
};

// Custom storage adapter that uses Electron's IPC with enhanced error handling
const electronStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      console.log('Electron storage: Retrieving session...');
      // Get session from Electron's auth store
      const session = await window.electronAPI.auth.getSession();
      if (!session) {
        console.log('Electron storage: No session found');
        return null;
      }
      console.log('Electron storage: Session found, converting to string');
      return JSON.stringify(session);
    } catch (error) {
      console.error('Error getting auth from Electron storage:', error);
      // Return null instead of throwing to prevent Supabase client from breaking
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      console.log('Electron storage: Storing session...');
      // Parse the stringified session and save to Electron's auth store
      const session = JSON.parse(value);
      await window.electronAPI.auth.saveSession(session);
      console.log('Electron storage: Session stored successfully');
    } catch (error) {
      console.error('Error saving auth to Electron storage:', error);
      // Don't throw - just log the error to prevent breaking the auth flow
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      console.log('Electron storage: Clearing session...');
      // Clear the session from Electron's auth store
      await window.electronAPI.auth.clearSession();
      console.log('Electron storage: Session cleared successfully');
    } catch (error) {
      console.error('Error removing auth from Electron storage:', error);
      // Don't throw - just log the error to prevent breaking the auth flow
    }
  }
};

// Initialize Supabase client with custom storage and better error handling
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for Electron (no URL redirects)
    storage: electronStorage,
    flowType: 'pkce', // Use PKCE flow for Electron
    debug: true, // Enable debug mode for easier troubleshooting
    // Removed invalid properties
  },
  global: {
    // Add global fetch options for more reliable network requests
    fetch: (url, options) => {
      return fetch(url, {
        ...options,
        // Add a longer timeout for network requests
        signal: options?.signal || AbortSignal.timeout(30000), // 30 second timeout
      });
    },
  },
});

// Set up auth state change listener after creating the client
supabase.auth.onAuthStateChange((event, session) => {
  console.log(`Supabase Auth State Change: ${event}`, session ? `User: ${session.user?.email}` : 'No session');
});

// Add event listener for network connectivity
window.addEventListener('online', () => {
  console.log('Network connection restored, refreshing auth session');
  supabase.auth.refreshSession(); // Refresh session when connection is restored
});

// Add manual retry logic for fetching profiles
const fetchWithRetry = async (fn: () => Promise<any>, maxRetries = 3): Promise<any> => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};

// Helper function to get profile by user ID with better error handling
export async function getProfileById(userId: string): Promise<UserProfile | null> {
  try {
    console.log(`Getting profile for user ID: ${userId}`);
    
    // First try to get from local Electron storage for faster loading
    // and to work in offline mode
    let profile: UserProfile | null = null;
    
    try {
      if (window.electronAPI?.auth?.getProfile) {
        console.log('Trying to get profile from Electron storage first');
        const localProfile = await window.electronAPI.auth.getProfile(userId);
        if (localProfile) {
          console.log('Profile found in Electron storage:', localProfile.name);
          profile = localProfile;
          // Continue to try Supabase to ensure we have the latest version
        }
      }
    } catch (storageError) {
      console.error('Error fetching from Electron storage, continuing with Supabase', storageError);
    }
    
    // Try to get from Supabase with retry logic
    try {
      console.log('Fetching profile from Supabase');
      
      const fetchFromSupabase = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
          
        if (error) throw error;
        return data;
      };
      
      // Use our retry function
      const data = await fetchWithRetry(fetchFromSupabase);

      if (data) {
        console.log('Profile found in Supabase:', data.name);
        
        // Cache the profile in Electron storage for offline access
        try {
          if (window.electronAPI?.auth?.saveProfile) {
            await window.electronAPI.auth.saveProfile(userId, data);
            console.log('Profile cached in Electron storage');
          }
        } catch (saveError) {
          console.error('Error caching profile in Electron storage:', saveError);
          // Continue even if caching fails
        }
        
        return data as UserProfile;
      }
    } catch (supabaseError) {
      console.error('Supabase error in getProfileById:', supabaseError);
      // If we have a profile from storage, return it instead of throwing
      if (profile) {
        console.log('Using profile from storage due to Supabase error');
        return profile;
      }
      // Otherwise, propagate the error
      throw supabaseError;
    }
    
    // If we reach here with a profile from storage but nothing from Supabase,
    // return the storage profile
    if (profile) {
      return profile;
    }
    
    console.log('No profile found anywhere');
    return null;
  } catch (error) {
    console.error('Error in getProfileById:', error);
    return null;
  }
}

// Helper function to update user profile with improved error handling
export async function updateUserProfile(
  userId: string, 
  updates: Partial<UserProfile>
): Promise<{ success: boolean; error?: Error }> {
  try {
    console.log(`Updating profile for user ${userId}:`, updates);
    
    // Update in Supabase
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error updating profile:', error);
      throw error;
    }

    // Cache updated profile in Electron storage
    if (data && window.electronAPI?.auth?.saveProfile) {
      try {
        await window.electronAPI.auth.saveProfile(userId, data);
        console.log('Updated profile cached in Electron storage');
      } catch (saveError) {
        console.error('Error caching updated profile:', saveError);
        // Continue even if caching fails
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { success: false, error: error as Error };
  }
}

// Upload avatar to Supabase Storage with improved options
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: Error }> {
  try {
    console.log(`Uploading avatar for user ${userId}`);
    
    // Create a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    console.log(`Using filePath: ${filePath}`);

    // Upload to Supabase Storage with improved options
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true, // Override if exists
        contentType: file.type, // Set proper content type
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw error;
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);
      
    console.log("Generated publicUrl:", publicUrl);
    
    // Test if the URL is accessible
    try {
      const response = await fetch(publicUrl, { method: 'HEAD' });
      console.log(`URL check status: ${response.status}`);
      if (!response.ok) {
        console.warn(`URL accessibility check failed with status ${response.status}`);
      }
    } catch (fetchError) {
      console.warn('Error testing URL accessibility:', fetchError);
      // Continue anyway
    }

    return { success: true, url: publicUrl };
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return { success: false, error: error as Error };
  }
}

// Helper to restore session from Electron on startup with better error handling
export async function restoreSession(): Promise<Session | null> {
  try {
    console.log('Attempting to restore session...');
    
    // First check if Supabase already has a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session from Supabase:', sessionError);
    }
    
    if (session) {
      console.log('Active session found in Supabase client for user:', session.user?.email);
      return session;
    }
    
    // If no session, try to get from Electron storage
    console.log('No active session, checking Electron storage');
    
    if (!window.electronAPI?.auth?.getSession) {
      console.log('Electron auth API not available');
      return null;
    }
    
    try {
      const savedSession = await window.electronAPI.auth.getSession();
      
      if (!savedSession) {
        console.log('No session found in Electron storage');
        return null;
      }
      
      console.log('Session found in Electron storage, restoring for user:', savedSession.user?.email);
      
      // Validate that the session has the required fields
      if (!savedSession.access_token || !savedSession.refresh_token) {
        console.error('Invalid session format in Electron storage');
        return null;
      }
      
      // Restore the session to Supabase
      const { data, error } = await supabase.auth.setSession({
        access_token: savedSession.access_token,
        refresh_token: savedSession.refresh_token,
      });
      
      if (error) {
        console.error('Error restoring session:', error);
        return null;
      }
      
      console.log('Session successfully restored from Electron storage');
      return data.session;
    } catch (electronError) {
      console.error('Error accessing Electron storage:', electronError);
      return null;
    }
  } catch (error) {
    console.error('Unexpected error in restoreSession:', error);
    return null;
  }
}