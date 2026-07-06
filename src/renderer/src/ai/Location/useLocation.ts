/** Fetches device location via main-process Python script (get-location IPC). */
import React, { useEffect, useState } from 'react';
import { LocationData } from '../../types/types';

export const useLocation = () => {
  const [error, setError] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);

  const getLocation = async () => {
    setLoading(true);
    try {
      // @ts-ignore - window.electron will be injected
      const location = await window.electronAPI.ipcRenderer.invoke('get-location');
      setLocationData(location);
    } catch (error) {
      setLocationData({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to get location'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getLocation();
  }, []);
  return { locationData, error };
};