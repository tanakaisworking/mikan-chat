import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Lightbulb, Mic, Square, Volume2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"

export function VoiceSettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [readAloud, setReadAloud] = useState(true)
  const [testingMic, setTestingMic] = useState(false)
  const [testingVoice, setTestingVoice] = useState(false)
  const voiceTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!open) {
      setTestingMic(false)
      setTestingVoice(false)
      if (voiceTimer.current) window.clearTimeout(voiceTimer.current)
      voiceTimer.current = null
    }
  }, [open])

  useEffect(() => () => {
    if (voiceTimer.current) window.clearTimeout(voiceTimer.current)
  }, [])

  const testVoice = () => {
    if (testingVoice) {
      if (voiceTimer.current) window.clearTimeout(voiceTimer.current)
      voiceTimer.current = null
      setTestingVoice(false)
      return
    }
    setTestingVoice(true)
    voiceTimer.current = window.setTimeout(() => {
      setTestingVoice(false)
      voiceTimer.current = null
    }, 1500)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0" data-testid="voice-settings-sheet">
        <SheetHeader>
          <SheetTitle className="text-3xl max-md:text-2xl">音声設定</SheetTitle>
          <SheetDescription className="sr-only">マイクと読み上げ音声を設定します</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-md:px-4 max-md:py-4">
          <section className="grid gap-7 rounded-lg border border-border/65 bg-surface p-8 shadow-soft max-md:gap-5 max-md:p-5">
            <h3 className="text-xl font-semibold text-primary-bright">声で話す</h3>
            <div className="flex items-center gap-5">
              <span className="grid size-[72px] place-items-center rounded-full bg-surface-soft text-foreground">
                <Mic className="size-8" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">マイク</span>
                <span className="mt-1 block text-base text-success">使用できます</span>
              </span>
              <CheckCircle2 className="size-6 text-success" aria-hidden="true" />
            </div>
            <div className="flex h-7 items-center gap-1" role="meter" aria-label="マイク入力レベル" aria-valuemin={0} aria-valuemax={24} aria-valuenow={testingMic ? 16 : 8}>
              {Array.from({ length: 24 }, (_, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className={index < (testingMic ? 16 : 8) ? "h-6 w-1.5 rounded-full bg-success" : "h-6 w-1.5 rounded-full bg-border/70"}
                />
              ))}
            </div>
            <Button variant="outline" size="lg" onClick={() => setTestingMic((current) => !current)}>
              {testingMic ? "テストを停止" : "マイクを試す"}
            </Button>

            <div className="my-2 h-px bg-border/70" />

            <h3 className="text-xl font-semibold text-primary-bright">声で返してもらう</h3>
            <div className="flex items-center gap-5">
              <span className="grid size-[72px] place-items-center rounded-full bg-surface-soft text-foreground">
                <Volume2 className="size-8" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">Irodori TTS</span>
                <span className="mt-1 block text-base text-muted-foreground">読み上げる</span>
              </span>
              <Switch checked={readAloud} onCheckedChange={setReadAloud} aria-label="返答を読み上げる" />
            </div>
            <Button variant="outline" size="lg" onClick={testVoice}>
              {testingVoice ? <Square className="fill-current" /> : null}
              {testingVoice ? "再生を停止" : "声を試す"}
            </Button>

            <div className="flex gap-3 rounded-md border border-border/70 bg-surface-soft p-4 text-sm leading-relaxed text-muted-foreground">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary-bright" aria-hidden="true" />
              音声を使わなくても、テキストで会話できます。
            </div>
            <Button size="lg" onClick={() => onOpenChange(false)}>
              完了
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
