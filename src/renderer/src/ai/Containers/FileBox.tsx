// Updates to FileBox.tsx to handle folder and ZIP displays

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Clipboard, Check, File, Trash2, Pencil, FolderOpen, Archive } from 'lucide-react';
import { X } from '@phosphor-icons/react';

interface FileBoxProps {
  content: string;
  fileInfo: {
    name: string;
    type?: string;
    extension?: string;
    size?: string;
    fileCount?: number;
    folderCount?: number;
  };
  onRemove?: () => void;
  onEdit?: (newContent: string) => void;
  allowEdit?: boolean;
  isUserMessage?: boolean;
  isInCommandEditMode?: boolean;
}

export const FileBox: React.FC<FileBoxProps> = ({
  content,
  fileInfo,
  onRemove,
  onEdit,
  allowEdit = false,
  isUserMessage = false,
  isInCommandEditMode = false
}) => {
  // State for dialog control
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // State for edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  // State for editing content
  const [editingContent, setEditingContent] = useState(content);
  // State for copy button
  const [isCopied, setIsCopied] = useState(false);
  // State to track if content has been modified
  const [isModified, setIsModified] = useState(false);
  
  // Update editing content when original content changes
  useEffect(() => {
    setEditingContent(content);
    setIsModified(false);
  }, [content]);
  
  // Function to copy content to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Handle remove click with stopPropagation to prevent dialog from opening
  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove && allowEdit) onRemove();
  };

  // Update the handleEditClick function in FileBox.tsx
  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (allowEdit) {
      // If in CommandMain edit mode, use CommandMain's event system
      if (isInCommandEditMode) {
        // Dispatch event for CommandMain to handle the edit
        const event = new CustomEvent('commandEditFile', { 
          detail: { content, fileInfo }
        });
        window.dispatchEvent(event);
        
        // This is critical - completely prevent any other actions
        return false;
      } else {
        // Regular dialog opening
        setEditingContent(content);
        setIsEditDialogOpen(true);
      }
    }
    
    // Prevent any default actions
    return false;
  };

  // Save edited content
  const handleSaveEdit = () => {
    if (onEdit && allowEdit && isModified) {
      onEdit(editingContent);
    }
    setIsEditDialogOpen(false);
  };

  // Handle editing token key down (for line breaks)
  const handleEditingKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle shift+enter to insert line break
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      
      // Get cursor position
      const cursorPos = e.currentTarget.selectionStart;
      
      // Insert line break at cursor position
      const newContent = 
        editingContent.substring(0, cursorPos) + 
        '\n' + 
        editingContent.substring(cursorPos);
      
      setEditingContent(newContent);
      setIsModified(newContent !== content);
      
      // Set cursor position after the inserted line break
      setTimeout(() => {
        const textarea = e.currentTarget;
        if (textarea) {
          textarea.selectionStart = cursorPos + 1;
          textarea.selectionEnd = cursorPos + 1;
        }
      }, 0);
    }
  };

  // Get icon based on file type
  const getFileIcon = () => {
    if (fileInfo.type === 'folder') {
      return <FolderOpen className="h-4 w-4" />;
    } else if (fileInfo.type === 'zip') {
      return <Archive className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };
  
  // Helper function to count lines in text
  const countLines = (text: string): number => {
    return text.split('\n').length;
  };
  
  // Format the display name
  const getDisplayName = () => {
    if (!fileInfo || !fileInfo.name) {
      return "Unknown file";
    }
    
    const name = fileInfo.name;
    const extension = fileInfo.extension || '';
    
    // If name already includes extension, don't add it again
    if (extension && name.toLowerCase().endsWith(extension.toLowerCase())) {
      return name;
    }
    
    return extension ? `${name}${extension}` : name;
  };

  // Get additional display info for folders/zips
  const getAdditionalInfo = () => {
    if (fileInfo.type === 'folder' || fileInfo.type === 'zip') {
      const fileCount = fileInfo.fileCount || 0;
      const folderCount = fileInfo.folderCount || 0;
      return `${fileCount} file${fileCount !== 1 ? 's' : ''}, ${folderCount} folder${folderCount !== 1 ? 's' : ''}`;
    }
    return '';
  };
  
  return (
    <>
      {/* File Box Display */}
      <div 
        className="flex-shrink-0 min-w-[150px] max-w-[200px] p-1 border rounded-md bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors relative group"
        onClick={() => setIsDialogOpen(true)}
      >
        <div className="flex items-center gap-2 p-2 h-[45px] bg-zinc-50 dark:bg-zinc-900 rounded border dark:border-zinc-700">
          {getFileIcon()}
          <div className="flex flex-col overflow-hidden">
            <span className="text-[14px] font-semibold truncate">{getDisplayName()}</span>
            <span className="text-[12px] text-zinc-500 truncate">
              {fileInfo.type ? `${fileInfo.type.toUpperCase()}` : ''} 
              {fileInfo.size ? ` • ${fileInfo.size}` : ''}
              {getAdditionalInfo() && ` • ${getAdditionalInfo()}`}
            </span>
          </div>
        </div>
      </div>
      
      {/* File Content Viewing Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {fileInfo.type === 'folder' ? 'Folder: ' : fileInfo.type === 'zip' ? 'ZIP Archive: ' : 'File: '}
              {getDisplayName()}
            </DialogTitle>
            <div className="text-xs text-muted-foreground mt-1">
              {fileInfo.type === 'folder' || fileInfo.type === 'zip' ? (
                <>
                  {fileInfo.type.toUpperCase()} • {fileInfo.size}
                  {getAdditionalInfo() && ` • ${getAdditionalInfo()}`}
                </>
              ) : (
                <>
                  {fileInfo.type && fileInfo.extension && `${fileInfo.type.toUpperCase()} (${fileInfo.extension})`}
                  {fileInfo.size && ` • ${fileInfo.size}`}
                </>
              )}
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
            
            <pre className="w-full outline-none bg-inherit p-2 border rounded-md h-64 overflow-auto font-mono text-sm sidebar-scrollbar pr-10 whitespace-pre-wrap">
              {content}
            </pre>
            
            <div className="text-xs text-gray-500 mt-1">
              {countLines(content)} lines • {content.length} characters
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              {/* Show Edit and Remove buttons side by side when applicable */}
              {isUserMessage && allowEdit && (
                <>
                  <Button 
                    variant="default" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      
                      // If in CommandMain edit mode, use the event system
                      if (isInCommandEditMode) {
                        window.dispatchEvent(new CustomEvent('commandEditFile', { 
                          detail: { content, fileInfo }
                        }));
                      } else {
                        // Normal flow
                        setIsEditDialogOpen(true);
                        setEditingContent(content);
                      }
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  
                  {onRemove && (
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        onRemove();
                        setIsDialogOpen(false);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </>
              )}
              
              {/* Show Remove button only when not a user message but edit is allowed */}
              {!isUserMessage && onRemove && allowEdit && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    onRemove();
                    setIsDialogOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
            
            <DialogClose asChild>
              <Button variant="default">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Content Editing Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit {fileInfo.type === 'folder' ? 'Folder Content: ' : fileInfo.type === 'zip' ? 'ZIP Content: ' : 'File Content: '}
              {getDisplayName()}
            </DialogTitle>
            <div className="text-xs text-muted-foreground mt-1">
              Press Shift+Enter for line breaks
            </div>
          </DialogHeader>
          
          <div className="p-2">
            <textarea
              value={editingContent}
              onChange={(e) => {
                setEditingContent(e.target.value);
                setIsModified(e.target.value !== content);
              }}
              onKeyDown={handleEditingKeyDown}
              className="w-full outline-none bg-inherit p-2 border rounded-md resize-none h-64 font-mono text-sm sidebar-scrollbar"
            />
            <div className="text-xs text-gray-500 mt-1">
              {countLines(editingContent)} lines • {editingContent.length} characters
              {isModified && <span className="ml-2 text-yellow-500">(modified)</span>}
            </div>
          </div>
          
          <DialogFooter>
            <div className="flex justify-between w-full">
              <div></div> {/* Empty div to maintain spacing - removed the Remove button from here */}
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button 
                  variant="default" 
                  onClick={handleSaveEdit}
                  disabled={!isModified || !allowEdit}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};