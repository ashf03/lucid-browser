import React, { useState, useEffect, useRef, useCallback, MouseEvent } from 'react';
import { Terminal, ArrowClockwise, Eraser, Clock, Globe, Lock } from '@phosphor-icons/react';
import { Button } from '../ui/button'
import MemoryUsage, { MemoryData } from '../lib/mem';
import { useAuth } from '../Auth/AuthContext';
import { AlertTriangle, ExternalLink, Search, Trash2, Calendar } from 'lucide-react';
import { useView } from '../components/parts/ViewContext';

interface HistoryEntry {
  url: string;
  title: string;
  timestamp: Date;
  tabId: string;
  visitCount: number;
  favicon?: string;
}

interface GroupedHistoryEntry {
  date: string;
  entries: HistoryEntry[];
}

const Data: React.FC = () => {
  // Add auth context for logout functionality
  const { signOut } = useAuth();
  
  // Add useView hook for navigation handling like VideoGallery
  const { activeTabId, webviewRefs, updateTabState, activeTab } = useView();
  
  const [logs, setLogs] = useState<{ type: string; content: string; timestamp: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReloading, setIsReloading] = useState(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // History state
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // Date range deletion state
  const [showDateRangeDelete, setShowDateRangeDelete] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    setIsLoading(true);

    // Save original console methods
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };

    // Function to format and add logs to our state
    const addLog = (type: string, args: any[]) => {
      const timestamp = new Date().toLocaleTimeString();
      const formattedArgs = args.map((arg: null) => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      });

      setLogs(prevLogs => [
        ...prevLogs,
        {
          type,
          content: formattedArgs.join(' '),
          timestamp
        }
      ]);
    };

    // Override console methods
    console.log = (...args) => {
      originalConsole.log(...args);
      addLog('log', args);
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      addLog('warn', args);
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      addLog('error', args);
    };

    console.info = (...args) => {
      originalConsole.info(...args);
      addLog('info', args);
    };

    // Simulate some sample logs
    setTimeout(() => {
      console.log('Fetching store data...');
      console.log('Navigation history:', { currentIndex: 2, urls: ['https://example.com', 'https://google.com', 'https://github.com'] });
      console.log('Theme:', 'dark');
      console.warn('Some permissions might be missing');
      console.log('Additional data loaded successfully');
      console.error('Failed to load bookmarks data');
      console.log('Store data refresh complete');
      setIsLoading(false);
    }, 1000);

    // Cleanup function to restore original console
    return () => {
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.info = originalConsole.info;
    };
  }, []);

  // Load browsing history from dedicated history store
  useEffect(() => {
    const loadBrowsingHistory = async () => {
      setIsHistoryLoading(true);
      try {
        // Load from dedicated history store instead of tabs
        const history = await window.electronAPI.history.getAll();
        
        // Convert to the expected format
        const entries: HistoryEntry[] = history.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp) // Ensure timestamp is Date object
        }));

        // Sort by timestamp (most recent first)
        const sortedEntries = entries.sort((a, b) => 
          b.timestamp.getTime() - a.timestamp.getTime()
        );

        setHistoryEntries(sortedEntries);
        console.log(`Loaded ${sortedEntries.length} history entries from store`);
      } catch (error) {
        console.error('Failed to load browsing history:', error);
        setHistoryEntries([]);
      } finally {
        setIsHistoryLoading(false);
      }
    };

    loadBrowsingHistory();
  }, []);

  // Real-time search using the dedicated search API
  useEffect(() => {
    const performSearch = async () => {
      if (!historySearchQuery.trim()) {
        // Load all history when search is empty
        try {
          const history = await window.electronAPI.history.getAll();
          const entries = history.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp)
          }));
          setHistoryEntries(entries.sort((a, b) => 
            b.timestamp.getTime() - a.timestamp.getTime()
          ));
        } catch (error) {
          console.error('Failed to load all history:', error);
        }
      } else {
        // Perform search
        try {
          const searchResults = await window.electronAPI.history.search(historySearchQuery);
          const entries = searchResults.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp)
          }));
          setHistoryEntries(entries);
        } catch (error) {
          console.error('Failed to search history:', error);
        }
      }
    };

    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [historySearchQuery]);

  // Handle reload button click
  const handleReload = () => {
    setIsReloading(true);
    console.log('Reloading store data...');

    setTimeout(() => {
      console.log('Navigation history refreshed');
      console.log('Theme:', 'system');
      console.log('Permissions updated');
      console.log('Store data refresh complete');
      setIsReloading(false);
    }, 1000);
  };

  const getLogStyle = (type: any) => {
    switch (type) {
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warn':
        return 'text-yellow-700 dark:text-yellow-400';
      case 'info':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-zinc-800 dark:text-zinc-200';
    }
  };

  const [memoryData, setMemoryData] = useState<MemoryData[]>([]);

  const getCurrentMemoryUsage = () => {
    if (memoryData.length === 0) return null;
    return memoryData[memoryData.length - 1];
  };

  const currentMemory = getCurrentMemoryUsage();

  const formatBytes = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  // Updated resetBrowser function with logout functionality
  const resetBrowser = async () => {
    if (confirm('Are you sure that you want to delete your browser to default settings? This will also log you out of your account. This cannot be undone.')) {
      console.info("Clearing browser data...");
      
      // Clear browser data
      window.electronAPI.factoryResetBrowser();
      console.info("Cleared browser data");

      if (confirm("Restart the application now?")) {
        console.log("Restarting application...");
        
        // Sign out user just before restart (optional since restart will clear everything)
        try {
          console.info("Signing out user...");
          signOut().catch(() => {}); // Don't await, just fire and forget
        } catch (error) {
          console.error("Error signing out user:", error);
        }
        
        // Restart immediately
        window.electronAPI.restartApp();
      } else {
        // If not restarting, at least sign out the user
        try {
          console.info("Signing out user...");
          await signOut();
          console.info("User signed out successfully");
        } catch (error) {
          console.error("Error signing out user:", error);
        }
      }
    }
  };

  // History utility functions
  const extractDomainFromUrl = (url: string): string => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  };

  const getFaviconUrl = (url: string): string => {
    try {
      const domain = new URL(url).origin
      return `${domain}/favicon.ico`
    } catch {
      return ''
    }
  };

  const formatHistoryTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return timestamp.toLocaleDateString()
  };

  const getSecurityIcon = (url: string) => {
    if (url.startsWith('https://')) {
      return <Lock className="w-3 h-3 text-green-500" />
    } else if (url.startsWith('http://')) {
      return <AlertTriangle className="w-3 h-3 text-yellow-500" />
    }
    return <Globe className="w-3 h-3 text-gray-400" />
  };

  // Updated navigation function to use the same pattern as VideoGallery
  const handleNavigateToUrl = useCallback((url: string, e: MouseEvent) => {
    e.preventDefault();
    let processedUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      processedUrl = `https://${url}`;
    }
    
    const webview = webviewRefs.current.get(activeTabId);
    if (webview) {
      webview
        .loadURL(processedUrl)
        .then(() => {
          updateTabState(activeTabId, {
            url: processedUrl,
            navigationHistory: [...activeTab.navigationHistory.slice(0, activeTab.historyIndex + 1), processedUrl],
            historyIndex: activeTab.historyIndex + 1,
          });
        })
        .catch((error) => {
          console.error("Failed to load URL:", error);
        });
    }
  }, [activeTab, activeTabId, updateTabState, webviewRefs]);

  // Group history by date
  const groupedHistory: GroupedHistoryEntry[] = historyEntries.reduce((groups: GroupedHistoryEntry[], entry) => {
    const date = entry.timestamp.toDateString();
    const existingGroup = groups.find(group => group.date === date);
    
    if (existingGroup) {
      existingGroup.entries.push(entry);
    } else {
      groups.push({
        date,
        entries: [entry]
      });
    }
    
    return groups;
  }, []);

  // Clear browsing history using the dedicated API
  const clearBrowsingHistory = async () => {
    if (confirm('Are you sure you want to clear all browsing history? This cannot be undone.')) {
      try {
        const result = await window.electronAPI.history.clear();
        if (result.success) {
          setHistoryEntries([]);
          console.log('Browsing history cleared successfully');
        } else {
          console.error('Failed to clear history:', result.error);
        }
      } catch (error) {
        console.error('Failed to clear browsing history:', error);
      }
    }
  };

  // Delete individual history entry
  const deleteHistoryEntry = async (url: string) => {
    try {
      const result = await window.electronAPI.history.delete(url);
      if (result.success) {
        // Remove from local state
        setHistoryEntries(prev => prev.filter(entry => entry.url !== url));
        console.log('History entry deleted:', url);
      } else {
        console.error('Failed to delete history entry:', result.error);
      }
    } catch (error) {
      console.error('Failed to delete history entry:', error);
    }
  };

  // Date range deletion functionality
  const handleDateRangeDelete = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    if (confirm(`Delete all history from ${startDate} to ${endDate}?`)) {
      try {
        const result = await window.electronAPI.history.deleteByDateRange(startDate, endDate);
        if (result.success) {
          console.log(`Deleted ${result.deletedCount} history entries`);
          // Reload history
          const updatedHistory = await window.electronAPI.history.getAll();
          setHistoryEntries(updatedHistory.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp)
          })));
          setShowDateRangeDelete(false);
          setStartDate('');
          setEndDate('');
        }
      } catch (error) {
        console.error('Failed to delete by date range:', error);
      }
    }
  };

  // Updated navigate to history item using the same pattern as VideoGallery
  const navigateToHistoryItem = (entry: HistoryEntry) => {
    handleNavigateToUrl(entry.url, { preventDefault: () => {} } as MouseEvent);
  };

  // Copy URL to clipboard
  const copyHistoryUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      console.log('URL copied to clipboard:', url);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  return (
    <div className="mx-auto p-6 flex flex-col bg-background overflow-hidden">
      <div className="overflow-hidden">
        <h1 className="text-3xl font-semibold text-foreground">Data Settings</h1>

        <div className="mt-2 mb-2 border-b border-zinc-300 dark:border-zinc-800"></div>

        <div className='w-full'>
          <MemoryUsage />
        </div>

        <div className="p-2 border-zinc-200 dark:border-zinc-800 transition-all duration-300">
          <div className="flex justify-between items-center mb-2">
            <div className='flex gap-3 flex-row items-center justify-center'>
              <Terminal size={35} />
              <div className='flex flex-col'>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  Console Logs
                </h2>

                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  <p>Showing {logs.length} console log entries</p>
                </div>
              </div>
            </div>

            <div className='flex flex-row gap-3'>
              <button
                onClick={handleReload}
                disabled={isReloading}
                className={`px-3 py-2 rounded-md flex items-center gap-1.5 text-sm font-medium transition-all ${isReloading
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed'
                  : 'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                  }`}
              >
                <ArrowClockwise className={`size-4 ${isReloading ? 'animate-spin' : ''}`} />
                {isReloading ? 'Refreshing...' : 'Refresh'}
              </button>

              <Button className="w-full bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-zinc-300 dark:border-zinc-800 text-foreground"
                onClick={resetBrowser}
              >
                <Eraser className='size-4' />
                <span className="text-foreground text-sm">Erase Browser</span>
              </Button>
            </div>
          </div>

          {isReloading && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 px-4 py-2 rounded-md mb-4 flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-b-transparent border-yellow-500"></div>
              <span>Reloading store data...</span>
            </div>
          )}

          {/* Updated console styling to respect light/dark mode */}
          <div className="bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 font-mono text-sm rounded-lg p-4 overflow-auto max-h-[300px] border border-zinc-200 dark:border-zinc-800">
            <div className="terminal-logs space-y-1">
              {logs.length === 0 ? (
                <div className="text-zinc-500 dark:text-zinc-400">No console logs to display</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className={`log-entry ${getLogStyle(log.type)}`}>
                    <span className="text-zinc-500 dark:text-zinc-400 mr-2">[{log.timestamp}]</span>
                    <span className={`log-type mr-1 ${log.type === 'log' ? 'text-green-600 dark:text-green-400' :
                      log.type === 'warn' ? 'text-yellow-700 dark:text-yellow-400' :
                        log.type === 'error' ? 'text-red-600 dark:text-red-400' :
                          'text-blue-600 dark:text-blue-400'
                      }`}>
                      {log.type}:
                    </span>
                    <span className="log-content whitespace-pre-wrap">{log.content}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Navigation History Section */}
        <div className="p-2 border-zinc-200 dark:border-zinc-800 transition-all duration-300 mt-6">
          <div className="flex justify-between items-center mb-4">
            <div className='flex gap-3 flex-row items-center justify-center'>
              <Clock size={35} />
              <div className='flex flex-col'>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  Browsing History
                </h2>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  <p>Showing {historyEntries.length} history entries</p>
                </div>
              </div>
            </div>

            <div className='flex flex-row gap-3'>
              <Button 
                className="bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300"
                onClick={() => setShowDateRangeDelete(true)}
                disabled={historyEntries.length === 0}
              >
                <Calendar className='size-4' />
                <span className="text-sm">Delete Range</span>
              </Button>

              <Button 
                className="bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300"
                onClick={clearBrowsingHistory}
                disabled={historyEntries.length === 0}
              >
                <Trash2 className='size-4' />
                <span className="text-sm">Clear History</span>
              </Button>
            </div>
          </div>

          {/* History Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search browsing history..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          {/* Date Range Delete Modal */}
          {showDateRangeDelete && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-white">
                  Delete History by Date Range
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <Button
                    onClick={() => {
                      setShowDateRangeDelete(false);
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="flex-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDateRangeDelete}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    disabled={!startDate || !endDate}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* History Content with Date Divisions */}
          <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-h-[400px] overflow-hidden">
            {isHistoryLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-b-transparent border-blue-500"></div>
                <span className="ml-3 text-zinc-600 dark:text-zinc-400">Loading history...</span>
              </div>
            ) : groupedHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500 dark:text-zinc-400">
                <Clock className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No history found</p>
                <p className="text-sm text-center">
                  {historySearchQuery ? 'Try a different search term' : 'Start browsing to build your history'}
                </p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[400px]">
                {groupedHistory.map((group, groupIndex) => (
                  <div key={group.date}>
                    {/* Date Header */}
                    <div className="sticky top-0 bg-zinc-200 dark:bg-zinc-800 px-4 py-2 border-b border-zinc-300 dark:border-zinc-700">
                      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        {formatDateHeader(group.date)}
                      </h3>
                    </div>
                    {/* History Items for this date */}
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                      {group.entries.map((entry, index) => (
                        <HistoryItemRow
                          key={`${entry.url}-${entry.tabId}-${index}`}
                          entry={entry}
                          onNavigate={() => navigateToHistoryItem(entry)}
                          onCopyUrl={() => copyHistoryUrl(entry.url)}
                          handleNavigateToUrl={handleNavigateToUrl}
                          onDelete={deleteHistoryEntry}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to format date headers
const formatDateHeader = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
};

// Updated individual history item component with delete functionality
interface HistoryItemRowProps {
  entry: HistoryEntry;
  onNavigate: () => void;
  onCopyUrl: () => void;
  handleNavigateToUrl: (url: string, e: MouseEvent) => void;
  onDelete: (url: string) => Promise<void>;
}

const HistoryItemRow: React.FC<HistoryItemRowProps> = ({ 
  entry, 
  onNavigate, 
  onCopyUrl,
  handleNavigateToUrl,
  onDelete
}) => {
  const [imageError, setImageError] = useState(false);

  const getSecurityIcon = (url: string) => {
    if (url.startsWith('https://')) {
      return <Lock className="w-3 h-3 text-green-500" />
    } else if (url.startsWith('http://')) {
      return <AlertTriangle className="w-3 h-3 text-yellow-500" />
    }
    return <Globe className="w-3 h-3 text-zinc-400" />
  };

  const formatHistoryTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return timestamp.toLocaleDateString()
  };

  const handleCopyOnly = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await onCopyUrl();
  };

  const handleDeleteOnly = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete "${entry.url}" from history?`)) {
      await onDelete(entry.url);
    }
  };

  return (
    <div className="group flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      {/* Favicon */}
      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
        {entry.favicon && !imageError ? (
          <img
            src={entry.favicon}
            alt=""
            className="w-4 h-4"
            onError={() => setImageError(true)}
          />
        ) : (
          getSecurityIcon(entry.url)
        )}
      </div>

      {/* Content - Updated to use handleNavigateToUrl like VideoGallery */}
      <div 
        className="flex-1 min-w-0 cursor-pointer" 
        onClick={(e) => handleNavigateToUrl(entry.url, e as MouseEvent)}
      >
        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate hover:text-primary transition-colors">
          {entry.title}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {entry.url}
        </p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <div className="flex flex-col items-end">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {formatHistoryTimestamp(entry.timestamp)}
          </span>
          {entry.visitCount > 1 && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {entry.visitCount} visits
            </span>
          )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button
            onClick={handleCopyOnly}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
            title="Copy URL"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            onClick={handleDeleteOnly}
            className="p-1 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"
            title="Delete from History"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Data;