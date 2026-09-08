import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

import { IconButton } from "@/components/ui/icon-button"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { cn } from "@/lib/utils"

type AppHeaderProps = {
  title: string
  onBack?: () => void
  status?: string
  actions?: ReactNode
  className?: string
}

export function AppHeader({ title, onBack, status, actions, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "relative flex h-full flex-col bg-background/96",
        className,
      )}
    >
      <div className="relative flex min-h-0 flex-1 items-center border-b border-border/70 px-6 max-md:px-3">
      <div className="w-32 max-md:w-auto">
        {onBack ? (
          <IconButton label="戻る" onClick={onBack}>
            <ArrowLeft />
          </IconButton>
        ) : null}
      </div>
      <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5 max-[350px]:left-[72px] max-[350px]:translate-x-0">
        <h1 className="text-2xl font-semibold leading-tight max-[1100px]:text-xl max-md:text-lg">{title}</h1>
        {status ? <StatusIndicator label={status} className="text-sm max-[1100px]:text-xs max-md:text-[10px] max-[350px]:hidden" /> : null}
      </div>
      <div className="ml-auto flex w-32 items-center justify-end gap-1 max-md:w-auto max-md:[&_button]:size-11">{actions}</div>
      </div>
    </header>
  )
}
