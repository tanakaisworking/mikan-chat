import { writeBgmPreference } from "@/lib/audio-com"
import { AUTHORING_DRAFT_SCENARIO_ID, createEmptyCharacter, nextDraftKey, type DraftAsset, type PackDraft } from "@/lib/pack-authoring/types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

const MIME_BY_EXTENSION: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  mp4: "video/mp4",
}

export function guessMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? ""
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream"
}

export async function bytesToDataUrl(bytes: Uint8Array<ArrayBuffer>, mime: string) {
  const blob = new Blob([bytes], { type: mime })
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("素材を読み込めませんでした。"))
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("素材を読み込めませんでした。"))
    reader.readAsDataURL(blob)
  })
}

export async function fetchAssetBytes(url: string, fileName: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`素材を取得できませんでした: ${fileName}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const mime = guessMimeType(fileName)
  return { bytes, mime, dataUrl: await bytesToDataUrl(bytes, mime), size: bytes.byteLength }
}

function preferredIrodori(voice: Record<string, unknown>) {
  const preferred = Array.isArray(voice.preferred) ? voice.preferred : []
  return preferred.find((item): item is Record<string, unknown> =>
    isRecord(item) && typeof item.provider === "string" && item.provider.includes("irodori")) ?? null
}

/** 配布パックを下書きへ戻す。IDはエクスポート時に振り直すため引き継がない。 */
export async function packToDraft(
  pack: Record<string, unknown>,
  assets: Record<string, string>,
  fetchOne: (url: string, fileName: string) => Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string; dataUrl: string; size: number }> = fetchAssetBytes,
) {
  const draft: PackDraft = {
    title: asString(pack.title),
    summary: asString(pack.summary),
    authorName: asString(isRecord(pack.author) ? pack.author.name : null),
    authorUrl: asString(isRecord(pack.author) ? pack.author.url : null),
    license: asString(pack.license, "All-Rights-Reserved"),
    rating: pack.rating === "r15" || pack.rating === "r18" ? pack.rating : "all",
    tags: "",
    description: "",
    audience: "all",
    hookline: "",
    cover: null,
    premise: "",
    instructions: "",
    characters: [],
    opening: [],
  }

  const discovery = isRecord(pack.discovery) ? pack.discovery : null
  draft.tags = asStringArray(discovery?.tags).join("、")
  draft.description = asString(discovery?.description)
  const hookline = isRecord(pack.extensions) ? pack.extensions["mikan.hookline"] : null
  draft.hookline = typeof hookline === "string" ? hookline.slice(0, 60) : ""
  const audiences = asStringArray(isRecord(pack.extensions) && isRecord(pack.extensions["mikan.recommendation"])
    ? (pack.extensions["mikan.recommendation"] as Record<string, unknown>).targetAudiences
    : null)
  if (audiences[0] === "men" || audiences[0] === "women") draft.audience = audiences[0]
  const coverPath = Array.isArray(discovery?.covers) && typeof discovery.covers[0] === "string" ? discovery.covers[0] : null
  if (coverPath && assets[coverPath]) {
    const fileName = coverPath.split("/").pop() ?? "cover.webp"
    const fetched = await fetchOne(assets[coverPath], fileName)
    draft.cover = { fileName, mimeType: fetched.mime, size: fetched.size, dataUrl: fetched.dataUrl }
  }

  const plot = isRecord(pack.plot) ? pack.plot : null
  draft.premise = asString(plot?.premise)
  draft.instructions = asString(plot?.instructions)
  const rawCharacters = Array.isArray(plot?.characters) ? plot.characters : []
  draft.characters = await Promise.all(rawCharacters.map(async (raw, index): Promise<PackDraft["characters"][number]> => {
    const source = isRecord(raw) ? raw : {}
    const character = createEmptyCharacter(nextDraftKey())
    character.id = asString(source.id, `character${index + 1}`)
    character.name = asString(source.name)
    character.profile = asString(source.profile)
    const imagePath = typeof source.image === "string" ? source.image : null
    if (imagePath && assets[imagePath]) {
      const fileName = imagePath.split("/").pop() ?? `${character.id}.webp`
      const fetched = await fetchOne(assets[imagePath], fileName)
      character.image = { fileName, mimeType: fetched.mime, size: fetched.size, dataUrl: fetched.dataUrl }
    }
    const voice = isRecord(source.voice) ? source.voice : null
    const profile = isRecord(voice?.profile) ? voice.profile : null
    const gender = profile?.gender
    const traits = Array.isArray(profile?.traits) ? profile.traits.filter((trait): trait is string => typeof trait === "string") : []
    const preferred = voice ? preferredIrodori(voice) : null
    const parameters = isRecord(preferred?.parameters) ? preferred.parameters : null
    let referenceAudio: DraftAsset | null = null
    const reference = isRecord(voice?.referenceAudio) ? voice.referenceAudio : null
    const referencePath = typeof reference?.asset === "string" ? reference.asset : null
    if (referencePath && assets[referencePath]) {
      const fileName = referencePath.split("/").pop() ?? `voice-${character.id}.wav`
      const fetched = await fetchOne(assets[referencePath], fileName)
      referenceAudio = { fileName, mimeType: fetched.mime, size: fetched.size, dataUrl: fetched.dataUrl }
    }
    character.voice = {
      gender: gender === "male" || gender === "female" ? gender : "",
      description: asString(profile?.description),
      traits: traits.join("、"),
      caption: asString(parameters?.caption),
      seed: parameters?.seed !== undefined && Number.isInteger(parameters.seed) ? String(parameters.seed) : "",
      referenceAudio,
      ...(typeof profile?.speed === "number" ? { speed: profile.speed } : {}),
      ...(typeof profile?.pitch === "number" ? { pitch: profile.pitch } : {}),
      ...(typeof profile?.language === "string" ? { language: profile.language } : {}),
    }
    return character
  }))

  const rawOpening = Array.isArray(plot?.opening) ? plot.opening : []
  const openingImages = new Map<string, DraftAsset>()
  for (const raw of rawOpening) {
    if (isRecord(raw) && typeof raw.image === "string" && assets[raw.image] && !openingImages.has(raw.image)) {
      const fileName = raw.image.split("/").pop() ?? "scene.webp"
      const fetched = await fetchOne(assets[raw.image], fileName)
      openingImages.set(raw.image, { fileName, mimeType: fetched.mime, size: fetched.size, dataUrl: fetched.dataUrl })
    }
  }
  const imageOf = (path: string | null) => {
    if (!path) return undefined
    const found = openingImages.get(path)
    return found ? { ...found } : undefined
  }
  draft.opening = rawOpening.flatMap((raw): PackDraft["opening"] => {
    if (!isRecord(raw) || typeof raw.text !== "string") return []
    if (raw.type === "dialogue" && typeof raw.speaker === "string") {
      const image = typeof raw.image === "string" ? imageOf(raw.image) : undefined
      return [{ key: nextDraftKey(), type: "dialogue", speaker: raw.speaker, text: raw.text, ...(image ? { image } : {}) }]
    }
    if (raw.type === "narration") {
      const image = typeof raw.image === "string" ? imageOf(raw.image) : undefined
      return [{ key: nextDraftKey(), type: "narration", text: raw.text, ...(image ? { image } : {}) }]
    }
    return []
  })

  draft.kept = keepBlocks(pack, discovery, plot)
  return draft
}

function keepBlocks(pack: Record<string, unknown>, discovery: Record<string, unknown> | null, plot: Record<string, unknown> | null) {
  const kept: NonNullable<PackDraft["kept"]> = {}
  if (typeof pack.licenseNotice === "string") kept.licenseNotice = pack.licenseNotice
  if (discovery && discovery.authorComment !== undefined) kept.authorComment = discovery.authorComment
  if (discovery && discovery.credits !== undefined) kept.credits = discovery.credits
  if (plot && plot.playerProfiles !== undefined) kept.playerProfiles = plot.playerProfiles
  if (plot && plot.defaultPlayerProfile !== undefined) kept.defaultPlayerProfile = plot.defaultPlayerProfile
  if (plot && plot.narrator !== undefined) kept.narrator = plot.narrator
  if (plot && plot.style !== undefined) kept.style = plot.style
  return kept
}

/** パックのBGM指定を作成画面の選択として復元する。大きすぎて残せない場合は false を返す。 */
export async function packToDraftBgm(
  pack: Record<string, unknown>,
  assets: Record<string, string>,
  fetchOne: (url: string, fileName: string) => Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string; dataUrl: string; size: number }> = fetchAssetBytes,
) {
  const bgm = isRecord(pack.extensions) && isRecord(pack.extensions["mikan.bgm"]) ? pack.extensions["mikan.bgm"] : null
  if (!bgm) {
    writeBgmPreference(AUTHORING_DRAFT_SCENARIO_ID, { customUrl: null, volume: 20, enabled: true })
    return true
  }
  if (bgm.provider === "audio.com") {
    const source = typeof bgm.id === "string" ? bgm.id : typeof bgm.url === "string" ? bgm.url : null
    if (source) {
      return writeBgmPreference(AUTHORING_DRAFT_SCENARIO_ID, { customUrl: source, volume: 20, enabled: true })
    }
    return true
  }
  if (typeof bgm.audio === "string" && assets[bgm.audio]) {
    const fileName = bgm.audio.split("/").pop() ?? "bgm.m4a"
    const fetched = await fetchOne(assets[bgm.audio], fileName)
    return writeBgmPreference(AUTHORING_DRAFT_SCENARIO_ID, {
      customUrl: null,
      volume: 20,
      enabled: true,
      customFile: { name: fileName, dataUrl: fetched.dataUrl },
    })
  }
  return true
}
