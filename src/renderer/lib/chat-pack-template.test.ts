import { describe, expect, it } from "vitest"

import { resolveChatPackText } from "@/lib/chat-pack-template"

describe("resolveChatPackText", () => {
  it("既定表示では『あなたさん』にしない", () => {
    expect(resolveChatPackText("{{user}}さん、こんばんは。{{user}}を待っていました。")).toBe("あなた、こんばんは。あなたを待っていました。")
  })

  it("役名を渡したときは敬称を付ける", () => {
    expect(resolveChatPackText("{{user}}さん、こんばんは。", "最後の客")).toBe("最後の客さん、こんばんは。")
  })
})
