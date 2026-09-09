import { useEffect, useRef, useState } from "react"
import { Sparkles, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FormTextarea } from "@/components/ui/form-textarea"
import type { ConnectionSettings } from "@/components/settings/ai-connection-dialog"
import { isConnectionReady, streamInstructionReply } from "@/lib/ai-chat"
import { AI_DRAFT_SYSTEM_PROMPT } from "@/lib/pack-authoring/ai-draft"

export function AiDraftDialog({
  open,
  connection,
  onOpenChange,
  onApply,
}: {
  open: boolean
  connection: ConnectionSettings
  onOpenChange: (open: boolean) => void
  onApply: (markdown: string) => void
}) {
  const [prompt, setPrompt] = useState("")
  const [result, setResult] = useState("")
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) {
      setError("")
      return
    }
    controller.current?.abort()
    controller.current = null
    setGenerating(false)
  }, [open])

  useEffect(() => () => controller.current?.abort(), [])

  const generate = () => {
    if (!prompt.trim() || generating) return
    if (!isConnectionReady(connection)) {
      setError("先に会話に使うAIを設定してください。")
      return
    }
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setGenerating(true)
    setError("")
    setResult("")
    void streamInstructionReply({
      connection,
      systemPrompt: AI_DRAFT_SYSTEM_PROMPT,
      userPrompt: prompt.trim(),
      signal: current.signal,
      onText: (text) => {
        if (current.signal.aborted) return
        setResult(text)
      },
    }).then(() => {
      if (!current.signal.aborted) setGenerating(false)
    }).catch((cause: unknown) => {
      if (current.signal.aborted) return
      setGenerating(false)
      setError(cause instanceof Error ? cause.message : "AIから返答を受け取れませんでした。")
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="ai-draft-dialog">
        <DialogHeader>
          <DialogTitle>どんなシナリオを作りたいですか</DialogTitle>
          <DialogDescription>
            希望を書くとAIが構成案を作ります。取り込んだ後は下書きとして自由に直せます。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormTextarea
            label="作りたい物語"
            value={prompt}
            rows={3}
            maxLength={2000}
            placeholder="例：政略結婚した公爵と、嘘がつけない指輪の話。相手は誠実だけど不器用な男性で"
            onChange={(event) => setPrompt(event.target.value)}
          />
          {result ? (
            <div className="grid gap-2">
              <span className="text-sm font-medium text-foreground">構成案</span>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-surface p-4 text-sm leading-relaxed whitespace-pre-wrap" aria-live="polite">
                {result}
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
        </div>
        <DialogFooter>
          {generating ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                controller.current?.abort()
                setGenerating(false)
              }}
            >
              <Square className="size-4 fill-current" aria-hidden="true" />中止する
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled={!prompt.trim()} onClick={generate}>
              <Sparkles aria-hidden="true" />構成案を作る
            </Button>
          )}
          <Button type="button" disabled={!result.trim() || generating} onClick={() => onApply(result)}>
            この内容で作る
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
