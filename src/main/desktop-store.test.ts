import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { DesktopStore } from "./desktop-store"

const directories: string[] = []
const secrets = {
  available: () => true,
  encrypt: (value: string) => Buffer.from(`encrypted:${value}`).toString("base64"),
  decrypt: (value: string) => Buffer.from(value, "base64").toString().replace(/^encrypted:/, ""),
}

async function createStore() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mikan-store-"))
  directories.push(directory)
  return { directory, store: new DesktopStore(directory, secrets) }
}

const settings = {
  connection: { type: "online" as const, endpoint: "https://example.com/v1", model: "test-model", apiKey: "chat-secret" },
  tts: { provider: "elevenlabs" as const, endpoint: "https://api.elevenlabs.io/v1", model: "voice-model", voice: "voice-id", apiKey: "tts-secret" },
  profile: { gender: "woman" as const, birthYear: 2000, favoriteGenres: ["恋愛"] },
  appearance: { textSize: "large" as const, theme: "dark" as const },
  readAloud: true,
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("DesktopStore", () => {
  it("設定を往復し、APIキーを平文で保存しない", async () => {
    const { directory, store } = await createStore()
    await store.saveSettings(settings)

    expect((await store.loadSettings()).settings).toEqual(settings)
    const saved = await readFile(path.join(directory, "settings.json"), "utf8")
    expect(saved).not.toContain("chat-secret")
    expect(saved).not.toContain("tts-secret")
  })

  it("破損した設定を退避して既定値で起動する", async () => {
    const { directory, store } = await createStore()
    await writeFile(path.join(directory, "settings.json"), "broken")

    const loaded = await store.loadSettings()

    expect(loaded.recoveredCorruptData).toBe(true)
    expect(loaded.settings.connection.type).toBe("local")
    expect(await readFile(path.join(directory, "settings.json.bak"), "utf8")).toBe("broken")
  })

  it("会話を50件、各200メッセージ以内に保つ", async () => {
    const { store } = await createStore()
    for (let index = 0; index < 51; index += 1) {
      await store.saveConversation({
        id: `scenario:${index}`,
        scenarioId: "scenario",
        updatedAt: new Date(2026, 0, index + 1).toISOString(),
        messages: [],
      })
    }

    const conversations = await store.listConversations()
    expect(conversations).toHaveLength(50)
    expect(conversations.some((item) => item.id === "scenario:0")).toBe(false)
  })

  it("不正な保存入力を拒否する", async () => {
    const { store } = await createStore()
    await expect(store.saveSettings({ ...settings, appearance: { textSize: "huge", theme: "dark" } } as never)).rejects.toThrow()
  })
})
