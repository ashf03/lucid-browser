import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Sidebar from './Sidebar'
import TopNavBar from './Topnavbar'
import MainView from './Mainview'
import type { TabsState, Tab } from '../types/types'
import type {
  PermissionRequest,
  WebViewElement,
  WebViewNavigationEvent
} from '../../../types/types'
import Electron from 'electron'
import PermissionDialog from './parts/Permissions/PermissionDialog'
import SecurityWarningModal from './parts/SecurityWarningModal'
import _ from 'lodash'
import { Asterisk } from '@phosphor-icons/react'
import { ViewProvider } from './parts/ViewContext'
import ScreenShareModal from './parts/ScreenShareModal'
import {
  PermissionRequest as NewPermissionRequest,
  HistoryItem,
  createHistoryItem
} from '../lib/permissionLogic'
import { AnimatePresence } from 'framer-motion'
import PictureInPictureWindow from './parts/PictureInPictureWindow'
import DraggableDialog from './parts/DraggableDialog'

interface Source {
  id: string
  name: string
  thumbnail: string
}

interface Download {
  id: string
  filename: string
  url: string
  totalBytes: number
  receivedBytes: number
  state: string
  startTime: string
  endTime: string | null
  savePath: string
  canResume: boolean
}

interface HistoryEntry {
  url: string
  title: string
  timestamp: Date
  tabId: string
  visitCount: number
  favicon?: string
}

export const DEFAULT_BLANK_URL = `data:text/html,
<html>
</html>`

export const FILE_MANAGER_MAX_EXPAND_URL = `data:text/html,%0A<html>%0A</html>`

const Browser = (): JSX.Element => {
  // Tab Management State
  const [tabsState, setTabsState] = useState<TabsState>({
    tabs: [
      {
        id: '1',
        title: 'New Tab',
        url: DEFAULT_BLANK_URL,
        active: true,
        isLoading: false,
        navigationHistory: [DEFAULT_BLANK_URL],
        historyIndex: 0,
        webviewRef: React.createRef<WebViewElement>()
      }
    ],
    activeTabId: '1'
  })

  const [urlInput, setUrlInput] = useState<string>('')
  const webviewRefs = useRef<Map<string, Electron.WebviewTag>>(new Map())

  // Get active tab
  const activeTab = tabsState.tabs.find((tab) => tab.id === tabsState.activeTabId)!

  // **NEW: Permission history state**
  const [permissionHistory, setPermissionHistory] = useState<HistoryItem[]>([])
  const [activeScreenShare, setActiveScreenShare] = useState(false)

  // **NEW: Downloads state**
  const [downloads, setDownloads] = useState<Download[]>([])

  // Helper functions for history management
  const extractDomainFromUrl = (url: string): string => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  const getFaviconUrl = (url: string): string => {
    try {
      const domain = new URL(url).origin
      return `${domain}/favicon.ico`
    } catch {
      return ''
    }
  }

  // 🎯 FIX 3: Create debounced save function to prevent excessive file writes
  const debouncedSaveTabsState = useMemo(
    () =>
      _.debounce(async (newTabsState: TabsState): Promise<void> => {
        try {
          console.log(`💾 Saving tabs state with ${newTabsState.tabs.length} tabs`)

          // Process tabs for storage
          const processedTabs = newTabsState.tabs.map(({ webviewRef, icon, ...tab }) => {
            return {
              ...tab
            }
          })

          const stateToSave = {
            ...newTabsState,
            tabs: processedTabs
          }

          await window.electronAPI.store.set('tabsState', stateToSave)
          console.log(`✅ Tabs state saved successfully`)
        } catch (error) {
          console.error('❌ Failed to save tabs state:', error)
        }
      }, 500), // 500ms debounce for saves
    []
  )

  const saveTabsState = useCallback(
    async (newTabsState: TabsState): Promise<void> => {
      debouncedSaveTabsState(newTabsState)
    },
    [debouncedSaveTabsState]
  )

  useEffect((): void => {
    const loadTabsState = async (): Promise<void> => {
      try {
        const savedState = (await window.electronAPI.store.get('tabsState')) as Omit<
          TabsState,
          'webviewRef'
        >
        const savedPinnedTabs = (await window.electronAPI.store.get('pinnedTabs')) as string[]

        if (savedState?.tabs?.length > 0) {
          // Process each tab to restore special properties like icon
          const processedTabs = savedState.tabs.map((tab) => {
            let icon: React.ComponentType<any> | undefined = undefined

            // Restore the proper icon component based on toolType
            if (tab.type === 'tool' && tab.toolType) {
              switch (tab.toolType) {
                case 'Asterisk':
                  icon = Asterisk
                  break
              }
            }

            return {
              ...tab,
              webviewRef: React.createRef<WebViewElement>(),
              isPinned: savedPinnedTabs?.includes(tab.id) || false,
              icon
            }
          })

          const stateWithRefs = {
            ...savedState,
            tabs: processedTabs
          }

          setTabsState(stateWithRefs)
        }
      } catch (error) {
        console.error('Failed to load tabs state:', error)
      }
    }

    void loadTabsState()
  }, [])

  useEffect(() => {
    // Load initial downloads
    const loadDownloads = async () => {
      try {
        const downloadsData = await window.electronAPI.downloads.getAll()
        setDownloads(downloadsData)
      } catch (error) {
        console.error('Failed to load downloads:', error)
      }
    }

    loadDownloads()

    // Listen for download updates with proper cleanup
    const handleDownloadUpdate = (updatedDownloads: Download[]) => {
      console.log('Download update received:', updatedDownloads.length, 'downloads')

      // Deduplicate before setting state
      const uniqueDownloads = Array.from(new Map(updatedDownloads.map((d) => [d.id, d])).values())

      setDownloads(uniqueDownloads)
    }

    // Set up listener and get cleanup function
    const cleanup = window.electronAPI.downloads.onUpdate(handleDownloadUpdate)

    return () => {
      // Proper cleanup
      if (cleanup && typeof cleanup === 'function') {
        cleanup()
      }
    }
  }, []) // Make sure dependencies are correct

  // 🎯 FIX 3: Optimized addTab function
  const addTab = useCallback(
    (
      url: string = DEFAULT_BLANK_URL,
      options?: {
        type?: 'standard' | 'tool'
        toolType?: 'Asterisk'
      }
    ): void => {
      console.log(`➕ Adding new tab:`, { url, options })

      // Set the appropriate icon based on tool type
      let icon: React.ComponentType<any> | undefined = undefined

      if (options?.type === 'tool' && options.toolType) {
        switch (options.toolType) {
          case 'Asterisk':
            icon = Asterisk
            break
        }
      }

      const newTab: Tab = {
        id: Date.now().toString(),
        title: options?.type === 'tool' ? 'New Asterisk' : 'New Tab',
        url: url,
        isLoading: false,
        navigationHistory: [url],
        historyIndex: 0,
        webviewRef: React.createRef<WebViewElement>(),
        active: true,
        type: options?.type || 'standard',
        toolType: options?.toolType,
        icon
      }

      setTabsState((prev) => {
        const newState = {
          tabs: [...prev.tabs, newTab],
          activeTabId: newTab.id
        }

        // 🎯 FIX: Use debounced save
        debouncedSaveTabsState(newState)
        return newState
      })
    },
    [debouncedSaveTabsState]
  )

  const closeTab = useCallback(
    (tabId: string): void => {
      // First close any DevTools associated with this tab
      window.electronAPI.devTools.closeForTab(tabId)

      // Call the new cleanup function to remove all stored data for this tab
      window.electronAPI.cleanup
        .forTab(tabId)
        .catch((error: any) => console.error('Failed to cleanup tab data:', error))

      setTabsState((prev) => {
        if (prev.tabs.length === 1) return prev // Don't close last tab

        const tabIndex = prev.tabs.findIndex((tab) => tab.id === tabId)
        const newTabs = prev.tabs.filter((tab) => tab.id !== tabId)
        const newActiveTabId =
          prev.activeTabId === tabId
            ? newTabs[Math.min(tabIndex, newTabs.length - 1)].id
            : prev.activeTabId

        const newState = {
          tabs: newTabs,
          activeTabId: newActiveTabId
        }
        debouncedSaveTabsState(newState)
        return newState
      })
    },
    [debouncedSaveTabsState]
  )

  // 🎯 FIX 3: Optimized switchTab function
  const switchTab = useCallback(
    (tabId: string): void => {
      console.log(`🔄 Switching to tab ${tabId}`)

      setTabsState((prev) => {
        // 🎯 FIX: Don't update if already active
        if (prev.activeTabId === tabId) {
          console.log(`⏭️ Tab ${tabId} already active, skipping`)
          return prev
        }

        const newState = {
          ...prev,
          activeTabId: tabId
        }

        // 🎯 FIX: Use debounced save
        debouncedSaveTabsState(newState)
        return newState
      })
    },
    [debouncedSaveTabsState]
  )

  useEffect(() => {
    const handleBeforeUnload = () => {
      // Force immediate save on app close - not debounced
      window.electronAPI.store.set('tabsState', tabsState)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [tabsState])

  // 🎯 FIX 3: Memoized and optimized updateTabState
  const updateTabState = useCallback(
    (
      tabId: string,
      updates:
        | Partial<Omit<Tab, 'webviewRef'>>
        | ((tab: Tab) => Partial<Omit<Tab, 'webviewRef'>> | null)
    ): void => {
      setTabsState((prev) => {
        const tabIndex = prev.tabs.findIndex((tab) => tab.id === tabId)
        if (tabIndex === -1) {
          console.warn(`⚠️ Tab ${tabId} not found for update`)
          return prev
        }

        const currentTab = prev.tabs[tabIndex]
        const updatedValues = typeof updates === 'function' ? updates(currentTab) : updates

        // 🎯 FIX: If update function returns null, skip the update
        if (!updatedValues) {
          console.log(`⏭️ No updates needed for tab ${tabId}`)
          return prev
        }

        // 🎯 FIX: Check if anything actually changed to prevent unnecessary re-renders
        const hasChanges = Object.keys(updatedValues).some((key) => {
          const newValue = (updatedValues as any)[key]
          const currentValue = (currentTab as any)[key]

          // Deep comparison for arrays (like navigationHistory)
          if (Array.isArray(newValue) && Array.isArray(currentValue)) {
            return JSON.stringify(newValue) !== JSON.stringify(currentValue)
          }

          return newValue !== currentValue
        })

        if (!hasChanges) {
          console.log(`⏭️ No actual changes for tab ${tabId}, skipping update`)
          return prev
        }

        console.log(`🔄 Updating tab ${tabId} state:`, updatedValues)

        const newTabs = [...prev.tabs]
        newTabs[tabIndex] = { ...currentTab, ...updatedValues }

        const newState = { ...prev, tabs: newTabs }

        // 🎯 FIX: Debounce the save operation to prevent rapid file writes
        debouncedSaveTabsState(newState)

        return newState
      })
    },
    [debouncedSaveTabsState]
  )

  // 🎯 FIX 2: Updated goBack function
  const goBack = useCallback((): void => {
    if (!activeTab) return
    const webview = webviewRefs.current.get(activeTab.id)
    if (webview && activeTab.historyIndex > 0) {
      console.log(`⬅️ Going back for tab ${activeTab.id}`)

      // 🎯 FIX: Set programmatic flag using the stored navigation state
      const navigationState = (webview as any)._navigationState
      if (navigationState) {
        navigationState.isNavigatingProgrammatically = true
      }

      const newIndex = activeTab.historyIndex - 1
      const url = activeTab.navigationHistory[newIndex]

      webview
        .loadURL(url)
        .then(() => {
          updateTabState(activeTab.id, {
            historyIndex: newIndex,
            url
          })
        })
        .catch((error) => {
          console.error('❌ Failed to navigate back:', error)
          // Reset programmatic flag on error
          if (navigationState) {
            navigationState.isNavigatingProgrammatically = false
          }
        })
    }
  }, [activeTab, updateTabState])

  // 🎯 FIX 2: Updated goForward function
  const goForward = useCallback((): void => {
    if (!activeTab) return
    const webview = webviewRefs.current.get(activeTab.id)
    if (webview && activeTab.historyIndex < activeTab.navigationHistory.length - 1) {
      console.log(`➡️ Going forward for tab ${activeTab.id}`)

      // 🎯 FIX: Set programmatic flag using the stored navigation state
      const navigationState = (webview as any)._navigationState
      if (navigationState) {
        navigationState.isNavigatingProgrammatically = true
      }

      const newIndex = activeTab.historyIndex + 1
      const url = activeTab.navigationHistory[newIndex]

      webview
        .loadURL(url)
        .then(() => {
          updateTabState(activeTab.id, {
            historyIndex: newIndex,
            url
          })
        })
        .catch((error) => {
          console.error('❌ Failed to navigate forward:', error)
          // Reset programmatic flag on error
          if (navigationState) {
            navigationState.isNavigatingProgrammatically = false
          }
        })
    } else if (webview) {
      webview.goForward() // Use native webview goForward as backup
    }
  }, [activeTab, updateTabState])

  const handleReload = useCallback((): void => {
    if (!activeTab) return
    const webview = webviewRefs.current.get(activeTab.id)
    if (webview) {
      webview.reload()
    }
  }, [activeTab])

  // 🎯 FIX 2: Updated handleUrlSubmit function
  const handleUrlSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault()
      if (!activeTab) return
      const webview = webviewRefs.current.get(activeTab.id)
      if (webview && urlInput) {
        console.log(`🌐 Loading URL for tab ${activeTab.id}:`, urlInput)

        // 🎯 FIX: Set programmatic flag
        const navigationState = (webview as any)._navigationState
        if (navigationState) {
          navigationState.isNavigatingProgrammatically = true
        }

        let processedUrl = urlInput
        if (!urlInput.includes('://')) {
          if (
            urlInput.includes('localhost') ||
            urlInput.startsWith('127.0.0.1') ||
            urlInput.includes(':')
          ) {
            processedUrl = `http://${urlInput}`
          } else {
            processedUrl = `https://${urlInput}`
          }
        }

        webview
          .loadURL(processedUrl)
          .then(() => {
            updateTabState(activeTab.id, {
              url: processedUrl,
              navigationHistory: [
                ...activeTab.navigationHistory.slice(0, activeTab.historyIndex + 1),
                processedUrl
              ],
              historyIndex: activeTab.historyIndex + 1
            })
            setUrlInput('')
          })
          .catch((error) => {
            console.error('❌ Failed to load URL:', error)
            // Reset programmatic flag on error
            if (navigationState) {
              navigationState.isNavigatingProgrammatically = false
            }
          })
      }
    },
    [activeTab, urlInput, updateTabState]
  )

  // 🎯 UPDATED: setupWebview with history recording
  const setupWebview = useCallback((webview: Electron.WebviewTag, tab: Tab): void => {
    if (!webview) return

    // 🎯 FIX: Debounce navigation updates to prevent rapid state changes
    const debouncedUpdateTabState = _.debounce((tabId: string, updates: any) => {
      updateTabState(tabId, updates)
    }, 100) // 100ms debounce

    // 🎯 FIX: Use refs to track navigation state per webview
    const navigationStateRef = {
      isNavigatingProgrammatically: false,
      lastNavigationTime: 0,
      pendingNavigation: null as any
    }

    const handleDidNavigate = (event: Event): void => {
      const navigationEvent = event as WebViewNavigationEvent
      const url = navigationEvent.url
      const now = Date.now()

      console.log(`🧭 Navigation detected for tab ${tab.id}:`, {
        url,
        programmatic: navigationStateRef.isNavigatingProgrammatically,
        timeSinceLastNav: now - navigationStateRef.lastNavigationTime
      })

      // 🎯 FIX: Skip if programmatic navigation
      if (navigationStateRef.isNavigatingProgrammatically) {
        console.log(`⏭️ Skipping programmatic navigation for tab ${tab.id}`)
        navigationStateRef.isNavigatingProgrammatically = false
        return
      }

      // 🎯 FIX: Prevent rapid successive navigation updates
      if (now - navigationStateRef.lastNavigationTime < 50) {
        console.log(`⏭️ Skipping rapid navigation for tab ${tab.id}`)
        return
      }

      navigationStateRef.lastNavigationTime = now

      // 🆕 NEW: Record to history store (but not for blank pages or data URLs)
      if (url !== DEFAULT_BLANK_URL && !url.startsWith('data:text/html')) {
        // Get page title (will be updated later when title loads)
        const title = tab.title !== 'New Tab' ? tab.title : extractDomainFromUrl(url)

        // Add to persistent history
        window.electronAPI.history
          .add({
            url,
            title,
            timestamp: new Date(),
            tabId: tab.id,
            visitCount: 1,
            favicon: getFaviconUrl(url)
          })
          .catch((error) => {
            console.error('Failed to add history entry:', error)
          })
      }

      // 🎯 FIX: Cancel any pending navigation update
      if (navigationStateRef.pendingNavigation) {
        clearTimeout(navigationStateRef.pendingNavigation)
      }

      // 🎯 FIX: Delay the state update to batch multiple rapid navigations
      navigationStateRef.pendingNavigation = setTimeout(() => {
        updateTabState(tab.id, (currentTab) => {
          // Only update if URL actually changed
          if (currentTab.url === url) {
            console.log(`⏭️ URL unchanged for tab ${tab.id}, skipping update`)
            return null
          }

          // Remove all entries after current index before adding new url
          const newHistory = currentTab.navigationHistory.slice(0, currentTab.historyIndex + 1)

          // Only add url if it's different from the last entry
          if (newHistory[newHistory.length - 1] !== url) {
            newHistory.push(url)

            console.log(`✅ Updating navigation state for tab ${tab.id}:`, {
              oldUrl: currentTab.url,
              newUrl: url,
              historyLength: newHistory.length
            })

            return {
              url,
              navigationHistory: newHistory,
              historyIndex: newHistory.length - 1
            }
          }

          console.log(`⏭️ URL already in history for tab ${tab.id}, skipping`)
          return null
        })
      }, 50)
    }

    const handleDidStartLoading = (): void => {
      console.log(`🔄 Loading started for tab ${tab.id}`)
      debouncedUpdateTabState(tab.id, { isLoading: true })
    }

    const handleDidStopLoading = (): void => {
      console.log(`✅ Loading stopped for tab ${tab.id}`)
      debouncedUpdateTabState(tab.id, { isLoading: false })
    }

    const handlePageTitleUpdated = (event: Event): void => {
      const titleEvent = event as CustomEvent<{ title: string }>
      const newTitle = titleEvent.detail.title

      console.log(`📝 Title updated for tab ${tab.id}:`, newTitle)
      debouncedUpdateTabState(tab.id, { title: newTitle })

      // 🆕 NEW: Update history entry with correct title
      if (tab.url !== DEFAULT_BLANK_URL && !tab.url.startsWith('data:text/html')) {
        window.electronAPI.history
          .add({
            url: tab.url,
            title: newTitle,
            timestamp: new Date(),
            tabId: tab.id,
            visitCount: 1,
            favicon: getFaviconUrl(tab.url)
          })
          .catch((error) => {
            console.error('Failed to update history title:', error)
          })
      }
    }

    // 🎯 FIX: Store navigation state ref in webview for programmatic navigation
    ;(webview as any)._navigationState = navigationStateRef

    webview.addEventListener('did-navigate', handleDidNavigate)
    webview.addEventListener('did-navigate-in-page', handleDidNavigate)
    webview.addEventListener('did-start-loading', handleDidStartLoading)
    webview.addEventListener('did-stop-loading', handleDidStopLoading)
    webview.addEventListener('page-title-updated', handlePageTitleUpdated)

    // Store the webview reference
  }, []) // ✅ FIXED: Empty dependency array prevents recreation

  // Save state before unload
  useEffect((): (() => void) => {
    const handleBeforeUnload = (): void => {
      void saveTabsState(tabsState)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return (): void => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [tabsState, saveTabsState])

  const canGoBack = activeTab.historyIndex > 0
  const canGoForward = activeTab.historyIndex < activeTab.navigationHistory.length - 1

  const reorderTabs = useCallback(
    (fromIndex: number, toIndex: number): void => {
      setTabsState((prev) => {
        const newTabs = [...prev.tabs]
        const [movedTab] = newTabs.splice(fromIndex, 1)
        newTabs.splice(toIndex, 0, movedTab)

        const newState = {
          ...prev,
          tabs: newTabs
        }
        debouncedSaveTabsState(newState)
        return newState
      })
    },
    [debouncedSaveTabsState]
  )

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false)
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const handleSidebarHoverEnter = () => {
    if (!isSidebarOpen) {
      // Clear any existing timer
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      setIsHoveringSidebar(true)
    }
  }

  const handleSidebarHoverLeave = (e: React.MouseEvent) => {
    // Only hide the sidebar if the mouse is truly leaving the sidebar area
    // This checks if we're not hovering over the sidebar or any of its children
    if (!isSidebarOpen && isHoveringSidebar) {
      const sidebarElement = document.querySelector('.sidebar-container')
      if (sidebarElement) {
        // Check if the mouse is leaving the sidebar and not entering a child element
        const relatedTarget = e.relatedTarget as Node
        if (!sidebarElement.contains(relatedTarget as Node)) {
          // Add a small delay before hiding to prevent accidental hiding
          hoverTimerRef.current = setTimeout(() => {
            setIsHoveringSidebar(false)
          }, 300)
        }
      }
    }
  }

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
      }
    }
  }, [])

  const updateTabTitle = useCallback(
    (tabId: string, newTitle: string): void => {
      setTabsState((prev) => {
        const newState = {
          ...prev,
          tabs: prev.tabs.map((tab) => (tab.id === tabId ? { ...tab, title: newTitle } : tab))
        }
        debouncedSaveTabsState(newState)
        return newState
      })
    },
    [debouncedSaveTabsState]
  )

  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // **UPDATED: Enhanced permission handling**
  useEffect(() => {
    // Handle the new permission request format
    const handlePermissionRequest = (event: CustomEvent<NewPermissionRequest>) => {
      console.log('🔒 Browser: Received permission request:', event.detail)

      // Convert new format to old format for compatibility with existing dialog
      const oldFormatRequest: PermissionRequest = {
        id: event.detail.id,
        permission: event.detail.permission,
        origin: event.detail.origin,
        displayName: '',
        description: '',
        icon: '',
        details: undefined
      }

      setPermissionRequest(oldFormatRequest)
      setDialogOpen(true)

      // Add to history preview
      const preview: HistoryItem = {
        permission: event.detail.displayName || event.detail.permission,
        origin: event.detail.origin,
        granted: null,
        timestamp: 'Pending...'
      }
      setPermissionHistory((prev) => [preview, ...prev])
    }

    // Listen for the new event type
    document.addEventListener('permission-request', handlePermissionRequest as EventListener)

    return () => {
      document.removeEventListener('permission-request', handlePermissionRequest as EventListener)
    }
  }, [])

  // **UPDATED: Enhanced permission handlers**
  const handlePermissionAllow = () => {
    if (permissionRequest) {
      // Update history with actual result
      const historyItem: HistoryItem = {
        permission: permissionRequest.permission,
        origin: permissionRequest.origin,
        granted: true,
        timestamp: new Date().toLocaleString()
      }

      setPermissionHistory((prev) => {
        const filtered = prev.filter((item) => item.timestamp !== 'Pending...')
        return [historyItem, ...filtered].slice(0, 50)
      })

      // Track screen sharing
      if (permissionRequest.permission === 'display-capture') {
        setActiveScreenShare(true)
        console.log('🖥️ Screen sharing activated')
      }

      setDialogOpen(false)
      setPermissionRequest(null)
    }
  }

  const handlePermissionDeny = () => {
    if (permissionRequest) {
      // Update history with actual result
      const historyItem: HistoryItem = {
        permission: permissionRequest.permission,
        origin: permissionRequest.origin,
        granted: false,
        timestamp: new Date().toLocaleString()
      }

      setPermissionHistory((prev) => {
        const filtered = prev.filter((item) => item.timestamp !== 'Pending...')
        return [historyItem, ...filtered].slice(0, 50)
      })

      setDialogOpen(false)
      setPermissionRequest(null)
    }
  }

  // Fix the property 'id' does not exist errors
  const handleDialogClose = () => {
    if (permissionRequest) {
      setDialogOpen(false)
      setPermissionRequest(null)
    }
  }

  // **NEW: Downloads handler functions**
  const handlePauseDownload = async (downloadId: string) => {
    try {
      await window.electronAPI.downloads.pause(downloadId)
    } catch (error) {
      console.error('Failed to pause download:', error)
    }
  }

  const handleResumeDownload = async (downloadId: string) => {
    try {
      await window.electronAPI.downloads.resume(downloadId)
    } catch (error) {
      console.error('Failed to resume download:', error)
    }
  }

  const handleCancelDownload = async (downloadId: string) => {
    try {
      await window.electronAPI.downloads.cancel(downloadId)
    } catch (error) {
      console.error('Failed to cancel download:', error)
    }
  }

  const handleDeleteDownload = async (downloadId: string) => {
    if (confirm('Are you sure you want to delete this download and its file?')) {
      try {
        await window.electronAPI.downloads.delete(downloadId)
      } catch (error) {
        console.error('Failed to delete download:', error)
      }
    }
  }

  const handleRedownload = async (downloadId: string) => {
    try {
      await window.electronAPI.downloads.redownload(downloadId)
    } catch (error) {
      console.error('Failed to redownload:', error)
    }
  }

  const handleOpenFileLocation = async (downloadId: string) => {
    try {
      await window.electronAPI.downloads.openFileLocation(downloadId)
    } catch (error) {
      console.error('Failed to open file location:', error)
    }
  }

  const handleClearAllDownloads = async () => {
    try {
      await window.electronAPI.downloads.clearAll()
      setDownloads([])
    } catch (error) {
      console.error('Failed to clear downloads:', error)
    }
  }

  const [securityWarningOpen, setSecurityWarningOpen] = useState(false)
  const [warningUrl, setWarningUrl] = useState('')
  const [threats, setThreats] = useState<Array<{ threatType: string; details: string }>>([])

  // Add this useEffect to your Browser component
  useEffect(() => {
    const handleSecurityWarning = (event: CustomEvent) => {
      const { url, threats } = event.detail
      setWarningUrl(url)
      setThreats(threats)
      setSecurityWarningOpen(true)
    }

    document.addEventListener('show-security-warning', handleSecurityWarning as EventListener)

    return () => {
      document.removeEventListener('show-security-warning', handleSecurityWarning as EventListener)
    }
  }, [])

  // Add these handler functions to your Browser component
  const handleGoBackToSafety = () => {
    setSecurityWarningOpen(false)

    // If we have an active tab and it can go back, navigate back
    if (activeTab) {
      const webview = webviewRefs.current.get(activeTab.id)
      if (webview && webview.canGoBack()) {
        webview.goBack()
      }
    }
  }

  const handleProceedAnyway = (url: string) => {
    setSecurityWarningOpen(false)

    // Tell the main process the user wants to proceed
    window.electronAPI.security.proceedAnyway(url)

    // Note: Actual navigation won't happen automatically as the certificate was already rejected
  }

  useEffect(() => {
    const handleCreateAsteriskTab = () => {
      addTab(DEFAULT_BLANK_URL, { type: 'tool', toolType: 'Asterisk' })
    }

    // Add event listener for the custom event
    window.addEventListener('create-asterisk-tab', handleCreateAsteriskTab)

    // Clean up the event listener on unmount
    return () => {
      window.removeEventListener('create-asterisk-tab', handleCreateAsteriskTab)
    }
  }, [addTab])

  // Add this useEffect in Browser.tsx after line ~200 (after existing useEffects)
  useEffect(() => {
    let lastEventTime = 0

    const handleCreateNewTab = (event: CustomEvent) => {
      console.log('🔥 Browser: ========== NEW TAB EVENT RECEIVED ==========')

      // Debounce multiple rapid events
      const now = Date.now()
      if (now - lastEventTime < 500) {
        // Ignore events within 500ms
        console.log('🔥 Browser: Ignoring duplicate event (too soon)')
        return
      }
      lastEventTime = now

      console.log('🔥 Browser: Full event:', event)
      console.log('🔥 Browser: Event detail:', event.detail)

      if (!event.detail) {
        console.error('🔥 Browser: No event.detail found')
        return
      }

      const { url } = event.detail
      console.log('🔥 Browser: Extracted URL:', url)

      // Validation
      if (!url || typeof url !== 'string') {
        console.error('🔥 Browser: Invalid URL received:', url)
        return
      }

      console.log('🔥 Browser: Creating new tab with URL:', url)

      // Use your existing addTab function
      addTab(url)
    }

    // Listen for the custom event
    console.log('🔥 Browser: Setting up create-new-tab event listener')
    document.addEventListener('create-new-tab', handleCreateNewTab as EventListener)

    return () => {
      console.log('🔥 Browser: Removing create-new-tab event listener')
      document.removeEventListener('create-new-tab', handleCreateNewTab as EventListener)
    }
  }, [addTab])

  const [showSharePanel, setShowSharePanel] = useState(false)
  const [showSourceMenu, setShowSourceMenu] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [sourceTitle, setSourceTitle] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState('')

  const handleShareWindow = async () => {
    console.log('📱 Share window clicked')
    setShareLoading(true)
    setShareError('')

    try {
      const windowSources = await window.electronAPI.ipcRenderer.invoke('get-window-sources')
      console.log('📱 Got window sources:', windowSources.length)
      showSources(windowSources, '📱 Select Window to Share')
    } catch (err: any) {
      console.error('❌ Error getting window sources:', err)
      setShareError('Failed to get window sources: ' + err.message)
    } finally {
      setShareLoading(false)
    }
  }

  const handleShareScreen = async () => {
    console.log('🖥️ Share screen clicked')
    setShareLoading(true)
    setShareError('')

    try {
      const screenSources = await window.electronAPI.ipcRenderer.invoke('get-screen-sources')
      console.log('🖥️ Got screen sources:', screenSources.length)
      showSources(screenSources, '🖥️ Select Screen to Share')
    } catch (err: any) {
      console.error('❌ Error getting screen sources:', err)
      setShareError('Failed to get screen sources: ' + err.message)
    } finally {
      setShareLoading(false)
    }
  }

  const showSources = (sourceList: Source[], title: string) => {
    console.log('📋 Showing sources:', sourceList.length)
    setSources(sourceList)
    setSourceTitle(title)
    setShowSourceMenu(true)
  }

  const handleSelectSource = async (source: Source) => {
    console.log('✅ Source selected:', source)

    try {
      const result = await window.electronAPI.ipcRenderer.invoke('source-selected', source.id)
      console.log('✅ Source selection sent:', result)

      if (result.success) {
        setShowSharePanel(false)
        setShowSourceMenu(false)
      } else {
        setShareError('Failed to select source: ' + result.error)
      }
    } catch (err: any) {
      console.error('❌ Error selecting source:', err)
      setShareError('Error selecting source: ' + err.message)
    }
  }

  const handleCancelShare = async () => {
    console.log('❌ Share cancelled')

    try {
      await window.electronAPI.ipcRenderer.invoke('share-cancelled')
      console.log('❌ Share cancellation sent')
    } catch (err: any) {
      console.error('❌ Error cancelling share:', err)
    } finally {
      setShowSharePanel(false)
      setShowSourceMenu(false)
      setShareError('')
    }
  }

  const handleBackToMain = () => {
    setShowSourceMenu(false)
    setShareError('')
  }

  useEffect(() => {
    const handleShowSharePanel = () => {
      console.log('📨 Received show-share-panel event')
      setShowSharePanel(true)
      setShowSourceMenu(false)
      setShareError('')
    }

    document.addEventListener('show-share-panel', handleShowSharePanel)

    return () => {
      document.removeEventListener('show-share-panel', handleShowSharePanel)
    }
  }, [])

  // 🔍 DEBUG: Add temporary debug logging
  useEffect(() => {
    console.log('🔍 TabsState changed:', {
      tabCount: tabsState.tabs.length,
      activeTab: tabsState.activeTabId,
      tabs: tabsState.tabs.map((t) => ({ id: t.id, url: t.url, loading: t.isLoading }))
    })
  }, [tabsState])

  const [pipState, setPipState] = useState<{
    isOpen: boolean
    tabId: string | null
    url: string
    title: string
    currentUrl?: string
  } | null>(null)

  const handleTogglePictureInPicture = useCallback(
    (tabId: string): void => {
      const tab = tabsState.tabs.find((t) => t.id === tabId)
      if (!tab) return

      if (pipState?.isOpen && pipState.tabId === tabId) {
        // Close PiP if it's already open for this tab
        setPipState(null)
      } else {
        // Open PiP or switch to this tab
        setPipState({
          isOpen: true,
          tabId: tabId,
          url: tab.url,
          title: tab.title,
          currentUrl: tab.url // Initialize with original URL
        })
      }
    },
    [tabsState.tabs, pipState]
  )

  // Add this function to handle PiP close
  const handleClosePictureInPicture = useCallback((): void => {
    setPipState(null)
  }, [])

  // Add this function to handle webview setup for PiP
  const handlePipWebviewReady = useCallback((webview: Electron.WebviewTag, tabId: string): void => {
    // You can add any specific setup for PiP webview here
    console.log('PiP webview ready for tab:', tabId)

    // Optional: Sync with main webview events
    webview.addEventListener('did-navigate', (event: any) => {
      console.log('PiP navigated to:', event.url)
    })
  }, [])

  // Add this function to handle PiP URL changes
  const handlePipUrlChange = useCallback((tabId: string, newUrl: string): void => {
    setPipState((prev) => {
      if (prev && prev.tabId === tabId) {
        return {
          ...prev,
          currentUrl: newUrl
        }
      }
      return prev
    })
  }, [])

  const handleOpenPipInNewTab = useCallback(
    (url: string): void => {
      console.log('Opening PiP content in new tab:', url)
      addTab(url)
    },
    [addTab]
  )

  // NEW: Handle opening PiP from URL (for editor webviews)
  const handleOpenPictureInPictureFromUrl = useCallback((url: string, title?: string): void => {
    console.log('Opening PiP from URL:', url)

    // Validate URL format
    if (!url || typeof url !== 'string') {
      console.error('Invalid URL provided for PiP:', url)
      return
    }

    try {
      new URL(url) // Validate URL
    } catch (error) {
      console.error('Invalid URL format for PiP:', url)
      return
    }

    // Create a unique ID for this PiP instance
    const pipId = `editor-webview-${Date.now()}`

    // Set PiP state with the URL
    setPipState({
      isOpen: true,
      tabId: pipId, // Use unique ID instead of actual tab ID
      url: url,
      title: title || 'Editor Webview',
      currentUrl: url
    })
  }, [])

  const handleAddPipToEditor = useCallback(
    (url: string): void => {
      console.log('Adding PiP content to Asterisk editor:', url)

      // Find the Asterisk tab (tool tab)
      const asteriskTab = tabsState.tabs.find(
        (tab) => tab.type === 'tool' && tab.toolType === 'Asterisk'
      )

      if (asteriskTab) {
        // Switch to the Asterisk tab
        switchTab(asteriskTab.id)

        // Dispatch custom event to add webview to editor
        const event = new CustomEvent('add-webview-to-editor', {
          detail: {
            url: url,
            tabId: asteriskTab.id
          }
        })

        // Small delay to ensure tab switch is complete
        setTimeout(() => {
          document.dispatchEvent(event)
        }, 100)
      } else {
        // If no Asterisk tab exists, create one first
        addTab(DEFAULT_BLANK_URL, { type: 'tool', toolType: 'Asterisk' })

        // Wait a bit longer for the new tab to be ready, then dispatch the event
        // The addTab function automatically sets the new tab as active, so we can use activeTabId
        setTimeout(() => {
          const event = new CustomEvent('add-webview-to-editor', {
            detail: {
              url: url,
              tabId: tabsState.activeTabId // The newly created tab will be the active tab
            }
          })
          document.dispatchEvent(event)
        }, 300)
      }
    },
    [tabsState.tabs, tabsState.activeTabId, switchTab, addTab]
  )

  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false)
const [quoteDialogUrl, setQuoteDialogUrl] = useState('')
const [quoteDialogTitle, setQuoteDialogTitle] = useState('')

const handleOpenQuoteDialog = useCallback(() => {
  const activeTab = tabsState.tabs.find(tab => tab.id === tabsState.activeTabId);
  
  if (!activeTab || !activeTab.url) {
    console.log('No active tab or URL found');
    return;
  }

  // Don't open for blank pages
  if (activeTab.url === DEFAULT_BLANK_URL || activeTab.url.startsWith('data:text/html')) {
    console.log('Cannot open quote dialog for blank page');
    return;
  }

  // Ensure URL is properly formatted
  try {
    new URL(activeTab.url); // Validate URL
    setQuoteDialogUrl(activeTab.url);
    setQuoteDialogTitle(activeTab.title);
    setIsQuoteDialogOpen(true);
  } catch (error) {
    console.error('Invalid URL:', activeTab.url);
  }
}, [tabsState.tabs, tabsState.activeTabId]);

  const viewContextValue = {
    activeTabId: tabsState.activeTabId,
    webviewRefs,
    updateTabState,
    activeTab: tabsState.tabs.find((tab) => tab.id === tabsState.activeTabId)!,
    // **NEW: Add permission history to context**
    permissionHistory,
    activeScreenShare,
    // **NEW: Add downloads context**
    downloads,
    downloadHandlers: {
      onPause: handlePauseDownload,
      onResume: handleResumeDownload,
      onCancel: handleCancelDownload,
      onDelete: handleDeleteDownload,
      onRedownload: handleRedownload,
      onOpenLocation: handleOpenFileLocation,
      onClearAll: handleClearAllDownloads
    },
    pipState,
    onTogglePictureInPicture: handleTogglePictureInPicture
  }

  return (
    <ViewProvider value={viewContextValue}>
      <div className="flex flex-col h-screen overflow-y-hidden">
        <TopNavBar
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          goBack={goBack}
          goForward={goForward}
          handleReload={handleReload}
          activeTabUrl={activeTab.url}
          addTab={addTab}
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
          isTabLoading={activeTab.isLoading}
          activeTabId={tabsState.activeTabId}
          tabs={tabsState.tabs}
          webviewRefs={webviewRefs}
        />
        <div className="flex flex-1 relative">
          {/* Hover detection zone when sidebar is closed */}
          {!isSidebarOpen && (
            <div
              className="absolute left-0 top-0 bottom-0 w-4 z-10"
              onMouseEnter={handleSidebarHoverEnter}
            />
          )}

          {/* Sidebar with different positioning based on state */}
          <div
            className={`
      sidebar-container
      transition-all duration-300 ease-in-out
      ${isSidebarOpen ? 'relative flex-shrink-0 w-[220px]' : 'absolute left-0 top-0 bottom-0 z-50'}
      ${isHoveringSidebar && !isSidebarOpen ? 'w-[220px] shadow-lg' : !isSidebarOpen ? 'w-0' : ''}
      ${!isSidebarOpen && !isHoveringSidebar ? 'opacity-0' : 'opacity-100'}
    `}
            onMouseLeave={handleSidebarHoverLeave}
          >
            <Sidebar
              tabs={tabsState.tabs}
              activeTabId={tabsState.activeTabId}
              switchTab={switchTab}
              closeTab={closeTab}
              addTab={addTab}
              reorderTabs={reorderTabs}
              isOpen={isSidebarOpen || isHoveringSidebar}
              updateTabTitle={updateTabTitle}
              updateTabState={updateTabState}
              isHovering={isHoveringSidebar && !isSidebarOpen}
              downloads={downloads}
              downloadHandlers={{
                onPause: handlePauseDownload,
                onResume: handleResumeDownload,
                onCancel: handleCancelDownload,
                onDelete: handleDeleteDownload,
                onRedownload: handleRedownload,
                onOpenLocation: handleOpenFileLocation,
                onClearAll: handleClearAllDownloads
              }}
              pipState={pipState}
              onTogglePictureInPicture={handleTogglePictureInPicture}
              onOpenQuoteDialog={handleOpenQuoteDialog}
            />
          </div>

          <div
            className={`
    flex-1 flex flex-col p-1 pt-2 
    transition-all duration-500 ease-in-out
    ${isSidebarOpen ? 'ml-0' : 'ml-0 w-full'}
  `}
            style={{
              marginLeft: isSidebarOpen ? '0' : isHoveringSidebar ? '0' : '0',
              width: isSidebarOpen ? 'calc(100% - 15rem)' : '100%',
              transition: 'width 500ms ease-in-out, margin-left 500ms ease-in-out'
            }}
          >
            {/* MainView - now takes full available space */}
            <div className="flex-1 flex">
              <MainView
                tabs={tabsState.tabs}
                activeTabId={tabsState.activeTabId}
                setupWebview={setupWebview}
                webviewRefs={webviewRefs}
                updateTabState={updateTabState}
                isSidebarOpen={isSidebarOpen}
                addTab={addTab}
                onTogglePictureInPicture={handleTogglePictureInPicture}
                onOpenPictureInPictureFromUrl={handleOpenPictureInPictureFromUrl}
                isSidebarHovering={isHoveringSidebar}
              />
            </div>
          </div>
        </div>
        <PermissionDialog
          isOpen={dialogOpen}
          permissionRequest={permissionRequest}
          onClose={handleDialogClose}
          onAllow={handlePermissionAllow}
          onDeny={handlePermissionDeny}
        />
        <SecurityWarningModal
          isOpen={securityWarningOpen}
          url={warningUrl}
          threats={threats}
          onClose={() => setSecurityWarningOpen(false)}
          onProceed={handleProceedAnyway}
          onGoBack={handleGoBackToSafety}
        />
        <ScreenShareModal
          showSharePanel={showSharePanel}
          showSourceMenu={showSourceMenu}
          sources={sources}
          sourceTitle={sourceTitle}
          loading={shareLoading}
          error={shareError}
          onShareWindow={handleShareWindow}
          onShareScreen={handleShareScreen}
          onSelectSource={handleSelectSource}
          onCancel={handleCancelShare}
          onBackToMain={handleBackToMain}
        />

        {/* **NEW: Active Screen Share Indicator** */}
        {activeScreenShare && (
          <div className="fixed top-20 left-5 px-4 py-2 rounded-full text-xs font-semibold z-50 bg-green-500/20 text-green-400 border border-green-500">
            🖥️ Screen sharing active
          </div>
        )}
      </div>
      <AnimatePresence>
        {pipState?.isOpen && (
          <PictureInPictureWindow
            url={pipState.url}
            title={pipState.title}
            tabId={pipState.tabId!}
            onClose={handleClosePictureInPicture}
            onWebviewReady={handlePipWebviewReady}
            onUrlChange={handlePipUrlChange}
            onOpenInNewTab={handleOpenPipInNewTab}
            onAddToEditor={handleAddPipToEditor}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
  {isQuoteDialogOpen && (
    <DraggableDialog
      isOpen={isQuoteDialogOpen}
      onClose={() => setIsQuoteDialogOpen(false)}
      title={quoteDialogTitle}
      url={quoteDialogUrl}
      tabs={tabsState.tabs}  
      switchTab={switchTab}
    />
  )}
</AnimatePresence>
    </ViewProvider>
  )
}

export default Browser