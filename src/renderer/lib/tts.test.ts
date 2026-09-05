import { afterEach, describe, expect, it, vi } from "vitest"

import { chooseKokoroBackend, createKokoroTtsDriver, createTtsDriver, deleteKokoroModel, downloadKokoroModel, getKokoroAssetsUrl, getKokoroModelSnapshot, getTtsSettingsError, IRODORI_TTS_SETTINGS, isKokoroModelDownloaded, subscribeKokoroModel } from "@/lib/tts"

describe("TTS driver", () => {
  afterEach(() => {
    delete window.mikan
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Reflect.deleteProperty(URL, "createObjectURL")
    Reflect.deleteProperty(URL, "revokeObjectURL")
    Reflect.deleteProperty(navigator, "gpu")
  })

  it("KokoroはWebGPUを短時間で初期化できる端末ではWebGPUを選ぶ", async () => {
    window.localStorage.removeItem("mikan-chat.kokoro-backend.v1")
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: {
        requestAdapter: vi.fn(async () => ({
          requestDevice: vi.fn(async () => ({ queue: { submit: vi.fn(), onSubmittedWorkDone: vi.fn(async () => undefined) } })),
        })),
      },
    })
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(100)

    await expect(chooseKokoroBackend()).resolves.toBe("webgpu")
  })

  it("Electron製品版では同梱したKokoro資産をindex.html基準で読む", () => {
    expect(getKokoroAssetsUrl(new URL("file:///Applications/mikan-chat/out/renderer/index.html"))).toBe(
      "file:///Applications/mikan-chat/out/renderer/kokoro-js-jp",
    )
  })

  it("ブラウザ標準TTSを同じ再生・停止契約で駆動する", () => {
    class MockUtterance {
      lang = ""
      onend: (() => void) | null = null
      onerror: (() => void) | null = null

      constructor(readonly text: string) {}
    }
    const cancel = vi.fn()
    const speak = vi.fn()
    const onEnd = vi.fn()
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance)
    vi.stubGlobal("speechSynthesis", { cancel, speak })

    const driver = createTtsDriver()
    driver.speak("こんにちは。", { onEnd })

    expect(driver.supported).toBe(true)
    expect(driver.label).toBe("ブラウザ標準TTS")
    const utterance = speak.mock.calls[0][0] as MockUtterance
    expect(utterance.text).toBe("こんにちは。")
    expect(utterance.lang).toBe("ja-JP")
    utterance.onend?.()
    expect(onEnd).toHaveBeenCalledOnce()
    driver.stop()
    expect(cancel).toHaveBeenCalledTimes(2)
  })

  it("BYOKのOpenAI互換TTSから音声を取得して再生する", async () => {
    const pause = vi.fn()
    const play = vi.fn().mockResolvedValue(undefined)
    class MockAudio {
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      pause = pause
      play = play
    }
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:test") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
    vi.stubGlobal("Audio", MockAudio)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob(["audio"], { type: "audio/mpeg" }))))

    const driver = createTtsDriver({
      provider: "openai-compatible",
      apiKey: " test-key ",
      endpoint: "https://example.com/v1/",
      model: "voice-model",
      voice: "voice-a",
    })
    driver.speak("こんにちは。")

    await vi.waitFor(() => expect(play).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledWith("https://example.com/v1/audio/speech", expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer test-key", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "voice-model", input: "こんにちは。", voice: "voice-a", response_format: "mp3" }),
    }))
  })

  it("ElevenLabs BYOKでVoice IDを指定して日本語音声を取得する", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("Audio", class { onended = null; onerror = null; pause = vi.fn(); play = play })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob(["audio"], { type: "audio/mpeg" }))))
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:elevenlabs") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })

    const driver = createTtsDriver({
      provider: "elevenlabs",
      apiKey: " eleven-key ",
      endpoint: "https://malicious.example/v1",
      model: "eleven_flash_v2_5",
      voice: "voice/id",
    })
    driver.speak("こんにちは。")

    await vi.waitFor(() => expect(play).toHaveBeenCalledOnce())
    expect(driver.label).toBe("ElevenLabs")
    expect(fetch).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/text-to-speech/voice%2Fid?output_format=mp3_44100_128",
      expect.objectContaining({
        method: "POST",
        headers: { "xi-api-key": "eleven-key", "Content-Type": "application/json" },
        body: JSON.stringify({ text: "こんにちは。", model_id: "eleven_flash_v2_5", language_code: "ja" }),
      }),
    )
  })

  it("ElevenLabsへの接続失敗時はブラウザ標準TTSへ切り替える", async () => {
    const browserSpeak = vi.fn()
    const onEnd = vi.fn()
    vi.stubGlobal("SpeechSynthesisUtterance", class { lang = ""; onend = null; onerror = null; constructor(readonly text: string) {} })
    vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak: browserSpeak })
    vi.stubGlobal("Audio", class {})
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network error")))

    const driver = createTtsDriver({ provider: "elevenlabs", apiKey: "key", endpoint: "", model: "eleven_flash_v2_5", voice: "voice-jp" })
    driver.speak("こんにちは。", { onEnd })

    await vi.waitFor(() => expect(browserSpeak).toHaveBeenCalledOnce())
    const utterance = browserSpeak.mock.calls[0][0] as { onend: (() => void) | null }
    utterance.onend?.()
    expect(onEnd).toHaveBeenCalledOnce()
  })

  it("Kokoroで生成した音声をブラウザ内で再生する", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const speak = vi.fn().mockResolvedValue({ toBlob: () => new Blob(["wav"], { type: "audio/wav" }) })
    const audioInstances: Array<{ onended: (() => void) | null }> = []
    vi.stubGlobal("Audio", class {
      onended: (() => void) | null = null
      onerror = null
      pause = vi.fn()
      play = play
      constructor() { audioInstances.push(this) }
    })
    vi.stubGlobal("DecompressionStream", class {})
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:kokoro") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
    const onEnd = vi.fn()

    const driver = createKokoroTtsDriver("jf_alpha", async () => ({ speak }), {
      label: "fallback",
      supported: true,
      unavailableReason: null,
      speak: vi.fn(),
      stop: vi.fn(),
    })
    driver.speak("こんにちは。", { onEnd })

    await vi.waitFor(() => expect(play).toHaveBeenCalledOnce())
    expect(driver.label).toBe("Kokoro（端末内）")
    expect(speak).toHaveBeenCalledWith("こんにちは。", "jf_alpha")
    audioInstances[0]?.onended?.()
    expect(onEnd).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:kokoro")
  })

  it("Kokoroの再生失敗時にブラウザ標準TTSへ一度だけ切り替える", async () => {
    const fallbackSpeak = vi.fn()
    vi.stubGlobal("DecompressionStream", class {})
    vi.stubGlobal("Audio", class {
      onended = null
      onerror: (() => void) | null = null
      pause = vi.fn()
      play = vi.fn(() => {
        this.onerror?.()
        return Promise.reject(new Error("play failed"))
      })
    })
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:kokoro") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
    const onError = vi.fn()
    const driver = createKokoroTtsDriver("jf_alpha", async () => ({
      speak: vi.fn().mockResolvedValue({ toBlob: () => new Blob(["wav"]) }),
    }), {
      label: "fallback",
      supported: true,
      unavailableReason: null,
      speak: fallbackSpeak,
      stop: vi.fn(),
    })

    driver.speak("こんにちは。", { onError })

    await vi.waitFor(() => expect(fallbackSpeak).toHaveBeenCalledOnce())
    expect(onError).toHaveBeenCalledOnce()
  })

  it("Kokoroの準備中に停止した場合は遅れて音声を再生しない", async () => {
    const speak = vi.fn().mockResolvedValue({ toBlob: () => new Blob() })
    let resolveLoad!: (value: { speak: typeof speak }) => void
    const loadPromise = new Promise<{ speak: typeof speak }>((resolve) => { resolveLoad = resolve })
    vi.stubGlobal("DecompressionStream", class {})
    vi.stubGlobal("Audio", class {})
    const driver = createKokoroTtsDriver("jf_alpha", () => loadPromise, {
      label: "fallback",
      supported: true,
      unavailableReason: null,
      speak: vi.fn(),
      stop: vi.fn(),
    })

    driver.speak("停止する文章")
    driver.stop()
    resolveLoad({ speak })
    await Promise.resolve()
    await Promise.resolve()

    expect(speak).not.toHaveBeenCalled()
  })

  it("Kokoroモデルの保存状態を確認し、関連キャッシュだけ削除する", async () => {
    const unrelatedModelRequest = new Request("https://huggingface.co/another-model/resolve/main/model.onnx")
    let modelRequests = [
      new Request("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/config.json"),
      new Request("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx"),
      new Request("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer.json"),
      new Request("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer_config.json"),
      unrelatedModelRequest,
    ]
    const deleteModelEntry = vi.fn(async (request: Request) => {
      modelRequests = modelRequests.filter((item) => item.url !== request.url)
      return true
    })
    const modelCache = {
      keys: vi.fn(() => Promise.resolve(modelRequests)),
      match: vi.fn((url: string) => Promise.resolve(modelRequests.find((request) => request.url === url) ? new Response("model") : undefined)),
      delete: deleteModelEntry,
    }
    let supplementalCachesDeleted = false
    const voiceCache = {
      match: vi.fn(() => Promise.resolve(supplementalCachesDeleted ? undefined : new Response("voice"))),
    }
    const japaneseCache = { match: vi.fn(() => Promise.resolve(supplementalCachesDeleted ? undefined : new Response("asset"))) }
    const deleteCache = vi.fn(async () => {
      supplementalCachesDeleted = true
      return true
    })
    vi.stubGlobal("caches", {
      open: vi.fn((name: string) => Promise.resolve(name === "transformers-cache" ? modelCache : name === "kokoro-voices" ? voiceCache : japaneseCache)),
      delete: deleteCache,
    })

    expect(await isKokoroModelDownloaded()).toBe(true)
    await deleteKokoroModel()

    expect(deleteModelEntry).toHaveBeenCalledTimes(4)
    expect(deleteModelEntry).not.toHaveBeenCalledWith(unrelatedModelRequest)
    expect(modelRequests).toContain(unrelatedModelRequest)
    expect(deleteCache).toHaveBeenCalledWith("kokoro-voices")
    expect(deleteCache).toHaveBeenCalledWith("mikan-chat-kokoro-japanese-v1")
  })

  it("Kokoroは選択中の声と日本語アセットが揃った場合だけ使用可能にする", async () => {
    const modelCache = {
      keys: vi.fn().mockResolvedValue([
        new Request("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/config.json"),
        new Request("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx"),
        new Request("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer.json"),
        new Request("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer_config.json"),
      ]),
      match: vi.fn().mockResolvedValue(new Response("model")),
    }
    const voiceCache = { match: vi.fn((url: string) => Promise.resolve(url.endsWith("/jf_alpha.bin") ? new Response("voice") : undefined)) }
    const japaneseCache = { match: vi.fn().mockResolvedValue(new Response("asset")) }
    vi.stubGlobal("caches", {
      open: vi.fn((name: string) => Promise.resolve(name === "transformers-cache" ? modelCache : name === "kokoro-voices" ? voiceCache : japaneseCache)),
    })

    expect(await isKokoroModelDownloaded("jf_alpha")).toBe(true)
    expect(await isKokoroModelDownloaded("jm_kumo")).toBe(false)
  })

  it("Kokoroの必須ファイルが欠けている場合は取得済みにしない", async () => {
    const modelCache = { match: vi.fn((url: string) => Promise.resolve(url.endsWith("config.json") ? undefined : new Response("model"))) }
    const voiceCache = { match: vi.fn().mockResolvedValue(new Response("voice")) }
    const japaneseCache = { match: vi.fn().mockResolvedValue(new Response("asset")) }
    vi.stubGlobal("caches", {
      open: vi.fn((name: string) => Promise.resolve(name === "transformers-cache" ? modelCache : name === "kokoro-voices" ? voiceCache : japaneseCache)),
    })

    expect(await isKokoroModelDownloaded("jf_alpha")).toBe(false)
  })

  it("別タブから削除通知を受けるとKokoroを即時に無効化する", async () => {
    const modelCache = { match: vi.fn().mockResolvedValue(new Response("model")) }
    const voiceCache = { match: vi.fn().mockResolvedValue(new Response("voice")) }
    const japaneseCache = { match: vi.fn().mockResolvedValue(new Response("asset")) }
    vi.stubGlobal("caches", {
      open: vi.fn((name: string) => Promise.resolve(name === "transformers-cache" ? modelCache : name === "kokoro-voices" ? voiceCache : japaneseCache)),
    })
    const unsubscribe = subscribeKokoroModel(() => undefined)
    expect(await isKokoroModelDownloaded("jf_alpha")).toBe(true)

    window.dispatchEvent(new StorageEvent("storage", { key: "mikan-chat.kokoro-model.v1", newValue: null }))

    expect(getKokoroModelSnapshot().status).toBe("not-downloaded")
    unsubscribe()
  })

  it("専用操作から必須データを保存して進捗を完了する", async () => {
    const stores = new Map<string, Map<string, Response>>()
    const cacheFor = (name: string) => {
      const store = stores.get(name) ?? new Map<string, Response>()
      stores.set(name, store)
      return {
        match: (url: string) => Promise.resolve(store.get(url)?.clone()),
        put: async (url: string, response: Response) => { store.set(url, response.clone()) },
        keys: async () => [...store.keys()].map((url) => new Request(url)),
        delete: async (request: Request) => store.delete(request.url),
      }
    }
    vi.stubGlobal("caches", {
      open: vi.fn((name: string) => Promise.resolve(cacheFor(name))),
      delete: vi.fn(async (name: string) => stores.delete(name)),
    })
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-length": "3" },
    })))
    const loadJapaneseG2POnce = vi.fn().mockResolvedValue(undefined)
    const progress = vi.fn()

    await downloadKokoroModel("jf_alpha", progress, async () => ({ speak: vi.fn(), loadJapaneseG2POnce }))

    expect(progress).toHaveBeenLastCalledWith({ percent: 100, message: "ダウンロード済み" })
    expect(loadJapaneseG2POnce).toHaveBeenCalledOnce()
    expect(await isKokoroModelDownloaded("jf_alpha")).toBe(true)
    await deleteKokoroModel()
  })

  it("Kokoroモデル未取得時は会話から自動ダウンロードしない", () => {
    window.localStorage.removeItem("mikan-chat.kokoro-model.v1")
    vi.stubGlobal("Audio", class {})
    vi.stubGlobal("DecompressionStream", class {})

    const driver = createTtsDriver({ provider: "kokoro", apiKey: "", endpoint: "", model: "Kokoro-82M", voice: "jf_alpha" })

    expect(driver.supported).toBe(false)
    expect(driver.unavailableReason).toBe("モデルをダウンロードしてください")
  })

  it("Kokoro driverは生成後もモデルの追加と削除を反映する", () => {
    let downloaded = false
    const load = vi.fn()
    vi.stubGlobal("Audio", class {})
    vi.stubGlobal("DecompressionStream", class {})
    const driver = createKokoroTtsDriver("jf_alpha", load, {
      label: "fallback",
      supported: true,
      unavailableReason: null,
      speak: vi.fn(),
      stop: vi.fn(),
    }, () => downloaded)

    driver.speak("未取得")
    expect(driver.supported).toBe(false)
    expect(load).not.toHaveBeenCalled()

    downloaded = true
    expect(driver.supported).toBe(true)

    downloaded = false
    driver.speak("削除後")
    expect(driver.supported).toBe(false)
    expect(load).not.toHaveBeenCalled()
  })

  it("外部TTSの必須設定を検証する", () => {
    expect(getTtsSettingsError({ provider: "openai-compatible", apiKey: "", endpoint: "https://example.com/v1", model: "model", voice: "voice" })).toBe("APIキーを入力してください。")
  })

  it("Irodori TTSはローカルサーバーへAPIキーなしで接続できる", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const synthesizeLocal = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
    const cancelLocal = vi.fn()
    window.mikan = { platform: "darwin", tts: { synthesizeLocal, cancelLocal } }
    vi.stubGlobal("Audio", class { onended = null; onerror = null; pause = vi.fn(); play = play })
    vi.stubGlobal("fetch", vi.fn())
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:irodori") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })

    expect(getTtsSettingsError(IRODORI_TTS_SETTINGS)).toBeNull()
    const driver = createTtsDriver(IRODORI_TTS_SETTINGS, { supported: true, state: "running", progress: 100, stage: "利用できます" })
    driver.speak("こんにちは。")

    await vi.waitFor(() => expect(play).toHaveBeenCalledOnce())
    expect(driver.label).toBe("Irodori TTS")
    expect(synthesizeLocal).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "http://127.0.0.1:8088/v1", model: "irodori-tts", voice: "none", apiKey: "", text: "こんにちは。", numSteps: 32 }))
    expect(fetch).not.toHaveBeenCalled()
    driver.stop()
    expect(cancelLocal).toHaveBeenCalledOnce()
  })

  it("Irodoriへシナリオの参照音声と推奨値を渡す", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const synthesizeLocal = vi.fn().mockResolvedValue(new Uint8Array([1]).buffer)
    window.mikan = { platform: "darwin", tts: { synthesizeLocal, cancelLocal: vi.fn() } }
    vi.stubGlobal("Audio", class { onended = null; onerror = null; pause = vi.fn(); play = play })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 })))
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:irodori") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })

    const driver = createTtsDriver(IRODORI_TTS_SETTINGS, { supported: true, state: "running", progress: 100, stage: "利用できます" })
    driver.speak("こんにちは。", {}, {
      caption: "落ち着いた声",
      seed: 42,
      referenceAudio: { source: "data:audio/wav;base64,UklGRg==", voiceId: "mikan-aoi", fileName: "aoi.wav" },
    })

    await vi.waitFor(() => expect(synthesizeLocal).toHaveBeenCalledOnce())
    expect(synthesizeLocal).toHaveBeenCalledWith(expect.objectContaining({
      caption: "落ち着いた声",
      seed: 42,
      numSteps: 32,
      referenceAudio: expect.objectContaining({ voiceId: "mikan-aoi", fileName: "aoi.wav", mimeType: "audio/wav", data: expect.any(ArrayBuffer) }),
    }))
  })

  it("同じモデル名の手動ローカルTTSを内蔵Irodoriと誤認しない", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const synthesizeLocal = vi.fn()
    window.mikan = { platform: "darwin", tts: { synthesizeLocal, cancelLocal: vi.fn() } }
    vi.stubGlobal("Audio", class { onended = null; onerror = null; pause = vi.fn(); play = play })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob(["audio"]))))
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:manual") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })

    const driver = createTtsDriver({
      provider: "openai-compatible",
      apiKey: "manual-key",
      endpoint: "http://127.0.0.1:5000/v1",
      model: "irodori-tts",
      voice: "none",
    })
    driver.speak("手動サーバー")

    await vi.waitFor(() => expect(play).toHaveBeenCalledOnce())
    expect(driver.label).toBe("外部TTS")
    expect(synthesizeLocal).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:5000/v1/audio/speech", expect.anything())
  })

  it("未起動の内蔵Irodoriをブラウザ標準音声へ切り替えない", async () => {
    const browserSpeak = vi.fn()
    window.mikan = { platform: "darwin", tts: { synthesizeLocal: vi.fn().mockRejectedValue(new Error("セットアップ中")), cancelLocal: vi.fn() } }
    vi.stubGlobal("SpeechSynthesisUtterance", class {})
    vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak: browserSpeak })
    vi.stubGlobal("Audio", class {})
    const onError = vi.fn()

    createTtsDriver(IRODORI_TTS_SETTINGS, { supported: true, state: "running", progress: 100, stage: "利用できます" }).speak("こんにちは。", { onError })

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("セットアップ中"))
    expect(browserSpeak).not.toHaveBeenCalled()
  })

  it("未導入のIrodoriを再生可能として扱わない", () => {
    vi.stubGlobal("Audio", class {})
    const driver = createTtsDriver(IRODORI_TTS_SETTINGS, { supported: true, state: "missing", progress: 0, stage: "セットアップが必要です" })

    expect(driver.supported).toBe(false)
    expect(driver.unavailableReason).toBe("セットアップが必要です")
  })

  it("新しい読み上げ開始後に古い応答が到着しても再生を上書きしない", async () => {
    const responses: Array<(response: Response) => void> = []
    const play = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => responses.push(resolve))))
    vi.stubGlobal("Audio", class { onended = null; onerror = null; pause = vi.fn(); play = play })
    vi.stubGlobal("SpeechSynthesisUtterance", class {})
    vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak: vi.fn() })
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:test") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })

    const driver = createTtsDriver({ provider: "openai-compatible", apiKey: "key", endpoint: "https://example.com/v1", model: "model", voice: "voice" })
    driver.speak("古い文章")
    driver.speak("新しい文章")
    responses[1](new Response(new Blob(["new"])))
    await vi.waitFor(() => expect(play).toHaveBeenCalledOnce())
    responses[0](new Response(new Blob(["old"])))
    await Promise.resolve()
    await Promise.resolve()

    expect(play).toHaveBeenCalledOnce()
  })
})
