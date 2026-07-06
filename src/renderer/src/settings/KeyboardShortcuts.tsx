import React, { useState, useEffect, useCallback } from 'react';
import { Trash, Pencil, ArrowClockwise } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

// Define Shortcut interface
interface Shortcut {
  id: string;
  name: string;
  keys: string[];
  action: string;
  isDefault?: boolean;
}

// List of reserved shortcuts that can't be overridden
const RESERVED_SHORTCUTS = [
  ['Ctrl', 'C'], // Copy
  ['Ctrl', 'V'], // Paste
  ['Ctrl', 'X'], // Cut
  ['Ctrl', 'Z'], // Undo
  ['Ctrl', 'A'], // Select All
  ['Alt', 'Tab'], // Next tab
  ['Ctrl', 'Shift', 'I'], // Previous tab
  ['Alt', 'F4'], // Close window
];

// List of available actions that can have shortcuts
const AVAILABLE_ACTIONS = [
  { id: 'open-history', name: 'Open History Settings', defaultShortcut: ['Ctrl', 'H'] },
  { id: 'add-tab', name: 'New Tab', defaultShortcut: ['Ctrl', 'T'] },
  { id: 'add-asterisk', name: 'New Asterisk', defaultShortcut: ['Shift', 'T'] },
  { id: 'zen-mode-trigger', name: 'New Asterisk', defaultShortcut: ['Shift', 'Z'] },
  { id: 'clipboard-quick', name: 'Clipboard Quick Access', defaultShortcut: ['Shift', 'C'] },
  { id: 'close-tab', name: 'Close Tab/Asterisk', defaultShortcut: ['Ctrl', 'W'] },
  { id: 'pin-tab', name: 'New Tab Group', defaultShortcut: ['Shift', 'P'] },
  { id: 'command-main', name: 'Command Main', defaultShortcut: ['Ctrl', 'K'] },
  { id: 'toggle-sidebar', name: 'Toggle Sidebar', defaultShortcut: ['Ctrl', 'B'] },
  { id: 'switch-tabs', name: 'Switch Tabs', defaultShortcut: ['Ctrl', 'Tab'] },
  { id: 'print-trigger', name: 'Print', defaultShortcut: ['Ctrl', 'P'] },
  { id: 'reload-trigger', name: 'Reload', defaultShortcut: ['Ctrl', 'R'] },
  { id: 'browser-ai', name: 'Talk to Webpage', defaultShortcut: ['Ctrl', 'F'] },
];

// List of available modifier keys
const MODIFIER_KEYS = ['Ctrl', 'Alt', 'Shift'];

// List of available regular keys
const REGULAR_KEYS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  'Tab', 'Esc', 'Space', 'Enter', 'Backspace', 'Delete',
  'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown',
];

const KeyboardShortcuts = () => {
  // State for shortcuts
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  
  // Dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentShortcut, setCurrentShortcut] = useState<Shortcut | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Edit shortcut form state
  const [newActionId, setNewActionId] = useState('');
  const [primaryModifier, setPrimaryModifier] = useState('Ctrl');
  const [secondaryModifier, setSecondaryModifier] = useState('none');
  const [mainKey, setMainKey] = useState('');
  const [shortcutPreview, setShortcutPreview] = useState('Select keys');
  
  // Create default shortcuts
const createDefaultShortcuts = useCallback(async () => {
  const defaults: Shortcut[] = AVAILABLE_ACTIONS
    .filter(action => action.defaultShortcut)
    .map((action, index) => ({
      id: `default-${index + 1}`,
      name: action.name,
      keys: action.defaultShortcut || [],
      action: action.id,
      isDefault: true
    }));
  
  console.log('Creating default shortcuts:', defaults);
  setShortcuts(defaults);
  
  try {
    const saved = await window.electronAPI.keyboardShortcuts.save(defaults);
    if (saved) {
      console.log('Successfully saved default shortcuts');
    } else {
      console.error('Failed to save default shortcuts');
    }
  } catch (error) {
    console.error('Failed to save default shortcuts:', error);
  }
}, []);

  
useEffect(() => {
  const loadShortcuts = async () => {
    try {
      console.log('Loading keyboard shortcuts...');
      const savedShortcuts = await window.electronAPI.keyboardShortcuts.get();
      console.log('Loaded shortcuts:', savedShortcuts);
      
      if (savedShortcuts && savedShortcuts.length > 0) {
        setShortcuts(savedShortcuts);
        console.log(`Set ${savedShortcuts.length} shortcuts in component state`);
      } else {
        // Create default shortcuts if none exist
        console.log('No shortcuts found, creating defaults');
        await createDefaultShortcuts();
      }
    } catch (error) {
      console.error('Failed to load keyboard shortcuts:', error);
      // Only create defaults as fallback
      await createDefaultShortcuts();
    }
  };
  
  loadShortcuts();
}, [createDefaultShortcuts]);


  // Update shortcut preview
  const updateShortcutPreview = useCallback(() => {
    let preview = '';
    
    if (primaryModifier) {
      preview = primaryModifier;
    }
    
    if (secondaryModifier && secondaryModifier !== 'none') {
      if (preview) preview += ' + ';
      preview += secondaryModifier;
    }
    
    if (mainKey) {
      if (preview) preview += ' + ';
      preview += mainKey;
      
      // Enable save button if we have a complete shortcut
      setError(null);
    } else {
      setError('Please select a key');
    }
    
    setShortcutPreview(preview || 'Select keys');
    
    // Validate shortcut if complete
    if (primaryModifier && mainKey) {
      // Create keys array for validation
      const keysArray = [
        primaryModifier,
        ...(secondaryModifier !== 'none' ? [secondaryModifier] : []),
        mainKey
      ];
      
      validateShortcut(keysArray);
    }
  }, [primaryModifier, secondaryModifier, mainKey]);

  // Check if a shortcut key combination is valid
  const validateShortcut = (keys: string[]) => {
    // Check if shortcut is reserved
    if (isReservedShortcut(keys)) {
      setError('This shortcut is reserved for system use and cannot be overridden.');
      return false;
    }

    // Check if shortcut already exists (excluding the current one being edited)
    const duplicate = shortcuts.find(s => 
      (!currentShortcut || s.id !== currentShortcut.id) && 
      s.keys.length === keys.length && 
      s.keys.every((key, index) => key === keys[index])
    );
    
    if (duplicate) {
      setError(`This shortcut is already used for "${duplicate.name}"`);
      return false;
    }
    
    return true;
  };

  // Check if a shortcut is reserved
  const isReservedShortcut = (keys: string[]) => {
    return RESERVED_SHORTCUTS.some(reserved => 
      reserved.length === keys.length && 
      reserved.every((key, index) => key === keys[index])
    );
  };

  // Reset the edit form
  const resetForm = () => {
    setNewActionId('');
    setPrimaryModifier('Ctrl');
    setSecondaryModifier('none');
    setMainKey('');
    setError(null);
    setShortcutPreview('Select keys');
    setCurrentShortcut(null);
  };

  // Open edit dialog
  const openEditDialog = (shortcut: Shortcut) => {
    resetForm();
    setCurrentShortcut(shortcut);
    
    // Set form values from current shortcut
    const [primary, secondary, key] = parseShortcutKeys(shortcut.keys);
    setPrimaryModifier(primary || 'Ctrl');
    setSecondaryModifier(secondary || 'none');
    setMainKey(key || '');
    
    // Find the action ID
    const actionItem = AVAILABLE_ACTIONS.find(a => a.id === shortcut.action);
    if (actionItem) {
      setNewActionId(actionItem.id);
    }
    
    setShowEditDialog(true);
    
    // Update preview (needs a small delay to ensure state is updated)
    setTimeout(updateShortcutPreview, 0);
  };

  // Parse shortcut keys into primary modifier, secondary modifier, and main key
  const parseShortcutKeys = (keys: string[]): [string, string, string] => {
    if (keys.length === 0) return ['Ctrl', 'none', ''];
    if (keys.length === 2) return [keys[0], 'none', keys[1]];
    if (keys.length === 3) return [keys[0], keys[1], keys[2]];
    return [keys[0] || 'Ctrl', 'none', keys[keys.length - 1] || ''];
  };

const handleEditShortcut = async () => {
  if (!currentShortcut) {
    console.error("No shortcut selected for editing");
    return;
  }
  
  if (!mainKey) {
    setError('Please select a key');
    return;
  }

  const keys = [
    primaryModifier,
    ...(secondaryModifier !== 'none' ? [secondaryModifier] : []),
    mainKey
  ];
  
  if (!validateShortcut(keys)) {
    return;
  }

  console.log(`Updating shortcut "${currentShortcut.name}" to [${keys.join('+')}]`);

  const updatedShortcuts = shortcuts.map(shortcut => 
    shortcut.id === currentShortcut.id 
      ? { ...shortcut, keys: keys } 
      : shortcut
  );
  
  // Update local state first
  setShortcuts(updatedShortcuts);
  
  try {
    console.log('Saving updated shortcuts...');
    const saved = await window.electronAPI.keyboardShortcuts.save(updatedShortcuts);
    
    if (saved) {
      console.log(`Successfully updated shortcut "${currentShortcut.name}"`);
      // Close dialog on success
      resetForm();
      setShowEditDialog(false);
    } else {
      console.error('Failed to save shortcuts - server returned false');
      setError('Failed to save shortcut changes. Please try again.');
      // Revert local state
      setShortcuts(shortcuts);
    }
  } catch (error) {
    console.error('Failed to save shortcuts:', error);
    setError('Failed to save shortcut changes. Please try again.');
    // Revert local state
    setShortcuts(shortcuts);
  }
};

  // Handle deleting a shortcut
  const handleDelete = async (id: string) => {
    const updatedShortcuts = shortcuts.filter(shortcut => shortcut.id !== id);
    setShortcuts(updatedShortcuts);
    
    // Save to store
    try {
      await window.electronAPI.keyboardShortcuts.save(updatedShortcuts);
      
      // Notify the main process to re-register shortcuts
      window.dispatchEvent(new CustomEvent('shortcuts-updated'));
    } catch (error) {
      console.error('Failed to save shortcuts:', error);
    }
  };
  
  // Reset all shortcuts to defaults
  const resetAllShortcuts = async () => {
    if (confirm('Are you sure you want to reset all shortcuts to defaults? This will remove all your custom shortcuts.')) {
      createDefaultShortcuts();
    }
  };

  // ShortcutKey component for displaying individual keys
  const ShortcutKey = ({ children }: { children: React.ReactNode }) => (
    <span className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 text-foreground rounded-[5px] text-sm">
      {children}
    </span>
  );

  // Format keys for display
  const formatKeys = (keys: string[]) => {
    return keys.map((key, index) => (
      <ShortcutKey key={index}>{key}</ShortcutKey>
    ));
  };

  // Effect to update the shortcut preview when form values change
  useEffect(() => {
    updateShortcutPreview();
  }, [primaryModifier, secondaryModifier, mainKey, updateShortcutPreview]);

  // Register keyboard shortcut listeners for real-time testing
  useEffect(() => {
    // Event handler for keyboard shortcuts
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts while in input fields or dialogs
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          showEditDialog) {
        return;
      }

      // Convert the pressed key combination to our format
      const pressedKeys: string[] = [];
      if (event.ctrlKey || event.metaKey) pressedKeys.push('Ctrl');
      if (event.altKey) pressedKeys.push('Alt');
      if (event.shiftKey) pressedKeys.push('Shift');

      // Add the main key
      let mainKey = event.key.toUpperCase();
      if (mainKey === ' ') mainKey = 'Space';
      if (mainKey === 'ESCAPE') mainKey = 'Esc';
      if (mainKey === 'ARROWUP') mainKey = 'Up';
      if (mainKey === 'ARROWDOWN') mainKey = 'Down';
      if (mainKey === 'ARROWLEFT') mainKey = 'Left';
      if (mainKey === 'ARROWRIGHT') mainKey = 'Right';
      
      pressedKeys.push(mainKey);

      // Find matching shortcut
      const matchingShortcut = shortcuts.find(shortcut => 
        shortcut.keys.length === pressedKeys.length &&
        shortcut.keys.every(key => pressedKeys.includes(key))
      );

      if (matchingShortcut) {
        event.preventDefault();
        
        // Dispatch a global event with the action
        console.log(`Shortcut triggered: ${matchingShortcut.action}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, showEditDialog]);

  return (
    <div className="flex flex-col h-full bg-background p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Keyboard Shortcuts</h1>
          <p className="text-muted-foreground">Customize your keyboard shortcuts</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={resetAllShortcuts}
          >
            <ArrowClockwise className="mr-2 h-4 w-4" />
            Reset to Defaults
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Feature</TableHead>
              <TableHead className="w-[300px]">Shortcut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shortcuts.map((shortcut) => (
              <TableRow key={shortcut.id}>
                <TableCell className="font-medium">{shortcut.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {formatKeys(shortcut.keys)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(shortcut)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(shortcut.id)}
                      disabled={shortcut.isDefault}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {shortcuts.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                  No shortcuts configured.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Shortcut Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Shortcut for {currentShortcut?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Primary Modifier</Label>
              <Select value={primaryModifier} onValueChange={setPrimaryModifier}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select primary modifier" />
                </SelectTrigger>
                <SelectContent>
                  {MODIFIER_KEYS.map(key => (
                    <SelectItem key={key} value={key}>{key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Secondary Modifier</Label>
              <Select value={secondaryModifier} onValueChange={setSecondaryModifier}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Optional secondary modifier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {MODIFIER_KEYS
                    .filter(key => key !== primaryModifier)
                    .map(key => (
                      <SelectItem key={key} value={key}>{key}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Key</Label>
              <Select value={mainKey} onValueChange={setMainKey}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a key" />
                </SelectTrigger>
                <SelectContent>
                  {REGULAR_KEYS.map(key => (
                    <SelectItem key={key} value={key}>{key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Preview</Label>
              <div className="col-span-3 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-md font-mono text-center">
                {shortcutPreview}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditShortcut}
              disabled={!mainKey || !!error}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KeyboardShortcuts;