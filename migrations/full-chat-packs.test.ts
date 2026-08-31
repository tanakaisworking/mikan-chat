import { readFileSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { describe, expect, it } from "vitest"

import validateChatPack from "../src/renderer/lib/generated/chat-pack-validator.js"

const firstMigration = readFileSync(path.join(process.cwd(), "migrations/0001_scenarios.sql"), "utf8")
const fullPackMigration = readFileSync(path.join(process.cwd(), "migrations/0002_full_chat_packs.sql"), "utf8")

describe("full chat pack migration", () => {
  it("既存行を壊さず4件のフルパックを投入する", () => {
    const db = new DatabaseSync(":memory:")
    db.exec(firstMigration)
    db.exec("INSERT INTO scenarios (id, slug, title, character_name, summary, status) VALUES ('extra', 'extra', '追加シナリオ', '追加人物', '追加行', 'published')")
    db.exec(fullPackMigration)

    const rows = db.prepare("SELECT id, pack_json FROM scenarios ORDER BY sort_order, id").all() as Array<{ id: string; pack_json: string }>
    const seeded = rows.filter((row) => row.id !== "extra")
    expect(seeded).toHaveLength(4)
    expect(JSON.parse(rows.find((row) => row.id === "extra")!.pack_json)).toEqual({})

    for (const row of seeded) {
      const pack = JSON.parse(row.pack_json) as Record<string, unknown>
      expect(validateChatPack(pack), JSON.stringify(validateChatPack.errors)).toBe(true)
      expect(pack).toHaveProperty("licenseNotice")
      expect(pack).toHaveProperty("extensions")
      expect(pack).toHaveProperty("discovery.credits")
      expect(pack).toHaveProperty("discovery.authorComment")
      expect(pack).toHaveProperty("plot.instructions")
      expect(pack).toHaveProperty("plot.playerProfiles")
      expect(pack).toHaveProperty("plot.defaultPlayerProfile")
      expect(pack).toHaveProperty("plot.narrator")
      expect(pack).toHaveProperty("plot.situationExamples")
      expect(pack).toHaveProperty("plot.style")
      expect(pack).toHaveProperty("plot.settingBooks")
      expect(pack).toHaveProperty("plot.extensions")
    }

    const mia = JSON.parse(seeded.find((row) => row.id === "mia")!.pack_json) as { plot: { characters: unknown[] } }
    expect(mia.plot.characters).toHaveLength(2)
    db.close()
  })
})
