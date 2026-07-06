import React from 'react';
import ListItem from './ListItem';

export interface ListItemData {
  id: string;
  content: string;
}

interface ListProps {
  items: ListItemData[];
  onItemChange: (id: string, content: string) => void;
  onItemRemove: (id: string) => void;
  onItemAdd: () => void;
  onKeyDown: (e: React.KeyboardEvent, id: string, index: number) => void;
  onBlur: () => void;
  type: 'bullet' | 'numbered';
}

const List: React.FC<ListProps> = ({
  items,
  onItemChange,
  onItemRemove,
  onItemAdd,
  onKeyDown,
  onBlur,
  type
}) => {
  return (
    <div className="list-container">
      {items.map((item, index) => (
        <div key={item.id} className="flex items-start mb-1">
          <span className="mr-2 mt-1 select-none">
            {type === 'bullet' ? '•' : `${index + 1}.`}
          </span>
          <div className="flex-1">
            <ListItem
              content={item.content}
              onContentChange={(content) => onItemChange(item.id, content)}
              onKeyDown={(e) => onKeyDown(e, item.id, index)}
              onBlur={onBlur}
              isOnlyItem={items.length === 1}
            />
          </div>
        </div>
      ))}
      <button
        className="mt-2 ml-7 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-sm flex items-center"
        onClick={onItemAdd}
      >
        <span className="mr-1">+</span> Add item
      </button>
    </div>
  );
};

export default List;