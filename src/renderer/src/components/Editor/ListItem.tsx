import React, { useRef, useEffect, useState } from 'react';

interface ListItemProps {
  content: string;
  onContentChange: (content: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  isOnlyItem: boolean;
}

const ListItem: React.FC<ListItemProps> = ({
  content,
  onContentChange,
  onKeyDown,
  onBlur,
  isOnlyItem
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [internalContent, setInternalContent] = useState(content);
  const isUserTyping = useRef(false);
  
  // Use a simpler approach - don't try to control the contentEditable too much
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    // Mark that the user is currently typing
    isUserTyping.current = true;
    
    // Get the current text and update both the internal state and parent
    const newContent = (e.target as HTMLDivElement).textContent || '';
    setInternalContent(newContent);
    onContentChange(newContent);
    
    // Clear the typing flag after a short delay
    setTimeout(() => {
      isUserTyping.current = false;
    }, 100);
  };
  
  // Only sync from props when content changes externally and user isn't typing
  useEffect(() => {
    if (content !== internalContent && !isUserTyping.current && contentRef.current) {
      // Remember current selection if any
      const selection = window.getSelection();
      let currentRange = null;
      let isActive = false;
      
      if (selection && selection.rangeCount > 0) {
        currentRange = selection.getRangeAt(0).cloneRange();
        isActive = contentRef.current.contains(selection.anchorNode);
      }
      
      // Update the content (only if needed)
      if (contentRef.current.textContent !== content) {
        contentRef.current.textContent = content;
      }
      
      // If this element had focus, try to restore the selection
      if (isActive && currentRange) {
        try {
          selection?.removeAllRanges();
          selection?.addRange(currentRange);
        } catch (e) {
          // If restoration fails, do nothing (keep current selection)
        }
      }
      
      setInternalContent(content);
    }
  }, [content, internalContent]);
  
  // Ensure we render the initial content correctly
  useEffect(() => {
    if (contentRef.current && contentRef.current.textContent !== content && 
        (!contentRef.current.textContent || !contentRef.current.isConnected)) {
      contentRef.current.textContent = content;
    }
  }, []);
  
  return (
    <div
      ref={contentRef}
      contentEditable
      suppressContentEditableWarning
      className="list-item-content px-1 py-1 border-none outline-none w-full"
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onBlur={() => {
        isUserTyping.current = false;
        onBlur();
      }}
      data-placeholder={isOnlyItem && !internalContent ? "List item..." : ""}
    ></div>
  );
};

export default ListItem;