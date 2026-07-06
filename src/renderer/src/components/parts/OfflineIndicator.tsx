import React, { useState } from 'react';
import { WifiSlash, ArrowLeft } from '@phosphor-icons/react';
import { Button } from '../../ui/button';
import Tetris from './Game';

interface OfflineIndicatorProps {
  lastChecked: string;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ lastChecked }) => {
  // Add state to track if game mode is active
  const [showGame, setShowGame] = useState(false);

  // Toggle game mode handlers
  const handleGameButtonClick = () => {
    setShowGame(true);
  };

  const handleBackButtonClick = () => {
    setShowGame(false);
  };

  // If game mode is active, show only testing text and back button
  if (showGame) {
    return (
      <div className="relative flex items-center justify-center h-screen bg-white dark:bg-zinc-900">
        <button 
          onClick={handleBackButtonClick}
          className="absolute top-4 left-4 z-50 p-2 rounded-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
        </button>
        <Tetris />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center dark:bg-zinc-900 bg-zinc-50 p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-4">
          <div className="inline-flex items-center justify-center rounded-fulldark:bg-transparent p-3">
            <WifiSlash className="text-red-500 h-20 w-20" />
          </div>
          <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-50">No Internet</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-center">Unable to connect to the internet</p>
        </div>
        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-5 mb-4">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Try:</p>
          <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            <li className="flex items-start">
              <div className="mr-3 mt-1 h-1.5 w-1.5 rounded-full bg-zinc-300 flex-shrink-0"></div>
              <span>Checking the network cables, modem, and router</span>
            </li>
            <li className="flex items-start">
              <div className="mr-3 mt-1 h-1.5 w-1.5 rounded-full bg-zinc-300 flex-shrink-0"></div>
              <span>Reconnecting to Wi-Fi</span>
            </li>
            <li className="flex items-start">
              <div className="mr-3 mt-1 h-1.5 w-1.5 rounded-full bg-zinc-300 flex-shrink-0"></div>
              <span>Running Network Diagnostics</span>
            </li>
          </ul>
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-300">
          <span>ERR_INTERNET_DISCONNECTED</span>
          <span>Last checked: {lastChecked}</span>
        </div>

        <br />

        <div className="flex items-center justify-center space-x-2 text-sm text-zinc-500 dark:text-zinc-500">
          <div className="flex items-center">
            <Button onClick={handleGameButtonClick}>
              While that happens, play a game?
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineIndicator;