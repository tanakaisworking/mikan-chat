import { describe, expect, it } from "vitest"

import worker, { toScenarioSummary } from "./index"

const row = {
  id: "scenario",
  slug: "scenario",
  title: "シナリオ",
  character_name: "みかん",
  summary: "概要",
  cover_path: null,
  rating: "all" as const,
  display_json: "null",
  pack_json: "{}",
}

describe("scenario API mapping", () => {
  it("不正な補助値を既定値へ戻す", () => {
    expect(toScenarioSummary(row)).toMatchObject({
      tags: [],
      conversationLabel: "1人と会話",
      lastMessage: "概要",
      lastActive: "",
    })

    expect(toScenarioSummary({
      ...row,
      display_json: '{"tags":["日常",1],"conversationLabel":1}',
    })).toMatchObject({ tags: [], conversationLabel: "1人と会話" })
  })

  it("フルパックから複数話者と導入を反映する", () => {
    const result = toScenarioSummary({
      ...row,
      pack_json: JSON.stringify({
        spec: "mikan.chat-pack",
        specVersion: "0.1",
        id: "55555555-5555-4555-8555-555555555555",
        version: "1.0.0",
        language: "ja",
        title: "二人からの依頼",
        summary: "二人から依頼される。",
        author: { name: "test" },
        license: "CC0-1.0",
        rating: "all",
        discovery: { tags: ["冒険"], description: "二人と話すシナリオ。" },
        plot: {
          premise: "酒場で二人から依頼される。",
          characters: [{ id: "mia", name: "ミア", profile: "店主。" }, { id: "noah", name: "ノア", profile: "護衛。" }],
          opening: [
            { type: "narration", text: "扉が閉まる。" },
            { type: "dialogue", speaker: "mia", text: "頼みがあるの。" },
            { type: "dialogue", speaker: "noah", text: "まず話を聞け。" },
          ],
          settingBooks: [],
        },
      }),
    })

    expect(result).toMatchObject({
      title: "二人からの依頼",
      characterName: "ミア・ノア",
      conversationLabel: "2人と会話",
      tags: ["冒険"],
      opening: [
        { role: "narration", text: "扉が閉まる。" },
        { role: "character", speakerName: "ミア", text: "頼みがあるの。" },
        { role: "character", speakerName: "ノア", text: "まず話を聞け。" },
      ],
    })
    expect(result.pack).toMatchObject({ plot: { settingBooks: [] } })
  })

  it("公開一覧の問い合わせからR18を除外する", async () => {
    let query = ""
    let bindings: unknown[] = []
    const env = {
      DB: {
        prepare(sql: string) {
          query = sql
          return {
            bind(...values: unknown[]) {
              bindings = values
              return { all: async () => ({ results: [] }) }
            },
          }
        },
      },
    } as unknown as Env

    const response = await worker.fetch!(new Request("https://example.com/api/scenarios"), env)

    expect(response.status).toBe(200)
    expect(query).toContain("rating != ?")
    expect(query).toContain("json_extract(pack_json, '$.rating') != ?")
    expect(bindings).toEqual(["published", "r18", "r18"])
  })

  it("重複ratingキーの末尾がR18ならレスポンスから除外する", async () => {
    const packJson = '{"spec":"mikan.chat-pack","specVersion":"0.1","id":"66666666-6666-4666-8666-666666666666","version":"1.0.0","language":"ja","title":"R18","summary":"test","author":{"name":"test"},"license":"test","rating":"all","rating":"r18","discovery":{},"plot":{"premise":"test","characters":[{"id":"aoi","name":"葵","profile":"test"}],"opening":[{"type":"dialogue","speaker":"aoi","text":"test"}]}}'
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return { all: async () => ({ results: [{ ...row, pack_json: packJson }] }) }
            },
          }
        },
      },
    } as unknown as Env

    const response = await worker.fetch!(new Request("https://example.com/api/scenarios"), env)
    const payload = await response.json() as { items: unknown[] }

    expect(payload.items).toEqual([])
  })

  it("予約済み登場人物IDを持つパックを無効にする", () => {
    const pack = {
      spec: "mikan.chat-pack",
      specVersion: "0.1",
      id: "77777777-7777-4777-8777-777777777777",
      version: "1.0.0",
      language: "ja",
      title: "invalid",
      summary: "invalid",
      author: { name: "test" },
      license: "test",
      rating: "all",
      discovery: {},
      plot: {
        premise: "invalid",
        characters: [{ id: "user", name: "ユーザー", profile: "invalid" }],
        opening: [{ type: "dialogue", speaker: "user", text: "invalid" }],
      },
    }

    expect(toScenarioSummary({ ...row, pack_json: JSON.stringify(pack) }).pack).toBeNull()
  })
})
