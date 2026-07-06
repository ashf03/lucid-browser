"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "../lib/utils"
import { Cross2Icon } from "@radix-ui/react-icons"
import { GripVertical } from "lucide-react" 
import { DotsSixVertical } from "@phosphor-icons/react"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & { fullscreen?: boolean }
>(({ className, fullscreen, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      fullscreen && "backdrop-blur-md bg-background/40 transition-all duration-300",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { 
    showDragHandle?: boolean,
    fullscreen?: boolean 
  }
>(({ className, children, showDragHandle = true, fullscreen = false, ...props }, ref) => {
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });
  const contentRef = React.useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    // Skip drag if in fullscreen mode
    if (fullscreen) return;
    
    // Only start dragging from the drag handle
    if (!(e.target as HTMLElement).closest('.drag-handle')) return;
    
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleDrag = React.useCallback((e: MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      
      // Use requestAnimationFrame for smoother updates
      requestAnimationFrame(() => {
        setPosition({ x: newX, y: newY });
      });
    }
  }, [isDragging]);

  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag, { passive: false });
      window.addEventListener('mouseup', handleDragEnd);
      
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleDrag, handleDragEnd]);

  // Reset position when toggling fullscreen mode
  React.useEffect(() => {
    if (fullscreen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [fullscreen]);

  return (
    <DialogPortal>
      <DialogOverlay fullscreen={fullscreen} />
      <DialogPrimitive.Content
        ref={ref}
        style={{
          transform: fullscreen 
            ? 'translate(-50%, -50%)' // Fixed center position in fullscreen
            : `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`
        }}
        className={cn(
          "fixed left-[50%] top-[50%] border-black/15 dark:border-white/5 z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] border-2 rounded-3xl",
          fullscreen && "max-w-4xl h-auto bg-background/95 backdrop-blur-sm",
          className
        )}
        onMouseEnter={() => !fullscreen && setIsHovering(true)}
        onMouseLeave={() => !fullscreen && setIsHovering(false)}
        {...props}
      >
        {/* Show drag handle only if not in fullscreen mode */}
        {showDragHandle && !fullscreen && (
          <div 
            className={cn(
              "drag-handle absolute -top-1 left-1/2 transform -translate-y-1/2 w-full h-10 flex items-center justify-center rounded-l-lg transition-all duration-200 cursor-grab",
              isHovering || isDragging ? "opacity-100" : "opacity-0",
              isDragging ? "cursor-grabbing" : "",
              "hover:bg-accent/50",
            )}
            onMouseDown={handleDragStart}
          >
            <DotsSixVertical className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-xl opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <Cross2Icon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left pt-2", // Added padding-top to make space for drag handle
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}