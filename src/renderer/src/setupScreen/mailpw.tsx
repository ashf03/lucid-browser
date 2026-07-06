// src/setupScreen/mailpw.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import clickaudio from './click.mp3';
import { ArrowRight } from '@phosphor-icons/react';
import { WavyBackground } from '../ui/wavy-background';
import { useAuth } from '../Auth/AuthContext';

interface MailpwProps {
  nextStep: () => void;
  skipToExistingAccount?: () => void; // Prop for account skipping
}

const Mailpw: React.FC<MailpwProps> = ({ nextStep, skipToExistingAccount }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState(false); // Track if user just signed up in this session
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { signUp, profile, user } = useAuth();
  
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
  
  // Add a direct callback that's triggered when user signs up successfully
  // This ensures we advance to the next step regardless of the auth state
  useEffect(() => {
    let signupSuccessTimeout: NodeJS.Timeout | null = null;
    
    if (justSignedUp) {
      console.log('JustSignedUp flag set, preparing to advance to next step');
      // Ensure we advance to next step after a successful signup
      // This will happen even if the useEffect below doesn't trigger
      signupSuccessTimeout = setTimeout(() => {
        console.log('Advancing to next step due to successful signup');
        setIsLoading(false);
        nextStep();
      }, 1500); // Slightly shorter timeout for better UX
    }
    
    return () => {
      if (signupSuccessTimeout) {
        clearTimeout(signupSuccessTimeout);
      }
    };
  }, [justSignedUp, nextStep]);
  
  // Check if user and profile are loaded after signup
  useEffect(() => {
    if (user && profile && justSignedUp) {
      console.log('User and profile loaded after signup, proceeding to next step');
      setIsLoading(false);
      nextStep();
    }
  }, [user, profile, justSignedUp, nextStep]);
  
  // Function to play the click sound
  const playClickSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => console.error("Audio play failed:", error));
    }
  };
  
  const handleContinueClick = async () => {
    // Reset error state
    setError(null);
    
    // Validate inputs
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    
    // Validate password length
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    // Play click sound
    playClickSound();
    
    // Start loading
    setIsLoading(true);
    
    try {
      console.log('Attempting to sign up user:', email);
      
      // Attempt to sign up with Supabase
      const { success, error } = await signUp(email, password);
      
      if (!success) {
        throw error;
      }
      
      console.log('Sign up successful, user should be logged in now');
      
      // Set flag that user just signed up in this component
      setJustSignedUp(true);
      
      // Failsafe: Force advancement after timeout if nothing else works
      setTimeout(() => {
        if (isLoading) {
          console.log('Failsafe: Forcing navigation to next step after timeout');
          setIsLoading(false);
          nextStep();
        }
      }, 3000);
      
    } catch (err) {
      // Check for duplicate email error
      if (err && (err as Error).message && (err as Error).message.includes('email already registered')) {
        setError("This email is already registered. Please sign in instead.");
      } else {
        // Display other error messages
        setError((err as Error)?.message || "An error occurred during sign up");
      }
      console.error("Sign up error:", err);
      setIsLoading(false);
    }
  };

  const handleExistingAccountClick = () => {
    // Play click sound
    playClickSound();
    
    // Call the skipToExistingAccount function if provided
    if (skipToExistingAccount) {
      skipToExistingAccount();
    }
  };
  
  return (
        <div className="text-center overflow-hidden relative mt-[50px] flex flex-col items-center justify-center">
          <div className="max-w-3xl w-full flex flex-col">
            <div className="mb-6">
              <p className="text-white font-extrabold text-5xl mb-2 text-left">whats your mail?*</p>
              <input 
                type="email"
                className="w-full border-b-2 text-white font-bold text-2xl mt-1 border-white outline-none shadow-none bg-transparent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            
            <div className="mb-6">
              <p className="text-white font-extrabold text-5xl mb-2 text-left">whats your password?*</p>
              <input 
                type="password"
                className="w-full border-b-2 text-white font-bold text-2xl mt-1 border-white outline-none shadow-none bg-transparent"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
            
            {error && (
              <div className="mb-4 text-white text-left">{error}</div>
            )}
            
            <div className="flex flex-col items-start gap-4">
              <p 
                className="text-white text-md tracking-tighter font-semibold cursor-none cursor-target hover:underline transition-colors"
                onClick={handleExistingAccountClick}
              >
                Already have an account? Sign in
              </p>
              
              <Button 
                onClick={handleContinueClick}
                className="w-full font-medium cursor-target text-lg h-10 max-w-[160px] cursor-none bg-white text-black hover:bg-white"
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Continue'} {!isLoading && <ArrowRight size={21} />}
              </Button>
            </div>
          </div>
        </div>
  );
};

export default Mailpw;