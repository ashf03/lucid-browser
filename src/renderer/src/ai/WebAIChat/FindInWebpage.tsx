import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CaretUp, CaretDown, X, MagnifyingGlass } from '@phosphor-icons/react';
import { Button } from '../../ui/button';
import { useView } from '../../components/parts/ViewContext';

const FindInWebpage = () => {
  const [searchText, setSearchText] = useState('');
  const [matchCount, setMatchCount] = useState({ current: 0, total: 0 });
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const findRequestIdRef = useRef<number | null>(null);
  const foundInPageHandlerRef = useRef<((event: { result: { activeMatchOrdinal: any; matches: any; finalUpdate: any; }; }) => void) | null>(null);
  
  // Access the view context to get the active webview
  const { activeTabId, webviewRefs } = useView();

  // Focus the input field when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Create a stable reference to the event handler
  const handleFoundInPage = useCallback((event: { result: { activeMatchOrdinal: any; matches: any; finalUpdate: any; }; }) => {
    if (!event.result) return;
    
    const { activeMatchOrdinal, matches, finalUpdate } = event.result;
    
    if (finalUpdate) {
      setMatchCount({
        current: activeMatchOrdinal || 0,
        total: matches || 0
      });
    }
  }, []);

  // Set up and cleanup event listener for found-in-page
  useEffect(() => {
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview) return;
    
    // Store the handler for cleanup
    foundInPageHandlerRef.current = handleFoundInPage;
    
    // Add event listener
    webview.addEventListener('found-in-page', handleFoundInPage);
    
    // Clean up
    return () => {
      try {
        if (webview) {
          webview.removeEventListener('found-in-page', handleFoundInPage);
          webview.stopFindInPage('clearSelection');
        }
      } catch (error) {
        console.error('Error cleaning up find in page:', error);
      }
    };
  }, [activeTabId, handleFoundInPage]);

  // Clear search when component unmounts
  useEffect(() => {
    return () => {
      stopSearch();
    };
  }, []);

  // Start or update search when text changes
  useEffect(() => {
    if (searchText) {
      performSearch();
    } else {
      stopSearch();
    }
  }, [searchText, activeTabId]);

  // Perform search in the active webview
  const performSearch = useCallback(() => {
    const webview = webviewRefs.current.get(activeTabId);
    
    if (!webview || !searchText) return;
    
    try {
      setIsSearching(true);
      
      // Stop any previous search
      if (findRequestIdRef.current !== null) {
        webview.stopFindInPage('keepSelection');
      }
      
      // Start a new search
      findRequestIdRef.current = webview.findInPage(searchText);
    } catch (error) {
      console.error('Error performing search:', error);
      setIsSearching(false);
    }
  }, [activeTabId, searchText]);

  // Stop the current search
  const stopSearch = useCallback(() => {
    const webview = webviewRefs.current.get(activeTabId);
    
    if (!webview) return;
    
    try {
      // Clear find
      webview.stopFindInPage('clearSelection');
      findRequestIdRef.current = null;
      setIsSearching(false);
      setMatchCount({ current: 0, total: 0 });
    } catch (error) {
      console.error('Error stopping search:', error);
    }
  }, [activeTabId]);

  // Navigate to next match
  const findNext = useCallback(() => {
    const webview = webviewRefs.current.get(activeTabId);
    
    if (!webview || !searchText) return;
    
    try {
      webview.findInPage(searchText, { forward: true, findNext: true });
    } catch (error) {
      console.error('Error finding next match:', error);
    }
  }, [activeTabId, searchText]);

  // Navigate to previous match
  const findPrevious = useCallback(() => {
    const webview = webviewRefs.current.get(activeTabId);
    
    if (!webview || !searchText) return;
    
    try {
      webview.findInPage(searchText, { forward: false, findNext: true });
    } catch (error) {
      console.error('Error finding previous match:', error);
    }
  }, [activeTabId, searchText]);

  // Handle key presses
  const handleKeyDown = useCallback((e: { key: string; preventDefault: () => void; shiftKey: any; }) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        findPrevious();
      } else {
        findNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchText('');
      stopSearch();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      findPrevious();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      findNext();
    }
  }, [findNext, findPrevious, stopSearch]);

  return (
    <div className="w-full flex flex-col">
      <div className="flex items-center space-x-1 mb-2">
        {/* Search input */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find in page..."
            className="w-full pl-7 py-1 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          />
          <MagnifyingGlass 
            size={14} 
            className="absolute left-2 top-1/2 transform -translate-y-1/2 text-zinc-500 dark:text-zinc-400" 
          />
          {searchText && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0"
              onClick={() => setSearchText('')}
            >
              <X size={12} />
            </Button>
          )}
        </div>

        {/* Navigation buttons */}
        <Button
          size="sm"
          variant="ghost"
          disabled={!searchText || matchCount.total === 0}
          onClick={findPrevious}
          className="h-6 w-6 p-0 rounded-full"
          title="Previous match (Shift+Enter or Arrow Up)"
        >
          <CaretUp size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!searchText || matchCount.total === 0}
          onClick={findNext}
          className="h-6 w-6 p-0 rounded-full"
          title="Next match (Enter or Arrow Down)"
        >
          <CaretDown size={14} />
        </Button>
      </div>

      {/* Match counter */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 text-center h-4">
        {isSearching && searchText && (
          matchCount.total > 0 ? (
            <>
              {matchCount.current} of {matchCount.total} match{matchCount.total !== 1 ? 'es' : ''}
            </>
          ) : (
            <>No matches found</>
          )
        )}
      </div>
    </div>
  );
};

export default FindInWebpage;