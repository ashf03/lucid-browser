import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import DownloadNotification from './DownloadNotification';

interface Download {
  id: string;
  filename: string;
  url: string;
  totalBytes: number;
  receivedBytes: number;
  state: string;
  startTime: string;
  endTime: string | null;
  savePath: string;
  canResume: boolean;
}

interface DownloadHandlers {
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onRedownload: (id: string) => void;
  onOpenLocation: (id: string) => void;
  onClearAll: () => void;
}

interface NotificationManagerProps {
  downloads: Download[];
  downloadHandlers: DownloadHandlers;
  maxNotifications?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const NotificationManager: React.FC<NotificationManagerProps> = ({
  downloads,
  downloadHandlers,
  maxNotifications = 5,
  position = 'bottom-right'
}) => {
  const [activeNotifications, setActiveNotifications] = useState<Set<string>>(new Set());
  const [previousDownloads, setPreviousDownloads] = useState<Map<string, Download>>(new Map());

  // Filter downloads that should show notifications
  const notifiableDownloads = downloads.filter(download => 
    download.state === 'progressing' || 
    download.state === 'paused' || 
    download.state === 'completed' ||
    download.state === 'interrupted' ||
    download.state === 'cancelled'
  );

  // Handle new downloads or state changes
  useEffect(() => {
    // Deduplicate downloads first to prevent duplicate notifications
    const deduplicatedDownloads = new Map();
    notifiableDownloads.forEach(download => {
      deduplicatedDownloads.set(download.id, download);
    });
    
    const uniqueDownloads = Array.from(deduplicatedDownloads.values());
    
    uniqueDownloads.forEach(download => {
      const previous = previousDownloads.get(download.id);
      
      // Show notification for new downloads or important state changes
      const shouldShowNotification = 
        !previous || // New download
        (previous.state !== download.state && 
         (download.state === 'progressing' || 
          download.state === 'completed' || 
          download.state === 'interrupted' ||
          download.state === 'cancelled'));

      if (shouldShowNotification && !activeNotifications.has(download.id)) {
        // Limit number of notifications
        if (activeNotifications.size < maxNotifications) {
          setActiveNotifications(prev => new Set([...prev, download.id]));
        }
      }
    });

    // Update previous downloads tracking with unique downloads only
    const newPreviousDownloads = new Map();
    uniqueDownloads.forEach(download => {
      newPreviousDownloads.set(download.id, { ...download });
    });
    setPreviousDownloads(newPreviousDownloads);

    // Clean up notifications for downloads that no longer exist
    setActiveNotifications(prev => {
      const updated = new Set(prev);
      const currentDownloadIds = new Set(uniqueDownloads.map(d => d.id));
      
      prev.forEach(notificationId => {
        if (!currentDownloadIds.has(notificationId)) {
          updated.delete(notificationId);
        }
      });
      
      return updated;
    });
  }, [downloads, maxNotifications, activeNotifications.size]);

  const handleCloseNotification = useCallback((downloadId: string) => {
    setActiveNotifications(prev => {
      const updated = new Set(prev);
      updated.delete(downloadId);
      return updated;
    });
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
      default:
        return 'bottom-4 right-4';
    }
  };

  // Get downloads that should show notifications (deduplicated)
  const deduplicatedNotifications = new Map();
  notifiableDownloads
    .filter(download => activeNotifications.has(download.id))
    .forEach(download => {
      deduplicatedNotifications.set(download.id, download);
    });
  
  const notificationsToShow = Array.from(deduplicatedNotifications.values())
    .slice(0, maxNotifications);

  if (notificationsToShow.length === 0) {
    return null;
  }

  return createPortal(
    <div className={`fixed ${getPositionClasses()} z-50 pointer-events-none`}>
      <div className="space-y-3 pointer-events-auto">
        {notificationsToShow.map((download, index) => (
          <div
            key={download.id}
            style={{
              transform: `translateY(${index * -10}px)`,
              zIndex: 1000 - index
            }}
          >
            <DownloadNotification
              download={download}
              onClose={handleCloseNotification}
              onPause={downloadHandlers.onPause}
              onResume={downloadHandlers.onResume}
              onCancel={downloadHandlers.onCancel}
              autoCloseDelay={download.state === 'completed' ? 5000 : 0}
            />
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
};

export default NotificationManager;