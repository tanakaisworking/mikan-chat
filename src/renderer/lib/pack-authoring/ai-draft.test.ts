import { describe, expect, it } from "vitest"

import { aiDraftToNewDraft, parseAiScenario } from "@/lib/pack-authoring/ai-draft"
import { createEmptyDraft } from "@/lib/pack-authoring/types"

const SAMPLE = [
  "## タイトル",
  "契約と指輪",
  "## あらすじ",
  "政略結婚の初夜の話。",
  "2文目。",
  "## 登場人物",
  "前置きは無視される",
  "### ルシアン",
  "- プロフィール: 29歳の公爵",
  "- 声の性別: 男性",
  "- 声の特徴: 落ち着いた、丁寧",
  "- 声の指示: 低くゆっくり",
  "### ミア",
  "- 快活な店主", "  - 声の性別: 女性",
  "## 導入",
  "- ナレーション: 夜の書斎。",
  "1. ルシアン：質問は一つだけ答えよう。",
  "- あなた: 何を確かめたい？",
  "## 前提",
  " premise本文 ",
  "## 指針",
  "特になし",
  "## タグ",
  "契約結婚、公爵",
  "## おまけ",
  "知らない見出しは無視される",
].join("\n")

describe("parseAiScenario", () => {
  it("形式どおりのMarkdownを下書き素案へ分解する", () => {
    const parsed = parseAiScenario(SAMPLE)
    expect(parsed.title).toBe("契約と指輪")
    expect(parsed.summary).toContain("2文目")
    expect(parsed.premise).toBe("premise本文")
    expect(parsed.instructions).toBe("")
    expect(parsed.tags).toBe("契約結婚、公爵")
    expect(parsed.characters).toHaveLength(2)
    expect(parsed.characters[0]).toMatchObject({ name: "ルシアン", gender: "male", traits: "落ち着いた、丁寧", caption: "低くゆっくり" })
    expect(parsed.characters[0]?.profile).toContain("29歳の公爵")
    expect(parsed.characters[1]).toMatchObject({ name: "ミア", gender: "female" })
    expect(parsed.opening).toEqual([
      { type: "narration", text: "夜の書斎。" },
      { type: "dialogue", speaker: "ルシアン", text: "質問は一つだけ答えよう。" },
      { type: "dialogue", speaker: "あなた", text: "何を確かめたい？" },
    ])
  })

  it("性別の表記ゆれを吸収する", () => {
    const parsed = parseAiScenario("## 登場人物\n### A\n- 声の性別: 中性的\n### B\n- 声の性別: 女\n### C\n- 声の性別: 不明")
    expect(parsed.characters.map((character) => character.gender)).toEqual(["neutral", "female", ""])
  })

  it("空でも落ちない", () => {
    expect(parseAiScenario("")).toEqual({ title: "", summary: "", premise: "", instructions: "", tags: "", characters: [], opening: [] })
    expect(parseAiScenario("ただの文章")).toEqual({ title: "", summary: "", premise: "", instructions: "", tags: "", characters: [], opening: [] })
  })

  it("未知の見出し以下は直前のセクションに混ぜない", () => {
    const parsed = parseAiScenario("## 導入\n- ナレーション: 夜。\n## メモ\n- 注意: これは無視\n## タイトル\nほげ")
    expect(parsed.opening).toEqual([{ type: "narration", text: "夜。" }])
    expect(parsed.title).toBe("ほげ")
  })

  it("人物名の末尾コロンを落とす", () => {
    const parsed = parseAiScenario("## 登場人物\n### ルシアン:\n- プロフィール: 公爵")
    expect(parsed.characters).toMatchObject([{ name: "ルシアン" }])
  })
})

describe("aiDraftToNewDraft", () => {
  it("話者名を採番IDへ結び直す", () => {
    const parsed = parseAiScenario(SAMPLE)
    const draft = aiDraftToNewDraft(parsed, createEmptyDraft())
    expect(draft.title).toBe("契約と指輪")
    expect(draft.characters.map((character) => character.id)).toEqual(["character1", "character2"])
    expect(draft.opening).toEqual([
      expect.objectContaining({ type: "narration" }),
      expect.objectContaining({ type: "dialogue", speaker: "character1" }),
      expect.objectContaining({ type: "dialogue", speaker: "user" }),
    ])
  })

  it("未知の話者名は残して検証に任せる", () => {
    const parsed = parseAiScenario("## 導入\n- 知らない人: やあ")
    const draft = aiDraftToNewDraft(parsed, createEmptyDraft())
    expect(draft.opening).toEqual([expect.objectContaining({ speaker: "知らない人" })])
  })
})
