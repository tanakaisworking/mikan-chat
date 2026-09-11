export const DEFAULT_HAYAMIMI_WS_URL = "ws://127.0.0.1:8766/ingest"
const CONNECTION_TIMEOUT_MS = 5_000

export function resolveHayamimiUrl(value: string | undefined): string | null {
  if (!value) return DEFAULT_HAYAMIMI_WS_URL
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== "ws:" || (url.hostname !== "127.0.0.1" && url.hostname !== "localhost")) return null
  // Hayamimiはパス完全一致で判定するため、末尾スラッシュを落とす。
  url.pathname = url.pathname.replace(/\/+$/, "") || "/"
  return url.toString()
}

export type SpeechSocket = {
  readonly readyState: number
  onopen: ((event: Event) => void) | null
  onmessage: ((message: MessageEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  send: (data: string | ArrayBuffer) => void
  close: () => void
}

export type SpeechIpc = {
  removeHandler: (channel: string) => void
  handle: (channel: string, listener: (event: { sender: unknown }, ...args: unknown[]) => unknown) => void
  on: (channel: string, listener: (event: { sender: unknown }, ...args: unknown[]) => void) => void
  removeAllListeners: (channel: string) => void
}

export type SpeechWindow = {
  webContents: {
    send: (channel: string, ...args: unknown[]) => void
  }
}

export function registerSpeechHandlers(deps: {
  ipc: SpeechIpc
  window: SpeechWindow
  onClosed: (listener: () => void) => void
  hayamimiUrl: string | null
  openReadyState: number
  createSocket: (url: string) => SpeechSocket
}) {
  const { ipc, window, onClosed, hayamimiUrl, openReadyState, createSocket } = deps
  let socket: SpeechSocket | null = null
  let activeSessionId: string | null = null
  let connectionTimer: ReturnType<typeof setTimeout> | null = null
  let pendingReject: ((reason: Error) => void) | null = null

  const stop = () => {
    if (connectionTimer) clearTimeout(connectionTimer)
    connectionTimer = null
    const reject = pendingReject
    pendingReject = null
    const activeSocket = socket
    socket = null
    activeSessionId = null
    activeSocket?.close()
    reject?.(new Error("Hayamimiへの接続を中止しました。"))
  }

  ipc.removeHandler("speech:start")
  ipc.removeHandler("speech:stop")
  ipc.removeAllListeners("speech:audio")

  ipc.handle("speech:start", (event, ...args) => {
    const [sessionId, sampleRate] = args
    if (event.sender !== window.webContents) throw new Error("音声入力を開始できません。")
    if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/.test(sessionId)) throw new Error("音声セッションが不正です。")
    if (typeof sampleRate !== "number" || !Number.isFinite(sampleRate)) throw new Error("音声セッションが不正です。")
    if (!hayamimiUrl) throw new Error("Hayamimiの接続先が不正です。")
    if (activeSessionId) window.webContents.send("speech:event", activeSessionId, JSON.stringify({ type: "closed" }))
    stop()
    return new Promise<void>((resolve, reject) => {
      pendingReject = reject
      activeSessionId = sessionId
      const nextSocket = createSocket(hayamimiUrl)
      socket = nextSocket
      let connected = false
      connectionTimer = setTimeout(() => {
        if (socket !== nextSocket) return
        // stop()内の保留拒否よりタイムアウト理由を優先する。
        pendingReject = null
        stop()
        reject(new Error("Hayamimiへの接続がタイムアウトしました。"))
      }, CONNECTION_TIMEOUT_MS)
      nextSocket.onopen = () => {
        if (socket !== nextSocket) return
        connected = true
        pendingReject = null
        if (connectionTimer) clearTimeout(connectionTimer)
        connectionTimer = null
        nextSocket.send(JSON.stringify({ sr: sampleRate, format: "pcm_s16le", channels: 1 }))
        resolve()
      }
      nextSocket.onmessage = (message) => {
        if (socket === nextSocket && typeof message.data === "string") {
          window.webContents.send("speech:event", sessionId, message.data)
        }
      }
      nextSocket.onerror = () => {
        if (socket !== nextSocket) return
        // stop()内の保留拒否より具体的な理由を優先する。
        pendingReject = null
        stop()
        if (!connected) reject(new Error("Hayamimiに接続できません。Hayamimiを --input ws 付きで起動してください。"))
        else window.webContents.send("speech:event", sessionId, JSON.stringify({ type: "error", message: "Hayamimiとの接続が切れました。" }))
      }
      nextSocket.onclose = () => {
        if (socket !== nextSocket) return
        socket = null
        if (connectionTimer) clearTimeout(connectionTimer)
        connectionTimer = null
        activeSessionId = null
        if (connected) window.webContents.send("speech:event", sessionId, JSON.stringify({ type: "closed" }))
      }
    })
  })
  ipc.on("speech:audio", (event, ...args) => {
    const [sessionId, audio] = args
    if (event.sender === window.webContents && typeof sessionId === "string" && sessionId === activeSessionId
      && audio instanceof ArrayBuffer && socket?.readyState === openReadyState) socket.send(audio)
  })
  ipc.handle("speech:stop", (event, ...args) => {
    const [sessionId] = args
    if (event.sender === window.webContents && sessionId === activeSessionId) stop()
  })
  onClosed(stop)
}
