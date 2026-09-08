import path from "node:path"
import { fileURLToPath } from "node:url"

import type { BrowserWindow } from "electron"

import {
  DEFAULT_BUILTIN_MODEL,
  localAIModelSpec,
  type LocalAIChatRequest,
  type LocalAIModelSpec,
  type LocalAIStatus,
} from "../shared/local-ai"
import {
  baseStatus,
  type WorkerHandle,
  type WorkerInMessage,
  type WorkerOutMessage,
} from "./local-ai-core"

export { localAIChatRequestSchema, localAIModelSpecSchema } from "./local-ai-core"

const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "local-ai-worker.js")

type PendingCall = {
  kind: "status" | "call"
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

export class LocalAIManager {
  private worker: WorkerHandle | null = null
  private exiting = false
  private nextCallId = 1
  private activeDownloads = 0
  private lastSpec: LocalAIModelSpec = DEFAULT_BUILTIN_MODEL
  private readonly pendingCalls = new Map<number, PendingCall>()
  private readonly pendingChats = new Map<string, { resolve: (result: string) => void; reject: (error: Error) => void }>()

  constructor(
    private readonly modelsDirectory: string,
    private readonly window: BrowserWindow,
    private readonly spawn: () => Promise<WorkerHandle> = spawnUtilityWorker,
  ) {}

  /** アイドル解放用: ダウンロード中やチャット応答中はリソースを解放しない */
  get busy() {
    return this.activeDownloads > 0 || this.pendingChats.size > 0
  }

  async status(input: LocalAIModelSpec = DEFAULT_BUILTIN_MODEL) {
    const spec = localAIModelSpec(input)
    this.lastSpec = spec
    const child = await this.ensureWorker()
    const id = this.nextCallId++
    return new Promise<LocalAIStatus>((resolve, reject) => {
      this.pendingCalls.set(id, { kind: "status", resolve: (value) => resolve(value as LocalAIStatus), reject })
      child.send({ type: "status", id, spec })
    })
  }

  async download(input: LocalAIModelSpec = DEFAULT_BUILTIN_MODEL) {
    const spec = localAIModelSpec(input)
    this.lastSpec = spec
    const child = await this.ensureWorker()
    const id = this.nextCallId++
    this.activeDownloads++
    try {
      await this.call(child, id, { type: "download", id, spec })
    } finally {
      this.activeDownloads--
    }
  }

  async delete(input: LocalAIModelSpec = DEFAULT_BUILTIN_MODEL) {
    const spec = localAIModelSpec(input)
    this.lastSpec = spec
    const child = await this.ensureWorker()
    const id = this.nextCallId++
    await this.call(child, id, { type: "delete", id, spec })
  }

  chat(request: LocalAIChatRequest) {
    return this.ensureWorker().then((child) => new Promise<string>((resolve, reject) => {
      this.pendingChats.set(request.requestId, { resolve, reject })
      child.send({ type: "chat", request })
    }))
  }

  cancel(requestId: string) {
    this.worker?.send({ type: "cancel", requestId })
  }

  async dispose() {
    const child = this.worker
    if (!child) return
    this.exiting = true
    child.send({ type: "dispose", id: 0 })
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill()
        resolve()
      }, 5_000)
      child.onExit(() => {
        clearTimeout(timer)
        resolve()
      })
    })
    this.worker = null
  }

  private async ensureWorker() {
    if (this.worker) return this.worker
    this.exiting = false
    const child = await this.spawn()
    child.onMessage((message) => this.onWorkerMessage(message as WorkerOutMessage))
    child.onExit((exitCode) => this.onWorkerExit(exitCode))
    child.send({ type: "init", modelsDirectory: this.modelsDirectory })
    this.worker = child
    return child
  }

  private call(child: WorkerHandle, id: number, message: WorkerInMessage) {
    return new Promise<void>((resolve, reject) => {
      this.pendingCalls.set(id, { kind: "call", resolve: () => resolve(), reject })
      child.send(message)
    })
  }

  private onWorkerMessage(message: WorkerOutMessage) {
    if (message.type === "chunk") {
      this.send("local-ai:chunk", message.requestId, message.text)
      return
    }
    if (message.type === "chat-result" || message.type === "chat-error") {
      const pending = this.pendingChats.get(message.requestId)
      if (!pending) return
      this.pendingChats.delete(message.requestId)
      if (message.type === "chat-result") pending.resolve(message.result)
      else pending.reject(new Error(message.message))
      return
    }
    if (message.type === "status") {
      this.send("local-ai:status", message.status)
      if (message.id === undefined) return
      const pending = this.pendingCalls.get(message.id)
      if (pending?.kind !== "status") return
      this.pendingCalls.delete(message.id)
      pending.resolve(message.status)
      return
    }
    const pending = this.pendingCalls.get(message.id)
    if (!pending) return
    this.pendingCalls.delete(message.id)
    if (message.error) pending.reject(new Error(message.error))
    else pending.resolve(undefined)
  }

  private onWorkerExit(exitCode: number) {
    this.worker = null
    if (this.exiting) return
    const error = new Error(exitCode === 0
      ? "内蔵AIプロセスが終了しました。もう一度お試しください。"
      : "内蔵AIプロセスが異常終了しました。もう一度お試しください。")
    for (const pending of this.pendingCalls.values()) pending.reject(error)
    this.pendingCalls.clear()
    for (const pending of this.pendingChats.values()) pending.reject(error)
    this.pendingChats.clear()
    this.send("local-ai:status", { ...baseStatus(this.lastSpec, "error"), error: error.message })
  }

  private send(channel: string, ...args: unknown[]) {
    if (!this.window.isDestroyed()) this.window.webContents.send(channel, ...args)
  }
}

async function spawnUtilityWorker(): Promise<WorkerHandle> {
  const { utilityProcess } = await import("electron")
  const child = utilityProcess.fork(workerPath, [], { serviceName: "mikan-local-ai" })
  return {
    send: (message) => child.postMessage(message),
    onMessage: (listener) => child.on("message", (message) => listener(message as WorkerOutMessage)),
    onExit: (listener) => child.on("exit", (exitCode) => listener(exitCode)),
    kill: () => child.kill(),
  }
}
