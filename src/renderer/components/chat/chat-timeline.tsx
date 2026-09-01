import type { RefObject } from "react"

import { ChatMessage, type ChatMessageData } from "@/components/chat/chat-message"
import { SceneIntroCard } from "@/components/chat/scene-intro-card"
import type { ScenarioContext } from "@/lib/scenario-context"
import { cn } from "@/lib/utils"

export function ChatTimeline({
  characterName,
  intro,
  messages,
  isGenerating,
  error,
  canPlayAudio,
  playingMessageId,
  onToggleAudio,
  endRef,
  className,
}: {
  characterName: string
  intro?: ScenarioContext | null
  messages: ChatMessageData[]
  isGenerating: boolean
  error?: string | null
  canPlayAudio: boolean
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
      <div className={cn("mx-auto flex min-h-full max-w-3xl flex-col gap-5 max-md:gap-3", intro ? "justify-start" : "justify-center max-md:justify-end")}>
        {intro ? <SceneIntroCard context={intro} /> : null}
        <div className="my-1 flex items-center justify-center gap-5 text-sm text-muted-foreground max-md:text-xs max-md:text-white/90 max-md:drop-shadow-md">
          <span className="h-px w-14 bg-border" aria-hidden="true" />
          {intro ? "ここから、物語がはじまる" : "今日 20:42"}
          <span className="h-px w-14 bg-border" aria-hidden="true" />
        </div>
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            isPlaying={playingMessageId === message.id}
            canPlayAudio={canPlayAudio}
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
