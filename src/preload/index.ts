import { contextBridge, ipcRenderer } from "electron"
import type { DesktopConversationInput, DesktopSettingsInput, DesktopStoreLoadResult } from "../shared/desktop-store"
import type { LocalAIChatRequest, LocalAIModelSpec, LocalAIStatus } from "../shared/local-ai"
import type { IrodoriRuntimeStatus, LocalTtsReference, LocalTtsSynthesisRequest } from "../shared/local-tts"

const speech = process.env.MIKAN_HAYAMIMI_WS_URL ? {
  start: (sessionId: string, sampleRate: number) => ipcRenderer.invoke("speech:start", sessionId, sampleRate) as Promise<void>,
  send: (sessionId: string, audio: ArrayBuffer) => ipcRenderer.send("speech:audio", sessionId, audio),
  stop: (sessionId: string) => ipcRenderer.invoke("speech:stop", sessionId) as Promise<void>,
  onEvent: (callback: (sessionId: string, payload: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, sessionId: string, payload: string) => callback(sessionId, payload)
    ipcRenderer.on("speech:event", listener)
    return () => ipcRenderer.removeListener("speech:event", listener)
  },
} : undefined

contextBridge.exposeInMainWorld("mikan", {
  platform: process.platform,
  speech,
  store: {
    load: () => ipcRenderer.invoke("store:load") as Promise<DesktopStoreLoadResult>,
    saveSettings: (settings: DesktopSettingsInput) => ipcRenderer.invoke("store:saveSettings", settings) as Promise<void>,
  },
  conversations: {
    list: () => ipcRenderer.invoke("conv:list"),
    save: (conversation: DesktopConversationInput) => ipcRenderer.invoke("conv:save", conversation) as Promise<void>,
    delete: (id: string) => ipcRenderer.invoke("conv:delete", id) as Promise<void>,
  },
  tts: {
    synthesizeLocal: (request: LocalTtsSynthesisRequest) => ipcRenderer.invoke("tts:synthesize-local", request) as Promise<ArrayBuffer>,
    hasReference: (voiceId: string) => ipcRenderer.invoke("tts:has-reference", voiceId) as Promise<boolean>,
    findReference: (prefix: string) => ipcRenderer.invoke("tts:find-reference", prefix) as Promise<string | null>,
    registerReference: (reference: LocalTtsReference) => ipcRenderer.invoke("tts:register-reference", reference) as Promise<void>,
    cancelLocal: (requestId: string) => ipcRenderer.send("tts:cancel-local", requestId),
  },
  bgm: {
    resolveAudioCom: (source: string) => ipcRenderer.invoke("bgm:resolve-audio-com", source) as Promise<{ streamUrl: string; title: string | null }>,
  },
  irodori: {
    status: () => ipcRenderer.invoke("irodori:status") as Promise<IrodoriRuntimeStatus>,
    install: () => ipcRenderer.invoke("irodori:install") as Promise<void>,
    start: () => ipcRenderer.invoke("irodori:start") as Promise<void>,
    stop: () => ipcRenderer.invoke("irodori:stop") as Promise<void>,
    delete: () => ipcRenderer.invoke("irodori:delete") as Promise<void>,
    onStatus: (callback: (status: IrodoriRuntimeStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: IrodoriRuntimeStatus) => callback(status)
      ipcRenderer.on("irodori:status", listener)
      return () => ipcRenderer.removeListener("irodori:status", listener)
    },
  },
  localAI: {
    status: (model: LocalAIModelSpec) => ipcRenderer.invoke("local-ai:status", model) as Promise<LocalAIStatus>,
    download: (model: LocalAIModelSpec) => ipcRenderer.invoke("local-ai:download", model) as Promise<void>,
    delete: (model: LocalAIModelSpec) => ipcRenderer.invoke("local-ai:delete", model) as Promise<void>,
    chat: (request: LocalAIChatRequest) => ipcRenderer.invoke("local-ai:chat", request) as Promise<string>,
    cancel: (requestId: string) => ipcRenderer.send("local-ai:cancel", requestId),
    onStatus: (callback: (status: LocalAIStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: LocalAIStatus) => callback(status)
      ipcRenderer.on("local-ai:status", listener)
      return () => ipcRenderer.removeListener("local-ai:status", listener)
    },
    onChunk: (callback: (requestId: string, text: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, requestId: string, text: string) => callback(requestId, text)
      ipcRenderer.on("local-ai:chunk", listener)
      return () => ipcRenderer.removeListener("local-ai:chunk", listener)
    },
  },
})
