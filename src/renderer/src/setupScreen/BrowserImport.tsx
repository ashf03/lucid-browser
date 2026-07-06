import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import clickaudio from './click.mp3';
import { ArrowRight } from '@phosphor-icons/react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface BrowserImportProps {
  nextStep: () => void;
}

interface QuickActionBookmark {
  id: string;
  title: string;
  url: string;
  icon?: string;
}

interface BookmarksData {
  bookmarkBar: (BrowserBookmark | BookmarkFolder)[];
  otherBookmarks: (BrowserBookmark | BookmarkFolder)[];
}

interface HistoryItem {
  url: string;
  title: string;
  visitCount: number;
  lastVisit: Date;
}

interface BrowserImportResult {
  success: boolean;
  error?: string;
  bookmarks?: BookmarksData;
  history?: HistoryItem[];
}

interface BrowserBookmark {
  type: 'bookmark';
  name: string;
  url: string;
  dateAdded: Date;
}

interface BookmarkFolder {
  type: 'folder';
  name: string;
  children: (BrowserBookmark | BookmarkFolder)[];
}

interface ImportedData {
  bookmarks: BookmarksData | null;
  bookmarksSource: string | null;
  history: HistoryItem[] | null;
  historySource: string | null;
  bookmarksAddedToQuickActions: boolean;
  quickActionsError: string | null;
  // New fields for history integration
  historyAddedToStore: boolean;
  historyStoreError: string | null;
}

type OpenSection = 'bookmarks' | 'history' | null;

const BrowserImport: React.FC<BrowserImportProps> = ({ nextStep }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [browsers, setBrowsers] = useState<Record<string, string>>({});
  const [selectedBookmarksBrowser, setSelectedBookmarksBrowser] = useState<string>('');
  const [selectedBookmarksBrowserName, setSelectedBookmarksBrowserName] = useState<string>('Select a browser...');
  const [selectedHistoryBrowser, setSelectedHistoryBrowser] = useState<string>('');
  const [selectedHistoryBrowserName, setSelectedHistoryBrowserName] = useState<string>('Select a browser...');
  const [importedData, setImportedData] = useState<ImportedData>({
    bookmarks: null,
    bookmarksSource: null,
    history: null,
    historySource: null,
    bookmarksAddedToQuickActions: false,
    quickActionsError: null,
    historyAddedToStore: false,
    historyStoreError: null
  });
  const [loading, setLoading] = useState<{
    bookmarks: boolean;
    history: boolean;
  }>({
    bookmarks: false,
    history: false
  });
  const [openSection, setOpenSection] = useState<OpenSection>(null);
  
  // Initialize the audio element
  useEffect(() => {
    audioRef.current = new Audio(clickaudio);
    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    detectBrowsers();
  }, []);
  
  // Function to play the click sound
  const playClickSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => console.error("Audio play failed:", error));
    }
  };

  const extractAllBookmarks = (items: (BrowserBookmark | BookmarkFolder)[]): BrowserBookmark[] => {
    const bookmarks: BrowserBookmark[] = [];
    
    for (const item of items) {
      if (item.type === 'bookmark') {
        bookmarks.push(item as BrowserBookmark);
      } else if (item.type === 'folder') {
        const folder = item as BookmarkFolder;
        bookmarks.push(...extractAllBookmarks(folder.children));
      }
    }
    
    return bookmarks;
  };

  // Function to convert imported bookmarks to QuickActions format
  const convertToQuickActionBookmarks = (importedBookmarks: BookmarksData): QuickActionBookmark[] => {
    // Extract all bookmarks from both bookmark bar and other bookmarks
    const allImportedBookmarks = [
      ...extractAllBookmarks(importedBookmarks.bookmarkBar),
      ...extractAllBookmarks(importedBookmarks.otherBookmarks)
    ];

    // Convert to QuickActions format
    return allImportedBookmarks.map(bookmark => ({
      id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: bookmark.name,
      url: bookmark.url,
      icon: `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}`
    }));
  };

  // Function to save bookmarks to QuickActions storage
  const saveBookmarksToQuickActions = async (newBookmarks: QuickActionBookmark[]): Promise<void> => {
    try {
      // Get existing bookmarks from storage
      const existingBookmarks = await window.electronAPI.store.get('bookmarks') as QuickActionBookmark[] || [];
      
      // Filter out duplicates based on URL
      const uniqueNewBookmarks = newBookmarks.filter(newBookmark => {
        return !existingBookmarks.some(existingBookmark => {
          try {
            const normalizeUrl = (url: string) => {
              const urlObj = new URL(url);
              return urlObj.hostname.replace(/^www\./, '') + urlObj.pathname.replace(/\/$/, '');
            };
            return normalizeUrl(existingBookmark.url) === normalizeUrl(newBookmark.url);
          } catch {
            return existingBookmark.url === newBookmark.url;
          }
        });
      });

      // Combine existing and new bookmarks
      const combinedBookmarks = [...existingBookmarks, ...uniqueNewBookmarks];
      
      // Save to storage
      await window.electronAPI.store.set('bookmarks', combinedBookmarks);
      
      console.log(`Added ${uniqueNewBookmarks.length} new bookmarks to QuickActions`);
      return;
    } catch (error) {
      console.error('Failed to save bookmarks to QuickActions:', error);
      throw error;
    }
  };

  // Function to save imported history to persistent store
  const saveHistoryToPersistentStore = async (importedHistory: HistoryItem[]): Promise<void> => {
    try {
      console.log(`Saving ${importedHistory.length} history items to persistent store...`);
      
      // Get existing history to prevent duplicates
      const existingHistory = await window.electronAPI.history.getAll();
      const existingUrls = new Set(existingHistory.map(entry => entry.url));
      
      // Convert imported history to the format expected by the history store
      const historyEntries = importedHistory
        .filter(item => !existingUrls.has(item.url)) // Filter out duplicates
        .map(item => ({
          url: item.url,
          title: item.title,
          timestamp: item.lastVisit,
          tabId: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          visitCount: item.visitCount,
          favicon: (() => {
            try {
              return `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}`;
            } catch {
              return undefined;
            }
          })()
        }));

      console.log(`Filtered ${importedHistory.length - historyEntries.length} duplicate entries`);

      // Add history entries individually
      let addedCount = 0;
      for (const entry of historyEntries) {
        try {
          const result = await window.electronAPI.history.add(entry);
          if (result.success) {
            addedCount++;
          } else {
            console.warn(`Failed to add history entry: ${entry.url}`, result.error);
          }
        } catch (error) {
          console.warn(`Failed to add history entry: ${entry.url}`, error);
        }
      }
      console.log(`Successfully imported ${addedCount} out of ${historyEntries.length} history entries`);

    } catch (error) {
      console.error('Failed to save history to persistent store:', error);
      throw error;
    }
  };
  
  const handleContinueClick = () => {
    // Play click sound
    playClickSound();
    
    // Call the nextStep function
    nextStep();
  };

  const detectBrowsers = async () => {
    try {
      const detectedBrowsers = await (window as any).electronAPI.browserImport.detectBrowsers();
      setBrowsers(detectedBrowsers);
    } catch (error) {
      console.error('Error detecting browsers:', error);
    }
  };

  const handleBookmarksBrowserSelect = (browserKey: string, browserName: string) => {
    playClickSound();
    setSelectedBookmarksBrowser(browserKey);
    setSelectedBookmarksBrowserName(browserName);
  };

  const handleHistoryBrowserSelect = (browserKey: string, browserName: string) => {
    playClickSound();
    setSelectedHistoryBrowser(browserKey);
    setSelectedHistoryBrowserName(browserName);
  };

  const importBookmarks = async () => {
    if (!selectedBookmarksBrowser) {
      return;
    }

    playClickSound();  
    setLoading(prev => ({ ...prev, bookmarks: true }));
    
    try {
      const result: BrowserImportResult = await (window as any).electronAPI.browserImport.importBookmarks(selectedBookmarksBrowser);
      
      if (result.success && result.bookmarks) {
        // First, update the imported data
        setImportedData(prev => ({ 
          ...prev, 
          bookmarks: result.bookmarks!,
          bookmarksSource: selectedBookmarksBrowserName,
          bookmarksAddedToQuickActions: false,
          quickActionsError: null
        }));
        
        setOpenSection('bookmarks');
        
        // Then automatically add to Quick Actions
        try {
          const quickActionBookmarks = convertToQuickActionBookmarks(result.bookmarks);
          await saveBookmarksToQuickActions(quickActionBookmarks);
          
          // Update state to show success
          setImportedData(prev => ({
            ...prev,
            bookmarksAddedToQuickActions: true,
            quickActionsError: null
          }));
          
          // Hide success message after 5 seconds
          setTimeout(() => {
            setImportedData(prev => ({
              ...prev,
              bookmarksAddedToQuickActions: false
            }));
          }, 5000);
          
        } catch (quickActionsError) {
          console.error('Failed to add bookmarks to QuickActions:', quickActionsError);
          setImportedData(prev => ({
            ...prev,
            bookmarksAddedToQuickActions: false,
            quickActionsError: 'Failed to add bookmarks to Quick Actions'
          }));
        }
      }
    } catch (error) {
      console.error('Error importing bookmarks:', error);
    }
    
    setLoading(prev => ({ ...prev, bookmarks: false }));
  };

  const importHistory = async () => {
    if (!selectedHistoryBrowser) {
      return;
    }

    playClickSound();
    setLoading(prev => ({ ...prev, history: true }));
    
    try {
      const result: BrowserImportResult = await (window as any).electronAPI.browserImport.importHistory(selectedHistoryBrowser);
      
      if (result.success && result.history) {
        // Step 1: Update local state for display
        setImportedData(prev => ({ 
          ...prev, 
          history: result.history!,
          historySource: selectedHistoryBrowserName,
          historyAddedToStore: false,
          historyStoreError: null
        }));
        setOpenSection('history');

        // Step 2: Save imported history to persistent store
        try {
          await saveHistoryToPersistentStore(result.history);
          
          // Update success state
          setImportedData(prev => ({
            ...prev,
            historyAddedToStore: true,
            historyStoreError: null
          }));

          // Hide success message after 5 seconds
          setTimeout(() => {
            setImportedData(prev => ({
              ...prev,
              historyAddedToStore: false
            }));
          }, 5000);

        } catch (storeError) {
          console.error('Failed to save history to persistent store:', storeError);
          setImportedData(prev => ({
            ...prev,
            historyAddedToStore: false,
            historyStoreError: `Failed to save history: ${
              typeof storeError === 'object' && storeError !== null && 'message' in storeError
                ? (storeError as { message?: string }).message
                : String(storeError) || 'Unknown error'
            }`
          }));
        }
      } else {
        throw new Error(result.error || 'Failed to import history');
      }
    } catch (error) {
      console.error('Error importing history:', error);
      setImportedData(prev => ({
        ...prev,
        historyStoreError: `Import failed: ${
          typeof error === 'object' && error !== null && 'message' in error
            ? (error as { message?: string }).message
            : String(error) || 'Unknown error'
        }`
      }));
    }
    
    setLoading(prev => ({ ...prev, history: false }));
  };

  const clearBookmarks = () => {
    playClickSound();
    setImportedData(prev => ({ 
      ...prev, 
      bookmarks: null,
      bookmarksSource: null,
      bookmarksAddedToQuickActions: false,
      quickActionsError: null
    }));
    setOpenSection(null);
  };

  const clearHistory = () => {
    playClickSound();
    setImportedData(prev => ({ 
      ...prev, 
      history: null,
      historySource: null,
      historyAddedToStore: false,
      historyStoreError: null
    }));
    setOpenSection(null);
  };

  const handleBookmarksToggle = (isOpen: boolean) => {
    setOpenSection(isOpen ? 'bookmarks' : null);
  };

  const handleHistoryToggle = (isOpen: boolean) => {
    setOpenSection(isOpen ? 'history' : null);
  };

  const renderBookmarksSection = (bookmarks: (BrowserBookmark | BookmarkFolder)[], title: string) => {
    if (bookmarks.length === 0) return null;
    
    return (
      <div key={title}>
        <h3 className="mt-5 mb-2 font-medium text-gray-700">{title}</h3>
        {bookmarks.map((item, index) => {
          if (item.type === 'bookmark') {
            const bookmark = item as BrowserBookmark;
            return (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded p-3 mb-2">
                <div className="font-bold mb-1">{bookmark.name}</div>
                <div className="text-blue-500 text-sm break-all">{bookmark.url}</div>
                <div className="text-gray-500 text-xs mt-1">Added: {bookmark.dateAdded.toLocaleDateString()}</div>
              </div>
            );
          } else if (item.type === 'folder') {
            const folder = item as BookmarkFolder;
            if (folder.children.length > 0) {
              return renderBookmarksSection(folder.children, `${title} > ${folder.name}`);
            }
          }
          return null;
        })}
      </div>
    );
  };

  const countBookmarks = (folder: (BrowserBookmark | BookmarkFolder)[]): number => {
    let count = 0;
    folder.forEach(item => {
      if (item.type === 'bookmark') {
        count++;
      } else if (item.type === 'folder') {
        count += countBookmarks((item as BookmarkFolder).children);
      }
    });
    return count;
  };

  const bookmarksCount = importedData.bookmarks ? 
    countBookmarks(importedData.bookmarks.bookmarkBar) + 
    countBookmarks(importedData.bookmarks.otherBookmarks) : 0;
  
  const historyCount = importedData.history ? importedData.history.length : 0;
  
  return (
    <>
      <div className="text-center relative overflow-hidden flex flex-col items-center justify-center">
        <div className="max-w-3xl w-full flex flex-col">
          <div className="max-w-4xl mx-auto p-6 rounded-lg">
            <h1 className="text-center text-white tracking-tighter text-4xl font-bold mb-1">
              import your previous browser's data.
            </h1>
            <div className="p-5">
              {/* Bookmarks Section */}
              <div className="mb-6">
                <div className='flex w-full justify-start'>
                <Label className="text-white text-lg font-medium mb-2 block">Import Bookmarks</Label>
                </div>
                <div className="flex gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="flex-1 justify-between p-2.5 h-auto text-base bg-white cursor-none cursor-target"
                      >
                        {selectedBookmarksBrowserName}
                        <ChevronDown size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full min-w-[var(--radix-dropdown-menu-trigger-width)]">
                      {Object.entries(browsers).map(([key, name]) => (
                        <DropdownMenuItem 
                          key={key}
                          onClick={() => handleBookmarksBrowserSelect(key, name)}
                          className="hover:bg-white cursor-none cursor-target"
                        >
                          {name}
                        </DropdownMenuItem>
                      ))}
                      {Object.keys(browsers).length === 0 && (
                        <DropdownMenuItem disabled>
                          No browsers found
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Button 
                    onClick={importBookmarks}
                    disabled={!selectedBookmarksBrowser || loading.bookmarks}
                    className="px-6 py-3 text-base bg-white text-black hover:bg-white disabled:bg-gray-300 cursor-none cursor-target"
                    variant="default"
                  >
                    {loading.bookmarks ? 'Loading...' : 'Import'}
                  </Button>
                </div>
              </div>

              {/* History Section */}
              <div className="mb-6">
                <div className='flex w-full justify-start'>
                <Label className="text-white text-lg font-medium mb-2 block">Import History</Label>
                </div>
                <div className="flex gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="flex-1 justify-between p-2.5 h-auto text-base bg-white cursor-none cursor-target"
                      >
                        {selectedHistoryBrowserName}
                        <ChevronDown size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full min-w-[var(--radix-dropdown-menu-trigger-width)]">
                      {Object.entries(browsers).map(([key, name]) => (
                        <DropdownMenuItem 
                          key={key}
                          onClick={() => handleHistoryBrowserSelect(key, name)}
                          className="hover:bg-white cursor-none cursor-target"
                        >
                          {name}
                        </DropdownMenuItem>
                      ))}
                      {Object.keys(browsers).length === 0 && (
                        <DropdownMenuItem disabled>
                          No browsers found
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Button 
                    onClick={importHistory}
                    disabled={!selectedHistoryBrowser || loading.history}
                    className="px-6 py-3 text-base bg-white text-black hover:bg-white disabled:bg-gray-300 cursor-none cursor-target"
                    variant="default"
                  >
                    {loading.history ? 'Loading...' : 'Import'}
                  </Button>
                </div>
              </div>

              {/* Imported Bookmarks Display */}
              {importedData.bookmarks && (
                <div className='mb-4'>
                  <Collapsible 
                    open={openSection === 'bookmarks'} 
                    onOpenChange={handleBookmarksToggle}
                    className="p-5 border border-gray-300 rounded-md bg-white"
                  >
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="flex items-center gap-2 p-0 text-slate-700 text-xl font-semibold hover:bg-transparent cursor-none cursor-target"
                        >
                          Bookmarks from {importedData.bookmarksSource} ({bookmarksCount})
                          {openSection === 'bookmarks' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </Button>
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={clearBookmarks}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 cursor-none cursor-target"
                        >
                          <Trash2 size={16} />
                          Clear
                        </Button>
                      </div>
                    </div>

                    <CollapsibleContent className="mt-4">
                      <div className="h-[300px] overflow-y-auto border border-gray-300 rounded p-4 sidebar-scrollbar">
                        {importedData.bookmarks.bookmarkBar.length > 0 && 
                          renderBookmarksSection(importedData.bookmarks.bookmarkBar, 'Bookmarks Bar')}
                        {importedData.bookmarks.otherBookmarks.length > 0 && 
                          renderBookmarksSection(importedData.bookmarks.otherBookmarks, 'Other Bookmarks')}
                      </div>
                      
                      {/* Bookmarks Success/Error Feedback */}
                      {importedData.bookmarksAddedToQuickActions && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                          <div className="text-green-700 text-sm font-medium">
                            ✓ Bookmarks successfully added to Quick Actions
                          </div>
                        </div>
                      )}
                      
                      {importedData.quickActionsError && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                          <div className="text-red-700 text-sm font-medium">
                            ✗ {importedData.quickActionsError}
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              {/* Imported History Display */}
              {importedData.history && (
                <div>
                  <Collapsible 
                    open={openSection === 'history'} 
                    onOpenChange={handleHistoryToggle}
                    className="p-5 border border-gray-300 rounded-md bg-white"
                  >
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="flex items-center gap-2 p-0 h-auto text-slate-700 text-xl font-semibold hover:bg-transparent cursor-none cursor-target"
                        >
                          History from {importedData.historySource} ({historyCount})
                          {openSection === 'history' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        onClick={clearHistory}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 cursor-none cursor-target"
                      >
                        <Trash2 size={16} />
                        Clear
                      </Button>
                    </div>
                    <CollapsibleContent className="mt-4">
                      <div className="h-[250px] overflow-y-auto border border-gray-300 rounded p-4 sidebar-scrollbar">
                        {importedData.history.slice(0, 100).map((item, index) => (
                          <div key={index} className="bg-gray-50 border border-gray-200 rounded p-3 mb-2">
                            <div className="font-bold mb-1">{item.title}</div>
                            <div className="text-blue-500 text-sm break-all">{item.url}</div>
                            <div className="text-gray-500 text-xs mt-1">
                              Visits: {item.visitCount} • Last visit: {item.lastVisit.toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                        {importedData.history.length > 100 && (
                          <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-2">
                            <em>Showing first 100 of {importedData.history.length} history items</em>
                          </div>
                        )}
                      </div>
                      
                      {/* History Success/Error Feedback */}
                      {importedData.historyAddedToStore && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                          <div className="text-green-700 text-sm font-medium">
                            ✓ History successfully added to your browser's persistent storage
                          </div>
                        </div>
                      )}
                      
                      {importedData.historyStoreError && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                          <div className="text-red-700 text-sm font-medium">
                            ✗ {importedData.historyStoreError}
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </div>
            <div className='justify-start flex w-full'>
              <Button 
                onClick={handleContinueClick}
                className="font-medium justify-items-start bg-white text-black hover:bg-white cursor-target text-lg h-10 max-w-[160px] cursor-none"
              >
                Continue <ArrowRight size={21} className="ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BrowserImport;