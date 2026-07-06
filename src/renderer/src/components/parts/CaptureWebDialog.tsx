import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Square, Check, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Screenshot {
  id: string;
  url: string;
  title: string;
  dataUrl: string;
}

interface SelectionArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Extend HTMLElement to include webview properties
interface WebViewElement extends HTMLElement {
  src: string;
  getURL: () => string;
  getTitle: () => string;
  capturePage: () => Promise<any>;
  addEventListener: (event: string, callback: (e: any) => void) => void;
  removeEventListener: (event: string, callback: (e: any) => void) => void;
}

interface CaptureWebDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
  onImageCaptured: (imageData: { src: string; name: string }) => void;
}

const CaptureWebDialog: React.FC<CaptureWebDialogProps> = ({
  isOpen,
  onClose,
  title,
  url,
  onImageCaptured
}) => {
  const [size] = useState({ width: 1000, height: 700 });
  
  const [currentUrl, setCurrentUrl] = useState(url);
  const webviewRef = useRef<WebViewElement>(null);

  // Screenshot state
  const [latestScreenshot, setLatestScreenshot] = useState<Screenshot | null>(null);
  const [showScreenshotPopup, setShowScreenshotPopup] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<SelectionArea | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Update current URL when prop changes
  useEffect(() => {
    setCurrentUrl(url);
  }, [url]);

  const handleClose = () => {
    setLatestScreenshot(null);
    setShowScreenshotPopup(false);
    setSelection(null);
    setSelectionMode(false);
    onClose();
  };

  const handleConfirmCapture = () => {
    if (!latestScreenshot) return;
    
    // Create image data for CommandMain
    const imageData = {
      src: latestScreenshot.dataUrl,
      name: `${latestScreenshot.title} - Screenshot.png`
    };
    
    // Call the callback to add image to CommandMain
    onImageCaptured(imageData);
    
    // Close the dialog
    handleClose();
  };

  // Screenshot functionality
  const captureScreenshot = useCallback(async () => {
    const webview = webviewRef.current;
    if (!webview) return;
    
    setIsCapturing(true);
    
    try {
      const fullImage = await webview.capturePage();
      let finalImage = fullImage;
      
      // If we have a selection, crop the image
      if (selection && containerRef.current) {
        const webviewRect = webview.getBoundingClientRect();
        
        // Calculate the actual position relative to webview content
        const scaleX = fullImage.getSize().width / webviewRect.width;
        const scaleY = fullImage.getSize().height / webviewRect.height;
        
        const cropArea = {
          x: Math.round(selection.x * scaleX),
          y: Math.round(selection.y * scaleY),
          width: Math.round(selection.width * scaleX),
          height: Math.round(selection.height * scaleY)
        };
        
        finalImage = fullImage.crop(cropArea);
      }
      
      const dataUrl = finalImage.toDataURL();
      
      const newScreenshot: Screenshot = {
        id: Date.now().toString(),
        url: webview.getURL(),
        title: webview.getTitle() || 'Screenshot',
        dataUrl
      };
      
      setLatestScreenshot(newScreenshot);
      setShowScreenshotPopup(true);
      
      // Clear selection after capture
      setSelection(null);
      setSelectionMode(false);
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [selection]);

  // Selection area handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!selectionMode || !containerRef.current) return;
    
    e.stopPropagation();
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setStartPos({ x, y });
    setIsSelecting(true);
    setSelection({ x, y, width: 0, height: 0 });
  }, [selectionMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !startPos || !containerRef.current) return;
    
    e.stopPropagation();
    
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const x = Math.min(startPos.x, currentX);
    const y = Math.min(startPos.y, currentY);
    const width = Math.abs(currentX - startPos.x);
    const height = Math.abs(currentY - startPos.y);
    
    setSelection({ x, y, width, height });
  }, [isSelecting, startPos]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isSelecting) {
      e.stopPropagation();
      setIsSelecting(false);
      setStartPos(null);
    }
  }, [isSelecting]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => !prev);
    setSelection(null);
    setIsSelecting(false);
    setStartPos(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setSelectionMode(false);
  }, []);

  const downloadScreenshot = useCallback(() => {
    if (!latestScreenshot) return;
    
    const link = document.createElement('a');
    link.href = latestScreenshot.dataUrl;
    link.download = `screenshot-${latestScreenshot.id}.png`;
    link.click();
  }, [latestScreenshot]);

  const updateUrlDisplay = () => {
    if (webviewRef.current) {
      const url = webviewRef.current.getURL();
      setCurrentUrl(url);
    }
  };

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !isOpen) return;

    const handleDidFinishLoad = () => {
      updateUrlDisplay();
    };

    const handleDidFailLoad = (event: any) => {
      console.error('Load failed:', event);
    };

    webview.addEventListener('did-finish-load', handleDidFinishLoad);
    webview.addEventListener('did-fail-load', handleDidFailLoad);

    return () => {
      webview.removeEventListener('did-finish-load', handleDidFinishLoad);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelecting) {
        setIsSelecting(false);
        setStartPos(null);
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isSelecting]);

  if (!isOpen) return null;

  return (
    <>
      {/* Main Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          style={{
            width: size.width,
            height: size.height,
            maxWidth: '100vw',
            maxHeight: '100vh',
          }}
          className="bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-700 pointer-events-auto overflow-hidden rounded-[10px] transition-shadow duration-200"
        >
          <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 select-none">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="size-6 flex items-center justify-center">
                {currentUrl && !currentUrl.startsWith('data:text/html') && (
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${new URL(currentUrl).hostname}&sz=32`}
                    alt=""
                    className="size-6 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>
              <h2 className="text-sm font-medium truncate text-foreground">
                {title}
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectionMode}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-[8px] transition-colors duration-200 ${
                  selectionMode 
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-foreground'
                }`}
                title={selectionMode ? "Exit Area Selection" : "Select Screenshot Area"}
              >
                <Square className="w-3 h-3" />
                {selectionMode ? 'Exit Area' : 'Area'}
              </button>

              {selection && (
                <button
                  onClick={clearSelection}
                  className="px-2 py-1.5 bg-zinc-500 hover:bg-zinc-600 text-white text-xs rounded-[8px] transition-colors duration-200"
                  title="Clear Selection"
                >
                  Clear
                </button>
              )}

              <button
                onClick={captureScreenshot}
                disabled={isCapturing}
                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-800 disabled:bg-zinc-400 text-white text-xs rounded-[8px] transition-colors duration-200"
                title={selection ? "Capture Selection" : "Capture Full Screenshot"}
              >
                <Camera className="w-3 h-3" />
                {isCapturing ? 'Capturing...' : (selection ? 'Capture Area' : 'Screenshot')}
              </button>
              
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-600 rounded-[8px] transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="w-full h-full" style={{ height: 'calc(100% - 64px)' }}>
            <div className="w-full h-full relative bg-white">
              <div 
                ref={containerRef}
                className="w-full h-full relative"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                <webview
                  ref={webviewRef as any}
                  src={currentUrl}
                  className="w-full h-full"
                  title={title}
                  partition="persist:main"
                />
                
                {/* Screenshot Selection Overlay */}
                {selectionMode && (
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{ 
                      cursor: isSelecting ? 'crosshair' : selectionMode ? 'crosshair' : 'default',
                      pointerEvents: selectionMode ? 'all' : 'none'
                    }}
                  >
                    <div className="absolute inset-0 bg-black bg-opacity-30" />
                    
                    {selection && selection.width > 0 && selection.height > 0 && (
                      <>
                        <div
                          className="absolute bg-transparent"
                          style={{
                            left: selection.x,
                            top: selection.y,
                            width: selection.width,
                            height: selection.height,
                            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)',
                          }}
                        />
                        <div
                          className="absolute border-2 border-yellow-500 border-dashed"
                          style={{
                            left: selection.x,
                            top: selection.y,
                            width: selection.width,
                            height: selection.height,
                          }}
                        />
                        <div
                          className="absolute bg-yellow-500 text-white text-xs px-2 py-1 rounded-[4px]"
                          style={{
                            left: selection.x,
                            top: Math.max(0, selection.y - 25),
                          }}
                        >
                          {Math.round(selection.width)} × {Math.round(selection.height)}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Screenshot Capture Indicator */}
              {isCapturing && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center pointer-events-none z-50">
                  <div className="text-center">
                    <Camera className="w-8 h-8 text-zinc-600 mx-auto mb-2 animate-pulse" />
                    <p className="text-sm text-zinc-600">Capturing screenshot...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Screenshot Confirmation Popup */}
      <AnimatePresence>
        {showScreenshotPopup && latestScreenshot && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-[10px] shadow-2xl border border-zinc-200 dark:border-zinc-700 pointer-events-auto max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Popup header */}
              <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-6 h-6 flex items-center justify-center">
                    {latestScreenshot.url && !latestScreenshot.url.startsWith('data:text/html') && (
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${new URL(latestScreenshot.url).hostname}&sz=32`}
                        alt=""
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {latestScreenshot.title}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                      {latestScreenshot.url}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowScreenshotPopup(false)}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-[8px] transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Screenshot image */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 flex-1 overflow-auto">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-[8px] overflow-hidden">
                  <img
                    src={latestScreenshot.dataUrl}
                    alt={latestScreenshot.title}
                    className="w-full h-auto max-h-[60vh] object-contain"
                  />
                </div>
              </div>

              {/* Action tabs */}
              <div className="border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                <div className="flex">
                  <button
                    onClick={downloadScreenshot}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-200 border-r border-zinc-200 dark:border-zinc-700"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  
                  <button
                    onClick={handleConfirmCapture}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-zinc-700 hover:bg-zinc-800 text-white transition-colors duration-200"
                  >
                    <Check className="w-4 h-4" />
                    Add to Message
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CaptureWebDialog;