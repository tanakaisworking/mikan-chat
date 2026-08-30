import { useRef, useState } from "react"
import { Mic, Send, Square } from "lucide-react"

import { IconButton } from "@/components/ui/icon-button"

type ChatComposerProps = {
  onSend: (message: string) => void
  isGenerating: boolean
  onStop: () => void
  onOpenVoice: () => void
}

export function ChatComposer({ onSend, isGenerating, onStop, onOpenVoice }: ChatComposerProps) {
  const [value, setValue] = useState("")
  const isComposing = useRef(false)

  const submit = () => {
    const message = value.trim()
    if (!message || isGenerating) return
    onSend(message)
    setValue("")
  }

  return (
    <div className="flex h-full items-center border-t border-border/75 bg-background px-9 max-[1100px]:px-6 max-md:px-2 max-md:pb-[env(safe-area-inset-bottom)]" data-testid="chat-composer">
      <div className="flex h-[92px] min-w-0 flex-1 items-center gap-3 rounded-full border border-primary-bright/70 bg-surface px-6 shadow-soft focus-within:ring-2 focus-within:ring-primary/15 max-[1100px]:h-[72px] max-[1100px]:px-5 max-md:h-14 max-md:gap-1 max-md:px-3">
        <textarea
          value={value}
          rows={1}
          placeholder="メッセージを入力"
          aria-label="メッセージ"
          className="max-h-20 min-h-8 flex-1 resize-none bg-transparent text-lg leading-8 outline-none placeholder:text-muted-foreground/70 max-[1100px]:text-base max-md:min-w-0 max-md:text-base"
          onChange={(event) => setValue(event.target.value)}
          onCompositionStart={() => {
            isComposing.current = true
          }}
          onCompositionEnd={() => {
            isComposing.current = false
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !isComposing.current) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <IconButton label="音声で入力" className="size-14 bg-primary-bright text-white hover:bg-primary max-[1100px]:size-12 max-md:size-11" onClick={onOpenVoice}>
          <Mic />
        </IconButton>
        {isGenerating ? (
          <IconButton label="生成を停止" className="size-14 bg-primary text-white hover:bg-primary/90 max-[1100px]:size-12 max-md:size-11" onClick={onStop}>
            <Square className="size-5 fill-current" />
          </IconButton>
        ) : (
          <IconButton label="送信" className="size-14 bg-primary text-white hover:bg-primary/90 disabled:opacity-45 max-[1100px]:size-12 max-md:size-11" disabled={!value.trim()} onClick={submit}>
            <Send className="translate-x-[-1px]" />
          </IconButton>
        )}
      </div>
    </div>
  )
}
