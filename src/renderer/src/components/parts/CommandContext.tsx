/** Global state for the command palette (Ctrl+K) open/close and URL load flag. */
import React, { createContext, useContext, useState, useEffect } from 'react';

interface CommandContextType {
  isCommandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  urlLoaded: boolean;
  setUrlLoaded: (loaded: boolean) => void;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [isCommandOpen, setCommandOpen] = useState(false);
  const [urlLoaded, setUrlLoaded] = useState(false);

  useEffect(() => {
    const handleStopGeneration = () => {
      setCommandOpen(true);
    };

    window.addEventListener('stopGeneration', handleStopGeneration);
    
    return () => {
      window.removeEventListener('stopGeneration', handleStopGeneration);
    };
  }, []);

  return (
    <CommandContext.Provider value={{ 
      isCommandOpen, 
      setCommandOpen,
      urlLoaded,
      setUrlLoaded,
    }}>
      {children}
    </CommandContext.Provider>
  );
}

export function useCommand() {
  const context = useContext(CommandContext);
  if (context === undefined) {
    throw new Error('useCommand must be used within a CommandProvider');
  }
  return context;
}
