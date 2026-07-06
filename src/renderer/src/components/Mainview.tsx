import React, { useState, useEffect } from 'react'
import WebViewWrapper from './parts/WebViewWrapper' // 🔄 CHANGED: Import WebViewWrapper instead
import type { Tab } from '../types/types'
import Electron from 'electron'
import { useCommand } from './parts/CommandContext'
import ErrorDisplay from './parts/ErrorDisplay'
import OfflineIndicator from './parts/OfflineIndicator'
import Editor from './Editor'

interface MainViewProps {
  tabs: Tab[]
  activeTabId: string
  setupWebview: (webview: Electron.WebviewTag, tab: Tab) => void
  webviewRefs: React.MutableRefObject<Map<string, Electron.WebviewTag>>
  updateTabState: (
    tabId: string,
    updates:
      | Partial<Omit<Tab, 'webviewRef'>>
      | ((tab: Tab) => Partial<Omit<Tab, 'webviewRef'>> | null)
  ) => void
  isSidebarOpen: boolean
  addTab: (url?: string, options?: { type?: 'standard' | 'tool'; toolType?: 'Asterisk' }) => void
  onTogglePictureInPicture?: (tabId: string) => void
  onOpenPictureInPictureFromUrl?: (url: string, title?: string) => void
  isSidebarHovering?: boolean // Add prop for sidebar hover state
}

const MainView: React.FC<MainViewProps> = ({
  tabs,
  activeTabId,
  setupWebview,
  webviewRefs,
  updateTabState,
  isSidebarOpen,
  addTab,
  onTogglePictureInPicture,
  onOpenPictureInPictureFromUrl,
  isSidebarHovering = false // Default to false
}) => {
  // Track tabs that have failed to load
  const [failedTabs, setFailedTabs] = useState<Record<string, boolean>>({})
  const { urlLoaded, setUrlLoaded } = useCommand()

  // Add state for online/offline status
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [lastChecked, setLastChecked] = useState<string>(new Date().toLocaleTimeString())

  // Get active tab
  const activeTab = tabs.find((tab) => tab.id === activeTabId)!

  const [errorDetails, setErrorDetails] = useState<
    Record<
      string,
      {
        errorCode: number
        errorDescription: string
        url: string
      }
    >
  >({})

  // 🔄 UNCHANGED: Error handling logic remains the same
  useEffect(() => {
    const handlePageLoadFailed = (event: CustomEvent) => {
      const { tabId, errorCode, errorDescription, url } = event.detail

      console.log(
        `💥 Handling failed load for tab ${tabId}. Error ${errorCode}: ${errorDescription} at URL: ${url}`
      )

      // Save detailed error information
      setErrorDetails((prev) => ({
        ...prev,
        [tabId]: {
          errorCode,
          errorDescription,
          url
        }
      }))

      // Mark this tab as failed
      setFailedTabs((prev) => ({
        ...prev,
        [tabId]: true
      }))

      // Update tab state to show it's no longer loading
      updateTabState(tabId, {
        isLoading: false,
        title: 'Page Load Failed'
      })

      // Update the URL input field if this is the active tab
      if (tabId === activeTabId) {
        const urlUpdateEvent = new CustomEvent('update-url-input', {
          detail: { url }
        })
        document.dispatchEvent(urlUpdateEvent)
      }
    }

    document.addEventListener('page-load-failed', handlePageLoadFailed as EventListener)

    return () => {
      document.removeEventListener('page-load-failed', handlePageLoadFailed as EventListener)
    }
  }, [activeTabId, updateTabState, tabs])

  // 🔄 UNCHANGED: Connection monitoring logic remains the same
  useEffect(() => {
    const updateConnectionStatus = () => {
      setIsOnline(navigator.onLine)
      setLastChecked(new Date().toLocaleTimeString())
    }

    updateConnectionStatus()

    window.addEventListener('online', updateConnectionStatus)
    window.addEventListener('offline', updateConnectionStatus)

    const intervalId = setInterval(updateConnectionStatus, 10000)

    return () => {
      window.removeEventListener('online', updateConnectionStatus)
      window.removeEventListener('offline', updateConnectionStatus)
      clearInterval(intervalId)
    }
  }, [])

  // 🔄 UNCHANGED: URL loaded handling
  useEffect(() => {
    if (urlLoaded) {
      setFailedTabs((prev) => ({
        ...prev,
        [activeTabId]: false
      }))

      setUrlLoaded(false)
    }
  }, [urlLoaded, activeTabId, setUrlLoaded])

  // 🔄 UNCHANGED: Overlay state and handlers
  const [overlayMode, setOverlayMode] = useState<'reading' | 'night' | 'focused' | 'custom' | null>(
    null
  )
  const [overlayColor, setOverlayColor] = useState('#bfdbfe')
  const [overlayOpacity, setOverlayOpacity] = useState(0.3)

  useEffect(() => {
    const handleSetOverlayMode = (
      event: CustomEvent<{
        mode: 'reading' | 'night' | 'focused' | 'custom' | null
        color?: string
      }>
    ) => {
      setOverlayMode(event.detail.mode)
      if (event.detail.color) {
        setOverlayColor(event.detail.color)
      }
    }

    const handleSetOverlayOpacity = (
      event: CustomEvent<{
        opacity: number
      }>
    ) => {
      setOverlayOpacity(event.detail.opacity)
    }

    window.addEventListener('setOverlayMode', handleSetOverlayMode as EventListener)
    window.addEventListener('setOverlayOpacity', handleSetOverlayOpacity as EventListener)

    return () => {
      window.removeEventListener('setOverlayMode', handleSetOverlayMode as EventListener)
      window.removeEventListener('setOverlayOpacity', handleSetOverlayOpacity as EventListener)
    }
  }, [])

  // ✨ UPDATED: Tool component rendering with offline handling
  const renderToolComponent = (tab: Tab) => {
    if (tab.type !== 'tool') return null

    // Check if offline and show offline indicator for tools
    if (!isOnline) {
      return <OfflineIndicator lastChecked={lastChecked} />
    }

    switch (tab.toolType) {
      case 'Asterisk':
        return (
          <Editor
            tabId={tab.id}
            updateTabState={updateTabState}
            addTab={addTab}
            onOpenPictureInPictureFromUrl={onOpenPictureInPictureFromUrl}
            isSidebarHovering={isSidebarHovering}
          />
        )
      default:
        return (
          <Editor
            tabId={tab.id}
            updateTabState={updateTabState}
            addTab={addTab}
            onOpenPictureInPictureFromUrl={onOpenPictureInPictureFromUrl}
            isSidebarHovering={isSidebarHovering}
          />
        )
    }
  }

  // 🔄 UNCHANGED: Overlay rendering
  const renderOverlay = () => {
    if (!overlayMode) return null

    return (
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          backgroundColor:
            overlayMode === 'reading'
              ? '#fde68a'
              : overlayMode === 'night'
                ? '#020617'
                : overlayMode === 'focused'
                  ? '#bfdbfe'
                  : overlayMode === 'custom'
                    ? overlayColor
                    : 'transparent',
          opacity: overlayOpacity
        }}
      />
    )
  }

  console.log('🎨 MainView rendering with', tabs.length, 'tabs, active:', activeTabId)

  return (
    <div className="flex-1 relative overflow-hidden rounded-[4px] bg-zinc-100 dark:bg-zinc-900">
      {tabs.map((tab) => {
        const isActiveTab = tab.id === activeTabId
        console.log(
          `🔍 Rendering tab ${tab.id}, active: ${isActiveTab}, type: ${tab.type}, url: ${tab.url}`
        )

        return (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            data-active={isActiveTab}
            className={`absolute inset-0 ${isActiveTab ? 'block' : 'hidden'}`}
          >
            {tab.type === 'tool' ? (
              // ✨ UPDATED: Tool component rendering now includes offline handling
              <div className="absolute inset-0">
                {renderToolComponent(tab)}
                {!isOnline ? null : renderOverlay()} {/* Only show overlay when online */}
              </div>
            ) : (
              // ✨ CHANGED: Use WebViewWrapper instead of WebView
              <div className="absolute inset-0">
                {!isOnline ? (
                  // Show offline indicator when offline
                  <OfflineIndicator lastChecked={lastChecked} />
                ) : failedTabs[tab.id] ? (
                  // Show error page when page failed to load
                  <>
                    {/* Hide WebViewWrapper completely but keep it in DOM to prevent reload loops */}
                    <WebViewWrapper
                      tab={tab}
                      isActive={false} // Force inactive
                      setupWebview={setupWebview}
                      webviewRefs={webviewRefs}
                      className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                    />

                    {/* Show error display */}
                    <div className="absolute inset-0">
                      <ErrorDisplay
                        errorCode={errorDetails[tab.id]?.errorCode || -1}
                        errorDescription={errorDetails[tab.id]?.errorDescription || 'Unknown error'}
                        url={errorDetails[tab.id]?.url || tab.url}
                        lastChecked={lastChecked}
                      />
                    </div>
                  </>
                ) : (
                  // Show normal content when online and loading succeeded
                  <>
                    <WebViewWrapper
                      tab={tab}
                      isActive={isActiveTab}
                      setupWebview={setupWebview}
                      webviewRefs={webviewRefs}
                      className="absolute inset-0 w-full h-full"
                    />
                    {renderOverlay()}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default MainView