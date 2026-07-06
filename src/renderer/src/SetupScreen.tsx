// src/SetupScreen.tsx
import React, { useState, useEffect } from 'react';
import Start from './setupScreen/Start';
import TargetCursor from './ui/TargetCursor';
import bgmusic from './bg.mp3';
import MailPw from './setupScreen/mailpw';
import Userpfp from './setupScreen/userpfp';
import BrowserImport from './setupScreen/BrowserImport';
import BackgroundMusicPlayer from './ui/BackgroundMusicPlayer';
import Last from './setupScreen/last';
import ExistingAccount from './setupScreen/ExistingAccount';
import { useAuth } from './Auth/AuthContext';
import BG from '../../../public/bg.png'
import Noise from './ui/Noise';
import mainlogo from '../../../public/mainlogo.png'

// Define setup steps
type SetupStep = 'welcome' | 'privacy' | 'shortcuts' | 'sync' | 'complete' | 'existing_account';

interface SetupScreenProps {
  onComplete: () => void;
}

// Create a key in localStorage to track setup progress
const SETUP_PROGRESS_KEY = 'app_setup_progress';

const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome');
  const [settings, setSettings] = useState({
    theme: 'light' as 'light' | 'dark' | 'system',
    privacyLevel: 'balanced' as 'strict' | 'balanced' | 'permissive',
    enableAnalytics: false,
    useDefaultShortcuts: true,
    syncEnabled: false,
    syncOptions: {
      bookmarks: true,
      history: false,
      passwords: false,
      settings: true
    }
  });
  const { session, loading, user } = useAuth();

  // Initialize setup flow based on authentication and saved progress
  useEffect(() => {
    if (loading) return;
    
    // Try to load saved progress
    const savedProgress = localStorage.getItem(SETUP_PROGRESS_KEY);
    
    if (savedProgress) {
      // Resume from saved step if available
      setCurrentStep(savedProgress as SetupStep);
    } else if (session) {
      // If user is already authenticated but no progress saved,
      // skip the account creation step and go to profile setup
      setCurrentStep('shortcuts');
    }
    // Otherwise, start from the beginning
  }, [loading, session]);

  // Save progress when step changes
  useEffect(() => {
    if (currentStep && currentStep !== 'welcome') {
      localStorage.setItem(SETUP_PROGRESS_KEY, currentStep);
    }
  }, [currentStep]);

  const nextStep = () => {
    switch (currentStep) {
      case 'welcome':
        setCurrentStep('privacy');
        break;
      case 'privacy':
        setCurrentStep('shortcuts');
        break;
      case 'shortcuts':
        setCurrentStep('sync');
        break;
      case 'sync':
        setCurrentStep('complete');
        break;
      case 'complete':
        finishSetup();
        break;
      case 'existing_account':
        setCurrentStep('shortcuts'); // After logging in, go to profile setup
        break;
    }
  };

  // Add prevStep function for back navigation
  const prevStep = () => {
    switch (currentStep) {
      case 'privacy':
        setCurrentStep('welcome');
        break;
      case 'shortcuts':
        setCurrentStep('privacy');
        break;
      case 'sync':
        setCurrentStep('shortcuts');
        break;
      case 'complete':
        setCurrentStep('sync');
        break;
      case 'existing_account':
        setCurrentStep('privacy'); // Go back to privacy/signup step
        break;
    }
  };

  // Function to skip to existing account flow
  const skipToExistingAccount = () => {
    setCurrentStep('existing_account');
  };

  const updateSettings = (key: keyof typeof settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateSyncOption = (option: keyof typeof settings.syncOptions, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      syncOptions: {
        ...prev.syncOptions,
        [option]: value
      }
    }));
  };

  const finishSetup = async () => {
    try {
      // Save theme
      await window.electronAPI.theme.change(settings.theme);
      await window.electronAPI.store.set('theme', settings.theme);
      
      // Save privacy settings
      await window.electronAPI.store.set('privacyLevel', settings.privacyLevel);
      await window.electronAPI.store.set('enableAnalytics', settings.enableAnalytics);
      
      // Save shortcut preferences (just the preference, not modifying shortcuts)
      await window.electronAPI.store.set('useDefaultShortcuts', settings.useDefaultShortcuts);
      
      // If user chooses not to use defaults, we leave shortcuts as they are
      // If they want defaults, reset to defaults
      if (settings.useDefaultShortcuts) {
        await window.electronAPI.keyboardShortcuts.forceReset();
      }
      
      // Save sync preferences
      await window.electronAPI.store.set('syncEnabled', settings.syncEnabled);
      await window.electronAPI.store.set('syncOptions', settings.syncOptions);
      
      // Mark setup as completed
      await window.electronAPI.store.set('setupCompleted', true);
      
      // Clear setup progress tracking
      localStorage.removeItem(SETUP_PROGRESS_KEY);
      
      // Notify parent component
      onComplete();
    } catch (error) {
      console.error('Failed to save settings:', error);
      // Show error to user
    }
  };

  // Show loading state while checking auth
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-200 dark:bg-gray-950">
      <p>Loading...</p>
    </div>;
  }

  // Render different content based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return <Start nextStep={nextStep} />;
        
      case 'privacy':
        return (
          <MailPw 
            nextStep={nextStep} 
            skipToExistingAccount={skipToExistingAccount} 
          />
        );
        
      case 'shortcuts':
        return <Userpfp nextStep={nextStep} />;
      
      case 'sync':
        return <BrowserImport nextStep={nextStep} />;

      case 'complete':
        return <Last nextStep={finishSetup} />;
        
      case 'existing_account':
        return <ExistingAccount nextStep={nextStep} prevStep={prevStep} />;
    }
  };

  return (
    <div className="min-h-screen flex items-center overflow-hidden justify-center p-4 bg-cover bg-center bg-no-repeat"
    style={{
          backgroundImage: `url(${BG})`,
        }}
    >
              <Noise
    patternSize={250}
    patternScaleX={1}
    patternScaleY={1}
    patternRefreshInterval={2}
    patternAlpha={15}
  />
      <TargetCursor />
      <div className='flex flex-col justify-center items-center overflow-hidden'>
          <div
      className="flex w-auto items-center whitespace-pre" 
    > 
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-white tracking-tighter sm:text-3xl leading-none"> 
         <img src={mainlogo} alt="Aquin Logo" className="h-[30px]"  />
        Aquin 
      </h2> 
    </div> 
      {renderStepContent()}
      </div>
      <BackgroundMusicPlayer audioSource={bgmusic} />
    </div>
  );
};

export default SetupScreen;