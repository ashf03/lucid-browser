import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { SpeakerSimpleHigh, SpeakerSimpleSlash } from '@phosphor-icons/react';
import clickaudio from '../setupScreen/click.mp3';

interface BackgroundMusicPlayerProps {
  audioSource?: string;
}

const BackgroundMusicPlayer: React.FC<BackgroundMusicPlayerProps> = ({ 
  audioSource
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clickAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create background music audio element
    audioRef.current = new Audio(audioSource);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.1;
    
    // Create click sound audio element
    clickAudioRef.current = new Audio(clickaudio);
    
    // Play background music when component mounts
    const playPromise = audioRef.current.play();
    
    // Handle play promise rejection (browsers require user interaction)
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log("Auto-play was prevented. User needs to interact with the page first.");
        setIsPlaying(false);
      });
    }

    // Cleanup function
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (clickAudioRef.current) {
        clickAudioRef.current = null;
      }
    };
  }, [audioSource]);

  // Function to play the click sound
  const playClickSound = () => {
    if (clickAudioRef.current) {
      clickAudioRef.current.currentTime = 0;
      clickAudioRef.current.play().catch(error => console.error("Audio play failed:", error));
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    // Play click sound
    playClickSound();
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error("Failed to play audio:", err);
      });
    }
    
    setIsPlaying(!isPlaying);
  };

  return (
    <button 
      onClick={togglePlay}
      className="fixed bottom-4 left-4 p-3 rounded-full text-white cursor-none cursor-target"
      aria-label={isPlaying ? "Pause background music" : "Play background music"}
    >
      {isPlaying ? <SpeakerSimpleHigh size={32} /> : <SpeakerSimpleSlash size={32} />}
    </button>
  );
};

export default BackgroundMusicPlayer;