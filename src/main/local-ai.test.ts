import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

import { LocalAIManager } from "./local-ai"
import { LocalAIWorkerCore, type WorkerInMessage, type WorkerOutMessage } from "./local-ai-core"
import { GEMMA_4_12B_MODEL } from "../shared/local-ai"

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("LocalAIWorkerCore", () => {
  it("同じsequenceで複数ターンを処理し、systemPromptを履歴へ残す", async () => {
    const directory = await createDirectory()
    await writeFile(path.join(directory, "qwen3-1.7b-q8_0.gguf"), "model")
    const send = vi.fn<(message: WorkerOutMessage) => void>()
    const histories: unknown[][] = []
    const getSequence = vi.fn(() => ({}))
    const context = { getSequence, dispose: vi.fn() }
    const model = { createContext: vi.fn(async () => context), dispose: vi.fn() }
    const llama = { loadModel: vi.fn(async () => model), dispose: vi.fn() }
    class FakeSession {
      private history: unknown[]

      constructor(options: { systemPrompt: string }) {
        this.history = [{ type: "system", text: options.systemPrompt }]
      }

      getChatHistory() { return this.history }
      setChatHistory(history: unknown[]) {
        this.history = history
        histories.push(history)
      }
      async prompt(_prompt: string, options: { onTextChunk: (text: string) => void }) {
        options.onTextChunk("葵: うん。")
        return "葵: うん。"
      }
      dispose() { return undefined }
    }
    const core = new LocalAIWorkerCore(directory, send, async () => ({
      getLlama: async () => llama,
      LlamaChatSession: FakeSession,
    }) as never)

    await expect(core.chat(request("一回目"))).resolves.toBe("葵: うん。")
    await expect(core.chat(request("二回目"))).resolves.toBe("葵: うん。")

    expect(getSequence).toHaveBeenCalledTimes(1)
    expect(histories).toHaveLength(2)
    expect(histories.every((history) => (history[0] as { type: string }).type === "system")).toBe(true)
    const requestId = (send.mock.calls.at(-1)?.[0] as { requestId: string }).requestId
    expect(send).toHaveBeenCalledWith({ type: "chunk", requestId, text: "葵: うん。" })
    await core.dispose()
  })

  it("モデルのダウンロード進捗と削除状態を通知する", async () => {
    const directory = await createDirectory()
    const send = vi.fn<(message: WorkerOutMessage) => void>()
    const core = new LocalAIWorkerCore(directory, send, async () => ({
      resolveModelFile: async (_uri: string, options: { onProgress: (progress: { downloadedSize: number; totalSize: number }) => void }) => {
        options.onProgress({ downloadedSize: 5, totalSize: 10 })
        const modelPath = path.join(directory, "qwen3-1.7b-q8_0.gguf")
        await writeFile(modelPath, "model")
        return modelPath
      },
    }) as never)

    expect((await core.status()).state).toBe("missing")
    await core.download()
    expect((await core.status()).state).toBe("ready")
    expect(send).toHaveBeenCalledWith({ type: "status", status: expect.objectContaining({ state: "downloading", downloadedBytes: 5 }) })
    await core.delete()
    expect((await core.status()).state).toBe("missing")
  })

  it("任意のHugging Face GGUFをモデル別のキャッシュへ保存する", async () => {
    const directory = await createDirectory()
    let downloadedFileName = ""
    const resolveModelFile = vi.fn(async (source: string, options: { fileName: string }) => {
      downloadedFileName = options.fileName
      await writeFile(path.join(directory, options.fileName), "gemma")
      return path.join(directory, options.fileName)
    })
    const core = new LocalAIWorkerCore(directory, vi.fn(), async () => ({ resolveModelFile }) as never)

    await core.download(GEMMA_4_12B_MODEL)

    expect(resolveModelFile).toHaveBeenCalledWith(GEMMA_4_12B_MODEL.source, expect.objectContaining({ verify: true }))
    expect(downloadedFileName).toMatch(/^[a-f0-9]{20}\.gguf$/)
    await expect(core.status(GEMMA_4_12B_MODEL)).resolves.toMatchObject({
      state: "ready",
      source: GEMMA_4_12B_MODEL.source,
    })
  })

  it("Qwen以外のモデルへQwen専用のno_think指示を送らない", async () => {
    const directory = await createDirectory()
    const prompts: string[] = []
    const sessionOptions: Array<{ chatWrapper?: unknown }> = []
    class FakeGemma4ChatWrapper {
      constructor(readonly options: { reasoning: boolean }) {}
    }
    class FakeSession {
      constructor(options: { chatWrapper?: unknown }) { sessionOptions.push(options) }
      getChatHistory() { return [{ type: "system", text: "設定" }] }
      setChatHistory() { return undefined }
      async prompt(text: string, options: { onTextChunk: (text: string) => void }) {
        prompts.push(text)
        options.onTextChunk("返答")
        return "返答"
      }
      dispose() { return undefined }
    }
    const context = { getSequence: () => ({}), dispose: vi.fn() }
    const model = { createContext: vi.fn(async () => context), dispose: vi.fn() }
    const core = new LocalAIWorkerCore(directory, vi.fn(), async () => ({
      resolveModelFile: async (_source: string, options: { fileName: string }) => {
        const modelPath = path.join(directory, options.fileName)
        await writeFile(modelPath, "gemma")
        return modelPath
      },
      getLlama: async () => ({ loadModel: async () => model, dispose: vi.fn() }),
      LlamaChatSession: FakeSession,
      Gemma4ChatWrapper: FakeGemma4ChatWrapper,
    }) as never)
    await core.download(GEMMA_4_12B_MODEL)

    await core.chat({ ...request("こんにちは"), modelSource: GEMMA_4_12B_MODEL.source })

    expect(prompts[0]).not.toContain("/no_think")
    expect(sessionOptions[0]?.chatWrapper).toBeInstanceOf(FakeGemma4ChatWrapper)
    expect((sessionOptions[0]?.chatWrapper as FakeGemma4ChatWrapper).options).toEqual({ reasoning: false })
    await core.dispose()
  })

  it("再起動後に残った部分モデルを検出して削除できる", async () => {
    const directory = await createDirectory()
    const partialPath = path.join(directory, "qwen3-1.7b-q8_0.gguf.ipull")
    await writeFile(partialPath, "partial")
    const core = new LocalAIWorkerCore(directory, vi.fn())

    await expect(core.status()).resolves.toMatchObject({
      state: "error",
      downloadedBytes: 7,
    })
    await core.delete()
    await expect(core.status()).resolves.toMatchObject({ state: "missing" })
  })

  it("ランタイム起動エラーをモデルファイルの存在でreadyへ戻さない", async () => {
    const directory = await createDirectory()
    await writeFile(path.join(directory, "qwen3-1.7b-q8_0.gguf"), "broken")
    const send = vi.fn<(message: WorkerOutMessage) => void>()
    const core = new LocalAIWorkerCore(directory, send, async () => ({
      getLlama: async () => ({
        loadModel: async () => { throw new Error("モデルが破損しています。") },
        dispose: vi.fn(),
      }),
    }) as never)

    await expect(core.chat(request("こんにちは"))).rejects.toThrow("モデルが破損しています。")
    await expect(core.status()).resolves.toMatchObject({ state: "error", error: "モデルが破損しています。" })
  })

  it("キューで待機中の生成もrequestIdで停止する", async () => {
    const directory = await createDirectory()
    await writeFile(path.join(directory, "qwen3-1.7b-q8_0.gguf"), "model")
    let started!: () => void
    const firstStarted = new Promise<void>((resolve) => { started = resolve })
    const prompt = vi.fn(async (_text: string, options: { signal: AbortSignal }) => {
      started()
      await new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }))
      return ""
    })
    class FakeSession {
      getChatHistory() { return [{ type: "system", text: "設定" }] }
      setChatHistory() { return undefined }
      prompt = prompt
      dispose() { return undefined }
    }
    const context = { getSequence: () => ({}), dispose: vi.fn() }
    const model = { createContext: vi.fn(async () => context), dispose: vi.fn() }
    const core = new LocalAIWorkerCore(directory, vi.fn(), async () => ({
      getLlama: async () => ({ loadModel: async () => model, dispose: vi.fn() }),
      LlamaChatSession: FakeSession,
    }) as never)
    const firstRequest = request("一回目")
    const secondRequest = request("二回目")
    const first = core.chat(firstRequest)
    await firstStarted
    const second = core.chat(secondRequest)
    core.cancel(secondRequest.requestId)

    await expect(first).rejects.toBeDefined()
    await expect(second).rejects.toBeDefined()
    expect(prompt).toHaveBeenCalledTimes(1)
    await core.dispose()
  })
})

describe("LocalAIManager", () => {
  it("ワーカークラッシュ時にpendingをrejectし、エラー状態を通知して再スポーンする", async () => {
    const directory = await createDirectory()
    const send = vi.fn()
    const workers = [makeFakeWorker(), makeFakeWorker()]
    let spawnCount = 0
    const manager = new LocalAIManager(directory, fakeWindow(send), async () => {
      spawnCount += 1
      return workers[spawnCount - 1]!.handle
    })

    const firstRequestId = crypto.randomUUID()
    const first = manager.chat({
      requestId: firstRequestId,
      modelSource: "hf:Qwen/Qwen3-1.7B-GGUF:Q8_0",
      systemPrompt: "キャラクター設定",
      messages: [{ role: "user" as const, content: "こんにちは" }],
    })
    await vi.waitFor(() => expect(workers[0]!.sent).toContainEqual({ type: "chat", request: expect.anything() }))
    expect(workers[0]!.sent).toContainEqual({ type: "init", modelsDirectory: directory })

    workers[0]!.exitListeners[0]!(1)
    await expect(first).rejects.toThrow("異常終了しました")
    expect(send).toHaveBeenCalledWith("local-ai:status", expect.objectContaining({
      state: "error",
      error: expect.stringContaining("異常終了しました"),
    }))

    const secondRequestId = crypto.randomUUID()
    const second = manager.chat({
      requestId: secondRequestId,
      modelSource: "hf:Qwen/Qwen3-1.7B-GGUF:Q8_0",
      systemPrompt: "キャラクター設定",
      messages: [{ role: "user" as const, content: "こんにちは" }],
    })
    await vi.waitFor(() => expect(spawnCount).toBe(2))
    // pendingChats 登録は ensureWorker 解決後の microtask で行われるため、
    // chat メッセージが worker に届いてから応答を配信する
    await vi.waitFor(() => expect(workers[1]!.sent).toContainEqual({ type: "chat", request: expect.anything() }))
    workers[1]!.messageListeners[0]!({ type: "chat-result", requestId: secondRequestId, result: "返答" })
    await expect(second).resolves.toBe("返答")
    await manager.dispose()
  })
})

async function createDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mikan-local-ai-"))
  directories.push(directory)
  return directory
}

function request(content: string) {
  return {
    requestId: crypto.randomUUID(),
    modelSource: "hf:Qwen/Qwen3-1.7B-GGUF:Q8_0",
    systemPrompt: "キャラクター設定",
    messages: [{ role: "user" as const, content }],
  }
}

function makeFakeWorker() {
  const sent: WorkerInMessage[] = []
  const messageListeners: Array<(message: WorkerOutMessage) => void> = []
  const exitListeners: Array<(exitCode: number) => void> = []
  return {
    sent,
    messageListeners,
    exitListeners,
    handle: {
      send: (message: WorkerInMessage) => {
        sent.push(message)
        if (message.type === "dispose") setTimeout(() => exitListeners.forEach((listener) => listener(0)), 0)
      },
      onMessage: (listener: (message: WorkerOutMessage) => void) => { messageListeners.push(listener) },
      onExit: (listener: (exitCode: number) => void) => { exitListeners.push(listener) },
      kill: () => { exitListeners.forEach((listener) => listener(0)) },
    },
  }
}

function fakeWindow(send = vi.fn()) {
  return {
    isDestroyed: () => false,
    webContents: { send },
  } as never
}
