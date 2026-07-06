// src/store/titleStore.ts
import { Tab } from '../types/types';

interface TitleStore {
  manuallySetTitles: Set<string>;
  tempAITitles: Map<string, string>;
  getDisplayTitle: (tab: Tab) => string;
}

export const titleStore: TitleStore = {
  manuallySetTitles: new Set<string>(),
  tempAITitles: new Map<string, string>(),
  
  getDisplayTitle(tab: Tab): string {
    // If manually set, use the tab's stored title
    if (this.manuallySetTitles.has(tab.id)) {
      return tab.title || 'New Tab';
    }
    
    // If temporary AI title exists, use it
    if (this.tempAITitles.has(tab.id)) {
      return this.tempAITitles.get(tab.id) || 'New Tab';
    }
    
    // Default to tab's title or 'New Tab'
    return tab.title || 'New Tab';
  }
};