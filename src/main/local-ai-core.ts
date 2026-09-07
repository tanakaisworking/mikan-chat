import { mkdir, rm, stat } from "node:fs/promises"
import { createHash } from "node:crypto"
import path from "node:path"

import type { Llama, LlamaContext, LlamaContextSequence, LlamaModel } from "node-llama-cpp"
import { z } from "zod"

import {
  DEFAULT_BUILTIN_MODEL,
  DEFAULT_BUILTIN_MODEL_SOURCE,
  BUILTIN_MODEL_ID,
  localAIModelSpec,
  type LocalAIChatRequest,
  type LocalAIModelSpec,
  type LocalAIStatus,
} from "../shared/local-ai"

const DEFAULT_MODEL_FILE = "qwen3-1.7b-q8_0.gguf"

export const localAIModelSpecSchema = z.object({
  source: z.string().min(1).max(500),
  label: z.string().max(100),
}).transform(localAIModelSpec)

export const localAIChatRequestSchema = z.object({
  requestId: z.string().uuid(),
  modelSource: z.string().min(1).max(500).transform((source) => localAIModelSpec({ source, label: "" }).source),
  systemPrompt: z.string().min(1).max(30_000),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(20_000),
  })).min(1).max(30),
})

export type WorkerInMessage =
  | { type: "init"; modelsDirectory: string }
  | { type: "status"; id: number; spec: LocalAIModelSpec }
  | { type: "download"; id: number; spec: LocalAIModelSpec }
  | { type: "delete"; id: number; spec: LocalAIModelSpec }
  | { type: "chat"; request: LocalAIChatRequest }
  | { type: "cancel"; requestId: string }
  | { type: "dispose"; id: number }

export type WorkerOutMessage =
  | { type: "status"; id?: number; status: LocalAIStatus }
  | { type: "chunk"; requestId: string; text: string }
  | { type: "chat-result"; requestId: string; result: string }
  | { type: "chat-error"; requestId: string; message: string }
  | { type: "result"; id: number; error?: string }

export type WorkerHandle = {
  send(message: WorkerInMessage): void
  onMessage(listener: (message: WorkerOutMessage) => void): void
  onExit(listener: (exitCode: number) => void): void
  kill(): void
}

export class LocalAIWorkerCore {
  private statusValue: LocalAIStatus = baseStatus(DEFAULT_BUILTIN_MODEL, "missing")
  private downloadController: AbortController | null = null
  private generationController: AbortController | null = null
  private llama: Llama | null = null
  private model: LlamaModel | null = null
  private context: LlamaContext | null = null
  private sequence: LlamaContextSequence | null = null
  private runtimeSource: string | null = null
  private generationQueue: Promise<void> = Promise.resolve()
  private readonly requestControllers = new Map<string, AbortController>()
  private activeRequestId: string | null = null

  constructor(
    private readonly modelsDirectory: string,
    private readonly send: (message: WorkerOutMessage) => void,
    private readonly loadRuntime: () => Promise<typeof import("node-llama-cpp")> = () => import("node-llama-cpp"),
  ) {}

  async handle(input: WorkerInMessage) {
    switch (input.type) {
      case "status":
        try {
          this.sendStatus(input.id, await this.status(localAIModelSpecSchema.parse(input.spec)))
        } catch (error) {
          this.sendResult(input.id, messageFrom(error))
        }
        break
      case "download":
        try {
          await this.download(localAIModelSpecSchema.parse(input.spec))
          this.sendResult(input.id)
        } catch (error) {
          this.sendResult(input.id, messageFrom(error, "モデルをダウンロードできませんでした。"))
        }
        break
      case "delete":
        try {
          await this.delete(localAIModelSpecSchema.parse(input.spec))
          this.sendResult(input.id)
        } catch (error) {
          this.sendResult(input.id, messageFrom(error, "モデルを削除できませんでした。"))
        }
        break
      case "chat": {
        let request: LocalAIChatRequest
        try {
          request = localAIChatRequestSchema.parse(input.request)
        } catch (error) {
          this.send({ type: "chat-error", requestId: input.request.requestId, message: messageFrom(error, "リクエストが不正です。") })
          break
        }
        try {
          const result = await this.chat(request)
          this.send({ type: "chat-result", requestId: request.requestId, result })
        } catch (error) {
          this.send({ type: "chat-error", requestId: request.requestId, message: messageFrom(error, "内蔵AIでエラーが発生しました。") })
        }
        break
      }
      case "cancel":
        this.cancel(input.requestId)
        break
      case "dispose":
        await this.dispose()
        break
    }
  }

  async status(input: LocalAIModelSpec = DEFAULT_BUILTIN_MODEL) {
    const spec = localAIModelSpec(input)
    if (this.statusValue.source !== spec.source) this.statusValue = baseStatus(spec, "missing")
    if (this.statusValue.state === "downloading" || this.statusValue.state === "loading") return this.statusValue
    if (this.statusValue.state === "error") return this.statusValue
    const modelPath = this.getModelPath(spec)
    try {
      const file = await stat(modelPath)
      this.statusValue = { ...baseStatus(spec, "ready"), downloadedBytes: file.size, totalBytes: file.size }
    } catch {
      try {
        const partial = await stat(`${modelPath}.ipull`)
        this.statusValue = {
          ...baseStatus(spec, "error"),
          downloadedBytes: partial.size,
          error: "途中までダウンロードしたモデルがあります。再開するか削除してください。",
        }
      } catch {
        this.statusValue = baseStatus(spec, "missing")
      }
    }
    return this.statusValue
  }

  async download(input: LocalAIModelSpec = DEFAULT_BUILTIN_MODEL) {
    if (this.downloadController) return
    const spec = localAIModelSpec(input)
    const modelPath = this.getModelPath(spec)
    if (this.runtimeSource && this.runtimeSource !== spec.source) await this.disposeRuntime()
    if (this.statusValue.source !== spec.source) this.statusValue = baseStatus(spec, "missing")
    const replaceExisting = this.statusValue.state === "error"
    const controller = new AbortController()
    this.downloadController = controller
    this.publish(baseStatus(spec, "downloading"))
    try {
      await mkdir(this.modelsDirectory, { recursive: true })
      if (replaceExisting) await Promise.all([
        rm(modelPath, { force: true }),
        rm(`${modelPath}.ipull`, { force: true }),
      ])
      const { resolveModelFile } = await this.loadRuntime()
      await resolveModelFile(spec.source, {
        directory: this.modelsDirectory,
        fileName: path.basename(modelPath),
        verify: true,
        cli: false,
        signal: controller.signal,
        onProgress: ({ downloadedSize, totalSize }) => this.publish({
          ...baseStatus(spec, "downloading"),
          downloadedBytes: downloadedSize,
          totalBytes: totalSize,
        }),
      })
      const file = await stat(modelPath)
      this.publish({ ...baseStatus(spec, "ready"), downloadedBytes: file.size, totalBytes: file.size })
    } catch (error) {
      this.publish({ ...baseStatus(spec, "error"), error: messageFrom(error, "モデルをダウンロードできませんでした。") })
      throw error
    } finally {
      if (this.downloadController === controller) this.downloadController = null
    }
  }

  async delete(input: LocalAIModelSpec = DEFAULT_BUILTIN_MODEL) {
    const spec = localAIModelSpec(input)
    const modelPath = this.getModelPath(spec)
    this.downloadController?.abort()
    this.abortRequests()
    await this.generationQueue
    await this.disposeRuntime()
    await Promise.all([
      rm(modelPath, { force: true }),
      rm(`${modelPath}.ipull`, { force: true }),
    ])
    this.publish(baseStatus(spec, "missing"))
  }

  cancel(requestId: string) {
    this.requestControllers.get(requestId)?.abort()
  }

  async chat(request: LocalAIChatRequest) {
    this.generationController?.abort()
    const controller = new AbortController()
    this.requestControllers.set(request.requestId, controller)
    const queued = this.generationQueue.then(() => this.runChat(request, controller))
    const run = queued.finally(() => {
      if (this.requestControllers.get(request.requestId) === controller) this.requestControllers.delete(request.requestId)
    })
    this.generationQueue = run.then(() => undefined, () => undefined)
    return run
  }

  async dispose() {
    this.downloadController?.abort()
    this.abortRequests()
    await this.generationQueue
    await this.disposeRuntime()
  }

  private async runChat(request: LocalAIChatRequest, controller: AbortController) {
    controller.signal.throwIfAborted()
    const spec = localAIModelSpec({ source: request.modelSource, label: this.statusValue.source === request.modelSource ? this.statusValue.label : "" })
    if ((await this.status(spec)).state !== "ready") throw new Error("内蔵AIのモデルを先にダウンロードしてください。")
    this.generationController = controller
    this.activeRequestId = request.requestId

    try {
      await this.ensureRuntime(spec)
      controller.signal.throwIfAborted()
      const { LlamaChatSession, Gemma4ChatWrapper } = await this.loadRuntime()
      const session = new LlamaChatSession({
        contextSequence: this.sequence!,
        systemPrompt: request.systemPrompt,
        ...(/gemma[-_]?4/i.test(spec.source) ? { chatWrapper: new Gemma4ChatWrapper({ reasoning: false }) } : {}),
      })
      try {
        const history = request.messages.slice(0, -1).map((message) => message.role === "user"
          ? { type: "user" as const, text: message.content }
          : { type: "model" as const, response: [message.content] })
        session.setChatHistory([...session.getChatHistory(), ...history])
        let text = ""
        const prompt = `${/qwen/i.test(spec.source) ? "/no_think\n" : ""}ユーザーの発言: ${request.messages.at(-1)!.content}\n指定された形式だけで、短く自然に返答してください。`
        const result = await session.prompt(prompt, {
          maxTokens: 600,
          temperature: 0.65,
          topP: 0.9,
          repeatPenalty: { penalty: 1.15, frequencyPenalty: 0.05 },
          signal: controller.signal,
          onTextChunk: (chunk) => {
            text += chunk
            this.send({ type: "chunk", requestId: request.requestId, text })
          },
        })
        if (!result.trim()) throw new Error("内蔵AIから返答がありませんでした。")
        return result
      } finally {
        session.dispose()
      }
    } finally {
      if (this.generationController === controller) this.generationController = null
      if (this.activeRequestId === request.requestId) this.activeRequestId = null
      if (this.statusValue.state !== "error") await this.status(spec)
    }
  }

  private abortRequests() {
    for (const controller of this.requestControllers.values()) controller.abort()
  }

  private async ensureRuntime(spec: LocalAIModelSpec) {
    if (this.context && this.runtimeSource === spec.source) return
    if (this.context) await this.disposeRuntime()
    this.publish({ ...this.statusValue, state: "loading" })
    try {
      const { getLlama } = await this.loadRuntime()
      this.llama = await getLlama()
      this.model = await this.llama.loadModel({ modelPath: this.getModelPath(spec) })
      this.context = await this.model.createContext({ contextSize: 4096 })
      this.sequence = this.context.getSequence()
      this.runtimeSource = spec.source
      this.publish({ ...this.statusValue, state: "ready" })
    } catch (error) {
      await this.disposeRuntime()
      this.publish({ ...baseStatus(spec, "error"), error: messageFrom(error, "内蔵AIを起動できませんでした。メモリ容量も確認してください。") })
      throw error
    }
  }

  private async disposeRuntime() {
    const context = this.context
    const model = this.model
    const llama = this.llama
    this.context = null
    this.sequence = null
    this.model = null
    this.llama = null
    this.runtimeSource = null
    await context?.dispose()
    await model?.dispose()
    await llama?.dispose()
  }

  private publish(status: LocalAIStatus) {
    this.statusValue = status
    this.send({ type: "status", status })
  }

  private sendStatus(id: number, status: LocalAIStatus) {
    this.send({ type: "status", id, status })
  }

  private sendResult(id: number, error?: string) {
    this.send({ type: "result", id, error })
  }

  private getModelPath(spec: LocalAIModelSpec) {
    if (spec.source === DEFAULT_BUILTIN_MODEL_SOURCE) return path.join(this.modelsDirectory, DEFAULT_MODEL_FILE)
    const id = createHash("sha256").update(spec.source).digest("hex").slice(0, 20)
    return path.join(this.modelsDirectory, `${id}.gguf`)
  }
}

export function baseStatus(spec: LocalAIModelSpec, state: LocalAIStatus["state"]): LocalAIStatus {
  return { state, modelId: spec.source === DEFAULT_BUILTIN_MODEL_SOURCE ? BUILTIN_MODEL_ID : spec.source, label: spec.label, source: spec.source, downloadedBytes: 0, totalBytes: 0 }
}

function messageFrom(error: unknown, fallback = "エラーが発生しました。") {
  return error instanceof Error && error.message ? error.message : fallback
}
