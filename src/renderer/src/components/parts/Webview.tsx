import React, { useCallback, memo, useState } from 'react'
import type { Tab } from '../../types/types'
import { cn } from '../../lib/utils'
import Electron from 'electron'

interface WebViewProps {
  tab: Tab;
  isActive: boolean;
  onWebViewRef: (webview: Electron.WebviewTag) => void;
  className?: string;
}

const WebView: React.FC<WebViewProps> = memo(({
  tab,
  isActive,
  onWebViewRef,
  className = ''
}) => {
  
  // 🎯 CRITICAL FIX: Use initial URL and never change it via React props
  const [initialUrl] = useState(tab.url);
  
  // 🎯 STABLE REF CALLBACK - Remove tab.url dependency 
  const webviewRefCallback = useCallback((webview: Electron.WebviewTag | null) => {
    if (webview) {
      console.log('📋 WebView ref received for tab', tab.id, 'Initial URL:', initialUrl);
      onWebViewRef(webview);
    }
  }, [tab.id, onWebViewRef]); // Removed tab.url dependency

  console.log('🔄 WebView rendering for tab', tab.id, 'Active:', isActive, 'Using initial URL:', initialUrl, 'Current tab.url:', tab.url);

  return (
    <webview
      key={`webview-${tab.id}`} // Stable key based on tab ID
      ref={webviewRefCallback}
      src={initialUrl} // ✅ FIXED: Static initial URL - never changes via props
      className={cn(
        'absolute inset-0 w-full h-full',
        isActive ? 'visible' : 'hidden',
        className
      )}
      partition="persist:main"
      webpreferences="contextIsolation=true,nodeIntegration=false,nodeIntegrationInSubFrames=false,webSecurity=true,experimentalFeatures=true,plugins=true,webgl=true,webaudio=true"
      {...({ 
        allowpopups: "true",
        disablewebsecurity: "false"
      } as any)}
    />
  );
});

WebView.displayName = 'WebView';

export default WebView;