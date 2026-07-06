import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Square, Check, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader } from '../../ui/dialog';

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

interface CaptureFollowupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
  onImageCaptured: (imageData: { src: string; name: string }) => void;
}

const CaptureFollowupDialog: React.FC<CaptureFollowupDialogProps> = ({
  isOpen,
  onClose,
  title,
  url,
  onImageCaptured
}) => {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [currentTitle, setCurrentTitle] = useState(title);
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
    setCurrentTitle(title);
  }, [url, title]);

  const handleClose = () => {
    setLatestScreenshot(null);
    setShowScreenshotPopup(false);
    setSelection(null);
    setSelectionMode(false);
    setIsCapturing(false);
    setIsSelecting(false);
    setStartPos(null);
    onClose();
  };

  const handleConfirmCapture = () => {
    if (!latestScreenshot) return;
    
    // Create image data for FollowupChat
    const imageData = {
      src: latestScreenshot.dataUrl,
      name: `${latestScreenshot.title} - Screenshot.png`
    };
    
    // Call the callback to add image to FollowupChat
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
        title: webview.getTitle() || currentTitle || 'Screenshot',
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
  }, [selection, currentTitle]);

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
      const newUrl = webviewRef.current.getURL();
      const newTitle = webviewRef.current.getTitle();
      setCurrentUrl(newUrl);
      setCurrentTitle(newTitle || title);
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
  }, [isOpen, title]);

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

  const getFaviconUrl = (url: string) => {
    try {
      if (!url || url.startsWith('data:text/html')) return null;
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  return (
    <>
      {/* Main Dialog with proper sizing */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl w-[90vw] h-[60vh] p-0 flex flex-col">
          {/* Header - Fixed height */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                {getFaviconUrl(currentUrl) && (
                  <img
                    src={getFaviconUrl(currentUrl)!}
                    alt=""
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold truncate text-foreground">
                  {currentTitle || 'Web Page'}
                </h2>
                <p className="text-xs text-muted-foreground truncate">
                  {currentUrl}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={toggleSelectionMode}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                  selectionMode 
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm' 
                    : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                }`}
                title={selectionMode ? "Exit Area Selection" : "Select Screenshot Area"}
                disabled={isCapturing}
              >
                <Square className="w-4 h-4" />
                {selectionMode ? 'Exit Selection' : 'Select Area'}
              </button>

              {selection && (
                <button
                  onClick={clearSelection}
                  className="px-3 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm rounded-md transition-colors duration-200"
                  title="Clear Selection"
                  disabled={isCapturing}
                >
                  Clear
                </button>
              )}

              <button
                onClick={captureScreenshot}
                disabled={isCapturing}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground text-sm rounded-md transition-colors duration-200 shadow-sm"
                title={selection ? "Capture Selection" : "Capture Full Screenshot"}
              >
                <Camera className="w-4 h-4" />
                {isCapturing ? 'Capturing...' : (selection ? 'Capture Area' : 'Screenshot')}
              </button>
            </div>
          </div>

          {/* Content - Takes remaining height */}
          <div className="flex-1 min-h-0 relative bg-background">
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
                title={currentTitle}
                partition="persist:main"
                style={{ width: '100%', height: '100%' }}
              />
              
              {/* Screenshot Selection Overlay */}
              {selectionMode && (
                <div 
                  className="absolute inset-0 z-10"
                  style={{ 
                    cursor: selectionMode ? 'crosshair' : 'default',
                    pointerEvents: selectionMode ? 'all' : 'none'
                  }}
                >
                  <div className="absolute inset-0 bg-black/30" />
                  
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
                        className="absolute border-2 border-yellow-400 border-dashed bg-yellow-400/10"
                        style={{
                          left: selection.x,
                          top: selection.y,
                          width: selection.width,
                          height: selection.height,
                        }}
                      />
                      <div
                        className="absolute bg-yellow-500 text-white text-xs px-2 py-1 rounded-md shadow-lg"
                        style={{
                          left: selection.x,
                          top: Math.max(0, selection.y - 30),
                        }}
                      >
                        {Math.round(selection.width)} × {Math.round(selection.height)}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Screenshot Capture Indicator */}
              {isCapturing && (
                <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50">
                  <div className="text-center bg-card p-6 rounded-lg shadow-lg border">
                    <Camera className="w-12 h-12 text-primary mx-auto mb-3 animate-pulse" />
                    <p className="text-lg font-medium text-foreground">Capturing screenshot...</p>
                    <p className="text-sm text-muted-foreground mt-1">Please wait</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Screenshot Confirmation Popup - Better sized */}
      <Dialog open={showScreenshotPopup} onOpenChange={setShowScreenshotPopup}>
        <DialogContent className="max-w-3xl w-[85vw] max-h-[85vh] p-0 flex flex-col">
          {/* Popup header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                {latestScreenshot?.url && getFaviconUrl(latestScreenshot.url) && (
                  <img
                    src={getFaviconUrl(latestScreenshot.url)!}
                    alt=""
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  Screenshot captured
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  {latestScreenshot?.title}
                </p>
              </div>
            </div>
          </div>
          
          {/* Screenshot image - Scrollable */}
          <div className="p-4 bg-muted/20 flex-1 overflow-auto min-h-0">
            <div className="bg-background border rounded-lg overflow-hidden shadow-sm">
              {latestScreenshot && (
                <img
                  src={latestScreenshot.dataUrl}
                  alt={latestScreenshot.title}
                  className="w-full h-auto object-contain"
                />
              )}
            </div>
          </div>

          {/* Action buttons - Fixed height */}
          <div className="border-t border-border bg-background shrink-0">
            <div className="flex">
              <button
                onClick={downloadScreenshot}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors duration-200 border-r border-border"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              
              <button
                onClick={handleConfirmCapture}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors duration-200"
              >
                <Check className="w-4 h-4" />
                Add to Message
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CaptureFollowupDialog;