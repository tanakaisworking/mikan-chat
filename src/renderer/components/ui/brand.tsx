import { cn } from "@/lib/utils"
import brandMark from "@/assets/brand/optimized-output/images/mikan-chat-brand-mark-64w.webp"

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-3 text-primary-bright", className)}>
      <img src={brandMark} alt="" className="size-12 object-contain" aria-hidden="true" />
      {!compact ? <span className="text-2xl font-semibold tracking-[0.015em]">mikan chat</span> : null}
    </div>
  )
}
