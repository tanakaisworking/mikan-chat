import { readFileSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { describe, expect, it } from "vitest"

import validateChatPack from "../src/renderer/lib/generated/chat-pack-validator.js"

const firstMigration = readFileSync(path.join(process.cwd(), "migrations/0001_scenarios.sql"), "utf8")
const fullPackMigration = readFileSync(path.join(process.cwd(), "migrations/0002_full_chat_packs.sql"), "utf8")
const maleScenariosMigration = readFileSync(path.join(process.cwd(), "migrations/0003_add_male_scenarios.sql"), "utf8")
const downerGirlMigration = readFileSync(path.join(process.cwd(), "migrations/0004_add_downer_girl_scenario.sql"), "utf8")
const researchedScenariosMigration = readFileSync(path.join(process.cwd(), "migrations/0005_add_researched_scenarios.sql"), "utf8")
const researchedScenariosBatchTwoMigration = readFileSync(path.join(process.cwd(), "migrations/0006_add_researched_scenarios_batch_two.sql"), "utf8")
const researchedScenariosBatchThreeMigration = readFileSync(path.join(process.cwd(), "migrations/0007_add_researched_scenarios_batch_three.sql"), "utf8")
const revisedOriginalScenariosMigration = readFileSync(path.join(process.cwd(), "migrations/0008_revise_original_scenarios.sql"), "utf8")
const researchedScenariosBatchFourMigration = readFileSync(path.join(process.cwd(), "migrations/0009_add_researched_scenarios_batch_four.sql"), "utf8")
const researchedScenariosBatchFiveMigration = readFileSync(path.join(process.cwd(), "migrations/0010_add_researched_scenarios_batch_five.sql"), "utf8")
const researchedScenariosBatchSixMigration = readFileSync(path.join(process.cwd(), "migrations/0011_add_researched_scenarios_batch_six.sql"), "utf8")
const researchedScenariosBatchSevenMigration = readFileSync(path.join(process.cwd(), "migrations/0012_add_researched_scenarios_batch_seven.sql"), "utf8")
const researchedScenariosBatchEightMigration = readFileSync(path.join(process.cwd(), "migrations/0013_add_researched_scenarios_batch_eight.sql"), "utf8")
const revisedEarlyScenariosMigration = readFileSync(path.join(process.cwd(), "migrations/0014_revise_early_scenarios.sql"), "utf8")
const researchedScenariosBatchNineMigration = readFileSync(path.join(process.cwd(), "migrations/0015_add_researched_scenarios_batch_nine.sql"), "utf8")
const researchedScenariosBatchTenMigration = readFileSync(path.join(process.cwd(), "migrations/0016_add_researched_scenarios_batch_ten.sql"), "utf8")
const revisedEarlyMaleScenariosMigration = readFileSync(path.join(process.cwd(), "migrations/0017_revise_early_male_scenarios.sql"), "utf8")
const researchedScenariosBatchElevenMigration = readFileSync(path.join(process.cwd(), "migrations/0018_add_researched_scenarios_batch_eleven.sql"), "utf8")
const rewrittenTitlesMigration = readFileSync(path.join(process.cwd(), "migrations/0019_rewrite_scenario_titles.sql"), "utf8")
const exBoyfriendMigration = readFileSync(path.join(process.cwd(), "migrations/0020_add_ex_boyfriend_wedding_scenario.sql"), "utf8")
const simplifiedExBoyfriendNameMigration = readFileSync(path.join(process.cwd(), "migrations/0021_simplify_ex_boyfriend_name.sql"), "utf8")
const uniquePublicIdsMigration = readFileSync(path.join(process.cwd(), "migrations/0022_require_unique_scenario_public_ids.sql"), "utf8")
const replacedPlaceholderPublicIdsMigration = readFileSync(path.join(process.cwd(), "migrations/0023_replace_placeholder_public_ids.sql"), "utf8")
const recommendationMetadataMigration = readFileSync(path.join(process.cwd(), "migrations/0024_add_recommendation_metadata.sql"), "utf8")
const recommendationVersionMigration = readFileSync(path.join(process.cwd(), "migrations/0025_bump_recommendation_pack_versions.sql"), "utf8")

describe("full chat pack migration", () => {
  it("既存行を壊さず54件のフルパックを投入する", () => {
    const db = new DatabaseSync(":memory:")
    db.exec(firstMigration)
    db.exec("INSERT INTO scenarios (id, slug, title, character_name, summary, status) VALUES ('extra', 'extra', '追加シナリオ', '追加人物', '追加行', 'published')")
    db.exec(fullPackMigration)
    db.exec(maleScenariosMigration)
    db.exec(downerGirlMigration)
    db.exec(researchedScenariosMigration)
    db.exec(researchedScenariosBatchTwoMigration)
    db.exec(researchedScenariosBatchThreeMigration)
    db.exec(revisedOriginalScenariosMigration)
    db.exec(researchedScenariosBatchFourMigration)
    db.exec(researchedScenariosBatchFiveMigration)
    db.exec(researchedScenariosBatchSixMigration)
    db.exec(researchedScenariosBatchSevenMigration)
    db.exec(researchedScenariosBatchEightMigration)
    db.exec(revisedEarlyScenariosMigration)
    db.exec(researchedScenariosBatchNineMigration)
    db.exec(researchedScenariosBatchTenMigration)
    db.exec(revisedEarlyMaleScenariosMigration)
    db.exec(researchedScenariosBatchElevenMigration)
    db.exec(rewrittenTitlesMigration)
    db.exec(exBoyfriendMigration)
    db.exec(simplifiedExBoyfriendNameMigration)
    db.exec(uniquePublicIdsMigration)
    db.exec(replacedPlaceholderPublicIdsMigration)
    db.exec(recommendationMetadataMigration)
    db.exec(`UPDATE scenarios SET pack_json = '{"version":"1.0.0","extensions":{"mikan.recommendation":{"targetAudiences":["all"],"recommendedAge":{"min":20,"max":40}}}}' WHERE id = 'extra'`)
    db.exec(recommendationVersionMigration)

    const rows = db.prepare("SELECT id, title, cover_path, rating, sort_order, pack_json FROM scenarios ORDER BY sort_order, id").all() as Array<{
      id: string
      title: string
      cover_path: string | null
      rating: string
      sort_order: number
      pack_json: string
    }>
    const seeded = rows.filter((row) => row.id !== "extra")
    expect(seeded).toHaveLength(54)
    expect(JSON.parse(rows.find((row) => row.id === "extra")!.pack_json)).toHaveProperty("version", "1.0.0")
    expect(new Set(seeded.map((row) => row.title))).toHaveLength(54)
    expect(new Set(seeded.map((row) => row.cover_path))).toHaveLength(54)
    expect(new Set(seeded.map((row) => row.sort_order))).toHaveLength(54)

    for (const row of seeded) {
      const pack = JSON.parse(row.pack_json) as Record<string, unknown>
      expect(validateChatPack(pack), JSON.stringify(validateChatPack.errors)).toBe(true)
      expect(pack.title).toBe(row.title)
      expect(row.cover_path).toMatch(/^\/scenario-covers\/[a-z0-9-]+\.webp$/)
      expect(row.rating).toBe("all")
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
      const recommendation = (pack.extensions as Record<string, unknown>)["mikan.recommendation"] as {
        targetAudiences: string[]
        recommendedAge: { min: number; max: number }
      }
      expect(recommendation.targetAudiences).toHaveLength(1)
      expect(["men", "women", "all"]).toContain(recommendation.targetAudiences[0])
      expect(recommendation.recommendedAge.min).toBeLessThanOrEqual(recommendation.recommendedAge.max)
    }

    const mia = JSON.parse(seeded.find((row) => row.id === "mia")!.pack_json) as { plot: { characters: unknown[] } }
    expect(mia.plot.characters).toHaveLength(2)
    const observatory = JSON.parse(seeded.find((row) => row.id === "satoru-ren")!.pack_json) as { plot: { characters: unknown[] } }
    expect(observatory.plot.characters).toHaveLength(2)
    const shizuku = JSON.parse(seeded.find((row) => row.id === "shizuku-downer")!.pack_json) as { plot: { characters: unknown[] } }
    expect(shizuku.plot.characters).toHaveLength(1)
    for (const id of ["lucien-contract", "kohaku-midnight", "tomoya-fake-date", "noah-voice-memory"]) {
      expect(JSON.parse(seeded.find((row) => row.id === id)!.pack_json).plot.characters).toHaveLength(1)
    }
    for (const id of ["cassian-rewind", "sumiko-rules", "vera-diner", "elias-dragons"]) {
      expect(JSON.parse(seeded.find((row) => row.id === id)!.pack_json).plot.characters).toHaveLength(1)
    }
    for (const id of ["shinkuro-road", "lionel-shutdown", "marta-socks", "seiji-memory"]) {
      expect(JSON.parse(seeded.find((row) => row.id === id)!.pack_json).plot.characters).toHaveLength(1)
    }
    expect(JSON.parse(seeded.find((row) => row.id === "aoi")!.pack_json).version).toBe("2.0.1")
    expect(JSON.parse(seeded.find((row) => row.id === "koharu")!.pack_json).version).toBe("2.0.1")
    expect(JSON.parse(seeded.find((row) => row.id === "mia")!.pack_json).version).toBe("2.0.1")
    expect(JSON.parse(seeded.find((row) => row.id === "rin")!.pack_json).version).toBe("2.0.1")
    for (const id of ["minato-radio", "satoru-ren", "yu", "ritsu"]) {
      expect(JSON.parse(seeded.find((row) => row.id === id)!.pack_json).version).toBe("2.0.1")
    }
    for (const id of ["maho-last-bout", "genmei-poison", "natsu-final-live", "rei-blue-bird"]) {
      expect(JSON.parse(seeded.find((row) => row.id === id)!.pack_json).plot.characters).toHaveLength(1)
    }
    for (const id of ["naoto-two-weeks", "ryo-alliance", "mina-offline", "nagi-radio"]) {
      expect(JSON.parse(seeded.find((row) => row.id === id)!.pack_json).plot.characters).toHaveLength(1)
    }
    for (const id of ["shuji-last-train", "fumie-family-tree", "saku-unscripted", "akari-foldroad"]) {
      expect(JSON.parse(seeded.find((row) => row.id === id)!.pack_json).plot.characters).toHaveLength(1)
    }
    for (const id of ["gald-career", "yayoi-extra-day", "sena-mars-flower", "lucas-nightmare"]) {
      expect(JSON.parse(seeded.find((row) => row.id === id)!.pack_json).plot.characters).toHaveLength(1)
    }
    for (const id of ["julius-handover", "someta-new-story", "saya-forecast", "margot-awake"]) {
      expect(JSON.parse(seeded.find((row) => row.id === id)!.pack_json).plot.characters).toHaveLength(1)
    }
    for (const id of ["kiryu-future-letter", "ritsuko-full-house", "ian-final-word", "hiyori-moon-store"]) {
      expect(JSON.parse(seeded.find((row) => row.id === id)!.pack_json).plot.characters).toHaveLength(1)
    }
    for (const id of ["sota-dragon-bath", "chifuyu-last-match", "genta-cold-well", "agnes-unordered-dish"]) {
      expect(JSON.parse(seeded.find((row) => row.id === id)!.pack_json).plot.characters).toHaveLength(1)
    }
    for (const id of ["haruto-jellyfish", "kei-imperfect-dish", "takumi-repaired-chair", "hibiki-rain-sound"]) {
      expect(JSON.parse(seeded.find((row) => row.id === id)!.pack_json).plot.characters).toHaveLength(1)
    }
    expect(JSON.parse(seeded.find((row) => row.id === "mia")!.pack_json).id).toBe("b1aa0948-3062-4f41-90c5-7fa451dec95f")
    expect(JSON.parse(seeded.find((row) => row.id === "rin")!.pack_json).id).toBe("69ad7d2d-c129-4cfe-a4b2-692a17fdc9bf")
    expect(JSON.parse(seeded.find((row) => row.id === "koharu")!.pack_json).id).toBe("cc1374b1-3147-4790-9e51-a0a3b4d01019")
    expect(() => db.prepare(
      "INSERT INTO scenarios (id, slug, title, character_name, summary, status, pack_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("duplicate-public-id", "duplicate-public-id", "重複", "重複", "重複", "published", seeded[0].pack_json)).toThrow(/UNIQUE/)
    db.close()
  })
})
