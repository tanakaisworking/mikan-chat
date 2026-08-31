import { contextBridge, ipcRenderer } from "electron"

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
})
