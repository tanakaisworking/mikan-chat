import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Lightbulb, Mic, Volume2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { createSpeechInput, isSpeechInputSupported, type SpeechInput, type SpeechInputStatus } from "@/lib/speech-input"

export function VoiceSettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [micStatus, setMicStatus] = useState<SpeechInputStatus>("idle")
  const [transcript, setTranscript] = useState("")
  const [micError, setMicError] = useState<string | null>(null)
  const speechInput = useRef<SpeechInput | null>(null)
  const isListening = micStatus === "starting" || micStatus === "listening"
  const speechSupported = isSpeechInputSupported()
  const speechStatusLabel = !speechSupported
    ? "この環境では利用できません"
    : isListening
      ? "聞き取り中"
      : window.mikan
        ? "開始時にHayamimiへ接続します"
        : "使用できます"

  useEffect(() => {
    speechInput.current = createSpeechInput({
      onInterim: setTranscript,
      onFinal: setTranscript,
      onStatus: setMicStatus,
      onError: setMicError,
    })
    return () => speechInput.current?.dispose()
  }, [])

  useEffect(() => {
    if (!open) {
      speechInput.current?.stop()
      setTranscript("")
      setMicError(null)
    }
  }, [open])

  const toggleMic = () => {
    setMicError(null)
    setTranscript("")
    if (isListening) speechInput.current?.stop()
    else void speechInput.current?.start()
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
                <span className="block text-lg font-semibold">{window.mikan ? "Hayamimi" : "ブラウザ音声入力"}</span>
                <span className={speechSupported ? "mt-1 block text-base text-success" : "mt-1 block text-base text-muted-foreground"}>{speechStatusLabel}</span>
              </span>
              {speechSupported ? <CheckCircle2 className="size-6 text-success" aria-hidden="true" /> : null}
            </div>
            {transcript ? <p className="rounded-md bg-surface-soft p-4 text-sm" role="status">{transcript}</p> : null}
            {micError ? <p className="text-sm text-danger" role="alert">{micError}</p> : null}
            <Button variant="outline" size="lg" disabled={!speechSupported} onClick={toggleMic}>
              {isListening ? "テストを停止" : "マイクを試す"}
            </Button>

            <div className="my-2 h-px bg-border/70" />

            <h3 className="text-xl font-semibold text-primary-bright">声で返してもらう</h3>
            <div className="flex items-center gap-5">
              <span className="grid size-[72px] place-items-center rounded-full bg-surface-soft text-foreground">
                <Volume2 className="size-8" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">Irodori TTS</span>
                <span className="mt-1 block text-base text-muted-foreground">まだ接続されていません</span>
              </span>
              <Switch checked={false} disabled aria-label="返答を読み上げる" />
            </div>
            <Button variant="outline" size="lg" disabled>
              Irodori TTS接続後に利用できます
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
