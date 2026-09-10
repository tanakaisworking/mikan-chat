import { useEffect, useRef, useState, type RefObject } from "react"
import { ChevronDown, Send, Sparkles, Square, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"
import type { ConnectionSettings } from "@/components/settings/ai-connection-dialog"
import { AIConnectionDialog } from "@/components/settings/ai-connection-dialog"
import { isConnectionReady, streamInstructionReply } from "@/lib/ai-chat"
import { isDesktopApp } from "@/lib/platform"
import { AI_EDIT_SYSTEM_PROMPT, applyAiDraftToDraft, parseAiScenario } from "@/lib/pack-authoring/ai-draft"
import type { PackDraft } from "@/lib/pack-authoring/types"

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
  applied?: boolean
}

function draftDigest(draft: PackDraft) {
  const characters = draft.characters
    .map((character) => `${character.name.trim() || "(無名)"}：${character.profile.trim().slice(0, 60)}`)
    .join("\n")
  return [
    `題名: ${draft.title.trim() || "(無題)"}`,
    `前提: ${draft.premise.trim().slice(0, 200)}`,
    `登場人物:\n${characters || "(なし)"}`,
    `導入: ${draft.opening.length}件`,
  ].join("\n")
}

export function AiEditPanel({
  draft,
  connection,
  triggerRef,
  onConnectionConfirm,
  onApplyPatch,
  onClose,
}: {
  draft: PackDraft
  connection: ConnectionSettings
  triggerRef: RefObject<HTMLElement | null>
  onConnectionConfirm: (settings: ConnectionSettings) => void
  onApplyPatch: (draft: PackDraft) => void
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")
  const controller = useRef<AbortController | null>(null)
  const idCounter = useRef(0)
  const endRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)

  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      // 開閉ボタン自体の押下はトグルに任せる。
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [onClose, triggerRef])
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages])

  const send = () => {
    const text = input.trim()
    if (!text || generating) return
    if (!isConnectionReady(connection)) {
      setError("先に会話に使うAIを設定してください。")
      return
    }
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setError("")
    setInput("")
    idCounter.current += 1
    const userId = idCounter.current
    idCounter.current += 1
    const replyId = idCounter.current
    setMessages((currentMessages) => [...currentMessages, { id: userId, role: "user", text }, { id: replyId, role: "assistant", text: "" }])
    setGenerating(true)
    const context = `開いているシナリオ:\n${draftDigest(draft)}\n\n指示:\n${text}`
    void streamInstructionReply({
      connection,
      systemPrompt: AI_EDIT_SYSTEM_PROMPT,
      userPrompt: context,
      signal: current.signal,
      onText: (next) => {
        if (current.signal.aborted) return
        setMessages((currentMessages) => currentMessages.map((message) => message.id === replyId ? { ...message, text: next } : message))
      },
    }).then(() => {
      if (!current.signal.aborted) setGenerating(false)
    }).catch((cause: unknown) => {
      if (current.signal.aborted) return
      setGenerating(false)
      setError(cause instanceof Error ? cause.message : "AIから返答を受け取れませんでした。")
    })
  }

  const applyMessage = (id: number) => {
    const message = messages.find((item) => item.id === id)
    if (!message || message.applied) return
    onApplyPatch(applyAiDraftToDraft(parseAiScenario(message.text), draft))
    setMessages((currentMessages) => currentMessages.map((item) => item.id === id ? { ...item, applied: true } : item))
  }

  return (
    <div ref={panelRef} className="fixed top-1/2 right-4 z-40 grid h-[70vh] w-[min(28rem,calc(100vw-2rem))] -translate-y-1/2 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-border bg-popover text-foreground shadow-xl" role="dialog" aria-label="AI相談">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <p className="flex-1 text-sm font-semibold">AIに相談</p>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="AI相談を閉じる" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="min-h-0 overflow-y-auto">
        <div className="border-b border-border/70 px-4 py-2">
          <button
            type="button"
            aria-expanded={aiSettingsOpen}
            onClick={() => setAiSettingsOpen((open) => !open)}
            className="flex w-full items-center gap-2 py-1 text-left text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <span className="min-w-0 flex-1 truncate">
              利用するAI：{connection.type === "builtin" ? "内蔵" : connection.type === "local" ? "ローカル" : "オンライン"}
              {connection.model ? `・${connection.model}` : ""}
            </span>
            <ChevronDown className={`size-4 shrink-0 transition-transform ${aiSettingsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {aiSettingsOpen ? (
            <AIConnectionDialog
              embedded
              open
              initialConnection={connection.type}
              initialApiKey={connection.apiKey}
              initialEndpoint={connection.endpoint}
              initialModel={connection.model}
              isDesktop={isDesktopApp()}
              onOpenChange={(open) => {
                if (!open) setAiSettingsOpen(false)
              }}
              onConfirm={(settings) => {
                onConnectionConfirm(settings)
                setAiSettingsOpen(false)
              }}
            />
          ) : null}
        </div>
        <div className="p-4">
        {messages.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            開いているシナリオへの直しを文章で頼めます。「導入をもっと短く」「もう1人明るい人物を追加」など。
          </p>
        ) : (
          <div className="grid gap-3">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "grid gap-2"}>
                {message.role === "user" ? (
                  <p className="max-w-[85%] rounded-lg rounded-br-sm bg-surface-accent/60 px-3 py-2 text-sm leading-7">{message.text}</p>
                ) : (
                  <>
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-7 whitespace-pre-wrap" aria-live="polite">
                      {message.text || "考えています…"}
                    </div>
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!message.text.trim() || generating || message.applied}
                        onClick={() => applyMessage(message.id)}
                      >
                        {message.applied ? "反映済み" : "下書きに反映"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
        {error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}
        </div>
      </div>
      <div className="flex items-end gap-2 border-t border-border/70 p-3">
        <div className="min-w-0 flex-1">
          <TextField
            label="AIへの指示"
            value={input}
            placeholder="どう直したいですか"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
          />
        </div>
        {generating ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="生成を中止"
            onClick={() => {
              controller.current?.abort()
              setGenerating(false)
            }}
          >
            <Square className="size-4 fill-current" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="button" size="icon" aria-label="送信" disabled={!input.trim()} onClick={send}>
            <Send aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}
