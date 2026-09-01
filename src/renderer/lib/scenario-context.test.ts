import { describe, expect, it } from "vitest"

import type { Character } from "@/data/characters"
import { readScenarioContext } from "@/lib/scenario-context"

describe("readScenarioContext", () => {
  it("defaultPlayerProfileで指定された役を選ぶ", () => {
    const character: Character = {
      id: "story",
      name: "ミア",
      description: "{{user}}が酒場に残った夜。",
      lastMessage: "こんばんは。",
      lastActive: "",
      pack: {
        plot: {
          premise: "閉店後、{{user}}だけが酒場に残った。",
          characters: [{ id: "knight", name: "騎士", profile: "{{user}}を護衛する騎士。" }],
          playerProfiles: [
            { id: "guard", name: "護衛", description: "入口を守る。" },
            { id: "guest", name: "最後の客", description: "閉店まで残った。" },
          ],
          defaultPlayerProfile: "guest",
        },
      },
    }

    const context = readScenarioContext(character)
    expect(context.player).toEqual({ name: "最後の客", description: "閉店まで残った。" })
    expect(context.summary).toBe("最後の客が酒場に残った夜。")
    expect(context.premise).toBe("閉店後、最後の客だけが酒場に残った。")
    expect(context.characters[0]?.profile).toBe("最後の客を護衛する騎士。")
  })
})
