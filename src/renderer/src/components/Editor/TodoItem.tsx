import React, { useState, useRef, useEffect } from 'react';
import { Check, Square, CheckSquare } from 'lucide-react';

interface TodoItemProps {
  content: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onContentChange: (content: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
  isOnlyItem?: boolean;
}

const TodoItem: React.FC<TodoItemProps> = ({ 
  content, 
  checked, 
  onChange, 
  onContentChange,
  onKeyDown,
  onBlur,
  isOnlyItem = false
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Update content on contenteditable div changes
  useEffect(() => {
    if (contentRef.current && contentRef.current.textContent !== content) {
      contentRef.current.textContent = content;
    }
  }, [content]);

  // Handle blur event
  const handleBlur = () => {
    // If this is the only todo item and it's empty, call the onBlur handler
    if (isOnlyItem && (!content || !content.trim()) && onBlur) {
      onBlur();
    }
  };

  return (
    <div className="flex items-start group py-1">
      <button
        type="button"
        className="flex-shrink-0 w-5 h-5 mr-2 mt-1 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 focus:outline-none"
        onClick={() => onChange(!checked)}
      >
        {checked ? (
          <CheckSquare className="w-full h-full" />
        ) : (
          <Square className="w-full h-full" />
        )}
      </button>
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        className={`flex-1 outline-none ${
          checked ? 'line-through text-gray-500 dark:text-gray-400' : ''
        }`}
        onInput={(e) => onContentChange(e.currentTarget.textContent || '')}
        onKeyDown={onKeyDown}
        onBlur={handleBlur}
        data-placeholder="To-do item..."
      />
    </div>
  );
};

export default TodoItem;