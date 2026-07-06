/** Provides active tab + webview refs to deeply nested components (e.g. Editor, AI chat). */
import React, { createContext, useContext, Dispatch, SetStateAction } from 'react';
import type { Tab } from '../../types/types';
import Electron from 'electron';

interface ViewContextType {
  activeTabId: string;
  webviewRefs: React.MutableRefObject<Map<string, Electron.WebviewTag>>;
  updateTabState: (
    tabId: string,
    updates: Partial<Omit<Tab, 'webviewRef'>> | ((tab: Tab) => Partial<Omit<Tab, 'webviewRef'>> | null)
  ) => void;
  activeTab: Tab;
}

export const ViewContext = createContext<ViewContextType | undefined>(undefined);

export const useView = () => {
  const context = useContext(ViewContext);
  if (context === undefined) {
    throw new Error('useView must be used within a ViewProvider');
  }
  return context;
};

export const ViewProvider: React.FC<{
  children: React.ReactNode;
  value: ViewContextType;
}> = ({ children, value }) => {
  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
};