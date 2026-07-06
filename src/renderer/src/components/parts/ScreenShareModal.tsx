import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { ScrollArea } from '../../ui/scroll-area';
import { 
  Monitor, 
  MonitorSpeaker, 
  X, 
  ArrowLeft,
  AlertCircle 
} from 'lucide-react';

interface Source {
  id: string;
  name: string;
  thumbnail: string;
}

interface ScreenShareModalProps {
  showSharePanel: boolean;
  showSourceMenu: boolean;
  sources: Source[];
  sourceTitle: string;
  loading: boolean;
  error: string;
  onShareWindow: () => void;
  onShareScreen: () => void;
  onSelectSource: (source: Source) => void;
  onCancel: () => void;
  onBackToMain: () => void;
}

const ScreenShareModal: React.FC<ScreenShareModalProps> = ({
  showSharePanel,
  showSourceMenu,
  sources,
  sourceTitle,
  loading,
  error,
  onShareWindow,
  onShareScreen,
  onSelectSource,
  onCancel,
  onBackToMain,
}) => {
  return (
    <Dialog open={showSharePanel} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl bg-background border border-zinc-200 dark:border-zinc-700 [&>button]:hidden">
        {/* Main Menu */}
        {!showSourceMenu && (
          <>
            <DialogHeader className="pb-4">
              <DialogTitle className="text-lg font-medium text-center flex items-center justify-center gap-2">
                <MonitorSpeaker className="w-5 h-5" />
                Choose what to share
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Button
                  className="w-full h-12 justify-start bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground border border-zinc-200 dark:border-zinc-700"
                  onClick={onShareWindow}
                  disabled={loading}
                  variant="outline"
                >
                  <Monitor className="w-4 h-4 mr-3" />
                  Share a Window
                </Button>

                <Button
                  className="w-full h-12 justify-start bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground border border-zinc-200 dark:border-zinc-700"
                  onClick={onShareScreen}
                  disabled={loading}
                  variant="outline"
                >
                  <MonitorSpeaker className="w-4 h-4 mr-3" />
                  Share Entire Screen
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-10 text-muted-foreground hover:text-foreground"
                  onClick={onCancel}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>

              {loading && (
                <div className="flex items-center justify-center p-4 text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-600 border-t-foreground rounded-full animate-spin mr-2"></div>
                  Loading sources...
                </div>
              )}
            </div>
          </>
        )}

        {/* Source Selection Menu */}
        {showSourceMenu && (
          <>
            <DialogHeader className="pb-4">
              <div className="flex items-center gap-3 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBackToMain}
                  className="h-8 px-3 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Back
                </Button>
              </div>
              <DialogTitle className="text-lg font-medium text-center">
                {sourceTitle}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                <ScrollArea className="h-96">
                  {sources.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                      <Monitor className="w-8 h-8 mb-3 opacity-50" />
                      <p className="text-sm">No sources available</p>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        {sources.map((source, index) => (
                          <button
                            key={source.id}
                            className="flex flex-col items-center gap-3 p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            onClick={() => onSelectSource(source)}
                          >
                            <div className="relative w-32 h-24 flex-shrink-0 bg-zinc-200 dark:bg-zinc-700 rounded border border-zinc-300 dark:border-zinc-600 overflow-hidden">
                              <img
                                src={source.thumbnail}
                                alt={source.name || 'Source thumbnail'}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent && !parent.querySelector('.fallback-icon')) {
                                    const fallback = document.createElement('div');
                                    fallback.className = 'fallback-icon absolute inset-0 flex items-center justify-center';
                                    fallback.innerHTML = `<svg class="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`;
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium text-foreground truncate max-w-full">
                                {source.name || 'Unknown Source'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Source {index + 1}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ScreenShareModal;