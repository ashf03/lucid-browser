import React, { useState, useEffect, KeyboardEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Clipboard, Check, Pencil, Trash2 } from 'lucide-react';
import { X } from '@phosphor-icons/react';

interface PasteBoxProps {
  content: string;
  maxDisplayLines?: number;
  maxPreviewChars?: number;
  onRemove?: () => void;
  onEdit?: (newContent: string) => void;
  allowEdit?: boolean;
  isUserMessage?: boolean;
  isInCommandEditMode?: boolean; // New prop to detect command edit mode
}

export const PasteBox: React.FC<PasteBoxProps> = ({
  content,
  maxDisplayLines = 3,
  maxPreviewChars = 50,
  onRemove,
  onEdit,
  allowEdit = false,
  isUserMessage = false,
  isInCommandEditMode = false // Default to false
}) => {
  // State for dialog control
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // State for copy button
  const [isCopied, setIsCopied] = useState(false);
  // State for editing the content
  const [editingContent, setEditingContent] = useState(content);
  // State to track if content has been modified
  const [isModified, setIsModified] = useState(false);
  
  // Update editing content when original content changes
  useEffect(() => {
    setEditingContent(content);
    setIsModified(false);
  }, [content]);
  
  // Get preview text
  const getPreviewText = (text: string): string => {
    // Get first few lines
    const lines = text.split('\n');
    const previewLines = lines.slice(0, maxDisplayLines);
    let previewText = previewLines.join('\n');
    
    // Truncate if still too long
    if (previewText.length > maxPreviewChars) {
      previewText = previewText.substring(0, maxPreviewChars) + '...';
    } else if (lines.length > maxDisplayLines) {
      previewText = previewText + '\n...';
    }
    
    return previewText;
  };

  // Helper function to count lines in text
  const countLines = (text: string): number => {
    return text.split('\n').length;
  };
  
  // Function to copy content to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editingContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Handle remove click with stopPropagation to prevent dialog from opening
  const handleRemoveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onRemove && allowEdit) {
      onRemove();
    }
    
    return false;
  };

  // Handle edit click with stopPropagation
  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (allowEdit) {
      // If in CommandMain edit mode, use CommandMain's event system
      if (isInCommandEditMode) {
        window.dispatchEvent(new CustomEvent('commandEditPaste', { 
          detail: { content }
        }));
      } else {
        // Regular behavior
        setIsDialogOpen(true);
      }
    }
    
    return false;
  };
  
  // Common button style class
  const buttonClass = `${
    allowEdit 
      ? "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200" 
      : "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
  }`;
  
  return (
    <>
      {/* Paste Box Display */}
      <div 
        className="flex-shrink-0 min-w-[150px] max-w-[200px] p-1 border rounded-md bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors relative group"
        onClick={() => setIsDialogOpen(true)}
      >
        <pre className="text-xs whitespace-pre-wrap text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 p-1 rounded border dark:border-zinc-700 max-h-[40px] overflow-hidden">
          {getPreviewText(content)}
        </pre>
      </div>
      
      {/* Paste Content Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {allowEdit ? "Edit Pasted Content" : "Review Pasted Content"}
            </DialogTitle>
            <div className="text-xs text-muted-foreground mt-1">
              Press Shift+Enter for line breaks
            </div>
          </DialogHeader>
          
          <div className="p-2 relative">
            <Button
              variant="outline"
              size="sm"
              className="absolute right-4 top-4 z-10 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              onClick={handleCopy}
            >
              {isCopied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
            </Button>
            
            {allowEdit ? (
              <textarea
                value={editingContent}
                onChange={(e) => {
                  setEditingContent(e.target.value);
                  setIsModified(e.target.value !== content);
                }}
                onKeyDown={(e) => {
                  // Detect shift+enter and insert a line break
                  if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault();
                    const cursorPos = e.currentTarget.selectionStart;
                    const newContent = editingContent.substring(0, cursorPos) + '\n' + editingContent.substring(cursorPos);
                    setEditingContent(newContent);
                    setIsModified(newContent !== content);
                    setTimeout(() => {
                      if (e.currentTarget) {
                        e.currentTarget.selectionStart = cursorPos + 1;
                        e.currentTarget.selectionEnd = cursorPos + 1;
                      }
                    }, 0);
                  }
                }}
                className="w-full outline-none bg-inherit p-2 border rounded-md resize-none h-64 font-mono text-sm sidebar-scrollbar pr-10 whitespace-pre-wrap"
              />
            ) : (
              <pre className="w-full outline-none bg-inherit p-2 border rounded-md h-64 overflow-auto font-mono text-sm sidebar-scrollbar pr-10 whitespace-pre-wrap">
                {content}
              </pre>
            )}
            
            <div className="text-xs text-gray-500 mt-1">
              {countLines(editingContent)} lines • {editingContent.length} characters
              {isModified && <span className="ml-2 text-yellow-500">(modified)</span>}
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            <div>
              {/* Remove button in dialog - only shown for user messages */}
              {onRemove && allowEdit && isUserMessage && (
                <Button 
                  variant="destructive" 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onRemove();
                    setIsDialogOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline" type="button">Cancel</Button>
              </DialogClose>
              
              {allowEdit && onEdit && isModified ? (
                <Button 
                  variant="default" 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    
                    // If in CommandMain edit mode, use CommandMain's event system
                    if (isInCommandEditMode) {
                      window.dispatchEvent(new CustomEvent('commandEditPaste', { 
                        detail: { content: editingContent }
                      }));
                      setIsDialogOpen(false);
                    } else if (onEdit) {
                      // Regular edit flow
                      onEdit(editingContent);
                      setIsModified(false);
                      setIsDialogOpen(false);
                    }
                  }}
                  disabled={!isModified || !allowEdit}
                >
                  Save Changes
                </Button>
              ) : (
                <DialogClose asChild>
                  <Button variant="default" type="button">Close</Button>
                </DialogClose>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};