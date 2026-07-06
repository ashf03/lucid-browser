// Minimal inline visualizer component for tight spaces
import React, { useEffect, useRef, memo, useState } from 'react';
import { Visualizer } from 'react-sound-visualizer';
import { Pause } from '@phosphor-icons/react';

interface StableVisualizerWebProps {
  audioStream: MediaStream | null;
  isPaused: boolean;
}

const StableVisualizerWeb = memo(({ audioStream, isPaused }: StableVisualizerWebProps) => {
  const visualizerStartedRef = useRef(false);
  const audioStreamRef = useRef(audioStream);
  const [visualizerKey, setVisualizerKey] = useState(0);
  
  // Update ref when stream changes
  useEffect(() => {
    if (audioStream !== audioStreamRef.current) {
      visualizerStartedRef.current = false;
      audioStreamRef.current = audioStream;
      setVisualizerKey(prev => prev + 1);
    }
  }, [audioStream]);

  // Force visualizer restart when resuming from pause
  useEffect(() => {
    if (!isPaused && audioStream) {
      const timer = setTimeout(() => {
        setVisualizerKey(prev => prev + 1);
        visualizerStartedRef.current = false;
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isPaused, audioStream]);
  
  return (
    <div className="relative w-full h-6 max-w-[120px] flex items-center">
      <Visualizer 
        key={visualizerKey}
        audio={audioStream}
        strokeColor="#fde68a"
      >
        {({ canvasRef, start }) => {
          useEffect(() => {
            if (!visualizerStartedRef.current && start && audioStream && !isPaused) {
              const timer = setTimeout(() => {
                start();
                visualizerStartedRef.current = true;
              }, 50);
              
              return () => {
                clearTimeout(timer);
                if (!audioStream) {
                  visualizerStartedRef.current = false;
                }
              };
            }
          }, [start, audioStream, isPaused]);
          
          return (
            <canvas 
              ref={canvasRef} 
              width={120} 
              height={24}
              className="w-full h-full"
              style={{ 
                opacity: isPaused ? 0.2 : 1,
                transition: 'opacity 0.3s ease'
              }}
            />
          );
        }}
      </Visualizer>
      
      {/* Ultra compact paused indicator */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-1 bg-yellow-400/90 text-yellow-900 px-2 py-0.5 rounded text-xs">
            <Pause className="w-2.5 h-2.5" />
            <span>Paused</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default StableVisualizerWeb;