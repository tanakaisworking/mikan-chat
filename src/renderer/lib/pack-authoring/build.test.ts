import { describe, expect, it } from "vitest"

import {
  exportPackBlob,
  importExportedPack,
  PackAuthoringError,
  sanitizeAssetName,
} from "@/lib/pack-authoring/build"
import { createEmptyDraft, type PackDraft } from "@/lib/pack-authoring/types"

const PIXEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

function validDraft(): PackDraft {
  const draft = createEmptyDraft()
  return {
    ...draft,
    title: "テストの物語",
    summary: "テスト用のあらすじ",
    authorName: "テスト作者",
    tags: "テスト、日常",
    premise: "テストの前提",
    instructions: "テストの指針",
    cover: { fileName: "cover.png", mimeType: "image/png", size: 70, dataUrl: PIXEL_PNG },
    characters: [{
      key: "c1",
      id: "aoi",
      name: "葵",
      profile: "テストの人物",
      image: { fileName: "aoi.png", mimeType: "image/png", size: 70, dataUrl: PIXEL_PNG },
      voice: { gender: "female", description: "", traits: "穏やか", caption: "穏やかな声", seed: "42", referenceAudio: null },
    }],
    opening: [{ key: "e1", type: "dialogue", speaker: "aoi", text: "こんにちは" }],
  }
}

const NO_BGM = { customUrl: null as string | null, volume: 20, enabled: true }

describe("pack-authoring build", () => {
  it("下書きから配布zipを作り、取り込み側で読み戻せる", async () => {
    const { blob, fileName } = await exportPackBlob(validDraft(), NO_BGM)
    expect(fileName).toMatch(/\.mikanchat$/)
    expect(blob.size).toBeGreaterThan(0)

    const loaded = await importExportedPack(blob, fileName)
    expect(loaded.pack.title).toBe("テストの物語")
    expect(loaded.pack.plot.characters).toHaveLength(1)
    expect(Object.keys(loaded.assets)).toHaveLength(2)
  })

  it("空の下書きは日本語の理由で失敗する", async () => {
    await expect(exportPackBlob(createEmptyDraft(), NO_BGM)).rejects.toThrow(PackAuthoringError)
    await expect(exportPackBlob(createEmptyDraft(), NO_BGM)).rejects.toThrow(/入力|追加|選んで/)
  })

  it("素材名を配布パスの形式に整える", () => {
    expect(sanitizeAssetName("カバー画像.PNG", "cover.webp")).toBe("cover.webp")
    expect(sanitizeAssetName("aoi portrait.png", "fallback.png")).toBe("aoi-portrait.png")
    expect(sanitizeAssetName("voice.wav", "fallback.wav")).toBe("voice.wav")
  })
})
