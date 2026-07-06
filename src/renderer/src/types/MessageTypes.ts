import { ChartData, YouTubeResult } from '../types/types';
import { ProductQueryAnalysis } from '../ai/Products/ProductAnalyzer';
import { ImageAnalysisResult } from '../ai/ImageSearch/ImageAnalyzer';

export interface ChatMessageProps {
    message: EnhancedMessage;
    messageIndex: number;
    tabId: string;
  }

export interface ImageResult {
  url: string;
  title: string;
  thumbnail: string;
}

export interface VideoResult {
  link: string;
  title: string;
  thumbnail: string;
  duration: string;
  platform: string;
  date: string;
}

export interface MapResult {
  title: string;
  rating?: number;
  reviews?: number;
  address?: string;
  website?: string;
  mapsUrl?: string;
  hours?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  gps_coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface MapLocation {
  title: string;
  latitude: number;    // Required
  longitude: number;   // Required
  rating?: number;
  reviews?: number;
  address?: string;
  website?: string;
  mapsUrl?: string;
  hours?: string;
}

export interface CodeBlockProps {
  language: string;
  code: string;
}

export interface EnhancedMessage {
  role: 'user' | 'assistant';
  content: string;
  codeBlocks?: CodeBlockProps[];
  isLoading?: boolean;
  pureResponse?: string;
  webResponse?: string;
  searchResults?: string;
  imageResults?: ImageResult[];
  videoResults?: VideoResult[];
  mapResults?: MapResult[];
  isLocationBased?: boolean;
  chart?: ChartData;
  productData?: {
    displayType: 'product-list' | 'product-comparison' | 'category-overview';
    searchQuery: string;
    analysis: ProductQueryAnalysis;
    products: any[];
  };
  youtubeResults?: YouTubeResult[];
  messageHistory?: string[];
  imageData?: {
    displayType: 'image-analysis';
    searchQuery: string;
    analysis: ImageAnalysisResult;
    imageResults?: ImageResult[];
    imageData: string;
    imageName: string;
    allImages?: Array<{src: string, name: string}>;
  };
    structuredData?: {
    text: string;
    pastedItems: Array<{id: string, content: string, timestamp: number}>;
    uploadedFiles: Array<{id: string, name: string, content: string, fileInfo: any, timestamp: number}>;
    uploadedImages: Array<{id: string, src: string, name?: string}>;
    timestamp: number;
  };
}