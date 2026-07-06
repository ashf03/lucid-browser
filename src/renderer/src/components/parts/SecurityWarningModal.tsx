import React, { useState, useEffect } from 'react';
import { WarningOctagon, X } from "@phosphor-icons/react";

interface Threat {
  threatType: string;
  details: string;
}

interface SecurityWarningProps {
  isOpen: boolean;
  url: string;
  threats: Threat[];
  onClose: () => void;
  onProceed: (url: string) => void;
  onGoBack: () => void;
}

export function SecurityWarningModal({ 
  isOpen, 
  url, 
  threats, 
  onClose, 
  onProceed, 
  onGoBack 
}: SecurityWarningProps) {
  // Add a local state to control visibility
  const [visible, setVisible] = useState(true);
  
  // Reset visibility when the dialog prop changes
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
    }
  }, [isOpen, url]);

  useEffect(() => {
    if (isOpen && url) {
      console.log(`Security warning opened for URL: ${url}`)
    }
  }, [isOpen, url])

  // Return null if any condition fails - including our local visibility state
  if (!isOpen || !visible) return null;

  const handleClose = (e: React.MouseEvent) => {
    // Prevent event from bubbling to parent elements
    e.stopPropagation();
    // Just hide the dialog visually without calling any callbacks
    setVisible(false);
    console.log(`Dialog visually hidden without decision for: ${url}`)
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-zinc-200/40 border-none dark:bg-zinc-900/50 backdrop-blur-lg rounded-[8px] shadow-lg w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700 transition-all duration-200">
        {/* Header */}
        <div className="flex items-center px-6 py-4 border-b border-zinc-100 dark:border-zinc-700">
          <span className="text-2xl text-red-600 mr-4"><WarningOctagon /></span>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-zinc-800 dark:text-gray-100">Security Threat Detected</h3>
            <p className="text-sm text-zinc-800/80">This site may be dangerous</p>
          </div>
          <button
            className="text-2xl text-zinc-950 dark:text-zinc-50 rounded-full h-8 w-8 flex items-center justify-center transition-colors"
            onClick={handleClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-2">
          <div className="flex mb-1 items-center">
            <span className="text-sm text-zinc-950 dark:text-zinc-50 font-medium">URL:</span>
            <span className="ml-2 text-sm font-medium text-blue-500 dark:text-blue-200/80 break-all">{url}</span>
          </div>
          <p className="text-sm dark:text-zinc-50 text-zinc-950 mb-2">This site has been flagged for the following reasons:</p>
          <ul className="list-disc pl-5 mb-2 text-sm dark:text-zinc-50 text-zinc-950">
            {threats.map((threat, index) => (
              <li key={index}>
                <strong>{threat.threatType}:</strong> {threat.details}
              </li>
            ))}
          </ul>
          <p className="text-sm dark:text-zinc-50 text-zinc-950 font-semibold">It is strongly recommended to avoid visiting this site.</p>
        </div>
      </div>
    </div>
  );
}

export default SecurityWarningModal;