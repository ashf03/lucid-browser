import type { WebViewElement } from '../../../types/types'
import Electron from 'electron'

// In types/types.ts
export interface Tab {
  id: string;
  title: string;
  url: string;
  isLoading: boolean;
  navigationHistory: string[];
  historyIndex: number;
  webviewRef: React.RefObject<WebViewElement>;
  active: boolean;
  isPinned?: boolean;
  type?: 'standard' | 'tool';  // Add this
  toolType?: 'Asterisk';         // Add this
  icon?: React.ComponentType<any>; // Add this if not present
}

export interface EnhancedPermissionRequest {
  id: number;
  permission: string;
  displayName: string;
  description: string;
  icon: string;
  origin: string;
  details: any;
}

export interface PermissionHistoryItem {
  permission: string;
  origin: string;
  granted: boolean | null;
  timestamp: string;
}

export interface HistoryItem {
  url: string;
  timestamp: Date;
  title: string;
}

export interface GroupedHistory {
  [key: string]: HistoryItem[];
}

export interface TabsState {
  tabs: Tab[]
  activeTabId: string
}

export interface WebViewProps {
  tab: Tab
  isActive: boolean
  setupWebview: (webview: Electron.WebviewTag, tab: Tab) => void
  webviewRefs: React.MutableRefObject<Map<string, Electron.WebviewTag>>
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface LocationData {
  status: string;
  error?: string;
  latitude?: number;
  longitude?: number;
  street?: string;
  locality?: string;
  place?: string;
  district?: string;
  region?: string;
  postcode?: string;
  country?: string;
  full_address?: string;
}

export interface LocationParams {
  location?: string;
  latitude?: number;
  longitude?: number;
  gl?: string;
  hl?: string;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface ImageResult {
  url: string;
  title: string;
  thumbnail: string;
}

export interface VideoResult {
  title: string;
  link: string;
  thumbnail: string;
  duration: string;
  platform: string;
  date: string;
}

export interface MapResult {
  title: string;
  rating?: number;
  reviews?: number;
  type?: string;
  address?: string;
  phone?: string;
  website?: string;
  description?: string;
  hours?: string;
  mapsUrl: string;
  thumbnail?: string;
}

export interface ChartData {
  type: 'pie' | 'line' | 'bar';
  data: Array<{ [key: string]: string | number }>;
  dataKey: string;
  nameKey: string;
  title?: string;
}

export interface DisplayComponents {
  showOverview?: boolean;
  showHeatmap?: boolean;
  showChart?: boolean;
  showFinancials?: boolean;
  showNews?: boolean;
  showScreener?: boolean;
}

export interface ComparisonSymbol {
  symbol: string;
  position: "SameScale";
}

export interface QueryAnalysis {
  isLocationBased: boolean;
  locationType: 'specific-place' | 'near-me' | 'place-type' | 'none';
  locationConfidence: number;
  locationReasoning: string;
  place?: string;
  placeType?: string;
  searchRadius?: string;
  symbols?: string[];
  metrics?: string[];
  displayComponents?: DisplayComponents;
}

export interface YouTubeResult {
  title: string;
  link: string;
  thumbnail: string;
  duration?: string;
  views?: string;
  uploadedAt?: string;
  isShort?: boolean;
  channelName?: string;
}

export interface BrowserBookmark {
  name: string;
  url: string;
  dateAdded: Date;
  type: 'bookmark';
}

export interface BookmarkFolder {
  name: string;
  type: 'folder';
  children: (BrowserBookmark | BookmarkFolder)[];
}

export interface BookmarksData {
  bookmarkBar: (BrowserBookmark | BookmarkFolder)[];
  otherBookmarks: (BrowserBookmark | BookmarkFolder)[];
}

export interface HistoryItem {
  url: string;
  title: string;
  visitCount: number;
  lastVisit: Date;
}

export interface BrowserImportResult {
  success: boolean;
  error?: string;
  bookmarks?: BookmarksData;
  history?: HistoryItem[];
}