"use client"
import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { X } from '@phosphor-icons/react' // Import the X icon from phosphor-icons
import { cn } from "../lib/utils"

const DropdownMenuAI = PopoverPrimitive.Root

const DropdownMenuTriggerAI = PopoverPrimitive.Trigger

const DropdownMenuAnchorAI = PopoverPrimitive.Anchor

const DropdownMenuContentAI = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, children, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-76 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin] relative",
        className
      )}
      {...props}
    >
      <div className="pr-6">
        {children}
      </div>
      <PopoverPrimitive.Close className="absolute top-2 right-2 rounded-full p-1">
        <X className="h-4 w-4" />
      </PopoverPrimitive.Close>
    </PopoverPrimitive.Content>
  </PopoverPrimitive.Portal>
))
DropdownMenuContentAI.displayName = PopoverPrimitive.Content.displayName

export { DropdownMenuAI, DropdownMenuTriggerAI, DropdownMenuContentAI, DropdownMenuAnchorAI }