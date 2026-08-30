import { contextBridge } from "electron"

contextBridge.exposeInMainWorld("mikan", {
  platform: process.platform,
})
