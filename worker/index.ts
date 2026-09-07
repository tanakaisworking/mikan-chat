import validateChatPack from "../src/renderer/lib/generated/chat-pack-validator.js"
import { getChatPackSemanticIssue } from "../src/renderer/lib/chat-pack-semantics"
import { resolveAudioComStreamUrl } from "../src/shared/audio-com"

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/api/health") {
      return Response.json(
        { status: "ok", service: "mikan-chat-web" },
        { headers: { "Cache-Control": "no-store" } },
      )
    }

    if (url.pathname === "/api/scenarios") {
      if (request.method !== "GET") {
        return Response.json(
          { error: "Method not allowed" },
          { status: 405, headers: { "Cache-Control": "no-store", Allow: "GET" } },
        )
      }

      try {
        const { results } = await env.DB.prepare(
          `SELECT id, slug, title, character_name, summary, cover_path, rating, display_json, pack_json
           FROM scenarios
           WHERE status = ?
             AND rating != ?
             AND json_valid(pack_json)
             AND json_extract(pack_json, '$.rating') != ?
           ORDER BY sort_order ASC, created_at ASC`,
        ).bind("published", "r18", "r18").all<ScenarioRow>()

        const items = results.map(toScenarioSummary).filter((item) => item.pack !== null && item.rating !== "r18")

        return Response.json(
          { items },
          { headers: { "Cache-Control": "public, max-age=60" } },
        )
      } catch (error) {
        console.error(JSON.stringify({ event: "scenario_list_failed", error: error instanceof Error ? error.message : String(error) }))
        return Response.json(
          { error: "シナリオを読み込めませんでした。" },
          { status: 500, headers: { "Cache-Control": "no-store" } },
        )
      }
    }

    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/bgm/audio-com") {
        if (request.method !== "GET") {
          return Response.json({ error: "Method not allowed" }, { status: 405, headers: { "Cache-Control": "no-store", Allow: "GET" } })
        }
        return resolveAudioComStream(url.searchParams.get("source"))
      }

      return Response.json(
        { error: "Not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      )
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

/** Web-only proxy: browsers cannot call api.audio.com directly because it sends no CORS headers. */
async function resolveAudioComStream(source: string | null): Promise<Response> {
  const noStore = { "Cache-Control": "no-store" }
  if (!source) return Response.json({ error: "BGMの指定がありません。" }, { status: 400, headers: noStore })

  try {
    const resolved = await resolveAudioComStreamUrl(source)
    // Presigned links last days; cache well inside that window so playback keeps a valid URL.
    return Response.json(resolved, { headers: { "Cache-Control": "public, max-age=3600" } })
  } catch (error) {
    console.error(JSON.stringify({ event: "audio_com_resolve_failed", error: error instanceof Error ? error.message : String(error) }))
    const message = error instanceof Error ? error.message : "BGMを読み込めませんでした。"
    const status = message.includes("特定できません") ? 400 : 502
    return Response.json({ error: message }, { status, headers: noStore })
  }
}

type ScenarioRow = {
  id: string
  slug: string
  title: string
  character_name: string
  summary: string
  cover_path: string | null
  rating: "all" | "r15" | "r18"
  display_json: string
  pack_json: string
}

export function toScenarioSummary(row: ScenarioRow) {
  let display: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(row.display_json)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) display = parsed as Record<string, unknown>
  } catch {
    console.warn(JSON.stringify({ event: "invalid_scenario_display_json", scenarioId: row.id }))
  }

  const tags = Array.isArray(display.tags) && display.tags.every((tag) => typeof tag === "string") ? display.tags : []
  const pack = parsePack(row.pack_json)
  const characters = pack ? readCharacters(pack) : []
  const opening = pack ? readOpening(pack, characters, row.cover_path) : []
  const packDiscovery = pack && isRecord(pack.discovery) ? pack.discovery : null
  const packTags = packDiscovery && Array.isArray(packDiscovery.tags) && packDiscovery.tags.every((tag) => typeof tag === "string") ? packDiscovery.tags : tags
  const packDescription = packDiscovery && typeof packDiscovery.description === "string" ? packDiscovery.description : row.summary
  const characterNames = characters.map((character) => character.name)
  const lastDialogue = [...opening].reverse().find((event) => event.role === "character")?.text

  return {
    id: row.id,
    publicId: pack && typeof pack.id === "string" ? pack.id : null,
    slug: row.slug,
    title: pack && typeof pack.title === "string" ? pack.title : row.title,
    characterName: characterNames.length > 0 ? characterNames.join("・") : row.character_name,
    summary: packDescription,
    coverPath: row.cover_path,
    rating: pack && (pack.rating === "all" || pack.rating === "r15" || pack.rating === "r18") ? pack.rating : row.rating,
    tags: packTags,
    conversationLabel: characters.length > 0 ? `${characters.length}人と会話` : typeof display.conversationLabel === "string" ? display.conversationLabel : "1人と会話",
    lastMessage: lastDialogue ?? (typeof display.lastMessage === "string" ? display.lastMessage : row.summary),
    lastActive: typeof display.lastActive === "string" ? display.lastActive : "",
    opening,
    pack,
  }
}

type PackCharacter = { id: string; name: string }
type OpeningEvent = {
  role: "narration" | "character" | "user"
  text: string
  speakerName?: string
  image: string | null
}

function parsePack(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) && validateChatPack(parsed) && getChatPackSemanticIssue(parsed) === null ? parsed : null
  } catch {
    return null
  }
}

function readCharacters(pack: Record<string, unknown>): PackCharacter[] {
  if (!isRecord(pack.plot) || !Array.isArray(pack.plot.characters)) return []
  return pack.plot.characters.flatMap((value) => isRecord(value) && typeof value.id === "string" && typeof value.name === "string"
    ? [{ id: value.id, name: value.name }]
    : [])
}

function readOpening(pack: Record<string, unknown>, characters: PackCharacter[], coverPath: string | null): OpeningEvent[] {
  if (!isRecord(pack.plot) || !Array.isArray(pack.plot.opening)) return []
  const names = new Map(characters.map((character) => [character.id, character.name]))
  const coverAsset = isRecord(pack.discovery) && Array.isArray(pack.discovery.covers) && typeof pack.discovery.covers[0] === "string"
    ? pack.discovery.covers[0]
    : null
  const opening: OpeningEvent[] = []
  for (const value of pack.plot.opening) {
    if (!isRecord(value) || typeof value.text !== "string") continue
    const image = value.image === coverAsset ? coverPath : null
    if (value.type === "narration") opening.push({ role: "narration", text: value.text, image })
    if (value.type !== "dialogue" || typeof value.speaker !== "string") continue
    if (value.speaker === "user") opening.push({ role: "user", text: value.text, image: null })
    else opening.push({ role: "character", text: value.text, speakerName: names.get(value.speaker) ?? value.speaker, image })
  }
  return opening
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
