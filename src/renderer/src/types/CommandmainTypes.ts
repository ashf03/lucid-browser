import { Tab } from "./types";

export interface CommandMainProps {
  tabs: Tab[];
  switchTab: (tabId: string) => void;
  activeTabId: string;
  tabId: string;
  tabGroups?: TabGroup[];
}

export interface TabGroup {
  id: string;
  name: string;
  tabIds: string[];
  isOpen: boolean;
}

export interface PasteToken {
    id: string;
    content: string;
}

export interface PastePosition {
    startMarkerPos: number;
    endMarkerPos: number;
    displayPos: number;
}

export interface TranscriptionResult {
  text: string;
  language_code?: string;
  language_probability?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
  error?: string;
}

export interface TranscriptionOptions {
  language: string;
  tag_audio_events: boolean;
  diarize: boolean;
}

export interface UploadedImage {
  src: string;
  name: string;
}