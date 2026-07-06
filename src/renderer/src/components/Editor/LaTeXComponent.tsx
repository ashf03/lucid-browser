"use client";

import React, { useState, useRef, useEffect } from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import { X, PencilSimple, Sigma } from '@phosphor-icons/react';
import * as Popover from '@radix-ui/react-popover';
import 'katex/dist/katex.min.css';
import TextareaAutosize from 'react-textarea-autosize';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Type } from 'lucide-react';

interface LaTeXComponentProps {
  initialLatex?: string;
  initialDisplayMode?: boolean;
  onUpdate?: (latex: string, isBlock: boolean) => void;
  className?: string;
  editable?: boolean;
  // Add external edit trigger prop
  externalEditTrigger?: boolean;
}

const LaTeXComponent: React.FC<LaTeXComponentProps> = ({
  initialLatex = '',
  initialDisplayMode = true,
  onUpdate,
  className = '',
  editable = true,
  externalEditTrigger = false
}) => {
  // Main state
  const [latex, setLatex] = useState(initialLatex);
  const [displayMode, setDisplayMode] = useState<boolean>(initialDisplayMode);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-open edit mode for empty LaTeX
  useEffect(() => {
    if (editable && !initialLatex && !isEditing) {
      // Open the editor automatically if it's a new empty component
      setIsEditing(true);
    }
  }, [editable, initialLatex, isEditing]);

  // Focus the textarea when editor opens
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Reset error when latex changes
  useEffect(() => {
    setError(null);
  }, [latex]);

  // Update parent component when latex changes
  useEffect(() => {
    if (onUpdate && latex !== initialLatex) {
      onUpdate(latex, displayMode);
    }
  }, [latex, displayMode, onUpdate, initialLatex]);
  
  // Respond to external edit trigger
  useEffect(() => {
    if (externalEditTrigger && editable && !isEditing) {
      setIsEditing(true);
    }
  }, [externalEditTrigger, editable, isEditing]);

  const handleEdit = (e: React.MouseEvent) => {
    // Stop event propagation to prevent issues with Popover
    e.stopPropagation();
    e.preventDefault();
    
    if (editable) {
      setIsEditing(true);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    try {
      // Just close the editor - the latex state is already updated
      setIsEditing(false);
    } catch (e) {
      setError("Error saving LaTeX");
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    // Escape to cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
    
    // Stop propagation to prevent the event from reaching the renderer
    e.stopPropagation();
  };

  // Handle textarea content changes without affecting component selection
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLatex(e.target.value);
    // Stop event propagation to prevent component selection issues
    e.stopPropagation();
  };

  const renderEquation = () => {
    try {
      return displayMode ? (
        <BlockMath math={latex || ' '} />
      ) : (
        <InlineMath math={latex || ' '} />
      );
    } catch (e) {
      return <div className="text-red-500">Invalid LaTeX syntax</div>;
    }
  };

  // Renderer component - with edit button removed
  const Renderer = () => (
    <div 
      ref={containerRef}
      className={`latex-component ${displayMode ? 'py-4' : 'py-2'} px-3 relative group ${className}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (editable) setIsEditing(true);
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      aria-label={`LaTeX equation: ${latex}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (editable) setIsEditing(true);
        }
      }}
    >
      <div className="latex-display" onClick={(e) => e.stopPropagation()}>
        {error ? (
          <div className="text-red-500">{error}</div>
        ) : (
          renderEquation()
        )}
      </div>
      {/* Edit button removed from here */}
    </div>
  );

  // Handle display mode change from Select
  const handleDisplayModeChange = (value: string) => {
    setDisplayMode(value === 'block');
  };

  // Return Popover with Renderer as the trigger
  return (
    <Popover.Root open={isEditing} onOpenChange={setIsEditing}>
      <Popover.Trigger asChild>
        <div onClick={(e) => e.stopPropagation()}>
          <Renderer />
        </div>
      </Popover.Trigger>

      {isEditing && (
        <Popover.Portal>
          <Popover.Content
            className="bg-zinc-50 dark:bg-zinc-950 shadow-none rounded-lg w-[600px] p-0 overflow-hidden border border-zinc-300 dark:border-zinc-800 z-50 popover-content"
            sideOffset={5}
            onKeyDown={handleKeyDown}
            onInteractOutside={() => handleSave()}
            align="start"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Styled header area */}
            <div className="relative">
              {/* Header content with visual elements */}
              <div className="relative flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800">
                {/* This is the replaced section - showing a scrollable preview instead of static text */}
                <div className="pr-2">
                    <div className="flex items-center gap-1 px-3 py-2 bg-zinc-100/50 dark:bg-zinc-900/50 overflow-x-auto scrollbar-hide">
                {["\\frac{}{}", "\\sqrt{}", "\\sum_{i=0}^{n}", "\\int_{a}^{b}", "\\lim_{x \\to 0}"].map(
                  (snippet, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation()
                        setLatex((prev) => prev + snippet)
                        textareaRef.current?.focus()
                      }}
                      className="px-2 py-1 text-xs rounded bg-zinc-200/80 hover:bg-zinc-300/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 transition-colors whitespace-nowrap"
                    >
                      {snippet}
                    </button>
                  ),
                )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div onClick={(e) => e.stopPropagation()} className="w-24">
                    <Select onValueChange={handleDisplayModeChange} defaultValue={displayMode ? "block" : "inline"}>
                      <SelectTrigger className="h-7 text-xs border-zinc-300 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-900/50">
                        <div className="flex items-center gap-1">
                          <Type size={12} />
                          <SelectValue placeholder="Display mode" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inline" className="text-xs">
                          Inline
                        </SelectItem>
                        <SelectItem value="block" className="text-xs">
                          Block
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClose()
                    }}
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-200/50 hover:bg-zinc-300/50 dark:bg-zinc-800/50 dark:hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                    aria-label="Close editor"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-0">
              <div className="flex flex-col">
                <div className="p-3 bg-zinc-950 overflow-auto">
                  <TextareaAutosize
                    ref={textareaRef}
                    value={latex}
                    onChange={handleTextareaChange}
                    className="w-full sidebar-scrollbar bg-zinc-950 text-green-400 dark:text-green-400 font-mono p-2 outline-none border-none rounded-sm"
                    placeholder="f(x) = \frac{1}{1+x^2}"
                    onKeyDown={handleKeyDown}
                    minRows={2}
                    maxRows={10}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>
            <Popover.Arrow className="fill-zinc-50 dark:fill-zinc-950" />
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
};

export default LaTeXComponent;