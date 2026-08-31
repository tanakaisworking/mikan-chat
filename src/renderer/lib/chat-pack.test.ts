import { readFileSync } from "node:fs"
import path from "node:path"
import { zipSync, strToU8 } from "fflate"
import { describe, expect, it, vi } from "vitest"

import { ChatPackError, loadChatPack } from "@/lib/chat-pack"

const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
])

function createPackFile(pack: Record<string, unknown>, extraFiles: Record<string, Uint8Array> = {}) {
  return new File([
    zipSync({ "pack.json": strToU8(JSON.stringify(pack)), ...extraFiles }),
  ], "demo.mikanchat", { type: "application/vnd.mikan.chat+zip" })
}

function forgeDeclaredUncompressedSize(archive: Uint8Array, size: number) {
  const forged = archive.slice()
  const view = new DataView(forged.buffer)
  for (let offset = 0; offset <= forged.length - 28; offset += 1) {
    const signature = view.getUint32(offset, true)
    if (signature === 0x04034b50) view.setUint32(offset + 22, size, true)
    if (signature === 0x02014b50) view.setUint32(offset + 24, size, true)
  }
  return forged
}

function createPack(overrides: Record<string, unknown> = {}, extraFiles: Record<string, Uint8Array> = {}) {
  return createPackFile({
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
  }, { "assets/cover.webp": webp, "assets/aoi.webp": webp, ...extraFiles })
}

function readFixture(fixture: string) {
  return JSON.parse(readFileSync(path.join(process.cwd(), "examples/conformance", fixture), "utf8")) as Record<string, unknown>
}

describe("Chat Pack loader", () => {
  it("有効な.mikanchatを読み込み、画像をdata URLへ変換する", async () => {
    const loaded = await loadChatPack(createPack())

    expect(loaded.pack.title).toBe("雨の夜、閉店後の喫茶店で")
    expect(loaded.pack.plot.characters[0].name).toBe("葵")
    expect(loaded.assets["assets/aoi.webp"]).toMatch(/^data:image\/webp;base64,/)
  })

  it("画像なしの最小適合パックを読み込める", async () => {
    const loaded = await loadChatPack(createPackFile(readFixture("valid/minimal-text-only.json")))

    expect(loaded.pack.discovery.covers).toBeUndefined()
    expect(loaded.pack.plot.characters[0].image).toBeUndefined()
    expect(loaded.assets).toEqual({})
  })

  it("Schemaが許容するnil UUIDをパックIDとして読み込める", async () => {
    const base = readFixture("valid/minimal-text-only.json")
    const loaded = await loadChatPack(createPackFile({ ...base, id: "00000000-0000-0000-0000-000000000000" }))

    expect(loaded.pack.id).toBe("00000000-0000-0000-0000-000000000000")
  })

  it("未対応フィールドをrawに保持する", async () => {
    const extensions = { "com.example.tool": { value: true } }
    const loaded = await loadChatPack(createPack({ extensions }))

    expect(loaded.raw.extensions).toEqual(extensions)
  })

  it.each(["1.0.0-01", "1.0.0-alpha..1", "1.0.0-."])("不正なSemVer %s を拒否する", async (version) => {
    await expect(loadChatPack(createPack({ version }))).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message: "versionはSemantic Versioning形式にしてください。" }),
    )
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

  it("状況例にある存在しない話者を拒否する", async () => {
    const base = readFixture("valid/minimal-text-only.json")
    const plot = {
      ...(base.plot as Record<string, unknown>),
      situationExamples: [{ situation: "翌朝", events: [{ type: "dialogue", speaker: "ghost", text: "おはよう。" }] }],
    }

    await expect(loadChatPack(createPackFile({ ...base, plot }))).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message: "存在しない話者です: ghost" }),
    )
  })

  it("存在しない既定ユーザープロフィールを拒否する", async () => {
    const base = readFixture("valid/minimal-text-only.json")
    const plot = { ...(base.plot as Record<string, unknown>), defaultPlayerProfile: "missing" }

    await expect(loadChatPack(createPackFile({ ...base, plot }))).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message: "defaultPlayerProfileが存在しません: missing" }),
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

  it("参照されていない不正画像も拒否する", async () => {
    await expect(loadChatPack(createPack({}, { "assets/unused.webp": strToU8("not an image") }))).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message: "画像形式を確認できません: assets/unused.webp" }),
    )
  })

  it("申告サイズを偽装した圧縮データを展開中に停止する", async () => {
    const archive = zipSync({
      "pack.json": strToU8(JSON.stringify(readFixture("valid/minimal-text-only.json"))),
      "assets/bomb.webp": new Uint8Array(17 * 1024 * 1024),
    }, { level: 9 })
    const file = new File([forgeDeclaredUncompressedSize(archive, 1024)], "bomb.mikanchat")

    await expect(loadChatPack(file)).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message: "ファイルが大きすぎます: assets/bomb.webp" }),
    )
  })

  it("ユーザープロフィールが参照する不足画像を拒否する", async () => {
    const base = readFixture("valid/minimal-text-only.json")
    const plot = {
      ...(base.plot as Record<string, unknown>),
      playerProfiles: [{ id: "student", name: "生徒", description: "転校生。", image: "assets/player.webp" }],
    }

    await expect(loadChatPack(createPackFile({ ...base, plot }))).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message: "画像が見つかりません: assets/player.webp" }),
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

  it.each([
    ["invalid/non-semver.json", "versionはSemantic Versioning形式にしてください。"],
    ["invalid/unknown-speaker.json", "存在しない話者です: ghost"],
    ["invalid/unknown-rating.json", "ratingはall、r15、r18のいずれかにしてください。"],
  ])("不適合フィクスチャ %s を拒否する", async (fixture, message) => {
    await expect(loadChatPack(createPackFile(readFixture(fixture)))).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message }),
    )
  })

  it("README.mdを含むパックを拒否する", async () => {
    await expect(loadChatPack(createPack({}, { "README.md": strToU8("untrusted markdown") }))).rejects.toEqual(
      expect.objectContaining<Partial<ChatPackError>>({ message: "許可されていないファイルです: README.md" }),
    )
  })
})
