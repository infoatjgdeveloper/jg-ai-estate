import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ open, onOpenChange, children, ...props }: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  // ESC-to-close: this is a bespoke overlay (not Radix), so nothing handled this before —
  // every dialog in the app was only closable via its own X button.
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange?.(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange?.(false)}
      />
      {/* This wrapper is `w-full` so the dialog content can center itself, but that also
          makes it a full-width box sitting on top of the backdrop above — clicking in the
          "empty" margin beside a narrower dialog was hitting this div instead of the
          backdrop, so outside-click silently did nothing. Checking target === currentTarget
          means it only closes when the click lands on this wrapper itself, not on the
          dialog content nested inside it. */}
      <div
        className="relative z-50 w-full flex items-center justify-center animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => { if (e.target === e.currentTarget) onOpenChange?.(false); }}
      >
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
        // A plain ghost button with no background of its own (the old style) is nearly
        // invisible on dialogs like the property detail modal, which opens straight into a
        // photo — a pale gray "X" over a busy image is very easy to miss entirely. Giving it
        // a permanent white circle + shadow makes it equally easy to spot whether it's sitting
        // on a photo or on a plain white dialog body.
        <Button
          variant="ghost"
          className="absolute top-4 right-4 sm:top-6 sm:right-6 rounded-full w-10 h-10 sm:w-12 sm:h-12 p-0 bg-white/95 shadow-lg border border-stone-200 hover:bg-white z-10"
          onClick={onClose}
        >
          <XIcon className="w-5 h-5 sm:w-6 sm:h-6 text-stone-600" />
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
