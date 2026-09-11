import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { getAudioComId, getScenarioAudioComSource, readBgmPreference, resolveAudioComStream, writeBgmPreference, type BgmPreference } from "@/lib/audio-com"
import { BUNDLED_BGM_TRACKS, DEFAULT_BGM_FILE, isBundledBgmFile } from "../../../shared/audio-com"

const MAX_IMPORT_BYTES = 4 * 1024 * 1024
export const PREFERENCE_EVENT = "mikan:bgm-preference"

type ScenarioBgmPlayerProps = {
  scenarioId: string
  pack?: Record<string, unknown>
  title: string
  mode?: "player" | "settings"
  bundledAudio?: string | null
}

export function ScenarioBgmPlayer({ scenarioId, pack, title, mode = "player", bundledAudio = null }: ScenarioBgmPlayerProps) {
  const scenarioSource = getScenarioAudioComSource(pack)
  const [preference, setPreference] = useState(() => readBgmPreference(scenarioId))
  const [draftUrl, setDraftUrl] = useState(preference.customUrl ?? scenarioSource ?? "")
  const [error, setError] = useState("")
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const customLocal = isBundledBgmFile(preference.customUrl) ? preference.customUrl : null
  const customAudioCom = !customLocal && preference.customUrl ? getAudioComId(preference.customUrl) : null
  const source = customAudioCom ?? scenarioSource
  const packLocal = !preference.customUrl ? bundledAudio : null
  const localFile = customLocal ?? packLocal ?? (!preference.customUrl && !source ? DEFAULT_BGM_FILE : null)
  const customFileUrl = preference.customFile?.dataUrl ?? null

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ scenarioId: string; preference: BgmPreference }>).detail
      if (detail?.scenarioId !== scenarioId) return
      setPreference(detail.preference)
      setDraftUrl(detail.preference.customUrl ?? scenarioSource ?? "")
    }
    window.addEventListener(PREFERENCE_EVENT, update)
    return () => window.removeEventListener(PREFERENCE_EVENT, update)
  }, [scenarioId, scenarioSource])

  useEffect(() => {
    if (mode !== "player") return
    if (!preference.enabled) {
      setStreamUrl(null)
      return
    }
    if (customFileUrl) {
      setError("")
      setStreamUrl(customFileUrl)
      return
    }
    if (localFile) {
      setError("")
      setStreamUrl(localFile)
      return
    }
    if (!source) {
      setStreamUrl(null)
      return
    }
    const controller = new AbortController()
    setError("")
    void resolveAudioComStream(source, controller.signal)
      .then(({ streamUrl: resolved }) => setStreamUrl(resolved))
      .catch((cause) => {
        if (controller.signal.aborted) return
        setStreamUrl(null)
        setError(cause instanceof Error ? cause.message : "BGMを読み込めませんでした。")
      })
    return () => controller.abort()
  }, [mode, preference.enabled, customFileUrl, localFile, source])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = preference.volume / 100
  }, [preference.volume, streamUrl])

  const savePreference = (next: BgmPreference) => {
    setPreference(next)
    writeBgmPreference(scenarioId, next)
    window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, { detail: { scenarioId, preference: next } }))
  }

  const applySource = (value: string) => {
    if (!isBundledBgmFile(value) && !getAudioComId(value)) {
      setError("同梱BGMを選ぶか、audio.comのURLを入力してください。")
      return
    }
    setError("")
    setDraftUrl(value)
    savePreference({ ...preference, customUrl: value, customFile: null })
  }

  const importFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("audio/")) {
      setError("音声ファイルを選んでください。")
      return
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setError("ファイルが大きすぎます。4MBまでの音声ファイルを使ってください。")
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setError("ファイルを読み込めませんでした。")
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("ファイルを読み込めませんでした。")
        return
      }
      setError("")
      setDraftUrl("")
      savePreference({ ...preference, customUrl: null, customFile: { name: file.name, dataUrl: reader.result } })
    }
    reader.readAsDataURL(file)
  }

  if (mode === "settings") {
    return (
      <section className="grid gap-4" aria-label="BGM設定">
        <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 text-foreground">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">BGMを再生する</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">オフにすると無音になります</span>
                </span>
                <Switch
                  checked={preference.enabled}
                  onCheckedChange={(checked) => savePreference({ ...preference, enabled: checked })}
                  aria-label="BGMを再生する"
                />
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-semibold">同梱BGMから選ぶ</legend>
                <div className="flex flex-wrap gap-2">
                  {BUNDLED_BGM_TRACKS.map((preset) => {
                    const selected = !preference.customFile && (preference.customUrl === preset.file
                      || localFile === preset.file)
                    return (
                      <Button
                        key={preset.file}
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-pressed={selected}
                        className={selected ? "bg-surface font-bold text-primary hover:bg-surface" : "bg-surface text-foreground"}
                        title={preset.title + " / " + preset.credit}
                        onClick={() => applySource(preset.file)}
                      >
                        {preset.label}
                      </Button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">BGM：<a className="font-semibold text-primary underline underline-offset-4" href="https://kamatamago.com" target="_blank" rel="noreferrer">かまタマゴ</a>（商用利用OK・アプリ組込可）</p>
              </fieldset>
              <p className="text-xs leading-relaxed text-muted-foreground">
                自作または利用許諾のある音源だけを指定してください。Audio.comの公開ページで利用条件を確認してから、音源IDまたは埋め込みURLを入力してください。
              </p>
              <div className="flex gap-2 max-sm:flex-col">
                <input
                  className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={draftUrl}
                  onChange={(event) => setDraftUrl(event.target.value)}
                  placeholder="https://audio.com/..."
                  aria-label="BGMのURL"
                />
                <Button type="button" variant="outline" className="shrink-0 whitespace-nowrap" onClick={() => applySource(draftUrl.trim())}>この音源を使う</Button>
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-semibold">音声ファイルを読み込む</legend>
                <p className="text-xs text-muted-foreground">自作または利用許諾のある音声ファイル（4MBまで）をこの端末だけで再生できます。</p>
                <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium">
                    ファイルを選ぶ
                    <input
                      type="file"
                      accept=".wav,.mp3,.flac,.m4a,.ogg,audio/*"
                      className="sr-only"
                      aria-label="読み込む音声ファイル"
                      onChange={(event) => {
                        importFile(event.target.files?.[0])
                        event.target.value = ""
                      }}
                    />
                  </label>
                  {preference.customFile ? (
                    <span className="min-w-0 flex-1 truncate text-sm" title={preference.customFile.name}>{preference.customFile.name}</span>
                  ) : null}
                  {preference.customFile ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => savePreference({ ...preference, customFile: null })}>読み込みをやめる</Button>
                  ) : null}
                </div>
              </fieldset>
              {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
              <label className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
                音量
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={preference.volume}
                  onChange={(event) => savePreference({ ...preference, volume: Number(event.target.value) })}
                  aria-label="BGM音量"
                  className="accent-primary"
                />
                <span className="w-10 text-right tabular-nums">{preference.volume}%</span>
              </label>
              {preference.customUrl || preference.customFile ? (
                <Button type="button" variant="outline" onClick={() => {
                  savePreference({ ...preference, customUrl: null, customFile: null })
                  setDraftUrl(scenarioSource ?? "")
                  setError("")
                }}>{scenarioSource || bundledAudio ? "シナリオ指定のBGMに戻す" : "デフォルトのBGMに戻す"}</Button>
              ) : null}
        </div>
      </section>
    )
  }

  return streamUrl ? (
    <audio
      ref={audioRef}
      src={streamUrl}
      title={`${title}のBGM`}
      autoPlay
      loop
      preload="none"
      hidden
      aria-hidden="true"
      onError={() => setError("BGMを再生できませんでした。")}
    />
  ) : null
}
