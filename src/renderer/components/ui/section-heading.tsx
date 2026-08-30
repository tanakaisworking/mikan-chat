import { Flower2 } from "lucide-react"

import { cn } from "@/lib/utils"

export function SectionHeading({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("flex items-end gap-2", className)}>
      <h2 className="text-2xl font-semibold tracking-[0.02em]">{children}</h2>
      <span className="mb-1 h-px w-14 bg-primary-bright" aria-hidden="true" />
      <Flower2 className="mb-0.5 size-4 text-primary-bright/65" aria-hidden="true" />
    </div>
  )
}
