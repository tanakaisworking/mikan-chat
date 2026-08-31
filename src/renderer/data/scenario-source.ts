import { characters, type Character } from "@/data/characters"
import { resolveChatPackText } from "@/lib/chat-pack-template"

export type ScenarioSummary = {
  id: string
  slug: string
  title: string
  characterName: string
  summary: string
  coverPath: string | null
  rating: "all" | "r15" | "r18"
  tags: string[]
  conversationLabel: string
  lastMessage: string
  lastActive: string
  opening?: Array<{
    role: "narration" | "character" | "user"
    text: string
    speakerName?: string
    image?: string | null
  }>
  pack: Record<string, unknown>
}

export function scenarioToCharacter(scenario: ScenarioSummary): Character {
  return {
    id: scenario.id,
    name: scenario.characterName,
    packTitle: scenario.title,
    tags: scenario.tags,
    conversationLabel: scenario.conversationLabel,
    description: scenario.summary,
    lastMessage: resolveChatPackText(scenario.lastMessage),
    lastActive: scenario.lastActive,
    image: scenario.coverPath ?? undefined,
    stageImage: scenario.coverPath ?? undefined,
    opening: scenario.opening?.map((event) => ({ ...event, text: resolveChatPackText(event.text), image: event.image ?? undefined })),
    pack: scenario.pack,
  }
}

export async function loadScenarios(): Promise<Character[]> {
  if (window.mikan) return characters

  const response = await fetch("/api/scenarios")
  if (!response.ok) throw new Error("シナリオを読み込めませんでした。")

  const payload = await response.json() as { items?: unknown }
  if (!Array.isArray(payload.items) || !payload.items.every(isScenarioSummary)) {
    throw new Error("シナリオデータの形式が正しくありません。")
  }

  return payload.items.map(scenarioToCharacter)
}

function isScenarioSummary(value: unknown): value is ScenarioSummary {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return typeof item.id === "string"
    && typeof item.slug === "string"
    && typeof item.title === "string"
    && typeof item.characterName === "string"
    && typeof item.summary === "string"
    && (typeof item.coverPath === "string" || item.coverPath === null)
    && (item.rating === "all" || item.rating === "r15" || item.rating === "r18")
    && Array.isArray(item.tags)
    && item.tags.every((tag) => typeof tag === "string")
    && typeof item.conversationLabel === "string"
    && typeof item.lastMessage === "string"
    && typeof item.lastActive === "string"
    && (item.opening === undefined || isOpening(item.opening))
    && isRecord(item.pack)
}

function isOpening(value: unknown): value is NonNullable<ScenarioSummary["opening"]> {
  return Array.isArray(value) && value.every((event) => {
    if (!event || typeof event !== "object") return false
    const item = event as Record<string, unknown>
    return (item.role === "narration" || item.role === "character" || item.role === "user")
      && typeof item.text === "string"
      && (item.speakerName === undefined || typeof item.speakerName === "string")
      && (item.image === undefined || item.image === null || typeof item.image === "string")
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
