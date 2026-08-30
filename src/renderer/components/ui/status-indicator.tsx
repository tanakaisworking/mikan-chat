import { cn } from "@/lib/utils"

type StatusIndicatorProps = {
  label: string
  tone?: "success" | "muted" | "danger"
  className?: string
}

const toneClass = {
  success: "bg-success",
  muted: "bg-muted-foreground",
  danger: "bg-danger",
}

export function StatusIndicator({
  label,
  tone = "success",
  className,
}: StatusIndicatorProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-medium text-foreground", className)}>
      <span className={cn("size-2.5 rounded-full", toneClass[tone])} aria-hidden="true" />
      {label}
    </span>
  )
}
