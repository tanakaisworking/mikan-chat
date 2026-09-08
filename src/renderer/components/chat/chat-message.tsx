import { Pause, Play } from "lucide-react"

import { IconButton } from "@/components/ui/icon-button"

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
  canPlayAudio,
  onToggleAudio,
}: {
  message: ChatMessageData
  isPlaying: boolean
  canPlayAudio: (message: ChatMessageData) => boolean
  onToggleAudio: () => void
}) {
  if (message.role === "narration") {
    return (
      <article aria-label="情景描写" className="mx-auto max-w-2xl px-8 py-1 text-center max-md:px-5">
        <p className="text-sm leading-7 text-muted-foreground italic max-md:text-[13px] max-md:leading-6 max-md:text-white max-md:drop-shadow-md">
          {message.text}
        </p>
      </article>
    )
  }

  const isUser = message.role === "user"

  if (isUser) {
    return (
      <article aria-label="あなたの発言" className="flex justify-end">
        <div className="max-w-[64%] max-md:max-w-[78%]">
          <div className="rounded-lg rounded-br-sm border border-primary-bright/45 bg-surface-accent/45 px-4 py-2.5 text-[15px] leading-7 text-primary max-md:border-white/60 max-md:bg-[#d9fdd3]/92 max-md:text-[14px] max-md:leading-6 max-md:text-[#18361f]">
            <p>{message.text}</p>
          </div>
          <time className="mt-1 block px-1 text-right text-[11px] text-muted-foreground max-md:text-white max-md:drop-shadow-md">
            {message.time}
          </time>
        </div>
      </article>
    )
  }

  return (
    <article aria-label={`${message.speakerName ?? "キャラクター"}の発言`} className="flex justify-start py-1">
      <div className="w-full max-w-[88%] border-l-2 border-primary/25 pl-5 max-md:max-w-[92%] max-md:border-white/40 max-md:pl-4">
        <div className="mb-1.5 flex items-center gap-2">
          <p className="text-sm font-semibold text-primary max-md:text-white max-md:drop-shadow-md">
            {message.speakerName ?? "キャラクター"}
          </p>
          <time className="text-[11px] text-muted-foreground max-md:text-white max-md:drop-shadow-md">{message.time}</time>
        </div>
        <div className="flex items-start gap-3 text-[18px] leading-8 text-foreground max-[1100px]:text-[17px] max-md:text-[15px] max-md:leading-7 max-md:text-white max-md:drop-shadow-md">
          <p className="min-w-0 flex-1">{message.text}</p>
          {message.audio || canPlayAudio(message) ? (
            <IconButton
              label={isPlaying ? "音声を停止" : "音声を再生"}
              className="mt-0.5 shrink-0 bg-surface text-primary hover:bg-surface-accent max-md:size-11 max-md:drop-shadow-md"
              onClick={onToggleAudio}
            >
              {isPlaying ? <Pause /> : <Play className="translate-x-px" />}
            </IconButton>
          ) : null}
        </div>
      </div>
    </article>
  )
}
