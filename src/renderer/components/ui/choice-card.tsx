import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type ChoiceCardProps = {
  icon: ReactNode
  title: string
  description: string
  trailing?: ReactNode
  selected?: boolean
  expanded?: boolean
  controls?: string
  size?: "default" | "dialog" | "setup"
  onClick: () => void
}

export function ChoiceCard({
  icon,
  title,
  description,
  trailing,
  selected,
  expanded,
  controls,
  size = "default",
  onClick,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "group flex w-full items-center rounded-lg border bg-surface text-left shadow-soft transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary-bright/60 focus-visible:ring-2 focus-visible:ring-ring/25",
        selected ? "border-primary-bright" : "border-border",
        size === "setup" ? "min-h-40 gap-7 px-8 max-md:min-h-24 max-md:gap-4 max-md:px-4" : size === "dialog" ? "min-h-28 gap-5 px-6 max-md:min-h-24 max-md:gap-4 max-md:px-4" : "min-h-24 gap-4 px-5 max-md:px-4",
      )}
      aria-pressed={selected === undefined ? undefined : selected}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-surface-soft",
          selected ? "text-primary" : "text-muted-foreground",
          size === "setup" ? "size-[72px] [&_svg]:size-9 max-md:size-14 max-md:[&_svg]:size-7" : size === "dialog" ? "size-16 [&_svg]:size-8 max-md:size-14 max-md:[&_svg]:size-7" : "size-14 [&_svg]:size-7",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block", selected ? "font-bold text-primary" : "font-semibold", size === "setup" ? "text-2xl max-md:text-lg" : size === "dialog" ? "text-xl max-md:text-lg" : "text-lg")}>{title}</span>
        <span className={cn("mt-1.5 block text-muted-foreground", size === "default" ? "text-sm" : "text-base max-md:text-sm")}>
          {description}
        </span>
      </span>
      {trailing}
    </button>
  )
}
