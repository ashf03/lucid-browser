import { Command, CommandIcon } from 'lucide-react';
import React, { FormEvent, ChangeEvent, KeyboardEvent, useEffect, useState, useRef, useCallback } from 'react';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,    
} from "../ui/command";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose
} from "../ui/dialog";
import { Button } from "../ui/button";
import { useElectronSearch } from '../ai/hook';
import { useChat } from '../ai/ChatContext';
import { cn } from '../lib/utils';
import { useCommand } from './parts/CommandContext';
import { Cube, Globe, MagnifyingGlass, TextT, UploadSimple, Pencil, Link, LinkSimple, PaintBrushBroad, Pen, Code, Asterisk, Microphone, MicrophoneSlash, Play, Pause, X, ArrowBendRightUp, Check, ImageSquare, Backspace, CornersOut, CornersIn, GlobeSimple, MagicWand, YoutubeLogo, RocketLaunch, Panorama, Video, MusicNote, MicrophoneStage, Waveform, CubeTransparent, Folders, ChartLine, TreeStructure, TagChevron, Eye, SpinnerGap, LinkBreak, CaretDown, Headset, Television, Camera } from '@phosphor-icons/react';
import _ from 'lodash';
import { Tab } from '../types/types';
import { useAutocomplete } from '../ai/useAutocomplete';
import TextareaAutosize from 'react-textarea-autosize';
import { PasteBox } from '../ai/Containers/PasteBox';
import { FileBox } from '../ai/Containers/FileBox';
import StableVisualizer from '../ai/STT/StableVisualizer';
import { titleStore } from '../lib/titleStore';
import ChatMessage from '../ai/message';
import { CommandMainProps, TranscriptionOptions, TranscriptionResult } from '../types/CommandmainTypes';
import MarkdownContent from '../ai/MessageHelpers/MarkdownContent';
import FollowupChat from '../ai/Followup/FollowupChat';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import CaptureWebDialog from './parts/CaptureWebDialog';

const LoadingStyles = () => (
  <style>{`
    .loading-dots::after {
      content: '';
      animation: dots 1.5s infinite;
    }
    
    @keyframes dots {
      0% { content: ''; }
      25% { content: '.'; }
      50% { content: '..'; }
      75% { content: '...'; }
      100% { content: ''; }
    }
    
    .spinner {
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .url-tag {
      animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .inline-url-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      margin: 0 2px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 12px;
      font-size: 12px;
      color: rgb(59, 130, 246);
      animation: tagPulse 0.5s ease-out;
      vertical-align: middle;
    }

    .inline-url-tag.youtube {
      background: rgba(239, 68, 68, 0.1);
      border-color: rgba(239, 68, 68, 0.3);
      color: rgb(239, 68, 68);
    }

    @keyframes tagPulse {
      0% { 
        transform: scale(0.8);
        opacity: 0;
      }
      50% {
        transform: scale(1.05);
      }
      100% { 
        transform: scale(1);
        opacity: 1;
      }
    }

    .tag-button {
      padding: 1px 3px;
      border-radius: 6px;
      border: none;
      background: rgba(255, 255, 255, 0.8);
      color: inherit;
      cursor: pointer;
      font-size: 10px;
      transition: all 0.2s;
    }

    .tag-button:hover {
      background: rgba(255, 255, 255, 1);
      transform: scale(1.1);
    }

    .tag-button.confirm {
      background: rgba(34, 197, 94, 0.8);
      color: white;
    }

    .tag-button.confirm:hover {
      background: rgba(34, 197, 94, 1);
    }

    .tag-button.remove {
      background: rgba(239, 68, 68, 0.8);
      color: white;
    }

    .tag-button.remove:hover {
      background: rgba(239, 68, 68, 1);
    }

        /* Smooth collapsible animations */
    [data-state="open"] {
      animation: slideDown 300ms cubic-bezier(0.87, 0, 0.13, 1);
    }
    
    [data-state="closed"] {
      animation: slideUp 300ms cubic-bezier(0.87, 0, 0.13, 1);
    }
    
    @keyframes slideDown {
      from {
        height: 0;
        opacity: 0;
      }
      to {
        height: var(--radix-collapsible-content-height);
        opacity: 1;
      }
    }
    
    @keyframes slideUp {
      from {
        height: var(--radix-collapsible-content-height);
        opacity: 1;
      }
      to {
        height: 0;
        opacity: 0;
      }
    }
    
    /* Clean trigger styling */
    .clean-collapse-trigger {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .clean-collapse-trigger:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
  `}</style>
);

interface InlineUrlTag {
  id: string;
  url: string;
  originalText: string;
  type: 'web' | 'youtube';
  startIndex: number;
  endIndex: number;
  status: 'pending' | 'confirming' | 'confirmed' | 'dismissed';
}

interface AttachedUrl {
  url: string;
  type: 'web' | 'youtube';
  status: 'pending' | 'loading' | 'loaded' | 'error';
  content?: ActiveContent;
  error?: string;
}

interface ActiveContent {
  type: 'web' | 'youtube';
  title: string;
  data: ScrapedContent | null;
  youtubeData?: {
    transcript: string;
    videoTitle: string;
    videoId: string;
  };
}

interface ScrapedContent {
  url: string;
  title: string;
  chunks: { text: string; metadata: any }[];
  links: { href: string; text: string }[];
  screenshot: string;
  timestamp: string;
}

interface YoutubeTranscriptResult {
  success: boolean;
  videoTitle?: string;
  transcript?: string;
  error?: string;
}

interface PastedItem {
  id: string;
  content: string;
  timestamp: number;
}

interface UploadedFile {
  id: string;
  name: string;
  content: string;
  fileInfo: any;
  timestamp: number;
}

interface UploadedImage {
  id: string;
  src: string;
  name?: string;
}

// URL validation regex
const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;

export const DEFAULT_BLANK_URL = `data:text/html,
<html>
</html>`;

// Simplified data structures
interface PastedItem {
  id: string;
  content: string;
  timestamp: number;
}

interface UploadedFile {
  id: string;
  name: string;
  content: string;
  fileInfo: any;
  timestamp: number;
}

export function CommandMain({ tabs, switchTab, activeTabId, tabId, tabGroups}: CommandMainProps) {
    // Simplified state - just plain text input
    const [inputText, setInputText] = useState<string>('');
    
    // Separate arrays for different types of content
    const [pastedItems, setPastedItems] = useState<PastedItem[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
    
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const { isSearching } = useElectronSearch();
    const { handleSubmit, handleInputChange, handleKeyDown, isLoading, handleStopGeneration, error, messages } = useChat(activeTabId);
    const { 
      isCommandOpen, 
      setCommandOpen, 
      setUrlLoaded, 
    } = useCommand();
    
    const { suggestions, isLoading: isAutocompleteLoading, fetchSuggestions } = useAutocomplete();

    const [inlineUrlTags, setInlineUrlTags] = useState<InlineUrlTag[]>([]);
    const [attachedUrls, setAttachedUrls] = useState<AttachedUrl[]>([]);
    const [selectedUrlForViewing, setSelectedUrlForViewing] = useState<AttachedUrl | null>(null);
    const [isContentDialogOpen, setIsContentDialogOpen] = useState<boolean>(false);

    const [isTabModeEnabled, setIsTabModeEnabled] = useState<boolean>(false);
    const [isTabPopoverOpen, setIsTabPopoverOpen] = useState<boolean>(false);
    const [selectedTabIds, setSelectedTabIds] = useState<string[]>([]);
    const [selectedTabContents, setSelectedTabContents] = useState<Map<string, ActiveContent>>(new Map());
    const [isLoadingTabContent, setIsLoadingTabContent] = useState<boolean>(false);
    const [loadingTabIds, setLoadingTabIds] = useState<Set<string>>(new Set());

    const [currentPhrase, setCurrentPhrase] = useState(0);
    const [lastSubmittedMessage, setLastSubmittedMessage] = useState<string>('');
    const phrases = [
      "generating on",
      "searching",
      "analyzing", 
      "thinking about",
      "crafting for",
      "connecting thoughts on"
    ];

        const getTabGroupName = (tabId: string): string | null => {
        if (!tabGroups || tabGroups.length === 0) return null;
        const group = tabGroups.find(group => group.tabIds.includes(tabId));
        return group ? group.name : null;
    };

    useEffect(() => {
      if (!isLoading && !isSearching) return;
      
      const interval = setInterval(() => {
        setCurrentPhrase((prev) => (prev + 1) % phrases.length);
      }, 2000);

      return () => clearInterval(interval);
    }, [isLoading, isSearching]);
    
    // Add state for keyboard navigation
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [navItems, setNavItems] = useState<Array<{type: 'suggestion' | 'submit' | 'viewToggle' | 'tab', id: string}>>([]);
    
    // Function to check if input is a URL
const isURL = (text: string): boolean => {
    // First check the original regex
    if (URL_REGEX.test(text)) {
        return true;
    }
    
    // Additional check for localhost and IP addresses
    const trimmed = text.trim();
    
    // Check for localhost (with or without port)
    if (trimmed.startsWith('localhost') || trimmed === 'localhost') {
        return true;
    }
    
    // Check for IP addresses (with or without port)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
    if (ipRegex.test(trimmed)) {
        return true;
    }
    
    // Check for localhost with port
    const localhostPortRegex = /^localhost:\d+$/;
    if (localhostPortRegex.test(trimmed)) {
        return true;
    }
    
    return false;
};

const processURL = (url: string): string => {
    if (!url.includes('://')) {
        if (url.includes('localhost') || url.startsWith('127.0.0.1') || url.includes(':')) {
            return `http://${url}`;
        } else {
            return `https://${url}`;
        }
    }
    return url;
};

const isValidUrl = (text: string): boolean => {
  try {
    let urlToTest = text.trim();
    
    if (!urlToTest.includes('://')) {
      if (urlToTest.includes('localhost') || urlToTest.startsWith('127.0.0.1') || urlToTest.includes(':')) {
        urlToTest = 'http://' + urlToTest;
      } else {
        urlToTest = 'https://' + urlToTest;
      }
    }
    
    const parsedUrl = new URL(urlToTest);
    return ['http:', 'https:'].includes(parsedUrl.protocol) && parsedUrl.hostname.includes('.');
  } catch (error) {
    return false;
  }
};

// Enhanced YouTube URL detection
const isValidYoutubeUrl = (text: string): boolean => {
  try {
    let urlToTest = text.trim();
    
    // Handle youtube.com prefix
    if (!urlToTest.startsWith('http://') && !urlToTest.startsWith('https://')) {
      urlToTest = 'https://' + urlToTest;
    }
    
    const parsedUrl = new URL(urlToTest);
    return (
      ['youtube.com', 'www.youtube.com', 'youtu.be'].includes(parsedUrl.hostname) &&
      (parsedUrl.pathname.includes('/watch') || parsedUrl.hostname === 'youtu.be' || parsedUrl.search.includes('v='))
    );
  } catch (error) {
    return false;
  }
};

const normalizeUrl = (text: string): string => {
  let url = text.trim();
  if (!url.includes('://')) {
    if (url.includes('localhost') || url.startsWith('127.0.0.1') || url.includes(':')) {
      url = 'http://' + url;
    } else {
      url = 'https://' + url;
    }
  }
  return url;
};

// Extract YouTube video ID from URL
const getYoutubeVideoId = (url: string): string | null => {
  try {
    const normalizedUrl = normalizeUrl(url);
    const parsedUrl = new URL(normalizedUrl);
    if (parsedUrl.hostname === 'youtu.be') {
      return parsedUrl.pathname.slice(1);
    }
    return new URLSearchParams(parsedUrl.search).get('v');
  } catch (error) {
    return null;
  }
};

// Scrape URL function
const scrapeUrl = async (url: string): Promise<ScrapedContent | null> => {
  try {
    console.log('Scraping URL:', url);
    
    const response = await window.electronAPI.ipcRenderer.invoke('scrape-url', url);
    
    if (response.success && response.data) {
      console.log('Scrape successful, got data:', {
        title: response.data.title,
        url: response.data.url,
        chunkCount: response.data.chunks?.length || 0,
        linkCount: response.data.links?.length || 0
      });
      
      return response.data;
    } else {
      console.error('Scraping failed with error:', response.error);
      return null;
    }
  } catch (error) {
    console.error('Exception during scraping:', error);
    return null;
  }
};

const detectAndTagUrls = (text: string): void => {
  const matches: InlineUrlTag[] = [];
  
  // Split text by spaces and check each word
  const words = text.split(/(\s+)/);
  let currentPosition = 0;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Skip whitespace
    if (word.match(/^\s+$/)) {
      currentPosition += word.length;
      continue;
    }
    
    // ONLY process words that are followed by space - NOT last words being typed
    const isFollowedBySpace = i < words.length - 1 && words[i + 1].match(/^\s+$/);
    
    // Only detect URLs when user has added space after them
    if (isFollowedBySpace && isValidUrl(word)) {
      const normalizedUrl = normalizeUrl(word);
      const isYoutube = isValidYoutubeUrl(word);
      
      // Check if this URL is already tagged or attached
      const alreadyExists = inlineUrlTags.some(tag => tag.url === normalizedUrl) ||
                          attachedUrls.some(attached => attached.url === normalizedUrl);
      
      if (!alreadyExists) {
        matches.push({
          id: `tag-${Date.now()}-${currentPosition}`,
          url: normalizedUrl,
          originalText: word,
          type: isYoutube ? 'youtube' : 'web',
          startIndex: currentPosition,
          endIndex: currentPosition + word.length,
          status: 'confirming'
        });
      }
    }
    
    currentPosition += word.length;
  }
  
  setInlineUrlTags(prev => {
    // Remove tags that are no longer in the text
    const stillValid = prev.filter(tag => text.includes(tag.originalText));
    return [...stillValid, ...matches];
  });
};

// Confirm inline URL tag
const confirmInlineTag = async (tagId: string) => {
  const tag = inlineUrlTags.find(t => t.id === tagId);
  if (!tag) return;

  // Update tag status to confirmed
  setInlineUrlTags(prev => 
    prev.map(t => t.id === tagId ? { ...t, status: 'confirmed' } : t)
  );

  // Remove the original text from input and replace with a cleaner version
  const cleanInput = inputText.replace(tag.originalText, '').trim();
  setInputText(cleanInput);

  // Add to attached URLs
  const newAttachedUrl: AttachedUrl = {
    url: tag.url,
    type: tag.type,
    status: 'loading'
  };
  
  setAttachedUrls(prev => [...prev, newAttachedUrl]);

  try {
    if (tag.type === 'youtube') {
      // Process YouTube URL
      const response: YoutubeTranscriptResult = await window.electronAPI.youtube.fetchTranscript(tag.url);
      
      if (response.success) {
        const videoId = getYoutubeVideoId(tag.url);
        const content: ActiveContent = {
          type: 'youtube',
          title: response.videoTitle || 'YouTube Video',
          data: null,
          youtubeData: {
            transcript: response.transcript || '',
            videoTitle: response.videoTitle || 'YouTube Video',
            videoId: videoId || ''
          }
        };

        setAttachedUrls(prev => 
          prev.map(attachedUrl => 
            attachedUrl.url === tag.url 
              ? { ...attachedUrl, status: 'loaded', content }
              : attachedUrl
          )
        );
      } else {
        // Fallback to web scraping
        const scrapedContent = await scrapeUrl(tag.url);
        if (scrapedContent) {
          const content: ActiveContent = {
            type: 'web',
            title: scrapedContent.title,
            data: scrapedContent
          };

          setAttachedUrls(prev => 
            prev.map(attachedUrl => 
              attachedUrl.url === tag.url 
                ? { ...attachedUrl, status: 'loaded', content, type: 'web' }
                : attachedUrl
            )
          );
        } else {
          setAttachedUrls(prev => 
            prev.map(attachedUrl => 
              attachedUrl.url === tag.url 
                ? { ...attachedUrl, status: 'error', error: 'Failed to load content' }
                : attachedUrl
            )
          );
        }
      }
    } else {
      // Process regular web URL
      const scrapedContent = await scrapeUrl(tag.url);
      if (scrapedContent) {
        const content: ActiveContent = {
          type: 'web',
          title: scrapedContent.title,
          data: scrapedContent
        };

        setAttachedUrls(prev => 
          prev.map(attachedUrl => 
            attachedUrl.url === tag.url 
              ? { ...attachedUrl, status: 'loaded', content }
              : attachedUrl
          )
        );
      } else {
        setAttachedUrls(prev => 
          prev.map(attachedUrl => 
            attachedUrl.url === tag.url 
              ? { ...attachedUrl, status: 'error', error: 'Failed to scrape content' }
              : attachedUrl
        ))
      }
    }
  } catch (error) {
    console.error('Error processing inline URL:', error);
    setAttachedUrls(prev => 
      prev.map(attachedUrl => 
        attachedUrl.url === tag.url 
          ? { ...attachedUrl, status: 'error', error: 'Processing failed' }
          : attachedUrl
      )
    );
  }

  // Remove the tag after processing
  setInlineUrlTags(prev => prev.filter(t => t.id !== tagId));
};

const activeTab = tabs.find(tab => tab.id === activeTabId);

// Dismiss inline URL tag
const dismissInlineTag = (tagId: string) => {
  const tag = inlineUrlTags.find(t => t.id === tagId);
  if (!tag) return;

  // Remove the tag
  setInlineUrlTags(prev => prev.filter(t => t.id !== tagId));
};

const removeAttachedUrl = (urlToRemove: string) => {
    setAttachedUrls(prev => prev.filter(attachedUrl => attachedUrl.url !== urlToRemove));
    // Auto-reopen will be handled by useEffect
};

const clearAllAttachedUrls = () => {
    setAttachedUrls([]);
    // Auto-reopen will be handled by useEffect
};

// Open content dialog for viewing
const openContentDialog = (attachedUrl: AttachedUrl) => {
  setSelectedUrlForViewing(attachedUrl);
  setIsContentDialogOpen(true);
};

    // Helper function to count lines in text
    const countLines = (text: string): number => {
        return text.split('\n').length;
    };
    
    // Simplified paste handler
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const pastedText = e.clipboardData.getData('text');
        
        // Only create separate paste item if text is substantial
        if (pastedText && (pastedText.length > 50 || countLines(pastedText) > 3)) {
            e.preventDefault(); // Prevent default paste into textarea
            
            const newPastedItem: PastedItem = {
                id: crypto.randomUUID(),
                content: pastedText,
                timestamp: Date.now()
            };
            
            setPastedItems(prev => [...prev, newPastedItem]);
            
            // Focus the textarea
            if (textareaRef.current) {
                textareaRef.current.focus();
            }
        }
        // If it's short text, let it paste normally into the textarea
    };

const compileSubmissionContent = () => {
  const parts: string[] = [];
  
  // Add main text input
  if (inputText.trim()) {
    parts.push(`${inputText.trim()}`);
  }
  
  // Add pasted content with clear labels
  pastedItems.forEach((item, index) => {
    parts.push(`PASTED CONTENT ${index + 1}:\n${item.content}`);
  });
  
  // Add file content with clear labels and file info
  uploadedFiles.forEach((file, index) => {
    const fileInfoStr = JSON.stringify(file.fileInfo, null, 2);
    parts.push(`UPLOADED FILE ${index + 1}:
FILE NAME: ${file.name}
FILE INFO: ${fileInfoStr}
FILE CONTENT:
${file.content}`);
  });
  
  // Add attached URL content
  const loadedUrls = attachedUrls.filter(url => url.status === 'loaded' && url.content);
  loadedUrls.forEach((attachedUrl, index) => {
    const content = attachedUrl.content!;
    parts.push(`ATTACHED URL ${index + 1}: ${content.title}
URL: ${attachedUrl.url}
TYPE: ${content.type === 'youtube' ? 'YouTube Video' : 'Web Page'}

${content.type === 'youtube' && content.youtubeData ? 
  `VIDEO TRANSCRIPT:\n${content.youtubeData.transcript}` :
  content.type === 'web' && content.data ? 
    `PAGE CONTENT:\n${content.data.chunks
      .filter(chunk => chunk.text.trim().length > 20)
      .map(chunk => chunk.text.trim())
      .slice(0, 10)
      .join('\n\n')}

LINKS ON PAGE:\n${content.data.links
  .filter(link => link.text?.trim() || link.href?.trim())
  .slice(0, 8)
  .map(link => `- ${link.text?.trim() || 'Link'}: ${link.href}`)
  .join('\n')}` : ''
}`);
  });
  
  // Add selected tab contents (UPDATED for multiple tabs)
  if (isTabModeEnabled && selectedTabContents.size > 0) {
    Array.from(selectedTabContents.entries()).forEach(([tabId, content], index) => {
      const tab = tabs.find(t => t.id === tabId);
      const isAlreadyAttached = loadedUrls.some(url => url.url === tab?.url);
      
      if (!isAlreadyAttached && tab) {
        parts.push(`SELECTED TAB CONTENT ${index + 1}: ${content.title}
URL: ${tab.url}
TYPE: ${content.type === 'youtube' ? 'YouTube Video' : 'Web Page'}

${content.type === 'youtube' && content.youtubeData ? 
  `VIDEO TRANSCRIPT:\n${content.youtubeData.transcript}` :
  content.type === 'web' && content.data ? 
    `PAGE CONTENT:\n${content.data.chunks
      .filter(chunk => chunk.text.trim().length > 20)
      .map(chunk => chunk.text.trim())
      .slice(0, 10)
      .join('\n\n')}

LINKS ON PAGE:\n${content.data.links
  .filter(link => link.text?.trim() || link.href?.trim())
  .slice(0, 8)
  .map(link => `- ${link.text?.trim() || 'Link'}: ${link.href}`)
  .join('\n')}` : ''
}`);
      }
    });
  }
  
  const compiled = parts.join('\n\n---\n\n');
  console.log("Compiling content parts:", parts.length, "Total length:", compiled.length);
  console.log("Attached URLs in compilation:", loadedUrls.length);
  console.log("Tab mode enabled:", isTabModeEnabled, "Tab contents included:", selectedTabContents.size);
  return compiled;
};

const createStructuredData = () => {
  return {
    text: inputText,
    pastedItems,
    uploadedFiles,
    uploadedImages,
    attachedUrls: attachedUrls.filter(url => url.status === 'loaded'),
    // UPDATED: Include multiple tab contents
    selectedTabContents: isTabModeEnabled ? Array.from(selectedTabContents.entries()).map(([tabId, content]) => ({
      tabId,
      content,
      tab: tabs.find(t => t.id === tabId)
    })) : null,
    selectedTabIds: isTabModeEnabled ? selectedTabIds : [],
    timestamp: Date.now()
  };
};

useEffect(() => {
    const items: Array<{type: 'suggestion' | 'submit' | 'viewToggle' | 'tab', id: string}> = [];
    
    // Add submit button if any content exists (updated condition)
    const hasContent = inputText.trim() || 
                      pastedItems.length > 0 || 
                      uploadedFiles.length > 0 || 
                      uploadedImages.length > 0 || 
                      attachedUrls.filter(url => url.status === 'loaded').length > 0 || 
                      (isTabModeEnabled && selectedTabContents.size > 0);
    
    if (hasContent) {
        items.push({ type: 'submit', id: 'submit' });
    }
    
    // Add suggestions if showing autocomplete
    if (showAutocomplete && !isAutocompleteLoading && suggestions.length > 0) {
        suggestions.forEach((suggestion, index) => {
            items.push({ type: 'suggestion', id: `suggestion-${index}` });
        });
    }
    
    // Add view toggle and tabs if not showing autocomplete
    if (!showAutocomplete) {
        items.push({ type: 'viewToggle', id: 'viewToggle' });
        tabs.forEach(tab => {
            items.push({ type: 'tab', id: tab.id });
        });
    }
    
    setNavItems(items);
    setSelectedIndex(-1);
    
    // ✅ Updated dependencies to include tab mode state
}, [inputText, pastedItems, uploadedFiles, uploadedImages, showAutocomplete, suggestions, isAutocompleteLoading, tabs, attachedUrls, isTabModeEnabled, selectedTabContents]);

    const handleSuggestionClick = (suggestion: string) => {
        // Update input text
        setInputText(suggestion);
        
        // Update the input in the chat context
        handleInputChange({ target: { value: suggestion } } as ChangeEvent<HTMLTextAreaElement>);
        
        // Focus the input so the user can just press Enter to submit if they want
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
        
        // Close the autocomplete suggestions but keep the command dialog open
        setShowAutocomplete(false);
    };

    // Handle tab selection
    const handleTabSelect = (tabId: string): void => {
        switchTab(tabId);
        setCommandOpen(false);
    };

const handleLocalSubmit = (e: FormEvent): void => {
  e.preventDefault();

  console.log("handleLocalSubmit called");
  console.log("Dialog states:", { isFileDialogOpen, isPasteDialogOpen });
  console.log("Content check:", { 
    inputText: inputText.trim(), 
    pastedItems: pastedItems.length, 
    uploadedFiles: uploadedFiles.length, 
    uploadedImages: uploadedImages.length,
    attachedUrls: attachedUrls.length
  });

  if (isFileDialogOpen || isPasteDialogOpen) {
    console.log("Dialog open, preventing submission");
    return;
  }

  // Check if there's any content to submit (including URLs)
  const hasContent = inputText.trim() || 
                    pastedItems.length > 0 || 
                    uploadedFiles.length > 0 || 
                    uploadedImages.length > 0 ||
                    attachedUrls.length > 0 ||
                    (isTabModeEnabled && selectedTabContents.size > 0);
  
  if (!hasContent) {
    console.log("No content to submit");
    return;
  }

  setLastSubmittedMessage(inputText);

  const submissionContent = compileSubmissionContent();
  console.log("Compiled submission content:", submissionContent);
  
  // NEW: Reset collapse state after submission
  resetTypingState();
  
  if (isURL(inputText) && pastedItems.length === 0 && uploadedFiles.length === 0 && attachedUrls.length === 0) {
    // Handle direct URL navigation (existing logic)
    const processedUrl = processURL(inputText);
    const webview = document.querySelector(`[data-tab-id="${activeTabId}"] webview`) as Electron.WebviewTag;
    if (webview) {
      webview.loadURL(processedUrl);
      setUrlLoaded(true);
      clearAllContent();
    }
  } else {
    // Create structured message data (updated)
    const messageData = createStructuredData();
    
    // Store structured data globally for ChatContext to pick up
    console.log("Storing structured data with URLs:", messageData);
    (window as any).pendingStructuredData = messageData;
    
    // Update the input in the chat context with the compiled content
    handleInputChange({ target: { value: submissionContent } } as ChangeEvent<HTMLTextAreaElement>);
    
    // Handle images if present
    if (uploadedImages.length > 0) {
      window.dispatchEvent(new CustomEvent('submitImagesWithMessage', { 
        detail: { 
          tabId: activeTabId,
          images: uploadedImages,
          content: submissionContent,
          messageData: messageData
        }
      }));
    } else {
      // For non-image submissions, directly call handleSubmit with compiled content
      const fakeEvent = {
        ...e,
        preventDefault: () => {},
        target: {
          ...e.target,
          elements: {
            ...(e.target as any).elements,
            message: { value: submissionContent }
          }
        }
      } as unknown as FormEvent;
      
      handleSubmit(fakeEvent, submissionContent);
    }
    
    clearAllContent();
  }
  setShowAutocomplete(false);
};

const clearAllContent = () => {
  setInputText('');
  setPastedItems([]);
  setUploadedFiles([]);
  setUploadedImages([]);
  setAttachedUrls([]);
  setInlineUrlTags([]);
  setIsTabModeEnabled(false);
  setIsTabPopoverOpen(false);
  setSelectedTabIds([]);
  setSelectedTabContents(new Map());
  setLoadingTabIds(new Set());
  setIsCaptureDialogOpen(false);
  setCaptureDialogUrl('');
  setCaptureDialogTitle('');
  resetTypingState();
};


    // Add this function to CommandMain
    const handleCommandFileEdit = useCallback((content: string, fileInfo: any, fileId: string) => {
      console.log("Command file edit triggered", { content, fileInfo, fileId });
      
      // Find the file and set up edit dialog
      const file = uploadedFiles.find(f => f.id === fileId);
      if (file) {
        setCurrentFileContent(content);
        setCurrentFileInfo(fileInfo);
        setFileEditId(fileId);
        setIsFileDialogOpen(true);
      }
    }, [uploadedFiles]);

    // Handle file edit click
    const handleEditFileClick = (id: string, content: string, fileInfo: any) => {
        setFileEditId(id);
        setCurrentFileContent(content);
        setCurrentFileInfo(fileInfo);
        setIsFileDialogOpen(true);
    };

    // Update event listener
    useEffect(() => {
      const handleCommandEditFile = (event: CustomEvent) => {
        event.preventDefault();
        event.stopPropagation();
        
        const { content, fileInfo, fileId } = event.detail;
        handleCommandFileEdit(content, fileInfo, fileId);
        
        return false;
      };
      
      window.addEventListener('commandEditFile', handleCommandEditFile as unknown as EventListener);
      
      return () => {
        window.removeEventListener('commandEditFile', handleCommandEditFile as unknown as EventListener);
      };
    }, [handleCommandFileEdit]);
    
    const debouncedHandleChange = React.useCallback(
        _.debounce((value: string) => {
            handleInputChange({ target: { value } } as ChangeEvent<HTMLTextAreaElement>);
            fetchSuggestions(value);
        }, 100),
        [handleInputChange, fetchSuggestions]
    );

const handleLocalInput = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    const newValue = e.target.value;
    const previousValue = inputText;
    
    setInputText(newValue);
    
    // NEW: Auto-collapse/reopen logic
    if (hasAssistantMessages()) {
      // If user starts typing when input was empty, mark as started typing
      if (!previousValue.trim() && newValue.trim()) {
        setHasUserStartedTyping(true);
        setIsResponseCollapsed(true);
      }
      // FIXED: If user clears input AND no other content exists, reset state
      else if (newValue.trim() === '' && !hasAnyOtherContent()) {
        resetTypingState();
      }
    }
    
    // Update autocomplete state
    setShowAutocomplete(!!newValue.trim());
    
    // Detect URLs in the input
    detectAndTagUrls(newValue);
    
    // Send to chat context
    debouncedHandleChange(newValue);
};

// Update the existing hasAnyContent function to be more explicit
const hasAnyContent = () => {
  return inputText.trim() || hasAnyOtherContent();
};

    // Handle selected item action
    const handleSelectedItemAction = () => {
        if (selectedIndex >= 0 && selectedIndex < navItems.length) {
            const selectedItem = navItems[selectedIndex];
            
            switch (selectedItem.type) {
                case 'submit':
                    handleLocalSubmit({} as FormEvent);
                    break;
                case 'suggestion':
                    const suggestionIndex = parseInt(selectedItem.id.split('-')[1]);
                    if (suggestions[suggestionIndex]) {
                        handleSuggestionClick(suggestions[suggestionIndex].suggestion);
                    }
                    break;
                case 'tab':
                    handleTabSelect(selectedItem.id);
                    break;
            }
        }
    };

    const handleLocalKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
        console.log("Key pressed:", e.key, "shiftKey:", e.shiftKey, "selectedIndex:", selectedIndex);
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => 
                prev < navItems.length - 1 ? prev + 1 : 0
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => 
                prev > 0 ? prev - 1 : navItems.length - 1
            );
        } else if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Allow normal line break insertion
                console.log("Shift+Enter: allowing line break");
                return;
            } else if (selectedIndex >= 0) {
                console.log("Enter with selection:", selectedIndex);
                e.preventDefault();
                handleSelectedItemAction();
            } else {
                console.log("Enter without selection: submitting form");
                e.preventDefault();
                handleLocalSubmit(e as unknown as FormEvent);
            }
        } else if (e.key === 'Escape') {
            if (isPasteDialogOpen) {
                setIsPasteDialogOpen(false);
                setActivePasteId(null);
            } else {
                setShowAutocomplete(false);
                setSelectedIndex(-1);
            }
        } else {
            handleKeyDown(e);
        }
    };

    // Scroll selected item into view
    useEffect(() => {
        if (selectedIndex >= 0) {
            const selectedElement = document.getElementById(`nav-item-${selectedIndex}`);
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    useEffect(() => {
        const handleSetCommandInput = (event: CustomEvent) => {
          const { value } = event.detail;
          setInputText(value);
          setShowAutocomplete(!!value.trim());
          debouncedHandleChange(value);
        };
    
        window.addEventListener('setCommandInput', handleSetCommandInput as EventListener);
        
        return () => {
          window.removeEventListener('setCommandInput', handleSetCommandInput as EventListener);
        };
    }, [debouncedHandleChange]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Helper to determine if an item is selected
    const isItemSelected = (index: number) => index === selectedIndex;

    // Remove pasted item
const removePastedItem = (id: string) => {
    setPastedItems(prev => prev.filter(item => item.id !== id));
    // Auto-reopen will be handled by useEffect
};

    // Edit pasted item  
    const editPastedItem = (id: string, newContent: string) => {
        setPastedItems(prev => 
            prev.map(item => 
                item.id === id ? { ...item, content: newContent } : item
            )
        );
    };

    // Remove uploaded file
const removeUploadedFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== id));
    // Auto-reopen will be handled by useEffect
};

    // Edit uploaded file
    const editUploadedFile = (id: string, newContent: string) => {
        setUploadedFiles(prev =>
            prev.map(file =>
                file.id === id ? { ...file, content: newContent } : file
            )
        );
    };

    // Paste dialog state
    const [isPasteDialogOpen, setIsPasteDialogOpen] = useState<boolean>(false);
    const [activePasteId, setActivePasteId] = useState<string | null>(null);
    const [editingPasteContent, setEditingPasteContent] = useState<string>('');

    const handleEditPasteClick = (id: string, content: string) => {
        setActivePasteId(id);
        setEditingPasteContent(content);
        setIsPasteDialogOpen(true);
    };

    const handleConfirmPasteEdit = () => {
        if (activePasteId) {
            editPastedItem(activePasteId, editingPasteContent);
            setIsPasteDialogOpen(false);
            setActivePasteId(null);
        }
    };

    const handleEditingPasteKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          
          const cursorPos = e.currentTarget.selectionStart;
          const newContent = 
            editingPasteContent.substring(0, cursorPos) + 
            '\n' + 
            editingPasteContent.substring(cursorPos);
          
          setEditingPasteContent(newContent);
          
          setTimeout(() => {
            const textarea = e.currentTarget;
            if (textarea) {
              textarea.selectionStart = cursorPos + 1;
              textarea.selectionEnd = cursorPos + 1;
            }
          }, 0);
        }
    };

    const [isFileConverting, setIsFileConverting] = useState(false);

    const handleFileUpload = async () => {
        try {
          const filePath = await window.electronAPI.ipcRenderer.invoke('open-general-file-dialog');
          
          if (filePath) {
            setIsFileConverting(true);
            
            const fileName = filePath.split('\\').pop()?.split('/').pop() || 'Unknown file';
            const result = await window.electronAPI.ipcRenderer.invoke('process-folder-or-zip', filePath);
            
            if (result.success) {
              let fileInfo;
              let content;
              
              if (result.isFolder) {
                fileInfo = {
                  name: fileName,
                  type: result.isZip ? 'zip' : 'folder',
                  extension: result.isZip ? '.zip' : '',
                  size: result.data.size,
                  fileCount: result.data.fileCount,
                  folderCount: result.data.folderCount
                };
                content = result.data.textContent;
              } else {
                fileInfo = {
                  name: fileName,
                  type: result.fileInfo?.type || 'unknown',
                  extension: result.fileInfo?.extension || '',
                  size: result.fileInfo?.size || ''
                };
                content = result.text;
              }
              
              const newFile: UploadedFile = {
                id: crypto.randomUUID(),
                name: fileName,
                content,
                fileInfo,
                timestamp: Date.now()
              };
              
              console.log("Adding new file:", newFile);
              setUploadedFiles(prev => {
                const updated = [...prev, newFile];
                console.log("Updated uploadedFiles:", updated);
                return updated;
              });
            } else {
              console.error('File/folder conversion failed:', result.error);
            }
          }
        } catch (error) {
          console.error('Error uploading file/folder:', error);
        } finally {
          setIsFileConverting(false);
        }
    };

    const [isDraggingFile, setIsDraggingFile] = useState(false);

    const handleDragEnter = (e: { preventDefault: () => void; stopPropagation: () => void; }) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(true);
    };
      
    const handleDragOver = (e: { preventDefault: () => void; stopPropagation: () => void; }) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDraggingFile) setIsDraggingFile(true);
    };
      
    const handleDragLeave = (e: { preventDefault: () => void; stopPropagation: () => void; currentTarget: { contains: (arg0: any) => any; }; relatedTarget: any; }) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.currentTarget.contains(e.relatedTarget)) {
          return;
        }
        
        setIsDraggingFile(false);
    };
      
    const handleDrop = async (e: { preventDefault: () => void; stopPropagation: () => void; dataTransfer: { items: any; files: any }; }) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(false);

      const items = e.dataTransfer.items;
      
      if (items && items.length > 0) {
        setIsFileConverting(true);
        
        try {
          const item = items[0];
          
          if (item.kind === 'file') {
            const file = item.getAsFile();
            const filePath = file.path;
            
            if (filePath) {
              const fileName = file.name || 'Unknown file';
              const result = await window.electronAPI.ipcRenderer.invoke('process-folder-or-zip', filePath);
              
              if (result.success) {
                let fileInfo;
                let content;
                
                if (result.isFolder) {
                  fileInfo = {
                    name: fileName,
                    type: result.isZip ? 'zip' : 'folder',
                    extension: result.isZip ? '.zip' : '',
                    size: result.data.size,
                    fileCount: result.data.fileCount,
                    folderCount: result.data.folderCount
                  };
                  content = result.data.textContent;
                } else {
                  fileInfo = {
                    name: fileName,
                    type: result.fileInfo?.type || 'unknown',
                    extension: result.fileInfo?.extension || '',
                    size: result.fileInfo?.size || ''
                  };
                  content = result.text;
                }
                
                const newFile: UploadedFile = {
                  id: crypto.randomUUID(),
                  name: fileName,
                  content,
                  fileInfo,
                  timestamp: Date.now()
                };
                
                console.log("Adding dropped file:", newFile);
                setUploadedFiles(prev => {
                  const updated = [...prev, newFile];
                  console.log("Updated uploadedFiles from drop:", updated);
                  return updated;
                });
              } else {
                console.error('File/folder conversion failed:', result.error);
              }
            }
          }
        } catch (error) {
          console.error('Error processing dropped file/folder:', error);
        } finally {
          setIsFileConverting(false);
        }
      }
    };

    const [failedFavicons, setFailedFavicons] = useState<Set<string>>(new Set());

    const handleFaviconError = useCallback((url: string) => {
        setFailedFavicons(prev => {
          const updated = new Set(prev);
          updated.add(url);
          return updated;
        });
    }, []);

    const getToolIcon = (tab: Tab) => {
        if (tab.type === 'tool') {
          switch (tab.toolType) {
            case 'Asterisk':
              return <Asterisk className="h-4 w-4" />;
            default:
              return <Cube className="h-4 w-4" />;
          }
        }

        if (tab.icon) {
          if (typeof tab.icon === 'string') {
            return <img src={tab.icon} alt="" className="h-4 w-4 object-contain" />;
          } else {
            const IconComponent = tab.icon;
            return <IconComponent className="h-4 w-4" />;
          }
        }
            
        if (tab.url && tab.url !== DEFAULT_BLANK_URL && !tab.url.startsWith('data:text/html')) {
          try {
            const hostname = new URL(tab.url).hostname;
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}`;
            
            if (failedFavicons.has(faviconUrl)) {
              return <Globe className="h-4 w-4" />;
            }
            
            return (
              <img 
                src={faviconUrl}
                alt=""
                className="h-4 w-4 object-contain"
                onError={() => handleFaviconError(faviconUrl)}
              />
            );
          } catch (error) {
            return <Globe className="h-4 w-4" />;
          }
        }
        
        return <Cube className="h-4 w-4" />;
    };

    // File dialog state
    const [fileEditId, setFileEditId] = useState<string | null>(null);
    const [currentFileContent, setCurrentFileContent] = useState<string>('');
    const [currentFileInfo, setCurrentFileInfo] = useState<any>(null);
    const [isFileDialogOpen, setIsFileDialogOpen] = useState<boolean>(false);

    const handleConfirmFileEdit = () => {
        if (fileEditId) {
            editUploadedFile(fileEditId, currentFileContent);
            setIsFileDialogOpen(false);
            setFileEditId(null);
        }
    };

    const handleEditingFileKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          
          const cursorPos = e.currentTarget.selectionStart;
          const newContent = 
            currentFileContent.substring(0, cursorPos) + 
            '\n' + 
            currentFileContent.substring(cursorPos);
          
          setCurrentFileContent(newContent);
          
          setTimeout(() => {
            const textarea = e.currentTarget;
            if (textarea) {
              textarea.selectionStart = cursorPos + 1;
              textarea.selectionEnd = cursorPos + 1;
            }
          }, 0);
        }
    };

    // STT (Speech-to-Text) functionality
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordedFilePath, setRecordedFilePath] = useState<string | null>(null);
    
    const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
    const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
    const [language, setLanguage] = useState<string>('');
    const diarize = true;
    const tagEvents = true;
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
    const [isProcessingRecording, setIsProcessingRecording] = useState<boolean>(false);

const handleStartRecording = async () => {
    try {
        console.log('Starting recording...');
        
        // Clean up any existing audio URL
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
        
        // Reset states
        setIsPaused(false);
        setIsProcessingRecording(false);
        setRecordedFilePath(null); // ✅ RESET FILE PATH
        audioChunksRef.current = [];
        
        // Get user media stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        setAudioStream(stream);
        console.log('Audio stream acquired');
        
        // Create MediaRecorder
        mediaRecorderRef.current = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        // Set up event handlers
        mediaRecorderRef.current.ondataavailable = (event) => {
            console.log('Data available, size:', event.data.size);
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };
        
        mediaRecorderRef.current.onstart = () => {
            console.log("Recording started - MediaRecorder event");
            setIsRecording(true);
            setIsPaused(false);
        };
        
        mediaRecorderRef.current.onpause = () => {
            console.log("Recording paused - MediaRecorder event");
            setIsPaused(true);
        };
        
        mediaRecorderRef.current.onresume = () => {
            console.log("Recording resumed - MediaRecorder event");
            setIsPaused(false);
        };
        
        mediaRecorderRef.current.onerror = (event) => {
            console.error("MediaRecorder error:", event.error);
            setIsRecording(false);
            setIsPaused(false);
            setIsProcessingRecording(false);
            
            let errorMessage = 'Recording error occurred';
            if (event.error && event.error.message) {
                errorMessage = event.error.message;
            }
            alert('Recording error: ' + errorMessage);
        };
        
        mediaRecorderRef.current.onstop = async () => {
            console.log("Recording stopped - MediaRecorder event");
            setIsProcessingRecording(true); // ✅ SET PROCESSING STATE
            
            // Stop all tracks to free up the microphone
            if (audioStream) {
                audioStream.getTracks().forEach(track => {
                    console.log('Stopping audio track');
                    track.stop();
                });
                setAudioStream(null);
            }
            
            // Create audio blob from chunks
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
            console.log('Audio blob created, size:', audioBlob.size);
            
            const newAudioUrl = URL.createObjectURL(audioBlob);
            setAudioUrl(newAudioUrl);
            setRecordedBlob(audioBlob);
            
            // ✅ FIXED: Save blob and transcribe in proper sequence
            try {
                const reader = new FileReader();
                reader.onload = async function() {
                    try {
                        console.log('Saving recorded audio blob...');
                        const tempFilePath = await window.electronAPI.ipcRenderer.invoke('save-blob', reader.result);
                        setRecordedFilePath(tempFilePath);
                        console.log('Audio saved to:', tempFilePath);
                        
                        // ✅ AUTOMATICALLY TRANSCRIBE AFTER SAVING
                        await performTranscription(tempFilePath);
                        
                    } catch (error) {
                        console.error('Error saving/transcribing recorded audio:', error);
                        setIsProcessingRecording(false);
                        let errorMessage = 'Failed to save/transcribe recording';
                        if (error instanceof Error) {
                            errorMessage += ': ' + error.message;
                        }
                        alert(errorMessage);
                    }
                };
                
                reader.onerror = (error) => {
                    console.error('FileReader error:', error);
                    setIsProcessingRecording(false);
                    alert('Failed to process recorded audio');
                };
                
                reader.readAsDataURL(audioBlob);
                
            } catch (error) {
                console.error('Error in onstop handler:', error);
                setIsProcessingRecording(false);
            }
            
            // Reset recording states
            setIsRecording(false);
            setIsPaused(false);
        };
        
        // Start recording
        mediaRecorderRef.current.start(1000); // Collect data every 1 second
        console.log('MediaRecorder started');
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        
        // Proper error message extraction
        let errorMessage = 'Unknown error occurred';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else if (error && typeof error === 'object' && 'name' in error && typeof (error as any).name === 'string') {
            const errName = (error as { name: string }).name;
            if (errName === 'NotAllowedError') {
                errorMessage = 'Microphone access denied. Please allow microphone permission and try again.';
            } else if (errName === 'NotFoundError') {
                errorMessage = 'No microphone found. Please check your microphone connection.';
            } else if (errName === 'NotReadableError') {
                errorMessage = 'Microphone is already in use by another application.';
            } else {
                errorMessage = errName || error.toString() || 'Permission denied or microphone unavailable';
            }
        }
        
        alert('Error accessing microphone: ' + errorMessage);
        
        // Reset states on error
        setIsRecording(false);
        setIsPaused(false);
        setAudioStream(null);
        setIsProcessingRecording(false);
        
        // Clean up any partial stream
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            setAudioStream(null);
        }
    }
};

// ✅ NEW: Separate transcription function
const performTranscription = async (filePath: string) => {
    try {
        setIsTranscribing(true);
        setTranscriptionResult(null);
        
        const options: TranscriptionOptions = {
            language: language,
            tag_audio_events: tagEvents,
            diarize: diarize
        };
        
        const result = await window.electronAPI.ipcRenderer.invoke(
            'transcribe-audio', 
            filePath, 
            options
        );
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        setTranscriptionResult(result);
        
        if (result.text) {
            const transcriptionText = result.text.trim();
            
            const newInputText = inputText.trim() 
                ? `${inputText} ${transcriptionText}` 
                : transcriptionText;
            
            setInputText(newInputText);
            
            // Focus the textarea
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    const length = textareaRef.current.value.length;
                    textareaRef.current.selectionStart = length;
                    textareaRef.current.selectionEnd = length;
                }
            }, 100);
        }
        
    } catch (error) {
        console.error('Transcription error:', error);
        setTranscriptionResult({ 
            text: '', 
            error: (error as Error).message || 'An unknown error occurred'
        });
    } finally {
        setIsTranscribing(false);
        setIsProcessingRecording(false);
        // ✅ RESET FILE PATH AFTER TRANSCRIPTION
        setRecordedFilePath(null);
    }
};

const handleStopRecording = () => {
    console.log('Stop recording requested');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        // Don't call cleanup here - let the onstop event handle it
    }
};

// ✅ UPDATED: Remove the old handleTranscribe function and replace with this
const handleTranscribe = async () => {
    if (!recordedFilePath) {
        alert('Please record audio first');
        return;
    }
    
    await performTranscription(recordedFilePath);
};

const cleanupSTTResources = () => {
    console.log('Cleaning up STT resources');
    
    // Stop MediaRecorder if it's recording or paused
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
            mediaRecorderRef.current.stop();
        } catch (error) {
            console.error('Error stopping MediaRecorder during cleanup:', error);
        }
    }
    
    // Stop all audio tracks
    if (audioStream) {
        audioStream.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (error) {
                console.error('Error stopping audio track:', error);
            }
        });
        setAudioStream(null);
    }
    
    // Clean up URL
    if (audioUrl) {
        try {
            URL.revokeObjectURL(audioUrl);
        } catch (error) {
            console.error('Error revoking URL:', error);
        }
        setAudioUrl(null);
    }
    
    // Reset all states
    setIsRecording(false);
    setIsPaused(false);
    setRecordedBlob(null);
    setRecordedFilePath(null);
    setIsProcessingRecording(false); // ✅ RESET PROCESSING STATE
    audioChunksRef.current = [];
    
    setIsTranscribing(false);
    setTranscriptionResult(null);
    
    console.log('STT resources cleaned up');
};

const handlePauseRecording = () => {
    console.log('Attempting to pause recording, current state:', mediaRecorderRef.current?.state);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        try {
            mediaRecorderRef.current.pause();
            // ✅ DON'T modify the audio stream - keep it active for visualizer
            console.log('Recording pause requested');
        } catch (error) {
            console.error('Error pausing recording:', error);
            setIsPaused(false);
        }
    } else {
        console.warn('Cannot pause: MediaRecorder not in recording state');
    }
};

const handleResumeRecording = () => {
    console.log('Attempting to resume recording, current state:', mediaRecorderRef.current?.state);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
        try {
            mediaRecorderRef.current.resume();
            // ✅ Audio stream should still be active from the original recording
            console.log('Recording resume requested');
        } catch (error) {
            console.error('Error resuming recording:', error);
            setIsPaused(true);
        }
    } else {
        console.warn('Cannot resume: MediaRecorder not in paused state', mediaRecorderRef.current?.state);
    }
};

useEffect(() => {
    if (audioStream && isRecording) {
        // Ensure audio tracks remain active during pause/resume
        const tracks = audioStream.getAudioTracks();
        tracks.forEach(track => {
            if (track.readyState === 'ended') {
                console.warn('Audio track ended during recording');
            }
        });
    }
}, [audioStream, isRecording, isPaused]);

    const [followupInput, setFollowupInput] = useState<string>('');

    useEffect(() => {
        return () => {
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
          }
        };
    }, [audioUrl]);

    useEffect(() => {
        if (!isCommandOpen && isRecording) {
          cleanupSTTResources();
        }
    }, [isCommandOpen, isRecording]);

    const hasAssistantMessages = () => {
  return messages.some(message => message.role === 'assistant');
};

const [isResponseCollapsed, setIsResponseCollapsed] = useState<boolean>(false);
const [hasUserStartedTyping, setHasUserStartedTyping] = useState<boolean>(false);
const [isCollapsedByFollowup, setIsCollapsedByFollowup] = useState<boolean>(false); // ✅ ADD THIS LINE

// Helper function to reset typing state
const resetTypingState = () => {
  console.log("Resetting typing state - expanding response");
  setHasUserStartedTyping(false);
  setIsResponseCollapsed(false);
  setIsCollapsedByFollowup(false); // ✅ ADD THIS LINE
};

useEffect(() => {
  // Auto-reopen when ALL content is cleared (but be more specific)
  const hasMainContent = inputText.trim() || 
                        pastedItems.length > 0 || 
                        uploadedFiles.length > 0 || 
                        uploadedImages.length > 0 || 
                        attachedUrls.length > 0 ||
                        (isTabModeEnabled && selectedTabContents.size > 0);
  
  // Only reset if NO main content AND no followup input AND response is collapsed AND not collapsed by followup
  if (hasAssistantMessages() && 
      !hasMainContent && 
      !followupInput.trim() && 
      isResponseCollapsed &&
      !isCollapsedByFollowup) { // ✅ CHANGE THIS CONDITION
    console.log("All content cleared, reopening response");
    resetTypingState();
  }
}, [inputText, pastedItems, uploadedFiles, uploadedImages, attachedUrls, selectedTabContents, isResponseCollapsed, followupInput, isCollapsedByFollowup]); // ✅ UPDATE DEPENDENCIES

const handleAudioFileUpload = async () => {
    try {
        const filePath = await window.electronAPI.ipcRenderer.invoke('open-audio-file-dialog', {
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] }
            ]
        });
        
        if (filePath) {
            // ✅ UPDATED: Use the same performTranscription function
            await performTranscription(filePath);
            
            // Stop recording if it was active
            if (isRecording) {
                handleStopRecording();
            }
        }
    } catch (error) {
        console.error('Audio file processing error:', error);
        setTranscriptionResult({ 
            text: '', 
            error: (error as Error).message || 'An error occurred processing the audio file'
        });
        setIsTranscribing(false);
        setIsProcessingRecording(false);
    }
};

    const handleImageUpload = async () => {
        try {
          const filePath = await window.electronAPI.ipcRenderer.invoke('open-image-file-dialog', {
            filters: [
              { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff'] }
            ]
          });
          
          if (filePath) {
            setIsFileConverting(true);
            
            const fileName = filePath.split('\\').pop()?.split('/').pop() || 'Unknown image';
            const result = await window.electronAPI.ipcRenderer.invoke('convert-file', filePath);
            
            if (result.success && result.text) {
              if (result.text.startsWith('data:')) {
                setUploadedImages(prev => [...prev, {
                  id: crypto.randomUUID(),
                  src: result.text,
                  name: fileName
                }]);
              } else {
                console.error('Image data is not in expected format');
              }
            } else {
              console.error('Image conversion failed:', result.error || 'Unknown error');
            }
          }
        } catch (error) {
          console.error('Error uploading image:', error);
        } finally {
          setIsFileConverting(false);
        }
    };
  
const removeImage = (id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
    // Auto-reopen will be handled by useEffect
};

useEffect(() => {
  if (!isCommandOpen) {
    setUploadedImages([]);
    setAttachedUrls([]);
    setInlineUrlTags([]);
    setSelectedUrlForViewing(null);
    setIsContentDialogOpen(false);
    setIsFilePopoverOpen(false);
    setIsTabModeEnabled(false);
    setIsTabPopoverOpen(false);
    setSelectedTabIds([]);
    setSelectedTabContents(new Map());
    setLoadingTabIds(new Set());
    resetTypingState();
  }
}, [isCommandOpen]);

    const [isImageDialogOpen, setIsImageDialogOpen] = useState<boolean>(false);
    const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
    const [selectedImageName, setSelectedImageName] = useState<string | null>(null);

    const handleImageClick = (src: string, name?: string | null) => {
        setSelectedImageSrc(src);
        setSelectedImageName(name || null);
        setIsImageDialogOpen(true);
    };

    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const toggleFullscreen = () => {
        setIsFullscreen(prev => !prev);
    };

const renderInputWithTags = () => {
    if (inlineUrlTags.length === 0) {
        return (
            <TextareaAutosize 
                value={inputText}
                ref={textareaRef}
                onChange={handleLocalInput}
                onKeyDown={handleLocalKeyDown}
                disabled={isLoading || isSearching}
                placeholder="Enter URL or ask Lucid anything..." 
                spellCheck={true}
                minRows={1}
                maxRows={6}
                className={cn(
                    "flex sidebar-scrollbar resize-none overflow-y-auto w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
                )}
            />
        );
    }

    // Render with inline tags overlay
    return (
        <div className="relative w-full">
            <TextareaAutosize 
                value={inputText}
                ref={textareaRef}
                onChange={handleLocalInput}
                onKeyDown={handleLocalKeyDown}
                disabled={isLoading || isSearching}
                placeholder="Enter URL or ask Lucid anything..." 
                spellCheck={true}
                minRows={1}
                maxRows={6}
                className={cn(
                    "flex sidebar-scrollbar resize-none overflow-y-auto w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
                )}
            />
            
            {/* Overlay with inline tags */}
            <div className="absolute top-2 left-3 right-3 pointer-events-none">
                <div className="flex flex-wrap gap-1 items-center">
                    {inlineUrlTags
                        .filter(tag => tag.status === 'confirming')
                        .map(tag => (
                            <div
                                key={tag.id}
                                className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-xl text-xs border pointer-events-auto animate-in slide-in-from-top-2 duration-300",
                                    tag.type === 'youtube' 
                                        ? "bg-red-50 border-red-200 text-red-600 dark:bg-zinc-800/80 dark:border-zinc-700 dark:text-red-400"
                                        : "bg-zinc-50 border-zinc-200 text-blue-600 dark:bg-zinc-800/80 dark:border-zinc-700 dark:text-blue-400"
                                )}
                            >
                                {tag.type === 'youtube' ? (
                                    <YoutubeLogo size={8} />
                                ) : (
                                    <Link size={8} />
                                )}
                                <span className="max-w-[120px] truncate">
                                    {tag.originalText}
                                </span>
                                <button
                                    type="button"
                                    className="ml-1 px-1 py-0.5 rounded border-none cursor-pointer transition-all duration-200 dark:bg-zinc-700 bg-zinc-200 dark:text-zinc-50 text-zinc-950 hover:scale-110"
                                    onClick={() => confirmInlineTag(tag.id)}
                                    title="Attach URL"
                                >
                                    <Check size={8} />
                                </button>
                                <button
                                    type="button"
                                    className="px-1 py-0.5 rounded text-[10px] border-none cursor-pointer transition-all duration-200 dark:bg-zinc-700 bg-zinc-200 dark:text-zinc-50 text-zinc-950 hover:scale-110"
                                    onClick={() => dismissInlineTag(tag.id)}
                                    title="Dismiss URL"
                                >
                                    <X size={8} />
                                </button>
                            </div>
                        ))}
                </div>  
            </div>
        </div>
    );
};

const renderAttachedUrlTags = () => {
    if (attachedUrls.length === 0) return null;

    const loadedCount = attachedUrls.filter(url => url.status === 'loaded').length;
    const loadingCount = attachedUrls.filter(url => url.status === 'loading').length;
    const errorCount = attachedUrls.filter(url => url.status === 'error').length;

    return (
        <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300"> 
                    {loadingCount > 0 && (
                        <span className="ml-1 text-xs text-yellow-600 dark:text-yellow-400">
                            • {loadingCount} loading
                        </span>
                    )}
                    {errorCount > 0 && (
                        <span className="ml-1 text-xs text-red-600 dark:text-red-400">
                            • {errorCount} failed
                        </span>
                    )}
                </span>
                {attachedUrls.length > 1 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllAttachedUrls}
                        className="h-6 px-2 text-xs text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
                    >
                        <LinkBreak size={12} className="mr-1" /> Clear All
                    </Button>
                )}
            </div>
            
            <div className="flex flex-wrap gap-2">
                {attachedUrls.map((attachedUrl, index) => (
                    <div
                        key={index}
                        className="url-tag flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md text-xs border"
                    >
{attachedUrl.type === 'youtube' ? (
  <YoutubeLogo size={12} className="text-red-500" />
) : (
  (() => {
    const faviconUrl = getFaviconUrl(attachedUrl.url);
    return faviconUrl && !failedFavicons.has(faviconUrl) ? (
      <img 
        src={faviconUrl}
        alt=""
        className="size-4 object-contain mr-1"
        onError={() => handleFaviconError(faviconUrl)}
      />
    ) : (
      <Link size={12} className="text-blue-500" />
    );
  })()
)}
                        
                        {/* URL Status & Content */}
                        <div onClick={() => openContentDialog(attachedUrl)} className="truncate cursor-pointer max-w-[120px]">
                            {attachedUrl.status === 'loading' ? (
                                <span className="flex items-center gap-1">
                                    <SpinnerGap size={12} className="spinner" />
                                    Loading...
                                </span>
                            ) : attachedUrl.status === 'loaded' && attachedUrl.content ? (
                                <span className={`font-medium ${
                                    attachedUrl.type === 'youtube' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                                }`}>
                                    {attachedUrl.content.title}
                                </span>
                            ) : attachedUrl.status === 'error' ? (
                                <span className="text-red-500">Failed</span>
                            ) : (
                                <span className="text-zinc-500">Pending</span>
                            )}
                        </div>
                        
                        {/* Remove Button */}
                        <Button
                            variant="ghost"
                            size="sm"
                             type="button"
                            onClick={() => removeAttachedUrl(attachedUrl.url)}
                            className="size-3 p-0 hover:bg-red-100 dark:hover:bg-red-900/20 ml-1"
                        >
                            <X className="size-3 text-foreground" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const renderContentDialog = () => {
    if (!selectedUrlForViewing || !selectedUrlForViewing.content) return null;

    const content = selectedUrlForViewing.content;

    return (
        <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[85vh] bg-background border border-zinc-200 dark:border-zinc-800 shadow-xl">
                <DialogHeader className="pb-3">
                    <DialogTitle className="flex items-center gap-3 text-base font-medium">
                        <div className="flex-1 min-w-0">
                            <div className="truncate text-foreground">
                                {content.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                {selectedUrlForViewing.url}
                            </div>
                        </div>
                    </DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 overflow-hidden">
                    <div className="h-[calc(85vh-140px)] overflow-y-auto sidebar-scrollbar space-y-3">
                        
                        {/* YouTube Content */}
                        {content.type === 'youtube' && content.youtubeData && (
                            <>
                                {/* Video Player */}
                                <Collapsible defaultOpen className="bg-zinc-50 dark:bg-zinc-900 rounded-[8px] overflow-hidden">
                                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                        <div className="flex items-center gap-2">
                                            YouTube Video
                                        </div>
                                        <CaretDown className="w-4 h-4" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="px-3 pb-3">
                                            <div className="aspect-video w-full rounded-[8px] overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                                                {content.youtubeData.videoId ? (
                                                    <iframe
                                                        width="100%"
                                                        height="100%"
                                                        src={`https://www.youtube.com/embed/${content.youtubeData.videoId}?rel=0&modestbranding=1`}
                                                        frameBorder="0"
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                        title={content.youtubeData.videoTitle}
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full">
                                                        <div className="text-center">
                                                            <YoutubeLogo size={24} className="text-red-500 mx-auto mb-2 opacity-50" />
                                                            <span className="text-muted-foreground text-sm">Video unavailable</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                                
                                {/* Transcript */}
                                <Collapsible className="bg-zinc-50 dark:bg-zinc-900 rounded-[8px] overflow-hidden">
                                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Transcript
                                        </div>
                                        <CaretDown className="w-4 h-4" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="p-3 pt-0">
                                            <div className="max-h-64 overflow-y-auto sidebar-scrollbar p-3">
                                                <pre className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
                                                    {content.youtubeData.transcript}
                                                </pre>
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </>
                        )}

                        {/* Web Content */}
                        {content.type === 'web' && content.data && (
                            <>
                                {/* Page Content */}
                                <Collapsible defaultOpen className="bg-zinc-50 dark:bg-zinc-900 rounded-[8px] overflow-hidden">
                                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Page Content
                                        </div>
                                        <CaretDown className="w-4 h-4" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="p-3 pt-0">
                                            <div className="max-h-64 overflow-y-auto sidebar-scrollbar bg-background rounded-[8px] border border-zinc-200 dark:border-zinc-800">
                                                <div className="p-3 space-y-3">
                                                    {content.data.chunks
                                                        .filter(chunk => chunk.text.trim().length > 20)
                                                        .slice(0, 8)
                                                        .map((chunk, index) => (
                                                            <div 
                                                                key={index} 
                                                                className="text-sm text-foreground leading-relaxed p-3  "
                                                            >
                                                                {chunk.text}
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>

                                {/* Page Links */}
                                <Collapsible className="bg-zinc-50 dark:bg-zinc-900 rounded-[8px] overflow-hidden">
                                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Links • {Math.min(content.data.links?.length || 0, 12)}
                                        </div>
                                        <CaretDown className="w-4 h-4" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="p-3 pt-0">
                                            <div className="max-h-64 overflow-y-auto sidebar-scrollbar bg-background rounded-[8px] border border-zinc-200 dark:border-zinc-800">
                                                {content.data.links && content.data.links.length > 0 ? (
                                                    <div className="p-3 space-y-2">
                                                        {content.data.links
                                                            .filter(link => link.text?.trim() || link.href?.trim())
                                                            .slice(0, 12)
                                                            .map((link, index) => (
                                                                <a
                                                                    key={index}
                                                                    href={link.href}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 p-2 rounded-[8px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
                                                                >
                                                                    <div className="flex-shrink-0">
                                                                        <Link size={18} className="text-yellow-500 group-hover:text-yellow-600" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-sm font-medium text-foreground truncate">
                                                                            {link.text?.trim() || 'Untitled Link'}
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground truncate">
                                                                            {link.href}
                                                                        </div>
                                                                    </div>
                                                                </a>
                                                            ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-6 text-center">
                                                        <LinkBreak size={24} className="text-muted-foreground mx-auto mb-2" />
                                                        <span className="text-muted-foreground text-sm">No links found</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>

                                {/* Screenshot */}
                                <Collapsible className="bg-zinc-50 dark:bg-zinc-900 rounded-[8px] overflow-hidden">
                                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Screenshot
                                        </div>
                                        <CaretDown className="w-4 h-4" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="p-3 pt-0">
                                            <div className="bg-background rounded-[8px] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                                                {content.data.screenshot ? (
                                                    <img
                                                        src={`data:image/png;base64,${content.data.screenshot}`}
                                                        alt="Page screenshot"
                                                        className="w-full h-auto"
                                                    />
                                                ) : (
                                                    <div className="p-6 text-center">
                                                        <Eye size={24} className="text-muted-foreground mx-auto mb-2" />
                                                        <span className="text-muted-foreground text-sm">No screenshot available</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// Helper function to check if user has any content OTHER than input text
const hasAnyOtherContent = () => {
  return pastedItems.length > 0 || 
         uploadedFiles.length > 0 || 
         uploadedImages.length > 0 || 
         attachedUrls.length > 0 ||
         (isTabModeEnabled && selectedTabContents.size > 0) ||
         followupInput.trim(); // ✅ ADD THIS LINE
};

const renderTabModeButton = () => {
  const scrapableTabs = getScrapableTabs();
  const selectedCount = selectedTabIds.length;
  
  return (
    <Popover open={isTabPopoverOpen} onOpenChange={setIsTabPopoverOpen}>
      <PopoverTrigger asChild>
        <button 
          type="button"
          className='text-sm flex flex-row gap-1 items-center cursor-pointer'
        >
          <GlobeSimple className="size-3 opacity-70" />
          <span className='opacity-70'>
            {selectedCount > 0 
              ? `Tagged Tabs ${selectedCount}`
              : 'Tag Tabs'
            }
          </span>
          {loadingTabIds.size > 0 && (
            <SpinnerGap size={12} className="spinner opacity-70" />
          )}
        </button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                Tabs Tagged • {selectedCount}
              </span>
            </div>
            <div className="flex gap-1">
              {selectedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearTabSelection();
                  }}
                  className="h-6 px-2 text-xs"
                >
                  Clear
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsTabModeEnabled(false);
                  setIsTabPopoverOpen(false);
                  clearTabSelection();
                }}
                className="h-6 px-2 text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
        
        <div className="max-h-64 overflow-y-auto">
          {scrapableTabs.length > 0 ? (
            <div className="p-2">
              {scrapableTabs.map((tab) => {
                const isSelected = selectedTabIds.includes(tab.id);
                const isLoading = loadingTabIds.has(tab.id);
                const hasContent = selectedTabContents.has(tab.id);
                
                return (
                  <Button
                    key={tab.id}
                    variant="ghost"
                    size="sm"
                    className={`w-full justify-start p-2 h-auto mb-1 ${
                      isSelected ? 'bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' : ''
                    }`}
                    onClick={() => {
                      toggleTabSelection(tab.id);
                      if (!isTabModeEnabled) {
                        setIsTabModeEnabled(true);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {/* Checkbox */}
                      <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${
                        isSelected 
                          ? 'bg-yellow-500 border-yellow-500' 
                          : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      
                      {/* Tab Icon */}
                      <div className="flex items-center justify-center w-4 h-4 flex-shrink-0">
                        {tab.type === 'tool' ? (
                          tab.icon ? (
                            React.createElement(tab.icon, { className: "w-3 h-3" })
                          ) : (
                            <Cube className="w-3 h-3" />
                          )
                        ) : (
                          <img
                            src={getFaviconUrl(tab.url) || ""}
                            alt=""
                            className="size-6 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent && !parent.querySelector('.fallback-icon')) {
                                const globe = document.createElement('div');
                                globe.className = 'fallback-icon';
                                globe.innerHTML = '<svg class="w-3 h-3" viewBox="0 0 256 256"><path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm12-88a12,12,0,1,1-12-12A12,12,0,0,1,140,128Z"/></svg>';
                                parent.appendChild(globe);
                              }
                            }}
                          />
                        )}
                      </div>
                      
                      {/* Tab Info */}
                      <div className="flex flex-col items-start flex-1 min-w-0">
                        <span className="truncate max-w-full text-sm font-medium">
                          {getDisplayTitle(tab)}
                        </span>
                        {tab.url && (
                          <span className="text-xs text-muted-foreground truncate max-w-full">
                            {tab.url}
                          </span>
                        )}
                      </div>
                      
                      {/* Status Indicators */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isLoading && (
                          <SpinnerGap size={12} className="spinner text-yellow-500" />
                        )}
                        {hasContent && !isLoading && (
                          <Check className="w-3 h-3 text-yellow-500" />
                        )}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center">
              <LinkBreak className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No tabs available</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const [followupMessages, setFollowupMessages] = useState<any[]>([]);
const renderSelectedTabContents = () => {
  if (selectedTabContents.size === 0) return null;

  const contentArray = Array.from(selectedTabContents.entries()).map(([tabId, content]) => {
    const tab = tabs.find(t => t.id === tabId);
    return { tabId, content, tab };
  });

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {loadingTabIds.size > 0 && (
            <span className="ml-1 text-xs text-yellow-600 dark:text-yellow-400">
              • {loadingTabIds.size} loading
            </span>
          )}
        </span>
        {contentArray.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTabSelection}
            className="h-6 px-2 text-xs text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
          >
            <LinkBreak size={12} className="mr-1" /> Clear All
          </Button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {contentArray.map(({ tabId, content, tab }) => (
          <div
            key={tabId}
            className="url-tag flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md text-xs border"
          >
{content.type === 'youtube' ? (
  <YoutubeLogo size={12} className="text-red-500" />
) : (
  (() => {
    const faviconUrl = getFaviconUrl(tab?.url || '');
    return faviconUrl && !failedFavicons.has(faviconUrl) ? (
      <img 
        src={faviconUrl}
        alt=""
        className="size-4 mr-1 object-contain"
        onError={() => handleFaviconError(faviconUrl)}
      />
    ) : (
      <Link size={12} className="text-blue-500" />
    );
  })()
)}
            
            <div 
                          onClick={() => {
                const tempUrl: AttachedUrl = {
                  url: tab?.url || '',
                  type: content.type,
                  status: 'loaded',
                  content: content
                };
                setSelectedUrlForViewing(tempUrl);
                setIsContentDialogOpen(true);
              }}
            className="cursor-pointer truncate max-w-[120px]">
              <span className={`font-medium ${
                content.type === 'youtube' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
              }`}>
                {content.title}
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                setSelectedTabIds(prev => prev.filter(id => id !== tabId));
                setSelectedTabContents(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(tabId);
                  return newMap;
                });
              }}
              className="size-3 p-0 hover:bg-red-100 dark:hover:bg-red-900/20 ml-1"
            >
              <X className="size-3 text-foreground" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

const getFaviconUrl = (url: string) => {
  if (!url || url === DEFAULT_BLANK_URL || url.startsWith('data:text/html')) {
    return null;
  }
  
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
  } catch (error) {
    console.error('Error parsing URL for favicon:', error);
    return null;
  }
};

// Get tabs that can be scraped (have valid URLs)
const getScrapableTabs = () => {
  if (!tabs || tabs.length === 0) {
    return [];
  }
  return tabs.filter(tab => tab && tab.url && isValidUrl(tab.url));
};

// Get display title using titleStore
const getDisplayTitle = (tab: Tab): string => {
  return titleStore.getDisplayTitle(tab);
};

useEffect(() => {
  if (isTabModeEnabled && selectedTabIds.length > 0 && tabs.length > 0) {
    // Only scrape tabs that don't have content yet
    const tabsToScrape = selectedTabIds.filter(tabId => 
      !selectedTabContents.has(tabId)
    );
    
    if (tabsToScrape.length > 0) {
      scrapeMultipleTabContents(tabsToScrape);
    }
  }
}, [selectedTabIds, tabs, isTabModeEnabled]);

useEffect(() => {
  if (!isTabModeEnabled) {
    // Clear multiple tab selection states
    setSelectedTabIds([]);
    setSelectedTabContents(new Map());
    setLoadingTabIds(new Set());
    setIsTabPopoverOpen(false);
  }
}, [isTabModeEnabled]);

const toggleTabSelection = (tabId: string) => {
  setSelectedTabIds(prev => {
    if (prev.includes(tabId)) {
      // Remove tab
      return prev.filter(id => id !== tabId);
    } else {
      // Add tab
      return [...prev, tabId];
    }
  });
};

const clearTabSelection = () => {
  setSelectedTabIds([]);
  setSelectedTabContents(new Map());
  setLoadingTabIds(new Set());
};

const scrapeMultipleTabContents = async (tabIds: string[]) => {
  const validTabs = tabs.filter(tab => 
    tabIds.includes(tab.id) && 
    tab.url && 
    isValidUrl(tab.url)
  );

  // Track which tabs are loading
  setLoadingTabIds(new Set(tabIds));

  for (const tab of validTabs) {
    try {
      const isYoutube = isValidYoutubeUrl(tab.url);
      
      if (isYoutube) {
        // Process YouTube URL
        const response: YoutubeTranscriptResult = await window.electronAPI.youtube.fetchTranscript(tab.url);
        
        if (response.success) {
          const videoId = getYoutubeVideoId(tab.url);
          const content: ActiveContent = {
            type: 'youtube',
            title: response.videoTitle || getDisplayTitle(tab),
            data: null,
            youtubeData: {
              transcript: response.transcript || '',
              videoTitle: response.videoTitle || getDisplayTitle(tab),
              videoId: videoId || ''
            }
          };
          
          setSelectedTabContents(prev => new Map(prev).set(tab.id, content));
        } else {
          // Fallback to web scraping
          const scrapedContent = await scrapeUrl(tab.url);
          if (scrapedContent) {
            const content: ActiveContent = {
              type: 'web',
              title: scrapedContent.title || getDisplayTitle(tab),
              data: scrapedContent
            };
            setSelectedTabContents(prev => new Map(prev).set(tab.id, content));
          }
        }
      } else {
        // Process regular web URL
        const scrapedContent = await scrapeUrl(tab.url);
        if (scrapedContent) {
          const content: ActiveContent = {
            type: 'web',
            title: scrapedContent.title || getDisplayTitle(tab),
            data: scrapedContent
          };
          setSelectedTabContents(prev => new Map(prev).set(tab.id, content));
        }
      }
    } catch (error) {
      console.error(`Error scraping tab ${tab.id}:`, error);
    } finally {
      // Remove from loading set
      setLoadingTabIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(tab.id);
        return newSet;
      });
    }
  }
};

const [isCaptureDialogOpen, setIsCaptureDialogOpen] = useState(false);
const [captureDialogUrl, setCaptureDialogUrl] = useState('');
const [captureDialogTitle, setCaptureDialogTitle] = useState('');

const handleImageCaptured = (imageData: { src: string; name: string }) => {
  const newImage: UploadedImage = {
    id: crypto.randomUUID(),
    src: imageData.src,
    name: imageData.name
  };
  
  setUploadedImages(prev => [...prev, newImage]);
  setIsCaptureDialogOpen(false);
  setCommandOpen(true); // ✅ ADD THIS LINE - Reopen CommandMain
};

const isBlankPage = () => {
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  if (!activeTab || !activeTab.url) return true;
  return activeTab.url === DEFAULT_BLANK_URL || 
         activeTab.url.startsWith('data:text/html');
};

const handleOpenCaptureDialog = () => {
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  
  if (!activeTab || !activeTab.url) {
    console.log('No active tab or URL found');
    return;
  }

  // Don't open for blank pages
  if (activeTab.url === DEFAULT_BLANK_URL || activeTab.url.startsWith('data:text/html')) {
    console.log('Cannot capture blank page');
    return;
  }

  // Ensure URL is properly formatted
  try {
    new URL(activeTab.url); // Validate URL
    setCaptureDialogUrl(activeTab.url);
    setCaptureDialogTitle(getDisplayTitle(activeTab));
    setIsCaptureDialogOpen(true);
    setIsFilePopoverOpen(false);
    setCommandOpen(false); // ✅ ADD THIS LINE - Close CommandMain
  } catch (error) {
    console.error('Invalid URL:', activeTab.url);
  }
};

const [isFilePopoverOpen, setIsFilePopoverOpen] = useState<boolean>(false);

    return (
        <>
        <LoadingStyles />
            <button
                onClick={() => setCommandOpen(true)}
                className="w-full flex-row flex justify-center text-sm items-center p-2 rounded-xl text-background bg-foreground hover:opacity-80 transition-colors duration-200 ease-in-out"
            >
                <MagnifyingGlass className="size-[16px] text-background" />&nbsp;Command&nbsp;<Command className="size-[16px] text-background" />&nbsp;K
            </button>

            <CommandDialog open={isCommandOpen} fullscreen={isFullscreen} onOpenChange={(open) => {
                setCommandOpen(open);
            }}>
                <button 
                    type="button" 
                    onClick={toggleFullscreen}
                    className="absolute right-12 top-4 z-50 rounded-xl opacity-70 hover:opacity-100 focus:outline-none"
                >
                    {isFullscreen ? 
                      <CornersIn className="h-4 w-4" /> : 
                      <CornersOut className="h-4 w-4" />
                    }
                    <span className="sr-only">{isFullscreen ? 'Minimize' : 'Maximize'}</span>
                </button>
                
                <div className='bg-popover rounded-lg'>
                    <form
                        className={cn(isDraggingFile && "drop-zone-active")}
                        onSubmit={handleLocalSubmit}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {isDraggingFile && (
                            <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
                                <div className="flex flex-col items-center justify-center p-4 text-center">
                                    <UploadSimple className="h-8 w-8 mb-2 text-primary" />
                                    <p className="text-primary font-medium">Drop your file.</p>
                                </div>
                            </div>
                        )}
                            <>
                                {transcriptionResult?.error && (
                                    <div className="px-3 py-2 text-sm text-red-500">
                                        Error: {transcriptionResult.error}
                                    </div>
                                )}

{isRecording ? (
    <div className="px-3">
        <div className="flex flex-col space-y-2">
            <div className="flex items-center">
                {/* ✅ UPDATED: Show processing state */}
                {!isTranscribing && !isProcessingRecording && (
                    <Button 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            console.log('Button clicked - isPaused:', isPaused, 'MediaRecorder state:', mediaRecorderRef.current?.state);
                            
                            if (isPaused) {
                                handleResumeRecording();
                            } else {
                                handlePauseRecording();
                            }
                        }}
                        className='p-0 mr-2 flex flex-row items-center cursor-pointer'
                        type="button"
                        disabled={isTranscribing || isProcessingRecording || !mediaRecorderRef.current}
                        variant="ghost"
                    >
                        {isPaused ? 
                            <Play className="h-6 w-6" /> : 
                            <Pause className="h-6 w-6" />
                        }
                    </Button>
                )}
                
                <div className="flex-1 flex flex-col">
                    <div className="flex-grow">
                        <span 
                            className={cn(
                                "flex opacity-50 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
                            )}
                        >
                            {/* ✅ UPDATED: Show different states */}
                            {isProcessingRecording ? (
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                    <span>Processing audio...</span>
                                </div>
                            ) : isTranscribing ? (
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                    <span>Transcribing...</span>
                                </div>
                            ) : (
                                <StableVisualizer audioStream={audioStream} isPaused={isPaused} />
                            )}
                        </span>
                    </div>
                </div>
                
                <div className="flex space-x-2 justify-end">
                    {/* ✅ UPDATED: Show processing/transcribing state */}
                    {isTranscribing || isProcessingRecording ? (
                        <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                            <span className="text-sm text-muted-foreground">
                                {isProcessingRecording ? 'Processing...' : 'Transcribing...'}
                            </span>
                        </div>
                    ) : (
                        <>
                            <Button
                                onClick={handleAudioFileUpload}
                                className="px-3 py-1 text-sm rounded-md cursor-pointer"
                                type="button"
                                disabled={isTranscribing || isProcessingRecording}
                                title="Upload audio file for transcription"
                            >
                                <UploadSimple className="h-5 w-5" />
                            </Button>
                            
                            {/* ✅ UPDATED: Simplified button logic */}
                            {isPaused ? (
                                <Button 
                                    onClick={(e) => {
                                        e.preventDefault(); 
                                        e.stopPropagation(); 
                                        handleStopRecording(); // This will automatically transcribe
                                    }}
                                    className="px-3 py-1 text-sm rounded-md cursor-pointer"
                                    type="button"
                                    disabled={isTranscribing || isProcessingRecording}
                                >
                                    <Check className="h-5 w-5" />
                                </Button>
                            ) : (
                                <Button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handlePauseRecording();
                                    }}
                                    className="px-4 py-1 text-sm rounded-md cursor-pointer"
                                    type="button"
                                    disabled={isTranscribing || isProcessingRecording}
                                >
                                    Continue
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    </div>
)  : (
                                    <div 
                                        className="px-3" 
                                        cmdk-input-wrapper=""
                                        onPaste={handlePaste}
                                    >
                                                   <div className='mt-3 pb-3 flex flex-row gap-2'>
                                <>
    <Popover open={isFilePopoverOpen} onOpenChange={setIsFilePopoverOpen}>
    <PopoverTrigger asChild>
        <button 
            type="button" 
            className='text-sm gap-1 flex flex-row items-center cursor-pointer'
            disabled={isFileConverting}
        >
            {isFileConverting ? (
                <span className='opacity-70'>Loading...</span>
            ) : (
                <>
                    <LinkSimple className="size-4 opacity-70" />
                    <span className='opacity-70'>
                      Attachment
                        {(uploadedFiles.length > 0 || uploadedImages.length > 0) && 
                            ` (${uploadedFiles.length + uploadedImages.length})`
                        }
                    </span>
                </>
            )}
        </button>
    </PopoverTrigger>
    
    <PopoverContent className="w-[150px] p-0" align="start">
        <div className="p-2 space-y-1">
            {/* File Upload Option */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                    handleFileUpload();
                    setIsFilePopoverOpen(false);
                }}
                className="w-full justify-start h-8 px-2"
                disabled={isFileConverting}
            >
                <LinkSimple className="h-4 w-4 mr-2" />
                Upload File
            </Button>
            
            {/* Image Upload Option */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                    handleImageUpload();
                    setIsFilePopoverOpen(false);
                }}
                className="w-full justify-start h-8 px-2"
                disabled={isFileConverting}
            >
                <ImageSquare className="h-4 w-4 mr-2" />
                Upload Image
            </Button>
            
            {/* Capture Web Option */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                    handleOpenCaptureDialog();
                    setIsFilePopoverOpen(false);
                }}
                className={`w-full justify-start h-8 px-2 ${
                    isBlankPage() 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'cursor-pointer'
                }`}
                disabled={isBlankPage()}
            >
                <Camera className={`h-4 w-4 mr-2 ${isBlankPage() ? 'text-muted-foreground' : ''}`} />
                Capture Web
            </Button>
        </div>
    </PopoverContent>
</Popover>
                                    
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault(); 
                                            
                                            if (isRecording) {
                                                handleStopRecording();
                                                cleanupSTTResources();
                                            } else {
                                                handleStartRecording();
                                            }
                                        }}
                                        className='text-sm gap-1 flex opacity-70 flex-row items-center cursor-pointer'
                                    >
                                        {isRecording ? 
                                            <MicrophoneSlash className="size-4" /> : 
                                            <Microphone className="size-4" />
                                        }
                                        Speak
                                    </button>
                                </>
{renderTabModeButton()}
                        </div>
                        <div className='flex flex-row gap-2'>
                                        {renderAttachedUrlTags()}
                                        {renderSelectedTabContents()}
                                        {/* Show uploaded images */}
                                        {uploadedImages.length > 0 && (
                                            <div className="mb-3">
                                                <div className="flex gap-2 overflow-x-auto sidebar-scrollbar">
                                                    {uploadedImages.map((image) => (
                                                        <div 
                                                            key={image.id} 
                                                            className="relative inline-block group flex-shrink-0"
                                                        >
                                                            <div 
                                                                className="rounded-md overflow-hidden border border-border cursor-pointer"
                                                                onClick={() => handleImageClick(image.src, image.name || null)}
                                                            >
                                                                <img 
                                                                    src={image.src} 
                                                                    alt={image.name}
                                                                    className="max-h-32 object-contain" 
                                                                />
                                                            </div>
                                                            
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    removeImage(image.id);
                                                                }}
                                                                className="absolute top-1 right-1 bg-background/80 hover:bg-background rounded-[5px] p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                                aria-label="Remove image"
                                                            >
                                                                <X className="h-4 w-4" weight="bold" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Show uploaded files */}
                                        {uploadedFiles.length > 0 && (
                                            <div className="mb-3 space-y-2">
                                                {uploadedFiles.map((file) => (
                                                    <FileBox 
                                                        key={file.id}
                                                        content={file.content}
                                                        fileInfo={file.fileInfo}
                                                        onRemove={() => removeUploadedFile(file.id)}
                                                        onEdit={() => handleEditFileClick(file.id, file.content, file.fileInfo)}
                                                        allowEdit={true && !(isLoading || isSearching)} 
                                                        isUserMessage={true}  
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {/* Show pasted content */}
                                        {pastedItems.length > 0 && (
                                            <div className="mb-3 space-y-2">
                                                {pastedItems.map((paste) => (
                                                    <PasteBox 
                                                        key={paste.id}
                                                        content={paste.content}
                                                        onRemove={() => removePastedItem(paste.id)}
                                                        onEdit={() => handleEditPasteClick(paste.id, paste.content)}
                                                        allowEdit={true && !(isLoading || isSearching)}
                                                        isUserMessage={true}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        </div>
                                        <div className="flex items-center">
                                          <CommandIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />    
                                            <div className="flex-1 flex flex-col">
                                                <div className="flex-grow">
                                                    {isLoading || isSearching ? (
                                                        <div className="flex items-center justify-between">
                                                            <span className="animate-pulse opacity-70">
                                                                {phrases[currentPhrase]} "{lastSubmittedMessage.length > 30 ? lastSubmittedMessage.substring(0, 30) + '...' : lastSubmittedMessage}"                  
                                                            </span>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm"
                                                                className="text-xs px-2 py-1 hover:bg-destructive/10 hover:text-destructive"
                                                                onClick={() => handleStopGeneration()}
                                                            >
                                                                Stop
                                                            </Button>
                                                        </div>
                                                    ) : (
renderInputWithTags()
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                    </form>
                    
                    {!isRecording && (
                        <CommandList className='sidebar-scrollbar mb-1 mt-1 pt-1 h-auto border-t max-h-[150px]'>
                            <CommandGroup>
                                {/* Submit button for current input */}
                                {(inputText.trim() || pastedItems.length > 0 || uploadedFiles.length > 0 || uploadedImages.length > 0 || attachedUrls.length > 0) && (
                                    <div 
                                        id="nav-item-0"
                                        className={cn(
                                            "relative text-foreground dark:text-background flex cursor-default gap-2 select-none items-center rounded-xl px-2 py-3 text-sm outline-none bg-yellow-200 data-[disabled=true]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 justify-between"
                                        )}
                                    >
                                        <button 
                                            onClick={(e) => {
                                                console.log("Submit button clicked");
                                                e.preventDefault();
                                                handleLocalSubmit(e as unknown as FormEvent);
                                            }} 
                                            disabled={isLoading || isSearching}
                                            className="w-full text-left"
                                        >
                                            <div className="flex items-center gap-2">
                                                {isLoading || isSearching ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="animate-spin">⭮</span>
                                                        <span>Processing...</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {isURL(inputText) && pastedItems.length === 0 && uploadedFiles.length === 0 ? (
                                                            <Globe className="h-4 w-4" />
                                                        ) : (
                                                            <TextT className="h-4 w-4" />
                                                        )}
                                                        <span className="truncate">
                                                            {inputText || 
                                                             (pastedItems.length > 0 ? `${pastedItems.length} pasted item${pastedItems.length > 1 ? 's' : ''}` : '') ||
                                                             (uploadedFiles.length > 0 ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}` : '') ||
                                                             (uploadedImages.length > 0 ? `${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''}` : '')
                                                            }
                                                        </span>
                                                    </>
                                                )}  
                                            </div>
                                        </button>
                                    </div>
                                )}

                                {/* Autocomplete suggestions */}
                                {showAutocomplete && (
                                    <div className="py-2 sidebar-scrollbar">
                                        {isAutocompleteLoading ? (
                                            <div className="px-2 py-1 text-sm text-muted-foreground">
                                                Loading suggestions...
                                            </div>
                                        ) : suggestions.length > 0 ? (
                                            suggestions.map((suggestion, index) => {
                                                const hasContent = inputText.trim() || pastedItems.length > 0 || uploadedFiles.length > 0 || uploadedImages.length > 0;
                                                const itemIndex = hasContent ? index + 1 : index;
                                                
                                                return (
                                                    <button
                                                        id={`nav-item-${itemIndex}`}
                                                        key={index}
                                                        onClick={() => handleSuggestionClick(suggestion.suggestion)}
                                                        className={cn(
                                                            "w-full text-left px-2 py-2 text-sm flex items-center gap-2",
                                                            isItemSelected(itemIndex) 
                                                                ? "bg-zinc-200 text-accent-foreground rounded-lg dark:bg-zinc-800" 
                                                                : "hover:bg-zinc-200 hover:text-accent-foreground dark:hover:bg-zinc-800 rounded-lg"
                                                        )}
                                                    >
                                                        <MagnifyingGlass className="h-4 w-4" />
                                                        {suggestion.suggestion}
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <div className="px-2 py-1 text-sm text-muted-foreground">
                                                No suggestions found
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Tabs List (only show when no input) */}
                                {!showAutocomplete && !inputText.trim() && pastedItems.length === 0 && uploadedFiles.length === 0 && uploadedImages.length === 0 && (
                                    <>
                                        {tabs.map((tab, index) => {
                                            const itemIndex = 1 + index;
                                                const groupName = getTabGroupName(tab.id);
                                            
                                            return (
<button 
    id={`nav-item-${itemIndex}`}
    key={tab.id}
    onClick={() => handleTabSelect(tab.id)}
    className={cn(
        `w-full cursor-pointer relative flex justify-between items-center gap-2 select-none rounded-xl px-2 py-3 text-sm outline-none data-[disabled=true]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0`,
        isItemSelected(itemIndex)
            ? "bg-zinc-200 text-accent-foreground rounded-xl dark:bg-zinc-800"
            : tab.id === activeTabId 
                ? 'bg-zinc-200 text-accent-foreground rounded-xl dark:bg-zinc-800' 
                : 'hover:bg-zinc-200 hover:text-accent-foreground dark:hover:bg-zinc-800 rounded-xl'
    )}
>
    <div className="flex items-center gap-2">
        {tab.isLoading ? (
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        ) : (
            getToolIcon(tab)
        )}
        <span className="truncate">{titleStore.getDisplayTitle(tab)}</span>
    </div>
    {groupName && (
        <span className="text-sm text-muted-foreground opacity-50 flex-shrink-0">
            {groupName}
        </span>
    )}
</button>
                                            );
                                        })}
                                    </>
                                )}
                            </CommandGroup>
                        </CommandList>
                    )}
{hasAssistantMessages() && (
  <div className=''>
    <Collapsible 
      open={!isResponseCollapsed} 
      onOpenChange={(open) => {
        console.log("Collapsible onOpenChange:", open);
        setIsResponseCollapsed(!open);
      }}
      className="w-full"
    >
{/* FIXED: Manual expand button */}
{isResponseCollapsed && (
  <div className="mb-2 w-full flex items-center justify-center">
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Manual expand button clicked");
        setIsResponseCollapsed(false);
      }}
      className="w-full p-3 mx-2 rounded-lg bg-zinc-200 dark:bg-zinc-900 hover:bg-zinc-200/80 dark:hover:bg-zinc-900/80 transition-all duration-200 flex items-center justify-between group border"
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-foreground animate-pulse"></div>
        <span className="text-sm font-medium text-foreground">
          Search: {messages.find(m => m.role === 'user')?.structuredData?.text || messages.find(m => m.role === 'user')?.content || 'Your query'}
        </span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-xs opacity-60 group-hover:opacity-80">
          {messages.filter(m => m.role === 'assistant').length} search{messages.filter(m => m.role === 'assistant').length !== 1 ? 's' : ''}
        </span>
        <ArrowBendRightUp className="h-4 w-4 opacity-60 group-hover:opacity-80 transition-transform group-hover:scale-110" />
      </div>
    </button>
  </div>
)}
      
      <CollapsibleContent>
        <div className="m-2 rounded-lg h-[350px] sidebar-scrollbar bg-zinc-200 dark:bg-zinc-900 shadow-none">
          <div className="flex flex-col w-full h-full sidebar-scrollbar relative overflow-hidden">
{/* IMPROVED: Collapse button when expanded */}
{!isResponseCollapsed && (hasUserStartedTyping || followupMessages.length > 0) && ( // ✅ CHANGE THIS CONDITION
  <div className="sticky top-0 z-10 bg-zinc-200/95 dark:bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-300 dark:border-zinc-700">
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Manual collapse button clicked");
        setIsResponseCollapsed(true);
        if (followupMessages.length > 0) { // ✅ ADD THIS CONDITION
          setIsCollapsedByFollowup(true);
        }
      }}
      className="w-full p-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center justify-center gap-1 hover:bg-zinc-300/50 dark:hover:bg-zinc-800/50"
    >
      <span>Minimize Search</span>
      <X className="h-3 w-3" />
    </button>
  </div>
)}
            
            {/* Existing message rendering */}
            {messages.map((message, index) => (
              <div key={index} className="message-container">
                {message.role === 'user' ? (
                  <div className="flex justify-end relative">
                    <div className="w-full flex flex-row text-md items-center gap-2 font-medium p-2">
                      <div className="flex-grow">
                        {/* Show structured data if available */}
                        {message.structuredData ? (
                          <>
                            {console.log("Rendering structured data:", message.structuredData)}
                            
                            {/* Show uploaded images */}
                            {message.structuredData.uploadedImages && message.structuredData.uploadedImages.length > 0 && (
                              <div className="mb-3">
                                <div className="flex gap-2 overflow-x-auto sidebar-scrollbar">
                                  {message.structuredData.uploadedImages.map((image, imgIdx) => (
                                    <div 
                                      key={imgIdx} 
                                      className="rounded-md flex flex-row overflow-hidden border border-border max-w-xs cursor-pointer"
                                      onClick={() => handleImageClick(image.src, image.name || null)}
                                    >
                                      <img 
                                        src={image.src} 
                                        alt={image.name || `User uploaded image ${imgIdx + 1}`} 
                                        className="h-[50px] object-contain"
                                      />
                                      {image.name && (
                                        <div className="p-2 text-xs text-muted-foreground">
                                          {image.name}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Show uploaded files */}
                            {message.structuredData.uploadedFiles && message.structuredData.uploadedFiles.length > 0 && (
                              <div className="mb-3 space-y-2">
                                {message.structuredData.uploadedFiles.map((file, fileIdx) => (
                                  <FileBox 
                                    key={fileIdx}
                                    content={file.content}
                                    fileInfo={file.fileInfo}
                                    allowEdit={false}
                                    isUserMessage={true}  
                                  />
                                ))}
                              </div>
                            )}

                            {/* Show pasted content */}
                            {message.structuredData.pastedItems && message.structuredData.pastedItems.length > 0 && (
                              <div className="mb-3 space-y-2">
                                {message.structuredData.pastedItems.map((paste, pasteIdx) => (
                                  <PasteBox 
                                    key={pasteIdx}
                                    content={paste.content}
                                    allowEdit={false}
                                    isUserMessage={true}
                                  />
                                ))}
                              </div>
                            )}

                            {message.structuredData.attachedUrls && message.structuredData.attachedUrls.length > 0 && (
                              <div className="mb-3">
                                <div className="flex gap-2 overflow-x-auto sidebar-scrollbar">
                                  {message.structuredData.attachedUrls.map((attachedUrl, urlIdx) => (
                                    <div
                                      key={urlIdx}
                                      className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-md text-sm border flex-shrink-0 min-w-[200px] max-w-[300px]"
                                    >
                                      {attachedUrl.type === 'youtube' ? (
                                        <YoutubeLogo size={12} className="text-red-500" />
                                      ) : (
                                        (() => {
                                          const faviconUrl = getFaviconUrl(attachedUrl.url);
                                          return faviconUrl && !failedFavicons.has(faviconUrl) ? (
                                            <img 
                                              src={faviconUrl}
                                              alt=""
                                              className="size-4 object-contain mr-1"
                                              onError={() => handleFaviconError(faviconUrl)}
                                            />
                                          ) : (
                                            <Link size={12} className="text-blue-500" />
                                          );
                                        })()
                                      )}
                                      
                                      {/* URL Content */}
                                      <div className="flex-1 min-w-0">
                                        <div className={`font-medium truncate ${
                                          attachedUrl.type === 'youtube' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                                        }`}>
                                          {attachedUrl.content.title}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">
                                          {attachedUrl.url}
                                        </div>
                                      </div>
                                      
                                      {/* View Content Button */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const tempUrl: AttachedUrl = {
                                            url: attachedUrl.url,
                                            type: attachedUrl.type,
                                            status: 'loaded',
                                            content: {
                                              type: attachedUrl.content.type,
                                              title: attachedUrl.content.title,
                                              data: attachedUrl.content.data ?? null,
                                              youtubeData: attachedUrl.content.youtubeData
                                            }
                                          };
                                          setSelectedUrlForViewing(tempUrl);
                                          setIsContentDialogOpen(true);
                                        }}
                                        className="h-6 w-6 p-0 flex-shrink-0"
                                      >
                                        <Eye size={12} className="text-foreground" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Show the actual user input text (what they typed) */}
                            {message.structuredData.text && (
                              <div className="whitespace-pre-wrap">{message.structuredData.text}</div>
                            )}
                          </>
                        ) : (
                          /* Fallback to old format for backward compatibility */
                          <>
                            {console.log("No structured data, using fallback for message:", message)}
                            {message.imageData && (
                              <div className="mb-1">
                                <div className="flex gap-2 overflow-x-auto sidebar-scrollbar">
                                  {message.imageData.allImages ? (
                                    message.imageData.allImages.map((img, idx) => (
                                      <div 
                                        key={idx} 
                                        className="rounded-md flex flex-row overflow-hidden border border-border max-w-xs cursor-pointer"
                                        onClick={() => handleImageClick(img.src, img.name)}
                                      >
                                        <img 
                                          src={img.src} 
                                          alt={img.name || `User uploaded image ${idx + 1}`} 
                                          className="h-[50px] object-contain"
                                        />
                                        {img.name && (
                                          <div className="p-2 text-xs text-muted-foreground">
                                            {img.name}
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div 
                                      className="rounded-md flex flex-row overflow-hidden border border-border max-w-xs cursor-pointer"
                                      onClick={() => handleImageClick(
                                        message.imageData?.imageData || "", 
                                        message.imageData?.imageName || null
                                      )}
                                    >
                                      <img 
                                        src={message.imageData.imageData} 
                                        alt={message.imageData.imageName || "User uploaded image"} 
                                        className="h-[50px] object-contain"
                                      />
                                      {message.imageData.imageName && (
                                        <div className="p-2 text-xs text-muted-foreground">
                                          {message.imageData.imageName}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* Show the compiled content for old messages */}
                            <div className="whitespace-pre-wrap font-semibold text-2xl">{message.content}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Assistant message rendering remains the same
                  <ChatMessage 
                    message={message}
                    messageIndex={index}
                    tabId={tabId}
                  />
                )}
              </div>
            ))}  
            {error && (<div>{error}</div>)}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
{hasAssistantMessages() && !hasUserStartedTyping && (
  <div className="rounded-lg h-auto max-h-[250px] border border-border bg-popover shadow-none">
    <FollowupChat 
      tabId={tabId}
      isResponseCollapsed={isResponseCollapsed}
      setIsResponseCollapsed={setIsResponseCollapsed}
      hasUserStartedTyping={hasUserStartedTyping}
      setHasUserStartedTyping={setHasUserStartedTyping}
      hasAssistantMessages={hasAssistantMessages}
      resetTypingState={resetTypingState}
      followupInput={followupInput}
      setFollowupInput={setFollowupInput}
      setIsCollapsedByFollowup={setIsCollapsedByFollowup}
      onFollowupMessagesChange={setFollowupMessages} 
  currentTab={activeTab ? {
    url: activeTab.url,
    title: activeTab.title || activeTab.url || 'Untitled',
    id: activeTab.id
  } : undefined}
    />
  </div>
)}
  </div>
)}
                </div>
            </CommandDialog>
            {renderContentDialog()}
            
            {/* Paste Edit Dialog */}
            <Dialog open={isPasteDialogOpen} onOpenChange={setIsPasteDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Pasted Content</DialogTitle>
                    </DialogHeader>
                    
                    <div className="p-2">
                        <textarea
                            value={editingPasteContent}
                            onChange={(e) => setEditingPasteContent(e.target.value)}
                            onKeyDown={handleEditingPasteKeyDown}
                            className="w-full outline-none bg-inherit p-2 border rounded-md resize-none h-64 font-mono text-sm sidebar-scrollbar"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                            {countLines(editingPasteContent)} lines • {editingPasteContent.length} characters
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleConfirmPasteEdit} type="button">
                            Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* File Edit Dialog */}
            <Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit File Content</DialogTitle>
                    </DialogHeader>
                    
                    <div className="p-2">
                        <textarea
                            value={currentFileContent}
                            onChange={(e) => setCurrentFileContent(e.target.value)}
                            onKeyDown={handleEditingFileKeyDown}
                            className="w-full outline-none bg-inherit p-2 border rounded-md resize-none h-64 font-mono text-sm sidebar-scrollbar"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                            {countLines(currentFileContent)} lines • {currentFileContent.length} characters
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleConfirmFileEdit} type="button">
                            Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Image Preview Dialog */}
            <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
                <DialogContent className="sm:max-w-[40vw] sm:max-h-[50vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{selectedImageName || "Image Preview"}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-auto flex items-center justify-center p-2">
                        {selectedImageSrc && (
                            <img
                                src={selectedImageSrc}
                                alt={selectedImageName || "Image preview"}
                                className="max-w-full max-h-[35vh] object-contain"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            <CaptureWebDialog
    isOpen={isCaptureDialogOpen}
    onClose={() => setIsCaptureDialogOpen(false)}
    title={captureDialogTitle}
    url={captureDialogUrl}
    onImageCaptured={handleImageCaptured}
/>
        </>
    );
}

export default CommandMain;