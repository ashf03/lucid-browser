import React, { useState, useEffect } from 'react';
import { Plus, PencilSimple, Trash, Command, ClockCounterClockwise, Star, Eye, Clipboard, X, PushPin, Sidebar, ArrowsClockwise, Printer, ArrowClockwise, Robot, Camera, Asterisk } from '@phosphor-icons/react';
import { FilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import type { Tab } from '../../types/types';

export const DEFAULT_BLANK_URL = `data:text/html,
<html>
</html>`;

interface Bookmark {
  id: string;
  title: string;
  url: string;
  icon?: string;
}

interface ShortcutAction {
  id: string;
  title: string;
  action: string;
  icon?: React.ComponentType<any>;
}

// Storage interface - what we actually save to storage (without React components)
interface StoredShortcutAction {
  id: string;
  title: string;
  action: string;
}

interface QuickActionsProps {
  isOpen: boolean;
  activeTabId: string;
  tabs: Tab[];
  addTab: (url?: string, options?: { type?: 'standard' | 'tool'; toolType?: 'Asterisk' }) => void;
  getDisplayTitle: (tab: Tab) => string;
  onClose: () => void;
}

// Available actions that can be assigned to quick action buttons
const AVAILABLE_ACTIONS = [
  { id: 'open-history', name: 'Open History Settings', icon: ClockCounterClockwise as React.ComponentType<any> },
  { id: 'add-tab', name: 'New Tab', icon: FilePlus as React.ComponentType<any> },
  { id: 'add-asterisk', name: 'New Asterisk', icon: Asterisk as React.ComponentType<any> },
  { id: 'zen-mode-trigger', name: 'Zen Mode', icon: Eye as React.ComponentType<any> },
  { id: 'clipboard-quick', name: 'Clipboard Quick Access', icon: Clipboard as React.ComponentType<any> },
  { id: 'close-tab', name: 'Close Tab/Asterisk', icon: X as React.ComponentType<any> },
  { id: 'pin-tab', name: 'New Tab Group', icon: PushPin as React.ComponentType<any> },
  { id: 'command-main', name: 'Command Main', icon: Command as React.ComponentType<any> },
  { id: 'toggle-sidebar', name: 'Toggle Sidebar', icon: Sidebar as React.ComponentType<any> },
  { id: 'switch-tabs', name: 'Switch Tabs', icon: ArrowsClockwise as React.ComponentType<any> },
  { id: 'print-trigger', name: 'Print', icon: Printer as React.ComponentType<any> },
  { id: 'reload-trigger', name: 'Reload', icon: ArrowClockwise as React.ComponentType<any> },
  { id: 'browser-ai', name: 'Talk to Webpage', icon: Robot as React.ComponentType<any> },
];

const QuickActions: React.FC<QuickActionsProps> = ({
  isOpen,
  activeTabId,
  tabs,
  addTab,
  getDisplayTitle,
  onClose
}) => {
  // Bookmark state
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isAddBookmarkOpen, setIsAddBookmarkOpen] = useState(false);
  const [newBookmarkTitle, setNewBookmarkTitle] = useState('');
  const [newBookmarkUrl, setNewBookmarkUrl] = useState('');
  const [newBookmarkError, setNewBookmarkError] = useState<string | null>(null);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [editBookmarkTitle, setEditBookmarkTitle] = useState('');
  const [editBookmarkUrl, setEditBookmarkUrl] = useState('');
  const [editBookmarkError, setEditBookmarkError] = useState<string | null>(null);

  // Shortcut Action state
  const [shortcutActions, setShortcutActions] = useState<ShortcutAction[]>([]);
  const [isAddShortcutOpen, setIsAddShortcutOpen] = useState(false);
  const [newShortcutTitle, setNewShortcutTitle] = useState('');
  const [newShortcutActionId, setNewShortcutActionId] = useState('');
  const [newShortcutError, setNewShortcutError] = useState<string | null>(null);
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);
  const [editShortcutTitle, setEditShortcutTitle] = useState('');
  const [editShortcutActionId, setEditShortcutActionId] = useState('');
  const [editShortcutError, setEditShortcutError] = useState<string | null>(null);

  // Debug logging
  console.log('QuickActions component rendered', { 
    bookmarks: bookmarks.length, 
    shortcutActions: shortcutActions.length,
    isOpen 
  });

  // Utility functions
  const processUrl = (url: string): string => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  };

  // Check if current page is blank
  const isBlankPage = () => {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (!activeTab || !activeTab.url) return true;
    return activeTab.url === DEFAULT_BLANK_URL || 
          activeTab.url === 'data:text/html,%0A<html>%0A</html>';
  };

  // Check if current URL is bookmarked
  const isCurrentUrlBookmarked = () => {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (!activeTab || !activeTab.url) return false;
  
    const currentUrl = processUrl(activeTab.url);
    
    return bookmarks.some(bookmark => {
      try {
        const normalizeUrl = (url: string | URL) => {
          const urlObj = new URL(url);
          let hostname = urlObj.hostname.replace(/^www\./, '');
          let pathname = urlObj.pathname.replace(/\/$/, '');
          if (pathname === '') pathname = '/';
          
          return { hostname, pathname, search: urlObj.search };
        };
        
        const bookmarkUrlNorm = normalizeUrl(bookmark.url);
        const activeUrlNorm = normalizeUrl(currentUrl);
        
        const searchMatch = !bookmarkUrlNorm.search || !activeUrlNorm.search || 
                            bookmarkUrlNorm.search === activeUrlNorm.search;
                            
        return bookmarkUrlNorm.hostname === activeUrlNorm.hostname && 
               bookmarkUrlNorm.pathname === activeUrlNorm.pathname &&
               searchMatch;
      } catch (e) {
        try {
          const simplifyUrl = (url: string) => {
            return url.trim().replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');
          };
          return simplifyUrl(bookmark.url) === simplifyUrl(currentUrl);
        } catch (e2) {
          return bookmark.url === currentUrl;
        }
      }
    });
  };

  // Bookmark CRUD operations
  const addBookmark = async (title: string, url: string): Promise<void> => {
    console.log('Adding bookmark:', { title, url });
    if (!title.trim() || !url.trim()) return;
    
    const processedUrl = processUrl(url);
    
    try {
      const newBookmark: Bookmark = {
        id: Date.now().toString(),
        title: title.trim(),
        url: processedUrl,
        icon: `https://www.google.com/s2/favicons?domain=${new URL(processedUrl).hostname}`
      };
      
      const updatedBookmarks = [...bookmarks, newBookmark];
      
      // Save to storage first, then update state
      await window.electronAPI.store.set('bookmarks', updatedBookmarks);
      console.log('Saved bookmarks to storage');
      
      // Verify the save worked by reading it back
      const verification = await window.electronAPI.store.get('bookmarks') as Bookmark[];
      if (verification && Array.isArray(verification) && verification.length === updatedBookmarks.length) {
        setBookmarks(updatedBookmarks);
        console.log('Bookmark successfully added and verified:', updatedBookmarks.length);
      } else {
        console.error('Storage verification failed for bookmarks');
        // Retry once
        await new Promise(resolve => setTimeout(resolve, 100));
        await window.electronAPI.store.set('bookmarks', updatedBookmarks);
        setBookmarks(updatedBookmarks);
      }
    } catch (error) {
      console.error('Failed to save bookmark:', error);
      // On error, still update local state
      const updatedBookmarks = [...bookmarks, {
        id: Date.now().toString(),
        title: title.trim(),
        url: processedUrl,
        icon: `https://www.google.com/s2/favicons?domain=${new URL(processedUrl).hostname}`
      }];
      setBookmarks(updatedBookmarks);
    }
  };

  const editBookmark = async (id: string, updates: { title: string; url: string }): Promise<void> => {
    try {
      const processedUrl = processUrl(updates.url);
      
      const updatedBookmarks = bookmarks.map(bookmark => {
        if (bookmark.id === id) {
          return {
            ...bookmark,
            title: updates.title.trim(),
            url: processedUrl,
            icon: `https://www.google.com/s2/favicons?domain=${new URL(processedUrl).hostname}`
          };
        }
        return bookmark;
      });
      
      await window.electronAPI.store.set('bookmarks', updatedBookmarks);
      setBookmarks(updatedBookmarks);
      console.log('Updated bookmark successfully');
    } catch (error) {
      console.error('Failed to update bookmark:', error);
    }
  };

  const deleteBookmark = async (id: string): Promise<void> => {
    try {
      const updatedBookmarks = bookmarks.filter(bookmark => bookmark.id !== id);
      await window.electronAPI.store.set('bookmarks', updatedBookmarks);
      setBookmarks(updatedBookmarks);
      console.log('Deleted bookmark successfully');
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
    }
  };

  const openBookmark = (url: string): void => {
    console.log('Opening bookmark:', url);
    addTab(url);
    onClose();
  };

  // Shortcut Action CRUD operations
  const addShortcutAction = async (title: string, actionId: string): Promise<void> => {
    console.log('Adding shortcut action:', { title, actionId });
    if (!title.trim() || !actionId.trim()) return;
    
    try {
      const actionData = AVAILABLE_ACTIONS.find(a => a.id === actionId);
      
      // Create the stored version (without React component)
      const newStoredAction: StoredShortcutAction = {
        id: Date.now().toString(),
        title: title.trim(),
        action: actionId
      };
      
      // Create the full version with icon for state
      const newShortcutAction: ShortcutAction = {
        ...newStoredAction,
        icon: actionData?.icon || (Star as React.ComponentType<any>)
      };
      
      // Get current stored actions and add the new one
      const currentStored = await window.electronAPI.store.get('shortcutActions') as StoredShortcutAction[] || [];
      const updatedStoredActions = [...currentStored, newStoredAction];
      
      // Save only the stored version (without React components) to storage
      await window.electronAPI.store.set('shortcutActions', updatedStoredActions);
      console.log('Saved shortcut actions to storage');
      
      // Update local state with the full version (including icons)
      const updatedShortcutActions = [...shortcutActions, newShortcutAction];
      setShortcutActions(updatedShortcutActions);
      console.log('Shortcut action successfully added:', updatedShortcutActions.length);
      
    } catch (error) {
      console.error('Failed to save shortcut action:', error);
      // On error, still update local state
      const actionData = AVAILABLE_ACTIONS.find(a => a.id === actionId);
      const updatedShortcutActions = [...shortcutActions, {
        id: Date.now().toString(),
        title: title.trim(),
        action: actionId,
        icon: actionData?.icon || (Star as React.ComponentType<any>)
      }];
      setShortcutActions(updatedShortcutActions);
    }
  };

  const editShortcutAction = async (id: string, updates: { title: string; action: string }): Promise<void> => {
    try {
      const actionData = AVAILABLE_ACTIONS.find(a => a.id === updates.action);
      
      // Get current stored actions
      const currentStored = await window.electronAPI.store.get('shortcutActions') as StoredShortcutAction[] || [];
      
      // Update the stored version
      const updatedStoredActions = currentStored.map(action => {
        if (action.id === id) {
          return {
            id,
            title: updates.title.trim(),
            action: updates.action
          };
        }
        return action;
      });
      
      // Save to storage
      await window.electronAPI.store.set('shortcutActions', updatedStoredActions);
      
      // Update local state with icons
      const updatedShortcutActions = shortcutActions.map(shortcutAction => {
        if (shortcutAction.id === id) {
          return {
            ...shortcutAction,
            title: updates.title.trim(),
            action: updates.action,
            icon: actionData?.icon || (Star as React.ComponentType<any>)
          };
        }
        return shortcutAction;
      });
      
      setShortcutActions(updatedShortcutActions);
      console.log('Updated shortcut action successfully');
    } catch (error) {
      console.error('Failed to update shortcut action:', error);
    }
  };

  const deleteShortcutAction = async (id: string): Promise<void> => {
    try {
      // Get current stored actions
      const currentStored = await window.electronAPI.store.get('shortcutActions') as StoredShortcutAction[] || [];
      
      // Remove from stored version
      const updatedStoredActions = currentStored.filter(action => action.id !== id);
      
      // Save to storage
      await window.electronAPI.store.set('shortcutActions', updatedStoredActions);
      
      // Update local state
      const updatedShortcutActions = shortcutActions.filter(shortcutAction => shortcutAction.id !== id);
      setShortcutActions(updatedShortcutActions);
      console.log('Deleted shortcut action successfully');
    } catch (error) {
      console.error('Failed to delete shortcut action:', error);
    }
  };

  const executeShortcutAction = (action: string): void => {
    console.log('Executing shortcut action:', action);
    console.log('Current state before action:', { 
      bookmarks: bookmarks.length, 
      shortcutActions: shortcutActions.length,
      isOpen 
    });
    
    // Trigger the same events as keyboard shortcuts
    switch (action) {
      case 'open-history':
        document.dispatchEvent(new CustomEvent('openSettingsDialog', { detail: { selectedTab: 1 } }));
        break;
      case 'add-tab':
        document.dispatchEvent(new CustomEvent('addTab'));
        break;
      case 'add-asterisk':
        document.dispatchEvent(new CustomEvent('addAsterisk'));
        break;
      case 'zen-mode-trigger':
        document.dispatchEvent(new CustomEvent('ZenModeOn'));
        break;
      case 'clipboard-quick':
        document.dispatchEvent(new CustomEvent('ClipboardTurnOn'));
        break;
      case 'close-tab':
        document.dispatchEvent(new CustomEvent('closeTab'));
        break;
      case 'pin-tab':
        document.dispatchEvent(new CustomEvent('pinTab'));
        break;
      case 'command-main':
        document.dispatchEvent(new CustomEvent('commandMain'));
        break;
      case 'toggle-sidebar':
        document.dispatchEvent(new CustomEvent('toggleSidebar'));
        break;
      case 'switch-tabs':
        document.dispatchEvent(new CustomEvent('switchTabs'));
        break;
      case 'print-trigger':
        document.dispatchEvent(new CustomEvent('printTrigger'));
        break;
      case 'reload-trigger':
        document.dispatchEvent(new CustomEvent('reloadTrigger'));
        break;
      case 'browser-ai':
        document.dispatchEvent(new CustomEvent('browserAI'));
        break;
      default:
        console.warn(`Unknown action: ${action}`);
    }
    
    console.log('About to call onClose()');
    onClose();
  };

  // Form handlers for bookmarks
  const handleAddBookmarkSubmit = (): void => {
    if (!newBookmarkTitle.trim()) {
      setNewBookmarkError('Title is required');
      return;
    }
    if (!newBookmarkUrl.trim()) {
      setNewBookmarkError('URL is required');
      return;
    }
    
    void addBookmark(newBookmarkTitle, newBookmarkUrl);
    
    setNewBookmarkTitle('');
    setNewBookmarkUrl('');
    setNewBookmarkError(null);
    setIsAddBookmarkOpen(false);
  };

  const handleEditStartBK = (bookmark: Bookmark) => {
    setEditingBookmarkId(bookmark.id);
    setEditBookmarkTitle(bookmark.title);
    setEditBookmarkUrl(bookmark.url);
    setEditBookmarkError(null);
  };

  const handleEditSubmitBK = () => {
    if (!editBookmarkTitle.trim()) {
      setEditBookmarkError('Title is required');
      return;
    }
    if (!editBookmarkUrl.trim()) {
      setEditBookmarkError('URL is required');
      return;
    }
    
    if (editingBookmarkId) {
      void editBookmark(editingBookmarkId, {
        title: editBookmarkTitle,
        url: editBookmarkUrl
      });
    }
    
    setEditingBookmarkId(null);
    setEditBookmarkError(null);
  };

  const handleEditCancel = () => {
    setEditingBookmarkId(null);
    setEditBookmarkError(null);
  };

  // Form handlers for shortcut actions
  const handleAddShortcutSubmit = (): void => {
    if (!newShortcutTitle.trim()) {
      setNewShortcutError('Title is required');
      return;
    }
    if (!newShortcutActionId.trim()) {
      setNewShortcutError('Action is required');
      return;
    }
    
    void addShortcutAction(newShortcutTitle, newShortcutActionId);
    
    setNewShortcutTitle('');
    setNewShortcutActionId('');
    setNewShortcutError(null);
    setIsAddShortcutOpen(false);
  };

  const handleEditStartSA = (shortcutAction: ShortcutAction) => {
    setEditingShortcutId(shortcutAction.id);
    setEditShortcutTitle(shortcutAction.title);
    setEditShortcutActionId(shortcutAction.action);
    setEditShortcutError(null);
  };

  const handleEditSubmitSA = () => {
    if (!editShortcutTitle.trim()) {
      setEditShortcutError('Title is required');
      return;
    }
    if (!editShortcutActionId.trim()) {
      setEditShortcutError('Action is required');
      return;
    }
    
    if (editingShortcutId) {
      void editShortcutAction(editingShortcutId, {
        title: editShortcutTitle,
        action: editShortcutActionId
      });
    }
    
    setEditingShortcutId(null);
    setEditShortcutError(null);
  };

  const handleEditCancelSA = () => {
    setEditingShortcutId(null);
    setEditShortcutError(null);
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        console.log('Initial data load');
        // Load bookmarks
        const savedBookmarks = await window.electronAPI.store.get('bookmarks') as Bookmark[];
        if (savedBookmarks && Array.isArray(savedBookmarks)) {
          setBookmarks(savedBookmarks);
          console.log('Loaded bookmarks:', savedBookmarks.length);
        }

        // Load shortcut actions
        const savedShortcutActions = await window.electronAPI.store.get('shortcutActions') as StoredShortcutAction[];
        if (savedShortcutActions && Array.isArray(savedShortcutActions)) {
          // Convert stored actions to full actions with icons
          const actionsWithIcons = savedShortcutActions.map(action => ({
            ...action,
            icon: (AVAILABLE_ACTIONS.find(a => a.id === action.action)?.icon || Star) as React.ComponentType<any>
          }));
          setShortcutActions(actionsWithIcons);
          console.log('Loaded shortcut actions:', actionsWithIcons.length);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    
    void loadData();
  }, []);

  // Reload data whenever the component becomes visible
  useEffect(() => {
    if (isOpen) {
      const reloadData = async (): Promise<void> => {
        try {
          console.log('QuickActions opened - syncing data');
          
          // Add a small delay to ensure any pending storage operations complete
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Load bookmarks
          const savedBookmarks = await window.electronAPI.store.get('bookmarks') as Bookmark[];
          if (savedBookmarks && Array.isArray(savedBookmarks)) {
            setBookmarks(prevBookmarks => {
              if (JSON.stringify(prevBookmarks) !== JSON.stringify(savedBookmarks)) {
                console.log('Bookmarks updated from storage:', savedBookmarks.length);
                return savedBookmarks;
              }
              return prevBookmarks;
            });
          }

          // Load shortcut actions
          const savedShortcutActions = await window.electronAPI.store.get('shortcutActions') as StoredShortcutAction[];
          if (savedShortcutActions && Array.isArray(savedShortcutActions)) {
            // Convert stored actions to full actions with icons
            const actionsWithIcons = savedShortcutActions.map(action => ({
              ...action,
              icon: (AVAILABLE_ACTIONS.find(a => a.id === action.action)?.icon || Star) as React.ComponentType<any>
            }));
            
            setShortcutActions(prevActions => {
              // Compare based on stored data (without icons) to avoid false positives
              const prevStoredFormat = prevActions.map(({ icon, ...rest }) => rest);
              if (JSON.stringify(prevStoredFormat) !== JSON.stringify(savedShortcutActions)) {
                console.log('Shortcut actions updated from storage:', actionsWithIcons.length);
                return actionsWithIcons;
              }
              return prevActions;
            });
          }
        } catch (error) {
          console.error('Failed to reload data when opened:', error);
        }
      };
      
      void reloadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Combine bookmarks and shortcut actions for display
  const allQuickActions = [
    ...bookmarks.map(bookmark => ({ ...bookmark, type: 'bookmark' as const })),
    ...shortcutActions.map(shortcut => ({ ...shortcut, type: 'shortcut' as const }))
  ];

  return (
    <div className="p-3">  
      <div className="max-h-[180px] overflow-y-auto sidebar-scrollbar py-1">
        <div className="grid grid-cols-3 gap-3">
          {/* Add bookmark button */}
          <Popover open={isAddBookmarkOpen} onOpenChange={setIsAddBookmarkOpen}>
            <PopoverTrigger asChild>
              <div 
                className="flex flex-col items-center justify-center p-2 pb-3 w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                onClick={() => setIsAddBookmarkOpen(true)}
              >
                <div className="w-8 h-4 flex items-center justify-center">
                  <Plus size={21} className="text-foreground" />
                </div>
                <span className="text-[9px] text-center mt-1">Website</span>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Add Website Quick Action</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="bookmarkTitle">Title</Label>
                  <Input 
                    id="bookmarkTitle" 
                    value={newBookmarkTitle}
                    onChange={(e) => setNewBookmarkTitle(e.target.value)}
                    placeholder="Enter title of quick action..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bookmarkUrl">URL</Label>
                  <Input 
                    id="bookmarkUrl" 
                    value={newBookmarkUrl}
                    onChange={(e) => setNewBookmarkUrl(e.target.value)}
                    placeholder="Enter URL of Quick Action..."
                  />
                </div>
                
                {newBookmarkError && (
                  <p className="text-xs text-red-500">{newBookmarkError}</p>
                )}
                
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setNewBookmarkTitle('');
                      setNewBookmarkUrl('');
                      setNewBookmarkError(null);
                      setIsAddBookmarkOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleAddBookmarkSubmit}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Add shortcut action button */}
          <Popover open={isAddShortcutOpen} onOpenChange={setIsAddShortcutOpen}>
            <PopoverTrigger asChild>
              <div 
                className="flex flex-col items-center justify-center p-2 pb-3 w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                onClick={() => setIsAddShortcutOpen(true)}
              >
                <div className="w-8 h-4 flex items-center justify-center">
                  <Command size={18} className="text-foreground" />
                </div>
                <span className="text-[9px] text-center mt-1">Action</span>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Add Action Quick Button</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="shortcutTitle">Title</Label>
                  <Input 
                    id="shortcutTitle" 
                    value={newShortcutTitle}
                    onChange={(e) => setNewShortcutTitle(e.target.value)}
                    placeholder="Enter title for action button..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="shortcutAction">Action</Label>
                  <Select value={newShortcutActionId} onValueChange={setNewShortcutActionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an action..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_ACTIONS.map(action => {
                        const IconComponent = action.icon;
                        return (
                          <SelectItem key={action.id} value={action.id}>
                            <div className="flex items-center gap-2">
                              <IconComponent size={16} />
                              {action.name}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                {newShortcutError && (
                  <p className="text-xs text-red-500">{newShortcutError}</p>
                )}
                
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setNewShortcutTitle('');
                      setNewShortcutActionId('');
                      setNewShortcutError(null);
                      setIsAddShortcutOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleAddShortcutSubmit}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Existing quick actions (bookmarks and shortcut actions) */}
          {allQuickActions.map((item) => (
            <div 
              key={item.id}
              className="group relative flex flex-col items-center"
            >
              <div className="w-full relative">
                <div 
                  className="flex flex-col items-center p-2 pb-3 w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    if (item.type === 'bookmark') {
                      openBookmark((item as any).url);
                    } else {
                      executeShortcutAction((item as any).action);
                    }
                  }}
                >
                  <div className="w-8 h-4 flex items-center justify-center rounded-md">
                    {item.type === 'bookmark' ? (
                      <img 
                        src={(item as any).icon} 
                        alt=""
                        className="w-4 h-4 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const globe = document.createElement('div');
                            globe.innerHTML = '<svg class="w-6 h-6 text-foreground" viewBox="0 0 256 256"><path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm12-88a12,12,0,1,1-12-12A12,12,0,0,1,140,128Z"/></svg>';
                            const globeIcon = globe.firstChild;
                            if (globeIcon) {
                              parent.appendChild(globeIcon);
                            }
                          }
                        }}
                      />
                    ) : (
                      (item as any).icon && React.createElement((item as any).icon, { size: 16, className: "text-foreground" })
                    )}
                  </div>
                  <span className="truncate text-[11px] w-full text-center mt-1">{item.title}</span>
                </div>
                
                {/* Action buttons */}
                <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 flex justify-center gap-1 translate-y-1/2">
                  {item.type === 'bookmark' ? (
                    <Popover 
                      open={editingBookmarkId === item.id} 
                      onOpenChange={(open) => {
                        if (open) {
                          handleEditStartBK(item as Bookmark);
                        } else {
                          handleEditCancel();
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button 
                          className="p-0.5 rounded-md bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 shadow-sm"
                          title="Edit bookmark"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PencilSimple size={15} className="text-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium">Edit Bookmark</h3>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`edit-title-${item.id}`}>Title</Label>
                            <Input 
                              id={`edit-title-${item.id}`}
                              value={editBookmarkTitle}
                              onChange={(e) => setEditBookmarkTitle(e.target.value)}
                              placeholder="Bookmark Title"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`edit-url-${item.id}`}>URL</Label>
                            <Input 
                              id={`edit-url-${item.id}`}
                              value={editBookmarkUrl}
                              onChange={(e) => setEditBookmarkUrl(e.target.value)}
                              placeholder="https://example.com"
                            />
                          </div>
                          
                          {editBookmarkError && (
                            <p className="text-xs text-red-500">{editBookmarkError}</p>
                          )}
                          
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={handleEditCancel}
                            >
                              Cancel
                            </Button>
                            <Button 
                              size="sm"
                              onClick={handleEditSubmitBK}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Popover 
                      open={editingShortcutId === item.id} 
                      onOpenChange={(open) => {
                        if (open) {
                          handleEditStartSA(item as ShortcutAction);
                        } else {
                          handleEditCancelSA();
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button 
                          className="p-0.5 rounded-md bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 shadow-sm"
                          title="Edit action"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PencilSimple size={15} className="text-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium">Edit Action</h3>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`edit-title-${item.id}`}>Title</Label>
                            <Input 
                              id={`edit-title-${item.id}`}
                              value={editShortcutTitle}
                              onChange={(e) => setEditShortcutTitle(e.target.value)}
                              placeholder="Action Title"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`edit-action-${item.id}`}>Action</Label>
                            <Select value={editShortcutActionId} onValueChange={setEditShortcutActionId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select an action..." />
                              </SelectTrigger>
                              <SelectContent>
                                {AVAILABLE_ACTIONS.map(action => {
                                  const IconComponent = action.icon;
                                  return (
                                    <SelectItem key={action.id} value={action.id}>
                                      <div className="flex items-center gap-2">
                                        <IconComponent size={16} />
                                        {action.name}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {editShortcutError && (
                            <p className="text-xs text-red-500">{editShortcutError}</p>
                          )}
                          
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={handleEditCancelSA}
                            >
                              Cancel
                            </Button>
                            <Button 
                              size="sm"
                              onClick={handleEditSubmitSA}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  
                  <button 
                    className="p-0.5 rounded-md bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.type === 'bookmark') {
                        void deleteBookmark(item.id);
                      } else {
                        void deleteShortcutAction(item.id);
                      }
                    }}
                    title={`Delete ${item.type}`}
                  >
                    <Trash size={15} className="text-foreground" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;