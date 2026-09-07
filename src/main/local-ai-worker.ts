import { LocalAIWorkerCore, type WorkerInMessage, type WorkerOutMessage } from "./local-ai-core"

type ParentPort = {
  on(event: "message", listener: (event: { data: unknown }) => void): void
  postMessage(message: WorkerOutMessage): void
}

const parentPort = (process as unknown as { parentPort?: ParentPort }).parentPort
if (!parentPort) throw new Error("このファイルはElectron utilityProcess上で実行してください。")

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
