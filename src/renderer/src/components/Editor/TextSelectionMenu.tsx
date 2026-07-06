import React, { useRef, useEffect, useState } from 'react';
import { TextB, AlignLeft, AlignRight, TextItalic, TextUnderline, PaintBucket, Plus, Minus, TextStrikethrough, TextAlignLeft, TextAlignRight, TextAlignCenter, TextAlignJustify, TextAa, Highlighter, Function, CheckSquare } from '@phosphor-icons/react';

interface TextSelectionMenuProps {
  position: { x: number; y: number } | null;
  isVisible: boolean;
  onFormatText: (formatType: string, value?: string) => void;
  onOutsideClick: () => void;
}

const TextSelectionMenu: React.FC<TextSelectionMenuProps> = ({
  position,
  isVisible,
  onFormatText,
  onOutsideClick
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#000000");
  const colorInputRef = useRef<HTMLInputElement>(null);
  
  // New state for highlight color picker
  const [showHighlightColorPicker, setShowHighlightColorPicker] = useState(false);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState("#ffff00");
  const highlightColorInputRef = useRef<HTMLInputElement>(null);
  
  const [showAlignmentOptions, setShowAlignmentOptions] = useState(false);
  const [showFontOptions, setShowFontOptions] = useState(false);
  const [selectedFont, setSelectedFont] = useState("Arial, sans-serif");

  // Font families list
  const fonts: string[] = [
    // Sans-serif
    "Arial, sans-serif",
    "Helvetica, sans-serif", 
    "Verdana, sans-serif",
    "Tahoma, sans-serif",
    "Trebuchet MS, sans-serif",
    "Gill Sans, sans-serif",
    "Segoe UI, sans-serif",
    "Geneva, sans-serif",
    "Lucida Grande, sans-serif",

    // Serif
    "Times New Roman, serif",
    "Georgia, serif",
    "Garamond, serif",
    "Palatino Linotype, serif",
    "Book Antiqua, serif",
    "Didot, serif",
    "Baskerville, serif",

    // Monospace
    "Courier New, monospace",
    "Lucida Console, monospace",
    "Consolas, monospace",
    "Monaco, monospace",
    "Courier, monospace",

    // Cursive / Display
    "Comic Sans MS, cursive",
    "Brush Script MT, cursive",
    "Impact, fantasy",
    "Copperplate, fantasy",
    "Papyrus, fantasy",
  ];

  // Handle clicks outside the menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onOutsideClick();
        setShowColorPicker(false);
        setShowHighlightColorPicker(false);
        setShowAlignmentOptions(false);
        setShowFontOptions(false);
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onOutsideClick]);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setSelectedColor(newColor);
    onFormatText('textColor', newColor);
  };

  // New handler for highlight color change
  const handleHighlightColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setSelectedHighlightColor(newColor);
    onFormatText('highlightColor', newColor);
  };

  // Toggle color picker and trigger click on the hidden input when button is clicked
  const handleColorButtonClick = () => {
    if (colorInputRef.current && !showColorPicker) {
      colorInputRef.current.click();
    }
    setShowColorPicker(!showColorPicker);
    // Close other popovers
    setShowHighlightColorPicker(false);
    setShowAlignmentOptions(false);
    setShowFontOptions(false);
  };

  // New handler for highlight color button click
  const handleHighlightColorButtonClick = () => {
    if (highlightColorInputRef.current && !showHighlightColorPicker) {
      highlightColorInputRef.current.click();
    }
    setShowHighlightColorPicker(!showHighlightColorPicker);
    // Close other popovers
    setShowColorPicker(false);
    setShowAlignmentOptions(false);
    setShowFontOptions(false);
  };

  // Toggle alignment options visibility
  const handleAlignmentButtonClick = () => {
    setShowAlignmentOptions(!showAlignmentOptions);
    // Close other popovers
    setShowColorPicker(false);
    setShowHighlightColorPicker(false);
    setShowFontOptions(false);
  };

  // Toggle font options visibility
  const handleFontButtonClick = () => {
    setShowFontOptions(!showFontOptions);
    // Close other popovers
    setShowColorPicker(false);
    setShowHighlightColorPicker(false);
    setShowAlignmentOptions(false);
  };

  // Handle alignment selection
  const handleAlignmentSelect = (alignType: string) => {
    onFormatText(alignType);
    setShowAlignmentOptions(false);
  };

  // Handle font selection
  const handleFontSelect = (font: string) => {
    setSelectedFont(font);
    onFormatText('fontFamily', font);
    setShowFontOptions(false);
  };

  // Handle LaTeX conversion
  const handleLatexConversion = () => {
    onFormatText('convertToLatex');
  };

  // Handle Todo List conversion
  const handleTodoListConversion = () => {
    onFormatText('convertToTodoList');
  };

  // Get display name for font (remove the fallback part)
  const getFontDisplayName = (font: string) => {
    return font.split(',')[0].replace(/"/g, '');
  };

  if (!isVisible || !position) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      className="absolute z-50 bg-zinc-50 dark:bg-zinc-900 rounded-md shadow-lg border border-gray-200 dark:border-zinc-700 py-1 flex flex-row"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateY(-110%)'
      }}
    >
      {/* Text formatting options */}
      <div className="flex border-r border-gray-200 dark:border-zinc-700 px-1">
        <button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
          onClick={() => onFormatText('bold')}
          title="Bold"
        >
          <TextB size={16} />
        </button>
        <button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
          onClick={() => onFormatText('italic')}
          title="Italic"
        >
          <TextItalic size={16} />
        </button>
        <button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
          onClick={() => onFormatText('underline')}
          title="Underline"
        >
          <TextUnderline size={16} />
        </button>
        <button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
          onClick={() => onFormatText('strikethrough')}
          title="Strikethrough"
        >
          <TextStrikethrough size={16} />
        </button>
      </div>

      {/* Font family button and popover */}
      <div className="flex border-r border-gray-200 dark:border-zinc-700 px-1 items-center relative">
        <button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded flex items-center cursor-pointer"
          onClick={handleFontButtonClick}
          title="Font Family"
        >
          <TextAa size={16} />
        </button>
        
        {/* Font Options Popover */}
        {showFontOptions && (
          <div className="absolute left-0 top-full mt-1 bg-zinc-50 dark:bg-zinc-900 rounded-md shadow-lg border border-gray-200 dark:border-zinc-700 py-1 z-10 w-52 max-h-64 overflow-y-auto font-selector-scroll">
            {fonts.map((font, index) => (
              <button
                key={index}
                className="p-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded flex items-center gap-2 w-full text-left transition-colors duration-150"
                onClick={() => handleFontSelect(font)}
                title={font}
              >
                <span 
                  className="truncate text-base leading-relaxed"
                  style={{ 
                    fontFamily: font,
                    fontSize: '16px',
                    fontWeight: 'normal'
                  }}
                >
                  {getFontDisplayName(font)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text color picker button */}
      <div className="flex border-r border-gray-200 dark:border-zinc-700 px-1 items-center">
        <button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded flex items-center cursor-pointer"
          onClick={handleColorButtonClick}
          title="Text Color"
        >
          <PaintBucket size={16} color={selectedColor} />
        </button>
        <input
          ref={colorInputRef}
          type="color"
          value={selectedColor}
          onChange={handleColorChange}
          className="absolute opacity-0 pointer-events-auto h-0 w-0"
          aria-hidden="true"
        />
      </div>

      {/* NEW: Highlight color picker button */}
      <div className="flex border-r border-gray-200 dark:border-zinc-700 px-1 items-center">
        <button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded flex items-center cursor-pointer"
          onClick={handleHighlightColorButtonClick}
          title="Highlight Color"
        >
          <Highlighter size={16} color={selectedHighlightColor} />
        </button>
        <input
          ref={highlightColorInputRef}
          type="color"
          value={selectedHighlightColor}
          onChange={handleHighlightColorChange}
          className="absolute opacity-0 pointer-events-auto h-0 w-0"
          aria-hidden="true"
        />
      </div>

      {/* Text alignment button and popover */}
      <div className="flex border-r border-gray-200 dark:border-zinc-700 px-1 items-center relative">
        <button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded flex items-center cursor-pointer"
          onClick={handleAlignmentButtonClick}
          title="Text Alignment"
        >
          <TextAlignLeft size={16} />
        </button>
        
        {/* Alignment Options Popover */}
        {showAlignmentOptions && (
          <div className="absolute left-0 top-full mt-1 bg-zinc-50 dark:bg-zinc-900 rounded-md shadow-lg border border-gray-200 dark:border-zinc-700 py-1 z-10 w-36">
            <button
              className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded flex items-center gap-2 w-full"
              onClick={() => handleAlignmentSelect('alignLeft')}
              title="Align Left"
            >
              <TextAlignLeft size={16} /> <span className="text-sm">Left</span>
            </button>
            <button
              className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded flex items-center gap-2 w-full"
              onClick={() => handleAlignmentSelect('alignRight')}
              title="Align Right"
            >
              <TextAlignRight size={16} /> <span className="text-sm">Right</span>
            </button>
            <button
              className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded flex items-center gap-2 w-full"
              onClick={() => handleAlignmentSelect('alignCenter')}
              title="Align Center"
            >
              <TextAlignCenter size={16} /> <span className="text-sm">Center</span>
            </button>
            <button
              className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded flex items-center gap-2 w-full"
              onClick={() => handleAlignmentSelect('alignJustify')}
              title="Align Justify"
            >
              <TextAlignJustify size={16} /> <span className="text-sm">Justified</span>
            </button>
          </div>
        )}
      </div>

      {/* Font size controls */}
      <div className="flex border-r border-gray-200 dark:border-zinc-700 px-1">
        <button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
          onClick={() => onFormatText('increaseFontSize')}
          title="Increase Font Size"
        >
          <Plus size={16} />
        </button>
        <button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
          onClick={() => onFormatText('decreaseFontSize')}
          title="Decrease Font Size"
        >
          <Minus size={16} />
        </button>
      </div>

      {/* Conversion buttons */}
      <div className="flex px-1">
        <button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
          onClick={handleLatexConversion}
          title="Convert to LaTeX"
        >
          <Function size={16} />
        </button>
        <button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
          onClick={handleTodoListConversion}
          title="Convert to Todo List"
        >
          <CheckSquare size={16} />
        </button>
      </div>
    </div>
  );
};

export default TextSelectionMenu;