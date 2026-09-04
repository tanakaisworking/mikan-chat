import { cn } from "@/lib/utils"
import brandMark from "@/assets/brand/optimized-output/images/mikan-chat-brand-mark-64w.webp"

export function Brand({ compact = false, tagline, className }: { compact?: boolean; tagline?: string; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-3 text-primary-bright", className)}>
      <img src={brandMark} alt="" className="size-12 object-contain" aria-hidden="true" />
      {!compact ? (
        <span className="flex min-w-0 flex-col">
          <span className="text-2xl font-semibold tracking-[0.015em]" data-brand-title>mikan chat</span>
          {tagline ? <span className="mt-0.5 text-xs font-medium tracking-wide text-muted-foreground">{tagline}</span> : null}
        </span>
      ) : null}
    </div>
  )
}
