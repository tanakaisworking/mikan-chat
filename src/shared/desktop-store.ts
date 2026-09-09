import { z } from "zod"

const connectionSchema = z.object({
  type: z.enum(["builtin", "local", "online"]),
  endpoint: z.string(),
  model: z.string(),
})

const connectionFileSchema = z.object({
  type: z.enum(["builtin", "local", "online"]),
  endpoint: z.string(),
  model: z.string(),
  builtinAI: z.boolean().optional(),
})

const ttsSchema = z.object({
  provider: z.enum(["browser", "kokoro", "irodori", "openai-compatible", "elevenlabs"]),
  endpoint: z.string(),
  model: z.string(),
  voice: z.string(),
  irodoriQuality: z.enum(["fast", "balanced", "quality"]).optional(),
})

const profileSchema = z.object({
  gender: z.enum(["woman", "man", "nonbinary", "prefer-not-to-say"]),
  birthYear: z.number().int().min(1900).max(2200),
  favoriteGenres: z.array(z.string().min(1)),
})

const appearanceSchema = z.object({
  textSize: z.enum(["small", "medium", "large"]),
  theme: z.enum(["light", "dark"]),
})

const scenarioVoiceSelectionSchema = z.object({
  characterId: z.string().min(1).max(64),
  voiceId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(200),
  caption: z.string().trim().min(1).max(1_000),
  seed: z.number().int().min(0).max(2_147_483_647),
  scenarioVersion: z.string().min(1).max(100),
  gender: z.enum(["male", "female", "neutral"]).nullish(),
})

const scenarioVoicesSchema = z.record(z.string().min(1).max(512), scenarioVoiceSelectionSchema)
  .refine((voices) => Object.keys(voices).length <= 500, "保存できるキャラクター音声は500件までです。")

export const desktopSettingsInputSchema = z.object({
  connection: connectionSchema.extend({ apiKey: z.string() }),
  tts: ttsSchema.extend({ apiKey: z.string() }),
  profile: profileSchema.nullable(),
  appearance: appearanceSchema,
  readAloud: z.boolean(),
  scenarioVoices: scenarioVoicesSchema,
})

export const desktopSettingsFileSchema = z.object({
  version: z.literal(1),
  connection: connectionFileSchema,
  connectionSecret: z.string().nullable(),
  tts: ttsSchema,
  ttsSecret: z.string().nullable(),
  profile: profileSchema.nullable(),
  appearance: appearanceSchema,
  readAloud: z.boolean(),
  scenarioVoices: scenarioVoicesSchema.default({}),
})

export const desktopMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["narration", "character", "user"]),
  text: z.string(),
  time: z.string(),
  audio: z.boolean().optional(),
  speakerName: z.string().optional(),
  image: z.string().optional(),
})

export const desktopConversationSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  title: z.string().min(1),
  updatedAt: z.string().datetime(),
  messages: z.array(desktopMessageSchema).max(200),
  summary: z.string().max(8000).optional(),
  summaryThroughId: z.string().min(1).optional(),
})

export const desktopConversationInputSchema = desktopConversationSchema.extend({
  title: z.string().min(1).optional(),
})

export const desktopConversationsFileSchema = z.object({
  version: z.literal(1),
  items: z.array(desktopConversationSchema).max(50),
})

export type DesktopSettingsInput = z.infer<typeof desktopSettingsInputSchema>
export type DesktopSettingsFile = z.infer<typeof desktopSettingsFileSchema>
export type DesktopConversation = z.infer<typeof desktopConversationSchema>
export type DesktopConversationInput = z.infer<typeof desktopConversationInputSchema>

export type DesktopStoreLoadResult = {
  settings: DesktopSettingsInput
  recoveredCorruptData: boolean
  secretsAvailable: boolean
}
