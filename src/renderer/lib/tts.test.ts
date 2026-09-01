import { afterEach, describe, expect, it, vi } from "vitest"

import { createTtsDriver } from "@/lib/tts"

describe("TTS driver", () => {
  afterEach(() => {
    delete window.mikan
    vi.unstubAllGlobals()
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
})
