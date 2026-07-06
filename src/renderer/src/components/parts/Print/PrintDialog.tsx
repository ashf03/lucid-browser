import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Button } from '../../../ui/button';
import { Printer, X } from 'lucide-react';

interface PrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl: string;
  onPrint: () => void;
  title: string;
}

const PrintDialog: React.FC<PrintDialogProps> = ({ 
  isOpen, 
  onClose, 
  previewUrl, 
  onPrint,
  title 
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-lg">Print {title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col space-y-4">
          <div className="w-full h-[70vh] overflow-auto border border-gray-200 dark:border-gray-700 rounded-md flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
            {previewUrl && (
              <iframe
                src={previewUrl}
                title="Print Preview"
                className="w-full h-full"
              />
            )}
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between">
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X size={16} />
            Cancel
          </Button>
          <Button onClick={onPrint} className="gap-2">
            <Printer size={16} />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintDialog;