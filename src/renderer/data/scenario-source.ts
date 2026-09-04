import { characters, type Character } from "@/data/characters"
import { resolveChatPackText } from "@/lib/chat-pack-template"
import { readScenarioRecommendation } from "@/lib/scenario-recommendation"
import { isDesktopApp } from "@/lib/platform"

const bundledPacks = import.meta.glob("../../../examples/*/pack.json", { eager: true, import: "default" }) as Record<string, Record<string, unknown>>
const bundledAssets = import.meta.glob("../../../examples/*/assets/*.{webp,png,jpg,jpeg}", { eager: true, query: "?url", import: "default" }) as Record<string, string>

export type ScenarioSummary = {
  id: string
  publicId: string
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
    publicId: scenario.publicId,
    slug: scenario.slug,
    name: scenario.characterName,
    packTitle: scenario.title,
    tags: scenario.tags,
    recommendation: readScenarioRecommendation(scenario.pack),
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
  if (isDesktopApp()) {
    const bundled = Object.entries(bundledPacks).flatMap(([packPath, pack]) => {
      const directory = packPath.match(/examples\/([^/]+)\/pack\.json$/)?.[1]
      return directory ? toBundledCharacter(directory, pack) : []
    })
    return bundled.length > 0 ? bundled : characters
  }

  const response = await fetch("/api/scenarios")
  if (!response.ok) throw new Error("シナリオを読み込めませんでした。")

  const payload = await response.json() as { items?: unknown }
  if (!Array.isArray(payload.items) || !payload.items.every(isScenarioSummary)) {
    throw new Error("シナリオデータの形式が正しくありません。")
  }
  if (new Set(payload.items.map((item) => item.publicId)).size !== payload.items.length) {
    throw new Error("シナリオの公開IDが重複しています。")
  }

  return payload.items.map(scenarioToCharacter)
}

function toBundledCharacter(directory: string, pack: Record<string, unknown>): Character[] {
  const discovery = isRecord(pack.discovery) ? pack.discovery : null
  const plot = isRecord(pack.plot) ? pack.plot : null
  const rawCharacters = Array.isArray(plot?.characters) ? plot.characters.filter(isRecord) : []
  const primary = rawCharacters[0]
  if (typeof pack.id !== "string" || typeof pack.title !== "string" || typeof pack.summary !== "string" || !primary || typeof primary.name !== "string") return []
  const assetUrl = (assetPath: unknown) => {
    if (typeof assetPath !== "string") return undefined
    return bundledAssets[`../../../examples/${directory}/${assetPath}`]
  }
  const names = new Map(rawCharacters.flatMap((character) => typeof character.id === "string" && typeof character.name === "string" ? [[character.id, character.name] as const] : []))
  const opening: NonNullable<Character["opening"]> = []
  if (Array.isArray(plot?.opening)) plot.opening.forEach((value) => {
    if (!isRecord(value) || typeof value.text !== "string") return
    const image = assetUrl(value.image)
    if (value.type === "narration") opening.push({ role: "narration", text: resolveChatPackText(value.text), image })
    else if (value.type === "dialogue" && typeof value.speaker === "string") {
      if (value.speaker === "user") opening.push({ role: "user", text: resolveChatPackText(value.text), image })
      else opening.push({ role: "character", text: resolveChatPackText(value.text), speakerName: names.get(value.speaker) ?? value.speaker, image })
    }
  })
  const coverPath = Array.isArray(discovery?.covers) ? assetUrl(discovery.covers[0]) : undefined
  const stageImage = assetUrl(primary.image) ?? coverPath
  const lastMessage = [...opening].reverse().find((event) => event.role === "character")?.text ?? pack.summary

  return [{
    id: pack.id,
    publicId: pack.id,
    slug: pack.id,
    name: primary.name,
    packTitle: pack.title,
    tags: Array.isArray(discovery?.tags) ? discovery.tags.filter((tag): tag is string => typeof tag === "string") : [],
    recommendation: readScenarioRecommendation(pack),
    description: typeof discovery?.description === "string" ? discovery.description : pack.summary,
    lastMessage,
    lastActive: "新着",
    image: coverPath ?? stageImage,
    stageImage,
    opening,
    pack,
  }]
}

function isScenarioSummary(value: unknown): value is ScenarioSummary {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return typeof item.id === "string"
    && typeof item.publicId === "string"
    && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(item.publicId)
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
