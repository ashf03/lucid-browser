import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';
import Avvvatars from 'avvvatars-react';
import TextareaAutosize from 'react-textarea-autosize';
import { ArrowElbowRightUp, MagnifyingGlass, Chat, SpinnerGap, YoutubeLogo, Copy, Check, SpeakerHigh, Microphone, MicrophoneSlash, Play, Pause, UploadSimple, ImageSquare, X, Camera } from '@phosphor-icons/react';
import MessageFormatter from '../Containers/MessageFormat';
import { Button } from '../../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';
import FindInWebpage from './FindInWebpage';
import { useView } from '../../components/parts/ViewContext';
import StableVisualizerWeb from '../STT/StableVisualizerWeb';
import { PasteBox } from '../Containers/PasteBox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "../../ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/popover";
import { ImageIcon } from 'lucide-react';
import CaptureFollowupDialog from '../../components/parts/CaptureFollowupDialog';

// Props for the FollowupChat component
interface FollowupChatProps {
  tabId: string;
}

// Enhanced Message interface to match what MessageFormatter expects
interface Message {
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  // Additional properties expected by MessageFormatter
  webResponse?: string;
  structuredData?: {
    text: string;
    pastedItems: PastedItem[];
    uploadedImages: UploadedImage[];
    timestamp: number;
  };
  mapResults?: {
    title: string;
    rating?: number;
    reviews?: number;
    address?: string;
    website?: string;
    mapsUrl?: string;
    hours?: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    gps_coordinates?: {
      latitude: number;
      longitude: number;
    };
  }[];
}

// Interface for messages sent to the API which can include system role
interface ApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Interface specifically for MessageFormatter which doesn't accept system role
interface EnhancedMessage {
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  webResponse?: string;
  mapResults?: {
    title: string;
    rating?: number;
    reviews?: number;
    address?: string;
    website?: string;
    mapsUrl?: string;
    hours?: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    gps_coordinates?: {
      latitude: number;
      longitude: number;
    };
  }[];
}

// Interface for scraped web content
interface ScrapedContent {
  url: string;
  title: string;
  chunks: { text: string; metadata: any }[];
  links: { href: string; text: string }[];
  screenshot: string;
  timestamp: string;
}

// Interface for YouTube transcript results
interface YoutubeTranscriptResult {
  success: boolean;
  videoTitle?: string;
  transcript?: string;
  error?: string;
}

// STT Interfaces
interface TranscriptionOptions {
  language: string;
  tag_audio_events: boolean;
  diarize: boolean;
}

interface TranscriptionResult {
  text: string;
  error?: string;
}

// Pasted content interface
interface PastedItem {
  id: string;
  content: string;
  timestamp: number;
}

// Image upload interface
interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  base64: string;
  timestamp: number;
}

const MainWebChat: React.FC<FollowupChatProps> = ({ tabId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("chat");
  const [lastScrapedUrl, setLastScrapedUrl] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Pasted content state
  const [pastedItems, setPastedItems] = useState<PastedItem[]>([]);
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState<boolean>(false);
  const [activePasteId, setActivePasteId] = useState<string | null>(null);
  const [editingPasteContent, setEditingPasteContent] = useState<string>('');
  
  // Image upload state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // Popover state
  const [isImagePopoverOpen, setIsImagePopoverOpen] = useState(false);
  
  // Web capture state
  const [isCaptureDialogOpen, setIsCaptureDialogOpen] = useState(false);
  const [captureDialogUrl, setCaptureDialogUrl] = useState('');
  const [captureDialogTitle, setCaptureDialogTitle] = useState('');
  
  // TTS states
  const [audioStates, setAudioStates] = useState<{[key: number]: {
    isVisible: boolean;
    isGenerating: boolean;
    audioSrc: string;
  }}>({});
  const audioRefs = useRef<{[key: number]: HTMLAudioElement | null}>({});
  
  // Copy states
  const [copyStates, setCopyStates] = useState<{[key: number]: boolean}>({});
  
  // STT (Speech-to-Text) states
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
  const [isProcessingRecording, setIsProcessingRecording] = useState<boolean>(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  
  // YouTube state
  const [activeYoutubeUrl, setActiveYoutubeUrl] = useState<string>('');
  const [youtubeTranscript, setYoutubeTranscript] = useState<string>('');
  const [youtubeVideoTitle, setYoutubeVideoTitle] = useState<string>('');
  const [isAutoYoutubeMode, setIsAutoYoutubeMode] = useState<boolean>(false);
  
  // Access the ViewContext to get active tab information
  const viewContext = useView();
  
  // Initialize the Claude model with the configuration
  const claudeModel = new ChatAnthropic({
    anthropicApiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    modelName: 'claude-sonnet-4-20250514',
    temperature: 0.7,
  });

  // Helper function to count lines in text
  const countLines = (text: string): number => {
    return text.split('\n').length;
  };

  // Helper function to convert dataURL to Blob
  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  // Web capture handlers
  const handleImageCaptured = (imageData: { src: string; name: string }) => {
    // Convert captured image to the UploadedImage format
    const blob = dataURLtoBlob(imageData.src);
    const file = new File([blob], imageData.name, { type: 'image/png' });
    
    const newImage: UploadedImage = {
      id: crypto.randomUUID(),
      file: file,
      preview: imageData.src,
      base64: imageData.src.split(',')[1], // Remove data:image/png;base64, prefix
      timestamp: Date.now()
    };
    
    setUploadedImages(prev => [...prev, newImage]);
    setIsCaptureDialogOpen(false);
  };

  const isBlankPage = (): boolean => {
    if (!viewContext.activeTab || !viewContext.activeTab.url) return true;
    return viewContext.activeTab.url === 'data:text/html,' || 
           viewContext.activeTab.url.startsWith('data:text/html');
  };

  const handleOpenCaptureDialog = () => {
    if (!viewContext.activeTab || !viewContext.activeTab.url) {
      console.log('No active tab or URL found');
      return;
    }

    // Don't open for blank pages
    if (isBlankPage()) {
      console.log('Cannot capture blank page');
      return;
    }

    // Ensure URL is properly formatted
    try {
      new URL(viewContext.activeTab.url); // Validate URL
      setCaptureDialogUrl(viewContext.activeTab.url);
      setCaptureDialogTitle(viewContext.activeTab.title || 'Web Capture');
      setIsCaptureDialogOpen(true);
      setIsImagePopoverOpen(false); // Close popover when opening capture dialog
    } catch (error) {
      console.error('Invalid URL:', viewContext.activeTab.url);
    }
  };

  // Image upload functions
  const convertImageToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/[format];base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select valid image files only');
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`Image ${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }

      try {
        const base64 = await convertImageToBase64(file);
        const preview = URL.createObjectURL(file);
        
        const newImage: UploadedImage = {
          id: crypto.randomUUID(),
          file,
          preview,
          base64,
          timestamp: Date.now()
        };
        
        setUploadedImages(prev => [...prev, newImage]);
      } catch (error) {
        console.error('Error processing image:', error);
        alert(`Failed to process image ${file.name}`);
      }
    }
    
    // Reset the input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  }, [convertImageToBase64]);

  const removeImage = useCallback((id: string) => {
    setUploadedImages(prev => {
      const imageToRemove = prev.find(img => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return prev.filter(img => img.id !== id);
    });
  }, []);

  const handleImageButtonClick = useCallback(() => {
    imageInputRef.current?.click();
    setIsImagePopoverOpen(false); // Close popover when triggering file input
  }, []);

  // Render the Image/Capture Popover Button
  const renderImageCapturePopover = () => {
    return (
      <Popover open={isImagePopoverOpen} onOpenChange={setIsImagePopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className='p-1 text-sm gap-1 flex opacity-70 flex-row items-center cursor-pointer hover:opacity-100 transition-opacity'
            disabled={isLoading}
            title="Add image or capture"
          >
            <ImageSquare className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex flex-col gap-1">
            <button
              onClick={handleImageButtonClick}
              disabled={isLoading}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
            >
              <UploadSimple className="h-4 w-4" />
              Upload Image
            </button>
            <button
              onClick={handleOpenCaptureDialog}
              disabled={isLoading || isBlankPage()}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors ${
                isBlankPage() ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Camera className="h-4 w-4" />
              Capture Web
            </button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  // Paste handler - similar to FollowupChat
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

  // Remove pasted item
  const removePastedItem = (id: string) => {
    setPastedItems(prev => prev.filter(item => item.id !== id));
  };

  // Edit pasted item  
  const editPastedItem = (id: string, newContent: string) => {
    setPastedItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, content: newContent } : item
      )
    );
  };

  // Handle edit paste click
  const handleEditPasteClick = (id: string, content: string) => {
    setActivePasteId(id);
    setEditingPasteContent(content);
    setIsPasteDialogOpen(true);
  };

  // Handle confirm paste edit
  const handleConfirmPasteEdit = () => {
    if (activePasteId) {
      editPastedItem(activePasteId, editingPasteContent);
      setIsPasteDialogOpen(false);
      setActivePasteId(null);
    }
  };

  // Handle editing paste key down
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

  // Compile submission content (including pasted items and images)
  const compileSubmissionContent = () => {
    const parts: string[] = [];
    
    // Add main text input
    if (input.trim()) {
      parts.push(`${input.trim()}`);
    }
    
    // Add pasted content with clear labels
    pastedItems.forEach((item, index) => {
      parts.push(`PASTED CONTENT ${index + 1}:\n${item.content}`);
    });
    
    // Note: Images will be handled separately in the message structure
    if (uploadedImages.length > 0) {
      parts.push(`[${uploadedImages.length} image(s) attached]`);
    }
    
    const compiled = parts.join('\n\n---\n\n');
    console.log("Compiling web chat content parts:", parts.length, "Total length:", compiled.length);
    return compiled;
  };

  // Handle copy response
  const handleCopyResponse = useCallback(async (messageIndex: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyStates(prev => ({ ...prev, [messageIndex]: true }));
      
      // Reset the copy state after 2 seconds
      setTimeout(() => {
        setCopyStates(prev => ({ ...prev, [messageIndex]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  }, []);

  // Handle TTS for specific message
  const handleTextToSpeech = useCallback(async (messageIndex: number, content: string) => {
    const currentState = audioStates[messageIndex];
    
    // If audio is already visible, just hide it
    if (currentState?.isVisible) {
      setAudioStates(prev => ({
        ...prev,
        [messageIndex]: { ...prev[messageIndex], isVisible: false }
      }));
      return;
    }
    
    setAudioStates(prev => ({
      ...prev,
      [messageIndex]: { ...prev[messageIndex], isGenerating: true }
    }));
    
    try {
      // Extract clean text for TTS
      const textToConvert = content.replace(/\*\*|__|\*|_|```[\s\S]*?```|`[\s\S]*?`|#|>/g, '').substring(0, 5000);
      
      // Call the TTS API
      const result = await window.electronAPI.ipcRenderer.invoke('generate-speech', { 
        text: textToConvert
      });
      
      if (result.success) {
        // Set audio source and show player
        setAudioStates(prev => ({
          ...prev,
          [messageIndex]: {
            isVisible: true,
            isGenerating: false,
            audioSrc: result.dataUrl
          }
        }));
        
        // Use setTimeout to ensure the audio element is ready before playing
        setTimeout(() => {
          const audioRef = audioRefs.current[messageIndex];
          if (audioRef) {
            audioRef.play().catch(e => console.error('Failed to play audio:', e));
          }
        }, 100);
      } else {
        console.error('Failed to generate speech:', result.error);
        setAudioStates(prev => ({
          ...prev,
          [messageIndex]: { ...prev[messageIndex], isGenerating: false }
        }));
      }
    } catch (error) {
      console.error('TTS error:', error);
      setAudioStates(prev => ({
        ...prev,
        [messageIndex]: { ...prev[messageIndex], isGenerating: false }
      }));
    }
  }, [audioStates]);

  // STT Functions - copied from CommandMain
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
      setRecordedFilePath(null);
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
        setIsProcessingRecording(true);
        
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
        
        // Save blob and transcribe in proper sequence
        try {
          const reader = new FileReader();
          reader.onload = async function() {
            try {
              console.log('Saving recorded audio blob...');
              const tempFilePath = await window.electronAPI.ipcRenderer.invoke('save-blob', reader.result);
              setRecordedFilePath(tempFilePath);
              console.log('Audio saved to:', tempFilePath);
              
              // Automatically transcribe after saving
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

  // Separate transcription function
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
        
        const newInputText = input.trim() 
          ? `${input} ${transcriptionText}` 
          : transcriptionText;
        
        setInput(newInputText);
        
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
      setRecordedFilePath(null);
    }
  };

  const handleStopRecording = () => {
    console.log('Stop recording requested');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

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
    setIsProcessingRecording(false);
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
        console.log('Recording resume requested');
      } catch (error) {
        console.error('Error resuming recording:', error);
        setIsPaused(true);
      }
    } else {
      console.warn('Cannot resume: MediaRecorder not in paused state', mediaRecorderRef.current?.state);
    }
  };

  const handleAudioFileUpload = async () => {
    try {
      const filePath = await window.electronAPI.ipcRenderer.invoke('open-audio-file-dialog', {
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] }
        ]
      });
      
      if (filePath) {
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

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      // Clean up uploaded image URLs
      uploadedImages.forEach(img => {
        URL.revokeObjectURL(img.preview);
      });
      cleanupSTTResources();
    };
  }, []);

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

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Check if the URL is a valid YouTube URL whenever the active tab changes
  useEffect(() => {
    if (viewContext.activeTab?.url) {
      const isYouTube = isValidYoutubeUrl(viewContext.activeTab.url);
      
      // If we just switched to a YouTube URL in auto mode and haven't processed it yet
      if (isYouTube && !activeYoutubeUrl) {
        handleAutoYoutubeDetection(viewContext.activeTab.url);
      } else if (!isYouTube && isAutoYoutubeMode) {
        // Reset if we switched away from a YouTube URL
        setIsAutoYoutubeMode(false);
        setActiveYoutubeUrl('');
        setYoutubeTranscript('');
        setYoutubeVideoTitle('');
      }
    }
  }, [viewContext.activeTab?.url]);

  // Check if URL is a valid YouTube URL
  const isValidYoutubeUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return (
        ['youtube.com', 'www.youtube.com', 'youtu.be'].includes(parsedUrl.hostname) &&
        (parsedUrl.pathname.includes('/watch') || parsedUrl.hostname === 'youtu.be')
      );
    } catch (error) {
      return false;
    }
  };

  // Extract YouTube video ID from URL
  const getYoutubeVideoId = (url: string): string | null => {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname === 'youtu.be') {
        return parsedUrl.pathname.slice(1);
      }
      return new URLSearchParams(parsedUrl.search).get('v');
    } catch (error) {
      return null;
    }
  };
  
  // Handle automatic YouTube detection for current page
  const handleAutoYoutubeDetection = async (url: string) => {
    // Don't process if already have this transcript or if not a valid YouTube URL
    if (activeYoutubeUrl === url || !isValidYoutubeUrl(url)) {
      return;
    }
    
    setIsLoading(true);
    
    // Add a system message indicating we're processing the URL
    const loadingMessage: Message = {
      content: `Detecting YouTube video. Loading transcript...`,
      role: 'system',
      timestamp: new Date(),
    };
    
    setMessages([loadingMessage]);
    
    try {
      // Fetch transcript using the window.electronAPI.youtube.fetchTranscript function
      const response: YoutubeTranscriptResult = await window.electronAPI.youtube.fetchTranscript(url);
      
      if (response.success) {
        // Set URL as active now that we have content
        setActiveYoutubeUrl(url);
        setYoutubeTranscript(response.transcript || '');
        setYoutubeVideoTitle(response.videoTitle || 'YouTube Video');
        setIsAutoYoutubeMode(true);
        
        // Update loading message with success information
        const systemMessage: Message = {
          content: `Detected YouTube video: ${response.videoTitle}`,
          role: 'system',
          timestamp: new Date(),
        };
        
        setMessages([systemMessage]);
      } else {
        setMessages([]);
        setIsAutoYoutubeMode(false);
        // Fallback to normal web scraping if we can't get the transcript
        scrapeCurrentPage();
      }
    } catch (error) {
      console.error('Error fetching YouTube transcript:', error);
      setMessages([]);
      setIsAutoYoutubeMode(false);
      // Fallback to normal web scraping if we encounter an error
      scrapeCurrentPage();
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced scrapeCurrentPage function with better error handling and debugging
  const scrapeCurrentPage = async (): Promise<ScrapedContent | null> => {
    if (!viewContext.activeTab || !viewContext.activeTab.url || 
        viewContext.activeTab.url === 'data:text/html,\n<html>\n</html>') {
      console.error('No valid URL to scrape');
      return null;
    }

    // Check if this is a YouTube URL first
    if (isValidYoutubeUrl(viewContext.activeTab.url) && !isAutoYoutubeMode) {
      // Set flag and let the useEffect handle it
      setIsAutoYoutubeMode(true);
      handleAutoYoutubeDetection(viewContext.activeTab.url);
      return null;
    }

    // Don't rescrape the same URL unnecessarily
    if (lastScrapedUrl === viewContext.activeTab.url) {
      console.log('URL already scraped recently, using cached data');
      return null;
    }
    
    try {
      console.log('Scraping URL:', viewContext.activeTab.url);
      
      const response = await window.electronAPI.ipcRenderer.invoke('scrape-url', viewContext.activeTab.url);
      
      if (response.success && response.data) {
        console.log('Scrape successful, got data:', {
          title: response.data.title,
          url: response.data.url,
          chunkCount: response.data.chunks?.length || 0,
          linkCount: response.data.links?.length || 0
        });
        
        setLastScrapedUrl(viewContext.activeTab.url);
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

  // Create system message from YouTube transcript
  const createSystemMessageFromYoutubeTranscript = (title: string, url: string, transcript: string): string => {
    return `You are an AI assistant helping with a YouTube video: ${title} (${url})

The user is currently watching this video and wants to discuss or ask questions about it. Use the following transcript from the video to inform your responses:

TRANSCRIPT:
${transcript}

When responding:
1. Directly reference specific information from the transcript when relevant
2. If the user asks about something not covered in the provided transcript, you can say you don't see that information in the transcript
3. Offer insights about the video content when appropriate
4. Be helpful and conversational

Remember that the user is watching this video right now, so they can see what you're referring to.`;
  };

  // Enhanced system message creation with better content organization
  const createSystemMessageFromScrapedContent = (scrapedContent: ScrapedContent): string => {
    if (!scrapedContent) return '';
    
    // Process page content to extract meaningful text
    // Filter out very short chunks that might just be UI elements
    const contentChunks = scrapedContent.chunks
      .filter(chunk => chunk.text.trim().length > 20) // Skip very short chunks
      .map(chunk => chunk.text.trim());
    
    const contentText = contentChunks.join('\n\n');
    
    // Process links - get up to 15 meaningful links
    const links = scrapedContent.links
      .filter(link => link.text?.trim() || link.href?.trim()) // Filter out empty links
      .slice(0, 15)
      .map(link => `- ${link.text?.trim() || 'Link'}: ${link.href}`)
      .join('\n');
    
    // Create a comprehensive system message
    return `You are an AI assistant helping with the webpage: ${scrapedContent.title} (${scrapedContent.url})

The user is currently viewing this webpage and wants to discuss or ask questions about it. Use the following information from the page to inform your responses.

PAGE CONTENT:
${contentText}

LINKS ON PAGE:
${links}

When responding:
1. Directly reference specific information from the page when relevant
2. If the user asks about something not covered in the provided content, you can say you don't see that information on the current page
3. Offer insights about the page content when appropriate
4. Be helpful and conversational

Remember that the user is looking at this webpage right now, so they can see what you're referring to.`;
  };

  // Render image previews
  const renderImagePreviews = () => {
    if (uploadedImages.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2 p-2 bg-zinc-50 dark:bg-zinc-950 border rounded-lg">
        {uploadedImages.map((image) => (
          <div key={image.id} className="relative group">
            <img
              src={image.preview}
              alt={image.file.name}
              className="w-16 h-16 object-cover rounded-md border-2 border-zinc-200 dark:border-zinc-700"
            />
            <button
              onClick={() => removeImage(image.id)}
              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
              disabled={isLoading}
            >
              <X className="w-3 h-3" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-md truncate opacity-0 group-hover:opacity-100 transition-opacity">
              {image.file.name}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render the main input area content based on recording state
  const renderInputContent = () => {
    if (isRecording) {
      return (
        <div className="flex items-center w-full">
          {/* Play/Pause button */}
          {!isTranscribing && !isProcessingRecording && (
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (isPaused) {
                  handleResumeRecording();
                } else {
                  handlePauseRecording();
                }
              }}
              className='p-2 mr-2 flex flex-row items-center cursor-pointer'
              type="button"
              disabled={isTranscribing || isProcessingRecording || !mediaRecorderRef.current}
              variant="ghost"
              size="sm"
            >
              {isPaused ? 
                <Play className="h-4 w-4" /> : 
                <Pause className="h-4 w-4" />
              }
            </Button>
          )}
          
          {/* Recording visualizer or status */}
          <div className="flex-1 flex items-center justify-center py-2">
            {isProcessingRecording ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm">Processing audio...</span>
              </div>
            ) : isTranscribing ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm">Transcribing...</span>
              </div>
            ) : (
              <div className="w-full flex items-center justify-center">
                <StableVisualizerWeb audioStream={audioStream} isPaused={isPaused} />
              </div>
            )}
          </div>
          
          {/* Recording action buttons */}
          <div className="flex space-x-1">
            {isTranscribing || isProcessingRecording ? (
              <div className="flex items-center px-2">
                <span className="text-xs text-muted-foreground">
                  {isProcessingRecording ? 'Processing...' : 'Transcribing...'}
                </span>
              </div>
            ) : (
              <>
                <Button
                  onClick={handleAudioFileUpload}
                  className="px-2 py-1 text-xs"
                  type="button"
                  disabled={isTranscribing || isProcessingRecording}
                  title="Upload audio file for transcription"
                  variant="ghost"
                  size="sm"
                >
                  <UploadSimple className="h-4 w-4" />
                </Button>
                
                {isPaused ? (
                  <Button 
                    onClick={(e) => {
                      e.preventDefault(); 
                      e.stopPropagation(); 
                      handleStopRecording();
                    }}
                    className="px-2 py-1 text-xs"
                    type="button"
                    disabled={isTranscribing || isProcessingRecording}
                    variant="ghost"
                    size="sm"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePauseRecording();
                    }}
                    className="px-2 py-1 text-xs"
                    type="button"
                    disabled={isTranscribing || isProcessingRecording}
                    variant="ghost"
                    size="sm"
                  >
                    Pause
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      );
    } else {
      // Normal textarea mode
      return (
        <TextareaAutosize
          ref={textareaRef}
          className="sidebar-scrollbar flex items-center resize-none border-none justify-center overflow-y-auto w-full rounded-md bg-transparent text-sm outline-none border border-input px-3 placeholder:text-muted-foreground"
          placeholder={isAutoYoutubeMode ? "Ask about this YouTube video..." : "Talk to your webpage..."} 
          spellCheck={true}
          minRows={1}
          maxRows={10}
          onKeyDown={(e) => {
            // Check for escape to close paste dialog
            if (e.key === 'Escape') {
              if (isPasteDialogOpen) {
                setIsPasteDialogOpen(false);
                setActivePasteId(null);
                return;
              }
            }
            
            // Allow Enter key to create a new line
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
            // If Shift+Enter, let the default behavior happen (new line)
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
      );
    }
  };

  // Check if there's any content to send
  const hasAnyContent = () => {
    return input.trim() || pastedItems.length > 0 || uploadedImages.length > 0;
  };

  // Fixed handleSendMessage function with YouTube transcript support, pasted content, and images
  const handleSendMessage = async () => {
    const hasContent = hasAnyContent();
    if (!hasContent) return;
    
    // Compile the content including pasted items
    const compiledContent = compileSubmissionContent();
    
    // Create structured data to preserve UI (always include for user messages)
    const structuredData = {
      text: input.trim(),
      pastedItems: [...pastedItems], // Copy the current pasted items
      uploadedImages: [...uploadedImages], // Copy the current uploaded images
      timestamp: Date.now()
    };
    
    // Add user message to the chat with structured data
    const userMessage: any = {
      content: compiledContent,
      role: 'user',
      timestamp: new Date(),
      structuredData: structuredData
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');
    setPastedItems([]); // Clear pasted items after sending
    setUploadedImages([]); // Clear uploaded images after sending
    setIsLoading(true);
    
    try {
      // Create message history array for the API call
      const messageHistory: ApiMessage[] = [];
      
      // If in YouTube mode, add transcript as system message
      if (isAutoYoutubeMode && activeYoutubeUrl && youtubeTranscript) {
        // Add a processing message
        const processingMessage: Message = {
          content: `Processing your question about the YouTube video...`,
          role: 'system',
          timestamp: new Date(),
        };
        
        setMessages(prevMessages => [...prevMessages, processingMessage]);
        
        const systemMessage = createSystemMessageFromYoutubeTranscript(
          youtubeVideoTitle,
          activeYoutubeUrl,
          youtubeTranscript
        );
        
        // Add the system message to the API conversation
        messageHistory.push({
          role: 'system',
          content: systemMessage
        });
        
        console.log('Added system message with YouTube transcript');
      } else {
        // Add a processing message
        const processingMessage: Message = {
          content: `Processing your question...`,
          role: 'system',
          timestamp: new Date(),
        };
        
        setMessages(prevMessages => [...prevMessages, processingMessage]);
        
        // First scrape the current page content
        const scrapedContent = await scrapeCurrentPage();
        
        // If we have scraped content, add it as a system message
        if (scrapedContent) {
          const systemMessage = createSystemMessageFromScrapedContent(scrapedContent);
          
          // Add the system message to the API conversation
          messageHistory.push({
            role: 'system',
            content: systemMessage
          });
          
          console.log('Added system message with scraped content');
        } else {
          console.log('No scraped content available');
        }
      }
      
      // Add previous conversation messages (excluding system UI messages)
      messages.forEach(msg => {
        if (msg.role !== 'system') {  
          messageHistory.push({
            role: msg.role,
            content: msg.content
          });
        }
      });
      
      // Prepare the new user message for Claude
      let claudeMessage: any;
      let response;
      
      if (uploadedImages.length > 0) {
        // Create a HumanMessage with images
        const messageContent: any[] = [];
        
        // Add text content if present
        if (input.trim() || pastedItems.length > 0) {
          messageContent.push({
            type: 'text',
            text: compiledContent
          });
        }
        
        // Add images
        uploadedImages.forEach(image => {
          messageContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${image.file.type};base64,${image.base64}`
            }
          });
        });
        
        claudeMessage = new HumanMessage({ content: messageContent });
        
        // For image messages, we need to use the model differently
        const messages = messageHistory.slice(1).map((msg) => ({ // Skip system message for image calls
          type: msg.role,
          content: msg.content,
        }));
        messages.push(claudeMessage);
        response = await claudeModel.invoke([claudeMessage]); // Send the image message directly
      } else {
        // Text-only message
        messageHistory.push({
          role: 'user',
          content: compiledContent
        });
        
        console.log('Sending to Claude:', messageHistory); 
        
        // Get response from Claude with conversation history 
        response = await claudeModel.invoke(
          messageHistory.map((msg) => ({
            type: msg.role, // This is the correct format for LangChain's Anthropic client
            content: msg.content,
          }))
        );
      }
      
      // Remove any system processing messages
      setMessages(prevMessages => {
        // Filter out processing messages
        const filteredMessages = prevMessages.filter(msg => 
          !(msg.role === 'system' && (
            msg.content === 'Processing your question...' ||
            msg.content === 'Processing your question about the YouTube video...'
          ))
        );
        
        return [
          ...filteredMessages,
          {
            content: response.content as string,
            role: 'assistant',
            timestamp: new Date(),
          }
        ];
      });
    } catch (error) {
      console.error('Error getting response from Claude:', error);
      
      // Remove processing message and add error message
      setMessages(prevMessages => {
        // Filter out processing messages
        const filteredMessages = prevMessages.filter(msg => 
          !(msg.role === 'system' && (
            msg.content === 'Processing your question...' ||
            msg.content === 'Processing your question about the YouTube video...'
          ))
        );
        
        return [
          ...filteredMessages,
          {
            content: 'Sorry, I encountered an error processing your request.',
            role: 'assistant',
            timestamp: new Date(),
          }
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-[350px] h-auto max-h-[250px]">
      
      {/* Show uploaded images */}
      {renderImagePreviews()}
      
      {/* Show pasted content above messages */}
      {pastedItems.length > 0 && (
        <div className="p-2 space-y-2 max-h-[100px] overflow-y-auto sidebar-scrollbar">
          {pastedItems.map((paste) => (
            <PasteBox 
              key={paste.id}
              content={paste.content}
              onRemove={() => removePastedItem(paste.id)}
              onEdit={() => handleEditPasteClick(paste.id, paste.content)}
              allowEdit={true && !isLoading}
              isUserMessage={true}
            />
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto p-2 sidebar-scrollbar rounded-lg">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className="mb-1 flex items-start"
            >
              {/* Message container */}
              <div className="w-full">
                <div 
                  className={`w-auto font-medium flex flex-row gap-2 justify-center items-start rounded-lg ${
                    message.role === 'user' 
                      ? 'text-zinc-950 dark:text-zinc-50' 
                      : 'text-zinc-950 dark:text-zinc-50'
                  }`}
                > 
                  {/* Render user messages as plain text, assistant messages with MessageFormatter */}
                  {message.role === 'user' ? (
                    <div className="text-[20px] whitespace-pre-wrap flex flex-row justify-center items-center gap-2 w-full">
                      {message.role === 'user' && (
                        <Avvvatars 
                          value="Q" 
                          style="shape"
                          size={21}
                        />
                      )}
                      <div className="flex-1">
                        {/* Show structured data if available */}
                        {message.structuredData ? (
                          <>
                            {/* Show uploaded images */}
                            {message.structuredData.uploadedImages && message.structuredData.uploadedImages.length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {message.structuredData.uploadedImages.map((image: UploadedImage, imgIdx: number) => (
                                  <div key={imgIdx} className="relative">
                                    <img
                                      src={image.preview}
                                      alt={image.file.name}
                                      className="w-20 h-20 object-cover rounded-md border-2 border-zinc-300 dark:border-zinc-600"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-md truncate">
                                      {image.file.name}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Show pasted content */}
                            {message.structuredData.pastedItems && message.structuredData.pastedItems.length > 0 && (
                              <div className="mb-3 space-y-2">
                                {message.structuredData.pastedItems.map((paste: PastedItem, pasteIdx: number) => (
                                  <PasteBox 
                                    key={pasteIdx}
                                    content={paste.content}
                                    allowEdit={false}
                                    isUserMessage={true}
                                  />
                                ))}
                              </div>
                            )}

                            {/* Show the actual user input text (what they typed) */}
                            {message.structuredData.text && (
                              <div className="whitespace-pre-wrap">{message.structuredData.text}</div>
                            )}
                          </>
                        ) : (
                          /* Fallback to old format for backward compatibility */
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        )}
                      </div>
                    </div>
                  ) : message.role === 'system' ? (
                    <div className="text-[16px] italic text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                      {message.content.includes('Loading') || 
                       message.content.includes('Processing') || 
                       message.content.includes('Detecting') ? (
                        <div className="flex items-center gap-2">
                          <SpinnerGap size={16} className="animate-spin text-foreground" />
                          <span>{message.content}</span>
                        </div>
                      ) : message.content.includes('Detected') ? (
                        <div className="flex items-center gap-2">
                          <span>{message.content}</span>
                        </div>
                      ) : (
                        <span>{message.content}</span>
                      )}
                    </div>
                  ) : (
                    <div className="w-full">
                      <MessageFormatter message={message as EnhancedMessage} messageIndex={index} />
                    </div>
                  )}
                </div>
                
                {/* Action buttons for assistant messages */}
                {message.role === 'assistant' && (
                  <div className="-mt-2 flex gap-2">
                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopyResponse(index, message.content)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                    >
                      {copyStates[index] ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    
                    {/* TTS Button and Audio Player */}
                    {audioStates[index]?.isVisible && audioStates[index]?.audioSrc ? (
                      <audio 
                        ref={(el) => { audioRefs.current[index] = el; }}
                        src={audioStates[index].audioSrc} 
                        className="h-8" 
                        controls
                        autoPlay 
                        onEnded={() => setAudioStates(prev => ({
                          ...prev,
                          [index]: { ...prev[index], isVisible: false }
                        }))}
                        onError={() => {
                          console.error('Audio playback error');
                          setAudioStates(prev => ({
                            ...prev,
                            [index]: { ...prev[index], isVisible: false }
                          }));
                        }}
                      />
                    ) : (
                      <button 
                        onClick={() => handleTextToSpeech(index, message.content)}
                        disabled={audioStates[index]?.isGenerating}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
                      >
                        {audioStates[index]?.isGenerating ? (
                          <>
                            <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full"></div>
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <SpeakerHigh className="h-3 w-3" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className='flex flex-row gap-2'> 
        <div className='flex flex-col'>
          <Tabs 
            defaultValue="chat" 
            onValueChange={setActiveTab} 
            className="w-auto"
          >
            <TabsList 
              className="flex flex-col gap-1 h-auto bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg"
            >
              <TabsTrigger 
                value="finding" 
                className="size-6 p-0 data-[state=active]:bg-zinc-300 dark:data-[state=active]:bg-zinc-700"
              >
                <MagnifyingGlass size={15} weight={activeTab === "finding" ? "fill" : "regular"} />
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="size-6 p-0 data-[state=active]:bg-zinc-300 dark:data-[state=active]:bg-zinc-700"
              >
                <Chat size={15} weight={activeTab === "chat" ? "fill" : "regular"} />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>    
      {activeTab === "chat" ? (
        <div 
          className={`flex items-center rounded-lg bg-zinc-200 dark:bg-zinc-800 flex-1 transition-all duration-200 ${
            isRecording ? 'min-h-[60px]' : ''
          }`}
          onPaste={handlePaste}
        >
          {/* Hidden file input for images */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
          
          {/* Microphone button */}
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
            className={`p-1 text-sm gap-1 flex opacity-70 flex-row items-center cursor-pointer hover:opacity-100 transition-all duration-200 ${
              isRecording ? 'text-red-500' : ''
            }`}
            disabled={isTranscribing || isProcessingRecording || isLoading}
          >
            {isRecording ? 
              <MicrophoneSlash className="size-4" /> : 
              <Microphone className="size-4" />
            }
          </button>
          
          {/* Image/Capture Popover Button (only show when not recording) */}
          {!isRecording && renderImageCapturePopover()}
          
          {/* Dynamic content area */}
          <div className="flex-1 min-h-[40px] flex items-center">
            {renderInputContent()}
          </div>
          
          {/* Send button (only show when not recording) */}
          {!isRecording && (
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !hasAnyContent()}
              className="rounded-r-lg text-sm bg-zinc-300 dark:bg-zinc-950 text-foreground font-medium focus:outline-none disabled:opacity-50"
            >
              {isLoading ? (
                <div className="flex items-center gap-1">
                  <SpinnerGap size={16} className="animate-spin" />
                  <span>...</span>
                </div>
              ) : (
                <>
                  Ask <ArrowElbowRightUp size={18} />
                </>
              )}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center p-3 rounded-lg bg-zinc-200 dark:bg-zinc-800 w-full">
          <FindInWebpage />
        </div>
      )}
      </div>
      
      {/* Show transcription errors */}
      {transcriptionResult?.error && (
        <div className="mt-1 px-3 py-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg">
          Error: {transcriptionResult.error}
        </div>
      )}

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

      {/* Web Capture Dialog */}
      <CaptureFollowupDialog
        isOpen={isCaptureDialogOpen}
        onClose={() => setIsCaptureDialogOpen(false)}
        title={captureDialogTitle}
        url={captureDialogUrl}
        onImageCaptured={handleImageCaptured}
      />
    </div>
  );
};

export default MainWebChat;