import * as React from "react"
import { cn } from "@/lib/utils"

function Avatar({
  className,
  size = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <div
      data-slot="avatar"
      data-size={size}
      className={cn(
        "relative flex size-8 shrink-0 rounded-full overflow-hidden select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className
      )}
      referrerPolicy="no-referrer"
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-stone-100 text-sm text-stone-500 font-bold",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
}
