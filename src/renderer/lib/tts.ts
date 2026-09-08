import { getEndpointError, normalizeApiKey } from "@/lib/ai-chat"
import type { IrodoriRuntimeStatus } from "../../shared/local-tts"

const ELEVENLABS_API_ENDPOINT = "https://api.elevenlabs.io/v1"
export function getKokoroAssetsUrl(location: Pick<Location, "protocol" | "href"> = window.location) {
  return location.protocol === "file:"
    ? new URL("./kokoro-js-jp", location.href).href.replace(/\/$/, "")
    : "/kokoro-js-jp"
}

const KOKORO_ASSETS_URL = getKokoroAssetsUrl()
const KOKORO_MODULE_URL = `${KOKORO_ASSETS_URL}/kokoro-jp.web.js`
const KOKORO_MODEL_ID = "Kokoro-82M-v1.0-ONNX"
const KOKORO_MODEL_MARKER = "mikan-chat.kokoro-model.v1"
const KOKORO_BACKEND_MARKER = "mikan-chat.kokoro-backend.v1"
const KOKORO_MODEL_CACHE = "transformers-cache"
const KOKORO_VOICE_CACHE = "kokoro-voices"
const KOKORO_JAPANESE_CACHE = "mikan-chat-kokoro-japanese-v1"
const KOKORO_MODEL_LOCK = "mikan-chat-kokoro-model"
const KOKORO_MODEL_BASE_URL = `https://huggingface.co/onnx-community/${KOKORO_MODEL_ID}/resolve/main`
const KOKORO_MODEL_FILES = [
  `${KOKORO_MODEL_BASE_URL}/config.json`,
  `${KOKORO_MODEL_BASE_URL}/tokenizer.json`,
  `${KOKORO_MODEL_BASE_URL}/tokenizer_config.json`,
  `${KOKORO_MODEL_BASE_URL}/onnx/model_quantized.onnx`,
] as const
const KOKORO_JAPANESE_ASSETS = [
  `${KOKORO_ASSETS_URL}/open_jtalk_dic_utf_8-1.11.tar.gz`,
  `${KOKORO_ASSETS_URL}/openjtalk-voice.htsvoice`,
] as const

export type TtsSettings = {
  provider: "browser" | "kokoro" | "irodori" | "openai-compatible" | "elevenlabs"
  apiKey: string
  endpoint: string
  model: string
  voice: string
  irodoriQuality?: "fast" | "balanced" | "quality"
}

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  provider: "browser",
  apiKey: "",
  endpoint: "https://api.openai.com/v1",
  model: "gpt-4o-mini-tts",
  voice: "alloy",
}

export const ELEVENLABS_TTS_SETTINGS: TtsSettings = {
  provider: "elevenlabs",
  apiKey: "",
  endpoint: ELEVENLABS_API_ENDPOINT,
  model: "eleven_flash_v2_5",
  voice: "",
}

export const KOKORO_TTS_SETTINGS: TtsSettings = {
  provider: "kokoro",
  apiKey: "",
  endpoint: "",
  model: "Kokoro-82M",
  voice: "jf_alpha",
}

export const OPENAI_COMPATIBLE_TTS_SETTINGS: TtsSettings = {
  ...DEFAULT_TTS_SETTINGS,
  provider: "openai-compatible",
}

export const IRODORI_TTS_SETTINGS: TtsSettings = {
  provider: "irodori",
  apiKey: "",
  endpoint: "http://127.0.0.1:8088/v1",
  model: "irodori-tts",
  voice: "none",
  irodoriQuality: "balanced",
}

const IRODORI_STEPS = { fast: 24, balanced: 32, quality: 40 } as const

export function isIrodoriTtsSettings(settings: TtsSettings) {
  return settings.provider === "irodori"
}

let irodoriRuntimeSnapshot: IrodoriRuntimeStatus | null = null

export function getIrodoriRuntimeSnapshot() {
  return irodoriRuntimeSnapshot
}

export function subscribeIrodoriRuntime(listener: () => void) {
  const bridge = window.mikan?.irodori
  if (!bridge) return () => undefined
  let active = true
  const update = (next: IrodoriRuntimeStatus) => {
    if (!active) return
    irodoriRuntimeSnapshot = next
    listener()
  }
  const unsubscribe = bridge.onStatus(update)
  void bridge.status().then(update).catch(() => undefined)
  return () => {
    active = false
    unsubscribe()
  }
}

export type TtsDriver = {
  label: string
  supported: boolean
  unavailableReason: string | null
  speak: (text: string, callbacks?: { onEnd?: () => void; onError?: (message: string) => void }, options?: TtsSpeakOptions) => void
  stop: () => void
}

export type TtsSpeakOptions = {
  voiceId?: string
  caption?: string
  seed?: number
  referenceAudio?: {
    source: string
    voiceId: string
    fileName: string
  }
}

export type KokoroDownloadProgress = {
  percent: number | null
  message: string
}

export type KokoroModelSnapshot = {
  status: "checking" | "not-downloaded" | "downloading" | "ready" | "deleting" | "error"
  progress: KokoroDownloadProgress
  voice: string | null
}

let kokoroModelSnapshot: KokoroModelSnapshot = {
  status: "checking",
  progress: { percent: null, message: "モデルを確認中…" },
  voice: null,
}
const kokoroModelListeners = new Set<() => void>()
let listensForKokoroStorageChanges = false

export function getKokoroModelSnapshot() {
  return kokoroModelSnapshot
}

export function subscribeKokoroModel(listener: () => void) {
  if (!listensForKokoroStorageChanges) {
    window.addEventListener("storage", (event) => {
      if (event.key !== KOKORO_MODEL_MARKER) return
      if (event.newValue !== "ready") {
        kokoroInstancePromise = null
        setKokoroModelSnapshot({ status: "not-downloaded", progress: { percent: 0, message: "未ダウンロード" }, voice: null })
      } else {
        void isKokoroModelDownloaded(kokoroModelSnapshot.voice ?? KOKORO_TTS_SETTINGS.voice)
      }
    })
    listensForKokoroStorageChanges = true
  }
  kokoroModelListeners.add(listener)
  return () => kokoroModelListeners.delete(listener)
}

function setKokoroModelSnapshot(snapshot: KokoroModelSnapshot) {
  kokoroModelSnapshot = snapshot
  kokoroModelListeners.forEach((listener) => listener())
}

export function getTtsSettingsError(settings: TtsSettings) {
  if (settings.provider === "browser" || settings.provider === "kokoro") return null
  if (settings.provider === "openai-compatible") {
    const endpointError = getEndpointError({ type: isLoopbackEndpoint(settings.endpoint) ? "local" : "online", endpoint: settings.endpoint })
    if (endpointError) return endpointError.replace("オンラインAI", "外部TTS")
  }
  if (!settings.model.trim()) return settings.provider === "elevenlabs" ? "モデルIDを入力してください。" : "モデル名を入力してください。"
  if (!settings.voice.trim()) return settings.provider === "elevenlabs" ? "Voice IDを入力してください。" : "声の名前を入力してください。"
  const apiKey = normalizeApiKey(settings.apiKey)
  if (!apiKey && !isIrodoriTtsSettings(settings)) return "APIキーを入力してください。"
  if (apiKey && !/^[\x21-\x7e]+$/.test(apiKey)) return "APIキーに使用できない文字が含まれています。"
  return null
}

export function createTtsDriver(settings: TtsSettings = DEFAULT_TTS_SETTINGS, irodoriRuntime = irodoriRuntimeSnapshot): TtsDriver {
  const browserTts = createBrowserTtsDriver()
  if (settings.provider === "browser") return browserTts
  if (settings.provider === "kokoro") {
    if (kokoroModelSnapshot.status === "checking" || kokoroModelSnapshot.voice !== settings.voice) {
      void isKokoroModelDownloaded(settings.voice)
    }
    return createKokoroTtsDriver(
      settings.voice,
      loadKokoroInstance,
      browserTts,
      () => kokoroModelSnapshot.status === "ready" && kokoroModelSnapshot.voice === settings.voice,
    )
  }

  const settingsError = getTtsSettingsError(settings)
  const isElevenLabs = settings.provider === "elevenlabs"
  const isIrodori = isIrodoriTtsSettings(settings)
  const irodoriReady = !isIrodori || irodoriRuntime?.state === "ready" || irodoriRuntime?.state === "running"
  const unavailableReason = isIrodori && !irodoriReady ? irodoriRuntime?.stage ?? "Irodori TTSをセットアップしてください" : settingsError
  type Playback = { controller: AbortController; requestId: string; audio: HTMLAudioElement | null; audioUrl: string | null }
  let active: Playback | null = null

  const cleanup = (playback: Playback) => {
    playback.audio?.pause()
    if (playback.audioUrl) URL.revokeObjectURL(playback.audioUrl)
    if (active === playback) active = null
  }

  const stop = () => {
    const playback = active
    active = null
    playback?.controller.abort()
    if (isIrodori && playback) window.mikan?.tts?.cancelLocal(playback.requestId)
    if (playback) cleanup(playback)
    browserTts.stop()
  }

  return {
    label: isElevenLabs ? "ElevenLabs" : isIrodori ? "Irodori TTS" : "外部TTS",
    supported: !unavailableReason && typeof Audio !== "undefined",
    unavailableReason,
    speak: (text, callbacks = {}, options) => {
      stop()
      if (unavailableReason || typeof Audio === "undefined") {
        callbacks.onError?.(unavailableReason ?? "この環境では音声を再生できません。")
        callbacks.onEnd?.()
        return
      }
      const requestController = new AbortController()
      const requestId = crypto.randomUUID()
      const playback: Playback = { controller: requestController, requestId, audio: null, audioUrl: null }
      active = playback
      const fallback = (message: string) => {
        if (active !== playback) return
        cleanup(playback)
        callbacks.onError?.(message)
        if (!isIrodori && browserTts.supported) browserTts.speak(text, { onEnd: callbacks.onEnd })
        else callbacks.onEnd?.()
      }
      const endpoint = (isElevenLabs ? ELEVENLABS_API_ENDPOINT : settings.endpoint).trim().replace(/\/+$/, "")
      const localSynthesis = isIrodori ? window.mikan?.tts?.synthesizeLocal : undefined
      const audioRequest = localSynthesis
        ? prepareReferenceAudio(options?.referenceAudio).then((referenceAudio) => localSynthesis({
          requestId,
          endpoint,
          model: settings.model,
          voice: options?.voiceId ?? settings.voice,
          apiKey: settings.apiKey,
          text,
          ...(options?.caption ? { caption: options.caption } : {}),
          ...(options?.seed !== undefined ? { seed: options.seed } : {}),
          numSteps: IRODORI_STEPS[settings.irodoriQuality ?? "balanced"],
          ...(referenceAudio ? { referenceAudio } : {}),
        }))
          .then((audio) => new Blob([audio], { type: "audio/wav" }))
        : fetch(isElevenLabs
          ? `${endpoint}/text-to-speech/${encodeURIComponent(settings.voice.trim())}?output_format=mp3_44100_128`
          : `${endpoint}/audio/speech`, {
        method: "POST",
        headers: isElevenLabs
          ? { "xi-api-key": normalizeApiKey(settings.apiKey), "Content-Type": "application/json" }
          : {
              ...(normalizeApiKey(settings.apiKey) ? { Authorization: `Bearer ${normalizeApiKey(settings.apiKey)}` } : {}),
              "Content-Type": "application/json",
            },
        body: JSON.stringify(isElevenLabs
          ? { text, model_id: settings.model.trim(), language_code: "ja" }
          : { model: settings.model.trim(), input: text, voice: settings.voice.trim(), response_format: "mp3" }),
        signal: requestController.signal,
      }).then(async (response) => {
          if (!response.ok) throw new Error(`接続先からエラーが返りました（${response.status}）`)
          return response.blob()
        })
      void audioRequest.then((blob) => {
        if (active !== playback || requestController.signal.aborted) return
        playback.audioUrl = URL.createObjectURL(blob)
        playback.audio = new Audio(playback.audioUrl)
        playback.audio.onended = () => {
          if (active !== playback) return
          cleanup(playback)
          callbacks.onEnd?.()
        }
        playback.audio.onerror = () => fallback("受信した音声を再生できませんでした。")
        void playback.audio.play().catch(() => fallback("外部TTSの再生が制限されたため、ブラウザ標準音声に切り替えました。"))
      }).catch((error: unknown) => {
        if (requestController.signal.aborted) return
        const message = error instanceof TypeError
          ? isIrodori
            ? "Irodori TTSサーバーへ接続できませんでした。サーバーを起動してから、もう一度お試しください。"
            : `${isElevenLabs ? "ElevenLabs" : "外部TTS"}へ接続できませんでした。${isElevenLabs ? "通信状況を確認してください。" : "接続先のCORS設定を確認してください。"}`
          : error instanceof Error ? error.message : "外部TTSで読み上げられませんでした。"
        fallback(message)
      })
    },
    stop,
  }
}

export async function generateIrodoriVoiceCandidate(settings: TtsSettings, text: string, caption: string, seed: number) {
  const bridge = window.mikan?.tts
  if (!bridge) throw new Error("Irodori TTSはアプリ版で利用できます。")
  return bridge.synthesizeLocal({
    requestId: crypto.randomUUID(),
    endpoint: settings.endpoint,
    model: settings.model,
    voice: "none",
    apiKey: settings.apiKey,
    text,
    caption,
    seed,
    numSteps: IRODORI_STEPS[settings.irodoriQuality ?? "balanced"],
  })
}

export async function saveIrodoriVoiceCandidate(voiceId: string, audio: ArrayBuffer) {
  const register = window.mikan?.tts?.registerReference
  if (!register) throw new Error("アプリを再起動してから、もう一度お試しください。")
  await register({ voiceId, fileName: `${voiceId}.wav`, mimeType: "audio/wav", data: audio })
}

export async function deleteIrodoriVoiceCandidate(voiceId: string) {
  const remove = window.mikan?.tts?.deleteReference
  if (!remove) throw new Error("アプリを再起動してから、もう一度お試しください。")
  await remove(voiceId)
}

async function prepareReferenceAudio(reference: TtsSpeakOptions["referenceAudio"]) {
  if (!reference) return undefined
  const response = await fetch(reference.source)
  if (!response.ok) throw new Error("シナリオの参照音声を読み込めませんでした。")
  const mimeType = reference.fileName.toLowerCase().endsWith(".flac")
    ? "audio/flac" as const
    : reference.fileName.toLowerCase().endsWith(".mp3") ? "audio/mpeg" as const : "audio/wav" as const
  return { voiceId: reference.voiceId, fileName: reference.fileName, mimeType, data: await response.arrayBuffer() }
}

function isLoopbackEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]")
  } catch {
    return false
  }
}

type KokoroInstance = {
  speak: (text: string, voice: string) => Promise<{ toBlob: () => Blob }>
  loadJapaneseG2POnce?: () => Promise<unknown>
}

type KokoroBackend = "webgpu" | "wasm"
type KokoroModule = { KokoroJP: { load: (options: { japanese: unknown; device: KokoroBackend; dtype: "q8" }) => Promise<KokoroInstance> } }

let kokoroInstancePromise: Promise<KokoroInstance> | null = null
let kokoroJapaneseConfigPromise: Promise<{ dicArchiveUrl: string; voiceUrl: string; workerUrl: string }> | null = null

async function getKokoroJapaneseConfig() {
  if (!kokoroJapaneseConfigPromise) {
    kokoroJapaneseConfigPromise = (async () => {
      const cache = await caches.open(KOKORO_JAPANESE_CACHE)
      const [dictionary, voice] = await Promise.all(KOKORO_JAPANESE_ASSETS.map((url) => cache.match(url)))
      if (!dictionary || !voice) throw new Error("日本語音声データが見つかりません。")
      return {
        dicArchiveUrl: URL.createObjectURL(await dictionary.blob()),
        voiceUrl: URL.createObjectURL(await voice.blob()),
        workerUrl: `${KOKORO_ASSETS_URL}/browser/worker.js`,
      }
    })().catch((error) => {
      kokoroJapaneseConfigPromise = null
      throw error
    })
  }
  return kokoroJapaneseConfigPromise
}

function setKokoroBackend(backend: KokoroBackend) {
  try { window.localStorage.setItem(KOKORO_BACKEND_MARKER, backend) } catch { /* Storage is optional. */ }
  if (kokoroModelSnapshot.status === "ready") {
    setKokoroModelSnapshot({
      ...kokoroModelSnapshot,
      progress: { percent: 100, message: `ダウンロード済み・${backend === "webgpu" ? "WebGPU" : "WASM"}で動作` },
    })
  }
}

export async function chooseKokoroBackend(): Promise<KokoroBackend> {
  try {
    const saved = window.localStorage.getItem(KOKORO_BACKEND_MARKER)
    if (saved === "webgpu" || saved === "wasm") return saved
  } catch { /* Probe again when storage is unavailable. */ }

  const gpu = (navigator as Navigator & {
    gpu?: { requestAdapter: (options?: { powerPreference?: string }) => Promise<{
      requestDevice: () => Promise<{ queue: { submit: (commands: unknown[]) => void; onSubmittedWorkDone: () => Promise<void> } }>
    } | null> }
  }).gpu
  if (!gpu) return "wasm"
  try {
    const startedAt = performance.now()
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" })
    const device = await adapter?.requestDevice()
    if (!device) return "wasm"
    device.queue.submit([])
    await device.queue.onSubmittedWorkDone()
    return performance.now() - startedAt <= 1_500 ? "webgpu" : "wasm"
  } catch {
    return "wasm"
  }
}

async function loadKokoroForBackend(module: KokoroModule, japanese: unknown, backend: KokoroBackend): Promise<KokoroInstance> {
  const instance = await module.KokoroJP.load({ japanese, device: backend, dtype: "q8" })
  if (backend === "wasm") return instance
  return {
    loadJapaneseG2POnce: () => instance.loadJapaneseG2POnce?.() ?? Promise.resolve(),
    speak: async (text: string, voice: string): Promise<{ toBlob: () => Blob }> => {
      try {
        return await instance.speak(text, voice)
      } catch (error) {
        console.warn("Kokoro WebGPU failed; retrying with WASM", error)
        const fallback = loadKokoroForBackend(module, japanese, "wasm")
        kokoroInstancePromise = fallback
        const audio = await (await fallback).speak(text, voice)
        setKokoroBackend("wasm")
        return audio
      }
    },
  } satisfies KokoroInstance
}

async function loadKokoroInstance() {
  if (!kokoroInstancePromise) {
    kokoroInstancePromise = Promise.all([
      import(/* @vite-ignore */ KOKORO_MODULE_URL),
      getKokoroJapaneseConfig(),
    ])
      .then(async ([module, japanese]) => {
        const backend = await chooseKokoroBackend()
        try {
          const instance = await loadKokoroForBackend(module as KokoroModule, japanese, backend)
          setKokoroBackend(backend)
          return instance
        } catch (error) {
          if (backend !== "webgpu") throw error
          console.warn("Kokoro WebGPU initialization failed; using WASM", error)
          const instance = await loadKokoroForBackend(module as KokoroModule, japanese, "wasm")
          setKokoroBackend("wasm")
          return instance
        }
      })
      .catch((error) => {
        kokoroInstancePromise = null
        throw error
      })
  }
  return kokoroInstancePromise
}

function setKokoroModelMarker(downloaded: boolean) {
  try {
    if (downloaded) window.localStorage.setItem(KOKORO_MODEL_MARKER, "ready")
    else window.localStorage.removeItem(KOKORO_MODEL_MARKER)
  } catch {
    // Cache Storage remains the source of truth when localStorage is unavailable.
  }
}

function isKokoroModelUrl(url: string) {
  return url.includes(KOKORO_MODEL_ID)
}

function getKokoroVoiceUrl(voice: string) {
  return `${KOKORO_MODEL_BASE_URL}/voices/${voice}.bin`
}

let kokoroOperationQueue = Promise.resolve()

function withKokoroModelLock<T>(operation: () => Promise<T>): Promise<T> {
  if ("locks" in navigator) {
    return navigator.locks.request<Promise<T>>(KOKORO_MODEL_LOCK, operation).then((result) => result)
  }
  const result = kokoroOperationQueue.then(operation, operation)
  kokoroOperationQueue = result.then(() => undefined, () => undefined)
  return result
}

async function inspectKokoroModel(voice: string) {
  if (!("caches" in window)) return false
  try {
    const modelCache = await caches.open(KOKORO_MODEL_CACHE)
    const hasModelFiles = (await Promise.all(KOKORO_MODEL_FILES.map((url) => modelCache.match(url)))).every(Boolean)
    const voiceCache = await caches.open(KOKORO_VOICE_CACHE)
    const hasVoice = Boolean(await voiceCache.match(getKokoroVoiceUrl(voice)))
    const japaneseCache = await caches.open(KOKORO_JAPANESE_CACHE)
    const hasJapaneseAssets = (await Promise.all(KOKORO_JAPANESE_ASSETS.map((url) => japaneseCache.match(url)))).every(Boolean)
    const downloaded = hasModelFiles && hasVoice && hasJapaneseAssets
    return downloaded
  } catch {
    return false
  }
}

const kokoroDownloadPromises = new Map<string, Promise<void>>()
const kokoroCheckPromises = new Map<string, Promise<boolean>>()

export function isKokoroModelDownloaded(voice = KOKORO_TTS_SETTINGS.voice) {
  const downloadPromise = kokoroDownloadPromises.get(voice)
  if (downloadPromise) return downloadPromise.then(() => inspectKokoroModel(voice))
  if (!kokoroCheckPromises.has(voice)) {
    const promise = withKokoroModelLock(() => inspectKokoroModel(voice))
      .then((downloaded) => {
        setKokoroModelSnapshot({
          status: downloaded ? "ready" : "not-downloaded",
          progress: { percent: downloaded ? 100 : 0, message: downloaded ? "ダウンロード済み" : "未ダウンロード" },
          voice: downloaded ? voice : null,
        })
        return downloaded
      })
      .finally(() => {
        if (kokoroCheckPromises.get(voice) === promise) kokoroCheckPromises.delete(voice)
      })
    kokoroCheckPromises.set(voice, promise)
  }
  return kokoroCheckPromises.get(voice)!
}

export function downloadKokoroModel(
  voice: string,
  onProgress: (progress: KokoroDownloadProgress) => void,
  load: () => Promise<KokoroInstance> = loadKokoroInstance,
) {
  if (!kokoroDownloadPromises.has(voice)) {
    const promise = withKokoroModelLock(() => performKokoroModelDownload(voice, onProgress, load))
      .finally(() => {
        if (kokoroDownloadPromises.get(voice) === promise) kokoroDownloadPromises.delete(voice)
      })
    kokoroDownloadPromises.set(voice, promise)
  }
  return kokoroDownloadPromises.get(voice)!
}

async function cacheKokoroFile(
  cache: Cache,
  url: string,
  onProgress?: (loaded: number, total: number) => void,
) {
  if (await cache.match(url)) return false
  const response = await fetch(url)
  if (!response.ok) throw new Error(`音声データを取得できませんでした（${response.status}）`)
  if (!onProgress || !response.body) {
    await cache.put(url, response)
    return true
  }

  const total = Number(response.headers.get("content-length")) || 0
  const cacheWrite = cache.put(url, response.clone())
  const reader = response.body.getReader()
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    loaded += value.byteLength
    onProgress(loaded, total)
  }
  await cacheWrite
  return true
}

async function performKokoroModelDownload(
  voice: string,
  onProgress: (progress: KokoroDownloadProgress) => void,
  load: () => Promise<KokoroInstance>,
) {
  if (!("caches" in window)) throw new Error("このブラウザではモデルを保存できません。")
  const createdEntries: Array<{ cache: Cache; url: string }> = []
  const reportProgress = (progress: KokoroDownloadProgress) => {
    setKokoroModelSnapshot({ status: "downloading", progress, voice })
    onProgress(progress)
  }

  try {
    reportProgress({ percent: 0, message: "音声モデルを準備中…" })
    const modelCache = await caches.open(KOKORO_MODEL_CACHE)
    for (const fileUrl of KOKORO_MODEL_FILES) {
      const created = await cacheKokoroFile(modelCache, fileUrl, fileUrl.endsWith(".onnx") ? (loaded, total) => {
        reportProgress({
          percent: total ? Math.min(90, Math.round((loaded / total) * 90)) : null,
          message: "音声モデルをダウンロード中…",
        })
      } : undefined)
      if (created) createdEntries.push({ cache: modelCache, url: fileUrl })
    }

    reportProgress({ percent: 92, message: "日本語音声を準備中…" })
    const japaneseCache = await caches.open(KOKORO_JAPANESE_CACHE)
    for (const assetUrl of KOKORO_JAPANESE_ASSETS) {
      if (await cacheKokoroFile(japaneseCache, assetUrl)) createdEntries.push({ cache: japaneseCache, url: assetUrl })
    }

    reportProgress({ percent: 96, message: "声のデータを準備中…" })
    const voiceUrl = getKokoroVoiceUrl(voice)
    const voiceCache = await caches.open(KOKORO_VOICE_CACHE)
    if (await cacheKokoroFile(voiceCache, voiceUrl)) createdEntries.push({ cache: voiceCache, url: voiceUrl })

    const instance = await load()
    if (!instance.loadJapaneseG2POnce) throw new Error("日本語音声を準備できませんでした。")
    await instance.loadJapaneseG2POnce()
    if (!await inspectKokoroModel(voice)) throw new Error("モデルをブラウザへ保存できませんでした。空き容量を確認してください。")
    setKokoroModelMarker(true)
    reportProgress({ percent: 100, message: "ダウンロード済み" })
    setKokoroModelSnapshot({ status: "ready", progress: { percent: 100, message: "ダウンロード済み" }, voice })
  } catch (error) {
    kokoroInstancePromise = null
    setKokoroModelSnapshot({ status: "error", progress: { percent: 0, message: "ダウンロードに失敗しました" }, voice: null })
    await Promise.allSettled(createdEntries.map(({ cache, url }) => cache.delete(url)))
    throw error
  }
}

async function deleteKokoroModelFiles() {
  kokoroInstancePromise = null
  setKokoroModelMarker(false)
  try { window.localStorage.removeItem(KOKORO_BACKEND_MARKER) } catch { /* Storage is optional. */ }
  if (!("caches" in window)) return

  const modelCache = await caches.open(KOKORO_MODEL_CACHE)
  const requests = (await modelCache.keys()).filter((request) => isKokoroModelUrl(request.url))
  await Promise.all(requests.map((request) => modelCache.delete(request)))
  await Promise.all([caches.delete(KOKORO_VOICE_CACHE), caches.delete(KOKORO_JAPANESE_CACHE)])
}

export function deleteKokoroModel() {
  return withKokoroModelLock(async () => {
    setKokoroModelSnapshot({ status: "deleting", progress: { percent: null, message: "削除中…" }, voice: null })
    try {
      await stopAllKokoroSpeech()
      await deleteKokoroModelFiles()
      const deleted = !await inspectKokoroModel(KOKORO_TTS_SETTINGS.voice)
      if (!deleted) throw new Error("モデルを削除できませんでした。")
      setKokoroModelSnapshot({ status: "not-downloaded", progress: { percent: 0, message: "未ダウンロード" }, voice: null })
    } catch (error) {
      setKokoroModelSnapshot({ status: "error", progress: { percent: null, message: "削除に失敗しました" }, voice: null })
      throw error
    }
  })
}

const activeKokoroTasks = new Set<Promise<unknown>>()
const activeKokoroStops = new Set<() => void>()

async function stopAllKokoroSpeech() {
  for (const stop of [...activeKokoroStops]) stop()
  await Promise.allSettled([...activeKokoroTasks])
}

export function createKokoroTtsDriver(
  voice = "jf_alpha",
  load: () => Promise<KokoroInstance> = loadKokoroInstance,
  browserTts: TtsDriver = createBrowserTtsDriver(),
  isModelDownloaded: () => boolean = () => true,
): TtsDriver {
  const environmentSupported = typeof Audio !== "undefined"
    && typeof WebAssembly !== "undefined"
    && typeof DecompressionStream !== "undefined"
  let generation = 0
  let audio: HTMLAudioElement | null = null
  let audioUrl: string | null = null
  let activeStop: (() => void) | null = null

  const cleanup = () => {
    audio?.pause()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    audio = null
    audioUrl = null
    if (activeStop) activeKokoroStops.delete(activeStop)
    activeStop = null
  }

  const stop = () => {
    generation += 1
    cleanup()
    browserTts.stop()
  }

  return {
    label: "Kokoro（端末内）",
    get supported() {
      return environmentSupported && isModelDownloaded()
    },
    get unavailableReason() {
      return environmentSupported && !isModelDownloaded() ? "モデルをダウンロードしてください" : environmentSupported ? null : "このブラウザではKokoroを利用できません"
    },
    speak: (text, callbacks = {}) => {
      stop()
      const supported = environmentSupported && isModelDownloaded()
      if (!supported) {
        callbacks.onError?.(environmentSupported ? "Kokoroのモデルをダウンロードしてください。" : "このブラウザではKokoroを利用できません。")
        callbacks.onEnd?.()
        return
      }
      const currentGeneration = generation
      let settled = false
      activeStop = () => {
        stop()
        callbacks.onEnd?.()
      }
      activeKokoroStops.add(activeStop)
      const fallback = (error?: unknown) => {
        if (currentGeneration !== generation || settled) return
        settled = true
        if (error) console.error("Kokoro TTS failed", error)
        cleanup()
        callbacks.onError?.("Kokoroで読み上げられなかったため、ブラウザ標準音声に切り替えました。")
        if (browserTts.supported) browserTts.speak(text, { onEnd: callbacks.onEnd })
        else callbacks.onEnd?.()
      }
      const task = load()
        .then((tts) => currentGeneration === generation ? tts.speak(text, voice) : null)
        .then((result) => {
          if (!result || currentGeneration !== generation) return
          audioUrl = URL.createObjectURL(result.toBlob())
          audio = new Audio(audioUrl)
          audio.onended = () => {
            if (currentGeneration !== generation || settled) return
            settled = true
            cleanup()
            callbacks.onEnd?.()
          }
          audio.onerror = () => fallback()
          void audio.play().catch(fallback)
        })
        .catch(fallback)
        .finally(() => activeKokoroTasks.delete(task))
      activeKokoroTasks.add(task)
    },
    stop,
  }
}

function createBrowserTtsDriver(): TtsDriver {
  const supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
  return {
    label: "ブラウザ標準TTS",
    supported,
    unavailableReason: supported ? null : "この環境では利用できません",
    speak: (text, { onEnd, onError } = {}) => {
      if (!supported) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "ja-JP"
      utterance.onend = () => onEnd?.()
      utterance.onerror = () => {
        onError?.("ブラウザ標準TTSで読み上げられませんでした。")
        onEnd?.()
      }
      window.speechSynthesis.speak(utterance)
    },
    stop: () => window.speechSynthesis?.cancel(),
  }
}
