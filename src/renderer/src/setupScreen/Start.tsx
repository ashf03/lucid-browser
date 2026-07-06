import React, { useState, useEffect, useRef } from 'react';
import { WavyBackground } from '../ui/wavy-background';
import { Button } from '../ui/button';
import clickaudio from './click.mp3';

interface StartProps {
  nextStep: () => void;
}

const Start: React.FC<StartProps> = ({ nextStep }) => {
  const [showFullContent, setShowFullContent] = useState(false);
  const [animationState, setAnimationState] = useState<'initial' | 'fading-out' | 'fading-in'>('initial');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Initialize the audio element
  useEffect(() => {
    audioRef.current = new Audio(clickaudio); // Path to your click sound
    return () => {
      // Cleanup
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);
  
  // Function to play the click sound
  const playClickSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // Reset the audio to start
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
  
  const handleNextStepClick = () => {
    // Play click sound
    playClickSound();
    
    // Call the nextStep function
    nextStep();
  };
  
  return (
    <div className='overflow-hidden bg-transparent'>
      <div className="text-center relative min-h-[300px] flex flex-col items-center justify-center">
          {!showFullContent ? (
            // Initial text with animation state
            <div 
              className={`transition-all duration-2000 cursor-target ${
                animationState === 'fading-out' 
                  ? 'opacity-0 blur-lg' 
                  : 'opacity-100 blur-none'
              }`}
              onClick={handleInitialClick}
            >
              <p className="text-7xl text-white tracking-tighter font-bold inter-var text-center">
                this is reimagination of browsing.
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
              <p className="text-7xl font-extrabold text-white inter-var text-center">
                this is Lucid.
              </p>
              <p className="text-lg font-extrabold text-white inter-var text-center">
                Open source
              </p>
              <Button 
                onClick={handleNextStepClick}
                className="px-6 py-2 mt-6 cursor-target font-bold tracking-tighter cursor-none bg-white text-black hover:bg-white"
              >
                Start Your Experience
              </Button>
            </div>
          )}
        </div>
    </div>
  );
};

export default Start;