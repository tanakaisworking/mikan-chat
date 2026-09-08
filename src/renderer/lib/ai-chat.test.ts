import { afterEach, describe, expect, it, vi } from "vitest"

import {
  GOOGLE_AI_STUDIO_ENDPOINT,
  GOOGLE_AI_STUDIO_FALLBACK_MODEL,
  GOOGLE_AI_STUDIO_MODEL,
  GOOGLE_AI_STUDIO_STABLE_FALLBACK_MODEL,
  getConnectionError,
  getEndpointError,
  listAIModels,
  parseAssistantResponse,
  streamCharacterReply,
  summarizeConversation,
  testAIConnection,
} from "@/lib/ai-chat"

describe("AI chat transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.mikan
  })

  it("内蔵AIに指針と要約をシステムプロンプトへ渡す", async () => {
    const chat = vi.fn(async () => "葵: うん。")
    window.mikan = {
      platform: "darwin",
      localAI: {
        status: vi.fn(async () => ({ state: "ready", modelId: "qwen3-1.7b", label: "Qwen3 1.7B", source: "hf:Qwen/Qwen3-1.7B-GGUF:Q8_0", downloadedBytes: 1, totalBytes: 1 } as const)),
        download: vi.fn(),
        delete: vi.fn(),
        chat,
        cancel: vi.fn(),
        onStatus: vi.fn(() => () => undefined),
        onChunk: vi.fn(() => () => undefined),
      },
    }

    await streamCharacterReply({
      connection: { type: "builtin", endpoint: "", apiKey: "", model: "qwen3-1.7b" },
      character: {
        id: "aoi",
        name: "葵",
        description: "幼なじみ",
        lastMessage: "",
        lastActive: "",
        pack: {
          plot: {
            situationGuide: "放課後の教室で二人きり。静かな時間を大切にする。",
            characters: [{ id: "aoi", name: "葵", profile: "幼なじみ", characterGuide: "人見知りだが、心を開いた相手には素直。" }],
            playerProfiles: [{ id: "senpai", name: "先輩", description: "静かな同級生" }],
            defaultPlayerProfile: "senpai",
          },
        },
      },
      messages: [{ id: "user", role: "user", text: "ただいま", time: "12:00" }],
      signal: new AbortController().signal,
      onText: () => undefined,
      summary: "・帰宅時に教室で再会した",
    })

    const request = (chat.mock.calls[0] as unknown as [{ systemPrompt: string }])[0]
    expect(request.systemPrompt).toContain("会話の指針（シチュエーション）: 放課後の教室で二人きり")
    expect(request.systemPrompt).toContain("キャラの指針（性格・行動原理）: 人見知りだが")
    expect(request.systemPrompt).toContain("ここまでのあらまし:\n・帰宅時に教室で再会した")
  })

  it("内蔵AIの要約生成は書記プロンプトで全文を渡して返す", async () => {
    const chat = vi.fn(async () => "・駅で別れた")
    window.mikan = {
      platform: "darwin",
      localAI: {
        status: vi.fn(async () => ({ state: "ready", modelId: "qwen3-1.7b", label: "Qwen3 1.7B", source: "hf:Qwen/Qwen3-1.7B-GGUF:Q8_0", downloadedBytes: 1, totalBytes: 1 } as const)),
        download: vi.fn(),
        delete: vi.fn(),
        chat,
        cancel: vi.fn(),
        onStatus: vi.fn(() => () => undefined),
        onChunk: vi.fn(() => () => undefined),
      },
    }

    const summary = await summarizeConversation({
      connection: { type: "builtin", endpoint: "", apiKey: "", model: "qwen3-1.7b" },
      character: { id: "aoi", name: "葵", description: "幼なじみ", lastMessage: "", lastActive: "" },
      messages: [
        { id: "u", role: "user", text: "ただいま", time: "12:00" },
        { id: "c", role: "character", speakerName: "葵", text: "おかえり", time: "12:01" },
      ],
      signal: new AbortController().signal,
    })

    expect(summary).toBe("・駅で別れた")
    const request = (chat.mock.calls[0] as unknown as [{ systemPrompt: string; messages: Array<{ role: string; content: string }> }])[0]
    expect(request.systemPrompt).toContain("登場人物名と出来事を残して")
    expect(request.messages).toEqual([
      { role: "user", content: "ただいま" },
      { role: "assistant", content: "葵: おかえり" },
    ])
  })

  it("Electron内蔵AIへ会話を渡し、返答を順次更新する", async () => {
    let onChunk: ((requestId: string, text: string) => void) | undefined
    const chat = vi.fn(async (request: { requestId: string }) => {
      onChunk?.(request.requestId, "葵: おかえり")
      onChunk?.(request.requestId, "葵: おかえり。")
      return "葵: おかえり。"
    })
    window.mikan = {
      platform: "darwin",
      localAI: {
        status: vi.fn(async () => ({ state: "ready", modelId: "qwen3-1.7b", label: "Qwen3 1.7B", source: "hf:Qwen/Qwen3-1.7B-GGUF:Q8_0", downloadedBytes: 1, totalBytes: 1 } as const)),
        download: vi.fn(),
        delete: vi.fn(),
        chat,
        cancel: vi.fn(),
        onStatus: vi.fn(() => () => undefined),
        onChunk: vi.fn((callback) => {
          onChunk = callback
          return () => { onChunk = undefined }
        }),
      },
    }
    const updates: string[] = []

    const reply = await streamCharacterReply({
      connection: { type: "builtin", endpoint: "", apiKey: "", model: "qwen3-1.7b" },
      character: { id: "aoi", name: "葵", description: "幼なじみ", lastMessage: "", lastActive: "" },
      messages: [{ id: "user", role: "user", text: "ただいま", time: "12:00" }],
      signal: new AbortController().signal,
      onText: (text) => updates.push(text),
    })

    expect(reply).toBe("葵: おかえり。")
    expect(updates).toEqual(["葵: おかえり", "葵: おかえり。"])
    expect(chat).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: expect.stringContaining("シナリオ進行役"),
      messages: [{ role: "user", content: "ただいま" }],
    }))
  })

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
      character: {
        id: "aoi",
        name: "葵",
        description: "幼なじみ",
        lastMessage: "",
        lastActive: "",
        pack: {
          plot: {
            characters: [{ id: "aoi", name: "葵", profile: "幼なじみ" }],
            playerProfiles: [{ id: "returnee", name: "五年ぶりの帰省者", description: "町を離れて働いていた。" }],
            defaultPlayerProfile: "returnee",
          },
        },
      },
      messages: [{ id: "user", role: "user", text: "こんにちは", time: "12:00" }],
      signal: new AbortController().signal,
      onText: (text) => updates.push(text),
    })

    expect(updates).toEqual(["こんにちは", "こんにちは。"])
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    )
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain("ユーザーの役: 五年ぶりの帰省者")
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

  it("ローカルOpenAI互換APIからモデル一覧を取得する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      data: [{ id: "qwen3:8b" }, { id: "gemma3:4b" }],
    }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(listAIModels({
      type: "local",
      endpoint: "http://127.0.0.1:11434/v1/",
      apiKey: "",
    })).resolves.toEqual(["qwen3:8b", "gemma3:4b"])
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:11434/v1/models", expect.any(Object))
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
      ">: 暖炉の火が揺れる。",
      "ミア: 報酬は弾むわ。",
      "ノア: 危険も大きい。",
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

  it("全角コロンと複数行の発話も分解する", () => {
    const events = parseAssistantResponse([
      ">： ノアが声を落とす。",
      "ノア： 一つだけ、",
      "約束して。",
    ].join("\n"), {
      id: "noah",
      name: "ノア",
      description: "酒場の店主",
      lastMessage: "",
      lastActive: "",
    })

    expect(events).toEqual([
      { role: "narration", text: "ノアが声を落とす。" },
      { role: "character", speakerName: "ノア", text: "一つだけ、\n約束して。" },
    ])
  })
})
