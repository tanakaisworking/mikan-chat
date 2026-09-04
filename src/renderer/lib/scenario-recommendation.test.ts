import { describe, expect, it } from "vitest"

import { rankScenarios, readScenarioRecommendation, type ScenarioRecommendation } from "@/lib/scenario-recommendation"

describe("scenario recommendation", () => {
  it("好きなジャンルを優先しつつ対象層と年齢でホームを並べる", () => {
    const scenarios: Array<{ id: string; tags: string[]; recommendation: ScenarioRecommendation }> = [
      { id: "friendship", tags: ["友情"], recommendation: { targetAudiences: ["all"], recommendedAge: { min: 20, max: 40 } } },
      { id: "bl-for-men", tags: ["BL"], recommendation: { targetAudiences: ["men"], recommendedAge: { min: 20, max: 35 } } },
      { id: "bl-for-women", tags: ["BL"], recommendation: { targetAudiences: ["women"], recommendedAge: { min: 40, max: 55 } } },
    ]

    expect(rankScenarios(scenarios, { gender: "man", birthYear: 2000, favoriteGenres: ["BL", "男女恋愛"] }, 2026).map(({ id }) => id))
      .toEqual(["bl-for-men", "bl-for-women", "friendship"])
  })

  it("同点とメタデータなしの順序を維持する", () => {
    const scenarios = [{ id: "first", tags: [] }, { id: "second", tags: [] }]
    expect(rankScenarios(scenarios, { gender: "prefer-not-to-say", birthYear: 2000, favoriteGenres: ["恋愛"] }, 2026).map(({ id }) => id))
      .toEqual(["first", "second"])
  })

  it("パックの推薦メタデータを検証して読み込む", () => {
    expect(readScenarioRecommendation({
      extensions: { "mikan.recommendation": { targetAudiences: ["women", "women"], recommendedAge: { min: 25, max: 39 } } },
    })).toEqual({ targetAudiences: ["women"], recommendedAge: { min: 25, max: 39 } })
    expect(readScenarioRecommendation({ extensions: { "mikan.recommendation": { targetAudiences: ["invalid"] } } })).toBeUndefined()
  })
})
