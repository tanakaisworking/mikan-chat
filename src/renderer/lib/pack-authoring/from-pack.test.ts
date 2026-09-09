import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

import { buildPackFiles, validateBuiltPack } from "@/lib/pack-authoring/build"
import { guessMimeType, packToDraft, packToDraftBgm } from "@/lib/pack-authoring/from-pack"
import { readBgmPreference } from "@/lib/audio-com"

const EXAMPLES = path.join(process.cwd(), "examples")

function examplePack(directory: string) {
  return JSON.parse(readFileSync(path.join(EXAMPLES, directory, "pack.json"), "utf8")) as Record<string, unknown>
}

async function exampleAsset(_url: string, fileName: string) {
  const local = path.join(EXAMPLES, "contract-honest-duke", "assets", fileName)
  const raw = readFileSync(local)
  const bytes = new Uint8Array(raw.byteLength)
  bytes.set(raw)
  const dataUrl = `data:${guessMimeType(fileName)};base64,${Buffer.from(bytes).toString("base64")}`
  return { bytes, mime: guessMimeType(fileName), dataUrl, size: bytes.byteLength }
}

describe("packToDraft", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it("配布パックを下書きに戻し、再配布できる", async () => {
    const pack = examplePack("contract-honest-duke")
    const cover = await exampleAsset("assets/cover-main.webp", "cover-main.webp")
    const draft = await packToDraft(pack, { "assets/cover-main.webp": cover.dataUrl }, async (url, fileName) => exampleAsset(url, fileName))

    expect(draft.title).toContain("愛さない")
    expect(draft.characters).toHaveLength(1)
    expect(draft.characters[0]).toMatchObject({ id: "lucien", name: "ルシアン・ヴァレール" })
    expect(draft.characters[0]?.voice.gender).toBe("male")
    expect(draft.opening).toHaveLength(2)
    expect(draft.cover?.fileName).toBe("cover-main.webp")

    const { pack: rebuilt, files } = await buildPackFiles(draft, { customUrl: null, volume: 20, enabled: true })
    expect(() => validateBuiltPack(rebuilt, files)).not.toThrow()
    expect((rebuilt.plot as { characters: unknown[] }).characters).toHaveLength(1)
    const original = examplePack("contract-honest-duke")
    const rebuiltPlot = rebuilt.plot as Record<string, unknown>
    const originalPlot = original.plot as Record<string, unknown>
    // 導入画像・声の数値・原文ブロックを引き継ぐ
    expect((rebuiltPlot.opening as Array<Record<string, unknown>>)[0]?.image).toMatch(/^assets\//)
    expect(((rebuiltPlot.characters as Array<Record<string, unknown>>)[0]?.voice as Record<string, unknown>).profile).toMatchObject({ gender: "male", speed: 0.92, pitch: -2 })
    expect(rebuilt.discovery).toMatchObject({ authorComment: (original.discovery as Record<string, unknown>).authorComment })
    expect(rebuiltPlot.playerProfiles).toEqual(originalPlot.playerProfiles)
    expect(rebuiltPlot.defaultPlayerProfile).toBe(originalPlot.defaultPlayerProfile)
    expect(rebuiltPlot.narrator).toEqual(originalPlot.narrator)
    expect(rebuiltPlot.style).toEqual(originalPlot.style)
  })

  it("BGM指定を復元する", async () => {
    expect(await packToDraftBgm({ extensions: {} }, {})).toBe(true)
    expect(readBgmPreference("authoring-draft")).toMatchObject({ customUrl: null, enabled: true })

    expect(await packToDraftBgm(
      { extensions: { "mikan.bgm": { provider: "audio.com", id: "123" } } },
      {},
    )).toBe(true)
    expect(readBgmPreference("authoring-draft")).toMatchObject({ customUrl: "123" })

    expect(await packToDraftBgm(
      { extensions: { "mikan.bgm": { provider: "audio.com", url: "https://audio.com/embed/audio/456" } } },
      {},
    )).toBe(true)
    expect(readBgmPreference("authoring-draft")).toMatchObject({ customUrl: "https://audio.com/embed/audio/456" })
  })
})
