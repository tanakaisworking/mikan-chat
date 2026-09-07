import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(projectRoot, "src/main/index.ts"),
          "local-ai-worker": path.resolve(projectRoot, "src/main/local-ai-worker.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
  },
  renderer: {
    publicDir: path.resolve(projectRoot, "public"),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(projectRoot, "src/renderer"),
      },
    },
  },
})
