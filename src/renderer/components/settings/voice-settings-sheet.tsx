import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { Collapsible } from "@base-ui/react/collapsible"
import { CheckCircle2, Cloud, Cpu, Download, Lightbulb, Mic, Trash2, Volume2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChoiceCard } from "@/components/ui/choice-card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { TextField } from "@/components/ui/text-field"
import { createSpeechInput, isSpeechInputSupported, type SpeechInput, type SpeechInputStatus } from "@/lib/speech-input"
import { isDesktopApp } from "@/lib/platform"
import { createTtsDriver, deleteKokoroModel, downloadKokoroModel, ELEVENLABS_TTS_SETTINGS, getKokoroModelSnapshot, getTtsSettingsError, isKokoroModelDownloaded, KOKORO_TTS_SETTINGS, OPENAI_COMPATIBLE_TTS_SETTINGS, subscribeKokoroModel, type TtsSettings } from "@/lib/tts"

export function VoiceSettingsSheet({
  open,
  readAloud,
  ttsSettings,
  onReadAloudChange,
  onTtsSettingsChange,
  onOpenChange,
}: {
  open: boolean
  readAloud: boolean
  ttsSettings: TtsSettings
  onReadAloudChange: (checked: boolean) => void
  onTtsSettingsChange: (settings: TtsSettings) => void
  onOpenChange: (open: boolean) => void
}) {
  const [micStatus, setMicStatus] = useState<SpeechInputStatus>("idle")
  const [transcript, setTranscript] = useState("")
  const [micError, setMicError] = useState<string | null>(null)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [testingVoice, setTestingVoice] = useState(false)
  const kokoroModel = useSyncExternalStore(subscribeKokoroModel, getKokoroModelSnapshot)
  const speechInput = useRef<SpeechInput | null>(null)
  const tts = useMemo(() => createTtsDriver(ttsSettings), [ttsSettings])
  const settingsError = getTtsSettingsError(ttsSettings)
  const endpointError = settingsError?.includes("接続先") ? settingsError : undefined
  const modelError = settingsError?.includes("モデル") ? settingsError : undefined
  const voiceError = settingsError?.includes("声の名前") || settingsError?.includes("Voice ID") ? settingsError : undefined
  const apiKeyError = settingsError?.includes("APIキー") ? settingsError : undefined
  const isListening = micStatus === "starting" || micStatus === "listening"
  const speechSupported = isSpeechInputSupported()
  const speechStatusLabel = !speechSupported
    ? "この環境では利用できません"
    : isListening
      ? "聞き取り中"
      : isDesktopApp()
        ? "開始時にHayamimiへ接続します"
        : "使用できます"
  const canUseTts = tts.supported && (ttsSettings.provider !== "kokoro" || kokoroModel.status === "ready")

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
      tts.stop()
      setTranscript("")
      setMicError(null)
      setTtsError(null)
    }
    setTestingVoice(false)
    return () => tts.stop()
  }, [open, tts])

  useEffect(() => {
    if (!open || isDesktopApp() || ttsSettings.provider !== "kokoro") return
    void isKokoroModelDownloaded(ttsSettings.voice)
  }, [open, ttsSettings.provider, ttsSettings.voice])

  const toggleMic = () => {
    setMicError(null)
    setTranscript("")
    if (isListening) speechInput.current?.stop()
    else void speechInput.current?.start()
  }

  const testVoice = () => {
    setTtsError(null)
    setTestingVoice(true)
    tts.speak("mikan chatの音声で読み上げています。", {
      onError: setTtsError,
      onEnd: () => setTestingVoice(false),
    })
  }

  const downloadModel = async () => {
    setTtsError(null)
    try {
      await downloadKokoroModel(ttsSettings.voice, () => undefined)
    } catch (error) {
      setTtsError(error instanceof Error ? error.message : "モデルをダウンロードできませんでした。")
    }
  }

  const removeModel = async () => {
    setTtsError(null)
    tts.stop()
    try {
      await deleteKokoroModel()
      onReadAloudChange(false)
    } catch {
      setTtsError("モデルを削除できませんでした。")
    }
  }

  const providerSettingsPanel = (panelId: string) => (
    <div
      id={panelId}
      className="grid gap-4 rounded-lg border border-border bg-surface-soft p-4 shadow-soft"
      data-testid="selected-tts-settings"
    >
      {ttsSettings.provider === "kokoro" ? (
        <div className="grid gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-primary-bright">
              {kokoroModel.status === "ready" ? <CheckCircle2 className="size-5 text-success" aria-hidden="true" /> : <Download className="size-5" aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Kokoro音声モデル</span>
              <span className="mt-1 block text-sm text-muted-foreground" role="status">{kokoroModel.progress.message}</span>
            </span>
          </div>

          {kokoroModel.status === "downloading" ? (
            <div className="grid gap-2">
              <div
                className="h-2 overflow-hidden rounded-full bg-border/55"
                role="progressbar"
                aria-label="Kokoroモデルのダウンロード進捗"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={kokoroModel.progress.percent ?? undefined}
              >
                <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${kokoroModel.progress.percent ?? 8}%` }} />
              </div>
              <p className="text-right text-xs tabular-nums text-muted-foreground">{kokoroModel.progress.percent === null ? "準備中" : `${kokoroModel.progress.percent}%`}</p>
            </div>
          ) : null}

          {kokoroModel.status === "ready" || kokoroModel.status === "deleting" ? (
            <Button variant="destructive" onClick={() => void removeModel()} disabled={kokoroModel.status === "deleting"}>
              <Trash2 />
              {kokoroModel.status === "deleting" ? "削除中…" : "モデルを削除"}
            </Button>
          ) : kokoroModel.status === "error" ? (
            <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
              <Button onClick={() => void downloadModel()}>
                <Download />
                ダウンロードを再試行
              </Button>
              <Button variant="destructive" onClick={() => void removeModel()}>
                <Trash2 />
                残ったデータを削除
              </Button>
            </div>
          ) : (
            <Button onClick={() => void downloadModel()} disabled={kokoroModel.status === "checking" || kokoroModel.status === "downloading"}>
              <Download />
              {kokoroModel.status === "downloading" ? "ダウンロード中…" : kokoroModel.status === "checking" ? "確認中…" : "モデルをダウンロード"}
            </Button>
          )}

          <div className="grid gap-2 text-sm leading-relaxed text-muted-foreground">
            <p>初回は100MB以上をダウンロードするため、数分かかることがあります。</p>
            <p>音声生成はブラウザ内で完結し、文章は外部へ送信しません。</p>
            <p>スマートフォンや低性能端末では「ブラウザ標準」をおすすめします。</p>
          </div>
        </div>
      ) : null}

      {ttsSettings.provider === "openai-compatible" ? (
        <TextField
          name="tts-endpoint"
          label="接続先URL"
          value={ttsSettings.endpoint}
          placeholder="https://api.openai.com/v1"
          error={endpointError}
          onChange={(event) => onTtsSettingsChange({ ...ttsSettings, endpoint: event.target.value })}
        />
      ) : null}

      {ttsSettings.provider === "elevenlabs" || ttsSettings.provider === "openai-compatible" ? (
        <>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <TextField
              name="tts-model"
              label={ttsSettings.provider === "elevenlabs" ? "モデルID" : "モデル名"}
              value={ttsSettings.model}
              placeholder={ttsSettings.provider === "elevenlabs" ? "eleven_flash_v2_5" : "gpt-4o-mini-tts"}
              error={modelError}
              onChange={(event) => onTtsSettingsChange({ ...ttsSettings, model: event.target.value })}
            />
            <TextField
              name="tts-voice"
              label={ttsSettings.provider === "elevenlabs" ? "Voice ID" : "声の名前"}
              value={ttsSettings.voice}
              placeholder={ttsSettings.provider === "elevenlabs" ? "ElevenLabsのVoice ID" : "alloy"}
              error={voiceError}
              onChange={(event) => onTtsSettingsChange({ ...ttsSettings, voice: event.target.value })}
            />
          </div>
          <TextField
            name="tts-api-key"
            type="password"
            label="APIキー"
            value={ttsSettings.apiKey}
            placeholder="APIキーを入力"
            autoComplete="off"
            error={apiKeyError}
            onChange={(event) => onTtsSettingsChange({ ...ttsSettings, apiKey: event.target.value })}
            description={ttsSettings.provider === "elevenlabs" ? "このブラウザに保存します。権限制限と利用上限を設定したAPIキーを推奨します。" : "このブラウザに保存し、mikan chatのサーバーには保存しません。"}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">読み上げる文章とAPIキーは、{ttsSettings.provider === "elevenlabs" ? "ElevenLabs" : "指定したTTSサービス"}へブラウザから直接送信され、mikan chatのサーバーには送信されません。</p>
        </>
      ) : null}

      <div className="flex items-center gap-4 border-t border-border/70 pt-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-surface text-foreground">
          <Volume2 className="size-7" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{tts.label}</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {tts.supported ? "読み上げに使用できます" : tts.unavailableReason}
          </span>
        </span>
        <Switch
          checked={canUseTts && readAloud}
          disabled={!canUseTts}
          onCheckedChange={onReadAloudChange}
          aria-label="返答を読み上げる"
        />
      </div>
      <Button variant="outline" size="lg" disabled={!canUseTts || testingVoice} onClick={testVoice}>
        {testingVoice ? "音声を準備中…" : canUseTts ? `${tts.label}を試す` : tts.unavailableReason}
      </Button>
      {ttsError ? <p className="text-sm text-danger" role="alert">{ttsError}</p> : null}
    </div>
  )

  const animatedPanel = (panelId: string) => (
    <Collapsible.Panel
      className="h-[var(--collapsible-panel-height)] overflow-hidden opacity-100 transition-[height,opacity] duration-300 ease-out data-[starting-style]:h-0 data-[starting-style]:opacity-0 data-[ending-style]:h-0 data-[ending-style]:opacity-0 motion-reduce:transition-none"
    >
      {providerSettingsPanel(panelId)}
    </Collapsible.Panel>
  )

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
                <span className="block text-lg font-semibold">{isDesktopApp() ? "Hayamimi" : "ブラウザ音声入力"}</span>
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
            {!isDesktopApp() ? (
              <div className="grid gap-3">
                <Collapsible.Root className="grid gap-2" open={ttsSettings.provider === "kokoro"}>
                  <ChoiceCard
                    size="dialog"
                    selected={ttsSettings.provider === "kokoro"}
                    expanded={ttsSettings.provider === "kokoro"}
                    controls="tts-settings-kokoro"
                    icon={<Cpu />}
                    title="Kokoro"
                    description="無料・端末内で高品質（初回ダウンロードあり）"
                    onClick={() => {
                      if (ttsSettings.provider !== "kokoro") onTtsSettingsChange(KOKORO_TTS_SETTINGS)
                    }}
                  />
                  {animatedPanel("tts-settings-kokoro")}
                </Collapsible.Root>
                <Collapsible.Root className="grid gap-2" open={ttsSettings.provider === "browser"}>
                  <ChoiceCard
                    size="dialog"
                    selected={ttsSettings.provider === "browser"}
                    expanded={ttsSettings.provider === "browser"}
                    controls="tts-settings-browser"
                    icon={<Volume2 />}
                    title="ブラウザ標準"
                    description="無料・APIキー不要"
                    onClick={() => onTtsSettingsChange({ ...ttsSettings, provider: "browser" })}
                  />
                  {animatedPanel("tts-settings-browser")}
                </Collapsible.Root>
                <Collapsible.Root className="grid gap-2" open={ttsSettings.provider === "elevenlabs"}>
                  <ChoiceCard
                    size="dialog"
                    selected={ttsSettings.provider === "elevenlabs"}
                    expanded={ttsSettings.provider === "elevenlabs"}
                    controls="tts-settings-elevenlabs"
                    icon={<Cloud />}
                    title="ElevenLabs"
                    description="高品質な音声を自分のAPIキーで利用"
                    onClick={() => {
                      if (ttsSettings.provider !== "elevenlabs") onTtsSettingsChange(ELEVENLABS_TTS_SETTINGS)
                    }}
                  />
                  {animatedPanel("tts-settings-elevenlabs")}
                </Collapsible.Root>
                <Collapsible.Root className="grid gap-2" open={ttsSettings.provider === "openai-compatible"}>
                  <ChoiceCard
                    size="dialog"
                    selected={ttsSettings.provider === "openai-compatible"}
                    expanded={ttsSettings.provider === "openai-compatible"}
                    controls="tts-settings-openai-compatible"
                    icon={<Cloud />}
                    title="外部の読み上げAI"
                    description="OpenAI互換TTSをAPIキーで利用"
                    onClick={() => {
                      if (ttsSettings.provider !== "openai-compatible") onTtsSettingsChange(OPENAI_COMPATIBLE_TTS_SETTINGS)
                    }}
                  />
                  {animatedPanel("tts-settings-openai-compatible")}
                </Collapsible.Root>
              </div>
            ) : providerSettingsPanel("tts-settings-electron")}

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
