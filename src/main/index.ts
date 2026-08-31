import { app, BrowserWindow, ipcMain, shell } from "electron"
import path from "node:path"
import { fileURLToPath } from "node:url"

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 1024,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#fff9f4",
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(currentDirectory, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  window.once("ready-to-show", () => window.show())
  window.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(webContents === window.webContents && permission === "media")
  })
  const hayamimiUrl = getHayamimiUrl()
  if (hayamimiUrl) registerSpeechHandlers(window, hayamimiUrl)
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url)
    return { action: "deny" }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(path.join(currentDirectory, "../renderer/index.html"))
  }
}

function registerSpeechHandlers(window: BrowserWindow, hayamimiUrl: string) {
  let socket: WebSocket | null = null
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

  ipcMain.removeHandler("speech:start")
  ipcMain.removeHandler("speech:stop")
  ipcMain.removeAllListeners("speech:audio")

  ipcMain.handle("speech:start", (event, sessionId: string, sampleRate: number) => {
    if (event.sender !== window.webContents) throw new Error("音声入力を開始できません。")
    if (!/^[0-9a-f-]{36}$/.test(sessionId)) throw new Error("音声セッションが不正です。")
    if (activeSessionId) window.webContents.send("speech:event", activeSessionId, JSON.stringify({ type: "closed" }))
    stop()
    return new Promise<void>((resolve, reject) => {
      pendingReject = reject
      activeSessionId = sessionId
      const nextSocket = new WebSocket(hayamimiUrl)
      socket = nextSocket
      let connected = false
      connectionTimer = setTimeout(() => {
        if (socket !== nextSocket) return
        stop()
        reject(new Error("Hayamimiへの接続がタイムアウトしました。"))
      }, 5_000)
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
        stop()
        if (!connected) reject(new Error("Hayamimiに接続できません。先にローカルサーバーを起動してください。"))
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
  ipcMain.on("speech:audio", (event, sessionId: string, audio: ArrayBuffer) => {
    if (event.sender === window.webContents && sessionId === activeSessionId && socket?.readyState === WebSocket.OPEN) socket.send(audio)
  })
  ipcMain.handle("speech:stop", (event, sessionId: string) => {
    if (event.sender === window.webContents && sessionId === activeSessionId) stop()
  })
  window.on("closed", stop)
}

function getHayamimiUrl() {
  const value = process.env.MIKAN_HAYAMIMI_WS_URL
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "ws:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")
      ? url.toString()
      : null
  } catch {
    return null
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
