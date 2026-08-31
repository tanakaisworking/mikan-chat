import { zipSync, strToU8 } from "fflate"
import { describe, expect, it, vi } from "vitest"

import { ChatPackError, loadChatPack } from "@/lib/chat-pack"

const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
])

function createPack(overrides: Record<string, unknown> = {}, extraFiles: Record<string, Uint8Array> = {}) {
  const pack = {
    spec: "mikan.chat-pack",
    specVersion: "0.1",
    id: "5e17395e-79b0-4b46-8e55-4ddac9a8e787",
    version: "1.0.0",
    language: "ja",
    title: "雨の夜、閉店後の喫茶店で",
    summary: "秘密を抱えた常連客と二人きりになる。",
    author: { name: "mikan chat contributors" },
    license: "All-Rights-Reserved",
    rating: "all",
    discovery: { covers: ["assets/cover.webp"], tags: ["雨の夜"] },
    plot: {
      premise: "閉店後の喫茶店で葵と話す。",
      characters: [{ id: "aoi", name: "葵", profile: "物静かな常連客。", image: "assets/aoi.webp" }],
      opening: [
        { type: "narration", text: "扉のベルが鳴った。" },
        { type: "dialogue", speaker: "aoi", text: "こんばんは。" },
      ],
    },
    ...overrides,
  }
  return new File([
    zipSync({
      "pack.json": strToU8(JSON.stringify(pack)),
      "assets/cover.webp": webp,
      "assets/aoi.webp": webp,
      ...extraFiles,
    }),
  ], "demo.mikanchat", { type: "application/vnd.mikan.chat+zip" })
}

describe("Chat Pack loader", () => {
  it("有効な.mikanchatを読み込み、画像をdata URLへ変換する", async () => {
    const loaded = await loadChatPack(createPack())

    expect(loaded.pack.title).toBe("雨の夜、閉店後の喫茶店で")
    expect(loaded.pack.plot.characters[0].name).toBe("葵")
    expect(loaded.assets["assets/aoi.webp"]).toMatch(/^data:image\/webp;base64,/)
  })

  it("パック外へ出るZIPパスを拒否する", async () => {
    await expect(loadChatPack(createPack({}, { "../outside.txt": strToU8("unsafe") }))).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message: "パック外を参照するパスが含まれています。" }),
    )
  })

  it("存在しない話者を拒否する", async () => {
    const plot = {
      premise: "閉店後の喫茶店。",
      characters: [{ id: "aoi", name: "葵", profile: "物静かな常連客。", image: "assets/aoi.webp" }],
      opening: [{ type: "dialogue", speaker: "unknown", text: "こんばんは。" }],
    }

    await expect(loadChatPack(createPack({ plot }))).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message: "存在しない話者です: unknown" }),
    )
  })

  it("画面で使う任意項目の型崩れを拒否する", async () => {
    await expect(loadChatPack(createPack({ discovery: { covers: ["assets/cover.webp"], tags: "雨" } }))).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message: "discovery.tagsを確認してください。" }),
    )
  })

  it("デコードできない画像を拒否する", async () => {
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error("decode failed"))
    await expect(loadChatPack(createPack())).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message: expect.stringContaining("画像をデコードできない") }),
    )
  })

  it("4096pxを超える画像はデコード前に拒否する", async () => {
    const oversized = webp.slice()
    oversized[25] = 0x10
    const decoder = vi.mocked(createImageBitmap)
    decoder.mockClear()

    await expect(loadChatPack(createPack({}, { "assets/aoi.webp": oversized }))).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message: expect.stringContaining("4096pxの上限") }),
    )
    expect(decoder).toHaveBeenCalledTimes(1)
  })
})
