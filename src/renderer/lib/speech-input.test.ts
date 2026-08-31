import { afterEach, describe, expect, it, vi } from "vitest"

import { createSpeechInput } from "@/lib/speech-input"

describe("browser speech input", () => {
  afterEach(() => {
    delete window.mikan
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
    vi.restoreAllMocks()
  })

  it("ブラウザ標準の認識結果を暫定・確定テキストへ渡す", async () => {
    const statuses: string[] = []
    const interim = vi.fn()
    const final = vi.fn()
    const instance = new FakeSpeechRecognition()
    window.SpeechRecognition = class {
      constructor() {
        return instance
      }
    } as unknown as typeof window.SpeechRecognition

    const input = createSpeechInput({
      onInterim: interim,
      onFinal: final,
      onStatus: (status) => statuses.push(status),
      onError: vi.fn(),
    })
    await input.start()
    instance.onresult?.({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: "聞き取り中" }], { isFinal: false }),
        Object.assign([{ transcript: "こんにちは" }], { isFinal: true }),
      ],
    } as unknown as SpeechRecognitionEventLike)

    expect(statuses).toEqual(["starting", "listening"])
    expect(interim).toHaveBeenCalledWith("聞き取り中")
    expect(final).toHaveBeenCalledWith("こんにちは")
  })

  it("停止後に遅れて届いた認識結果を破棄する", async () => {
    const final = vi.fn()
    const instance = new FakeSpeechRecognition()
    window.SpeechRecognition = class {
      constructor() {
        return instance
      }
    } as unknown as typeof window.SpeechRecognition
    const input = createSpeechInput({
      onInterim: vi.fn(),
      onFinal: final,
      onStatus: vi.fn(),
      onError: vi.fn(),
    })

    await input.start()
    input.stop()
    instance.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: "遅い結果" }], { isFinal: true })],
    } as unknown as SpeechRecognitionEventLike)

    expect(final).not.toHaveBeenCalled()
  })

  it("Hayamimiの開始待ちに停止した場合は取得済みマイクを破棄する", async () => {
    let resolveStream!: (stream: MediaStream) => void
    const trackStop = vi.fn()
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { resolveStream = resolve }))
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } })
    const speech = {
      start: vi.fn().mockResolvedValue(undefined),
      send: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      onEvent: vi.fn().mockReturnValue(vi.fn()),
    }
    window.mikan = { platform: "darwin", speech }
    const input = createSpeechInput({
      onInterim: vi.fn(),
      onFinal: vi.fn(),
      onStatus: vi.fn(),
      onError: vi.fn(),
    })

    const starting = input.start()
    input.stop()
    resolveStream({ getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream)
    await starting

    expect(trackStop).toHaveBeenCalledOnce()
    expect(speech.start).not.toHaveBeenCalled()
  })
})

class FakeSpeechRecognition implements SpeechRecognitionLike {
  lang = ""
  continuous = false
  interimResults = false
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null

  start() {
    this.onstart?.()
  }

  stop() {
    this.onend?.()
  }

  abort() {
    this.onend?.()
  }
}
