// src/setupScreen/Last.tsx
import React, { useState, useEffect, useRef } from 'react';
import { WavyBackground } from '../ui/wavy-background';
import { Button } from '../ui/button';
import clickaudio from './click.mp3';
import Avvvatars from 'avvvatars-react';
import { useAuth } from '../Auth/AuthContext';

interface LastProps {
  nextStep: () => void;
}

const Last: React.FC<LastProps> = ({ nextStep }) => {
  const [showFullContent, setShowFullContent] = useState(false);
  const [animationState, setAnimationState] = useState<'initial' | 'fading-out' | 'fading-in'>('initial');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { profile, user } = useAuth();
  
  // Initialize the audio element
  useEffect(() => {
    audioRef.current = new Audio(clickaudio);
    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);
  
  // Function to play the click sound
  const playClickSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => console.error("Audio play failed:", error));
    }
  };
  
  const handleInitialClick = () => {
    // Play click sound
    playClickSound();
    
    // Start the fade-out animation
    setAnimationState('fading-out');
    
    // After fade-out completes, update content and start fade-in
    setTimeout(() => {
      setShowFullContent(true);
      setAnimationState('fading-in');
    }, 2000); // Extended timing for a slower animation
  };
  
  const handleNextStepClick = async () => {
    if (isSubmitting) return;
    
    // Play click sound
    playClickSound();
    setIsSubmitting(true);
    
    try {
      // Ensure setup is marked as complete in Electron storage
      if (window.electronAPI?.setup?.complete) {
        await window.electronAPI.setup.complete();
      }
      
      // Save user profile for offline access if we have Electron storage
      if (user && profile && window.electronAPI?.auth?.saveProfile) {
        await window.electronAPI.auth.saveProfile(user.id, profile);
      }
      
      // Clear the setup progress from localStorage
      localStorage.removeItem('app_setup_progress');
      
      // Call the nextStep function to finalize setup
      nextStep();
    } catch (err) {
      setError((err as Error).message || "Failed to complete setup");
      console.error("Setup completion error:", err);
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className='overflow-hidden'>
        <div className="text-center relative min-h-[300px] flex flex-col items-center justify-center">
          {!showFullContent ? (
            // Initial text with animation state
            <div 
              className={`transition-all duration-2000 ${
                animationState === 'fading-out' 
                  ? 'opacity-0 blur-lg' 
                  : 'opacity-100 blur-none'
              }`}
              onClick={handleInitialClick}
            >
              <p className="text-7xl cursor-target text-white tracking-tighter font-bold inter-var text-center">
                are you ready?
              </p>
            </div>
          ) : (
            // New content with animation state
            <div 
              className={`transition-all duration-2000 ${
                animationState === 'fading-in' 
                  ? 'opacity-100 blur-none' 
                  : 'opacity-0 blur-lg'
              }`}
            > 
              <p className="text-7xl font-extrabold text-white inter-var text-center mb-2">
                we see, you're ready!
              </p>
              <p className="text-lg font-bold text-white inter-var text-center mb-6">
                Manage your profile in Settings
              </p>
              
              {error && (
                <div className="mb-4 text-red-500 text-center">{error}</div>
              )}
              
              <Button 
                onClick={handleNextStepClick}
                className="px-6 py-2 cursor-none cursor-target bg-white text-black hover:bg-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Finishing...' : 'Enter Browser'}
              </Button>
            </div>
          )}
        </div>
    </div>
  );
};

export default Last;