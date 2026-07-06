// Enhanced visualizer component that handles paused state
import React, { useEffect, useRef, memo, useState } from 'react';
import { Visualizer } from 'react-sound-visualizer';
import { Pause, Waveform } from '@phosphor-icons/react';

interface StableVisualizerProps {
  audioStream: MediaStream | null;
  isPaused: boolean;
}

const StableVisualizer = memo(({ audioStream, isPaused }: StableVisualizerProps) => {
  const visualizerStartedRef = useRef(false);
  const audioStreamRef = useRef(audioStream);
  const [visualizerKey, setVisualizerKey] = useState(0); // ✅ Force remount on resume
  
  // Update ref when stream changes
  useEffect(() => {
    if (audioStream !== audioStreamRef.current) {
      visualizerStartedRef.current = false;
      audioStreamRef.current = audioStream;
      setVisualizerKey(prev => prev + 1); // Force remount
    }
  }, [audioStream]);

  // ✅ Force visualizer restart when resuming from pause
  useEffect(() => {
    if (!isPaused && audioStream) {
      // Small delay then restart visualizer
      const timer = setTimeout(() => {
        setVisualizerKey(prev => prev + 1);
        visualizerStartedRef.current = false;
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isPaused, audioStream]);
  
  return (
    <div className="relative w-full h-full">
      <Visualizer 
        key={visualizerKey} // ✅ Force remount with key
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
            <div className="relative">
              <canvas 
                ref={canvasRef} 
                width={300} 
                height={100}
                style={{ 
                  opacity: isPaused ? 0.2 : 1,
                  transition: 'opacity 0.3s ease'
                }}
              />
            </div>
          );
        }}
      </Visualizer>
      
      {/* ✅ Enhanced paused overlay UI */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-yellow-400/30 to-yellow-500/20 animate-pulse rounded" />
          
          {/* Paused indicator */}
          <div className="relative z-10 flex items-center gap-3 bg-yellow-400/90 text-yellow-900 px-4 py-2 rounded-lg font-medium shadow-lg backdrop-blur-sm border border-yellow-500/50">
            <div className="flex items-center gap-1">
              <Pause className="w-4 h-4 animate-pulse" />
              <span>Recording Paused</span>
            </div>
            
            {/* Animated dots */}
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-yellow-700 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-1 bg-yellow-700 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-1 bg-yellow-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
          
          {/* Decorative waveform icons */}
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 opacity-30">
            <Waveform className="w-6 h-6 text-yellow-600" />
          </div>
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 opacity-30">
            <Waveform className="w-6 h-6 text-yellow-600" />
          </div>
        </div>
      )}
    </div>
  );
});

export default StableVisualizer;