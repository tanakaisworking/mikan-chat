import { app, BrowserWindow, shell } from "electron"
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

app.whenReady().then(() => {
  createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
