import type { Character } from "@/data/characters"
import type { TtsSpeakOptions } from "@/lib/tts"

export type ScenarioVoiceSelection = {
  characterId: string
  voiceId: string
  caption: string
  seed: number
  scenarioVersion: string
}

export type ScenarioVoiceDesign = {
  caption: string
  seeds: [number, number, number]
  sampleText: string
  characterId: string
  characterName: string
}

export function resolveScenarioVoice(character: Character, speakerName?: string, selections?: ScenarioVoiceSelection | ScenarioVoiceSelection[] | null): TtsSpeakOptions | undefined {
  const plot = isRecord(character.pack?.plot) ? character.pack.plot : null
  const characters = Array.isArray(plot?.characters) ? plot.characters.filter(isRecord) : []
  const target = characters.find((item) => speakerName && item.name === speakerName) ?? characters[0]
  if (!target) return undefined

  const selection = (Array.isArray(selections) ? selections : selections ? [selections] : [])
    .find((item) => item.characterId === target.id)
  if (selection && selection.scenarioVersion === scenarioVersion(character)) {
    return { voiceId: selection.voiceId, caption: selection.caption, seed: selection.seed }
  }
  if (!isRecord(target.voice)) return undefined

  const profile = isRecord(target.voice.profile) ? target.voice.profile : null
  const preferred = Array.isArray(target.voice.preferred)
    ? target.voice.preferred.find((item) => isRecord(item) && (item.provider === "irodori" || item.provider === "irodori-tts"))
    : null
  const parameters = preferred && isRecord(preferred.parameters) ? preferred.parameters : null
  const referenceAsset = isRecord(target.voice.referenceAudio) && typeof target.voice.referenceAudio.asset === "string"
    ? target.voice.referenceAudio.asset
    : null
  const source = referenceAsset ? character.assets?.[referenceAsset] : undefined
  const traits = Array.isArray(profile?.traits) ? profile.traits.filter((trait): trait is string => typeof trait === "string" && Boolean(trait.trim())) : []
  const caption = normalizeCaption(typeof parameters?.caption === "string"
    ? parameters.caption
    : typeof profile?.description === "string" ? profile.description : traits.length ? `声の特徴: ${traits.join("、")}` : undefined)
  const seed = validSeed(parameters?.seed) ? parameters.seed : undefined
  const preferredVoiceId = preferred && typeof preferred.voiceId === "string" ? preferred.voiceId : typeof target.id === "string" ? target.id : "voice"

  if (!caption && seed === undefined && !source) return undefined
  return {
    caption,
    seed,
    ...(source && typeof target.id === "string" && typeof character.pack?.id === "string" ? {
      referenceAudio: {
        source,
        voiceId: `mikan-${character.pack.id}-${preferredVoiceId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64)}-${typeof character.pack.version === "string" ? character.pack.version.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40) : "1"}`,
        fileName: referenceAsset!.split("/").pop() ?? "reference.wav",
      },
    } : {}),
  }
}

export function getScenarioVoiceDesign(character: Character): ScenarioVoiceDesign | null {
  return getScenarioVoiceDesigns(character)[0] ?? null
}

export function getScenarioVoiceDesigns(character: Character): ScenarioVoiceDesign[] {
  const plot = isRecord(character.pack?.plot) ? character.pack.plot : null
  const characters = Array.isArray(plot?.characters) ? plot.characters.filter(isRecord) : []
  const opening = plot && Array.isArray(plot.opening) ? plot.opening.filter(isRecord) : []
  return characters.flatMap((target): ScenarioVoiceDesign[] => {
    if (typeof target.id !== "string") return []
    const voice = isRecord(target.voice) ? target.voice : null
    const profile = voice && isRecord(voice.profile) ? voice.profile : null
    const preferred = voice && Array.isArray(voice.preferred)
      ? voice.preferred.find((item) => isRecord(item) && (item.provider === "irodori" || item.provider === "irodori-tts"))
      : null
    const parameters = preferred && isRecord(preferred.parameters) ? preferred.parameters : null
    const traits = Array.isArray(profile?.traits) ? profile.traits.filter((trait): trait is string => typeof trait === "string" && Boolean(trait.trim())) : []
    const characterName = typeof target.name === "string" ? target.name : character.name
    const profileCaption = typeof profile?.description === "string"
      ? profile.description
      : traits.length ? `声の特徴: ${traits.join("、")}` : `${characterName}らしい自然な声。`
    const caption = normalizeCaption(typeof parameters?.caption === "string" ? parameters.caption : profileCaption) ?? `${characterName}らしい自然な声。`
    const baseSeed = validSeed(parameters?.seed) ? parameters.seed : stableSeed(`${character.id}:${target.id}`)
    const sample = opening.find((event) => event.type === "dialogue" && event.speaker === target.id && typeof event.text === "string")
    return [{
      caption,
      seeds: [baseSeed, (baseSeed + 1) % 2_147_483_647, (baseSeed + 2) % 2_147_483_647],
      sampleText: normalizeSampleText(sample?.text),
      characterId: target.id,
      characterName,
    }]
  })
}

export function hasScenarioReferenceAudio(character: Character, characterId?: string) {
  const plot = isRecord(character.pack?.plot) ? character.pack.plot : null
  const targets = Array.isArray(plot?.characters) ? plot.characters.filter(isRecord) : []
  const target = characterId ? targets.find((item) => item.id === characterId) : targets[0]
  const reference = target && isRecord(target.voice) && isRecord(target.voice.referenceAudio) ? target.voice.referenceAudio : null
  return typeof reference?.asset === "string" && Boolean(character.assets?.[reference.asset])
}

export function scenarioVersion(character: Character) {
  return typeof character.pack?.version === "string" ? character.pack.version : "1"
}

export function createScenarioVoiceId(character: Character, characterId: string) {
  const packId = typeof character.pack?.id === "string" ? character.pack.id : character.id
  return `mikan-user-${packId}-${characterId}-${scenarioVersion(character).replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40)}`.slice(0, 196)
}

export async function isScenarioVoiceConfirmed(
  character: Character,
  selection: ScenarioVoiceSelection | undefined,
  hasReference: (voiceId: string) => Promise<boolean>,
) {
  const design = getScenarioVoiceDesigns(character).find((item) => item.characterId === selection?.characterId)
  if (design && hasScenarioReferenceAudio(character, design.characterId)) return true
  return Boolean(
    design
    && selection?.characterId === design.characterId
    && selection.scenarioVersion === scenarioVersion(character)
    && selection.voiceId === createScenarioVoiceId(character, design.characterId)
    && await hasReference(selection.voiceId),
  )
}

function stableSeed(value: string) {
  let hash = 2_166_136_261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  return hash >>> 1
}

function validSeed(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647
}

function normalizeCaption(value: string | undefined) {
  const normalized = value?.trim().slice(0, 1_000)
  return normalized || undefined
}

function normalizeSampleText(value: unknown) {
  if (typeof value !== "string") return "こんにちは。これから、ゆっくりお話ししましょう。"
  return value.trim().slice(0, 200) || "こんにちは。これから、ゆっくりお話ししましょう。"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
