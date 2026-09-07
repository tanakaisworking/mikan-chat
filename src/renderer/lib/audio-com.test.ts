import { describe, expect, it } from "vitest"

import { getAudioComId, getScenarioAudioComSource, getScenarioBgmAudioPath } from "@/lib/audio-com"
import { BUNDLED_BGM_TRACKS, DEFAULT_BGM_FILE, isBundledBgmFile } from "../../shared/audio-com"

describe("audio.com BGM source", () => {
  it("公開ページURLと数値IDだけを受け付ける", () => {
    expect(getAudioComId("1793474640476011")).toBe("1793474640476011")
    expect(getAudioComId("https://audio.com/embed/audio/1793474640476011")).toBe("1793474640476011")
    expect(getAudioComId("https://audio.com/kalinenkoavramov/audio/dark-horse-nightcore"))
      .toBe("https://audio.com/kalinenkoavramov/audio/dark-horse-nightcore")
    expect(getAudioComId("https://audio.com.evil.example/x/audio/y")).toBeNull()
    expect(getAudioComId("javascript:alert(1)")).toBeNull()
    expect(getAudioComId("https://audio.com/kalinenkoavramov")).toBeNull()
  })

  it("パックのmikan.bgm拡張からaudio.comの音源を読む", () => {
    expect(getScenarioAudioComSource({ extensions: { "mikan.bgm": { provider: "audio.com", id: "1793474640476011" } } }))
      .toBe("1793474640476011")
    expect(getScenarioAudioComSource({ extensions: { "mikan.bgm": { provider: "other", id: "1793474640476011" } } })).toBeNull()
  })

  it("パック同梱のBGM音源パスを読む", () => {
    expect(getScenarioBgmAudioPath({ extensions: { "mikan.bgm": { audio: "assets/bgm.m4a", loop: true } } }))
      .toBe("assets/bgm.m4a")
    expect(getScenarioBgmAudioPath({ extensions: { "mikan.bgm": { provider: "audio.com", id: "1" } } })).toBeNull()
    expect(getScenarioBgmAudioPath({ extensions: { "mikan.bgm": { audio: "https://evil.example/bgm.m4a" } } })).toBeNull()
    expect(getScenarioBgmAudioPath({})).toBeNull()
  })

  it("同梱BGMは7曲でかまタマゴのクレジットを持つ", () => {
    expect(BUNDLED_BGM_TRACKS).toHaveLength(7)
    expect(DEFAULT_BGM_FILE).toBe("/bgm/kamatamago_B00025_jikosyoukai.m4a")
    for (const track of BUNDLED_BGM_TRACKS) {
      expect(track.file.startsWith("/bgm/")).toBe(true)
      expect(track.credit).toBe("かまタマゴ")
      expect(isBundledBgmFile(track.file)).toBe(true)
    }
    expect(isBundledBgmFile("/bgm/unknown.m4a")).toBe(false)
    expect(isBundledBgmFile("https://audio.com/embed/audio/1")).toBe(false)
  })
})
