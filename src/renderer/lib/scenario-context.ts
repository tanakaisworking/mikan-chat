import type { Character } from "@/data/characters"
import { resolveChatPackText } from "@/lib/chat-pack-template"

export type ScenarioContext = {
  title: string
  summary: string
  premise: string
  tags: string[]
  characters: Array<{ name: string; profile: string }>
  player: { name: string; description: string }
  author: string | null
  rating: string | null
}

export function readScenarioContext(character: Character): ScenarioContext {
  const pack = isRecord(character.pack) ? character.pack : null
  const plot = pack && isRecord(pack.plot) ? pack.plot : null
  const rawCharacters = Array.isArray(plot?.characters)
    ? plot.characters.flatMap((item) => isRecord(item) && typeof item.name === "string"
      ? [{ name: item.name, profile: typeof item.profile === "string" ? item.profile : "この物語の登場人物です。" }]
      : [])
    : []
  const playerProfiles = Array.isArray(plot?.playerProfiles)
    ? plot.playerProfiles.filter((item) => isRecord(item) && typeof item.name === "string" && typeof item.description === "string")
    : []
  const defaultPlayerId = typeof plot?.defaultPlayerProfile === "string" ? plot.defaultPlayerProfile : null
  const player = playerProfiles.find((item) => item.id === defaultPlayerId) ?? playerProfiles[0]
  const playerName = player ? String(player.name) : "物語の中のあなた"
  const characters = rawCharacters.map((character) => ({
    name: character.name,
    profile: resolveChatPackText(character.profile, playerName),
  }))
  const author = pack && isRecord(pack.author) && typeof pack.author.name === "string" ? pack.author.name : null
  const rating = pack?.rating === "r15" ? "R15" : pack?.rating === "r18" ? "R18" : pack?.rating === "all" ? "全年齢" : null

  return {
    title: character.packTitle ?? character.name,
    summary: resolveChatPackText(character.description, playerName),
    premise: resolveChatPackText(typeof plot?.premise === "string" ? plot.premise : character.description, playerName),
    tags: character.tags ?? [],
    characters: characters.length > 0 ? characters : [{ name: character.name, profile: character.description }],
    player: player
      ? { name: playerName, description: resolveChatPackText(String(player.description), playerName) }
      : { name: "物語の中のあなた", description: "あなた自身の言葉と選択で、登場人物との関係を作っていきます。" },
    author,
    rating,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
