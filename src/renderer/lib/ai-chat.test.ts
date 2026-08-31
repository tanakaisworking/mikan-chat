import { afterEach, describe, expect, it, vi } from "vitest"

import {
  GOOGLE_AI_STUDIO_ENDPOINT,
  GOOGLE_AI_STUDIO_MODEL,
  getEndpointError,
  parseAssistantResponse,
  streamCharacterReply,
  testAIConnection,
} from "@/lib/ai-chat"

describe("AI chat transport", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("OpenAI互換SSEを受け取り、返答を順次更新する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response([
      "data: {\"id\":\"chatcmpl-test\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"test-model\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"こんにちは\"},\"finish_reason\":null}]}\n\n",
      "data: {\"id\":\"chatcmpl-test\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"test-model\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"。\"},\"finish_reason\":null}]}\n\n",
      "data: {\"id\":\"chatcmpl-test\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"test-model\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n",
      "data: [DONE]\n\n",
    ].join(""), { headers: { "Content-Type": "text/event-stream" } }))
    vi.stubGlobal("fetch", fetchMock)
    const updates: string[] = []

    await streamCharacterReply({
      connection: { type: "online", endpoint: "https://example.com/v1", apiKey: "test-key", model: "test-model" },
      character: { id: "aoi", name: "葵", description: "幼なじみ", lastMessage: "", lastActive: "" },
      messages: [{ id: "user", role: "user", text: "こんにちは", time: "12:00" }],
      signal: new AbortController().signal,
      onText: (text) => updates.push(text),
    })

    expect(updates).toEqual(["こんにちは", "こんにちは。"])
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("オンラインAIのAPIキーをHTTP接続先へ送らない", () => {
    expect(getEndpointError({ type: "online", endpoint: "http://example.com/v1" }))
      .toBe("オンラインAIの接続先にはhttpsを指定してください。")
  })

  it("Google AI Studioのモデル一覧をBearer認証で確認する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      data: [{ id: GOOGLE_AI_STUDIO_MODEL }],
    }))
    vi.stubGlobal("fetch", fetchMock)

    await testAIConnection({
      type: "online",
      endpoint: GOOGLE_AI_STUDIO_ENDPOINT,
      apiKey: "gemini-test-key",
      model: GOOGLE_AI_STUDIO_MODEL,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `${GOOGLE_AI_STUDIO_ENDPOINT}/models`,
      expect.objectContaining({ headers: { Authorization: "Bearer gemini-test-key" } }),
    )
  })

  it("複数話者と情景描写をイベントへ分解する", () => {
    const events = parseAssistantResponse([
      "[narration] 暖炉の火が揺れる。",
      "[dialogue:mia] 報酬は弾むわ。",
      "[dialogue:noah] 危険も大きい。",
    ].join("\n"), {
      id: "tavern",
      name: "ミア・ノア",
      description: "酒場の依頼",
      lastMessage: "",
      lastActive: "",
      pack: { plot: { characters: [{ id: "mia", name: "ミア" }, { id: "noah", name: "ノア" }] } },
    })

    expect(events).toEqual([
      { role: "narration", text: "暖炉の火が揺れる。" },
      { role: "character", speakerName: "ミア", text: "報酬は弾むわ。" },
      { role: "character", speakerName: "ノア", text: "危険も大きい。" },
    ])
  })
})
