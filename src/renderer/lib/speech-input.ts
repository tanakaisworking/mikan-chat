export type SpeechInputStatus = "idle" | "starting" | "listening" | "unsupported" | "error"

type SpeechInputCallbacks = {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onStatus: (status: SpeechInputStatus) => void
  onError: (message: string) => void
}

export type SpeechInput = {
  start: () => Promise<void>
  stop: () => void
  dispose: () => void
}

export function createSpeechInput(callbacks: SpeechInputCallbacks): SpeechInput {
  return isDesktopApp() ? createHayamimiInput(callbacks) : createBrowserSpeechInput(callbacks)
}

export function isSpeechInputSupported() {
  return isDesktopApp()
    ? Boolean(getDesktopBridge()?.speech)
    : Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
}

function createBrowserSpeechInput(callbacks: SpeechInputCallbacks): SpeechInput {
  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!Recognition) {
    return {
      start: async () => {
        callbacks.onStatus("unsupported")
        callbacks.onError("このブラウザは音声入力に対応していません。")
      },
      stop: () => undefined,
      dispose: () => undefined,
    }
  }

  const recognition = new Recognition()
  let active = false
  recognition.lang = "ja-JP"
  recognition.continuous = false
  recognition.interimResults = true
  recognition.onstart = () => {
    if (active) callbacks.onStatus("listening")
  }
  recognition.onend = () => {
    if (!active) return
    active = false
    callbacks.onStatus("idle")
  }
  recognition.onerror = (event) => {
    if (!active) return
    active = false
    callbacks.onStatus("error")
    callbacks.onError(toSpeechErrorMessage(event.error))
  }
  recognition.onresult = (event) => {
    if (!active) return
    let interim = ""
    let final = ""
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      const text = result[0]?.transcript ?? ""
      if (result.isFinal) final += text
      else interim += text
    }
    if (interim) callbacks.onInterim(interim)
    if (final) callbacks.onFinal(final)
  }

  return {
    start: async () => {
      callbacks.onStatus("starting")
      active = true
      try {
        recognition.start()
      } catch (error) {
        active = false
        callbacks.onStatus("error")
        callbacks.onError(error instanceof Error ? error.message : "音声入力を開始できませんでした。")
      }
    },
    stop: () => {
      active = false
      recognition.stop()
      callbacks.onStatus("idle")
    },
    dispose: () => {
      active = false
      recognition.abort()
    },
  }
}

function createHayamimiInput(callbacks: SpeechInputCallbacks): SpeechInput {
  const bridge = getDesktopBridge()?.speech
  if (!bridge) {
    return {
      start: async () => {
        callbacks.onStatus("unsupported")
        callbacks.onError("このElectron版ではHayamimi連携を利用できません。")
      },
      stop: () => undefined,
      dispose: () => undefined,
    }
  }
  let stream: MediaStream | null = null
  let context: AudioContext | null = null
  let processor: ScriptProcessorNode | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let generation = 0
  let active = false
  let activeSessionId: string | null = null

  const cleanupAudio = () => {
    processor?.disconnect()
    source?.disconnect()
    stream?.getTracks().forEach((track) => track.stop())
    void context?.close()
    processor = null
    source = null
    stream = null
    context = null
  }

  const stop = () => {
    generation += 1
    active = false
    cleanupAudio()
    const sessionId = activeSessionId
    activeSessionId = null
    if (sessionId) void bridge.stop(sessionId)
    callbacks.onStatus("idle")
  }

  const unsubscribe = bridge.onEvent((sessionId, data) => {
    if (!active || sessionId !== activeSessionId) return
    let payload: unknown
    try {
      payload = JSON.parse(data)
    } catch {
      return
    }
    if (!isSpeechEvent(payload)) return
    if (payload.type === "partial") callbacks.onInterim(payload.text)
    if (payload.type === "final") callbacks.onFinal(payload.text)
    if (payload.type === "error" || payload.type === "closed") {
      active = false
      activeSessionId = null
      cleanupAudio()
      callbacks.onStatus("error")
      callbacks.onError(payload.message ?? "Hayamimiとの接続が終了しました。")
    }
  })

  return {
    start: async () => {
      const currentGeneration = ++generation
      const sessionId = crypto.randomUUID()
      activeSessionId = sessionId
      active = true
      callbacks.onStatus("starting")
      try {
        const nextStream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        })
        if (!active || generation !== currentGeneration) {
          nextStream.getTracks().forEach((track) => track.stop())
          return
        }
        stream = nextStream
        context = new AudioContext()
        source = context.createMediaStreamSource(stream)
        // ponytail: ScriptProcessor keeps the first Hayamimi integration small; move to AudioWorklet if UI load causes audio gaps.
        processor = context.createScriptProcessor(4096, 1, 1)
        await bridge.start(sessionId, context.sampleRate)
        if (!active || generation !== currentGeneration) {
          cleanupAudio()
          await bridge.stop(sessionId)
          return
        }
        source.connect(processor)
        processor.connect(context.destination)
        callbacks.onStatus("listening")
        processor.onaudioprocess = (event) => {
          if (!active || generation !== currentGeneration) return
          const input = event.inputBuffer.getChannelData(0)
          const pcm = new Int16Array(input.length)
          for (let index = 0; index < input.length; index += 1) {
            const sample = Math.max(-1, Math.min(1, input[index]))
            pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
          }
          bridge.send(sessionId, pcm.buffer)
        }
      } catch (error) {
        if (generation !== currentGeneration) return
        active = false
        activeSessionId = null
        cleanupAudio()
        void bridge.stop(sessionId)
        callbacks.onStatus("error")
        callbacks.onError(error instanceof Error ? error.message : "マイクを開始できませんでした。")
      }
    },
    stop,
    dispose: () => {
      stop()
      unsubscribe()
    },
  }
}

function toSpeechErrorMessage(error: string) {
  if (error === "not-allowed" || error === "service-not-allowed") return "マイクの使用が許可されていません。"
  if (error === "no-speech") return "音声を聞き取れませんでした。"
  if (error === "audio-capture") return "使用できるマイクが見つかりません。"
  if (error === "network") return "音声認識サービスへ接続できませんでした。"
  return "音声入力でエラーが発生しました。"
}

function isSpeechEvent(value: unknown): value is { type: "partial" | "final" | "error" | "closed"; text: string; message?: string } {
  if (value === null || typeof value !== "object" || !("type" in value)) return false
  if (value.type === "error" || value.type === "closed") return !("message" in value) || typeof value.message === "string"
  return (value.type === "partial" || value.type === "final") && "text" in value && typeof value.text === "string"
}
import { getDesktopBridge, isDesktopApp } from "@/lib/platform"
