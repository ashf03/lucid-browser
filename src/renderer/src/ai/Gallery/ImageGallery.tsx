"use client"

import type React from "react"
import { useState, useCallback, MouseEvent } from "react"
import { ChevronUp, ChevronDown, ExternalLink, ArrowLeft } from "lucide-react"
import { Button } from "../../ui/button"
import { Card, CardHeader, CardContent, CardFooter } from "../../ui/card"
import { Badge } from "../../ui/badge"
import { useView } from "../../components/parts/ViewContext"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowUpRight, ArrowSquareOut } from "@phosphor-icons/react"

interface ImageResult {
  url: string
  title: string
  thumbnail: string
}

interface ImageGalleryProps {
  images: ImageResult[]
  onViewModeChange?: (mode: 'compact' | 'full') => void
  viewMode?: 'compact' | 'full'
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  images, 
  onViewModeChange,
  viewMode: controlledViewMode 
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [internalViewMode, setInternalViewMode] = useState<'compact' | 'full'>('compact')
  
  // Determine if we're in controlled or uncontrolled mode
  const isControlled = controlledViewMode !== undefined
  const viewMode = isControlled ? controlledViewMode : internalViewMode
  
  const { activeTabId, webviewRefs, updateTabState, activeTab } = useView()
  const [isHovering, setIsHovering] = useState(false)

  // Handle view mode changes - fixed to work properly in both controlled and uncontrolled modes
  const handleViewModeChange = useCallback((newMode: 'compact' | 'full') => {
    // Update internal state only if we're in uncontrolled mode
    if (!isControlled) {
      setInternalViewMode(newMode)
    }
    
    // ENHANCEMENT: Auto-expand first image when entering full view for better UX
    if (newMode === 'full' && expandedIndex === null) {
      setExpandedIndex(0)
    }
    // Reset expansion when going back to compact
    if (newMode === 'compact') {
      setExpandedIndex(null)
    }
    
    // Always call the parent callback
    onViewModeChange?.(newMode)
  }, [isControlled, onViewModeChange, expandedIndex])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
  }, [])
  
  const toggleExpand = useCallback((index: number): void => {
    setExpandedIndex(prevIndex => prevIndex === index ? null : index)
  }, [])
  
  const getDomainName = (url: string): string => {
    try {
      const domain = new URL(url).hostname
      return domain.replace('www.', '')
    } catch (e) {
      return url
    }
  }

  const handleViewOriginal = useCallback((url: string, e: MouseEvent<HTMLAnchorElement>): void => {
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
  }, [activeTab, activeTabId, updateTabState, webviewRefs])

  if (!images || images.length === 0) return null

  const displayedImages = viewMode === 'compact' ? images.slice(0, 3) : images
  const hasMoreImages = images.length > 3

  const renderImageCard = (image: ImageResult, index: number, isCompact = false) => {
    // ENHANCEMENT: In full view mode, make cards slightly taller and auto-expand first image for better visibility
    const shouldShowExpanded = !isCompact && (expandedIndex === index || (viewMode === 'full' && index === 0 && expandedIndex === null))
    
    return (
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
            shouldShowExpanded ? 'h-auto min-h-[400px]' : isCompact ? 'h-18 w-[160px]' : 'h-56'
          }`}>
          {isCompact && !shouldShowExpanded ? (
            // Compact horizontal layout
            <div className="flex p-1 h-full flex-col">
              {/* Image thumbnail on the left */}
              <div className="flex-shrink-0 w-auto h-[150px] rounded-lg overflow-hidden">
                <img 
                  src={image.thumbnail || image.url} 
                  alt={image.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    if (target) target.src = "/placeholder.svg"
                  }}
                />
              </div>
              
              {/* Content stack on the right */}
              <div className="flex-1 min-w-0 flex flex-col justify-center ml-2">
                <a 
                  href={image.url} 
                  onClick={(e) => handleViewOriginal(image.url, e)}
                  className="text-[12px] line-clamp-1 text-muted-foreground truncate hover:text-primary transition-colors"
                >
                  {getDomainName(image.url)}
                </a>
                
                <h4 className="font-medium line-clamp-1 text-[12px] text-primary group">
                  <a 
                    href={image.url} 
                    onClick={(e) => handleViewOriginal(image.url, e)}
                    className="flex items-center gap-1 group"
                  >
                    <span className="line-clamp-1">{image.title}</span>
                    <ArrowSquareOut 
                      size={12} 
                      className="flex-shrink-0 text-primary/70 opacity-0 group-hover:opacity-100 transition-opacity" 
                    />
                  </a>
                </h4>
              </div>
            </div>
          ) : (
            // Original vertical layout for full view and expanded cards
            <>
              <CardHeader className={`${shouldShowExpanded ? 'p-3 pb-1' : 'p-1 pb-1'}`}>
                {/* ENHANCEMENT: Larger images, less rectangular container focus */}
                <div className={`w-full rounded-lg overflow-hidden mb-2 ${
                  shouldShowExpanded 
                    ? 'h-48' // Much larger when expanded
                    : viewMode === 'full' 
                      ? 'h-40' // Larger in full view to focus on image
                      : 'h-32' // Decent size in regular view
                }`}>
                  <img 
                    src={image.thumbnail || image.url} 
                    alt={image.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      if (target) target.src = "/placeholder.svg"
                    }}
                  />
                </div>
                
                <div className="flex items-center gap-2 mb-1">
                  <a 
                    href={image.url} 
                    onClick={(e) => handleViewOriginal(image.url, e)}
                    className="text-xs text-muted-foreground truncate hover:text-primary transition-colors"
                  >
                    {getDomainName(image.url)}
                  </a>
                </div>
                
                <h4 className={`font-medium text-sm text-primary mb-1 group ${isCompact ? 'line-clamp-2' : shouldShowExpanded ? 'line-clamp-4' : 'line-clamp-2'}`}>
                  <a 
                    href={image.url} 
                    onClick={(e) => handleViewOriginal(image.url, e)}
                    className="flex items-start gap-1 group"
                  >
                    {image.title}
                    <ArrowSquareOut 
                      size={12} 
                      className="inline flex-shrink-0 mt-1 text-primary/70 opacity-0 group-hover:opacity-100 transition-opacity" 
                    />
                  </a>
                </h4>
              </CardHeader>
              
              {!isCompact && (
                <CardFooter className={`${shouldShowExpanded ? 'p-3 pt-0' : 'p-1 pt-0'} flex justify-between items-center`}>
                  <Button 
                    onClick={() => toggleExpand(index)}
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
                    <a 
                      href={image.url} 
                      onClick={(e) => handleViewOriginal(image.url, e)}
                      className="ml-auto"
                    >
                      <Badge variant="outline" className="text-xs py-0 h-5 hover:bg-primary/10 transition-colors">
                        View Original
                      </Badge>
                    </a>
                  )}
                </CardFooter>
              )}
            </>
          )}
        </Card>
      </motion.div>
    )
  }

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
              {displayedImages.map((image, index) => 
                renderImageCard(image, index, true)
              )}
            </div>
            
            {hasMoreImages && (
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
                  <span>view more images</span><ArrowUpRight />
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

            {/* ENHANCEMENT: Full images container with better spacing and improved height */}
            <div className="relative overflow-hidden h-96">
              <div 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-3 h-full sidebar-scrollbar"
                style={{ 
                  WebkitOverflowScrolling: "touch",
                  scrollBehavior: 'smooth'
                }}
                onMouseLeave={handleMouseLeave}
              >
                {images.map((image, index) => 
                  renderImageCard(image, index, false)
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default ImageGallery