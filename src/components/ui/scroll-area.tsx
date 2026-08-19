import * as React from "react"
import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="scroll-area"
      // min-h-0 is required whenever this sits as a flex item (e.g. `flex-1` inside a
      // `flex flex-col` dialog): without it, flex items default to min-height:auto and
      // grow to fit their content instead of respecting the parent's height, so
      // overflow-auto here never actually kicks in — the content just gets clipped by
      // whatever ancestor has overflow-hidden instead of scrolling internally.
      className={cn("relative overflow-auto min-h-0", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function ScrollBar() {
  return null;
}

export { ScrollArea, ScrollBar }
