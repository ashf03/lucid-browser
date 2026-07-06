import React, { useState } from 'react';
import { Warning, ArrowCounterClockwise, ArrowLeft, House } from '@phosphor-icons/react';
import { Button } from '../../ui/button';
import Tetris from './Game';

interface ErrorDisplayProps {
  errorCode: number;
  errorDescription: string;
  url: string;
  lastChecked: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  errorCode,
  errorDescription,
  url,
  lastChecked,
}) => {
  // Add state to track if game mode is active
  const [showGame, setShowGame] = useState(false);

  // Toggle game mode handlers
  const handleGameButtonClick = () => {
    setShowGame(true);
  };

  const handleBackButtonClick = () => {
    setShowGame(false);
  };

  // Determine if this is a connection error
  const isConnectionError = [
    -101, // Connection reset
    -102, // Connection refused
    -105, // Name not resolved
    -106, // Internet disconnected
    -109, // Address unreachable
    -130, // Proxy connection failed
    -136, // PROXY_CONNECTION_FAILED
  ].includes(errorCode);

  // Determine if this is a security error
  const isSecurityError = [
    -200, // Certificate error
    -201, // Certificate common name invalid
    -202, // Certificate date invalid
    -203, // Certificate authority invalid
  ].includes(errorCode);

  // Get a user-friendly error message
  const getErrorMessage = () => {
    if (isConnectionError) {
      return "Unable to connect to the website";
    } else if (isSecurityError) {
      return "There's a security issue with this website";
    } else if (errorCode === -3) {
      return "The page load was canceled";
    } else {
      return "Failed to load this webpage";
    }
  };

  // Get troubleshooting steps based on error type
  const getTroubleshootingSteps = () => {
    if (isConnectionError) {
      return [
        "Check your internet connection",
        "Make sure the website address is correct",
        "Try again in a few minutes",
        "Check if the website is down for everyone"
      ];
    } else if (isSecurityError) {
      return [
        "Check if your computer's date and time are correct",
        "Update your browser",
        "Clear your browser cache and cookies",
        "Check your computer for malware"
      ];
    } else {
      return [
        "Refresh the page",
        "Clear your browser cache",
        "Try accessing the site later",
        "Check if the URL is correct"
      ];
    }
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
          <div className="inline-flex items-center justify-center p-3">
            <Warning className="text-red-500 h-16 w-16" />
          </div>
          <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-50">
            {getErrorMessage()}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-center">
            {errorDescription || "An error occurred while loading the page"}
          </p>
          <div className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 max-w-full overflow-hidden text-ellipsis">
            <span className="font-medium">URL:</span> {url || "Unknown URL"}
          </div>
        </div>

        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-5 mb-4">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Try:</p>
          <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            {getTroubleshootingSteps().map((step, index) => (
              <li key={index} className="flex items-start">
                <div className="mr-3 mt-1 h-1.5 w-1.5 rounded-full bg-zinc-300 flex-shrink-0"></div>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-300">
          <span>Error code: {errorCode}</span>
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

export default ErrorDisplay;