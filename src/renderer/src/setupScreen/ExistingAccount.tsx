// src/setupScreen/ExistingAccount.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import clickaudio from './click.mp3';
import { ArrowRight, ArrowLeft } from '@phosphor-icons/react';
import { WavyBackground } from '../ui/wavy-background';
import { useAuth } from '../Auth/AuthContext';

interface ExistingAccountProps {
  nextStep: () => void;
  prevStep: () => void; // Added back navigation
}

const ExistingAccount: React.FC<ExistingAccountProps> = ({ nextStep, prevStep }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [justSignedIn, setJustSignedIn] = useState(false); // Track if user just signed in
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { signIn, profile, user } = useAuth();
  
  // Initialize the audio element
  useEffect(() => {
    audioRef.current = new Audio(clickaudio);
    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);

  // Pre-fill email if user is already logged in
  useEffect(() => {
    if (profile?.email) {
      setEmail(profile.email);
    }
  }, [profile]);
  
  // Only move to next step if user just signed in through this component
  useEffect(() => {
    if (user && justSignedIn) {
      console.log('User authenticated after sign in, proceeding to next step');
      setTimeout(() => nextStep(), 500); // Small delay for UI smoothness
    }
  }, [user, justSignedIn, nextStep]);
  
  // Function to play the click sound
  const playClickSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => console.error("Audio play failed:", error));
    }
  };

  // Handle back button click
  const handleBack = () => {
    playClickSound();
    prevStep();
  };
  
  const handleSignIn = async () => {
    // Reset error
    setError('');
    
    // Validate input
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    // Play click sound
    playClickSound();
    
    try {
      setIsLoading(true);
      
      console.log('Attempting to sign in user:', email);
      
      // Sign in with Supabase
      const { success, error } = await signIn(email, password);
      
      if (!success) {
        throw error;
      }
      
      console.log('Sign in successful, user should be logged in now');
      
      // Set flag that user just signed in through this component
      setJustSignedIn(true);
      
      // Set isLoading to false after successful sign-in
      setIsLoading(false);
      
      // Add a failsafe timeout to proceed if other mechanisms don't trigger
      setTimeout(() => {
        if (user) {
          console.log('Failsafe: Forcing navigation to next step after timeout');
          nextStep();
        }
      }, 2000);
      
    } catch (err) {
      // Check for specific auth errors
      const errorMessage = (err as Error)?.message || '';
      
      if (errorMessage.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (errorMessage.includes('Email not confirmed')) {
        setError('Please confirm your email address before signing in.');
      } else {
        setError(errorMessage || 'Sign in failed. Please try again.');
      }
      
      console.error('Sign in error:', err);
      setIsLoading(false);
    }
  };
  
  return (  
        <div className="text-center relative mt-[50px] overflow-hidden flex flex-col items-center justify-center">
          <div className="max-w-3xl w-full flex flex-col">            
            <div className="mb-6">
              <p className="text-white font-extrabold text-4xl mb-2 text-left">whats your mail?*</p>
              <input 
                type="email"
                className="w-full border-b-2 font-bold text-white text-2xl mt-1 border-white outline-none shadow-none bg-transparent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            
            <div className="mb-8">
              <p className="text-white font-extrabold text-4xl mb-2 text-left">whats your password?*</p>
              <input 
                type="password"
                className="w-full border-b-2 font-bold text-white text-2xl mt-1 border-white outline-none shadow-none bg-transparent"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            
            {error && (
              <div className="mb-4 text-left text-white">{error}</div>
            )}
            
            {/* Buttons container */}
            <div className="flex gap-4 items-center">
              <Button
                onClick={handleBack}
                className="font-medium cursor-target text-lg h-10 w-10 cursor-none bg-white text-black hover:bg-white p-0"
                disabled={isLoading}
              >
                <ArrowLeft size={21} />
              </Button>
              
              <Button 
                onClick={handleSignIn}
                className="w-full cursor-target font-medium text-lg h-10 max-w-[230px] cursor-none bg-white text-black hover:bg-white"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Make a come back'} {!isLoading && <ArrowRight size={21} />}
              </Button>
            </div>
          </div>
        </div>
  );
};

export default ExistingAccount;