import type { RefObject } from "react"

import { ChatMessage, type ChatMessageData } from "@/components/chat/chat-message"
import { cn } from "@/lib/utils"

export function ChatTimeline({
  characterName,
  messages,
  isGenerating,
  error,
  playingMessageId,
  onToggleAudio,
  endRef,
  className,
}: {
  characterName: string
  messages: ChatMessageData[]
  isGenerating: boolean
  error?: string | null
  playingMessageId: string | null
  onToggleAudio: (messageId: string) => void
  endRef: RefObject<HTMLDivElement | null>
  className?: string
}) {
  return (
    <section
      className={cn(
        "min-h-0 overflow-y-auto px-[7%] py-6 max-md:bg-linear-to-b max-md:from-black/5 max-md:via-transparent max-md:to-black/45 max-md:px-3 max-md:py-4",
        className,
      )}
      aria-label={`${characterName}との会話`}
      aria-live="polite"
    >
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-5 max-md:justify-end max-md:gap-3">
        <div className="my-1 flex items-center justify-center gap-5 text-sm text-muted-foreground max-md:text-xs max-md:text-white/90 max-md:drop-shadow-md">
          <span className="h-px w-14 bg-border" aria-hidden="true" />
          今日 20:42
          <span className="h-px w-14 bg-border" aria-hidden="true" />
        </div>
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            isPlaying={playingMessageId === message.id}
            onToggleAudio={() => onToggleAudio(message.id)}
          />
        ))}
        {isGenerating ? (
          <p className="ml-2 text-base text-muted-foreground max-md:text-sm max-md:text-white max-md:drop-shadow-md">{characterName}が考えています…</p>
        ) : null}
        {error ? <p className="mx-auto rounded-md bg-danger/8 px-4 py-2 text-sm text-danger" role="alert">{error}</p> : null}
        <div ref={endRef} />
      </div>
    </section>
  )
}
