import React, { useState, useRef, useMemo } from 'react'
import { MapPin, EyeOff } from 'lucide-react'

interface MinimapProps {
  textAreas: Array<{ id: string; position: { x: number; y: number } }>
  images: Array<{ id: string; x: number; y: number; width: number; height: number }>
  videos: Array<{ id: string; x: number; y: number; width: number; height: number }>
  audios: Array<{ id: string; x: number; y: number; width: number; height: number }>
  files: Array<{ id: string; x: number; y: number; width: number; height: number }>
  drawPaths: Array<{
    id: string
    points: Array<{ x: number; y: number }>
    type: string
    color: string
    width: number
  }>
  canvasOffset: { x: number; y: number }
  viewportWidth: number
  viewportHeight: number
  onNavigate: (x: number, y: number) => void
  isVisible: boolean
  onToggleVisibility: () => void
  isSidebarHovering?: boolean // Add prop for sidebar hover state
}

const Minimap: React.FC<MinimapProps> = ({
  textAreas,
  images,
  videos,
  audios,
  files,
  drawPaths,
  canvasOffset,
  viewportWidth,
  viewportHeight,
  onNavigate,
  isVisible,
  onToggleVisibility,
  isSidebarHovering = false // Default to false
}) => {
  const minimapRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Minimap dimensions
  const MINIMAP_WIDTH = 200
  const MINIMAP_HEIGHT = 150
  const MINIMAP_PADDING = 10

  // Calculate content bounds
  const contentBounds = useMemo(() => {
    let minX = 0,
      minY = 0,
      maxX = 0,
      maxY = 0
    let hasContent = false

    // Include text areas
    textAreas.forEach((item) => {
      if (!hasContent) {
        minX = maxX = item.position.x
        minY = maxY = item.position.y
        hasContent = true
      } else {
        minX = Math.min(minX, item.position.x)
        minY = Math.min(minY, item.position.y)
        maxX = Math.max(maxX, item.position.x + 200) // Approximate width
        maxY = Math.max(maxY, item.position.y + 40) // Approximate height
      }
    })

    // Include images
    images.forEach((item) => {
      if (!hasContent) {
        minX = maxX = item.x
        minY = maxY = item.y
        hasContent = true
      } else {
        minX = Math.min(minX, item.x)
        minY = Math.min(minY, item.y)
        maxX = Math.max(maxX, item.x + item.width)
        maxY = Math.max(maxY, item.y + item.height)
      }
    })

    // Include videos
    videos.forEach((item) => {
      if (!hasContent) {
        minX = maxX = item.x
        minY = maxY = item.y
        hasContent = true
      } else {
        minX = Math.min(minX, item.x)
        minY = Math.min(minY, item.y)
        maxX = Math.max(maxX, item.x + item.width)
        maxY = Math.max(maxY, item.y + item.height)
      }
    })

    // Include audios
    audios.forEach((item) => {
      if (!hasContent) {
        minX = maxX = item.x
        minY = maxY = item.y
        hasContent = true
      } else {
        minX = Math.min(minX, item.x)
        minY = Math.min(minY, item.y)
        maxX = Math.max(maxX, item.x + item.width)
        maxY = Math.max(maxY, item.y + item.height)
      }
    })

    // Include files
    files.forEach((item) => {
      if (!hasContent) {
        minX = maxX = item.x
        minY = maxY = item.y
        hasContent = true
      } else {
        minX = Math.min(minX, item.x)
        minY = Math.min(minY, item.y)
        maxX = Math.max(maxX, item.x + item.width)
        maxY = Math.max(maxY, item.y + item.height)
      }
    })

    // Include drawings
    drawPaths.forEach((path) => {
      if (path.points && path.points.length > 0) {
        const xCoords = path.points.map((p) => p.x)
        const yCoords = path.points.map((p) => p.y)
        const pathMinX = Math.min(...xCoords)
        const pathMaxX = Math.max(...xCoords)
        const pathMinY = Math.min(...yCoords)
        const pathMaxY = Math.max(...yCoords)

        if (!hasContent) {
          minX = pathMinX
          maxX = pathMaxX
          minY = pathMinY
          maxY = pathMaxY
          hasContent = true
        } else {
          minX = Math.min(minX, pathMinX)
          minY = Math.min(minY, pathMinY)
          maxX = Math.max(maxX, pathMaxX)
          maxY = Math.max(maxY, pathMaxY)
        }
      }
    })

    // Include current viewport in bounds
    const viewportMinX = -canvasOffset.x
    const viewportMaxX = -canvasOffset.x + viewportWidth
    const viewportMinY = -canvasOffset.y
    const viewportMaxY = -canvasOffset.y + viewportHeight

    if (!hasContent) {
      minX = viewportMinX
      maxX = viewportMaxX
      minY = viewportMinY
      maxY = viewportMaxY
    } else {
      minX = Math.min(minX, viewportMinX)
      minY = Math.min(minY, viewportMinY)
      maxX = Math.max(maxX, viewportMaxX)
      maxY = Math.max(maxY, viewportMaxY)
    }

    // Add some padding
    const padding = 100
    minX -= padding
    minY -= padding
    maxX += padding
    maxY += padding

    const width = maxX - minX
    const height = maxY - minY

    return { minX, minY, maxX, maxY, width, height }
  }, [
    textAreas,
    images,
    videos,
    audios,
    files,
    drawPaths,
    canvasOffset,
    viewportWidth,
    viewportHeight
  ])

  // Calculate scale factor
  const scale = useMemo(() => {
    const scaleX = (MINIMAP_WIDTH - 2 * MINIMAP_PADDING) / contentBounds.width
    const scaleY = (MINIMAP_HEIGHT - 2 * MINIMAP_PADDING) / contentBounds.height
    return Math.min(scaleX, scaleY, 0.1) // Max scale of 0.1
  }, [contentBounds])

  // Transform coordinates to minimap space
  const transformToMinimap = (x: number, y: number) => {
    const scaledX = (x - contentBounds.minX) * scale + MINIMAP_PADDING
    const scaledY = (y - contentBounds.minY) * scale + MINIMAP_PADDING
    return { x: scaledX, y: scaledY }
  }

  // Handle navigation clicks
  const handleMinimapClick = (e: React.MouseEvent) => {
    if (!minimapRef.current) return

    const rect = minimapRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    // Transform click back to world coordinates
    const worldX = (clickX - MINIMAP_PADDING) / scale + contentBounds.minX
    const worldY = (clickY - MINIMAP_PADDING) / scale + contentBounds.minY

    // Center the viewport on this point
    const newOffsetX = -(worldX - viewportWidth / 2)
    const newOffsetY = -(worldY - viewportHeight / 2)

    onNavigate(newOffsetX, newOffsetY)
  }

  // Calculate viewport rectangle in minimap space
  const viewportRect = useMemo(() => {
    const viewportMinX = -canvasOffset.x
    const viewportMinY = -canvasOffset.y
    const viewportMaxX = viewportMinX + viewportWidth
    const viewportMaxY = viewportMinY + viewportHeight

    const topLeft = transformToMinimap(viewportMinX, viewportMinY)
    const bottomRight = transformToMinimap(viewportMaxX, viewportMaxY)

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y
    }
  }, [canvasOffset, viewportWidth, viewportHeight, scale, contentBounds])

  if (!isVisible) {
    return (
      <div
        className={`absolute bottom-4 left-4 transition-all duration-300 ${isSidebarHovering ? 'z-40' : 'z-50'}`}
      >
        <button
          onClick={onToggleVisibility}
          className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          title="Show minimap"
        >
          <MapPin size={18} className="text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={`absolute bottom-4 left-4 transition-all duration-300 ${isSidebarHovering ? 'z-40' : 'z-50'}`}
    >
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {/* Minimap Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-700 border-b border-zinc-200 dark:border-zinc-600">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Map</span>
          <button
            onClick={onToggleVisibility}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
            title="Hide minimap"
          >
            <EyeOff size={14} className="text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* Minimap Canvas */}
        <div
          ref={minimapRef}
          className="relative cursor-pointer"
          style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
          onClick={handleMinimapClick}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
        >
          {/* Background */}
          <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-900" />

          {/* Text Areas - Blue */}
          {textAreas.map((item) => {
            const pos = transformToMinimap(item.position.x, item.position.y)
            return (
              <div
                key={item.id}
                className="absolute bg-blue-400 rounded-sm opacity-70"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: Math.max(2, 200 * scale),
                  height: Math.max(2, 40 * scale)
                }}
              />
            )
          })}

          {/* Images - Green */}
          {images.map((item) => {
            const pos = transformToMinimap(item.x, item.y)
            return (
              <div
                key={item.id}
                className="absolute bg-green-400 rounded-sm opacity-70"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: Math.max(2, item.width * scale),
                  height: Math.max(2, item.height * scale)
                }}
              />
            )
          })}

          {/* Videos - Purple */}
          {videos.map((item) => {
            const pos = transformToMinimap(item.x, item.y)
            return (
              <div
                key={item.id}
                className="absolute bg-purple-400 rounded-sm opacity-70"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: Math.max(2, item.width * scale),
                  height: Math.max(2, item.height * scale)
                }}
              />
            )
          })}

          {/* Audios - Yellow */}
          {audios.map((item) => {
            const pos = transformToMinimap(item.x, item.y)
            return (
              <div
                key={item.id}
                className="absolute bg-red-400 rounded-sm opacity-70"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: Math.max(2, item.width * scale),
                  height: Math.max(2, item.height * scale)
                }}
              />
            )
          })}

          {/* Files - Orange */}
          {files.map((item) => {
            const pos = transformToMinimap(item.x, item.y)
            return (
              <div
                key={item.id}
                className="absolute bg-orange-400 rounded-sm opacity-70"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: Math.max(2, item.width * scale),
                  height: Math.max(2, item.height * scale)
                }}
              />
            )
          })}

          {/* Drawings - Red */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ overflow: 'visible' }}
          >
            {drawPaths.map((path) => {
              if (!path.points || path.points.length === 0) return null

              if (path.type === 'pen') {
                const scaledPoints = path.points.map((point) =>
                  transformToMinimap(point.x, point.y)
                )
                const pathData = scaledPoints.reduce((acc, point, i) => {
                  if (i === 0) return `M ${point.x} ${point.y}`
                  return `${acc} L ${point.x} ${point.y}`
                }, '')

                return (
                  <path
                    key={path.id}
                    d={pathData}
                    stroke="#ef4444"
                    strokeWidth={Math.max(0.5, path.width * scale)}
                    fill="none"
                    opacity={0.7}
                  />
                )
              } else if (path.type === 'shape') {
                const first = transformToMinimap(path.points[0].x, path.points[0].y)
                const last = transformToMinimap(
                  path.points[path.points.length - 1].x,
                  path.points[path.points.length - 1].y
                )

                const x = Math.min(first.x, last.x)
                const y = Math.min(first.y, last.y)
                const width = Math.abs(last.x - first.x)
                const height = Math.abs(last.y - first.y)

                return (
                  <rect
                    key={path.id}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    stroke="#ef4444"
                    strokeWidth={Math.max(0.5, path.width * scale)}
                    fill="none"
                    opacity={0.7}
                  />
                )
              } else if (path.type === 'arrow') {
                const first = transformToMinimap(path.points[0].x, path.points[0].y)
                const last = transformToMinimap(
                  path.points[path.points.length - 1].x,
                  path.points[path.points.length - 1].y
                )

                return (
                  <line
                    key={path.id}
                    x1={first.x}
                    y1={first.y}
                    x2={last.x}
                    y2={last.y}
                    stroke="#ef4444"
                    strokeWidth={Math.max(0.5, path.width * scale)}
                    opacity={0.7}
                  />
                )
              }

              return null
            })}
          </svg>

          {/* Current Viewport Rectangle */}
          <div
            className="absolute border-2 border-yellow-500 bg-yellow-500/20 pointer-events-none"
            style={{
              left: Math.max(0, Math.min(MINIMAP_WIDTH - viewportRect.width, viewportRect.x)),
              top: Math.max(0, Math.min(MINIMAP_HEIGHT - viewportRect.height, viewportRect.y)),
              width: Math.min(MINIMAP_WIDTH, Math.max(2, viewportRect.width)),
              height: Math.min(MINIMAP_HEIGHT, Math.max(2, viewportRect.height))
            }}
          />

          {/* Grid Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#666" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Minimap Footer */}
        <div className="px-3 py-1 bg-zinc-50 dark:bg-zinc-700 border-t border-zinc-200 dark:border-zinc-600">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Scale: {(scale * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
}

export default Minimap
