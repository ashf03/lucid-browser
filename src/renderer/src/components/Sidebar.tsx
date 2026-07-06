import React, { useEffect, useRef, useState } from 'react';
import type { Tab } from '../types/types';
import { Command, DeviceRotate, SquaresFour, Trash, PencilSimple, CaretUpDown, Cube, Camera, Speedometer, Metronome, Equalizer, Archive, BoxArrowDown, Bell, PaintBrushBroad, Pen, Code, Asterisk, FolderOpen, Folder, Plus, ClipboardText, Quotes, Folders, DownloadSimple, PictureInPicture } from '@phosphor-icons/react';
import { Globe } from '@phosphor-icons/react';
import CommandMain from './Command';
import { useCommand } from './parts/CommandContext';
import { Separator } from '../ui/separator';
import { useChat } from '../ai/ChatContext';
import MemoryUsage, { MemoryData } from '../lib/mem';
import { Dialog, DialogContent, DialogTrigger } from '../ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { GripVertical, Pin } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import Clipboard from './parts/Clipboard';
import { AnimatePresence, motion } from 'framer-motion';
import { titleStore } from '../lib/titleStore';
import DraggableDialog from './parts/DraggableDialog';
import { TabGroup } from '../types/CommandmainTypes';
import QuickActions from './parts/QuickActions';
import DownloadsDropdown from './parts/DownloadsDropdown';
import NotificationManager from './parts/NotificationManager';

export const DEFAULT_BLANK_URL = `data:text/html,
<html>
</html>`;

interface Download {
  id: string;
  filename: string;
  url: string;
  totalBytes: number;
  receivedBytes: number;
  state: string;
  startTime: string;
  endTime: string | null;
  savePath: string;
  canResume: boolean;
}

interface DownloadHandlers {
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onRedownload: (id: string) => void;
  onOpenLocation: (id: string) => void;
  onClearAll: () => void;
}

interface SidebarProps {
  tabs: Tab[];
  activeTabId: string;
  switchTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  addTab: (url?: string, options?: { type?: 'standard' | 'tool'; toolType?: 'Asterisk' }) => void; 
  reorderTabs?: (fromIndex: number, toIndex: number) => void;
  isOpen: boolean;
  isHovering?: boolean;
  updateTabTitle?: (tabId: string, newTitle: string) => void;
  updateTabState?: (
    tabId: string,
    updates: Partial<Omit<Tab, 'webviewRef'>> | ((tab: Tab) => Partial<Omit<Tab, 'webviewRef'>> | null)
  ) => void;
  downloads: Download[];
  downloadHandlers: DownloadHandlers;
    pipState?: {
    isOpen: boolean;
    tabId: string | null;
    url: string;
    title: string;
    currentUrl?: string;
  } | null;
  onTogglePictureInPicture?: (tabId: string) => void;
  onOpenQuoteDialog?: () => void;
}

interface DraggedItemState {
  type: 'tab' | 'group';
  id: string;
  groupId?: string;
}

interface SidebarItem {
  type: 'tab' | 'group';
  id: string;
  groupId?: string;
  order: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  tabs,
  activeTabId,
  switchTab,
  closeTab,
  addTab,
  reorderTabs,
  isOpen,
  updateTabTitle,
  updateTabState,
  isHovering = false,
  downloads,
  downloadHandlers,
  pipState,
  onTogglePictureInPicture,
  onOpenQuoteDialog
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const { setCommandOpen, isCommandOpen } = useCommand();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [draggedItem, setDraggedItem] = useState<DraggedItemState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'before' | 'after'; targetType: 'tab' | 'group'; targetId: string } | null>(null);

  // Enhanced drag and drop state
  const [draggedOver, setDraggedOver] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Tab Groups state
  const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  // Sidebar item ordering
  const [sidebarItemOrder, setSidebarItemOrder] = useState<SidebarItem[]>([]);

  const [downloadsDropdownOpen, setDownloadsDropdownOpen] = useState(false);

  // Add function to check if current page is blank
  const isBlankPage = () => {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (!activeTab || !activeTab.url) return true;
    return activeTab.url === DEFAULT_BLANK_URL || 
          activeTab.url === 'data:text/html,%0A<html>%0A</html>';
  };

const hasPictureInPicture = (tabId: string): boolean => {
  if (!pipState?.isOpen || pipState.tabId !== tabId) {
    return false;
  }
  
  // Only show the border if the PiP window is still on the same URL as the tab
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return false;
  
  // Compare the current PiP URL with the tab's URL
  const pipCurrentUrl = pipState.currentUrl || pipState.url;
  
  // Helper function to normalize URLs for comparison
  const normalizeUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      // Remove trailing slash and fragments for comparison
      return urlObj.origin + urlObj.pathname.replace(/\/$/, '') + urlObj.search;
    } catch {
      return url;
    }
  };
  
  return normalizeUrl(pipCurrentUrl) === normalizeUrl(tab.url);
};

// Add this helper function to check if PiP is available for a tab
const isPictureInPictureAvailable = (tab: Tab): boolean => {
  // Don't show PiP for tool tabs or blank pages
  return tab.type !== 'tool' && 
         tab.url !== DEFAULT_BLANK_URL && 
         !tab.url.startsWith('data:text/html');
};

  const getFaviconUrl = (url: any) => {
    if (!url || url === DEFAULT_BLANK_URL || url.startsWith('data:text/html')) {
      return null;
    }
    
    try {
      const hostname = new URL(url).hostname;
      // Use Google's favicon service with size parameter
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
    } catch (error) {
      console.error('Error parsing URL for favicon:', error);
      return null;
    }
  };

  // Generate sidebar items order based on current state
  const generateSidebarItemOrder = (): SidebarItem[] => {
    const items: SidebarItem[] = [];
    let order = 0;

    // Add existing ordered items first
    const existingOrderedItems = sidebarItemOrder.filter(item => {
      if (item.type === 'group') {
        return tabGroups.some(group => group.id === item.id);
      } else {
        return tabs.some(tab => tab.id === item.id && !tabGroups.some(group => group.tabIds.includes(tab.id)));
      }
    });

    // Add existing items in their current order
    existingOrderedItems.forEach(item => {
      items.push({ ...item, order: order++ });
    });

    // Add new groups that aren't in the order yet
    tabGroups.forEach(group => {
      if (!existingOrderedItems.some(item => item.type === 'group' && item.id === group.id)) {
        items.push({ type: 'group', id: group.id, order: order++ });
      }
    });

    // Add new ungrouped tabs that aren't in the order yet
    const ungroupedTabs = tabs.filter(tab => !tabGroups.some(group => group.tabIds.includes(tab.id)));
    ungroupedTabs.forEach(tab => {
      if (!existingOrderedItems.some(item => item.type === 'tab' && item.id === tab.id)) {
        items.push({ type: 'tab', id: tab.id, order: order++ });
      }
    });

    return items.sort((a, b) => a.order - b.order);
  };

  // Update sidebar item order
  const updateSidebarItemOrder = async (newOrder: SidebarItem[]): Promise<void> => {
    setSidebarItemOrder(newOrder);
    try {
      await window.electronAPI.store.set('sidebarItemOrder', newOrder);
    } catch (error) {
      console.error('Failed to save sidebar item order:', error);
    }
  };

  // Tab Groups functions
  const createGroup = async (name: string): Promise<void> => {
    const newGroup: TabGroup = {
      id: Date.now().toString(),
      name: name.trim(),
      tabIds: [],
      isOpen: true
    };
    
    const updatedGroups = [...tabGroups, newGroup];
    setTabGroups(updatedGroups);
    
    // Add to sidebar order
    const currentOrder = generateSidebarItemOrder();
    const newOrderItem: SidebarItem = {
      type: 'group',
      id: newGroup.id,
      order: currentOrder.length
    };
    await updateSidebarItemOrder([...currentOrder, newOrderItem]);
    
    try {
      await window.electronAPI.store.set('tabGroups', updatedGroups);
    } catch (error) {
      console.error('Failed to save tab groups:', error);
    }
  };

  const renameGroup = async (groupId: string, newName: string): Promise<void> => {
    const updatedGroups = tabGroups.map(group =>
      group.id === groupId ? { ...group, name: newName.trim() } : group
    );
    setTabGroups(updatedGroups);
    
    try {
      await window.electronAPI.store.set('tabGroups', updatedGroups);
    } catch (error) {
      console.error('Failed to save tab groups:', error);
    }
  };

const deleteGroup = async (groupId: string): Promise<void> => {
  // Find the group to be deleted
  const groupToDelete = tabGroups.find(group => group.id === groupId);
  
  if (groupToDelete) {
    // Close all tabs in the group
    groupToDelete.tabIds.forEach(tabId => {
      closeTab(tabId);
    });
  }
  
  // Remove the group from tabGroups
  const updatedGroups = tabGroups.filter(group => group.id !== groupId);
  setTabGroups(updatedGroups);
  
  // Remove from sidebar order
  const currentOrder = sidebarItemOrder.filter(item => !(item.type === 'group' && item.id === groupId));
  await updateSidebarItemOrder(currentOrder);
  
  try {
    await window.electronAPI.store.set('tabGroups', updatedGroups);
  } catch (error) {
    console.error('Failed to save tab groups:', error);
  }
};

  const addTabToGroup = async (tabId: string, groupId: string): Promise<void> => {
    const updatedGroups = tabGroups.map(group => {
      if (group.id === groupId) {
        return { ...group, tabIds: [...group.tabIds, tabId] };
      }
      // Remove from other groups
      return { ...group, tabIds: group.tabIds.filter(id => id !== tabId) };
    });
    setTabGroups(updatedGroups);
    
    // Remove tab from sidebar order since it's now in a group
    const currentOrder = sidebarItemOrder.filter(item => !(item.type === 'tab' && item.id === tabId));
    await updateSidebarItemOrder(currentOrder);
    
    try {
      await window.electronAPI.store.set('tabGroups', updatedGroups);
    } catch (error) {
      console.error('Failed to save tab groups:', error);
    }
  };

  const removeTabFromGroup = async (tabId: string): Promise<void> => {
    const updatedGroups = tabGroups.map(group => ({
      ...group,
      tabIds: group.tabIds.filter(id => id !== tabId)
    }));
    setTabGroups(updatedGroups);
    
    // Add tab back to sidebar order
    const currentOrder = generateSidebarItemOrder();
    const newOrderItem: SidebarItem = {
      type: 'tab',
      id: tabId,
      order: currentOrder.length
    };
    await updateSidebarItemOrder([...currentOrder, newOrderItem]);
    
    try {
      await window.electronAPI.store.set('tabGroups', updatedGroups);
    } catch (error) {
      console.error('Failed to save tab groups:', error);
    }
  };

  const toggleGroupOpen = async (groupId: string): Promise<void> => {
    const updatedGroups = tabGroups.map(group =>
      group.id === groupId ? { ...group, isOpen: !group.isOpen } : group
    );
    setTabGroups(updatedGroups);
    
    try {
      await window.electronAPI.store.set('tabGroups', updatedGroups);
    } catch (error) {
      console.error('Failed to save tab groups:', error);
    }
  };

  const getTabGroup = (tabId: string): TabGroup | null => {
    return tabGroups.find(group => group.tabIds.includes(tabId)) || null;
  };

  const getUngroupedTabs = (): Tab[] => {
    return tabs.filter(tab => !tabGroups.some(group => group.tabIds.includes(tab.id)));
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        // Load tab groups
        const savedGroups = await window.electronAPI.store.get('tabGroups') as TabGroup[];
        if (savedGroups && Array.isArray(savedGroups)) {
          setTabGroups(savedGroups);
        }

        // Load sidebar item order
        const savedOrder = await window.electronAPI.store.get('sidebarItemOrder') as SidebarItem[];
        if (savedOrder && Array.isArray(savedOrder)) {
          setSidebarItemOrder(savedOrder);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    
    void loadData();
  }, []);

  // Update sidebar order when tabs or groups change
  useEffect(() => {
    const newOrder = generateSidebarItemOrder();
    if (JSON.stringify(newOrder) !== JSON.stringify(sidebarItemOrder)) {
      setSidebarItemOrder(newOrder);
    }
  }, [tabs, tabGroups]);

  // Track temporary AI titles and URLs
  const tempAITitles = useRef(new Map<string, string>());
  const previousUrls = useRef(new Map<string, string>());
  
  // Track manually edited titles (this should be persistent)
  const manuallySetTitles = useRef(new Set<string>([]));  // Initialize with empty array
  
  const { generateWebsiteTitle } = useChat(activeTabId);

  useEffect(() => {
    const loadManualTitles = async (): Promise<void> => {
      try {
        const savedTitles = await window.electronAPI.store.get('manuallySetTitles') as string[];
        if (savedTitles && Array.isArray(savedTitles)) {
          titleStore.manuallySetTitles = new Set<string>(savedTitles);
        }
      } catch (error) {
        console.error('Failed to load manually set titles:', error);
      }
    };
    void loadManualTitles();
  }, []);

  const getDisplayTitle = (tab: Tab): string => {
    return titleStore.getDisplayTitle(tab);
  };

  // Handle manual title edit
  const handleEditStart = (e: React.MouseEvent, tab: Tab): void => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditingTitle(getDisplayTitle(tab));
  };

  const handleEditSubmit = async (tabId: string): Promise<void> => {
    if (updateTabTitle && editingTitle.trim()) {
      // Remove any temporary AI title
      titleStore.tempAITitles.delete(tabId);
      
      // Mark as manually set and update
      titleStore.manuallySetTitles.add(tabId);
      updateTabTitle(tabId, editingTitle.trim());
      
      // Save to storage
      try {
        await window.electronAPI.store.set(
          'manuallySetTitles', 
          Array.from(titleStore.manuallySetTitles)
        );
      } catch (error) {
        console.error('Failed to save manually set titles:', error);
      }
    }
    setEditingTabId(null);
  };

const toggleDownloads = () => {
  if (downloadsDropdownOpen) {
    // If downloads is open, just close it
    setDownloadsDropdownOpen(false);
  } else {
    // If downloads is closed, open it and close others
    setDownloadsDropdownOpen(true);
    setIsBookmarkOpen(false);
    setIsClipboardOpen(false);
  }
};

  // Enhanced drag handlers with better UX
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: { type: 'tab' | 'group'; id: string; groupId?: string }): void => {
    // Set drag data
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
    
    // Create custom drag image for better feedback
    const dragElement = e.currentTarget.cloneNode(true) as HTMLElement;
    dragElement.style.width = e.currentTarget.offsetWidth + 'px';
    dragElement.style.transform = 'rotate(2deg)';
    dragElement.style.opacity = '0.8';
    dragElement.style.background = 'rgba(59, 130, 246, 0.1)';
    dragElement.style.border = '2px solid rgba(59, 130, 246, 0.3)';
    dragElement.style.borderRadius = '8px';
    document.body.appendChild(dragElement);
    e.dataTransfer.setDragImage(dragElement, e.currentTarget.offsetWidth / 2, 20);
    setTimeout(() => document.body.removeChild(dragElement), 0);
    
    setDraggedItem(item);
    setIsDragging(true);
    
    // Add visual feedback to the dragged element
    e.currentTarget.style.opacity = '0.5';
    e.currentTarget.style.transform = 'scale(0.95)';
  };
  
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>): void => {
    // Reset visual state
    e.currentTarget.style.opacity = '';
    e.currentTarget.style.transform = '';
    
    setDraggedItem(null);
    setDropTarget(null);
    setDraggedOver(null);
    setIsDragging(false);
  };

  // Improved drag over with better feedback
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number, targetType: 'tab' | 'group', targetId: string): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (!draggedItem) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';

    setDropTarget({ index, position, targetType, targetId });
    setDraggedOver(targetId);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    setDropTarget(null);
    setDraggedOver(null);
  };

  // Better drop zone visual feedback
  const getDropZoneClasses = (itemId: string, itemType: 'tab' | 'group') => {
    if (!isDragging) return '';
    
    let classes = 'transition-all duration-200 ';
    
    if (draggedOver === itemId) {
      classes += 'ring-2 ring-primary ring-opacity-50 ';
    }
    
    // Show valid drop zones
    if (draggedItem?.type === 'tab' && itemType === 'group') {
      classes += 'bg-primary/10 ';
    }
    
    return classes;
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, index: number, targetType: 'tab' | 'group', targetId: string): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || !dropTarget) return;
  
    try {
      const currentOrder = generateSidebarItemOrder();
      
      if (draggedItem.type === 'tab' && targetType === 'group') {
        // Tab being dropped on a group - add to group
        await addTabToGroup(draggedItem.id, targetId);
      } else if (draggedItem.type === 'tab' && draggedItem.groupId && !targetType) {
        // Tab being moved out of group
        await removeTabFromGroup(draggedItem.id);
        
        // Then handle reordering in the main list
        const newOrder = [...currentOrder];
        const sourceIndex = newOrder.findIndex(item => item.type === 'tab' && item.id === draggedItem.id);
        let targetIndex = index;
        
        if (dropTarget.position === 'after') {
          targetIndex += 1;
        }
        
        if (sourceIndex !== -1) {
          const [movedItem] = newOrder.splice(sourceIndex, 1);
          newOrder.splice(targetIndex, 0, movedItem);
          
          // Update order values
          newOrder.forEach((item, idx) => {
            item.order = idx;
          });
          
          await updateSidebarItemOrder(newOrder);
        }
      } else {
        // Reordering in the main sidebar list
        const newOrder = [...currentOrder];
        const sourceIndex = newOrder.findIndex(item => 
          item.type === draggedItem.type && item.id === draggedItem.id
        );
        let targetIndex = index;
        
        if (dropTarget.position === 'after') {
          targetIndex += 1;
        }
        
        if (sourceIndex !== -1 && sourceIndex !== targetIndex) {
          const [movedItem] = newOrder.splice(sourceIndex, 1);
          newOrder.splice(targetIndex, 0, movedItem);
          
          // Update order values
          newOrder.forEach((item, idx) => {
            item.order = idx;
          });
          
          await updateSidebarItemOrder(newOrder);
        }
      }
    } catch (error) {
      console.error('Error processing drop:', error);
    }
  
    setDropTarget(null);
    setDraggedItem(null);
    setDraggedOver(null);
  };

  useEffect(() => {
    const handleUrlChange = async (tab: Tab) => {
      // Skip if title was manually set
      if (titleStore.manuallySetTitles.has(tab.id)) {
        return;
      }
  
      if (!tab.url || tab.url === DEFAULT_BLANK_URL || tab.url.startsWith('data:text/html')) {
        console.log('Skipping title generation for blank URL:', tab.url);
        return;
      }
  
      // Skip if URL hasn't changed
      const previousUrl = previousUrls.current.get(tab.id);
      if (previousUrl === tab.url) {
        return;
      }
  
      // Update previous URL
      previousUrls.current.set(tab.id, tab.url);
  
      try {
        const newTitle = await generateWebsiteTitle(tab.url);
        // Only update if the URL is still the same (hasn't changed during generation)
        if (previousUrls.current.get(tab.id) === tab.url) {
          // IMPORTANT: Store in shared titleStore instead of local ref
          titleStore.tempAITitles.set(tab.id, newTitle);
          // Force re-render
          forceUpdate();
        }
      } catch (error) {
        console.error('Failed to generate tab title:', error);
      }
    };
  
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (activeTab) {
      void handleUrlChange(activeTab);
    }
  }, [activeTabId, generateWebsiteTitle, tabs]);

  // Cleanup effect for closed tabs
  useEffect(() => {
    const currentTabIds = new Set(tabs.map(tab => tab.id));
    
    // Clean up temporary AI titles
    for (const [tabId] of tempAITitles.current) {
      if (!currentTabIds.has(tabId)) {
        tempAITitles.current.delete(tabId);
      }
    }
    
    // Clean up previous URLs
    for (const [tabId] of previousUrls.current) {
      if (!currentTabIds.has(tabId)) {
        previousUrls.current.delete(tabId);
      }
    }

    // Clean up tab groups
    const updatedGroups = tabGroups.map(group => ({
      ...group,
      tabIds: group.tabIds.filter(tabId => currentTabIds.has(tabId))
    }));
    
    if (JSON.stringify(updatedGroups) !== JSON.stringify(tabGroups)) {
      setTabGroups(updatedGroups);
      // Save to storage
      window.electronAPI.store.set('tabGroups', updatedGroups).catch(console.error);
    }
  }, [tabs, tabGroups]);

  useEffect(() => {
    const handleQueryTitle = (event: CustomEvent) => {
      const { tabId, title, isQueryTitle } = event.detail;
      if (isQueryTitle && !titleStore.manuallySetTitles.has(tabId)) {
        // IMPORTANT: Store in shared titleStore
        titleStore.tempAITitles.set(tabId, title);
        forceUpdate();
      }
    };
  
    window.addEventListener('updateQueryTitle', handleQueryTitle as EventListener);
    return () => {
      window.removeEventListener('updateQueryTitle', handleQueryTitle as EventListener);
    };
  }, []);

  // Force re-render when temporary titles change
  const [, setForceUpdate] = useState({});
  const forceUpdate = () => setForceUpdate({});

  const [memoryData, setMemoryData] = useState<MemoryData[]>([]);
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchMemoryUsage = async () => {
      try {
        const data = await window.electronAPI.ipcRenderer.invoke('get-memory-usage');
        setMemoryData(prev => {
          const newData = [...prev, { ...data, timestamp: Date.now() }];
          // Keep last 60 data points (1 minute of data)
          return newData.slice(-60);
        });
      } catch (error) {
        console.error('Failed to fetch memory usage:', error);
        setIsRunning(false);
      }
    };

    if (isRunning) {
      fetchMemoryUsage();
      intervalId = setInterval(fetchMemoryUsage, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning]);

  const formatBytes = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const getCurrentMemoryUsage = () => {
    if (memoryData.length === 0) return null;
    return memoryData[memoryData.length - 1];
  };

  const currentMemory = getCurrentMemoryUsage();

  const [isBookmarkOpen, setIsBookmarkOpen] = useState(false);
  const [isClipboardOpen, setIsClipboardOpen] = useState(false);
  
const toggleBookmark = () => {
  if (isBookmarkOpen) {
    // If bookmark is open, just close it
    setIsBookmarkOpen(false);
  } else {
    // If bookmark is closed, open it and close others
    setIsBookmarkOpen(true);
    setIsClipboardOpen(false);
  }
};

const toggleClipboard = () => {
  if (isClipboardOpen) {
    // If clipboard is open, just close it
    setIsClipboardOpen(false);
  } else {
    // If clipboard is closed, open it and close others
    setIsClipboardOpen(true);
    setIsBookmarkOpen(false);
  }
};

// Add or enhance this useEffect in the Sidebar component

useEffect(() => {
  const currentTabIds = new Set(tabs.map(tab => tab.id));
  
  // Clean up tempAITitles for closed tabs
  for (const [tabId] of tempAITitles.current) {
    if (!currentTabIds.has(tabId)) {
      tempAITitles.current.delete(tabId);
    }
  }
  
  // Clean up previousUrls for closed tabs
  for (const [tabId] of previousUrls.current) {
    if (!currentTabIds.has(tabId)) {
      previousUrls.current.delete(tabId);
    }
  }
  
  // Note: manuallySetTitles is persisted to storage and should be cleaned up
  // by the main process's cleanup function, but we also update the in-memory state
  for (const tabId of manuallySetTitles.current) {
    if (!currentTabIds.has(tabId)) {
      manuallySetTitles.current.delete(tabId);
    }
  }
  
  // If we're editing a title for a tab that was closed, reset the editing state
  if (editingTabId && !currentTabIds.has(editingTabId)) {
    setEditingTabId(null);
    setEditingTitle('');
  }
  
}, [tabs, editingTabId]);

const [clipboardPopoverOpen, setClipboardPopoverOpen] = useState(false);

useEffect(() => {
  const handleClipboardTurnOn = () => {
    console.log("ClipboardTurnOn event received, current clipboard state:", isClipboardOpen);
    if (isClipboardOpen) {
      setIsClipboardOpen(false);
    } else {
      setIsClipboardOpen(true);
      setIsBookmarkOpen(false);
    }
    console.log("Toggled clipboard to:", !isClipboardOpen);
  };

  const handleCloseTab = () => {
    closeTab(activeTabId);
  };

  const handleToggleCommand = () => {
    setCommandOpen(!isCommandOpen);
  };

  const handleSwitchTabs = () => {
    if (!tabs || tabs.length <= 1) return;
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    switchTab(tabs[nextIndex].id);
  };

  // ADD THIS NEW HANDLER:
  const handlePinTab = () => {
    console.log("Pin tab event received - creating new tab group automatically");
    const defaultName = `Group ${tabGroups.length + 1}`;
    void createGroup(defaultName);
  };
  
  document.addEventListener('ClipboardTurnOn', handleClipboardTurnOn);
  document.addEventListener('closeTab', handleCloseTab);
  document.addEventListener('commandMain', handleToggleCommand);
  document.addEventListener('switchTabs', handleSwitchTabs);
  document.addEventListener('pinTab', handlePinTab); // ADD THIS LINE
  
  return () => {
    document.removeEventListener('ClipboardTurnOn', handleClipboardTurnOn);
    document.removeEventListener('closeTab', handleCloseTab);
    document.removeEventListener('commandMain', handleToggleCommand);
    document.removeEventListener('switchTabs', handleSwitchTabs);
    document.removeEventListener('pinTab', handlePinTab); // ADD THIS LINE
  };
}, [clipboardPopoverOpen, closeTab, activeTabId, isCommandOpen, setCommandOpen, tabGroups.length]);

  // Group form handlers
  const handleAddGroupSubmit = (): void => {
    if (!newGroupName.trim()) return;
    
    void createGroup(newGroupName);
    setNewGroupName('');
    setIsAddGroupOpen(false);
  };

  const handleEditGroupStart = (group: TabGroup): void => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  };

  const handleEditGroupSubmit = (groupId: string): void => {
    if (editingGroupName.trim()) {
      void renameGroup(groupId, editingGroupName);
    }
    setEditingGroupId(null);
  };

const renderTabItem = (tab: Tab, index: number, groupId?: string) => {
  return (
    <div key={tab.id} className="relative">
      {/* Enhanced drop indicator */}
      {dropTarget?.index === index && dropTarget.position === 'before' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-full -translate-y-0.5 z-10">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 -translate-x-1.5 bg-primary rounded-full shadow-lg" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 translate-x-1.5 bg-primary rounded-full shadow-lg" />
        </div>
      )}
      
      <div
        className={`
          group relative flex items-center gap-2 px-3 py-2 rounded-[8px]
          transition-all duration-200 min-h-[40px]
          ${tab.id === activeTabId 
            ? 'bg-zinc-300 dark:bg-zinc-800 text-secondary-foreground' 
            : 'hover:bg-zinc-300 dark:hover:bg-zinc-800 text-foreground'}
          ${draggedItem?.id === tab.id ? 'opacity-50 scale-95' : ''}
          ${tab.isLoading ? 'animate-[pulse_10s_ease-in-out_infinite]' : ''}
          ${getDropZoneClasses(tab.id, 'tab')}
          ${hasPictureInPicture(tab.id) ? 'border-l-2 border-black dark:border-white' : ''}
        `}
        onDragOver={(e) => handleDragOver(e, index, 'tab', tab.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, index, 'tab', tab.id)}
        onClick={() => switchTab(tab.id)}
      >
        {/* Dedicated drag handle */}
        <div
          draggable={editingTabId !== tab.id}
          onDragStart={(e) => handleDragStart(e, { type: 'tab', id: tab.id, groupId })}
          onDragEnd={handleDragEnd}
          className="opacity-0 group-hover:opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing p-1 -ml-1 transition-opacity duration-200"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3 text-foreground" />
        </div>

        {/* Group indicator/menu - only show for grouped tabs */}
        {groupId && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="text-foreground rounded-[5px] p-1 opacity-0 group-hover:opacity-100"
              >
                <CaretUpDown className="size-[16px] text-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => removeTabFromGroup(tab.id)}
                >
                  Remove from group
                </Button>
                {tabGroups.map(group => (
                  <Button
                    key={group.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => addTabToGroup(tab.id, group.id)}
                  >
                    Move to "{group.name}"
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <div className="flex items-center justify-center rounded-full">
          {tab.type === 'tool' ? (
            // Use the tool-specific icon if available
            tab.icon ? (
              React.createElement(tab.icon, { className: "w-4 h-4 text-foreground" })
            ) : (
              <Cube className="w-4 h-4 text-foreground" />
            )
          ) : tab.url === DEFAULT_BLANK_URL || tab.url.startsWith('data:text/html') ? (
            <Cube className="w-4 h-4 text-foreground" />
          ) : (
            <div className="w-4 h-4 flex items-center justify-center">
              <img
                src={getFaviconUrl(tab.url) || ""}
                alt=""
                className="w-4 h-4 object-contain"
                onError={(e) => {
                  // Try alternative favicon service if Google's fails
                  try {
                    if (tab.url) {
                      const hostname = new URL(tab.url).hostname;
                      e.currentTarget.onerror = null; // Prevent infinite error loop
                      e.currentTarget.src = `https://icon.horse/icon/${encodeURIComponent(hostname)}`;
                      
                      // If that also fails, show the Globe icon
                      e.currentTarget.onerror = () => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const globe = document.createElement('div');
                          globe.innerHTML = '<svg class="w-4 h-4 text-foreground" viewBox="0 0 256 256"><path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm12-88a12,12,0,1,1-12-12A12,12,0,0,1,140,128Z"/></svg>';
                          const globeIcon = globe.firstChild;
                          if (globeIcon) {
                            parent.appendChild(globeIcon);
                          }
                        }
                      };
                    }
                  } catch (err) {
                    console.error('Error in favicon fallback:', err);
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      const globe = document.createElement('div');
                      globe.innerHTML = '<svg class="w-4 h-4 text-foreground" viewBox="0 0 256 256"><path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm12-88a12,12,0,1,1-12-12A12,12,0,0,1,140,128Z"/></svg>';
                      const globeIcon = globe.firstChild;
                      if (globeIcon) {
                        parent.appendChild(globeIcon);
                      }
                    }
                  }
                }}
              />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          {editingTabId === tab.id ? (
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleEditSubmit(tab.id);
                } else if (e.key === 'Escape') {
                  setEditingTabId(null);
                }
              }}
              onBlur={() => void handleEditSubmit(tab.id)}
              className="w-full bg-transparent text-sm border-none outline-none px-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex flex-col">
              <span className="truncate w-[150px] text-sm block">
                {getDisplayTitle(tab)}
              </span>
              {tab.url && (
                <span className="truncate w-[150px] text-xs text-muted-foreground block">
                  {new URL(tab.url).hostname}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center group-hover:bg-zinc-300 dark:group-hover:bg-zinc-800 flex-shrink-0">
          {/* Picture-in-Picture button - normal hover behavior like other buttons */}
          {isPictureInPictureAvailable(tab) && onTogglePictureInPicture && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePictureInPicture(tab.id);
              }}
              className={`opacity-0 group-hover:opacity-100 rounded-[5px] p-1 flex-shrink-0 transition-colors ${
                hasPictureInPicture(tab.id) 
                  ? 'text-muted-foreground' 
                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-foreground'
              }`}
              title={hasPictureInPicture(tab.id) ? "Close Picture-in-Picture" : "Open in Picture-in-Picture"}
            >
              <PictureInPicture className="size-[16px]" />
            </button>
          )}
          
          <button
            onClick={(e): void => handleEditStart(e, tab)}
            className="opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-[5px] p-1 flex-shrink-0 transition-colors"
          >
            <PencilSimple className="size-[16px] text-foreground" />
          </button>
          
          {tabs.length > 1 && (
            <button
              className="opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-[5px] p-1 flex-shrink-0 transition-colors"
              onClick={(e): void => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <Trash className='size-[16px] text-foreground' />
            </button>
          )}
        </div>
      </div>

      {/* Enhanced bottom drop indicator */}
      {dropTarget?.index === index && dropTarget.position === 'after' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full translate-y-0.5 z-10">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 -translate-x-1.5 bg-primary rounded-full shadow-lg" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 translate-x-1.5 bg-primary rounded-full shadow-lg" />
        </div>
      )}
    </div>
  );
};

  const renderGroupItem = (group: TabGroup, index: number) => {
    const groupTabs = tabs.filter(tab => group.tabIds.includes(tab.id));
    
    return (
      <div key={group.id} className="relative">
        {/* Enhanced drop indicator */}
        {dropTarget?.index === index && dropTarget.position === 'before' && dropTarget.targetType === 'group' && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-full -translate-y-0.5 z-10">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 -translate-x-1.5 bg-primary rounded-full shadow-lg" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 translate-x-1.5 bg-primary rounded-full shadow-lg" />
          </div>
        )}
        
        <Collapsible 
          open={group.isOpen}
          onOpenChange={() => toggleGroupOpen(group.id)}
          className={`
            p-1 rounded-lg w-full transition-all duration-200 
            bg-zinc-300/40 dark:bg-zinc-900/40 
            hover:bg-zinc-300/60 dark:hover:bg-zinc-900/60
            ${getDropZoneClasses(group.id, 'group')}
          `}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggedItem && draggedItem.type === 'tab' && draggedItem.groupId !== group.id) {
              e.currentTarget.classList.add('bg-primary/20');
              setDraggedOver(group.id);
            } else if (draggedItem && draggedItem.type === 'group' && draggedItem.id !== group.id) {
              handleDragOver(e, index, 'group', group.id);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('bg-primary/20');
            setDraggedOver(null);
            if (draggedItem?.type === 'group') {
              setDropTarget(null);
            }
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('bg-primary/20');
            if (!draggedItem) return;

            if (draggedItem.type === 'tab' && draggedItem.groupId !== group.id) {
              await addTabToGroup(draggedItem.id, group.id);
            } else if (draggedItem.type === 'group' && draggedItem.id !== group.id) {
              await handleDrop(e, index, 'group', group.id);
            }
            setDraggedItem(null);
            setDraggedOver(null);
          }}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm rounded-lg group">
            {/* Drag handle for groups */}
            <div className="flex items-center gap-2">
              <div
                draggable={editingGroupId !== group.id}
                onDragStart={(e) => handleDragStart(e, { type: 'group', id: group.id })}
                onDragEnd={handleDragEnd}
                className="opacity-0 group-hover:opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing p-1 transition-opacity duration-200"
                title="Drag to reorder group"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="size-3 text-foreground" />
              </div>
              
              <div className="flex items-center gap-2">
                {group.isOpen ? (
                  <FolderOpen className="size-[16px] text-foreground" />
                ) : (
                  <Folder className="size-[16px] text-foreground" />
                )}
                {editingGroupId === group.id ? (
                  <input
                    type="text"
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleEditGroupSubmit(group.id);
                      } else if (e.key === 'Escape') {
                        setEditingGroupId(null);
                      }
                    }}
                    onBlur={() => handleEditGroupSubmit(group.id)}
                    className="bg-transparent border-none outline-none text-sm min-w-0"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span>{group.name}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">({groupTabs.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditGroupStart(group);
                }}
                className="opacity-60 hover:opacity-100 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <PencilSimple className="size-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteGroup(group.id);
                }}
                className="opacity-60 hover:opacity-100 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <Trash className="size-3" />
              </button>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className='flex flex-col gap-2'>
            {groupTabs.map((tab, tabIndex) => renderTabItem(tab, tabIndex, group.id))}
            {groupTabs.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg">
                Drop tabs here to add to group
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Enhanced bottom drop indicator */}
        {dropTarget?.index === index && dropTarget.position === 'after' && dropTarget.targetType === 'group' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full translate-y-0.5 z-10">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 -translate-x-1.5 bg-primary rounded-full shadow-lg" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 translate-x-1.5 bg-primary rounded-full shadow-lg" />
          </div>
        )}
      </div>
    );
  };

  // Get ordered sidebar items for rendering
  const getOrderedSidebarItems = () => {
    const currentOrder = generateSidebarItemOrder();
    const orderedItems: (
      | { type: 'group'; group: TabGroup; index: number }
      | { type: 'tab'; tab: Tab; index: number }
    )[] = [];

    currentOrder.forEach((orderItem, index) => {
      if (orderItem.type === 'group') {
        const group = tabGroups.find(g => g.id === orderItem.id);
        if (group) {
          orderedItems.push({ type: 'group', group, index });
        }
      } else {
        const tab = tabs.find(t => t.id === orderItem.id && !tabGroups.some(group => group.tabIds.includes(t.id)));
        if (tab) {
          orderedItems.push({ type: 'tab', tab, index });
        }
      }
    });

    return orderedItems;
  };

  return (
    <div 
      className={`
        flex flex-col h-full 
        transition-all duration-300 ease-in-out
        ${isOpen || isHovering ? 'opacity-100' : 'opacity-0'}
        ${isHovering ? 'shadow-xl border-zinc-200 dark:border-zinc-700 bg-background/65 backdrop-blur-sm' : ''}
        overflow-hidden
      `}
      data-active={activeTabId === tabs.find(tab => tab.id === activeTabId)?.id}
      data-tab-id={activeTabId}
    >
    <div className={`p-2 flex flex-col gap-3 ${!isOpen && !isHovering ? 'hidden' : ''} flex-shrink-0`}>
      <CommandMain activeTabId={activeTabId} tabs={tabs} switchTab={switchTab} tabId={activeTabId} tabGroups={tabGroups} />

<div className="flex flex-row">
  <div className="w-full flex flex-row">
    <button
      className="flex-1 cursor-pointer flex-row flex justify-center text-sm items-center p-3 rounded-l-[10px] text-foreground dark:bg-zinc-900 dark:hover:bg-zinc-800 bg-zinc-50 hover:bg-zinc-100 transition-colors duration-200 ease-in-out"
      onClick={() => addTab(DEFAULT_BLANK_URL, { type: 'tool', toolType: 'Asterisk' })}
    >
      <div className='flex flex-row justify-center items-center'>
        <Asterisk className="size-[16px] text-foreground" />
        &nbsp;New Asterisk
      </div>
    </button>
    
    <button
      onClick={isBlankPage() ? undefined : onOpenQuoteDialog}
      disabled={isBlankPage()}
      className={`px-3 py-3 flex-row flex justify-center text-sm items-center rounded-r-[10px] text-foreground dark:bg-zinc-900 dark:hover:bg-zinc-800 bg-zinc-50 hover:bg-zinc-100 transition-colors duration-200 ease-in-out ${
        isBlankPage() ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
      title={isBlankPage() ? "No page to capture" : "Open current page in popup"}
    >
      <Camera className={`size-[18px] ${isBlankPage() ? 'text-foreground/40' : 'text-foreground'}`} />
    </button>
  </div>
</div>

  <div className="w-full flex pb-1 mt-3 px-1 flex-row justify-between items-center border-t border-zinc-300 dark:border-zinc-700 pt-4">
          <button
            onClick={(): void => addTab()}
className="cursor-pointer flex-row gap-2 flex justify-center text-[14px] items-center text-foreground/70 rounded-xl"
          >
            <Plus className="size-[18px] text-foreground/70" />&nbsp;New Tab
          </button>
        <Popover open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
          <PopoverTrigger asChild>
            <button className="flex-row flex justify-center text-sm items-center rounded-xl text-foreground/70">
              <SquaresFour className="size-[20px]" />
              </button>
          </PopoverTrigger>
<PopoverContent className="w-[200px] p-3" side="bottom" align="end">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Create Tab Group</h3>
              <Input
                placeholder="Enter Group Name..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddGroupSubmit();
                  }
                }}
              />
              <div className="flex justify-start space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setNewGroupName('');
                    setIsAddGroupOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAddGroupSubmit}>
                  Create
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        </div>
      </div>


    <div className={`
      flex flex-col gap-2 p-2 
      overflow-y-auto 
      ${!isOpen && !isHovering ? 'hidden' : ''}
      sidebar-scrollbar
      ${isBookmarkOpen 
        ? 'h-[calc(95vh-400px)]' 
        : 'h-[calc(95vh-200px)]'} 
      pb-4
      transition-all duration-300
    `}>
      <div className="flex flex-col gap-2">
        {getOrderedSidebarItems().map((item) => {
          if (item.type === 'group') {
            return renderGroupItem(item.group, item.index);
          } else {
            return renderTabItem(item.tab, item.index);
          }
        })}
      </div>
    </div>

<div className={`w-full flex flex-row absolute bottom-0 justify-center items-center ${!isOpen && !isHovering ? 'hidden' : ''} flex-shrink-0`}>       
  <div className={`mb-2 rounded-xl w-[200px] h-[45px] flex bg-zinc-50 dark:bg-zinc-900 flex-row justify-center items-center`}>       
    <div
      className={`${
        isBookmarkOpen || isClipboardOpen || downloadsDropdownOpen ? 'block' : 'hidden'
      } overflow-hidden bg-zinc-50 dark:bg-zinc-900 rounded-[10px] mb-1 absolute bottom-full w-[200px] h-[400px]`}
    >
      {/* QuickActions Content */}
      {isBookmarkOpen && (
        <QuickActions
          isOpen={isBookmarkOpen}
          activeTabId={activeTabId}
          tabs={tabs}
          addTab={addTab}
          getDisplayTitle={getDisplayTitle}
          onClose={() => setIsBookmarkOpen(false)}
        />
      )}

      {/* Clipboard Content */}
      {isClipboardOpen && (
        <div className="p-3 cursor-pointer bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-lg rounded-[8px] h-full">
          <Clipboard />
        </div>
      )}

      {/* Downloads Content */}
      {downloadsDropdownOpen && (
        <div className="p-3 cursor-pointer bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-lg rounded-[8px] h-full overflow-hidden">
          <DownloadsDropdown
            downloads={downloads}
            isOpen={downloadsDropdownOpen}
            onOpenChange={setDownloadsDropdownOpen}
            onPause={downloadHandlers.onPause}
            onResume={downloadHandlers.onResume}
            onCancel={downloadHandlers.onCancel}
            onDelete={downloadHandlers.onDelete}
            onRedownload={downloadHandlers.onRedownload}
            onOpenLocation={downloadHandlers.onOpenLocation}
            onClearAll={downloadHandlers.onClearAll}
          />
        </div>
      )}
    </div>

    <div className="flex flex-row w-full justify-between items-center">
      <button
        onClick={toggleBookmark}
        className="bg-zinc-100 w-full dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex justify-center items-center px-3 py-2 text-sm"
      >
        Quick Actions
      </button>
        
      <button 
        onClick={toggleClipboard}
        className="hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex justify-center px-2 py-2 items-center"
      >
        <ClipboardText className="size-[18px]" />
      </button>

<button
  onClick={toggleDownloads}
  className="hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex justify-center items-center pr-3 py-2 relative"
>
  <Archive className="size-[18px]" />
  {/* Enhanced notification indicator */}
  {downloads.filter(d => d.state === 'progressing' || d.state === 'paused').length > 0 && (
    <>
      {/* Pulsing animation for active downloads */}
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
      {/* Number badge */}
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
        <span className="text-[8px] text-white font-bold">
          {downloads.filter(d => d.state === 'progressing' || d.state === 'paused').length}
        </span>
      </div>
    </>
  )}
  {/* Show green dot for completed downloads */}
  {downloads.filter(d => d.state === 'completed').length > 0 && 
   downloads.filter(d => d.state === 'progressing' || d.state === 'paused').length === 0 && (
    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
  )}
</button>
    </div>
  </div>
</div>
    <NotificationManager
  downloads={downloads}
  downloadHandlers={downloadHandlers}
  maxNotifications={3}
  position="bottom-right"
/>
  </div>
  );
};

export default Sidebar;