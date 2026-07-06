/**
 * Renderer hook for SerpAPI search IPC calls.
 * Attaches the user's geolocation (from Python/Mapbox) to improve result relevance.
 */
import { useState, useCallback, useEffect } from 'react';
import { useLocation } from './Location/useLocation';
import type { 
  LocationParams, 
  SearchResult, 
  ImageResult, 
  VideoResult 
} from '../types/types';

export const useElectronSearch = () => {
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isElectronAvailable, setIsElectronAvailable] = useState(false);
  const { locationData } = useLocation();

  useEffect(() => {
    const checkElectron = () => {
      const isAvailable = Boolean(window.electronAPI?.ipcRenderer);
      setIsElectronAvailable(isAvailable);
    };
    checkElectron();
  }, []);

  const getLocationParams = (): LocationParams | Record<string, never> => {
    if (!locationData) return {};
    
    return {
      location: `${locationData.district},${locationData.region},${locationData.country}`,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      gl: locationData.country?.toLowerCase(),
      hl: navigator.language,
    };
  };

  // Check for electron availability on mount
  useEffect(() => {
    const checkElectron = () => {
      const isAvailable = Boolean(window.electronAPI?.ipcRenderer);
      console.log('Electron availability:', isAvailable);
      setIsElectronAvailable(isAvailable);
      
      if (!isAvailable) {
        console.error('Electron API not found in window object:', window);
      }
    };

    checkElectron();
  }, []);

  const searchWeb = useCallback(async (query: string): Promise<SearchResult[]> => {
    if (!isElectronAvailable) {
      throw new Error('Electron API not available');
    }

    setIsSearching(true);
    setError(null);
    
    try {
      const locationParams = getLocationParams();
      const results = await window.electronAPI.ipcRenderer.invoke('search-serp', query, locationParams);

      if (!results || !results.organic_results) {
        throw new Error('Invalid search results format');
      }

      return results.organic_results.map((result: any) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Web search failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsSearching(false);
    }
  }, [isElectronAvailable, locationData]);


  const searchImages = useCallback(async (query: string): Promise<ImageResult[]> => {
    if (!isElectronAvailable) {
      throw new Error('Electron API not available');
    }

    setIsSearching(true);
    setError(null);
    
    try {
      const locationParams = getLocationParams();
      const results = await window.electronAPI.ipcRenderer.invoke('search-images', query, locationParams);

      if (!results || !results.images_results) {
        throw new Error('Invalid image results format');
      }

      return results.images_results.map((img: any) => ({
        url: img.original || img.link,
        title: img.title || 'Untitled Image',
        thumbnail: img.thumbnail
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Image search failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsSearching(false);
    }
  }, [isElectronAvailable, locationData]);

  const searchVideos = useCallback(async (query: string): Promise<VideoResult[]> => {
    if (!isElectronAvailable) {
      throw new Error('Electron API not available');
    }

    setIsSearching(true);
    setError(null);
    
    try {
      const locationParams = getLocationParams();
      const results = await window.electronAPI.ipcRenderer.invoke('search-videos', query, locationParams);

      if (!results || !results.video_results) {
        throw new Error('Invalid video results format');
      }

      return results.video_results.map((video: any) => ({
        title: video.title || 'Untitled Video',
        link: video.link,
        thumbnail: video.thumbnail,
        duration: video.duration || 'Unknown duration',
        platform: video.platform || 'Unknown platform',
        date: video.date || 'Unknown date'
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Video search failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsSearching(false);
    }
  }, [isElectronAvailable, locationData]);


  return {
    searchWeb,
    searchImages,
    searchVideos,
    isSearching,
    locationData,
    error,
    isElectronAvailable
  };
};  