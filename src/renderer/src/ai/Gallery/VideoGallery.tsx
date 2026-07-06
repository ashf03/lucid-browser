import React, { useState, useCallback, MouseEvent } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '../../ui/card';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Clock, Eye, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import type { YouTubeResult } from '../../types/types';
import { YoutubeLogo, Play, VideoCamera, ArrowUpRight, ArrowSquareOut } from '@phosphor-icons/react';
import { useView } from '../../components/parts/ViewContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '../../ui/badge';

interface VideoResult {
  link: string;
  title: string;
  thumbnail: string;
  duration: string;
  platform: string;
  date: string;
}

interface VideoGalleryProps {
  youtubeVideos?: YouTubeResult[];
  videos?: VideoResult[];
  onViewModeChange?: (mode: 'compact' | 'full') => void;
  viewMode?: 'compact' | 'full';
}

interface TabItem {
  id: string;
  label: string;
  icon: React.ReactElement;
}

interface CombinedVideo {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  link: string;
  type: 'youtube' | 'youtube-short' | 'regular';
  channelName?: string;
  views?: string;
  uploadedAt?: string;
  platform?: string;
  date?: string;
}

const VideoGallery: React.FC<VideoGalleryProps> = ({ 
  youtubeVideos = [], 
  videos = [],
  onViewModeChange,
  viewMode: controlledViewMode 
}) => {
  const [selectedVideoTab, setSelectedVideoTab] = useState("youtube-videos");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [internalViewMode, setInternalViewMode] = useState<'compact' | 'full'>('compact');
  
  // Determine if we're in controlled or uncontrolled mode
  const isControlled = controlledViewMode !== undefined;
  const viewMode = isControlled ? controlledViewMode : internalViewMode;
  
  const { activeTabId, webviewRefs, updateTabState, activeTab } = useView();
  const [isHovering, setIsHovering] = useState(false);

  // Handle view mode changes - fixed to work properly in both controlled and uncontrolled modes
  const handleViewModeChange = useCallback((newMode: 'compact' | 'full') => {
    // Update internal state only if we're in uncontrolled mode
    if (!isControlled) {
      setInternalViewMode(newMode);
    }
    
    // ENHANCEMENT: Auto-expand first video when entering full view for better UX
    if (newMode === 'full' && expandedIndex === null) {
      setExpandedIndex(0);
    }
    // Reset expansion when going back to compact
    if (newMode === 'compact') {
      setExpandedIndex(null);
    }
    
    // Always call the parent callback
    onViewModeChange?.(newMode);
  }, [isControlled, onViewModeChange, expandedIndex]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  const toggleExpand = useCallback((index: number): void => {
    setExpandedIndex(prevIndex => prevIndex === index ? null : index);
  }, []);

  const handleWatchVideo = useCallback((url: string, e: MouseEvent) => {
    e.preventDefault();
    let processedUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      processedUrl = `https://${url}`;
    }
    
    const webview = webviewRefs.current.get(activeTabId);
    if (webview) {
      webview
        .loadURL(processedUrl)
        .then(() => {
          updateTabState(activeTabId, {
            url: processedUrl,
            navigationHistory: [...activeTab.navigationHistory.slice(0, activeTab.historyIndex + 1), processedUrl],
            historyIndex: activeTab.historyIndex + 1,
          });
        })
        .catch((error) => {
          console.error("Failed to load URL:", error);
        });
    }
  }, [activeTab, activeTabId, updateTabState, webviewRefs]);

  // Separate YouTube videos into shorts and regular videos
  const shorts = youtubeVideos.filter(video => video.isShort);
  const regularYouTubeVideos = youtubeVideos.filter(video => !video.isShort);

  // Combine all videos for compact view
  const getAllVideos = (): CombinedVideo[] => {
    const combined: CombinedVideo[] = [];
    
    // Add regular YouTube videos
    regularYouTubeVideos.forEach((video, index) => {
      combined.push({
        id: `youtube-${index}`,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.duration || '',
        link: video.link,
        type: 'youtube',
        channelName: video.channelName,
        views: video.views,
        uploadedAt: video.uploadedAt
      });
    });
    
    // Add YouTube shorts
    shorts.forEach((video, index) => {
      combined.push({
        id: `short-${index}`,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: '',
        link: video.link,
        type: 'youtube-short',
        channelName: video.channelName,
        views: video.views
      });
    });
    
    // Add regular videos
    videos.forEach((video, index) => {
      combined.push({
        id: `video-${index}`,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.duration,
        link: video.link,
        type: 'regular',
        platform: video.platform,
        date: video.date
      });
    });
    
    return combined;
  };

  const allVideos = getAllVideos();

  // Get mixed videos for compact view (one from each type if available)
  const getCompactVideos = (): CombinedVideo[] => {
    const compactVideos: CombinedVideo[] = [];
    
    // Try to get one from each type
    const youtubeVideo = allVideos.find(v => v.type === 'youtube');
    const shortVideo = allVideos.find(v => v.type === 'youtube-short');
    const regularVideo = allVideos.find(v => v.type === 'regular');
    
    if (youtubeVideo) compactVideos.push(youtubeVideo);
    if (shortVideo) compactVideos.push(shortVideo);
    if (regularVideo) compactVideos.push(regularVideo);
    
    // If we don't have 3 yet, fill with remaining videos
    while (compactVideos.length < 3 && compactVideos.length < allVideos.length) {
      const remainingVideos = allVideos.filter(v => !compactVideos.includes(v));
      if (remainingVideos.length > 0) {
        compactVideos.push(remainingVideos[0]);
      } else {
        break;
      }
    }
    
    return compactVideos.slice(0, 3);
  };

  const getDomainName = (url: string): string => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch (e) {
      return url;
    }
  };

  // Determine which tabs should be visible
  const availableTabs: TabItem[] = [];
  if (regularYouTubeVideos.length > 0) {
    availableTabs.push({ id: "youtube-videos", label: "YouTube Videos", icon: <YoutubeLogo className="h-4 w-4" /> });
  }
  if (shorts.length > 0) {
    availableTabs.push({ id: "youtube-shorts", label: "YouTube Shorts", icon: <YoutubeLogo className="h-4 w-4" /> });
  }
  if (videos.length > 0) {
    availableTabs.push({ id: "videos", label: "Videos", icon: <VideoCamera className="h-4 w-4" /> });
  }

  // Set default active tab to first available tab
  React.useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.id === selectedVideoTab)) {
      setSelectedVideoTab(availableTabs[0].id);
    }
  }, [availableTabs, selectedVideoTab]);

  if (allVideos.length === 0) return null;

  const displayedVideos = viewMode === 'compact' ? getCompactVideos() : allVideos;
  const hasMoreVideos = allVideos.length > 3;

  const renderVideoCard = (video: CombinedVideo, index: number, isCompact = false) => {
    // ENHANCEMENT: In full view mode, make cards slightly taller and auto-expand first video for better visibility
    const shouldShowExpanded = !isCompact && (expandedIndex === index || (viewMode === 'full' && index === 0 && expandedIndex === null));
    const isShort = video.type === 'youtube-short';
    
    return (
      <motion.div 
        key={`${viewMode}-${video.id}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className={isCompact ? "flex-1 min-w-0" : "w-full"}
        style={{ scrollSnapAlign: 'start' }}
      >
        <Card 
          className={`transition-all duration-300 overflow-hidden bg-zinc-300 dark:bg-zinc-800 h-full cursor-pointer ${
            shouldShowExpanded ? 'h-auto min-h-[400px]' : isCompact ? 'h-18 w-[160px]' : 'h-56'
          }`}
          onClick={(e) => !shouldShowExpanded && handleWatchVideo(video.link, e as any)}
        >
          {isCompact && !shouldShowExpanded ? (
            // Compact horizontal layout
            <div className="flex p-1 h-full flex-col">
              {/* Video thumbnail on the left */}
              <div className="relative flex-shrink-0 w-auto h-[100px] rounded-lg overflow-hidden">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target) target.src = "/placeholder.svg";
                  }}
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="w-8 h-8 text-white" />
                </div>
                {video.duration && !isShort && (
                  <div className="absolute bottom-1 right-1 bg-black/80 text-white px-1 py-0.5 text-xs rounded">
                    {video.duration}
                  </div>
                )}
              </div>
              
              {/* Content stack on the right */}
              <div className="flex-1 min-w-0 flex flex-col justify-center ml-2">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWatchVideo(video.link, e as any);
                  }}
                  className="text-[12px] line-clamp-1 text-muted-foreground truncate hover:text-primary transition-colors cursor-pointer"
                >
                  {video.type === 'youtube' || video.type === 'youtube-short' ? 'YouTube' : getDomainName(video.link)}
                </div>
                
                <h4 className="font-medium line-clamp-1 text-[12px] text-primary group">
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWatchVideo(video.link, e as any);
                    }}
                    className="flex items-center gap-1 group cursor-pointer"
                  >
                    <span className="line-clamp-1">{video.title}</span>
                    <ArrowSquareOut 
                      size={12} 
                      className="flex-shrink-0 text-primary/70 opacity-0 group-hover:opacity-100 transition-opacity" 
                    />
                  </div>
                </h4>
              </div>
            </div>
          ) : (
            // Original vertical layout for full view and expanded cards
            <>
              <CardHeader className={`${shouldShowExpanded ? 'p-3 pb-1' : 'p-1 pb-1'}`}>
                {/* ENHANCEMENT: Larger videos, less rectangular container focus */}
                <div className={`relative w-full rounded-lg overflow-hidden mb-2 ${
                  shouldShowExpanded 
                    ? 'h-48' // Much larger when expanded
                    : viewMode === 'full' 
                      ? 'h-40' // Larger in full view to focus on video
                      : 'h-32' // Decent size in regular view
                }`}>
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className={`w-full ${isShort ? 'h-48' : 'h-full'} object-cover`}
                  />
                  {/* Play button overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-12 h-12 text-white" />
                  </div>
                  {video.duration && !isShort && (
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 text-xs rounded">
                      {video.duration}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mb-1">
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWatchVideo(video.link, e as any);
                    }}
                    className="text-xs text-muted-foreground truncate hover:text-primary transition-colors cursor-pointer"
                  >
                    {video.type === 'youtube' || video.type === 'youtube-short' ? 'YouTube' : getDomainName(video.link)}
                  </div>
                </div>
                
                <h4 className={`font-medium text-sm text-primary mb-1 group ${isCompact ? 'line-clamp-2' : shouldShowExpanded ? 'line-clamp-4' : 'line-clamp-2'}`}>
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWatchVideo(video.link, e as any);
                    }}
                    className="flex items-start gap-1 group cursor-pointer"
                  >
                    {video.title}
                    <ArrowSquareOut 
                      size={12} 
                      className="inline flex-shrink-0 mt-1 text-primary/70 opacity-0 group-hover:opacity-100 transition-opacity" 
                    />
                  </div>
                </h4>

                {/* Video metadata */}
                {shouldShowExpanded && (
                  <div className="flex flex-col space-y-1 text-xs text-muted-foreground">
                    {video.channelName && !isShort && (
                      <span className="line-clamp-1">{video.channelName}</span>
                    )}
                    <div className="flex items-center gap-3">
                      {video.views && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {video.views}
                        </span>
                      )}
                      {video.uploadedAt && !isShort && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {video.uploadedAt}
                        </span>
                      )}
                      {video.date && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {video.date}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardHeader>
              
              {!isCompact && (
                <CardFooter className={`${shouldShowExpanded ? 'p-3 pt-0' : 'p-1 pt-0'} flex justify-between items-center`}>
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(index);
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-xs flex items-center text-primary/70 hover:text-primary p-0 h-auto"
                  >
                    <motion.div
                      animate={{
                        backgroundColor: shouldShowExpanded ? "rgba(var(--primary), 0.2)" : "rgba(var(--primary), 0.1)",
                      }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 mr-1"
                    >
                      <motion.div
                        animate={{
                          rotate: shouldShowExpanded ? 180 : 0,
                        }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        {shouldShowExpanded ? (
                          <ChevronUp size={12} className="text-primary" />
                        ) : (
                          <ChevronDown size={12} className="text-primary" />
                        )}
                      </motion.div>
                    </motion.div>
                    <span className="text-xs">{shouldShowExpanded ? "Less" : "View"}</span>
                  </Button>
                  
                  {shouldShowExpanded && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWatchVideo(video.link, e as any);
                      }}
                      className="ml-auto cursor-pointer"
                    >
                      <Badge variant="outline" className="text-xs py-0 h-5 hover:bg-primary/10 transition-colors">
                        Watch Video
                      </Badge>
                    </div>
                  )}
                </CardFooter>
              )}
            </>
          )}
        </Card>
      </motion.div>
    );
  };

  const renderFullViewContent = () => {
    if (availableTabs.length === 0) return null;

    return (
      <Tabs 
        value={selectedVideoTab} 
        onValueChange={setSelectedVideoTab}
        className="w-full"
      >
        <TabsList className={`grid w-full mb-4 ${
          availableTabs.length === 1 ? 'grid-cols-1' :
          availableTabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
        }`}>
          {availableTabs.map((tab: TabItem) => (
            <TabsTrigger 
              key={tab.id}
              value={tab.id} 
              className="flex items-center gap-2 data-[state=active]:bg-primary/20"
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {regularYouTubeVideos.length > 0 && (
          <TabsContent value="youtube-videos" className="mt-4">
            <div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-3 h-80 sidebar-scrollbar"
              style={{ 
                WebkitOverflowScrolling: "touch",
                scrollBehavior: 'smooth'
              }}
              onMouseLeave={handleMouseLeave}
            >
              {regularYouTubeVideos.map((video, index) => {
                const combinedVideo: CombinedVideo = {
                  id: `youtube-${index}`,
                  title: video.title,
                  thumbnail: video.thumbnail,
                  duration: video.duration || '',
                  link: video.link,
                  type: 'youtube',
                  channelName: video.channelName,
                  views: video.views,
                  uploadedAt: video.uploadedAt
                };
                return renderVideoCard(combinedVideo, index, false);
              })}
            </div>
          </TabsContent>
        )}

        {shorts.length > 0 && (
          <TabsContent value="youtube-shorts" className="mt-4">
            <div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-3 h-80 sidebar-scrollbar"
              style={{ 
                WebkitOverflowScrolling: "touch",
                scrollBehavior: 'smooth'
              }}
              onMouseLeave={handleMouseLeave}
            >
              {shorts.map((video, index) => {
                const combinedVideo: CombinedVideo = {
                  id: `short-${index}`,
                  title: video.title,
                  thumbnail: video.thumbnail,
                  duration: '',
                  link: video.link,
                  type: 'youtube-short',
                  channelName: video.channelName,
                  views: video.views
                };
                return renderVideoCard(combinedVideo, index, false);
              })}
            </div>
          </TabsContent>
        )}

        {videos.length > 0 && (
          <TabsContent value="videos" className="mt-4">
            <div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-3 h-80 sidebar-scrollbar"
              style={{ 
                WebkitOverflowScrolling: "touch",
                scrollBehavior: 'smooth'
              }}
              onMouseLeave={handleMouseLeave}
            >
              {videos.map((video, index) => {
                const combinedVideo: CombinedVideo = {
                  id: `video-${index}`,
                  title: video.title,
                  thumbnail: video.thumbnail,
                  duration: video.duration,
                  link: video.link,
                  type: 'regular',
                  platform: video.platform,
                  date: video.date
                };
                return renderVideoCard(combinedVideo, index, false);
              })}
            </div>
          </TabsContent>
        )}
      </Tabs>
    );
  };

  return (
    <motion.div
      className="relative w-full overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleMouseLeave}
    >
      <AnimatePresence mode="wait">
        {viewMode === 'compact' ? (
          <motion.div
            key="compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Compact horizontal view */}
            <div className="flex gap-2">
              {displayedVideos.map((video, index) => 
                renderVideoCard(video, index, true)
              )}
            </div>
            
            {hasMoreVideos && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="flex justify-start"
              >
                <Button
                  onClick={() => handleViewModeChange('full')}
                  variant="ghost"
                  size="sm"
                  className="text-xs p-1 text-primary/70 hover:text-primary flex items-center gap-1 hover:bg-primary/10 transition-colors"
                >
                  <span>view more videos</span><ArrowUpRight />
                </Button>
              </motion.div>
            )}  
          </motion.div>
        ) : (
          <motion.div
            key="full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Full view header with back button */}
            <div className="flex items-center gap-3 mb-2 border-zinc-300 dark:border-zinc-600">
              <Button
                onClick={() => handleViewModeChange('compact')}
                variant="ghost"
                size="sm"
                className="text-primary/70 hover:text-primary flex items-center gap-2 hover:bg-primary/10 transition-colors"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </Button> 
            </div>

            {/* ENHANCEMENT: Full videos container with better spacing and improved height */}
            <div className="relative overflow-hidden h-96">
              {renderFullViewContent()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default VideoGallery;