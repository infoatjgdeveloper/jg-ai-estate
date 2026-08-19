import * as React from "react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

function Tabs({
  className,
  defaultValue,
  value,
  onValueChange,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const activeValue = value !== undefined ? value : selectedValue;

  const handleValueChange = (newValue: string) => {
    if (value === undefined) {
      setSelectedValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
      <div
        data-slot="tabs"
        className={cn("flex flex-col gap-2", className)}
        {...props}
      />
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="tabs-list"
      // justify-start, not justify-center: when a TabsList's children are wider than the
      // list itself (e.g. 5 tabs in a horizontally-scrollable row on a narrower screen),
      // centering the overflowing flex content pushes the overflow out equally on BOTH
      // sides — but a scroll container can't scroll to a negative offset, so the left-side
      // overflow becomes permanently unreachable and gets clipped, while the right-side
      // overflow can still be scrolled into. That's what made the first tab look sliced off
      // on its left edge no matter what padding/breakpoint tweaks were applied around it —
      // the real bug was this container centering content it doesn't have room for.
      className={cn("inline-flex items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground", className)}
      {...props}
    />
  )
}

function TabsTrigger({ 
  className, 
  value, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const { value: activeValue, onValueChange } = React.useContext(TabsContext);
  const isActive = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      onClick={() => onValueChange?.(value)}
      className={cn(
        // ring-inset (not the default ring-offset approach) draws the focus ring INSIDE the
        // button's own box instead of as a box-shadow bleeding outward past its edges. Several
        // tab bars in this app sit inside a horizontally-scrollable container with only a
        // couple px of buffer (e.g. the Explore Properties tabs) — an outward-bleeding ring on
        // the first/last tab gets sliced by that container's overflow clipping, which looked
        // like a broken flat edge instead of a rounded pill. Inset can never be clipped that way.
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ 
  className, 
  value, 
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { value: activeValue } = React.useContext(TabsContext);
  if (activeValue !== value) return null;

  return (
    <div
      data-slot="tabs-content"
      className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
