import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pause, Play, DownloadSimple, CheckCircle } from '@phosphor-icons/react';
import { AlertCircle } from 'lucide-react';

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

interface DownloadNotificationProps {
  download: Download;
  onClose: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
  autoCloseDelay?: number;
}

const DownloadNotification: React.FC<DownloadNotificationProps> = ({
  download,
  onClose,
  onPause,
  onResume,
  onCancel,
  autoCloseDelay = 5000
}) => {
  const [isVisible, setIsVisible] = useState(true);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getProgressPercentage = (received: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((received / total) * 100);
  };

  const truncateFilename = (filename: string, maxLength: number = 35): string => {
    if (filename.length <= maxLength) return filename;
    const extension = filename.split('.').pop();
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxLength - (extension?.length || 0) - 4);
    return `${truncatedName}...${extension}`;
  };

  const progress = getProgressPercentage(download.receivedBytes, download.totalBytes);
  const isProgressing = download.state === 'progressing';
  const isPaused = download.state === 'paused';
  const isCompleted = download.state === 'completed';
  const isFailed = download.state === 'cancelled' || download.state === 'interrupted';

  // Auto close completed downloads
  useEffect(() => {
    if (isCompleted && autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, autoCloseDelay]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(download.id), 300);
  };

  const getStatusIcon = () => {
    if (isCompleted) return <CheckCircle className="size-4 text-green-500 flex-shrink-0" />;
    if (isFailed) return <AlertCircle className="size-4 text-red-500 flex-shrink-0" />;
    if (isPaused) return <Pause className="size-4 text-yellow-500 flex-shrink-0" />;
    return <DownloadSimple className="size-4 text-blue-500 flex-shrink-0" />;
  };

  const getStatusColor = () => {
    if (isCompleted) return 'bg-green-500';
    if (isFailed) return 'bg-red-500';
    if (isPaused) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: -300, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -300, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-[420px] bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg backdrop-blur-md"
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Status Icon */}
              {getStatusIcon()}
              
              {/* Main Content */}
              <div className="flex-1 min-w-0">
                {/* Header Row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {isCompleted ? 'Download Complete' : 
                       isFailed ? 'Download Failed' : 
                       isPaused ? 'Download Paused' : 
                       'Downloading'}
                    </span>
                    <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-medium">
                      {progress}%
                    </span>
                  </div>
                </div>

                {/* Filename */}
                <div className="text-sm text-foreground mb-3" title={download.filename}>
                  {truncateFilename(download.filename)}
                </div>

                {/* Progress Bar */}
                <div className="relative mb-3">
                  <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full transition-all duration-500 ${getStatusColor()}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  {/* Progress indicator dot */}
                  <motion.div
                    className={`absolute top-0 w-2 h-2 ${getStatusColor()} rounded-full transform -translate-y-0.5`}
                    initial={{ left: 0 }}
                    animate={{ left: `${progress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{ marginLeft: '-4px' }}
                  />
                </div>

                {/* Info Row */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatBytes(download.receivedBytes)} / {formatBytes(download.totalBytes)}</span>
                  <div className="flex items-center gap-2">
                    {isProgressing && <span className="text-blue-500">⬇ Active</span>}
                    {isPaused && <span className="text-yellow-500">⏸ Paused</span>}
                    {isCompleted && <span className="text-green-500">✓ Complete</span>}
                    {isFailed && <span className="text-red-500">✗ Failed</span>}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-1 ml-2">
                {!isCompleted && !isFailed && (
                  <>
                    {isProgressing && onPause && (
                      <button
                        onClick={() => onPause(download.id)}
                        className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                        title="Pause download"
                      >
                        <Pause className="size-3" />
                      </button>
                    )}
                    
                    {(isPaused || download.canResume) && onResume && (
                      <button
                        onClick={() => onResume(download.id)}
                        className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                        title="Resume download"
                      >
                        <Play className="size-3" />
                      </button>
                    )}
                    
                    {onCancel && (
                      <button
                        onClick={() => onCancel(download.id)}
                        className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        title="Cancel download"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </>
                )}
                
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 rounded transition-colors"
                  title="Close notification"
                >
                  <X className="size-3" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DownloadNotification;