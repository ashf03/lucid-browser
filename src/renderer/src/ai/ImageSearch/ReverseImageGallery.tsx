"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "../../ui/button"
import { useView } from "../../components/parts/ViewContext"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"
import { ArrowSquareOut, ImageSquare, MagnifyingGlass } from "@phosphor-icons/react"

interface ReverseImageResult {
  url: string
  title: string
  thumbnail: string
}

interface ReverseImageGalleryProps {
  images: ReverseImageResult[]
}

const ReverseImageGallery: React.FC<ReverseImageGalleryProps> = ({ images }) => {
  const [displayCount, setDisplayCount] = useState(6)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { activeTabId, webviewRefs, updateTabState, activeTab } = useView()

  const galleryImages = isSearchExpanded ? images : images.slice(0, displayCount)
  
  const [imageDimensions, setImageDimensions] = useState<{[key: number]: {width: number, height: number}}>({})
  
  const handleImageLoad = (index: number, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions(prev => ({
      ...prev,
      [index]: { width: img.naturalWidth, height: img.naturalHeight }
    }))
  }

  const handleSearchToggle = () => {
    setIsSearchExpanded(!isSearchExpanded)
  }

  const handleViewOriginal = (url: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
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
  }

  const [expandedImageIndex, setExpandedImageIndex] = useState<number | null>(null)

  const handleImageClick = (index: number) => {
    setExpandedImageIndex(expandedImageIndex === index ? null : index)
  }

  const getImageSizeClass = (index: number) => {
    if (!imageDimensions[index]) return "col-span-1 row-span-1";
    
    const { width, height } = imageDimensions[index];
    const ratio = width / height;
    
    if (ratio > 1.8) return "col-span-2 row-span-1";
    if (ratio > 2.5) return "col-span-3 row-span-1";
    if (ratio >= 0.7 && ratio <= 1.3) return "col-span-1 row-span-1";
    if (ratio < 0.6) return "col-span-1 row-span-2";
    
    return "col-span-1 row-span-1";
  }

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="space-y-6"
      >
        {/* Modern Toggle Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Button
            variant="ghost"
            onClick={handleSearchToggle}
            className={cn(
              "group relative w-full h-12 rounded-2xl border border-border/50",
              "bg-gradient-to-r from-background/80 to-background/60 backdrop-blur-sm",
              "hover:from-primary/5 hover:to-primary/10 hover:border-primary/20",
              "transition-all duration-300 ease-out",
              isSearchExpanded && "bg-primary/5 border-primary/20"
            )}
          >
            <div className="flex items-center justify-center gap-3">
              <motion.div
                animate={{ rotate: isSearchExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <MagnifyingGlass className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </motion.div>

        {/* Image Count Indicator */}
        {!isSearchExpanded && images.length > displayCount && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="text-center"
          >
            <span className="text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-muted/50">
              Showing {displayCount} of {images.length} images
            </span>
          </motion.div>
        )}
              <span className="font-medium text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {isSearchExpanded ? "Hide Similar Images" : "Show Similar Images"}
              </span>
              <div className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                {images.length}
              </div>
            </div>
          </Button>
        </motion.div>

        {/* Image Grid */}
        <motion.div
          layout
          className="relative overflow-hidden transition-all duration-500 ease-out"
        >
          <div
            className={cn(
              "grid gap-3 auto-rows-auto transition-all duration-300",
              "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
              isSearchExpanded && "max-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            )}
            style={{ gridAutoFlow: "dense" }}
          >
            {galleryImages.map((image: ReverseImageResult, index: number) => (
              <motion.div
                key={index}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  duration: 0.4, 
                  delay: Math.min(index * 0.05, 0.3),
                  ease: "easeOut"
                }}
                className={cn(
                  "group relative overflow-hidden rounded-xl transition-all duration-300",
                  "cursor-pointer select-none",
                  expandedImageIndex === index ? "col-span-full" : getImageSizeClass(index),
                  hoveredIndex === index && "z-10"
                )}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => handleImageClick(index)}
              >
                {/* Image Container */}
                <div className={cn(
                  "relative overflow-hidden bg-muted/30 backdrop-blur-sm",
                  "rounded-xl border border-border/20",
                  "transition-all duration-300",
                  expandedImageIndex === index ? "aspect-auto" : "aspect-square"
                )}>
                  <img
                    src={image.thumbnail || "/placeholder.svg"}
                    alt={image.title}
                    className={cn(
                      "w-full h-full object-cover transition-all duration-500",
                      "group-hover:scale-105",
                      hoveredIndex === index && "brightness-110"
                    )}
                    onLoad={(e) => handleImageLoad(index, e)}
                  />
                  
                  {/* Hover Action Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ 
                      opacity: hoveredIndex === index ? 1 : 0,
                      y: hoveredIndex === index ? 0 : 10
                    }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    className="absolute bottom-2 right-2"
                  >
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 p-0 rounded-lg bg-white/90 hover:bg-white backdrop-blur-sm border-0"
                      onClick={(e) => handleViewOriginal(image.url, e)}
                    >
                      <ArrowSquareOut className="h-3.5 w-3.5 text-gray-700" />
                    </Button>
                  </motion.div>
                </div>

                {/* Expanded Content */}
                {expandedImageIndex === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="mt-4 p-4 rounded-xl bg-muted/30 border border-border/20 backdrop-blur-sm"
                  >
                    <h4 className="font-medium text-sm mb-2 text-foreground line-clamp-2">
                      {image.title}
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleViewOriginal(image.url, e)}
                      className="h-8 text-xs rounded-lg border-border/50 hover:border-primary/50 hover:bg-primary/5"
                    >
                      Open Original
                      <ArrowSquareOut className="h-3 w-3 ml-1.5" />
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default ReverseImageGallery;