import { describe, expect, it, vi } from "vitest"

import { localTtsSynthesisRequestSchema, registerLocalTtsReference, synthesizeLocalTts } from "./local-tts"

describe("synthesizeLocalTts", () => {
  it("IrodoriのローカルAPIへ音声生成を依頼する", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))

    const audio = await synthesizeLocalTts({
      requestId: "11111111-1111-4111-8111-111111111111",
      endpoint: "http://127.0.0.1:8088/v1/",
      model: "irodori-tts",
      voice: "none",
      apiKey: "",
      text: "こんにちは。",
    }, fetcher)

    expect(audio.byteLength).toBe(3)
    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8088/v1/audio/speech", expect.objectContaining({
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "irodori-tts", input: "こんにちは。", voice: "none", response_format: "wav" }),
    }))
  })

  it("外部URLへの接続を拒否する", () => {
    expect(() => localTtsSynthesisRequestSchema.parse({ requestId: "11111111-1111-4111-8111-111111111111", endpoint: "https://example.com/v1", model: "irodori-tts", voice: "none", apiKey: "", text: "test" }))
      .toThrow("ローカルサーバー")
  })

  it("参照音声を初回だけ登録し、caption・seed・stepsを音声生成へ渡す", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1]), { status: 200 }))

    await synthesizeLocalTts({
      requestId: "11111111-1111-4111-8111-111111111111",
      endpoint: "http://127.0.0.1:8088/v1",
      model: "irodori-tts",
      voice: "none",
      apiKey: "token",
      text: "こんにちは。",
      caption: "落ち着いた若い女性の声",
      seed: 42,
      numSteps: 24,
      referenceAudio: {
        voiceId: "mikan-pack-aoi-1-0-0",
        fileName: "aoi.wav",
        mimeType: "audio/wav",
        data: new Uint8Array([1, 2, 3]).buffer,
      },
    }, fetcher)

    expect(fetcher).toHaveBeenNthCalledWith(1, "http://127.0.0.1:8088/v1/audio/voices/mikan-pack-aoi-1-0-0", expect.objectContaining({ redirect: "error" }))
    expect(fetcher).toHaveBeenNthCalledWith(2, "http://127.0.0.1:8088/v1/audio/voices", expect.objectContaining({ method: "POST", body: expect.any(FormData) }))
    expect(fetcher).toHaveBeenNthCalledWith(3, "http://127.0.0.1:8088/v1/audio/speech", expect.objectContaining({
      body: JSON.stringify({ model: "irodori-tts", input: "こんにちは。", voice: "mikan-pack-aoi-1-0-0", response_format: "wav", irodori: { caption: "落ち着いた若い女性の声", seed: 42, num_steps: 24 } }),
    }))
  })

  it("Irodoriサーバーの上限を超える文章を拒否する", () => {
    expect(() => localTtsSynthesisRequestSchema.parse({
      requestId: "11111111-1111-4111-8111-111111111111",
      endpoint: "http://127.0.0.1:8088/v1",
      model: "irodori-tts",
      voice: "none",
      apiKey: "",
      text: "あ".repeat(4_097),
    })).toThrow()
  })

  it("確定した候補音声で既存の参照音声を置き換える", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))

    await registerLocalTtsReference("http://127.0.0.1:8088/v1", "token", {
      voiceId: "mikan-user-shizuku",
      fileName: "voice.wav",
      mimeType: "audio/wav",
      data: new Uint8Array([1, 2, 3]).buffer,
    }, fetcher, undefined, true)

    expect(fetcher).toHaveBeenNthCalledWith(2, "http://127.0.0.1:8088/v1/audio/voices/mikan-user-shizuku", expect.objectContaining({ method: "PUT", body: expect.any(FormData) }))
  })

  it("Content-Lengthなしの巨大な音声を読み切る前に拒否する", async () => {
    const chunk = new Uint8Array(1024 * 1024)
    const cancel = vi.fn()
    const fetcher = vi.fn(async () => ({
      ok: true,
      headers: new Headers(),
      body: { getReader: () => ({ read: async () => ({ done: false, value: chunk }), cancel }) },
    })) as never

    await expect(synthesizeLocalTts({
      requestId: "11111111-1111-4111-8111-111111111111",
      endpoint: "http://127.0.0.1:8088/v1",
      model: "irodori-tts",
      voice: "none",
      apiKey: "",
      text: "テスト",
    }, fetcher)).rejects.toThrow("大きすぎます")
    expect(fetcher).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledOnce()
  })
})
