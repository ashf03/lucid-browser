// src/context/AuthContext.tsx - Complete version with password change functionality
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Define the UserProfile type
export type UserProfile = {
  id: string;
  user_id?: string;
  name: string;
  avatar_url: string | null;
  email: string;
  created_at?: string;
  updated_at?: string;
};

// Define the AuthContextType with all needed functions including password change
type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{
    success: boolean;
    error: Error | null;
  }>;
  signIn: (email: string, password: string) => Promise<{
    success: boolean;
    error: Error | null;
  }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{
    success: boolean;
    error: Error | null;
  }>;
  uploadAvatar: (file: File) => Promise<{
    success: boolean;
    url: string | null;
    error: Error | null;
  }>;
  createInitialProfile: (userId: string, email: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{
    success: boolean;
    error: Error | null;
  }>;
};

// Create the context with undefined initial value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the AuthProvider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionCheckComplete, setSessionCheckComplete] = useState(false);

useEffect(() => {
  // Add a failsafe timeout to ensure we never get stuck in loading state
  const loadingTimeout = setTimeout(() => {
    if (loading) {
      console.log('⚠️ Forcing loading state to false after timeout');
      setLoading(false);
      setSessionCheckComplete(true);
    }
  }, 10000); // 10 second timeout
  
  // Set up the auth listener
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, currentSession) => {
      console.log('Auth state changed:', event, currentSession?.user?.email);
      
      // Handle SIGNED_OUT event explicitly
      if (event === 'SIGNED_OUT') {
        console.log('User signed out, clearing all state');
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        setSessionCheckComplete(true);
        return;
      }
      
      setSession(currentSession);
      setUser(currentSession?.user || null);
      
      try {
        // Fetch profile data if user is logged in
        if (currentSession?.user) {
          await getProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error processing auth state change:', error);
      } finally {
        // Always update loading state regardless of success
        setLoading(false);
        setSessionCheckComplete(true);
      }
    }
  );

  // Initial session check
  checkSession();

  return () => {
    clearTimeout(loadingTimeout);
    subscription.unsubscribe();
  };
}, []);

  useEffect(() => {
    // Set up the auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state changed:', event, currentSession?.user?.email);
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        try {
          // Fetch profile data if user is logged in
          if (currentSession?.user) {
            await getProfile(currentSession.user.id);
          } else {
            setProfile(null);
          }
        } catch (error) {
          console.error('Error processing auth state change:', error);
        } finally {
          // Always update loading state regardless of success
          setLoading(false);
          setSessionCheckComplete(true);
        }
      }
    );

    // Initial session check
    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkSession() {
    console.log('Starting session check...');
    try {
      // First try to get session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('Active session found in Supabase client:', session.user?.email);
        setSession(session);
        setUser(session.user);
        
        if (session.user) {
          try {
            await getProfile(session.user.id);
          } catch (profileError) {
            console.error('Error fetching profile but continuing:', profileError);
            // Continue even if profile fetch fails
          }
        }
      } else {
        console.log('No active session in Supabase, checking Electron storage...');
        // If no session in Supabase, try to get from Electron store
        if (window.electronAPI?.auth?.getSession) {
          try {
            const savedSession = await window.electronAPI.auth.getSession();
            
            if (savedSession) {
              console.log('Session found in Electron storage, restoring:', savedSession.user?.email);
              
              // Restore the session to Supabase
              const { data, error } = await supabase.auth.setSession({
                access_token: savedSession.access_token,
                refresh_token: savedSession.refresh_token,
              });
              
              if (error) {
                console.error('Error restoring session from Electron storage:', error);
                
                // If we can't restore the session, try using a locally cached profile
                if (savedSession.user && window.electronAPI?.auth?.getProfile) {
                  const cachedProfile = await window.electronAPI.auth.getProfile(savedSession.user.id);
                  if (cachedProfile) {
                    console.log('Using cached profile without session restoration');
                    setProfile(cachedProfile);
                  }
                }
              } else if (data.session) {
                console.log('Session successfully restored from Electron storage');
                setSession(data.session);
                setUser(data.session.user);
                
                if (data.session.user) {
                  try {
                    await getProfile(data.session.user.id);
                  } catch (profileError) {
                    console.error('Error fetching profile but continuing:', profileError);
                  }
                }
              }
            } else {
              console.log('No saved session found in Electron storage');
            }
          } catch (electronError) {
            console.error('Error accessing Electron storage:', electronError);
          }
        } else {
          console.log('Electron API not available for auth');
        }
      }
    } catch (error) {
      console.error('Error in checkSession:', error);
    } finally {
      // Always update loading state regardless of success
      console.log('Session check complete, setting loading to false');
      setLoading(false);
      setSessionCheckComplete(true);
    }
  }

  async function getProfile(userId: string) {
    let profileFetched = false;
    
    try {
      console.log('Getting profile for user:', userId);
      
      // Try to get from Electron storage first for faster loading
      if (window.electronAPI?.auth?.getProfile) {
        try {
          const cachedProfile = await window.electronAPI.auth.getProfile(userId);
          if (cachedProfile) {
            console.log('Using cached profile from Electron storage');
            setProfile(cachedProfile);
            profileFetched = true;
            // Still continue to fetch from Supabase to update the cache
          }
        } catch (storageError) {
          console.error('Error fetching profile from Electron storage:', storageError);
        }
      }
      
      // Try to get from Supabase
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.log('Error fetching profile from Supabase:', error.message);
          
          // If no cached profile and the error is "not found", create one
          if (!profileFetched && error.code === 'PGRST116') { // PostgreSQL "not found" error
            console.log('Profile not found, creating initial profile');
            if (user?.email) {
              const created = await createInitialProfile(userId, user.email);
              profileFetched = created;
            }
          } else {
            // Don't throw error if we already have a cached profile
            if (!profileFetched) {
              throw error;
            }
          }
        } else if (data) {
          // Save profile to Electron storage for offline access
          if (window.electronAPI?.auth?.saveProfile) {
            try {
              await window.electronAPI.auth.saveProfile(userId, data);
              console.log('Profile saved to Electron storage');
            } catch (saveError) {
              console.error('Error saving profile to Electron storage:', saveError);
            }
          }
          
          console.log('Profile found in Supabase:', data.name);
          setProfile(data as UserProfile);
          profileFetched = true;
        }
      } catch (supabaseError) {
        console.error('Error with Supabase profile fetch:', supabaseError);
        if (!profileFetched) throw supabaseError;
      }
    } catch (error) {
      console.error('Error in getProfile:', error);
      // If we don't have a profile at this point, return false to indicate failure
      return false;
    }
    
    return profileFetched;
  }

  async function createInitialProfile(userId: string, email: string): Promise<boolean> {
    try {
      // First check if profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      // If profile already exists, just return it
      if (existingProfile) {
        console.log('Profile already exists, no need to create');
        setProfile(existingProfile as UserProfile);
        
        // Save to Electron storage if available
        if (window.electronAPI?.auth?.saveProfile) {
          try {
            await window.electronAPI.auth.saveProfile(userId, existingProfile);
          } catch (saveError) {
            console.error('Error saving existing profile to storage:', saveError);
          }
        }
        
        return true;
      }
      
      // Only create profile if it doesn't exist yet
      if (checkError && checkError.code === 'PGRST116') { // "not found" error
        // Create a new profile with the user ID and email
        const newProfile: Partial<UserProfile> = {
          id: userId,
          email: email,
          name: email.split('@')[0], // Default name from email
          avatar_url: null
        };
        
        const { data, error } = await supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();
        
        if (error) {
          // Special handling for duplicate key error - this means the profile was created
          // by the database trigger between our check and insert
          if (error.code === '23505') { // Postgres duplicate key error
            console.log('Profile was created by trigger, fetching it now');
            
            // Try to fetch the profile that was created by the trigger
            const { data: triggerProfile, error: fetchError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();
              
            if (fetchError) {
              console.error('Error fetching profile created by trigger:', fetchError);
              return false;
            }
            
            // Save to Electron storage
            if (window.electronAPI?.auth?.saveProfile && triggerProfile) {
              try {
                await window.electronAPI.auth.saveProfile(userId, triggerProfile);
              } catch (saveError) {
                console.error('Error saving trigger-created profile to storage:', saveError);
              }
            }
            
            // Update local state
            if (triggerProfile) {
              setProfile(triggerProfile as UserProfile);
              return true;
            }
          }
          
          console.error('Error creating initial profile:', error);
          return false;
        }
        
        // Save to Electron storage
        if (window.electronAPI?.auth?.saveProfile) {
          try {
            await window.electronAPI.auth.saveProfile(userId, data);
          } catch (saveError) {
            console.error('Error saving new profile to storage:', saveError);
          }
        }
        
        // Update local state
        setProfile(data as UserProfile);
        return true;
      } else if (checkError) {
        console.error('Error checking for existing profile:', checkError);
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Error in createInitialProfile:', error);
      return false;
    }
  }

  async function signUp(email: string, password: string) {
    try {
      console.log('Signing up with email:', email);
      
      // Sign up with Supabase - WITHOUT email confirmation
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // The key change: This makes signup work without email verification
          data: {
            email_confirmed: true
          }
        }
      });

      if (error) {
        throw error;
      }

      // Immediately sign in to ensure the user is authenticated
      if (data.user) {
        console.log('User created, signing in automatically');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) {
          throw signInError;
        }
        
        // Update state
        setUser(signInData.user);
        setSession(signInData.session);
        
        // Create initial profile
        if (signInData.user) {
          await createInitialProfile(signInData.user.id, email);
        }
        
        // Save session to Electron if available
        if (signInData.session && window.electronAPI?.auth?.saveSession) {
          try {
            await window.electronAPI.auth.saveSession({
              access_token: signInData.session.access_token,
              refresh_token: signInData.session.refresh_token,
              expires_at: signInData.session.expires_at,
              user: signInData.user
            });
          } catch (saveError) {
            console.error('Error saving session to Electron storage:', saveError);
          }
        }
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: error as Error };
    }
  }

  async function signIn(email: string, password: string) {
    try {
      console.log('Signing in with email:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // Save session to Electron if available
      if (data.session && window.electronAPI?.auth?.saveSession) {
        try {
          await window.electronAPI.auth.saveSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
            user: data.user
          });
        } catch (saveError) {
          console.error('Error saving session to Electron storage:', saveError);
        }
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error as Error };
    }
  }

async function signOut() {
  try {
    console.log('Starting sign out process...');
    
    // First clear local state immediately to prevent race conditions
    setProfile(null);
    setUser(null);
    setSession(null);
    
    // Clear session from Electron storage first
    if (window.electronAPI?.auth?.clearSession) {
      try {
        const result = await window.electronAPI.auth.clearSession();
        console.log('Electron session cleared:', result);
      } catch (clearError) {
        console.error('Error clearing session from Electron storage:', clearError);
        // Continue with Supabase signout even if this fails
      }
    }
    
    // Then sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Supabase signout error:', error);
      throw error;
    }
    
    console.log('Sign out completed successfully');
    
  } catch (error) {
    console.error('Sign out error:', error);
    // Even if there's an error, clear local state
    setProfile(null);
    setUser(null);
    setSession(null);
    throw error; // Re-throw to let the UI handle it
  }
}

  async function updateProfile(updates: Partial<UserProfile>) {
    try {
      if (!user) {
        console.error('No user logged in');
        throw new Error('No user logged in');
      }

      console.log('Updating profile for user:', user.id, updates);
      
      // Update in Supabase
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        // Handle "not found" error by creating initial profile and trying again
        if (error.code === 'PGRST116') { // PostgreSQL "not found" error
          console.log('Profile not found, creating initial profile before update');
          if (user.email) {
            const created = await createInitialProfile(user.id, user.email);
            if (created) {
              // Try update again after creating
              const { data: updatedData, error: updateError } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();
                
              if (updateError) throw updateError;
              
              // Save updated profile to Electron storage
              if (window.electronAPI?.auth?.saveProfile) {
                try {
                  await window.electronAPI.auth.saveProfile(user.id, updatedData);
                } catch (saveError) {
                  console.error('Error saving updated profile to storage:', saveError);
                }
              }
              
              setProfile(updatedData as UserProfile);
              return { success: true, error: null };
            }
          }
        }
        throw error;
      }

      // Save updated profile to Electron storage if available
      if (window.electronAPI?.auth?.saveProfile) {
        try {
          await window.electronAPI.auth.saveProfile(user.id, data);
        } catch (saveError) {
          console.error('Error saving updated profile to storage:', saveError);
        }
      }
      
      setProfile(data as UserProfile);
      return { success: true, error: null };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error as Error };
    }
  }

  async function uploadAvatar(file: File) {
    try {
      if (!user) throw new Error('No user logged in');

      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      console.log("Uploading avatar with filepath:", filePath);

      // Upload the file to Supabase storage with improved options
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error("Storage upload error:", error);
        throw error;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log("Generated publicUrl:", publicUrl);

      // Update the user profile with the avatar URL
      const updateResult = await updateProfile({ avatar_url: publicUrl });
      if (!updateResult.success) {
        console.error("Failed to update profile with avatar URL:", updateResult.error);
      }

      return { success: true, url: publicUrl, error: null };
    } catch (error) {
      console.error('Upload avatar error:', error);
      return { success: false, url: null, error: error as Error };
    }
  }

  // DIRECT HTTP: Completely bypass the broken Supabase client
  async function changePassword(currentPassword: string, newPassword: string) {
    try {
      console.log('🔄 BYPASSING Supabase client entirely for user:', user?.email);
      
      if (!user || !user.email) {
        console.error('❌ No user logged in');
        throw new Error('No user logged in');
      }

      if (!session?.access_token) {
        console.error('❌ No access token available');
        throw new Error('No access token available');
      }

      console.log('🌐 Using DIRECT HTTP to Supabase API...');
      console.log('🔑 Using access token:', session.access_token.substring(0, 20) + '...');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not configured');
      }

      const url = `${supabaseUrl}/auth/v1/user`;
      
      console.log('🌐 Making PUT request to:', url);
      
      const requestBody = { password: newPassword };
      console.log('📦 Request body:', requestBody);

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify(requestBody)
      });

      console.log('🌐 HTTP response received!');
      console.log('📊 Status:', response.status);
      console.log('📊 Status text:', response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      console.log('📊 Response data:', responseData);

      console.log('✅ Password changed successfully via direct HTTP!');
      
      // Update local user state if the response includes user data
      if (responseData?.user) {
        console.log('🔄 Updating local user state from HTTP response');
        setUser(responseData.user);
      }

      return { success: true, error: null };

    } catch (error) {
      console.error('❌ Direct HTTP password change failed:', error);
      
      if (error instanceof Error) {
        // Check for specific errors
        if (error.message.includes('401')) {
          return { 
            success: false, 
            error: new Error('Authentication failed. Please sign out and back in.') 
          };
        }
        if (error.message.includes('400')) {
          return { 
            success: false, 
            error: new Error('Invalid password format. Must be at least 6 characters.') 
          };
        }
        if (error.message.includes('fetch')) {
          return { 
            success: false, 
            error: new Error('Network error. Check your internet connection.') 
          };
        }
      }
      
      return { 
        success: false, 
        error: error as Error 
      };
    }
  }

  // Create the context value
  const value = {
    session,
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    uploadAvatar,
    createInitialProfile,
    changePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Create a hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};