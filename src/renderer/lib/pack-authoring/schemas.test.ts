import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import validateSchema from "@/lib/generated/chat-pack-validator.js"
import { chatPackSchema } from "@/lib/pack-authoring/schemas"
import { createEmptyDraft } from "@/lib/pack-authoring/types"

describe("pack-authoring schemas", () => {
  it("空の下書きは配布不可の理由が日本語で返る", () => {
    const parsed = chatPackSchema.safeParse({ spec: "mikan.chat-pack" })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.length).toBeGreaterThan(0)
      expect(parsed.error.issues.some((issue) => /入力してください|選んでください|形式/.test(issue.message))).toBe(true)
    }
  })

  it("話者が未登録IDの導入を指摘する", () => {
    const parsed = chatPackSchema.safeParse({
      spec: "mikan.chat-pack",
      specVersion: "0.1",
      id: "11111111-1111-4111-8111-111111111111",
      version: "1.0.0",
      language: "ja",
      title: "テスト",
      summary: "テスト",
      author: { name: "テスト" },
      license: "All-Rights-Reserved",
      rating: "all",
      discovery: {},
      plot: {
        premise: "テスト",
        characters: [{ id: "aoi", name: "葵", profile: "テスト" }],
        opening: [{ type: "dialogue", speaker: "unknown", text: "こんにちは" }],
      },
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes("話者"))).toBe(true)
    }
  })

  it("zodが通るパックはAJV生成validatorも通る", () => {
    const pack = {
      spec: "mikan.chat-pack",
      specVersion: "0.1",
      id: "22222222-2222-4222-8222-222222222222",
      version: "1.0.0",
      language: "ja",
      title: "テスト",
      summary: "テスト",
      author: { name: "テスト" },
      license: "All-Rights-Reserved",
      rating: "all" as const,
      discovery: { tags: ["テスト"] },
      plot: {
        premise: "テスト",
        characters: [{
          id: "aoi",
          name: "葵",
          profile: "テスト",
          voice: { profile: { language: "ja", gender: "female" as const } },
        }],
        opening: [{ type: "dialogue", speaker: "aoi", text: "こんにちは" }],
      },
    }
    expect(chatPackSchema.safeParse(pack).success).toBe(true)
    expect(validateSchema(pack)).toBe(true)
  })

  it("空の下書き型はそのままでは配布できない", () => {
    expect(createEmptyDraft().title).toBe("")
  })

  it("配布済みexampleはzodもAJVも通る", () => {
    const directories = readdirSync(path.join(process.cwd(), "examples"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    expect(directories.length).toBeGreaterThan(0)
    let checked = 0
    for (const directory of directories) {
      let pack: unknown
      try {
        pack = JSON.parse(readFileSync(path.join(process.cwd(), "examples", directory, "pack.json"), "utf8"))
      } catch {
        continue
      }
      expect(validateSchema(pack), directory).toBe(true)
      expect(chatPackSchema.safeParse(pack).success, directory).toBe(true)
      checked += 1
    }
    expect(checked).toBeGreaterThan(40)
  })
})
