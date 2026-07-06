import React from 'react';
import { DownloadSimple, Pause, Play, X, Folder, Trash, ArrowClockwise } from '@phosphor-icons/react';

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

interface DownloadsDropdownProps {
  downloads: Download[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onRedownload: (id: string) => void;
  onOpenLocation: (id: string) => void;
  onClearAll: () => void;
}

const DownloadsDropdown: React.FC<DownloadsDropdownProps> = ({
  downloads,
  isOpen,
  onOpenChange,
  onPause,
  onResume,
  onCancel,
  onDelete,
  onRedownload,
  onOpenLocation,
  onClearAll
}) => {
  // Properly deduplicate downloads by ID, keeping the LATEST entry
  const deduplicatedDownloads = React.useMemo(() => {
    if (!downloads || downloads.length === 0) {
      return [];
    }

    // Simple approach: reverse, dedupe, reverse back to keep latest entries
    const reversed = [...downloads].reverse();
    const seen = new Set<string>();
    const unique: Download[] = [];
    
    for (const download of reversed) {
      if (download && download.id && !seen.has(download.id)) {
        seen.add(download.id);
        unique.push(download);
      }
    }
    
    return unique.reverse(); // Restore original order
  }, [downloads]);

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

  const truncateFilename = (filename: string, maxLength: number = 25): string => {
    if (filename.length <= maxLength) return filename;
    const extension = filename.split('.').pop();
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxLength - extension!.length - 4);
    return `${truncatedName}...${extension}`;
  };

  // Use downloads directly for filtering
  const activeDownloads = deduplicatedDownloads.filter(d => 
    d.state === 'progressing' || d.state === 'paused' || d.state === 'interrupted'
  );
  const completedDownloads = deduplicatedDownloads.filter(d => d.state === 'completed');
  const failedDownloads = deduplicatedDownloads.filter(d => d.state === 'cancelled');

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0">
        <h3 className="font-semibold text-sm">Downloads</h3>
        {deduplicatedDownloads.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto sidebar-scrollbar p-2">
        {deduplicatedDownloads.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No downloads yet
          </div>
        ) : (
          <>
            {/* Active Downloads */}
            {activeDownloads.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium text-muted-foreground mb-2 px-1">Active</div>
                {activeDownloads.map(download => {
                  const progress = getProgressPercentage(download.receivedBytes, download.totalBytes);
                  const isProgressing = download.state === 'progressing';
                  const isPaused = download.state === 'paused';
                  const isInterrupted = download.state === 'interrupted';
                  
                  // Debug log to see what's happening
                  if (isPaused || isInterrupted) {
                    console.log('Download that should show resume button:', {
                      id: download.id,
                      state: download.state,
                      isPaused,
                      isInterrupted,
                      canResume: download.canResume
                    });
                  }

                  return (
                    <div key={download.id} className="mb-2 p-2 rounded bg-white/50 dark:bg-zinc-800/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate flex-1" title={download.filename}>
                          {truncateFilename(download.filename)}
                        </span>
                        <div className="flex gap-1">
                          {/* Pause button - show when progressing */}
                          {isProgressing && (
                            <button
                              onClick={() => onPause(download.id)}
                              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                              title="Pause download"
                            >
                              <Pause className="size-3" />
                            </button>
                          )}
                          
                          {/* Resume button - show when paused OR interrupted OR canResume is true */}
                          {(isPaused || isInterrupted || download.canResume) && !isProgressing && (
                            <button
                              onClick={() => onResume(download.id)}
                              className="p-1 hover:bg-green-200 dark:hover:bg-green-700 rounded text-green-600 dark:text-green-400"
                              title={`Resume download (${download.state})`}
                            >
                              <Play className="size-3" />
                            </button>
                          )}
                          
                          {/* Cancel button - always show for active downloads */}
                          <button
                            onClick={() => onCancel(download.id)}
                            className="p-1 hover:bg-red-200 dark:hover:bg-red-700 rounded text-red-600 dark:text-red-400"
                            title="Cancel download"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="mb-1">
                        <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isProgressing ? 'bg-blue-500' : 
                              isPaused ? 'bg-yellow-500' : 
                              isInterrupted ? 'bg-orange-500' : 'bg-gray-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatBytes(download.receivedBytes)} / {formatBytes(download.totalBytes)}</span>
                        <div className="flex items-center gap-2">
                          <span>{progress}%</span>
                          {isPaused && <span className="text-yellow-600 dark:text-yellow-400">Paused</span>}
                          {isInterrupted && <span className="text-orange-600 dark:text-orange-400">Interrupted</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Completed Downloads */}
            {completedDownloads.length > 0 && (
              <div className="mb-4">
                {activeDownloads.length > 0 && <div className="border-t border-zinc-200 dark:border-zinc-700 my-3" />}
                <div className="text-xs font-medium text-muted-foreground mb-2 px-1">Completed</div>
                {completedDownloads.slice(0, 5).map(download => (
                  <div key={download.id} className="flex items-center justify-between p-2 mb-1 rounded hover:bg-white/50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" title={download.filename}>
                        {truncateFilename(download.filename)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(download.totalBytes)}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenLocation(download.id); }}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                        title="Open file location"
                      >
                        <Folder className="size-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRedownload(download.id); }}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                        title="Download again"
                      >
                        <ArrowClockwise className="size-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(download.id); }}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                        title="Delete"
                      >
                        <Trash className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Failed Downloads */}
            {failedDownloads.length > 0 && (
              <div>
                {(activeDownloads.length > 0 || completedDownloads.length > 0) && 
                  <div className="border-t border-zinc-200 dark:border-zinc-700 my-3" />
                }
                <div className="text-xs font-medium text-muted-foreground mb-2 px-1">Failed</div>
                {failedDownloads.slice(0, 3).map(download => (
                  <div key={download.id} className="flex items-center justify-between p-2 mb-1 rounded hover:bg-white/50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate text-red-500" title={download.filename}>
                        {truncateFilename(download.filename)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {download.state}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onRedownload(download.id); }}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                        title="Retry download"
                      >
                        <ArrowClockwise className="size-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(download.id); }}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                        title="Delete"
                      >
                        <Trash className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DownloadsDropdown;