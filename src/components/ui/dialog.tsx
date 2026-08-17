import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ open, onOpenChange, children, ...props }: { 
  open?: boolean; 
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={() => onOpenChange?.(false)}
      />
      <div className="relative z-50 w-full flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onClose,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  showCloseButton?: boolean;
  onClose?: () => void;
}) {
  return (
    <div
      data-slot="dialog-content"
      className={cn(
        "relative flex flex-col max-h-[90vh] bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden w-full",
        !className?.includes("max-w-") && "max-w-lg",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <Button
          variant="ghost"
          className="absolute top-6 right-6 rounded-full w-12 h-12 p-0 hover:bg-stone-100"
          onClick={onClose}
        >
          <XIcon className="w-6 h-6 text-stone-400" />
          <span className="sr-only">Close</span>
        </Button>
      )}
    </div>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 p-8 pb-0", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-3 p-8 pt-0 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn(
        "text-3xl font-bold text-stone-900 tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="dialog-description"
      className={cn(
        "text-stone-500 font-medium",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
}
