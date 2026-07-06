"use client"

import React, { useState, useRef, MouseEvent, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, ExternalLink, ArrowLeft, Grid } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { useView } from '../../components/parts/ViewContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight } from '@phosphor-icons/react'

interface SearchResult {
  title: string;
  url: string;
  description: string;
  siteName: string;
}

interface SearchResultsSliderProps {
  searchResults: string | SearchResult[];
  onRelatedQuestionClick?: (question: string) => void;
  onViewModeChange?: (mode: 'compact' | 'full') => void;
  viewMode?: 'compact' | 'full'; // Add controlled prop
}

const SearchResultsSlider: React.FC<SearchResultsSliderProps> = ({ 
  searchResults, 
  onRelatedQuestionClick, 
  onViewModeChange,
  viewMode: controlledViewMode // Add controlled prop
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  // Use controlled mode if provided, otherwise use internal state
  const [internalViewMode, setInternalViewMode] = useState<'compact' | 'full'>('compact');
  const viewMode = controlledViewMode !== undefined ? controlledViewMode : internalViewMode;
  
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const { activeTabId, webviewRefs, updateTabState, activeTab } = useView();
  const [isHovering, setIsHovering] = useState(false);

  // Handle view mode changes
  const handleViewModeChange = useCallback((newMode: 'compact' | 'full') => {
    if (controlledViewMode === undefined) {
      // Uncontrolled mode - manage internal state
      setInternalViewMode(newMode);
    }
    // Always notify parent
    onViewModeChange?.(newMode);
  }, [controlledViewMode, onViewModeChange]);

  const processSearchResults = (markdownResults: string): SearchResult[] => {
    if (!markdownResults) return [];
    
    // Regular expression to match markdown links and descriptions
    const regex = /\[([^\]]+)\]\(([^)]+)\)([\s\S]*?)(?=\n\n|\n\[|$)/g;
    const results: SearchResult[] = [];
    let match;

    while ((match = regex.exec(markdownResults)) !== null) {
      const title = match[1].trim();
      const url = match[2].trim();
      const description = match[3].trim();
      
      results.push({
        title,
        url,
        description,
        siteName: getDomainName(url)
      });
    }

    return results;
  };
  
  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);
  
  const toggleExpand = useCallback((index: number): void => {
    setExpandedIndex(prevIndex => prevIndex === index ? null : index);
  }, []);
  
  const getFavicon = (url: string): string => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch (e) {
      return '';
    }
  };
  
  const getDomainName = (url: string): string => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch (e) {
      return url;
    }
  };

  const handleLinkClick = useCallback((url: string, e: MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault()
    let processedUrl = url
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      processedUrl = `https://${url}`
    }
    
    const webview = webviewRefs.current.get(activeTabId)
    if (webview) {
      webview
        .loadURL(processedUrl)
        .then(() => {
          updateTabState(activeTabId, {
            url: processedUrl,
            navigationHistory: [...activeTab.navigationHistory.slice(0, activeTab.historyIndex + 1), processedUrl],
            historyIndex: activeTab.historyIndex + 1,
          })
        })
        .catch((error) => {
          console.error("Failed to load URL:", error)
        })
    }
  }, [activeTab, activeTabId, updateTabState, webviewRefs]);

  const parsedResults: SearchResult[] = Array.isArray(searchResults) 
    ? searchResults 
    : processSearchResults(searchResults || '');

  if (!parsedResults || parsedResults.length === 0) return null;

  const displayedResults = viewMode === 'compact' ? parsedResults.slice(0, 3) : parsedResults;
  const hasMoreResults = parsedResults.length > 3;

  const renderResultCard = (result: SearchResult, index: number, isCompact = false) => (
    <motion.div 
      key={`${viewMode}-${index}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={isCompact ? "flex-1 min-w-0" : "w-full"}
      style={{ scrollSnapAlign: 'start' }}
    >
      <Card 
        className={`transition-all duration-300 overflow-hidden bg-zinc-300 dark:bg-zinc-800 h-full ${
          expandedIndex === index ? 'h-auto' : isCompact ? 'h-18 w-[160px]' : 'h-32'
        }`}>
        {isCompact && expandedIndex !== index ? (
          // Compact horizontal layout
          <div className="flex p-1 h-full justify-center items-center">
            {/* Large icon on the left */}
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
              <img 
                src={getFavicon(result.url)} 
                alt="" 
                className="w-7 h-7"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target) target.style.display = 'none';
                }}
              />
            </div>
            
            {/* Content stack on the right */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <a 
                href={result.url} 
                onClick={(e) => handleLinkClick(result.url, e)}
                className="text-[12px] text-muted-foreground truncate hover:text-primary transition-colors"
              >
                {getDomainName(result.url)}
              </a>
              
              <h4 className="font-medium text-xs text-primary line-clamp-1 group">
                <a 
                  href={result.url} 
                  onClick={(e) => handleLinkClick(result.url, e)}
                  className="flex items-center gap-1 group"
                >
                  <span className="truncate">{result.title}</span>
                  <ExternalLink 
                    size={15} 
                    className="flex-shrink-0 text-primary/70 opacity-0 group-hover:opacity-100 transition-opacity" 
                  />
                </a>
              </h4>
              
              <p className="text-[12px] text-foreground/80 line-clamp-1">
                {result.description}
              </p>
            </div>
          </div>
        ) : (
          // Original vertical layout for full view and expanded cards
          <>
            <CardHeader className={`p-2 ${expandedIndex === index ? 'pb-0' : 'pb-1'}`}>
              <div className="flex items-center gap-2 mb-1">
                {result.url && (
                  <div className="relative flex h-4 w-4 items-center justify-center rounded-full">
                    <img 
                      src={getFavicon(result.url)} 
                      alt="" 
                      className="w-2 h-2"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target) target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <a 
                  href={result.url} 
                  onClick={(e) => handleLinkClick(result.url, e)}
                  className="text-xs text-muted-foreground truncate hover:text-primary transition-colors"
                >
                  {getDomainName(result.url)}
                </a>
              </div>
              
              <h4 className={`font-medium text-sm text-primary mb-1 group ${isCompact ? 'line-clamp-2' : 'line-clamp-2'}`}>
                <a 
                  href={result.url} 
                  onClick={(e) => handleLinkClick(result.url, e)}
                  className="flex items-start gap-1 group"
                >
                  {result.title}
                  <ExternalLink 
                    size={12} 
                    className="inline flex-shrink-0 mt-1 text-primary/70 opacity-0 group-hover:opacity-100 transition-opacity" 
                  />
                </a>
              </h4>
            </CardHeader>
            
            <CardContent className={`p-2 pt-0 ${expandedIndex === index ? 'pb-4' : isCompact ? 'max-h-8 overflow-hidden' : 'max-h-14 overflow-hidden'}`}>
              <motion.p 
                key={`desc-${index}-${expandedIndex === index}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className={`text-xs text-foreground/80 ${expandedIndex === index ? '' : isCompact ? 'line-clamp-1' : 'line-clamp-2'}`}
              >
                {result.description}
              </motion.p>
            </CardContent>
            
            {!isCompact && (
              <CardFooter className="p-2 pt-0 flex justify-between items-center">
                <Button 
                  onClick={() => toggleExpand(index)}
                  variant="ghost"
                  size="sm"
                  className="text-xs flex items-center text-primary/70 hover:text-primary p-0 h-auto"
                >
                  <motion.div
                    animate={{
                      backgroundColor: expandedIndex === index ? "rgba(var(--primary), 0.2)" : "rgba(var(--primary), 0.1)",
                    }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 mr-1"
                  >
                    <motion.div
                      animate={{
                        rotate: expandedIndex === index ? 180 : 0,
                      }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      {expandedIndex === index ? (
                        <ChevronUp size={12} className="text-primary" />
                      ) : (
                        <ChevronDown size={12} className="text-primary" />
                      )}
                    </motion.div>
                  </motion.div>
                  <span className="text-xs">{expandedIndex === index ? "Less" : "More"}</span>
                </Button>
                
                {expandedIndex === index && (
                  <a 
                    href={result.url} 
                    onClick={(e) => handleLinkClick(result.url, e)}
                    className="ml-auto"
                  >
                    <Badge variant="outline" className="text-xs py-0 h-5 hover:bg-primary/10 transition-colors">
                      {result.siteName}
                    </Badge>
                  </a>
                )}
              </CardFooter>
            )}
          </>
        )}
      </Card>
    </motion.div>
  );

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
                {displayedResults.map((result, index) => 
                  renderResultCard(result, index, true)
                )}
              </div>
              
              {hasMoreResults && (
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
                    <span>view more sources</span><ArrowUpRight />
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
                  onClick={() => {
                    handleViewModeChange('compact');
                    setExpandedIndex(null);
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-primary/70 hover:text-primary flex items-center gap-2 hover:bg-primary/10 transition-colors"
                >
                  <ArrowLeft size={16} />
                  <span>Back</span>
                </Button> 
              </div>

              {/* Full results container */}
              <div className="relative overflow-hidden h-96">
                <div 
                  ref={sliderRef} 
                  className="flex flex-col overflow-y-auto pb-3 gap-3 h-full sidebar-scrollbar"
                  style={{ 
                    WebkitOverflowScrolling: "touch",
                    scrollBehavior: 'smooth'
                  }}
                  onMouseLeave={handleMouseLeave}
                >
                  {parsedResults.map((result, index) => 
                    renderResultCard(result, index, false)
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </motion.div>
  );
};

export default SearchResultsSlider;