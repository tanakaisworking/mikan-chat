import { zipSync } from "fflate"

import validateSchema from "@/lib/generated/chat-pack-validator.js"
import { getChatPackSemanticIssue } from "@/lib/chat-pack-semantics"
import { ChatPackError, loadChatPack, type LoadedChatPack } from "@/lib/chat-pack"
import { getAudioComId, type BgmPreference } from "@/lib/audio-com"
import { chatPackSchema, formatPackIssues } from "@/lib/pack-authoring/schemas"
import type { DraftAsset, PackDraft } from "@/lib/pack-authoring/types"

//取り込み側（chat-pack.ts）と合わせる。受け入れ判定は取り込みと同じにする。
const LIMITS = {
  archive: 32 * 1024 * 1024,
  expanded: 64 * 1024 * 1024,
  entries: 64,
  file: 16 * 1024 * 1024,
  json: 512 * 1024,
} as const

const IMAGE_EXTENSIONS = new Set(["webp", "png", "jpg", "jpeg"])
const AUDIO_EXTENSIONS = new Set(["wav", "mp3", "flac", "m4a"])

export class PackAuthoringError extends Error {}

export function sanitizeAssetName(fileName: string, fallback: string) {
  const base = fileName.split("/").pop() ?? ""
  const cleaned = base.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$|^\.+/g, "")
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z0-9]+$/.test(cleaned)) return fallback
  return cleaned
}

export function uniqueAssetPath(used: Set<string>, fileName: string, fallback: string) {
  const sanitized = sanitizeAssetName(fileName, fallback)
  const dot = sanitized.lastIndexOf(".")
  const stem = sanitized.slice(0, dot)
  const extension = sanitized.slice(dot)
  let candidate = `assets/${sanitized}`
  let counter = 2
  while (used.has(candidate)) {
    candidate = `assets/${stem}-${counter}${extension}`
    counter += 1
  }
  used.add(candidate)
  return candidate
}

export function dataUrlToBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(",")
  if (!dataUrl.startsWith("data:") || comma < 0) throw new PackAuthoringError("素材データを読み込めませんでした。")
  try {
    const binary = atob(dataUrl.slice(comma + 1))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return bytes
  } catch {
    throw new PackAuthoringError("素材データを読み込めませんでした。")
  }
}

export async function fileToDraftAsset(file: File, allowed: "image" | "audio"): Promise<DraftAsset> {
  const extensions = allowed === "image" ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  const mimeOk = allowed === "image" ? file.type.startsWith("image/") : file.type.startsWith("audio/")
  if (!extensions.has(extension) || !mimeOk) {
    throw new PackAuthoringError(allowed === "image" ? "webp・png・jpgの画像を選んでください。" : "wav・mp3・flac・m4aの音声を選んでください。")
  }
  if (file.size === 0 || file.size > LIMITS.file) {
    throw new PackAuthoringError("ファイルが大きすぎます。16MBまでのファイルを使ってください。")
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new PackAuthoringError("ファイルを読み込めませんでした。"))
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new PackAuthoringError("ファイルを読み込めませんでした。"))
    reader.readAsDataURL(file)
  })
  return { fileName: file.name, mimeType: file.type, size: file.size, dataUrl }
}

function splitList(value: string) {
  return [...new Set(value.split(/[、,\n]/).map((item) => item.trim()).filter(Boolean))]
}

function parseSeed(value: string) {
  if (!value.trim()) return undefined
  const seed = Number(value.trim())
  if (!Number.isInteger(seed) || seed < -2147483648 || seed > 2147483647) {
    throw new PackAuthoringError("シードは-2147483648〜2147483647の整数にしてください。")
  }
  return seed
}

async function fetchPublicBytes(url: string) {
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new PackAuthoringError("同梱BGMを埋め込めませんでした。ファイルをダウンロードして「音声ファイルを読み込む」から指定してください。")
  }
  if (!response.ok) {
    throw new PackAuthoringError("同梱BGMを埋め込めませんでした。ファイルをダウンロードして「音声ファイルを読み込む」から指定してください。")
  }
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength === 0 || buffer.byteLength > LIMITS.file) {
    throw new PackAuthoringError("BGMファイルが大きすぎます。")
  }
  return new Uint8Array(buffer)
}

function extensionOf(fileName: string, fallback: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? ""
  return extension || fallback
}

export type BuiltPackFiles = {
  pack: Record<string, unknown>
  files: Record<string, Uint8Array>
}

export async function buildPackFiles(draft: PackDraft, bgm: BgmPreference): Promise<BuiltPackFiles> {
  const used = new Set<string>()
  const files: Record<string, Uint8Array> = {}
  const putAsset = (fileName: string, fallback: string, bytes: Uint8Array) => {
    const assetPath = uniqueAssetPath(used, fileName, fallback)
    files[assetPath] = bytes
    return assetPath
  }

  const covers: string[] = []
  if (draft.cover) {
    covers.push(putAsset(draft.cover.fileName, "cover.webp", dataUrlToBytes(draft.cover.dataUrl)))
  }

  const characters = draft.characters.map((character) => {
    const voiceTraits = splitList(character.voice.traits)
    const profile: Record<string, unknown> = { language: character.voice.language ?? "ja" }
    if (character.voice.gender) profile.gender = character.voice.gender
    if (character.voice.description.trim()) profile.description = character.voice.description.trim()
    if (voiceTraits.length) profile.traits = voiceTraits
    if (character.voice.speed !== undefined) profile.speed = character.voice.speed
    if (character.voice.pitch !== undefined) profile.pitch = character.voice.pitch
    const voice: Record<string, unknown> = { profile }
    if (character.voice.referenceAudio) {
      const assetPath = putAsset(
        character.voice.referenceAudio.fileName,
        `voice-${character.id || "character"}.wav`,
        dataUrlToBytes(character.voice.referenceAudio.dataUrl),
      )
      voice.referenceAudio = { asset: assetPath }
    }
    const caption = character.voice.caption.trim()
    const seed = parseSeed(character.voice.seed)
    if (caption || seed !== undefined) {
      voice.preferred = [{
        provider: "irodori-tts",
        voiceId: `${character.id || "character"}-voice`,
        ...(caption || seed !== undefined ? { parameters: { ...(caption ? { caption } : {}), ...(seed !== undefined ? { seed } : {}) } } : {}),
      }]
    }
    return {
      id: character.id.trim(),
      name: character.name.trim(),
      profile: character.profile.trim(),
      ...(character.image
        ? { image: putAsset(character.image.fileName, `${character.id.trim() || "character"}.webp`, dataUrlToBytes(character.image.dataUrl)) }
        : {}),
      voice,
    }
  })

  const opening = draft.opening.map((event) => {
    const image = event.image
      ? putAsset(event.image.fileName, "scene.webp", dataUrlToBytes(event.image.dataUrl))
      : null
    const imageEntry = image ? { image } : {}
    return event.type === "narration"
      ? { type: "narration" as const, text: event.text.trim(), ...imageEntry }
      : { type: "dialogue" as const, speaker: event.speaker.trim(), text: event.text.trim(), ...imageEntry }
  })

  const extensions: Record<string, unknown> = {
    "mikan.recommendation": { targetAudiences: [draft.audience] },
  }
  if (bgm.customFile) {
    extensions["mikan.bgm"] = {
      audio: putAsset(bgm.customFile.name, `bgm.${extensionOf(bgm.customFile.name, "m4a")}`, dataUrlToBytes(bgm.customFile.dataUrl)),
    }
  } else if (bgm.customUrl) {
    const audioComId = getAudioComId(bgm.customUrl)
    if (audioComId) {
      extensions["mikan.bgm"] = { provider: "audio.com", id: audioComId }
    } else {
      const bytes = await fetchPublicBytes(bgm.customUrl)
      extensions["mikan.bgm"] = { audio: putAsset(bgm.customUrl, `bgm.${extensionOf(bgm.customUrl, "m4a")}`, bytes) }
    }
  }

  const pack = {
    spec: "mikan.chat-pack",
    specVersion: "0.1",
    id: crypto.randomUUID(),
    version: "1.0.0",
    language: "ja",
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    author: {
      name: draft.authorName.trim(),
      ...(draft.authorUrl.trim() ? { url: draft.authorUrl.trim() } : {}),
    },
    license: draft.license.trim() || "All-Rights-Reserved",
    ...(draft.kept?.licenseNotice !== undefined ? { licenseNotice: draft.kept.licenseNotice } : {}),
    rating: draft.rating,
    discovery: {
      ...(covers.length ? { covers } : {}),
      ...(splitList(draft.tags).length ? { tags: splitList(draft.tags) } : {}),
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
      ...(draft.kept?.authorComment !== undefined ? { authorComment: draft.kept.authorComment } : {}),
      ...(draft.kept?.credits !== undefined ? { credits: draft.kept.credits } : {}),
    },
    plot: {
      premise: draft.premise.trim(),
      ...(draft.instructions.trim() ? { instructions: draft.instructions.trim() } : {}),
      characters,
      opening,
      ...(draft.kept?.playerProfiles !== undefined ? { playerProfiles: draft.kept.playerProfiles } : {}),
      ...(draft.kept?.defaultPlayerProfile !== undefined ? { defaultPlayerProfile: draft.kept.defaultPlayerProfile } : {}),
      ...(draft.kept?.narrator !== undefined ? { narrator: draft.kept.narrator } : {}),
      ...(draft.kept?.style !== undefined ? { style: draft.kept.style } : {}),
    },
    extensions,
  }

  return { pack: pack as Record<string, unknown>, files }
}

export type PackValidationIssue = {
  path: string
  message: string
}

export function validateBuiltPack(pack: unknown, files: Record<string, Uint8Array>): { pack: Record<string, unknown> } {
  const parsed = chatPackSchema.safeParse(pack)
  if (!parsed.success) {
    const error = new PackAuthoringError("入力内容に不備があります。")
    ;(error as { issues?: PackValidationIssue[] }).issues = formatPackIssues(parsed.error)
    throw error
  }
  if (!validateSchema(parsed.data)) {
    const details = (validateSchema.errors ?? []).map((entry) => `${entry.instancePath || "(全体)"} ${entry.message ?? ""}`.trim())
    const error = new PackAuthoringError("配布形式の検査に通りませんでした。")
    ;(error as { issues?: PackValidationIssue[] }).issues = details.map((message) => ({ path: "(全体)", message }))
    throw error
  }
  const semantic = getChatPackSemanticIssue(parsed.data)
  if (semantic) throw new PackAuthoringError(semantic)
  const entries = Object.entries(files)
  if (entries.length > LIMITS.entries) throw new PackAuthoringError("素材が多すぎます。64ファイルまでにしてください。")
  let expanded = 0
  for (const [, bytes] of entries) {
    if (bytes.byteLength > LIMITS.file) throw new PackAuthoringError("16MBを超える素材があります。")
    expanded += bytes.byteLength
  }
  if (expanded > LIMITS.expanded) throw new PackAuthoringError("パックが大きすぎます。")
  return { pack: parsed.data as Record<string, unknown> }
}

export async function exportPackBlob(draft: PackDraft, bgm: BgmPreference) {
  const { pack, files } = await buildPackFiles(draft, bgm)
  const { pack: validated } = validateBuiltPack(pack, files)
  const packJson = new TextEncoder().encode(JSON.stringify(validated))
  if (packJson.byteLength > LIMITS.json) throw new PackAuthoringError("パック情報が大きすぎます。")
  const archive = zipSync({ "pack.json": packJson, ...files }, { level: 6 })
  if (archive.byteLength > LIMITS.archive) throw new PackAuthoringError("パックが大きすぎます。32MBまでにしてください。")
  return {
    blob: new Blob([archive], { type: "application/zip" }),
    fileName: `${(validated.id as string)}.mikanchat`,
  }
}

export async function importExportedPack(blob: Blob, fileName: string): Promise<LoadedChatPack> {
  try {
    return await loadChatPack(new File([blob], fileName))
  } catch (cause) {
    if (cause instanceof ChatPackError) throw new PackAuthoringError(cause.message)
    throw new PackAuthoringError("パックを取り込めませんでした。")
  }
}
