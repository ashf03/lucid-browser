// src/hooks/useAutocomplete.ts

import { useState, useCallback } from 'react';
import _ from 'lodash';
import { useLocation } from './Location/useLocation';

interface AutocompleteSuggestion {
  suggestion: string;
  type: string;
}

export const useAutocomplete = () => {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { locationData } = useLocation();

  const fetchSuggestions = useCallback(
    _.debounce(async (query: string) => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await window.electronAPI.ipcRenderer.invoke(
          'search-autocomplete',
          query
        );

        setSuggestions(response.suggestions || []);
      } catch (error) {
        console.error('Autocomplete error:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [locationData]
  );

  return {
    suggestions,
    isLoading,
    fetchSuggestions
  };
};