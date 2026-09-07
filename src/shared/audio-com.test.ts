import { describe, expect, it, vi } from "vitest"

import { parseAudioComSource, resolveAudioComStreamUrl } from "./audio-com"

describe("audio.com source resolution", () => {
  it("数値IDと公開URLだけを受け付ける", () => {
    expect(parseAudioComSource("1793474640476011")).toEqual({ id: "1793474640476011", pageUrl: null })
    expect(parseAudioComSource("https://audio.com/embed/audio/1793474640476011")).toEqual({ id: "1793474640476011", pageUrl: null })
    expect(parseAudioComSource("https://audio.com/user/audio/track")).toEqual({ id: null, pageUrl: "https://audio.com/user/audio/track" })
    expect(parseAudioComSource("https://audio.com.evil.example/user/audio/track")).toBeNull()
    expect(parseAudioComSource("javascript:alert(1)")).toBeNull()
  })

  it("公開URLをoEmbed経由で解決し、mp3のストリームを選ぶ", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ html: '<iframe src="https://audio.com/embed/audio/1793474640476011?theme=image">' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        title: "Dark horse",
        transcodings: [{ format: "m4a", type: "audio/mp4", url: "https://s3.example/a.m4a" }, { format: "mp3", type: "audio/mpeg", url: "https://s3.example/a.mp3" }],
      }) })

    await expect(resolveAudioComStreamUrl("https://audio.com/user/audio/track", fetcher as unknown as typeof fetch))
      .resolves.toEqual({ streamUrl: "https://s3.example/a.mp3", title: "Dark horse" })
  })

  it("解決できない音源はエラーにする", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ transcodings: [] }) })
    await expect(resolveAudioComStreamUrl("1793474640476011", fetcher as unknown as typeof fetch)).rejects.toThrow("再生できる音源")
    await expect(resolveAudioComStreamUrl("https://evil.example/x", fetcher as unknown as typeof fetch)).rejects.toThrow("特定できません")
  })
})
