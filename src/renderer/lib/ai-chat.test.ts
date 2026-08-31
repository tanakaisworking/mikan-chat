import { afterEach, describe, expect, it, vi } from "vitest"

import {
  GOOGLE_AI_STUDIO_ENDPOINT,
  GOOGLE_AI_STUDIO_FALLBACK_MODEL,
  GOOGLE_AI_STUDIO_MODEL,
  GOOGLE_AI_STUDIO_STABLE_FALLBACK_MODEL,
  getConnectionError,
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
      data: [{ id: "models/gemini-3.6-flash" }, { id: "models/gemini-3.5-flash-lite" }],
    }))
    vi.stubGlobal("fetch", fetchMock)

    await testAIConnection({
      type: "online",
      endpoint: GOOGLE_AI_STUDIO_ENDPOINT,
      apiKey: "\u200bgemini-test-key\n",
      model: GOOGLE_AI_STUDIO_MODEL,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `${GOOGLE_AI_STUDIO_ENDPOINT}/models`,
      expect.objectContaining({ headers: { Authorization: "Bearer gemini-test-key" } }),
    )
  })

  it("APIキーの不可視空白を除去し、その他の非ASCII文字は送信前に拒否する", () => {
    expect(getConnectionError({
      type: "online",
      endpoint: GOOGLE_AI_STUDIO_ENDPOINT,
      apiKey: "\u200bgemini-test-key\n",
      model: GOOGLE_AI_STUDIO_MODEL,
    })).toBeNull()
    expect(getConnectionError({
      type: "online",
      endpoint: GOOGLE_AI_STUDIO_ENDPOINT,
      apiKey: "gemini-日本語-key",
      model: GOOGLE_AI_STUDIO_MODEL,
    })).toBe("APIキーに使用できない文字が含まれています。Google AI Studioからキーだけをコピーしてください。")
  })

  it("Google AI StudioのFlash失敗時にFlash-Liteへ切り替える", async () => {
    const successStream = new Response([
      `data: {"id":"chatcmpl-fallback","object":"chat.completion.chunk","created":1,"model":"${GOOGLE_AI_STUDIO_FALLBACK_MODEL}","choices":[{"index":0,"delta":{"content":"フォールバック成功"},"finish_reason":null}]}\n\n`,
      `data: {"id":"chatcmpl-fallback","object":"chat.completion.chunk","created":1,"model":"${GOOGLE_AI_STUDIO_FALLBACK_MODEL}","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
      "data: [DONE]\n\n",
    ].join(""), { headers: { "Content-Type": "text/event-stream" } })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: { message: "model unavailable" } }, { status: 404 }))
      .mockResolvedValueOnce(successStream)
    vi.stubGlobal("fetch", fetchMock)
    const updates: string[] = []

    const reply = await streamCharacterReply({
      connection: {
        type: "online",
        endpoint: GOOGLE_AI_STUDIO_ENDPOINT,
        apiKey: "gemini-test-key",
        model: GOOGLE_AI_STUDIO_MODEL,
      },
      character: { id: "aoi", name: "葵", description: "幼なじみ", lastMessage: "", lastActive: "" },
      messages: [{ id: "user", role: "user", text: "こんにちは", time: "12:00" }],
      signal: new AbortController().signal,
      onText: (text) => updates.push(text),
    })

    expect(reply).toBe("フォールバック成功")
    expect(updates).toEqual(["", "フォールバック成功"])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).model))
      .toEqual([GOOGLE_AI_STUDIO_MODEL, GOOGLE_AI_STUDIO_FALLBACK_MODEL])
  })

  it("Google AI Studioの認証エラーでは別モデルを試さない", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ error: { message: "invalid API key" } }, { status: 401 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(streamCharacterReply({
      connection: {
        type: "online",
        endpoint: GOOGLE_AI_STUDIO_ENDPOINT,
        apiKey: "invalid-key",
        model: GOOGLE_AI_STUDIO_MODEL,
      },
      character: { id: "aoi", name: "葵", description: "幼なじみ", lastMessage: "", lastActive: "" },
      messages: [{ id: "user", role: "user", text: "こんにちは", time: "12:00" }],
      signal: new AbortController().signal,
      onText: vi.fn(),
    })).rejects.toThrow()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("2つのlatestモデルが503なら安定版Flash-Liteへ切り替える", async () => {
    const successStream = new Response([
      `data: {"id":"chatcmpl-stable","object":"chat.completion.chunk","created":1,"model":"${GOOGLE_AI_STUDIO_STABLE_FALLBACK_MODEL}","choices":[{"index":0,"delta":{"content":"安定版で成功"},"finish_reason":null}]}\n\n`,
      `data: {"id":"chatcmpl-stable","object":"chat.completion.chunk","created":1,"model":"${GOOGLE_AI_STUDIO_STABLE_FALLBACK_MODEL}","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
      "data: [DONE]\n\n",
    ].join(""), { headers: { "Content-Type": "text/event-stream" } })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: { message: "overloaded" } }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ error: { message: "overloaded" } }, { status: 503 }))
      .mockResolvedValueOnce(successStream)
    vi.stubGlobal("fetch", fetchMock)

    const reply = await streamCharacterReply({
      connection: {
        type: "online",
        endpoint: GOOGLE_AI_STUDIO_ENDPOINT,
        apiKey: "gemini-test-key",
        model: GOOGLE_AI_STUDIO_MODEL,
      },
      character: { id: "aoi", name: "葵", description: "幼なじみ", lastMessage: "", lastActive: "" },
      messages: [{ id: "user", role: "user", text: "こんにちは", time: "12:00" }],
      signal: new AbortController().signal,
      onText: vi.fn(),
    })

    expect(reply).toBe("安定版で成功")
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).model))
      .toEqual([GOOGLE_AI_STUDIO_MODEL, GOOGLE_AI_STUDIO_FALLBACK_MODEL, GOOGLE_AI_STUDIO_STABLE_FALLBACK_MODEL])
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
