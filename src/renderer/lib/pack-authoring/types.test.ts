import { describe, expect, it } from "vitest"

import { assignCharacterId } from "@/lib/pack-authoring/types"

describe("assignCharacterId", () => {
  it("空き番号のcharacterNを振る", () => {
    expect(assignCharacterId([])).toBe("character1")
    expect(assignCharacterId([{ id: "lucien" }])).toBe("character1")
    expect(assignCharacterId([{ id: "character1" }, { id: "lucien" }])).toBe("character2")
    expect(assignCharacterId([{ id: "character1" }, { id: "character2" }])).toBe("character3")
  })

  it("削除済みの番号を再利用しない", () => {
    // character1を消した残りcharacter2だけでもcharacter3を振る。
    // さもないと削除済みへの古い話者指定が新人物にすり替わる。
    expect(assignCharacterId([{ id: "character2" }])).toBe("character3")
    expect(assignCharacterId([{ id: "  character4  " }])).toBe("character5")
  })
})
