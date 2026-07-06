import React, { useState, useRef, useEffect } from 'react';
import { X, CaretLeft, CaretRight, ArrowClockwise, Globe, ArrowSquareOut, Asterisk } from '@phosphor-icons/react';
import { motion } from 'framer-motion';

interface PictureInPictureWindowProps {
  url: string;
  title: string;
  tabId: string;
  onClose: () => void;
  onWebviewReady?: (webview: Electron.WebviewTag, tabId: string) => void;
  onUrlChange?: (tabId: string, newUrl: string) => void;
  onOpenInNewTab?: (url: string) => void;
  onAddToEditor?: (url: string) => void;
}

const PictureInPictureWindow: React.FC<PictureInPictureWindowProps> = ({
  url,
  title,
  tabId,
  onClose,
  onWebviewReady,
  onUrlChange,
  onOpenInNewTab,
  onAddToEditor
}) => {
  const [size, setSize] = useState({ width: 600, height: 450 });
  const [position, setPosition] = useState({ 
    x: window.innerWidth - 650, 
    y: window.innerHeight - 500 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  // Address bar state
  const [currentUrl, setCurrentUrl] = useState(url);
  const [urlInput, setUrlInput] = useState('');
  const [isEditingUrl, setIsEditingUrl] = useState(false);

  // Background color state
  const [headerBgColor, setHeaderBgColor] = useState<string>('#f1f5f9'); // Default fallback color
  const [textColor, setTextColor] = useState<string>('#0f172a'); // Default text color

  const containerRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<Electron.WebviewTag>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Function to extract background color from webpage
  const extractBackgroundColor = async () => {
    const webview = webviewRef.current;
    if (!webview) return;

    try {
      // Execute JavaScript in the webview to get background colors
      const result = await webview.executeJavaScript(`
        (() => {
          // Function to get computed background color of an element
          const getComputedBgColor = (element) => {
            const style = window.getComputedStyle(element);
            return style.backgroundColor;
          };

          // Function to check if color is transparent or rgba(0,0,0,0)
          const isTransparent = (color) => {
            return color === 'transparent' || 
                   color === 'rgba(0, 0, 0, 0)' || 
                   color === 'rgba(0,0,0,0)' ||
                   !color;
          };

          // Function to convert rgb/rgba to hex
          const rgbToHex = (rgb) => {
            if (!rgb || rgb.indexOf('rgb') === -1) return rgb;
            
            const result = rgb.match(/\\d+/g);
            if (!result || result.length < 3) return rgb;
            
            const r = parseInt(result[0]);
            const g = parseInt(result[1]);
            const b = parseInt(result[2]);
            
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
          };

          // Function to calculate luminance for contrast
          const getLuminance = (hex) => {
            if (!hex || hex.indexOf('#') !== 0) return 0.5;
            
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            
            const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            
            return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
          };

          // Try to get background color from various elements
          const candidates = [
            document.documentElement,
            document.body,
            document.querySelector('header'),
            document.querySelector('nav'),
            document.querySelector('.header'),
            document.querySelector('.navbar'),
            document.querySelector('.top-bar'),
            document.querySelector('main'),
            document.querySelector('.main'),
            document.querySelector('.container'),
            document.querySelector('.wrapper')
          ].filter(el => el);

          let finalBgColor = null;
          
          for (const element of candidates) {
            const bgColor = getComputedBgColor(element);
            if (!isTransparent(bgColor)) {
              finalBgColor = rgbToHex(bgColor);
              break;
            }
          }

          // Fallback: try to get the most common background color from visible elements
          if (!finalBgColor) {
            const allElements = Array.from(document.querySelectorAll('*')).slice(0, 50); // Limit for performance
            const colorCounts = {};
            
            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 100 && rect.height > 50) { // Only consider reasonably sized elements
                const bgColor = getComputedBgColor(el);
                if (!isTransparent(bgColor)) {
                  const hexColor = rgbToHex(bgColor);
                  colorCounts[hexColor] = (colorCounts[hexColor] || 0) + 1;
                }
              }
            }
            
            // Get most common color
            const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
            if (sortedColors.length > 0) {
              finalBgColor = sortedColors[0][0];
            }
          }

          // Default fallback
          if (!finalBgColor) {
            finalBgColor = '#ffffff';
          }

          // Calculate appropriate text color based on background luminance
          const luminance = getLuminance(finalBgColor);
          const textColor = luminance > 0.5 ? '#0f172a' : '#f8fafc';

          return {
            backgroundColor: finalBgColor,
            textColor: textColor,
            luminance: luminance
          };
        })();
      `);

      if (result && result.backgroundColor) {
        setHeaderBgColor(result.backgroundColor);
        setTextColor(result.textColor);
      }
    } catch (error) {
      console.log('Could not extract background color:', error);
      // Keep default colors on error
    }
  };

  // Handle webview setup
  useEffect(() => {
    const webview = webviewRef.current;
    if (webview && onWebviewReady) {
      const handleDomReady = () => {
        onWebviewReady(webview, tabId);
        updateNavigationState();
        // Extract background color after page loads
        setTimeout(extractBackgroundColor, 1000);
      };
      
      const handleDidNavigate = (event: any) => {
        const newUrl = event.url;
        setCurrentUrl(newUrl);
        updateNavigationState();
        
        // Notify parent component of URL change
        if (onUrlChange) {
          onUrlChange(tabId, newUrl);
        }
        
        // Extract background color after navigation
        setTimeout(extractBackgroundColor, 1500);
      };

      const handleDidNavigateInPage = (event: any) => {
        const newUrl = event.url;
        setCurrentUrl(newUrl);
        updateNavigationState();
        
        // Notify parent component of URL change
        if (onUrlChange) {
          onUrlChange(tabId, newUrl);
        }
        
        // Extract background color after in-page navigation
        setTimeout(extractBackgroundColor, 1000);
      };

      const handleDidFinishLoad = () => {
        // Extract background color when page finishes loading
        setTimeout(extractBackgroundColor, 500);
      };

      const updateNavigationState = () => {
        if (webview) {
          setCanGoBack(webview.canGoBack());
          setCanGoForward(webview.canGoForward());
        }
      };
      
      webview.addEventListener('dom-ready', handleDomReady);
      webview.addEventListener('did-navigate', handleDidNavigate);
      webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage);
      webview.addEventListener('did-finish-load', handleDidFinishLoad);
      
      return () => {
        webview.removeEventListener('dom-ready', handleDomReady);
        webview.removeEventListener('did-navigate', handleDidNavigate);
        webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage);
        webview.removeEventListener('did-finish-load', handleDidFinishLoad);
      };
    }
    return undefined;
  }, [onWebviewReady, tabId, onUrlChange]);

  // Navigation handlers
  const handleGoBack = () => {
    const webview = webviewRef.current;
    if (webview && canGoBack) {
      webview.goBack();
    }
  };

  const handleGoForward = () => {
    const webview = webviewRef.current;
    if (webview && canGoForward) {
      webview.goForward();
    }
  };

  const handleReload = () => {
    const webview = webviewRef.current;
    if (webview) {
      webview.reload();
    }
  };

  // Handle opening in new tab
  const handleOpenInNewTab = () => {
    if (onOpenInNewTab && currentUrl) {
      onOpenInNewTab(currentUrl);
      onClose(); // Close the PiP window after opening in new tab
    }
  };

  // Handle adding to editor
  const handleAddToEditor = () => {
    if (onAddToEditor && currentUrl) {
      onAddToEditor(currentUrl);
      onClose(); // Close the PiP window after adding to editor
    }
  };

  // Address bar handlers
  const handleUrlBarClick = () => {
    setIsEditingUrl(true);
    setUrlInput(currentUrl);
    setTimeout(() => {
      if (urlInputRef.current) {
        urlInputRef.current.focus();
        urlInputRef.current.select();
      }
    }, 0);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    const webview = webviewRef.current;
    if (webview) {
      let processedUrl = urlInput.trim();
      
      // Add protocol if missing
      if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
        // Check if it's a valid domain or IP
        if (processedUrl.includes('.') || processedUrl.match(/^\d+\.\d+\.\d+\.\d+/)) {
          processedUrl = `https://${processedUrl}`;
        } else {
          // Treat as search query
          processedUrl = `https://www.google.com/search?q=${encodeURIComponent(processedUrl)}`;
        }
      }

      webview.loadURL(processedUrl);
      setIsEditingUrl(false);
    }
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditingUrl(false);
      setUrlInput('');
    }
  };

  const handleUrlBlur = () => {
    setIsEditingUrl(false);
    setUrlInput('');
  };

  const getDisplayUrl = () => {
    if (!currentUrl) return '';
    try {
      const urlObj = new URL(currentUrl);
      return urlObj.hostname + urlObj.pathname + urlObj.search;
    } catch {
      return currentUrl;
    }
  };

  // Dragging functionality - only from header/top (excluding corners and address bar)
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Exclude corner areas (3px from each corner) and address bar area
    const isInTopLeftCorner = x <= 3 && y <= 3;
    const isInTopRightCorner = x >= rect.width - 3 && y <= 3;
    const isAddressBarArea = target.closest('.address-bar-container');
    
    if (!isInTopLeftCorner && !isInTopRightCorner && !isAddressBarArea &&
        (target === e.currentTarget || target.classList.contains('pip-header') || 
         target.closest('.pip-header'))) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      e.preventDefault();
    }
  };

  // Resizing functionality - only from sides
  const handleResizeMouseDown = (e: React.MouseEvent, direction: string) => {
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y
    });
    e.preventDefault();
    e.stopPropagation();
  };

  // Enhanced mouse move handler for smooth native-like dragging and resizing
  useEffect(() => {
    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      // Cancel previous animation frame for smoother updates
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        if (isDragging) {
          const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStart.x));
          const newY = Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragStart.y));
          setPosition({ x: newX, y: newY });
        }
        
        if (isResizing) {
          const deltaX = e.clientX - resizeStart.x;
          const deltaY = e.clientY - resizeStart.y;
          
          let newWidth = resizeStart.width;
          let newHeight = resizeStart.height;
          let newX = resizeStart.posX;
          let newY = resizeStart.posY;

          switch (resizeDirection) {
            case 'right':
              newWidth = Math.max(350, resizeStart.width + deltaX);
              break;
            case 'left':
              newWidth = Math.max(350, resizeStart.width - deltaX);
              if (newWidth > 350) newX = resizeStart.posX + deltaX;
              break;
            case 'bottom':
              newHeight = Math.max(200, resizeStart.height + deltaY);
              break;
            case 'top-left':
              newWidth = Math.max(350, resizeStart.width - deltaX);
              newHeight = Math.max(200, resizeStart.height - deltaY);
              if (newWidth > 350) newX = resizeStart.posX + deltaX;
              if (newHeight > 200) newY = resizeStart.posY + deltaY;
              break;
            case 'top-right':
              newWidth = Math.max(350, resizeStart.width + deltaX);
              newHeight = Math.max(200, resizeStart.height - deltaY);
              if (newHeight > 200) newY = resizeStart.posY + deltaY;
              break;
            case 'bottom-right':
              newWidth = Math.max(350, resizeStart.width + deltaX);
              newHeight = Math.max(200, resizeStart.height + deltaY);
              break;
            case 'bottom-left':
              newWidth = Math.max(350, resizeStart.width - deltaX);
              newHeight = Math.max(200, resizeStart.height + deltaY);
              if (newWidth > 350) newX = resizeStart.posX + deltaX;
              break;
          }

          // Ensure window stays within screen bounds
          newX = Math.max(0, Math.min(window.innerWidth - newWidth, newX));
          newY = Math.max(0, Math.min(window.innerHeight - newHeight, newY));

          setSize({ width: newWidth, height: newHeight });
          setPosition({ x: newX, y: newY });
        }
      });
    };

    const handleMouseUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection('');
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, resizeDirection, size]);

  // Prevent context menu on the container
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Generate dynamic styles for header based on extracted color
  const headerStyle = {
    backgroundColor: headerBgColor,
    color: textColor,
    transition: 'background-color 0.3s ease, color 0.3s ease'
  };

  // Generate styles for buttons based on text color
  const buttonStyle = {
    color: textColor,
    opacity: 0.7
  };

  const buttonHoverStyle = {
    backgroundColor: textColor === '#f8fafc' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
  };

  return (
    <motion.div
      ref={containerRef}
      className="fixed bg-background border border-border rounded-lg shadow-2xl overflow-hidden select-none"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: 9999,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onContextMenu={handleContextMenu}
    >
      {/* Resize handles - sides and corners */}
      <>
        {/* Top-left corner */}
        <div 
          className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize hover:bg-primary/20 transition-colors z-10"
          onMouseDown={(e) => handleResizeMouseDown(e, 'top-left')}
        />
        {/* Top-right corner */}
        <div 
          className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize hover:bg-primary/20 transition-colors z-10"
          onMouseDown={(e) => handleResizeMouseDown(e, 'top-right')}
        />
        {/* Left edge */}
        <div 
          className="absolute left-0 top-3 bottom-0 w-1 cursor-w-resize hover:bg-primary/20 transition-colors"
          onMouseDown={(e) => handleResizeMouseDown(e, 'left')}
        />
        {/* Right edge */}
        <div 
          className="absolute right-0 top-3 bottom-0 w-1 cursor-e-resize hover:bg-primary/20 transition-colors"
          onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
        />
        {/* Bottom edge */}
        <div 
          className="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize hover:bg-primary/20 transition-colors"
          onMouseDown={(e) => handleResizeMouseDown(e, 'bottom')}
        />
        {/* Bottom-left corner */}
        <div 
          className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize hover:bg-primary/20 transition-colors"
          onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-left')}
        />
        {/* Bottom-right corner */}
        <div 
          className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-primary/20 transition-colors"
          onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-right')}
        />
      </>

      {/* Header - for dragging only (excluding corners and address bar) with dynamic background */}
      <div 
        className="pip-header flex items-center justify-between p-2 border-b border-border cursor-grab active:cursor-grabbing relative"
        style={headerStyle}
        onMouseDown={handleMouseDown}
      >
        {/* Exclude top corners from header dragging */}
        <div className="absolute top-0 left-0 w-3 h-3 pointer-events-none" />
        <div className="absolute top-0 right-0 w-3 h-3 pointer-events-none" />
        
        {/* Navigation buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleGoBack();
            }}
            disabled={!canGoBack}
            className="p-1 rounded transition-all duration-200"
            style={{
              ...buttonStyle,
              opacity: canGoBack ? 0.7 : 0.3,
              cursor: canGoBack ? 'pointer' : 'not-allowed'
            }}
            onMouseEnter={(e) => {
              if (canGoBack) {
                Object.assign(e.currentTarget.style, buttonHoverStyle);
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Go Back"
          >
            <CaretLeft className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleGoForward();
            }}
            disabled={!canGoForward}
            className="p-1 rounded transition-all duration-200"
            style={{
              ...buttonStyle,
              opacity: canGoForward ? 0.7 : 0.3,
              cursor: canGoForward ? 'pointer' : 'not-allowed'
            }}
            onMouseEnter={(e) => {
              if (canGoForward) {
                Object.assign(e.currentTarget.style, buttonHoverStyle);
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Go Forward"
          >
            <CaretRight className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReload();
            }}
            className="p-1 rounded transition-all duration-200"
            style={buttonStyle}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, buttonHoverStyle);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Reload"
          >
            <ArrowClockwise className="w-4 h-4" />
          </button>
        </div>
        
        {/* Address bar */}
        <div className="address-bar-container flex-1 mx-3 min-w-0">
          {isEditingUrl ? (
            <form onSubmit={handleUrlSubmit} className="w-full">
              <input
                ref={urlInputRef}
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={handleUrlKeyDown}
                onBlur={handleUrlBlur}
                className="w-full px-2 py-1 text-xs bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Enter URL or search..."
              />
            </form>
          ) : (
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleUrlBarClick();
              }}
              className="w-full px-2 py-1 text-xs rounded cursor-text truncate flex items-center gap-1 transition-all duration-200"
              style={{
                backgroundColor: textColor === '#f8fafc' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                color: textColor,
                opacity: 0.8
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.8';
              }}
              title={currentUrl}
            >
              <Globe className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{getDisplayUrl()}</span>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Add to Editor button */}
          {onAddToEditor && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddToEditor();
              }}
              className="p-1 rounded transition-all duration-200"
              style={buttonStyle}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, {
                  ...buttonHoverStyle,
                  color: '#eab308' // Yellow color for asterisk
                });
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, {
                  backgroundColor: 'transparent',
                  color: textColor
                });
              }}
              title="Add to Asterisk Editor"
            >
              <Asterisk className="w-3 h-3" />
            </button>
          )}
          
          {/* Open in New Tab button */}
          {onOpenInNewTab && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenInNewTab();
              }}
              className="p-1 rounded transition-all duration-200"
              style={buttonStyle}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, buttonHoverStyle);
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, {
                  backgroundColor: 'transparent',
                  color: textColor
                });
              }}
              title="Open in New Tab"
            >
              <ArrowSquareOut className="w-3 h-3" />
            </button>
          )}
          
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded transition-all duration-200"
            style={buttonStyle}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, {
                backgroundColor: '#ef4444',
                color: '#ffffff'
              });
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, {
                backgroundColor: 'transparent',
                color: textColor
              });
            }}
            title="Close Picture-in-Picture"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1" style={{ height: size.height - 48 }}>
        <webview
          ref={webviewRef}
          src={url}
          className="w-full h-full"
          partition="persist:main"
          {...({ 
            allowpopups: "true",
            disablewebsecurity: "false"
          } as any)}
          style={{ 
            width: '100%', 
            height: '100%',
            pointerEvents: isDragging || isResizing ? 'none' : 'auto'
          }}
        />
      </div>
    </motion.div>
  );
};

export default PictureInPictureWindow;