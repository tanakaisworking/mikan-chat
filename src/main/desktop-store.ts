import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  desktopConversationInputSchema,
  desktopConversationsFileSchema,
  desktopSettingsFileSchema,
  desktopSettingsInputSchema,
  type DesktopConversation,
  type DesktopConversationInput,
  type DesktopSettingsFile,
  type DesktopSettingsInput,
  type DesktopStoreLoadResult,
} from "../shared/desktop-store"
import { BUILTIN_MODEL_ID, DEFAULT_BUILTIN_MODEL_SOURCE } from "../shared/local-ai"

type SecretCodec = {
  available: () => boolean
  encrypt: (value: string) => string
  decrypt: (value: string) => string
}

const defaultSettings: DesktopSettingsFile = {
  version: 1,
  connection: { type: "local", endpoint: "", model: DEFAULT_BUILTIN_MODEL_SOURCE, builtinAI: true },
  connectionSecret: null,
  tts: { provider: "browser", endpoint: "", model: "", voice: "" },
  ttsSecret: null,
  profile: null,
  appearance: { textSize: "medium", theme: "light" },
  readAloud: false,
}

export class DesktopStore {
  private readonly settingsPath: string
  private readonly conversationsPath: string
  private recoveredCorruptData = false

  constructor(directory: string, private readonly secrets: SecretCodec) {
    this.settingsPath = path.join(directory, "settings.json")
    this.conversationsPath = path.join(directory, "conversations.json")
  }

  async loadSettings(): Promise<DesktopStoreLoadResult> {
    const stored = await this.readJson(this.settingsPath, desktopSettingsFileSchema, defaultSettings)
    const secretsAvailable = this.secrets.available()
    const decrypt = (value: string | null) => {
      if (!value || !secretsAvailable) return ""
      try { return this.secrets.decrypt(value) } catch { return "" }
    }
    return {
      settings: {
        connection: {
          type: stored.connection.builtinAI || stored.connection.type === "builtin" || (
            stored.connection.type === "local" && stored.connection.endpoint === "" && (
              stored.connection.model === BUILTIN_MODEL_ID || stored.connection.model.startsWith("hf:")
            )
          ) ? "builtin" : stored.connection.type,
          endpoint: stored.connection.endpoint,
          model: stored.connection.model,
          apiKey: decrypt(stored.connectionSecret),
        },
        tts: { ...stored.tts, apiKey: decrypt(stored.ttsSecret) },
        profile: stored.profile,
        appearance: stored.appearance,
        readAloud: stored.readAloud,
      },
      recoveredCorruptData: this.recoveredCorruptData,
      secretsAvailable,
    }
  }

  async saveSettings(input: DesktopSettingsInput) {
    const settings = desktopSettingsInputSchema.parse(input)
    const canEncrypt = this.secrets.available()
    await this.atomicWrite(this.settingsPath, {
      version: 1,
      connection: settings.connection.type === "builtin"
        ? { type: "local", endpoint: "", model: settings.connection.model, builtinAI: true }
        : { type: settings.connection.type, endpoint: settings.connection.endpoint, model: settings.connection.model },
      connectionSecret: canEncrypt && settings.connection.apiKey ? this.secrets.encrypt(settings.connection.apiKey) : null,
      tts: {
        provider: settings.tts.provider,
        endpoint: settings.tts.endpoint,
        model: settings.tts.model,
        voice: settings.tts.voice,
        ...(settings.tts.irodoriQuality ? { irodoriQuality: settings.tts.irodoriQuality } : {}),
      },
      ttsSecret: canEncrypt && settings.tts.apiKey ? this.secrets.encrypt(settings.tts.apiKey) : null,
      profile: settings.profile,
      appearance: settings.appearance,
      readAloud: settings.readAloud,
    } satisfies DesktopSettingsFile)
  }

  async listConversations() {
    return (await this.readConversations()).items
  }

  async saveConversation(input: DesktopConversationInput) {
    const next = desktopConversationInputSchema.parse(input)
    const file = await this.readConversations()
    const existing = file.items.find((item) => item.id === next.id)
    const conversation: DesktopConversation = {
      ...next,
      title: next.title ?? existing?.title ?? "新しい会話",
      messages: next.messages.slice(-200),
    }
    const items = [conversation, ...file.items.filter((item) => item.id !== conversation.id)]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 50)
    await this.atomicWrite(this.conversationsPath, { version: 1, items })
  }

  async deleteConversation(id: string) {
    if (!id.trim()) return
    const file = await this.readConversations()
    await this.atomicWrite(this.conversationsPath, { version: 1, items: file.items.filter((item) => item.id !== id) })
  }

  private readConversations() {
    return this.readJson(this.conversationsPath, desktopConversationsFileSchema, { version: 1 as const, items: [] })
  }

  private async readJson<T>(filePath: string, schema: { parse: (value: unknown) => T }, fallback: T): Promise<T> {
    try {
      return schema.parse(JSON.parse(await readFile(filePath, "utf8")))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback
      this.recoveredCorruptData = true
      try { await copyFile(filePath, `${filePath}.bak`) } catch { /* best effort */ }
      await this.atomicWrite(filePath, fallback)
      return fallback
    }
  }

  private async atomicWrite(filePath: string, value: unknown) {
    await mkdir(path.dirname(filePath), { recursive: true })
    const temporaryPath = `${filePath}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
    await rename(temporaryPath, filePath)
  }
}
