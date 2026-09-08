import { LocalAIWorkerCore, type WorkerInMessage, type WorkerOutMessage } from "./local-ai-core"

type ParentPort = {
  on(event: "message", listener: (event: { data: unknown }) => void): void
  postMessage(message: WorkerOutMessage): void
}

const parentPort = (process as unknown as { parentPort?: ParentPort }).parentPort
if (!parentPort) throw new Error("このファイルはElectron utilityProcess上で実行してください。")
// Activity Monitor でローカル LLM の重さを特定できるようにプロセス名を付ける
// （macOS では proc_setname 経由で表示名が変わる。ucomm は Electron Helper のまま）
process.title = "Mikan LLM Helper"

let core: LocalAIWorkerCore | null = null

parentPort.on("message", (event) => {
  const message = event.data as WorkerInMessage
  if (!message || typeof message !== "object") return
  if (message.type === "init") {
    core = new LocalAIWorkerCore(message.modelsDirectory, (out) => parentPort.postMessage(out))
    return
  }
  if (message.type === "dispose") {
    void core?.handle(message).then(() => process.exit(0))
    return
  }
  void core?.handle(message)
})
