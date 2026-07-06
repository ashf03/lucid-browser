import React, { useEffect, useState } from 'react';
import SetupScreen from './SetupScreen';
import App from './App';
import { AuthProvider, useAuth } from './Auth/AuthContext';
import { WavyBackground } from './ui/wavy-background';

type AppState = 'loading' | 'setup' | 'main';

// This component handles the app state after the auth context is loaded
const AppStateManager: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(() => {
    // Try to get cached state, default to setup
    try {
      const cached = localStorage.getItem('lastAppState');
      return (cached === 'main' ? 'main' : 'setup') as AppState;
    } catch {
      return 'setup';
    }
  });
  
  const { session, loading: authLoading, user, profile } = useAuth();
  const [setupCheckAttempted, setSetupCheckAttempted] = useState(false);
  
  // Cache the current state whenever it changes
  useEffect(() => {
    if (appState !== 'loading') {
      try {
        localStorage.setItem('lastAppState', appState);
      } catch (error) {
        console.warn('Failed to cache app state:', error);
      }
    }
  }, [appState]);
  
  // Debug auth state changes
  useEffect(() => {
    console.log('Auth context state changed:', {
      user: user?.email,
      hasProfile: !!profile,
      hasSession: !!session,
      loading: authLoading,
      appState
    });
  }, [user, profile, session, authLoading, appState]);
  
  // Set up timeout to prevent infinite loading (if we somehow get into loading state)
  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      if (appState === 'loading') {
        console.log('⚠️ TIMEOUT: Forcing app to proceed to setup screen after timeout');
        setAppState('setup');
      }
    }, 15000); // 15 second timeout
    
    return () => clearTimeout(loadingTimeout);
  }, [appState]);
  
  useEffect(() => {
    // If auth is loading, wait
    if (authLoading) {
      console.log('Auth is still loading, waiting...');
      return;
    }
    
    console.log('Auth state check:', {
      user: user?.email,
      profile: profile?.name,
      session: !!session,
      authLoading
    });
    
    // If no user/session, go to setup (which includes login)
    if (!user || !session) {
      console.log('No authenticated user, going to setup');
      setAppState('setup');
      setSetupCheckAttempted(true);
      return;
    }
    
    // If user exists and we're currently showing setup, check if we should go to main
    if (appState === 'setup') {
      const checkSetup = async () => {
        try {
          setSetupCheckAttempted(true);
          const setupCompleted = await window.electronAPI.store.get('setupCompleted');
          console.log('Setup completed status:', setupCompleted, 'for user:', user.email);
          
          if (setupCompleted === true) {
            console.log('Setup completed and user authenticated, going to main app');
            setAppState('main');
          } else {
            console.log('User authenticated but setup not completed, staying on setup');
            setAppState('setup');
          }
        } catch (error) {
          console.error('Failed to check setup status:', error);
          console.log('Error checking setup, staying on setup screen');
          setAppState('setup');
        }
      };
      
      if (!setupCheckAttempted) {
        checkSetup();
      }
    }
    
    // If user exists and we're showing main, verify setup is still completed
    if (appState === 'main') {
      const verifySetup = async () => {
        try {
          const setupCompleted = await window.electronAPI.store.get('setupCompleted');
          if (setupCompleted !== true) {
            console.log('Setup no longer completed, going back to setup');
            setAppState('setup');
          }
        } catch (error) {
          console.error('Failed to verify setup status:', error);
          // Stay on main app if verification fails
        }
      };
      
      if (!setupCheckAttempted) {
        setSetupCheckAttempted(true);
        verifySetup();
      }
    }
  }, [authLoading, user, session, profile, setupCheckAttempted, appState]);
  
  // Fallback check if auth loading stays true for too long
  useEffect(() => {
    if (!setupCheckAttempted && authLoading) {
      const fallbackTimer = setTimeout(() => {
        console.log('Fallback: Auth loading too long, trying to check setup anyway');
        
        const forcedSetupCheck = async () => {
          try {
            const setupCompleted = await window.electronAPI.store.get('setupCompleted');
            console.log('Forced setup check result:', setupCompleted);
            
            // Even if setup is completed, if there's no user, go to setup
            if (setupCompleted === true && user && session) {
              setAppState('main');
            } else {
              setAppState('setup');
            }
          } catch (error) {
            console.error('Forced setup check failed:', error);
            setAppState('setup');
          } finally {
            setSetupCheckAttempted(true);
          }
        };
        
        forcedSetupCheck();
      }, 8000); // 8 seconds
      
      return () => clearTimeout(fallbackTimer);
    }
    
    return undefined;
  }, [setupCheckAttempted, authLoading, user, session]);
  
  const handleSetupComplete = () => {
    console.log('Setup completed, transitioning to main app');
    setAppState('main');
  };
  
  // Show loading screen only if we somehow get into loading state
  if (appState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-200 dark:bg-gray-950">
        <WavyBackground backgroundFill="#e4e4e7">
        </WavyBackground>
      </div>
    );
  }
  
  // Show setup screen if setup is needed OR if no user is authenticated
  if (appState === 'setup') {
    return <SetupScreen onComplete={handleSetupComplete} />;
  }
  
  // Show main app if setup is completed AND user is authenticated
  return <App />;
};

// This is the main component that wraps everything in the AuthProvider
const AppInitializer: React.FC = () => {
  return (
    <AuthProvider>
      <AppStateManager />
    </AuthProvider>
  );
};

export default AppInitializer;