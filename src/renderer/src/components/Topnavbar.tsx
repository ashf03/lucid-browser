import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { NavLink } from 'react-router-dom';
import { Laptop, Moon, Sun } from 'lucide-react';
import { ThemeType } from '../../../types/types';
import MainDropdownLogo from '../../../../public/maindropdownlogo.png'
import MainDropdownLogo2 from '../../../../public/maindropdownlogo2.png'
import { SidebarSimple, CaretLeft, CaretRight, ArrowClockwise, CornersIn, LinkSimpleHorizontal, SlidersHorizontal, ClockCounterClockwise, CubeFocus, Gear, FlyingSaucer, Plus, Browser, LegoSmiley, Printer, Globe, TextT, DeviceRotate, Link, QrCode, DownloadSimple, MagnifyingGlassMinus, MagnifyingGlassPlus, X, Rewind, Eye, TextAa, BracketsCurly, Copy, Pen, Option, Asterisk, PianoKeys, CornersOut, Minus, MagicWand, HardDrives  } from '@phosphor-icons/react';
import { cn } from '../lib/utils';
import { useCommand } from './parts/CommandContext';
import { useElectronSearch } from '../ai/hook';
import { useChat } from '../ai/ChatContext';
import { Tab } from '../types/types';
import QRCode from 'qrcode';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';  
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import Settings from '../settings/settings';
import PermissionStatusIndicator from './parts/Permissions/PermissionStatusIndicator';
import PrintDialog from './parts/Print/PrintDialog';
import { generateWebViewPDFPreview, printDataUrl, printWebContents } from './parts/Print/PrintService';
import { DropdownMenuAI, DropdownMenuContentAI, DropdownMenuTriggerAI } from '../ui/dropdown-menu-ai';
import MainWebChat from '../ai/WebAIChat/MainWebChat';
import { titleStore } from '../lib/titleStore';

export const DEFAULT_BLANK_URL = `data:text/html,
<html>
</html>`;

interface TopNavBarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  handleReload: () => void;
  activeTabUrl: string;
  addTab: (url?: string) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isTabLoading: boolean;
  activeTabId: string;
  tabs: Tab[];
  webviewRefs: React.MutableRefObject<Map<string, Electron.WebviewTag>>;
}

// Interface for keyboard shortcuts
interface KeyboardShortcut {
  id: string;
  name: string;
  keys: string[];
  action: string;
  isDefault?: boolean;
}

const TopNavBar: React.FC<TopNavBarProps> = ({
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  handleReload,
  activeTabUrl,
  addTab,
  isSidebarOpen,
  toggleSidebar,
  isTabLoading,
  activeTabId,
  tabs,
  webviewRefs,
}) => {

  const [theme, setTheme] = useState<ThemeType>('system');
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Add state for keyboard shortcuts
  const [keyboardShortcuts, setKeyboardShortcuts] = useState<KeyboardShortcut[]>([]);

  // Function to get shortcut display for an action
  const getShortcutDisplay = useCallback((actionId: string): string => {
    const shortcut = keyboardShortcuts.find(s => s.action === actionId);
    if (!shortcut || !shortcut.keys || shortcut.keys.length === 0) {
      return 'Click'; // Fallback
    }
    return shortcut.keys.join('+');
  }, [keyboardShortcuts]);

  // Load shortcuts on component mount
  useEffect(() => {
    const loadShortcuts = async () => {
      try {
        const shortcuts = await window.electronAPI.keyboardShortcuts.get();
        console.log('Loaded keyboard shortcuts in TopNavBar:', shortcuts);
        setKeyboardShortcuts(shortcuts || []);
      } catch (error) {
        console.error('Failed to load keyboard shortcuts:', error);
      }
    };
    
    loadShortcuts();
    
    // Listen for shortcut updates
    const handleShortcutsUpdated = () => {
      console.log('Shortcuts updated, reloading...');
      loadShortcuts();
    };
    
    document.addEventListener('shortcuts-updated', handleShortcutsUpdated);
    window.addEventListener('shortcuts-updated', handleShortcutsUpdated);
    
    return () => {
      document.removeEventListener('shortcuts-updated', handleShortcutsUpdated);
      window.removeEventListener('shortcuts-updated', handleShortcutsUpdated);
    };
  }, []);

    useEffect(() => {
      // Listen for window state changes
      const handleMaximized = () => setIsMaximized(true);
      const handleUnmaximized = () => setIsMaximized(false);
  
      document.addEventListener('window-maximized', handleMaximized);
      document.addEventListener('window-unmaximized', handleUnmaximized);
  
      // Add focus/blur effects
      const handleFocus = () => {
        document.body.style.filter = 'none';
      };
  
      const handleBlur = () => {
        document.body.style.filter = 'brightness(0.95)';
      };
  
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);
  
      // Prevent default drag behavior
      const preventDrag = (e: DragEvent) => {
        if (e.target instanceof HTMLImageElement || e.target instanceof HTMLAnchorElement) {
          e.preventDefault();
        }
      };
  
      document.addEventListener('dragstart', preventDrag);
  
      return () => {
        document.removeEventListener('window-maximized', handleMaximized);
        document.removeEventListener('window-unmaximized', handleUnmaximized);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
        document.removeEventListener('dragstart', preventDrag);
      };
    }, []);
  
    const handleMinimize = async () => {
      if (window.electronAPI?.window) {
        try {
          await window.electronAPI.window.minimize();
        } catch (error) {
          console.error('Failed to minimize window:', error);
        }
      }
    };
  
    const handleMaximize = async () => {
      if (window.electronAPI?.window) {
        try {
          await window.electronAPI.window.maximize();
          setIsMaximized(!isMaximized);
        } catch (error) {
          console.error('Failed to maximize window:', error);
        }
      }
    };
  
    const handleClose = async () => {
      if (window.electronAPI?.window) {
        try {
          await window.electronAPI.window.close();
        } catch (error) {
          console.error('Failed to close window:', error);
        }
      }
    };


const [zoomControlsVisible, setZoomControlsVisible] = useState(false);


  // Handler for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = () => {
      if (theme === 'system') {
        const effectiveTheme = mediaQuery.matches ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', mediaQuery.matches);
        window.electronAPI.theme.change('system').catch(console.error);
      }
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, [theme]);

  // Initial theme setup
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await window.electronAPI.store.get('theme');
        const validatedTheme = (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system') 
          ? savedTheme as ThemeType
          : 'system';
        
        setTheme(validatedTheme);
        const effectiveTheme = validatedTheme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : validatedTheme;
        
        document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
        await window.electronAPI.theme.change(validatedTheme);
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    };
    
    loadTheme();
  }, []);

  const setThemeWithUpdate = async (newTheme: ThemeType) => {
    try {
      setTheme(newTheme);
      const effectiveTheme = newTheme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : newTheme;
      
      document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
      await window.electronAPI.theme.change(newTheme);
      await window.electronAPI.store.set('theme', newTheme);
    } catch (error) {
      console.error('Failed to update theme:', error);
    }
  };

  const [currentPhrase, setCurrentPhrase] = useState(0);
  const phrases = [
    "generating",
    "searching",
    "analyzing",
    "thinking",
    "crafting",
    "cooking"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhrase((prev) => (prev + 1) % phrases.length);
    }, 2000); // Change phrase every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const { isSearching } = useElectronSearch();

  const { isLoading } = useChat(activeTabId);

  const [, setTitleUpdate] = useState({});

  useEffect(() => {
  // Function to handle title updates
  const handleTitleUpdate = () => {
    setTitleUpdate({});
  };

  // Listen for title updates from the titleStore
  window.addEventListener('updateQueryTitle', handleTitleUpdate as EventListener);
  
  return () => {
    window.removeEventListener('updateQueryTitle', handleTitleUpdate as EventListener);
  };
}, []);

const getDisplayText = () => {
  if (showCopied) {
    return "URL Copied!";
  }
  if (isLoading || isSearching) {
    return `${phrases[currentPhrase]}...`;
  }
  if (isTabLoading) {
    return "Loading...";
  }
  
  const currentTab = tabs.find(tab => tab.id === activeTabId);

  if (!currentTab) {
    return "New Tab";
  }

  if (activeTabUrl === DEFAULT_BLANK_URL || activeTabUrl.startsWith('data:text/html')) {
    return "New Tab";
  }

  if (!isLoading && !isSearching && !isTabLoading) {
    // Use titleStore instead of directly accessing currentTab.title
    return titleStore.getDisplayTitle(currentTab);
  }

  return activeTabUrl;
};

  const currentTab = tabs.find(tab => tab.id === activeTabId);
  const isToolTab = currentTab?.type === 'tool';

  const handleDoubleClick = () => {
    if (!isLoading && !isSearching && !isTabLoading && activeTabUrl) {
      navigator.clipboard.writeText(activeTabUrl)
        .then(() => {
          setShowCopied(true);
          setTimeout(() => {
            setShowCopied(false);
          }, 2500); // Show for 2.5 seconds
        })
        .catch(err => console.error('Failed to copy URL:', err));
    }
  };

  const savePage = useCallback(async () => {
  try {
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview) {
      console.error('No webview found for active tab');
      return;
    }
    
    const url = webview.getURL();
    const title = webview.getTitle() || 'webpage';
    const webContentsId = webview.getWebContentsId();
    
    if (!webContentsId) {
      console.error('Could not get webContentsId');
      return;
    }
    
    // Send save request to main process
    const result = await window.electronAPI.ipcRenderer.invoke('save-page', {
      url: url,
      title: title,
      webContentsId: webContentsId
    });
    
    if (result.success) {
      console.log(`Page saved to: ${result.filePath}`);
    } else {
      console.error(`Save failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Save error:', error);
  }
}, [activeTabId, webviewRefs]);

  const [showCopied, setShowCopied] = useState(false);  
  const { isCommandOpen, setCommandOpen, urlLoaded, setUrlLoaded } = useCommand();

const handleInputClick = () => {
  // Check if the URL is not the default blank URL and other conditions are met
  if (!isLoading && 
      !isSearching && 
      !isTabLoading && 
      activeTabUrl && 
      activeTabUrl !== DEFAULT_BLANK_URL && 
      !activeTabUrl.startsWith('data:text/html')) {
    setCommandOpen(true);
    // Dispatch an event to set the command input value
    window.dispatchEvent(new CustomEvent('setCommandInput', {
      detail: { value: activeTabUrl }
    }));
  }
};

  const [qrDataUrl, setQrDataUrl] = useState('');

  const generateQR = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(activeTabUrl, {
        width: 256,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  };

  const downloadQR = async () => {
    if (!qrDataUrl) {
      await generateQR();
    }
    
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'URLqrcodeAquin.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [zoomLevel, setZoomLevel] = useState(1);
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 5;
  const ZOOM_INCREMENT = 0.1;

  const updateZoomLevel = async () => {
    const webview = webviewRefs.current.get(activeTabId);
    if (webview) {
      const level = await webview.getZoomFactor();
      setZoomLevel(level);
    }
  };

  useEffect(() => {
    updateZoomLevel();
  }, [activeTabId]);

  const handleZoomIn = () => {
    const webview = webviewRefs.current.get(activeTabId);
    if (webview && zoomLevel < MAX_ZOOM) {
      const newZoom = Math.min(zoomLevel + ZOOM_INCREMENT, MAX_ZOOM);
      webview.setZoomFactor(newZoom);
      setZoomLevel(newZoom);
    }
  };

  const handleZoomOut = () => {
    const webview = webviewRefs.current.get(activeTabId);
    if (webview && zoomLevel > MIN_ZOOM) {
      const newZoom = Math.max(zoomLevel - ZOOM_INCREMENT, MIN_ZOOM);
      webview.setZoomFactor(newZoom);
      setZoomLevel(newZoom);
    }
  };

  const handleZoomReset = () => {
    const webview = webviewRefs.current.get(activeTabId);
    if (webview) {
      webview.setZoomFactor(1);
      setZoomLevel(1);
    }
  };

  const handleZoomChange = (value: number[]) => {
    const webview = webviewRefs.current.get(activeTabId);
    if (webview) {
      const newZoom = value[0];
      webview.setZoomFactor(newZoom);
      setZoomLevel(newZoom);
    }
  };

const [isZenMode, setIsZenMode] = useState(false);

useEffect(() => {
  const handleToggleZenModeState = () => {
    // This handles the isZenMode state toggling
    if (isZenMode) {
      setIsZenMode(false);
      // Open the sidebar when exiting Zen Mode
      if (!isSidebarOpen) {
        toggleSidebar();
      }
    } else {
      setIsZenMode(true);
      // Close the sidebar when entering Zen Mode
      if (isSidebarOpen) {
        toggleSidebar();
      }
    }
  };

  document.addEventListener('toggle-zen-mode-state', handleToggleZenModeState);
  
  return () => {
    document.removeEventListener('toggle-zen-mode-state', handleToggleZenModeState);
  };
}, [isZenMode, isSidebarOpen, toggleSidebar]);

const [overlayMode, setOverlayMode] = useState<'reading' | 'night' | 'focused' | 'custom' | null>(null);
const [overlayOpacity, setOverlayOpacity] = useState(0.3);

const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
const [selectedSettingsTab, setSelectedSettingsTab] = useState(0);

useEffect(() => {
  const handleOpenSettingsDialog = (event: CustomEvent) => {
    // Extract the selected tab from the event detail
    const { selectedTab } = event.detail;
    
    // Set the selected tab and open the settings dialog
    setSelectedSettingsTab(selectedTab);
    setSettingsDialogOpen(true);
  };

  // Add event listener
  window.addEventListener('openSettingsDialog', handleOpenSettingsDialog as EventListener);
  
  // Clean up
  return () => {
    window.removeEventListener('openSettingsDialog', handleOpenSettingsDialog as EventListener);
  };
}, []);

const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

useEffect(() => {
  const handleDevToolsStateChanged = (event: CustomEvent<{webContentsId: number, isOpen: boolean}>) => {
    const { webContentsId, isOpen } = event.detail;
    const webview = webviewRefs.current.get(activeTabId);
    if (webview && webview.getWebContentsId() === webContentsId) {
      setIsDevToolsOpen(isOpen);
    }
  };

  const handleToggleDevTools = () => {
    const webview = webviewRefs.current.get(activeTabId);
    if (webview) {
      const webContentsId = webview.getWebContentsId();
      if (webContentsId) {
        window.electronAPI.devTools.toggle(webContentsId);
      }
    }
  };

  document.addEventListener('devtools-state-changed', handleDevToolsStateChanged as EventListener);
  document.addEventListener('toggle-webview-devtools', handleToggleDevTools as EventListener);
  
  return () => {
    document.removeEventListener('devtools-state-changed', handleDevToolsStateChanged as EventListener);
    document.removeEventListener('toggle-webview-devtools', handleToggleDevTools as EventListener);
  };
}, [activeTabId, webviewRefs]);

const toggleDevTools = () => {
  const webview = webviewRefs.current.get(activeTabId); 
  if (webview) {
    const webContentsId = webview.getWebContentsId();
    if (webContentsId) {
      window.electronAPI.devTools.toggle(webContentsId)
        .then(isOpen => {
          setIsDevToolsOpen(isOpen);
        })
        .catch(err => console.error('Failed to toggle DevTools:', err));
    }
  }
};

useEffect(() => {
  // Direct handler for opening settings from context menu
  const handleOpenSettings = () => {
    // Set to common tab (0) and open settings dialog
    setSelectedSettingsTab(0);
    setSettingsDialogOpen(true);
  };

  // Add event listener for the new direct event
  document.addEventListener('open-settings', handleOpenSettings as EventListener);
  
  // Clean up
  return () => {
    document.removeEventListener('open-settings', handleOpenSettings as EventListener);
  };
}, []);

useEffect(() => {
  // Handle opening the share link dropdown from context menu
  const handleOpenShareLinkDropdown = () => {
    setDropdownOpen(true);
  };

  // Add event listener
  document.addEventListener('open-share-link-dropdown', handleOpenShareLinkDropdown as EventListener);
  
  // Clean up
  return () => {
    document.removeEventListener('open-share-link-dropdown', handleOpenShareLinkDropdown as EventListener);
  };
}, []);

const [printDialogOpen, setPrintDialogOpen] = useState(false);
const [printPreviewUrl, setPrintPreviewUrl] = useState('');
const [printTitle, setPrintTitle] = useState('');

useEffect(() => {
  // This listener is for the context menu print event
  const handlePrintRequest = (event: CustomEvent<number>) => {
    console.log('Print requested event received with webContentsId:', event.detail);
    handlePrint();
  };
  
  // Add event listener for the print-requested event
  window.addEventListener('print-requested', handlePrintRequest as EventListener);
  
  // Clean up
  return () => {
    window.removeEventListener('print-requested', handlePrintRequest as EventListener);
  };
}, [activeTabId, webviewRefs]);

const handlePrint = async () => {
  try {
    // Web view printing only
    const webview = webviewRefs.current.get(activeTabId);
    if (!webview) {
      console.error('No webview found for active tab');
      return;
    }
    
    const webContentsId = webview.getWebContentsId();
    if (!webContentsId) {
      console.error('Could not get webContentsId');
      return;
    }
    
    setPrintTitle(currentTab?.title || 'Page');
    const pdfDataUrl = await generateWebViewPDFPreview(webContentsId);
    setPrintPreviewUrl(pdfDataUrl);
    
    // Open the print dialog
    setPrintDialogOpen(true);
  } catch (error) {
    console.error('Failed to prepare print preview:', error);
  }
};

const handleFinalPrint = async () => {
  try {
    // Print the webview using system print dialog
    const webview = webviewRefs.current.get(activeTabId);
    if (webview) {
      const webContentsId = webview.getWebContentsId();
      if (webContentsId) {
        await printWebContents(webContentsId);
      }
    }
    
    // Close the dialog
    setPrintDialogOpen(false);
  } catch (error) {
    console.error('Failed to print:', error);
  }
};

// Add this useEffect to listen for print events from the main process (context menu)
useEffect(() => {
  const handleTriggerPrint = (event: CustomEvent<number>) => {
    const webContentsId = event.detail;
    if (webContentsId) {
      handlePrint();
    }
  };
  
  document.addEventListener('trigger-print', handleTriggerPrint as EventListener);
  
  return () => {
    document.removeEventListener('trigger-print', handleTriggerPrint as EventListener);
  };
}, [activeTabId]);

const [aiDropdownOpen, setAiDropdownOpen] = useState(false);

useEffect(() => {
  // Handler for shortcut action
  
  // Special handler for direct History dialog (Ctrl+H) opening
  const handleOpenHistoryDialog = (event: CustomEvent) => {
    if (settingsDialogOpen && selectedSettingsTab === 1) {
      setSettingsDialogOpen(false);
    } 
    // Otherwise open it and select history tab
    else {
      setSelectedSettingsTab(1);
      setSettingsDialogOpen(true);
    }
  };

  let isAddingTab = false;
  const handleAddTab = (event: CustomEvent) => {
    if (isAddingTab) return;
    isAddingTab = true;
    addTab();
    setTimeout(() => { isAddingTab = false; }, 100);
  };

  let isAddingAsterisk = false;
  const handleAddAsterisk = (event: CustomEvent) => {
    if (isAddingAsterisk) return;
    isAddingAsterisk = true;
    window.dispatchEvent(new CustomEvent('create-asterisk-tab'));
    setTimeout(() => { isAddingAsterisk = false; }, 100);
  };

  const handleZenModeOn = (event: CustomEvent) => {
    // This handles the isZenMode state toggling
    if (isZenMode) {
      setIsZenMode(false);
      // Open the sidebar when exiting Zen Mode
      if (!isSidebarOpen) {
        toggleSidebar();
      }
    } else {
      setIsZenMode(true);
      // Close the sidebar when entering Zen Mode
      if (isSidebarOpen) {
        toggleSidebar();
      }
    }
  };

  const handleToggleSidebar = (event: CustomEvent) => {
    toggleSidebar();
  };

  const handlePrintTrigger = (event: CustomEvent) => {
    handlePrint();
  };

  const handleReloadTrigger = (event: CustomEvent) => {
      handleReload();
  };

const handleBrowserAI = () => {
  // Log the current state for debugging
  console.log('Browser AI triggered, current state:', aiDropdownOpen);
  
  // Check if the dropdown can be opened (not on a blank page)
  if (activeTabUrl !== DEFAULT_BLANK_URL && !activeTabUrl.startsWith('data:text/html')) {
    // Explicitly check the current state and set the opposite
    if (aiDropdownOpen) {
      console.log('Dropdown is open, closing it');
      setAiDropdownOpen(false);
    } else {
      console.log('Dropdown is closed, opening it');
      setAiDropdownOpen(true);
    }
  }
};
  
  document.addEventListener('ZenModeOn', handleZenModeOn as EventListener);
  document.addEventListener('addAsterisk', handleAddAsterisk as EventListener);
  document.addEventListener('addTab', handleAddTab as EventListener);
  document.addEventListener('openSettingsDialog', handleOpenHistoryDialog as EventListener);
  document.addEventListener('toggleSidebar', handleToggleSidebar as EventListener);
  document.addEventListener('printTrigger', handlePrintTrigger as EventListener);
  document.addEventListener('reloadTrigger', handleReloadTrigger as EventListener);
  document.addEventListener('browserAI', handleBrowserAI as EventListener);
  
  return () => {
    document.removeEventListener('addAsterisk', handleAddAsterisk as EventListener);
    document.removeEventListener('addTab', handleAddTab as EventListener);
    document.removeEventListener('openSettingsDialog', handleOpenHistoryDialog as EventListener);
    document.removeEventListener('ZenModeOn', handleZenModeOn as EventListener);
    document.removeEventListener('toggleSidebar', handleToggleSidebar as EventListener);
    document.removeEventListener('printTrigger', handlePrintTrigger as EventListener);
    document.removeEventListener('reloadTrigger', handleReloadTrigger as EventListener);
    document.removeEventListener('browserAI', handleBrowserAI as EventListener);
  };
}, [settingsDialogOpen, selectedSettingsTab, isZenMode, isSidebarOpen, toggleSidebar, handlePrint, handleReload, aiDropdownOpen, setAiDropdownOpen, activeTabUrl]);

const [isDarkModeActive, setIsDarkModeActive] = useState(false);

useEffect(() => {
  const updateDarkModeActive = () => {
    if (theme === 'dark') {
      setIsDarkModeActive(true);
    } else if (theme === 'light') {
      setIsDarkModeActive(false);
    } else { // theme === 'system'
      setIsDarkModeActive(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  };

  updateDarkModeActive();

  // Listen for system theme changes when using system theme
  if (theme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      setIsDarkModeActive(mediaQuery.matches);
    };
    
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }
}, [theme]);


  return (
    <div className="flex pt-2 flex-row items-center app-region-drag">
      <DropdownMenu>
<DropdownMenuTrigger className="app-region-no-drag inline-flex items-center justify-center cursor-pointer outline-none border-none pl-3 px-1">
  <img 
    src={isDarkModeActive ? MainDropdownLogo2 : MainDropdownLogo} 
    alt='main dropdown' 
    className='h-[15px] app-region-no-drag' 
  />
</DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 cursor-pointer border-none ml-3 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-lg rounded-[8px] shadow-lg app-region-no-drag ">
          <DropdownMenuItem className="h-8 cursor-pointer"
  onClick={() => {
    setSelectedSettingsTab(0); // Profile tab
    setSettingsDialogOpen(true);
    setDropdownOpen(false); // Close the dropdown when opening settings
  }}>
  <LegoSmiley size={18} strokeWidth={2} />
  <p className="text-[14px] font-normal">Profile</p>
  <DropdownMenuShortcut><p className="text-xs text-foreground">Settings</p></DropdownMenuShortcut>
</DropdownMenuItem>

<DropdownMenuItem className="h-8 cursor-pointer"
  onClick={() => {
    setSelectedSettingsTab(1); // Data tab (which contains history)
    setSettingsDialogOpen(true);
    setDropdownOpen(false); // Close the dropdown when opening settings
  }}>
  <HardDrives size={18} strokeWidth={2} />
  <p className="text-[14px] font-normal">Data Settings</p>
  <DropdownMenuShortcut><p className="text-xs text-foreground">{getShortcutDisplay('open-history')}</p></DropdownMenuShortcut>
</DropdownMenuItem>

          <DropdownMenuGroup>

          <DropdownMenuItem 
  className="h-8 cursor-pointer"
  onClick={() => {
    if (isZenMode) {
      setIsZenMode(false);
      // Open the sidebar when exiting Zen Mode
      if (!isSidebarOpen) {
        toggleSidebar();
      }
    } else {
      setIsZenMode(true);
      // Close the sidebar when entering Zen Mode
      if (isSidebarOpen) {
        toggleSidebar();
      }
    }
    // Close the dropdown
    setDropdownOpen(false);
  }}
>
  <CubeFocus size={18} strokeWidth={2} />
  <p className="text-[14px] font-normal">{isZenMode ? "Exit Zen Mode" : "Zen Mode"}</p>
  <DropdownMenuShortcut><p className="text-xs text-foreground">{getShortcutDisplay('zen-mode-trigger')}</p></DropdownMenuShortcut>
</DropdownMenuItem>

          <DropdownMenuSeparator />

<DropdownMenuItem className="h-8 cursor-pointer" onClick={handlePrint}>
  <Printer size={18} strokeWidth={2} />
  <p className="text-[14px] font-normal">Print</p>
  <DropdownMenuShortcut><p className="text-xs text-foreground">{getShortcutDisplay('print-trigger')}</p></DropdownMenuShortcut>
</DropdownMenuItem>

            <DropdownMenuItem className="h-8 cursor-pointer" onClick={toggleDevTools}>
  <BracketsCurly size={18} strokeWidth={2} />
  <p className="text-[14px] font-normal">
    Developer Tools Window
  </p>
  <DropdownMenuShortcut><p className="text-xs text-foreground">Ctrl+Shift+I</p></DropdownMenuShortcut>
</DropdownMenuItem>

<DropdownMenuItem className="h-8 cursor-pointer" onClick={savePage}>
  <DownloadSimple size={18} strokeWidth={2} />
  <p className="text-[14px] font-normal">Save WebPage</p>
  <DropdownMenuShortcut><p className="text-xs text-foreground">Ctrl+S</p></DropdownMenuShortcut>
</DropdownMenuItem>

            <DropdownMenuItem 
  className="h-8 cursor-pointer"
  onClick={() => {
    setSelectedSettingsTab(0); // Common tab
    setSettingsDialogOpen(true);
    setDropdownOpen(false); // Close the dropdown when opening settings
  }}
>
  <Gear size={18} strokeWidth={2} />
  <p className="text-[14px] font-normal">Settings</p>
  <DropdownMenuShortcut><p className="text-xs text-foreground">Click</p></DropdownMenuShortcut>
</DropdownMenuItem>

          <DropdownMenuSeparator />
          
            <DropdownMenuItem className="h-8 cursor-pointer items-center justify-center flex flex-col">
  <div className="flex items-center justify-between w-full">
    <div className="flex items-center gap-2">
      <Sun className="h-4 w-4" />
      <span>Theme</span>
    </div>
    <div className="flex gap-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setThemeWithUpdate('light');
        }}
        className={`rounded-full p-1.5 transition-colors duration-200 ${
          theme === 'light'
            ? 'bg-zinc-200 dark:bg-zinc-700'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setThemeWithUpdate('dark');
        }}
        className={`rounded-full p-1.5 transition-colors duration-200 ${
          theme === 'dark'
            ? 'bg-zinc-200 dark:bg-zinc-700'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <Moon className="h-4 w-4" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setThemeWithUpdate('system');
        }}
        className={`rounded-full p-1.5 transition-colors duration-200 ${
          theme === 'system'
            ? 'bg-zinc-200 dark:bg-zinc-700'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <Laptop className="h-4 w-4" />
      </button>
    </div>
  </div>
</DropdownMenuItem> 

          <DropdownMenuItem 
  className="h-8 cursor-pointer"
  onClick={(e) => {
    e.preventDefault();
    
    // URL for Team Aquin website
    const url = "https://docs.google.com/forms/d/e/1FAIpQLSfCaTM2ijiW0niN_AZxCk1cEBQwKwq5KD2z0Jf65MnHbqMaVA/viewform?usp=header";
    
    // Get the webview reference and load the URL
    const webview = webviewRefs.current.get(activeTabId);
    if (webview) {
      webview.loadURL(url)
        .then(() => {
          // Since TopNavBar doesn't have direct access to updateTabState,
          // we'll dispatch an event to update the tab state
          window.dispatchEvent(new CustomEvent('tabNavigated', { 
            detail: { 
              tabId: activeTabId,
              url: url
              // The handler for this event would need to handle history updates
            }
          }));
        })
        .catch(error => {
          console.error('Failed to load URL:', error);
        });
    } else {
      console.error('No webview found for active tab');
    }
  }}
>
  <FlyingSaucer size={18} strokeWidth={2} />
  <p className="text-[14px] font-normal">Ask Team Aquin</p>
  <DropdownMenuShortcut><p className="text-xs text-foreground">Click</p></DropdownMenuShortcut>
</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {isZenMode ? (
  <DropdownMenu>
    <DropdownMenuTrigger className="inline-flex items-center justify-center pl-1 app-region-no-drag">
      <CubeFocus 
        className="app-region-no-drag size-[18px] text-foreground hover:text-zinc-700 dark:hover:text-zinc-300" 
      />
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-64 cursor-pointer border-none ml-3 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-lg rounded-[8px] shadow-lg app-region-no-drag">
      <DropdownMenuLabel>Zen Mode Active</DropdownMenuLabel>
      <DropdownMenuSeparator />
      
      {/* Preset Modes */}
      <DropdownMenuItem 
        className="h-8 cursor-pointer"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('setOverlayMode', { 
            detail: { mode: 'reading', color: '#fde68a' }
          }));
          setOverlayMode('reading');
        }}
      >
        <TextAa size={18} strokeWidth={2} />
        <p className="text-[14px] font-normal">Reading Mode</p>
      </DropdownMenuItem>
      <DropdownMenuItem 
        className="h-8 cursor-pointer"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('setOverlayMode', { 
            detail: { mode: 'night', color: '#020617' }
          }));
          setOverlayMode('night');
        }}
      >
        <Moon size={18} strokeWidth={2} />
        <p className="text-[14px] font-normal">Night Mode</p>
      </DropdownMenuItem>
      <DropdownMenuItem 
        className="h-8 cursor-pointer"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('setOverlayMode', { 
            detail: { mode: 'focused', color: '#bfdbfe' }
          }));
          setOverlayMode('focused');
        }}
      >
        <Eye size={18} strokeWidth={2} />
        <p className="text-[14px] font-normal">Focused Mode</p>
      </DropdownMenuItem>
      
      <DropdownMenuSeparator />
      
      {/* Color Selector */}
      <div className="px-2 py-1">
        <p className="text-[14px] font-medium mb-2">Custom Lighting</p>
        <div className="grid grid-cols-6 gap-1 mb-2">
          {[
            '#fca5a5', '#fdba74', '#fde68a', '#fcd34d', '#fef08a', '#bef264',
            '#bbf7d0', '#a7f3d0', '#99f6e4', '#a5f3fc', '#bae6fd', '#bfdbfe',
            '#c7d2fe', '#ddd6fe', '#e9d5ff', '#f5d0fe', '#fbcfe8', '#fecdd3'
          ].map((color) => (
            <button
              key={color}
              className="w-full aspect-square rounded-full cursor-pointer transition-transform hover:scale-110 border border-gray-200 dark:border-gray-700"
              style={{ backgroundColor: color }}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('setOverlayMode', { 
                  detail: { mode: 'custom', color }
                }));
                setOverlayMode('custom');
              }}
              title={color}
            />
          ))}
        </div>
        
        {/* Opacity Slider */}
        <div className="mt-3 mb-2">
          <p className="text-[14px] font-medium mb-1">Lighting Opacity</p>
          <Slider
            value={[overlayOpacity]}
            min={0.1}
            max={0.5}
            step={0.05}
            onValueChange={(value) => {
              setOverlayOpacity(value[0]);
              window.dispatchEvent(new CustomEvent('setOverlayOpacity', { 
                detail: { opacity: value[0] }
              }));
            }}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
      
      <DropdownMenuSeparator />
      
      {/* Remove Overlay */}
      <DropdownMenuItem 
        className="h-8 cursor-pointer"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('setOverlayMode', { 
            detail: { mode: null }
          }));
          setOverlayMode(null);
        }}
      >
        <X size={18} strokeWidth={2} />
        <p className="text-[14px] font-normal">Remove Lighting</p>
      </DropdownMenuItem>
      
      <DropdownMenuSeparator />
      
      {/* Exit Zen Mode */}
      <DropdownMenuItem 
        className="h-8 cursor-pointer"
        onClick={() => {
          setIsZenMode(false);
          window.dispatchEvent(new CustomEvent('setOverlayMode', { 
            detail: { mode: null }
          }));
          setOverlayMode(null);
          // Open the sidebar when exiting Zen Mode
          if (!isSidebarOpen) {
            toggleSidebar();
          }
        }}
      >
        <Rewind size={18} strokeWidth={2} />
        <p className="text-[14px] font-normal">Exit Zen Mode</p>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
) : (
  <button
    onClick={toggleSidebar}
    className="inline-flex items-center justify-center pl-1 app-region-no-drag"
    title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
  >
    <SidebarSimple 
      className="app-region-no-drag size-[18px] text-foreground hover:text-zinc-700 dark:hover:text-zinc-300" 
    />
  </button>
)}

<div className={cn(
    "absolute flex items-center transition-all duration-300 app-region-no-drag",
    isSidebarOpen ? "left-[250px]" : "left-[75px]"
  )}>
    <>
      <button
        // Only trigger navigation if we're in web view
        onClick={() => {
          if (canGoBack) {
            goBack();
          }
        }}
        // Don't use disabled attribute to keep visual appearance the same
        className="inline-flex items-center justify-center px-1 app-region-no-drag"
      > 
        <CaretLeft className="size-[18px] text-foreground hover:text-zinc-700 dark:hover:text-zinc-300 app-region-no-drag" />
      </button>
      <button
        onClick={() => {
          if (canGoForward) {
            goForward();
          }
        }}
        className="inline-flex items-center justify-center app-region-no-drag px-1"
      >
        <CaretRight className="size-[18px] text-foreground hover:text-zinc-700 dark:hover:text-zinc-300 app-region-no-drag" />
      </button>
      <button
        onClick={() => {handleReload();}}
        className="inline-flex items-center justify-center app-region-no-drag px-2"
      >
        <ArrowClockwise className="size-[18px] text-foreground hover:text-zinc-700 dark:hover:text-zinc-300 app-region-no-drag" /> 
      </button>
    </>
</div>

<div className='fixed left-1/2 transform -translate-x-1/2 flex items-center app-region-no-drag transition-all duration-300'>
  <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
  <DropdownMenuTrigger asChild>
    <button>
      <LinkSimpleHorizontal className="size-[18px] app-region-no-drag text-foreground hover:text-zinc-700 dark:hover:text-zinc-300" />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-40 ml-3 border-none app-region-no-drag bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-lg rounded-[8px] shadow-lg">
    <DropdownMenuItem 
      onClick={(e) => {
        e.preventDefault();
        handleDoubleClick();
      }} 
      className="h-8 items-center justify-center flex cursor-pointer"
    >
      <Link size={18} strokeWidth={2} />
      <p className="text-[14px] font-normal">Copy URL</p>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem 
      onClick={(e) => {
        e.preventDefault();
        generateQR();
      }} 
      className="h-8 items-center justify-center flex cursor-pointer"
    >
      <QrCode size={18} strokeWidth={2} />
      <p className="text-[14px] font-normal">Generate QR</p>
    </DropdownMenuItem>
    {qrDataUrl && (
      <>
        <div className="p-2 flex justify-center">
          <img src={qrDataUrl} alt="QR Code from Aquin" className="w-32 h-32" />
        </div>
        <DropdownMenuItem 
          onClick={(e) => {
            e.preventDefault();
            downloadQR();
          }} 
          className="h-8 items-center justify-center flex cursor-pointer"
        >
          <DownloadSimple size={18} strokeWidth={2} />
          <p className="text-[14px] font-normal">Download QR</p>
        </DropdownMenuItem>
      </>
    )}
  </DropdownMenuContent>
</DropdownMenu>
<div className="flex-1 flex-row justify-center flex app-region-no-drag relative items-center text-center overflow-hidden">
{isToolTab ? (
  <div className="flex items-center justify-center px-5">
    {currentTab?.toolType === 'Asterisk' && <Asterisk className="h-5 w-5 mr-1 text-foreground" />}
    <span className="text-foreground text-sm">{currentTab?.title || 'Tool'}</span>
  </div>
) : (
  <div className='flex flex-col items-center'>
  <input
    key={isLoading || isSearching || isTabLoading ? 'loading' : activeTabUrl}
    value={getDisplayText()}
    placeholder={activeTabUrl}
    onClick={handleInputClick}
    onDoubleClick={handleDoubleClick}
    className={cn(
      "w-[200px] text-center items-center app-region-no-drag px-4 py-2 h-8 cursor-pointer",
      "bg-transparent text-sm outline-none border-none",
      "transition-opacity duration-300",
      showCopied ? [
        "animate-in fade-in slide-in-from-top duration-300"
      ] : (isTabLoading || isLoading || isSearching)
        ? [
            "text-muted-foreground",
            "placeholder:text-transparent",
            "[animation:pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]"
          ]
        : [
            "text-foreground",
            "placeholder:text-muted-foreground",
            "animate-in fade-in slide-in-from-top duration-300"
          ]
        )}
        readOnly
      />
  </div>
      )}
  <PermissionStatusIndicator  
    activeTabUrl={activeTabUrl} 
    activeTabId={activeTabId} 
  />
</div>
<button
  onClick={() => setZoomControlsVisible(!zoomControlsVisible)}
  className="app-region-no-drag relative"
>
  <SlidersHorizontal size={16} strokeWidth={2} />
  {zoomControlsVisible && (
    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 flex items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 rounded-lg app-region-no-drag z-10 shadow-xl p-1 gap-0.5">
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleZoomOut();
        }}
        disabled={zoomLevel <= MIN_ZOOM}
        className="h-6 w-6 flex items-center justify-center rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
      >
        <MagnifyingGlassMinus className="size-3.5" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleZoomReset();
        }}
        className="h-6 px-3 flex items-center justify-center text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all duration-150 min-w-[42px]"
      >
        {Math.round(zoomLevel * 100)}%
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleZoomIn();
        }}
        disabled={zoomLevel >= MAX_ZOOM}
        className="h-6 w-6 flex items-center justify-center rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
      >
        <MagnifyingGlassPlus className="size-3.5" />
      </button>
    </div>
  )}
</button>
      </div>

      <div className={cn(
          "fixed right-[15px] gap-2 flex items-center app-region-no-drag" 
        )}>

<DropdownMenuAI open={aiDropdownOpen} 
  onOpenChange={(open) => {
    console.log('Dropdown onOpenChange:', open);
    setAiDropdownOpen(open);
  }}>
  <DropdownMenuTriggerAI 
    disabled={activeTabUrl === DEFAULT_BLANK_URL || activeTabUrl.startsWith('data:text/html')}
    className="app-region-no-drag"
  >
    <button
      className={cn(
        "px-3 flex-row flex justify-center text-sm items-center rounded-[10px]",
        activeTabUrl === DEFAULT_BLANK_URL || activeTabUrl.startsWith('data:text/html')
          ? "text-foreground/30 cursor-not-allowed"
          : "text-foreground cursor-pointer"
      )}
    >
      <MagicWand className={cn(
        "size-[18px]", 
        activeTabUrl === DEFAULT_BLANK_URL || activeTabUrl.startsWith('data:text/html')
          ? "text-foreground/30"
          : "text-foreground"
      )} />
    </button>
  </DropdownMenuTriggerAI>
  <DropdownMenuContentAI 
    className="app-region-no-drag w-84 mr-3 bg-zinc-50/60 dark:bg-zinc-900/60 backdrop-blur-lg p-4 rounded-[8px] shadow-lg"
  >
    <MainWebChat tabId={activeTabId} />
  </DropdownMenuContentAI>
</DropdownMenuAI>

          <div className="flex items-center gap-3">
            <button
              onClick={handleMinimize}
              className="cursor-pointer rounded-md flex items-center justify-center text-base"
              title="Minimize"
            >
              <Minus size={16} />
            </button>

            <button
              onClick={handleMaximize}
              className="cursor-pointer rounded-md flex items-center justify-center text-base"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? (
                <CornersIn size={16} />
              ) : (
                <CornersOut size={16} />
              )}
            </button>

            <button
              onClick={handleClose}
              className="cursor-pointer rounded-md flex items-center justify-center text-base"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
      </div>

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
  <DialogContent className="sm:max-w-4xl max-h-screen">
    <div className="p-4">
      <Settings initialTabId={selectedSettingsTab} />
    </div>
  </DialogContent>
</Dialog>
<PrintDialog
  isOpen={printDialogOpen}
  onClose={() => setPrintDialogOpen(false)}
  previewUrl={printPreviewUrl}
  onPrint={handleFinalPrint}
  title={printTitle}
/>
      </div>
  );
};

export default TopNavBar;