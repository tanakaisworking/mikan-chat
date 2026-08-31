import { Pause, Play } from "lucide-react"

import { IconButton } from "@/components/ui/icon-button"
import { cn } from "@/lib/utils"

export type ChatMessageData = {
  id: string
  role: "narration" | "character" | "user"
  text: string
  time: string
  audio?: boolean
  speakerName?: string
  image?: string
}

export function ChatMessage({
  message,
  isPlaying,
  onToggleAudio,
}: {
  message: ChatMessageData
  isPlaying: boolean
  onToggleAudio: () => void
}) {
  if (message.role === "narration") {
    return (
      <article className="mx-auto max-w-2xl px-8 py-2 text-center max-md:px-4">
        <p className="text-[15px] leading-8 text-muted-foreground italic max-md:rounded-2xl max-md:bg-black/42 max-md:px-4 max-md:py-3 max-md:text-sm max-md:leading-7 max-md:text-white max-md:not-italic max-md:shadow-overlay max-md:backdrop-blur-md">
          {message.text}
        </p>
      </article>
    )
  }

  const isUser = message.role === "user"

  return (
    <article className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[78%] max-md:max-w-[86%]", isUser ? "items-end" : "items-start")}>
        {!isUser && message.speakerName ? (
          <p className="mb-1 px-2 text-xs font-semibold text-muted-foreground max-md:text-white max-md:drop-shadow-md">
            {message.speakerName}
          </p>
        ) : null}
        <div
          className={cn(
            "flex min-h-[90px] items-center gap-3 rounded-lg border px-8 py-5 text-[19px] leading-[1.75] shadow-soft max-[1100px]:min-h-20 max-[1100px]:px-6 max-[1100px]:text-[17px] max-md:min-h-0 max-md:rounded-2xl max-md:px-4 max-md:py-3 max-md:text-[15px] max-md:leading-relaxed max-md:shadow-overlay max-md:backdrop-blur-md",
            isUser
              ? "rounded-br-sm border-primary-bright/55 bg-surface-accent/45 text-primary max-md:rounded-br-sm max-md:border-white/60 max-md:bg-[#d9fdd3]/92 max-md:text-[#18361f]"
              : "rounded-bl-sm border-border/70 bg-surface text-foreground max-md:rounded-bl-sm max-md:border-white/75 max-md:bg-white/90",
          )}
        >
          <p>{message.text}</p>
          {message.audio ? (
            <IconButton
              label={isPlaying ? "音声を停止" : "音声を再生"}
              className="-mr-2 bg-surface-soft text-primary-bright hover:bg-surface-accent max-md:size-11"
              onClick={onToggleAudio}
            >
              {isPlaying ? <Pause /> : <Play className="translate-x-px" />}
            </IconButton>
          ) : null}
        </div>
        <time className={cn("mt-1.5 block px-2 text-xs text-muted-foreground max-md:mt-1 max-md:text-[11px] max-md:text-white/90 max-md:drop-shadow-md", isUser && "text-right")}>
          {message.time}
        </time>
      </div>
    </article>
  )
}
