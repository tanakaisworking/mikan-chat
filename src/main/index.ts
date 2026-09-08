import { app, BrowserWindow, ipcMain, safeStorage, shell } from "electron"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { DesktopStore } from "./desktop-store"
import { IrodoriRuntimeManager } from "./irodori-runtime"
import { LocalAIManager, localAIChatRequestSchema, localAIModelSpecSchema } from "./local-ai"
import { localTtsReferenceSchema, localTtsSynthesisRequestSchema, seedCachedAudioSchema } from "./local-tts"
import { resolveAudioComStreamUrl } from "../shared/audio-com"
import { desktopConversationInputSchema, desktopSettingsInputSchema } from "../shared/desktop-store"

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const shutdownTasks = new Set<() => Promise<void>>()
let quitAfterCleanup = false

const windowBackground = { light: "#fff9f4", dark: "#171310" } as const

// アイドル時リソース解放（Ready → Waiting）。
// ponytail: タイムアウト固定 10 分。設定UIが必要になったら desktop-store に項目を追加する。
const IDLE_RELEASE_TIMEOUT_MS = 10 * 60 * 1000
let lastResourceActivity = Date.now()
let resourcesReleased = false
let idleWatchTimer: NodeJS.Timeout | null = null
let idleLocalAi: LocalAIManager | null = null
let idleIrodori: IrodoriRuntimeManager | null = null

function touchResourceActivity() {
  lastResourceActivity = Date.now()
  if (resourcesReleased) {
    resourcesReleased = false
    console.log("[idle] Ready: 次の利用時にローカルリソースを再読み込みします")
  }
}

async function releaseIdleResources() {
  if (resourcesReleased || Date.now() - lastResourceActivity < IDLE_RELEASE_TIMEOUT_MS) return
  try {
    if (idleLocalAi && !idleLocalAi.busy) {
      await idleLocalAi.dispose()
      console.log("[idle] Waiting: 内蔵AIワーカーを解放しました（次回チャット時に自動再起動します）")
    }
  } catch (error) {
    console.warn("[idle] 内蔵AIの解放に失敗:", error)
  }
  try {
    if (idleIrodori && (await idleIrodori.status()).state === "running") {
      await idleIrodori.stop()
      console.log("[idle] Waiting: Irodori TTSサーバーを停止しました（次回合成時に自動起動します）")
    }
  } catch (error) {
    console.warn("[idle] Irodori TTSの解放に失敗:", error)
  }
  resourcesReleased = true
}

function startIdleWatcher() {
  if (idleWatchTimer) return
  idleWatchTimer = setInterval(() => { void releaseIdleResources() }, 60_000)
  const stopWatcher = () => {
    if (idleWatchTimer) {
      clearInterval(idleWatchTimer)
      idleWatchTimer = null
    }
  }
  shutdownTasks.add(() => Promise.resolve(stopWatcher()))
}

function createDesktopStore() {
  return new DesktopStore(app.getPath("userData"), {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (value) => safeStorage.encryptString(value).toString("base64"),
    decrypt: (value) => safeStorage.decryptString(Buffer.from(value, "base64")),
  })
}

async function createWindow() {
  const store = createDesktopStore()
  const theme = await store.loadSettings().then(
    (loaded) => loaded.settings.appearance.theme,
    () => "light" as const,
  )
  const window = new BrowserWindow({
    width: 1440,
    height: 1024,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: windowBackground[theme],
    show: false,
    icon: path.join(currentDirectory, "../../build/icon.png"),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(currentDirectory, "../preload/index.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  window.once("ready-to-show", () => window.show())
  window.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(webContents === window.webContents && permission === "media")
  })
  registerStoreHandlers(window, store)
  registerLocalAIHandlers(window)
  registerLocalTtsHandlers(window)
  window.webContents.on("before-input-event", () => touchResourceActivity())
  startIdleWatcher()
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

function registerLocalTtsHandlers(window: BrowserWindow) {
  const manager = new IrodoriRuntimeManager(path.join(app.getPath("userData"), "irodori"), window)
  idleIrodori = manager
  ipcMain.removeHandler("irodori:status")
  ipcMain.removeHandler("irodori:install")
  ipcMain.removeHandler("irodori:start")
  ipcMain.removeHandler("irodori:stop")
  ipcMain.removeHandler("irodori:delete")
  ipcMain.removeHandler("tts:synthesize-local")
  ipcMain.removeHandler("tts:has-cached-audio")
  ipcMain.removeHandler("tts:read-cached-audio")
  ipcMain.removeHandler("tts:seed-cached-audio")
  ipcMain.removeHandler("tts:has-reference")
  ipcMain.removeHandler("tts:find-reference")
  ipcMain.removeHandler("tts:delete-reference")
  ipcMain.removeHandler("bgm:resolve-audio-com")
  ipcMain.removeHandler("tts:register-reference")
  ipcMain.removeAllListeners("tts:cancel-local")
  ipcMain.handle("irodori:status", (event) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    return manager.status()
  })
  ipcMain.handle("irodori:install", (event) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    touchResourceActivity()
    return manager.install()
  })
  ipcMain.handle("irodori:start", (event) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    touchResourceActivity()
    return manager.start()
  })
  ipcMain.handle("irodori:stop", (event) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    return manager.stop()
  })
  ipcMain.handle("irodori:delete", (event) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    return manager.delete()
  })
  ipcMain.handle("tts:synthesize-local", (event, input) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    touchResourceActivity()
    return manager.synthesize(localTtsSynthesisRequestSchema.parse(input))
  })
  ipcMain.handle("tts:has-cached-audio", (event, input) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    // キャッシュ確認だけでアイドルタイマーを延命しない（touchResourceActivityを呼ばない）。
    // 不正な入力では false を返し、ZodError のログ連打を避ける。
    const parsed = localTtsSynthesisRequestSchema.safeParse(input)
    if (!parsed.success) return false
    return manager.hasCachedAudio(parsed.data)
  })
  ipcMain.handle("tts:read-cached-audio", (event, input) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    // キャッシュ読み出しだけでアイドルタイマーを延命しない（touchResourceActivityを呼ばない）。
    // 不正な入力では null を返し、ZodError のログ連打を避ける。
    const parsed = localTtsSynthesisRequestSchema.safeParse(input)
    if (!parsed.success) return null
    return manager.readCachedAudioOnly(parsed.data)
  })
  ipcMain.handle("tts:seed-cached-audio", (event, input) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    // 声決め時の候補音声を会話再生キーで保存するだけなので延命しない。不正な入力では false を返す。
    const parsed = seedCachedAudioSchema.safeParse(input)
    if (!parsed.success) return false
    return manager.seedCachedAudio(parsed.data.request, parsed.data.audio)
  })
  ipcMain.handle("tts:has-reference", (event, voiceId) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    return manager.hasVoice(localTtsReferenceSchema.shape.voiceId.parse(voiceId))
  })
  ipcMain.handle("tts:find-reference", (event, prefix) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    return manager.findVoice(localTtsReferenceSchema.shape.voiceId.parse(prefix))
  })
  ipcMain.handle("tts:delete-reference", (event, voiceId) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    return manager.deleteVoice(localTtsReferenceSchema.shape.voiceId.parse(voiceId))
  })
  ipcMain.handle("tts:register-reference", (event, input) => {
    if (event.sender !== window.webContents) throw new Error("Irodori TTSへアクセスできません。")
    touchResourceActivity()
    return manager.registerVoice(localTtsReferenceSchema.parse(input))
  })
  ipcMain.handle("bgm:resolve-audio-com", (event, source) => {
    if (event.sender !== window.webContents) throw new Error("BGMへアクセスできません。")
    if (typeof source !== "string" || source.length > 500) throw new Error("BGMの指定が不正です。")
    return resolveAudioComStreamUrl(source)
  })
  ipcMain.on("tts:cancel-local", (event, requestId) => {
    if (event.sender !== window.webContents || typeof requestId !== "string") return
    void manager.cancelSynthesis(requestId)
  })
  const dispose = () => manager.dispose()
  shutdownTasks.add(dispose)
  window.on("closed", () => void dispose().finally(() => shutdownTasks.delete(dispose)))
}

function registerLocalAIHandlers(window: BrowserWindow) {
  const manager = new LocalAIManager(path.join(app.getPath("userData"), "models"), window)
  idleLocalAi = manager
  const assertSender = (sender: Electron.WebContents) => {
    if (sender !== window.webContents) throw new Error("内蔵AIへアクセスできません。")
  }
  ipcMain.removeHandler("local-ai:status")
  ipcMain.removeHandler("local-ai:download")
  ipcMain.removeHandler("local-ai:delete")
  ipcMain.removeHandler("local-ai:chat")
  ipcMain.removeAllListeners("local-ai:cancel")
  ipcMain.handle("local-ai:status", (event, input) => {
    assertSender(event.sender)
    return manager.status(localAIModelSpecSchema.parse(input))
  })
  ipcMain.handle("local-ai:download", (event, input) => {
    assertSender(event.sender)
    touchResourceActivity()
    return manager.download(localAIModelSpecSchema.parse(input))
  })
  ipcMain.handle("local-ai:delete", (event, input) => {
    assertSender(event.sender)
    return manager.delete(localAIModelSpecSchema.parse(input))
  })
  ipcMain.handle("local-ai:chat", (event, input) => {
    assertSender(event.sender)
    touchResourceActivity()
    return manager.chat(localAIChatRequestSchema.parse(input))
  })
  ipcMain.on("local-ai:cancel", (event, requestId) => {
    if (event.sender === window.webContents && typeof requestId === "string") manager.cancel(requestId)
  })
  window.on("closed", () => void manager.dispose())
}

function registerStoreHandlers(window: BrowserWindow, store: DesktopStore) {
  const assertSender = (sender: Electron.WebContents) => {
    if (sender !== window.webContents) throw new Error("保存データへアクセスできません。")
  }

  ipcMain.removeHandler("store:load")
  ipcMain.removeHandler("store:saveSettings")
  ipcMain.removeHandler("conv:list")
  ipcMain.removeHandler("conv:save")
  ipcMain.removeHandler("conv:delete")
  ipcMain.handle("store:load", (event) => {
    assertSender(event.sender)
    return store.loadSettings()
  })
  ipcMain.handle("store:saveSettings", (event, input) => {
    assertSender(event.sender)
    const settings = desktopSettingsInputSchema.parse(input)
    if (!window.isDestroyed()) window.setBackgroundColor(windowBackground[settings.appearance.theme])
    return store.saveSettings(settings)
  })
  ipcMain.handle("conv:list", (event) => {
    assertSender(event.sender)
    return store.listConversations()
  })
  ipcMain.handle("conv:save", (event, input) => {
    assertSender(event.sender)
    return store.saveConversation(desktopConversationInputSchema.parse(input))
  })
  ipcMain.handle("conv:delete", (event, id) => {
    assertSender(event.sender)
    if (typeof id !== "string") throw new Error("会話IDが不正です。")
    return store.deleteConversation(id)
  })
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
  void createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on("before-quit", (event) => {
  if (quitAfterCleanup || shutdownTasks.size === 0) return
  event.preventDefault()
  quitAfterCleanup = true
  void Promise.allSettled([...shutdownTasks].map((dispose) => dispose())).finally(() => app.quit())
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
