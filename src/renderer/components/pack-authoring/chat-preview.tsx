import { useState } from "react"
import { ImagePlus } from "lucide-react"

import { CharacterStage } from "@/components/chat/character-stage"
import { ChatMessage, type ChatMessageData } from "@/components/chat/chat-message"
import { fileToDraftAsset } from "@/lib/pack-authoring/build"
import type { PackDraft } from "@/lib/pack-authoring/types"

export function ChatPreview({
  draft,
  onChange,
}: {
  draft: PackDraft
  onChange: (patch: Partial<PackDraft>) => void
}) {
  const [error, setError] = useState("")
  const primary = draft.characters[0]
  const stageImage = primary?.image?.dataUrl ?? draft.cover?.dataUrl ?? null
  const messages: ChatMessageData[] = draft.opening.map((event, index) => event.type === "narration"
    ? { id: event.key, role: "narration", text: event.text.trim() || "（情景描写）", time: "" }
    : event.speaker === "user"
      ? { id: event.key, role: "user", text: event.text.trim() || "（セリフ）", time: "" }
      : {
          id: event.key,
          role: "character",
          text: event.text.trim() || "（セリフ）",
          speakerName: draft.characters.find((character) => character.id.trim() === event.speaker)?.name.trim() || event.speaker || `登場人物${index + 1}`,
          time: "",
        })

  return (
    <div className="grid min-h-0 grid-cols-[clamp(280px,32vw,420px)_minmax(0,1fr)] overflow-hidden rounded-xl border border-border/70 bg-background max-lg:grid-cols-1" aria-label="仕上がりプレビュー">
      <div className="relative min-h-64">
        {stageImage ? (
          <CharacterStage image={stageImage} name={primary?.name.trim() || "キャラクター"} className="absolute inset-0" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-surface-soft/60 p-6 text-center">
            <p className="text-sm text-muted-foreground">ここに立ち絵が入ります</p>
          </div>
        )}
        <label className="absolute bottom-3 left-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2 text-sm font-medium shadow-soft backdrop-blur transition-colors hover:border-primary-bright/60">
          <ImagePlus className="size-4" aria-hidden="true" />
          {stageImage ? "画像を変更" : "画像を設定"}
          <input
            type="file"
            accept=".webp,.png,.jpg,.jpeg,image/*"
            className="sr-only"
            aria-label="立ち絵の画像を設定"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (!file || !primary) return
              void fileToDraftAsset(file, "image").then((image) => {
                setError("")
                onChange({ characters: draft.characters.map((character) => character.key === primary.key ? { ...character, image } : character) })
              }).catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : "ファイルを読み込めませんでした。")
              })
            }}
          />
        </label>
        {error ? <p className="absolute bottom-3 right-3 max-w-48 text-xs text-danger" role="alert">{error}</p> : null}
      </div>
      <div className="grid min-h-0 content-start gap-4 overflow-y-auto p-5 max-md:p-4">
        <label className="grid gap-1">
          <span className="sr-only">主人公の名前</span>
          <input
            value={primary?.name ?? ""}
            onChange={(event) => {
              if (!primary) return
              const name = event.target.value
              onChange({ characters: draft.characters.map((character) => character.key === primary.key ? { ...character, name } : character) })
            }}
            placeholder="キャラクター名"
            aria-label="主人公の名前"
            className="w-full bg-transparent text-center text-2xl font-semibold outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring/30 max-md:text-lg"
          />
        </label>
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">導入を書くと、ここに会話の出だしが並びます</p>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isPlaying={false}
              isLoading={false}
              canPlayAudio={() => false}
              onToggleAudio={() => undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}
