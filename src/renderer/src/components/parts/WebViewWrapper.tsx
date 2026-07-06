/**
 * Stable webview host — initializes each tab's webview once and keeps refs
 * across re-renders. Delegates navigation/permission wiring to setupWebview().
 */
import React, { useEffect, useRef, useCallback, memo } from 'react'
import type { Tab } from '../../types/types'
import Electron from 'electron'
import WebView from './Webview';

interface WebViewWrapperProps {
  tab: Tab;
  isActive: boolean;
  setupWebview: (webview: Electron.WebviewTag, tab: Tab) => void;
  webviewRefs: React.MutableRefObject<Map<string, Electron.WebviewTag>>;
  className?: string;
}

const WebViewWrapper: React.FC<WebViewWrapperProps> = memo(({
  tab,
  isActive,
  setupWebview,
  webviewRefs,
  className = ''
}) => {
  // 🎯 STABLE REFS - These don't change on re-renders
  const webviewElementRef = useRef<Electron.WebviewTag | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const listenersAttachedRef = useRef<boolean>(false);
  const cleanupFunctionsRef = useRef<Array<() => void>>([]);

  // 🔧 WEBVIEW INITIALIZATION - Only happens once per tab
  const initializeWebview = useCallback((webviewElement: Electron.WebviewTag) => {
    if (isInitializedRef.current) {
      console.log('⚠️ Webview already initialized for tab', tab.id);
      return;
    }

    console.log('🚀 Initializing webview for tab', tab.id);
    
    // Store references
    webviewElementRef.current = webviewElement;
    webviewRefs.current.set(tab.id, webviewElement);
    isInitializedRef.current = true;

    // Call the original setup function
    setupWebview(webviewElement, tab);

    console.log('✅ Webview initialization complete for tab', tab.id);
  }, [tab.id, setupWebview, webviewRefs]);

  // 🎧 EVENT LISTENERS SETUP - Separate from initialization
  useEffect(() => {
    const webview = webviewElementRef.current;
    if (!webview || !isInitializedRef.current || listenersAttachedRef.current) {
      return;
    }

    console.log('🎧 Setting up event listeners for tab', tab.id);

    // 📍 DOM Ready Handler
    const handleDomReady = () => {
      try {
        console.log('✨ Webview DOM ready for tab', tab.id);
        const webContentsId = webview.getWebContentsId();
        if (webContentsId) {
          console.log('🆔 Got webContentsId:', webContentsId);
          window.electronAPI.devTools.mapTabToWebContents(tab.id, webContentsId);
          
          // Setup screen share handler
          setTimeout(() => {
            setupDisplayMediaHandler(webContentsId);
          }, 1000);
        }
      } catch (error) {
        console.error('❌ Failed to map webContentsId:', error);
      }
    };

    // 🔐 Permission Request Handler
    const handlePermissionRequest = (event: any) => {
      const { permission, requestingUrl, details } = event;
      console.log('🔐 Permission requested:', permission, 'from:', requestingUrl);
      
      // Auto-allow for trusted domains
      const trustedDomains = ['meet.google.com', 'zoom.us', 'teams.microsoft.com'];
      const url = new URL(requestingUrl);
      
      if (trustedDomains.some(domain => url.hostname.includes(domain))) {
        if (['camera', 'microphone', 'media', 'notifications', 'display-capture'].includes(permission)) {
          event.request.allow();
          return;
        }
      }
      
      // Auto-allow display-capture for all domains
      if (permission === 'display-capture') {
        event.request.allow();
        return;
      }
      
      // Show permission dialog for other requests
      const permissionEvent = new CustomEvent('show-permission-prompt', {
        detail: {
          permission,
          requestingUrl,
          details,
          callback: event.request
        }
      });
      document.dispatchEvent(permissionEvent);
    };

    // 🚫 Failed Load Handler
    const handleDidFailLoad = (event: any) => {
      const { errorCode, errorDescription, validatedURL } = event;
      console.error(`💥 Failed to load ${validatedURL}: ${errorCode} - ${errorDescription}`);
      
      // Skip recoverable errors
      if (errorCode === -3 || errorCode === -102 || errorCode === -30) {
        console.log(`⏭️ Ignoring recoverable error code: ${errorCode}`);
        return;
      }
      
      // Stop current load to prevent redirects
      try {
        if (webview.isLoading()) {
          webview.stop();
        }
      } catch (err) {
        console.error('❌ Error stopping webview load:', err);
      }
      
      // Notify about failure
      const failedLoadEvent = new CustomEvent('page-load-failed', {
        detail: {
          tabId: tab.id,
          url: validatedURL,
          errorCode,
          errorDescription
        }
      });
      document.dispatchEvent(failedLoadEvent);
    };

    // 🆕 New Tab Handler
    const handleNewTabFromContext = (event: CustomEvent) => {
      if (event.detail?.url) {
        console.log('🆕 Opening new tab from context menu:', event.detail.url);
        window.electronAPI.handleNewTab(event.detail.url);
      }
    };

    // 🧘 Zen Mode Handler
    const handleToggleZenMode = () => {
      console.log('🧘 Toggling Zen Mode from context menu');
    };

    // 🔒 Security Status Handler
    const handleFaviconUpdated = () => {
      const url = webview.getURL();
      const securityEvent = new CustomEvent('update-security-status', {
        detail: {
          tabId: tab.id,
          isSecure: url.startsWith('https://'),
          url
        }
      });
      document.dispatchEvent(securityEvent);
    };

    // 📝 ATTACH ALL EVENT LISTENERS
    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-fail-load', handleDidFailLoad);
    webview.addEventListener('permission-request', handlePermissionRequest);
    webview.addEventListener('page-favicon-updated', handleFaviconUpdated);
    webview.addEventListener('did-navigate', handleFaviconUpdated);
    
    document.addEventListener('new-tab-from-context', handleNewTabFromContext as EventListener);
    document.addEventListener('toggle-zen-mode', handleToggleZenMode as EventListener);

    // 🧹 STORE CLEANUP FUNCTIONS
    cleanupFunctionsRef.current = [
      () => webview.removeEventListener('dom-ready', handleDomReady),
      () => webview.removeEventListener('did-fail-load', handleDidFailLoad),
      () => webview.removeEventListener('permission-request', handlePermissionRequest),
      () => webview.removeEventListener('page-favicon-updated', handleFaviconUpdated),
      () => webview.removeEventListener('did-navigate', handleFaviconUpdated),
      () => document.removeEventListener('new-tab-from-context', handleNewTabFromContext as EventListener),
      () => document.removeEventListener('toggle-zen-mode', handleToggleZenMode as EventListener)
    ];

    listenersAttachedRef.current = true;
    console.log('✅ Event listeners attached for tab', tab.id);

    // 🧹 CLEANUP FUNCTION
    return () => {
      console.log('🧹 Cleaning up event listeners for tab', tab.id);
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current = [];
      listenersAttachedRef.current = false;
    };
  }, [tab.id]); // Only depend on tab.id

  // 🧹 COMPONENT UNMOUNT CLEANUP
  useEffect(() => {
    return () => {
      console.log('🧹 WebViewWrapper unmounting for tab', tab.id);
      
      // Clean up all listeners
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      
      // Remove from refs map
      webviewRefs.current.delete(tab.id);
      
      // Reset flags
      isInitializedRef.current = false;
      listenersAttachedRef.current = false;
      webviewElementRef.current = null;
    };
  }, [tab.id, webviewRefs]);

  // 🖥️ SCREEN SHARE SETUP HELPER
  const setupDisplayMediaHandler = async (webContentsId: number) => {
    try {
      const result = await window.electronAPI.ipcRenderer.invoke('setup-webview-handler', webContentsId);
      if (result.success) {
        console.log('✅ Webview handler setup successful for tab', tab.id);
      } else {
        console.error('❌ Webview handler setup failed for tab', tab.id, ':', result.error);
      }
    } catch (error) {
      console.error('❌ Error setting up webview handler for tab', tab.id, ':', error);
    }
  };

  return (
    <WebView
      tab={tab}
      isActive={isActive}
      onWebViewRef={initializeWebview}
      className={className}
    />
  );
});

WebViewWrapper.displayName = 'WebViewWrapper';

export default WebViewWrapper;