import * as React from "react"
import { createContext, useContext, useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}
const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null)

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click and on Escape — this is the behavior that was missing entirely
  // before, which is why every dropdown used to render permanently open.
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

function DropdownMenuTrigger({
  children,
  className,
  asChild,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const ctx = useContext(DropdownMenuContext)
  return (
    <div
      data-slot="dropdown-menu-trigger"
      role="button"
      tabIndex={0}
      aria-expanded={ctx?.open}
      onClick={(e) => {
        ctx?.setOpen(!ctx.open)
        onClick?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          ctx?.setOpen(!ctx?.open)
        }
      }}
      className={cn("cursor-pointer select-none", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function DropdownMenuContent({
  className,
  children,
  align = "end",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" | "end" }) {
  const ctx = useContext(DropdownMenuContext)
  if (!ctx?.open) return null

  const alignClass =
    align === "start" ? "left-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "right-0"

  return (
    <div
      data-slot="dropdown-menu-content"
      className={cn(
        `absolute ${alignClass} top-full z-50 mt-2 w-56 origin-top rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-black/5 focus:outline-none animate-in fade-in zoom-in-95 duration-150`,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DropdownMenuLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-4 py-2 text-xs font-bold text-stone-400 uppercase tracking-wider", className)}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = useContext(DropdownMenuContext)
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e)
        ctx?.setOpen(false)
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 hover:text-brand-600 transition-colors",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-mx-1 my-1 h-px bg-stone-100", className)} {...props} />
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
}
