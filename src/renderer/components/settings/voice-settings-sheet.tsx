import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { Collapsible } from "@base-ui/react/collapsible"
import { Check, CheckCircle2, Cloud, Cpu, Download, Lightbulb, Mic, Play, Sparkles, Trash2, Volume2 } from "lucide-react"

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
import type { Character } from "@/data/characters"
import { applyVoiceGender, createScenarioVoiceId, getScenarioVoiceDesign, hasScenarioReferenceAudio, scenarioVersion, type ScenarioVoiceDesign, type ScenarioVoiceSelection } from "@/lib/scenario-voice"
import { createTtsDriver, deleteIrodoriVoiceCandidate, deleteKokoroModel, downloadKokoroModel, ELEVENLABS_TTS_SETTINGS, generateIrodoriVoiceCandidate, getIrodoriRuntimeSnapshot, getKokoroModelSnapshot, getTtsSettingsError, IRODORI_TTS_SETTINGS, isIrodoriTtsSettings, isKokoroModelDownloaded, KOKORO_TTS_SETTINGS, OPENAI_COMPATIBLE_TTS_SETTINGS, saveIrodoriVoiceCandidate, seedIrodoriVoiceCache, subscribeIrodoriRuntime, subscribeKokoroModel, type TtsSettings } from "@/lib/tts"

export function VoiceSettingsSheet({
  open,
  active = open,
  embedded = false,
  readAloud,
  ttsSettings,
  character,
  voiceDesign: requestedVoiceDesign,
  voiceSelection,
  voiceSetupRequired = false,
  onReadAloudChange,
  onTtsSettingsChange,
  onVoiceConfirmed,
  onVoiceReset,
  onOpenChange,
}: {
  open: boolean
  active?: boolean
  embedded?: boolean
  readAloud: boolean
  ttsSettings: TtsSettings
  character?: Character
  voiceDesign?: ScenarioVoiceDesign | null
  voiceSelection?: ScenarioVoiceSelection
  voiceSetupRequired?: boolean
  onReadAloudChange: (checked: boolean) => void
  onTtsSettingsChange: (settings: TtsSettings) => void
  onVoiceConfirmed?: (selection: ScenarioVoiceSelection) => void
  onVoiceReset?: () => void
  onOpenChange: (open: boolean) => void
}) {
  const [micStatus, setMicStatus] = useState<SpeechInputStatus>("idle")
  const [transcript, setTranscript] = useState("")
  const [micError, setMicError] = useState<string | null>(null)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [testingVoice, setTestingVoice] = useState(false)
  const [resettingVoice, setResettingVoice] = useState(false)
  const [choosingVoice, setChoosingVoice] = useState(voiceSetupRequired)
  const [candidate, setCandidate] = useState<{ seed: number; audio: ArrayBuffer } | null>(null)
  const [candidateLoading, setCandidateLoading] = useState<number | null>(null)
  const previewAudio = useRef<HTMLAudioElement | null>(null)
  const previewUrl = useRef<string | null>(null)
  const previewRun = useRef(0)
  const kokoroModel = useSyncExternalStore(subscribeKokoroModel, getKokoroModelSnapshot)
  const irodoriStatus = useSyncExternalStore(subscribeIrodoriRuntime, getIrodoriRuntimeSnapshot)
  const speechInput = useRef<SpeechInput | null>(null)
  const tts = useMemo(() => createTtsDriver(ttsSettings, irodoriStatus), [irodoriStatus, ttsSettings])
  const settingsError = getTtsSettingsError(ttsSettings)
  const isIrodori = isIrodoriTtsSettings(ttsSettings)
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
  const irodoriReady = !isIrodori || irodoriStatus?.state === "ready" || irodoriStatus?.state === "running"
  const voiceDesign = useMemo(() => requestedVoiceDesign ?? (character ? getScenarioVoiceDesign(character) : null), [character, requestedVoiceDesign])
  const packagedVoice = Boolean(character && voiceDesign && hasScenarioReferenceAudio(character, voiceDesign.characterId))
  const canUseTts = tts.supported && irodoriReady && (ttsSettings.provider !== "kokoro" || kokoroModel.status === "ready")
  const ttsUnavailableReason = isIrodori && !irodoriReady
    ? irodoriStatus?.state === "unsupported" ? irodoriStatus.stage : "Irodori TTSをセットアップしてください"
    : tts.unavailableReason

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
    if (!open || !active) {
      speechInput.current?.stop()
      tts.stop()
      setTranscript("")
      setMicError(null)
      setTtsError(null)
    }
    setTestingVoice(false)
    return () => tts.stop()
  }, [active, open, tts])

  useEffect(() => {
    if (open) setChoosingVoice(voiceSetupRequired || !voiceSelection)
  }, [open, voiceSelection, voiceSetupRequired])

  const stopPreview = useCallback(() => {
    previewRun.current += 1
    previewAudio.current?.pause()
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewAudio.current = null
    previewUrl.current = null
  }, [])

  useEffect(() => () => stopPreview(), [stopPreview])

  useEffect(() => {
    if (!active) stopPreview()
  }, [active, stopPreview])

  useEffect(() => {
    stopPreview()
    setCandidate(null)
    setCandidateLoading(null)
  }, [character?.id, open, stopPreview, voiceDesign?.characterId])

  useEffect(() => {
    if (!open || ttsSettings.provider !== "kokoro") return
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

  const installIrodori = async () => {
    setTtsError(null)
    try {
      await window.mikan?.irodori?.install()
    } catch (error) {
      setTtsError(error instanceof Error ? error.message : "Irodori TTSをセットアップできませんでした。")
    }
  }

  const removeIrodori = async () => {
    setTtsError(null)
    tts.stop()
    try {
      await window.mikan?.irodori?.delete()
    } catch (error) {
      setTtsError(error instanceof Error ? error.message : "Irodori TTSのデータを削除できませんでした。")
    }
  }

  const previewCandidate = async (seed: number) => {
    if (!voiceDesign) return
    setTtsError(null)
    setCandidateLoading(seed)
    stopPreview()
    const run = previewRun.current
    try {
      const audio = await generateIrodoriVoiceCandidate(ttsSettings, voiceDesign.sampleText, applyVoiceGender(voiceDesign.caption, voiceDesign.gender) ?? voiceDesign.caption, seed)
      if (run !== previewRun.current || !open) return
      const url = URL.createObjectURL(new Blob([audio], { type: "audio/wav" }))
      previewUrl.current = url
      previewAudio.current = new Audio(url)
      setCandidate({ seed, audio })
      await previewAudio.current.play()
    } catch (error) {
      setTtsError(error instanceof Error ? error.message : "声の候補を生成できませんでした。")
    } finally {
      if (run === previewRun.current) setCandidateLoading(null)
    }
  }

  const confirmCandidate = async () => {
    if (!character || !voiceDesign || !candidate) return
    setTtsError(null)
    setCandidateLoading(candidate.seed)
    try {
      const voiceId = createScenarioVoiceId(character, voiceDesign.characterId)
      await saveIrodoriVoiceCandidate(voiceId, candidate.audio)
      const caption = applyVoiceGender(voiceDesign.caption, voiceDesign.gender) ?? voiceDesign.caption
      // 候補生成時の音声を初回セリフ再生用に保存し、会話側の再生成を省く。失敗しても確定は続ける。
      await seedIrodoriVoiceCache(ttsSettings, { voiceId, text: voiceDesign.sampleText, caption, seed: candidate.seed }, candidate.audio)
      onVoiceConfirmed?.({ characterId: voiceDesign.characterId, voiceId, caption: voiceDesign.caption, seed: candidate.seed, scenarioVersion: scenarioVersion(character), gender: voiceDesign.gender })
    } catch (error) {
      setTtsError(error instanceof Error ? error.message : "この声を保存できませんでした。")
    } finally {
      setCandidateLoading(null)
    }
  }

  const resetCharacterVoice = async () => {
    if (!character || !voiceDesign || resettingVoice) return
    setTtsError(null)
    setResettingVoice(true)
    try {
      stopPreview()
      setCandidate(null)
      await deleteIrodoriVoiceCandidate(createScenarioVoiceId(character, voiceDesign.characterId))
      onVoiceReset?.()
    } catch (error) {
      setTtsError(error instanceof Error ? error.message : "声をリセットできませんでした。")
    } finally {
      setResettingVoice(false)
    }
  }

  const characterVoicePanel = isIrodori && voiceDesign && irodoriReady ? (
    <div className="grid gap-4 rounded-lg border border-primary/30 bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-soft text-primary-bright"><Sparkles className="size-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          {voiceSetupRequired ? <span className="block text-xs font-semibold text-primary-bright">最初に声を決めましょう</span> : null}
          <span className="block font-semibold">{voiceDesign.characterName}の声</span>
          <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{voiceDesign.caption}</span>
        </span>
      </div>

      {packagedVoice ? (
        <p className="flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 className="size-4" aria-hidden="true" />シナリオ指定の参照音声を使用します</p>
      ) : voiceSelection && !choosingVoice ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 max-sm:items-start">
            <p className="flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 className="size-4" aria-hidden="true" />このキャラクターの声は設定済みです</p>
            <Button variant="outline" size="sm" onClick={() => setChoosingVoice(true)}>選び直す</Button>
          </div>
          <Button variant="ghost" size="sm" className="justify-start text-muted-foreground hover:text-destructive" disabled={resettingVoice} onClick={() => void resetCharacterVoice()}>
            <Trash2 />{resettingVoice ? "削除中…" : "この声をリセット"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm leading-relaxed text-muted-foreground">候補を聞き比べて、このキャラクターの基準になる声を選んでください。</p>
          <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            {voiceDesign.seeds.map((seed, index) => {
              const selected = candidate?.seed === seed
              return (
                <Button key={seed} variant="outline" className={selected ? "border-primary text-primary-bright" : ""} disabled={candidateLoading !== null} onClick={() => void previewCandidate(seed)}>
                  {selected ? <Check /> : <Play />}
                  {candidateLoading === seed ? "生成中…" : `候補 ${index + 1}`}
                </Button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">初回の候補生成には少し時間がかかります。</p>
          <Button disabled={!candidate || candidateLoading !== null} onClick={() => void confirmCandidate()}>
            {candidate && candidateLoading === candidate.seed ? "保存中…" : "この声に決める"}
          </Button>
        </div>
      )}
    </div>
  ) : null

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
            <p>音声生成は{isDesktopApp() ? "アプリ内" : "ブラウザ内"}で完結し、文章は外部へ送信しません。</p>
            {!isDesktopApp() ? <p>スマートフォンや低性能端末では「ブラウザ標準」をおすすめします。</p> : null}
          </div>
        </div>
      ) : null}

      {isIrodori ? (
        <div className="grid gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-primary-bright">
              {irodoriStatus?.state === "ready" || irodoriStatus?.state === "running" ? <CheckCircle2 className="size-5 text-success" aria-hidden="true" /> : <Download className="size-5" aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Irodori TTS</span>
              <span className="mt-1 block text-sm text-muted-foreground" role="status">{irodoriStatus?.stage ?? "状態を確認しています"}</span>
            </span>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">生成速度</legend>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["fast", "高速", "24 steps"],
                ["balanced", "標準", "32 steps"],
                ["quality", "高品質", "40 steps"],
              ] as const).map(([value, label, detail]) => {
                const selected = (ttsSettings.irodoriQuality ?? "balanced") === value
                return (
                  <Button
                    key={value}
                    type="button"
                    variant="outline"
                    className={selected ? "border-primary bg-surface font-bold text-primary hover:bg-surface" : "bg-surface"}
                    aria-pressed={selected}
                    onClick={() => onTtsSettingsChange({ ...ttsSettings, irodoriQuality: value })}
                  >
                    <span className="grid leading-tight">
                      <span>{label}</span>
                      <span className="text-[11px] font-normal text-muted-foreground">{detail}</span>
                    </span>
                  </Button>
                )
              })}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">高速ほど待ち時間を短縮し、高品質ほど声の細部を丁寧に生成します。</p>
          </fieldset>

          {characterVoicePanel}

          {irodoriStatus?.state === "installing" || irodoriStatus?.state === "starting" ? (
            <div className="grid gap-2">
              <div className="h-2 overflow-hidden rounded-full bg-border/55" role="progressbar" aria-label="Irodoriセットアップの進捗" aria-valuemin={0} aria-valuemax={100} aria-valuenow={irodoriStatus.indeterminate ? undefined : irodoriStatus.progress} aria-valuetext={irodoriStatus.indeterminate ? "音声モデルをダウンロード中" : undefined}>
                <div className={irodoriStatus.indeterminate ? "h-full w-1/3 animate-pulse rounded-full bg-primary motion-reduce:animate-none" : "h-full rounded-full bg-primary transition-[width] duration-300"} style={irodoriStatus.indeterminate ? undefined : { width: `${irodoriStatus.progress}%` }} />
              </div>
              <p className="text-right text-xs tabular-nums text-muted-foreground">{irodoriStatus.indeterminate ? "ダウンロード中…" : `${irodoriStatus.progress}%`}</p>
              <Button variant="outline" onClick={() => void removeIrodori()}><Trash2 />セットアップを中止</Button>
            </div>
          ) : null}

          {irodoriStatus?.state === "missing" ? (
            <Button onClick={() => void installIrodori()}>
              <Download />IrodoriをこのMacで使えるようにする
            </Button>
          ) : irodoriStatus?.state === "error" ? (
            <div className="grid gap-3">
              <p className="text-sm text-danger" role="alert">{irodoriStatus.error}</p>
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <Button onClick={() => void installIrodori()}><Download />セットアップを再試行</Button>
                <Button variant="destructive" onClick={() => void removeIrodori()}><Trash2 />残ったデータを削除</Button>
              </div>
            </div>
          ) : irodoriStatus?.state === "ready" || irodoriStatus?.state === "running" ? (
            <Button variant="destructive" onClick={() => void removeIrodori()}><Trash2 />Irodoriのデータを削除</Button>
          ) : null}

          <div className="grid gap-2 text-sm leading-relaxed text-muted-foreground">
            <p>初回のみ数GBをダウンロードします。完了後はアプリが自動で起動します。</p>
            <p>Apple Silicon Macと6GB以上の空き容量が必要です。文章はこのMac内で処理されます。</p>
          </div>
        </div>
      ) : ttsSettings.provider === "openai-compatible" ? (
        <>
          <TextField
            name="tts-endpoint"
            label="接続先URL"
            value={ttsSettings.endpoint}
            placeholder="https://api.openai.com/v1"
            error={endpointError}
            onChange={(event) => onTtsSettingsChange({ ...ttsSettings, endpoint: event.target.value })}
          />
        </>
      ) : null}

      {ttsSettings.provider === "elevenlabs" || (ttsSettings.provider === "openai-compatible" && !isIrodori) ? (
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
            label={isIrodori ? "APIキー（サーバーで設定した場合のみ）" : "APIキー"}
            value={ttsSettings.apiKey}
            placeholder="APIキーを入力"
            autoComplete="off"
            error={apiKeyError}
            onChange={(event) => onTtsSettingsChange({ ...ttsSettings, apiKey: event.target.value })}
            description={isIrodori ? "ローカルサーバー側でAPIキーを設定していなければ空欄で使えます。" : ttsSettings.provider === "elevenlabs" ? "このブラウザに保存します。権限制限と利用上限を設定したAPIキーを推奨します。" : "このブラウザに保存し、mikan chatのサーバーには保存しません。"}
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
            {canUseTts ? "読み上げに使用できます" : ttsUnavailableReason}
          </span>
        </span>
        <Switch
          checked={canUseTts && !voiceSetupRequired && readAloud}
          disabled={!canUseTts || voiceSetupRequired}
          onCheckedChange={onReadAloudChange}
          aria-label="返答を読み上げる"
        />
      </div>
      <Button variant="outline" size="lg" disabled={!canUseTts || voiceSetupRequired || testingVoice} onClick={testVoice}>
        {testingVoice ? "音声を準備中…" : voiceSetupRequired ? "先にキャラクターの声を決めてください" : canUseTts ? `${tts.label}を試す` : ttsUnavailableReason}
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

  const content = (
    <>
        {!embedded ? <SheetHeader>
          <SheetTitle className="text-3xl max-md:text-2xl">{voiceSetupRequired ? "キャラクターの声を決める" : "音声設定"}</SheetTitle>
          <SheetDescription className="sr-only">{voiceSetupRequired ? "読み上げに使うキャラクターの声を選びます" : "マイクと読み上げ音声を設定します"}</SheetDescription>
        </SheetHeader> : null}

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
            ) : (
              <div className="grid gap-3">
                <Collapsible.Root className="grid gap-2" open={ttsSettings.provider === "kokoro"}>
                  <ChoiceCard
                    size="dialog"
                    selected={ttsSettings.provider === "kokoro"}
                    expanded={ttsSettings.provider === "kokoro"}
                    controls="tts-settings-electron-kokoro"
                    icon={<Cpu />}
                    title="Kokoro"
                    description="無料・アプリ内で生成（初回ダウンロードあり）"
                    onClick={() => {
                      if (ttsSettings.provider !== "kokoro") onTtsSettingsChange(KOKORO_TTS_SETTINGS)
                    }}
                  />
                  {animatedPanel("tts-settings-electron-kokoro")}
                </Collapsible.Root>
                <Collapsible.Root className="grid gap-2" open={isIrodori}>
                  <ChoiceCard
                    size="dialog"
                    selected={isIrodori}
                    expanded={isIrodori}
                    controls="tts-settings-irodori"
                    icon={<Cpu />}
                    title="Irodori TTS"
                    description="このPCのIrodoriサーバーで高品質な日本語音声を生成"
                    onClick={() => {
                      if (!isIrodori) {
                        onTtsSettingsChange(IRODORI_TTS_SETTINGS)
                      }
                    }}
                  />
                  {animatedPanel("tts-settings-irodori")}
                </Collapsible.Root>
                <Collapsible.Root className="grid gap-2" open={ttsSettings.provider === "browser"}>
                  <ChoiceCard
                    size="dialog"
                    selected={ttsSettings.provider === "browser"}
                    expanded={ttsSettings.provider === "browser"}
                    controls="tts-settings-electron-browser"
                    icon={<Volume2 />}
                    title="OS標準音声"
                    description="追加設定なしで利用"
                    onClick={() => onTtsSettingsChange({ ...ttsSettings, provider: "browser" })}
                  />
                  {animatedPanel("tts-settings-electron-browser")}
                </Collapsible.Root>
                <Collapsible.Root className="grid gap-2" open={ttsSettings.provider === "openai-compatible"}>
                  <ChoiceCard
                    size="dialog"
                    selected={ttsSettings.provider === "openai-compatible"}
                    expanded={ttsSettings.provider === "openai-compatible"}
                    controls="tts-settings-electron-external"
                    icon={<Cloud />}
                    title="その他の読み上げAI"
                    description="OpenAI互換TTSへ接続"
                    onClick={() => {
                      if (ttsSettings.provider !== "openai-compatible") onTtsSettingsChange(OPENAI_COMPATIBLE_TTS_SETTINGS)
                    }}
                  />
                  {animatedPanel("tts-settings-electron-external")}
                </Collapsible.Root>
              </div>
            )}

            <div className="flex gap-3 rounded-md border border-border/70 bg-surface-soft p-4 text-sm leading-relaxed text-muted-foreground">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary-bright" aria-hidden="true" />
              音声を使わなくても、テキストで会話できます。
            </div>
            <Button size="lg" onClick={() => onOpenChange(false)}>
              完了
            </Button>
          </section>
        </div>
    </>
  )

  if (embedded) return content

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0" data-testid="voice-settings-sheet">
        {content}
      </SheetContent>
    </Sheet>
  )
}
