"use client";

import React, { useEffect, useState } from "react";
import { Dock, DockIcon } from "../../ui/Dock";
import { 
  Browser, 
  Cursor, 
  Hand,
  FolderOpen,
  Radical, 
  TextAa, 
  CheckSquare, 
  Shapes,
  Palette,
  ArrowElbowRight,
  Circle,
  Square,
  Triangle,
  Rectangle
} from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/popover";

interface PanelProps {
  activeTool: 'cursor' | 'hand';
  onToolChange: (tool: 'cursor' | 'hand') => void;
  onCommandSelect?: (command: string) => void;
  onTextCommandSelect?: (command: string) => void;
  
  // Drawing panel props
  onDrawingModeChange?: (mode: 'pen' | 'shape' | 'arrow' | 'none') => void;
  activeDrawingMode?: 'pen' | 'shape' | 'arrow' | 'none';
  onColorChange?: (color: string) => void;
  onWidthChange?: (width: number) => void;
  onClearDrawing?: () => void;
  onShapeTypeChange?: (shapeType: 'rectangle' | 'circle' | 'triangle') => void;
  currentColor?: string;
  currentWidth?: number;
  currentShapeType?: 'rectangle' | 'circle' | 'triangle';
}

const ShapeSelector: React.FC<{
  onShapeTypeChange: (shapeType: 'rectangle' | 'circle' | 'triangle') => void;
  currentShapeType: 'rectangle' | 'circle' | 'triangle';
}> = ({ onShapeTypeChange, currentShapeType }) => {
const shapes = [
  { type: 'rectangle', icon: <Rectangle weight="bold" className="size-6" /> },
  { type: 'circle', icon: <Circle weight="bold" className="size-6" /> },
  { type: 'triangle', icon: <Triangle weight="bold" className="size-6" /> }
];
  
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800 rounded-lg p-2">
        {shapes.map(shape => (
          <button
            key={shape.type}
            className={`flex items-center justify-center h-10 w-10 rounded-md transition-all duration-200 ${
              currentShapeType === shape.type 
                ? 'bg-white dark:bg-zinc-700 shadow-sm ring-1 ring-gray-200 dark:ring-zinc-600' 
                : ''
            }`}
            onClick={() => onShapeTypeChange(shape.type as any)}
          >
            <div className="text-gray-800 dark:text-gray-200">
              {shape.icon}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Drawing mode selector component
const DrawingModeSelector: React.FC<{
  drawingMode: 'shape' | 'arrow';
  onDrawingModeChange: (mode: 'shape' | 'arrow') => void;
}> = ({ drawingMode, onDrawingModeChange }) => {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800 rounded-lg p-2">
        <button
          className={`flex items-center justify-center h-10 w-24 rounded-md transition-all duration-200 ${
            drawingMode === 'shape' 
              ? 'bg-white dark:bg-zinc-700 shadow-sm ring-1 ring-gray-200 dark:ring-zinc-600' 
              : ''
          }`}
          onClick={() => onDrawingModeChange('shape')}
        >
          <div className="text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Shapes weight="bold" className="size-5" />
            <span className="text-sm font-medium">Shapes</span>
          </div>
        </button>
        <button
          className={`flex items-center justify-center h-10 w-24 rounded-md transition-all duration-200 ${
            drawingMode === 'arrow' 
              ? 'bg-white dark:bg-zinc-700 shadow-sm ring-1 ring-gray-200 dark:ring-zinc-600' 
              : ''
          }`}
          onClick={() => onDrawingModeChange('arrow')}
        >
          <div className="text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <ArrowElbowRight weight="bold" className="size-5" />
            <span className="text-sm font-medium">Arrow</span>
          </div>
        </button>
      </div>
    </div>
  );
};

// Drawing settings component
const DrawingSettings: React.FC<{
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onClearDrawing: () => void;
  onShapeTypeChange?: (shapeType: 'rectangle' | 'circle' | 'triangle') => void;
  onDrawingModeChange?: (mode: 'shape' | 'arrow') => void;
  currentColor: string;
  currentWidth: number;
  currentShapeType?: 'rectangle' | 'circle' | 'triangle';
  drawingMode?: 'shape' | 'arrow';
  showDrawingModeSelector?: boolean;
}> = ({
  onColorChange,
  onWidthChange,
  onClearDrawing,
  onShapeTypeChange,
  onDrawingModeChange,
  currentColor,
  currentWidth,
  currentShapeType = 'rectangle',
  drawingMode = 'shape',
  showDrawingModeSelector = false
}) => {
  const widths = [1, 3, 5, 8, 12];
  
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl shadow-lg p-4 min-w-[200px] border border-gray-100 dark:border-zinc-700">
      {showDrawingModeSelector && onDrawingModeChange && (
        <DrawingModeSelector 
          drawingMode={drawingMode}
          onDrawingModeChange={onDrawingModeChange}
        />
      )}
      
      {drawingMode === 'shape' && onShapeTypeChange && (
        <ShapeSelector 
          onShapeTypeChange={onShapeTypeChange}
          currentShapeType={currentShapeType}
        />
      )}
      
      <div className="mb-5 flex flex-row gap-5 justify-center items-center">
        <input
          type="color"
          value={currentColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-16 h-10 cursor-pointer rounded-sm"
        />
        <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800 rounded-lg p-2">
          {widths.map(width => (
            <button
              key={width}
              className={`flex items-center justify-center h-9 w-9 rounded-md transition-all duration-200 ${
                currentWidth === width 
                  ? 'bg-white dark:bg-zinc-700 shadow-sm ring-1 ring-gray-200 dark:ring-zinc-600' 
                  : 'hover:bg-gray-100 dark:hover:bg-zinc-750'
              }`}
              onClick={() => onWidthChange(width)}
            >
              <div 
                className="rounded-full"
                style={{ 
                  width: `${width}px`, 
                  height: `${width}px`,
                  backgroundColor: currentColor 
                }}
              />
            </button>
          ))}
        </div>
      </div>
      
      <button
        className="w-full py-2.5 px-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-800/40 transition-colors duration-200 shadow-sm border border-red-100 dark:border-red-900/50"
        onClick={onClearDrawing}
      >
        Clear All
      </button>
    </div>
  );
};

export const Panel: React.FC<PanelProps> = ({ 
  // Original Panel props
  activeTool, 
  onToolChange, 
  onCommandSelect,
  
  // Text panel props
  onTextCommandSelect, 
  
  // Drawing panel props
  onDrawingModeChange = () => {}, 
  activeDrawingMode = 'none',
  onColorChange = () => {},
  onWidthChange = () => {},
  onClearDrawing = () => {},
  onShapeTypeChange = () => {},
  currentColor = '#000000',
  currentWidth = 3,
  currentShapeType = 'rectangle'
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeSettingsTool, setActiveSettingsTool] = useState<'pen' | 'draw' | null>(null);
  const [drawingSubMode, setDrawingSubMode] = useState<'shape' | 'arrow'>('shape');

  // Dark mode detection
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = 
        document.documentElement.classList.contains('dark') || 
        document.body.classList.contains('dark') ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      setIsDarkMode(isDark);
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    observer.observe(document.body, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);

    const handleThemeChange = () => {
      checkDarkMode();
    };

    document.addEventListener('theme-changed', handleThemeChange);
    window.addEventListener('theme-changed', handleThemeChange);

    const getStoredTheme = async () => {
      try {
        if (window.electronAPI && window.electronAPI.store && window.electronAPI.store.get) {
          const savedTheme = await window.electronAPI.store.get('theme');
          const effectiveTheme = savedTheme === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : savedTheme;
          
          setIsDarkMode(effectiveTheme === 'dark');
        }
      } catch (error) {
        console.error('Failed to get theme from store:', error);
      }
    };

    getStoredTheme();

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkDarkMode);
      document.removeEventListener('theme-changed', handleThemeChange);
      window.removeEventListener('theme-changed', handleThemeChange);
    };
  }, []);

  // Helper function to exit drawing mode if active
  const exitDrawingModeIfActive = () => {
    if (activeDrawingMode && activeDrawingMode !== 'none') {
      onDrawingModeChange('none');
      setActiveSettingsTool(null);
    }
  };

  // Original Panel handlers
  const handleToggle = () => {
    exitDrawingModeIfActive();
    onToolChange(activeTool === 'cursor' ? 'hand' : 'cursor');
  };

  const handleBrowserClick = () => {
    exitDrawingModeIfActive();
    onCommandSelect?.('browser');
  };

  const handleFileUploadClick = () => {
    exitDrawingModeIfActive();
    onCommandSelect?.('universal-file-upload');
  };

  // Text panel handlers
  const handleTextSelect = (command: string) => {
    exitDrawingModeIfActive();
    if (onTextCommandSelect) {
      onTextCommandSelect(command);
    }
  };

  // Drawing panel handlers
  const effectiveColor = currentColor || '#FFC107';
    
  const handleToolClick = (mode: 'pen' | 'draw') => {
    if (mode === 'draw') {
      const targetMode = drawingSubMode;
      if (activeDrawingMode === targetMode) {
        onDrawingModeChange('none');
      } else {
        onDrawingModeChange(targetMode);
      }
    } else {
      if (activeDrawingMode === mode) {
        onDrawingModeChange('none');
      } else {
        onDrawingModeChange(mode);
      }
    }
  };
  
  const handleDrawingSubModeChange = (subMode: 'shape' | 'arrow') => {
    setDrawingSubMode(subMode);
    onDrawingModeChange(subMode);
  };
  
  const handleDrawingPopoverOpenChange = (isOpen: boolean, tool: 'pen' | 'draw') => {
    if (isOpen) {
      setActiveSettingsTool(tool);
      if (tool === 'draw') {
        if (activeDrawingMode !== 'shape' && activeDrawingMode !== 'arrow') {
          onDrawingModeChange(drawingSubMode);
        }
      } else if (activeDrawingMode !== tool) {
        onDrawingModeChange(tool);
      }
    } else if (activeSettingsTool === tool) {
      setActiveSettingsTool(null);
    }
  };

  const renderDrawIcon = () => {
    if (activeDrawingMode === 'arrow' || (activeDrawingMode === 'none' && drawingSubMode === 'arrow')) {
      return <ArrowElbowRight weight="bold" className="size-full" />;
    }
    
    switch (currentShapeType) {
      case 'circle':
        return <Circle weight="bold" className="size-full" />;
      case 'triangle':
        return <Triangle weight="bold" className="size-full" />;
      case 'rectangle':
        return <Square weight="bold" className="size-full" />;
      default:
        return <Shapes weight="bold" className="size-full" />;
    }
  };

  // Helper function to determine if drawing mode is active
  const isDrawingModeActive = () => {
    return activeDrawingMode === 'shape' || activeDrawingMode === 'arrow';
  };

  const isPenModeActive = () => {
    return activeDrawingMode === 'pen';
  };

  return (
    <div className="relative">
      <Dock iconMagnification={60} iconDistance={100}>
        {/* ORIGINAL PANEL ICONS */}
        <DockIcon 
          className="transition-colors duration-200 bg-black/10 dark:bg-white/10"
          onClick={handleToggle}
        >
          {activeTool === 'hand' ? (
            <Hand className="size-full" />
          ) : (
            <Cursor className="size-full" />
          )}
        </DockIcon>
        
        <DockIcon 
          className="transition-colors duration-200 bg-black/10 dark:bg-white/10"
          onClick={handleBrowserClick}
        >
          <Browser className="size-full" />
        </DockIcon>
        
        <DockIcon 
          className="transition-colors duration-200 bg-black/10 dark:bg-white/10"
          onClick={handleFileUploadClick}
        >
          <FolderOpen className="size-full" />
        </DockIcon>

        {/* TEXT PANEL ICONS */}
        <DockIcon 
          className="transition-colors duration-200 bg-black/10 dark:bg-white/10"
          onClick={() => handleTextSelect('normal')}
        >
          <TextAa className="size-full text-gray-800 dark:text-gray-200" />
        </DockIcon>             

        {/* DRAWING PANEL ICONS */}
        <DockIcon 
          className={`transition-colors duration-200 ${
            isDrawingModeActive() 
              ? 'bg-yellow-100/80 dark:bg-yellow-900/40' 
              : 'bg-black/10 dark:bg-white/10'
          }`}
          onClick={() => handleToolClick('draw')}
        >
          <Popover 
            open={activeSettingsTool === 'draw'} 
            onOpenChange={(isOpen) => handleDrawingPopoverOpenChange(isOpen, 'draw')}
          >
            <PopoverTrigger>
              {renderDrawIcon()}
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="w-auto p-0 border-0 z-50 shadow-xl">
              <DrawingSettings
                onColorChange={onColorChange}
                onWidthChange={onWidthChange}
                onClearDrawing={onClearDrawing}
                onShapeTypeChange={onShapeTypeChange}
                onDrawingModeChange={handleDrawingSubModeChange}
                currentColor={effectiveColor}
                currentWidth={currentWidth}
                currentShapeType={currentShapeType}
                drawingMode={drawingSubMode}
                showDrawingModeSelector={true}
              />
            </PopoverContent>
          </Popover>
        </DockIcon>
        
        <DockIcon 
          className={`transition-colors duration-200 ${
            isPenModeActive() 
              ? 'bg-yellow-100/80 dark:bg-yellow-900/40' 
              : 'bg-black/10 dark:bg-white/10'
          }`}
          onClick={() => handleToolClick('pen')}
        >
          <Popover 
            open={activeSettingsTool === 'pen'} 
            onOpenChange={(isOpen) => handleDrawingPopoverOpenChange(isOpen, 'pen')}
          >
            <PopoverTrigger>
              <Palette weight="bold" className="size-full text-gray-800 dark:text-gray-200" />
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="w-auto p-0 border-0 z-50 shadow-xl">
              <DrawingSettings
                onColorChange={onColorChange}
                onWidthChange={onWidthChange}
                onClearDrawing={onClearDrawing}
                currentColor={effectiveColor}
                currentWidth={currentWidth}
              />
            </PopoverContent>
          </Popover>
        </DockIcon>
      </Dock>
    </div>
  );
};