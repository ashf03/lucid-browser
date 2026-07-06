// src/setupScreen/userpfp.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import clickaudio from './click.mp3';
import { ArrowRight } from '@phosphor-icons/react';
import { WavyBackground } from '../ui/wavy-background';
import Avvvatars from 'avvvatars-react';
import { useAuth } from '../Auth/AuthContext';

interface UserpfpProps {
  nextStep: () => void;
}

const Userpfp: React.FC<UserpfpProps> = ({ nextStep }) => {
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState(''); // To track if name has changed
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [originalProfilePic, setOriginalProfilePic] = useState<string | null>(null); // To track if pic has changed
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user, updateProfile, uploadAvatar, profile, createInitialProfile } = useAuth();
  
  // Initialize the audio element
  useEffect(() => {
    audioRef.current = new Audio(clickaudio);
    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);

  // Set default name from email if user exists but no profile name yet
  useEffect(() => {
    if (user && user.email && (!name || name === '') && (!profile || !profile.name)) {
      // Extract username from email
      const username = user.email.split('@')[0];
      setName(username);
      // Don't set as original name since this is just a default
    }
  }, [user, name, profile]);

  // Set name and avatar from profile if available
  useEffect(() => {
    if (profile?.name && (!name || name === '')) {
      setName(profile.name);
      setOriginalName(profile.name); // Track the original name
    }
    if (profile?.avatar_url) {
      setProfilePic(profile.avatar_url);
      setOriginalProfilePic(profile.avatar_url); // Track the original profile pic
    }
  }, [profile, name]);
  
  // Function to play the click sound
  const playClickSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => console.error("Audio play failed:", error));
    }
  };
  
  const handleContinueClick = async () => {
    // Validate name
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    
    // Reset error
    setError(null);
    
    // Play click sound
    playClickSound();
    
    // Start loading
    setIsLoading(true);
    
    try {
      // Check if any changes were made to prevent unnecessary API calls
      const nameChanged = name !== originalName;
      const profilePicChanged = profilePic !== originalProfilePic;
      
      // Only make API calls if something changed or profile doesn't exist
      if (nameChanged || profilePicChanged || !profile) {
        // If user exists but no profile exists yet, create a profile first
        if (user && !profile) {
          console.log('No profile exists yet, creating initial profile');
          await createInitialProfile(user.id, user.email || '');
        }

        // Now update the profile with the name if it changed
        if (nameChanged || !profile) {
          console.log('Updating profile with name:', name);
          const { success, error: updateError } = await updateProfile({ name });
          
          if (!success) {
            throw updateError;
          }
        }
        
        // If there's a new profile picture to upload
        if (profilePic && profilePicChanged) {
          console.log('Uploading new profile picture');
          // Convert base64 to file
          const res = await fetch(profilePic);
          const blob = await res.blob();
          const file = new File([blob], 'profile-picture.png', { type: 'image/png' });
          
          // Upload the avatar
          const { success: uploadSuccess, error: uploadError } = await uploadAvatar(file);
          
          if (!uploadSuccess) {
            throw uploadError;
          }
        }
        
        console.log('Profile updated successfully');
      } else {
        console.log('No profile changes detected, skipping API calls');
      }
      
      // Update progress in localStorage
      localStorage.setItem('app_setup_progress', 'sync');
      
      // Proceed to next step
      console.log('Proceeding to next step');
      nextStep();
    } catch (err) {
      console.error("Profile update error:", err);
      setError((err as Error)?.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle profile picture file selection
  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError("Image too large (max 2MB)");
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          setProfilePic(event.target.result);
          setError(null); // Clear any previous errors
        }
      };
      
      reader.readAsDataURL(file);
    }
  };
  
  // Trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  return (
        <div className="text-center relative overflow-hidden mt-[50px] flex flex-col items-center justify-center">
          <div className="max-w-3xl w-full flex flex-col">
            
            {/* Profile Picture Upload */}
            <div className="flex flex-col items-center">
              <div 
                className="w-32 h-32 rounded-full overflow-hidden mb-2 bg-white cursor-target"
                onClick={triggerFileInput}
              >
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover cursor-none" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Avvvatars value={name || "A"} style="shape" size={96} />
                  </div>
                )}
              </div>
              <p className="text-md text-white tracking-tighter font-semibold mb-4">Click to upload a profile picture</p>
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*" 
                onChange={handleProfilePicChange}
              />
            </div>
            
            <div className="mb-6">
              <p className="text-white font-extrabold text-5xl text-left">what your name?*</p>
              <input 
                type="text"
                className="w-full border-b-2 text-white font-bold text-2xl border-white outline-none shadow-none bg-transparent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            {error && (
              <div className="mb-4 text-white text-left">{error}</div>
            )}
            
            <Button 
              onClick={handleContinueClick}
              className="w-full font-medium text-lg text-black bg-white hover:bg-white cursor-target h-10 max-w-[160px] cursor-none"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Continue'} {!isLoading && <ArrowRight size={21} />}
            </Button>
          </div>
        </div>
  );
};

export default Userpfp;