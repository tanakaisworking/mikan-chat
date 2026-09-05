import { Unzip, UnzipInflate, type UnzipFile, type Unzipped } from "fflate"

import validateSchema from "@/lib/generated/chat-pack-validator.js"
import { getChatPackSemanticIssue } from "@/lib/chat-pack-semantics"

const limits = {
  archive: 32 * 1024 * 1024,
  expanded: 64 * 1024 * 1024,
  entries: 64,
  file: 16 * 1024 * 1024,
  json: 512 * 1024,
}

const allowedRootFiles = new Set(["pack.json", "LICENSE.txt"])
const imageAssetExtensions = new Set(["webp", "png", "jpg", "jpeg"])
const audioAssetExtensions = new Set(["wav", "mp3", "flac"])
const reservedCharacterIds = new Set(["user", "narrator"])
const decoder = new TextDecoder("utf-8", { fatal: true })
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const semverPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
const assetPathPattern = /^assets\/[a-z0-9][a-z0-9.-]*(?:\/[a-z0-9][a-z0-9.-]*)*$/

export type ChatPackEvent =
  | { type: "narration"; text: string; image?: string }
  | { type: "dialogue"; speaker: string; text: string; image?: string }

export type ChatPackCharacter = {
  id: string
  name: string
  profile: string
  image?: string
  voice?: ChatPackVoice
}

export type ChatPackVoice = {
  profile?: {
    language?: string
    description?: string
    traits?: string[]
    speed?: number
    pitch?: number
    [key: string]: unknown
  }
  referenceAudio?: {
    asset: string
    transcript?: string
    language?: string
    creator?: string
    source?: string
    license?: string
  }
  preferred?: Array<{
    provider: string
    voiceId: string
    parameters?: Record<string, unknown>
  }>
}

export type ChatPack = {
  spec: "mikan.chat-pack"
  specVersion: "0.1"
  id: string
  version: string
  language: string
  title: string
  summary: string
  author: { name: string; url?: string }
  license: string
  licenseNotice?: string
  rating: "all" | "r15" | "r18"
  discovery: {
    covers?: string[]
    tags?: string[]
    description?: string
    authorComment?: string
  }
  plot: {
    premise: string
    instructions?: string
    characters: ChatPackCharacter[]
    opening: ChatPackEvent[]
  }
}

export type LoadedChatPack = {
  fileName: string
  pack: ChatPack
  raw: Record<string, unknown>
  assets: Record<string, string>
}

export class ChatPackError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ChatPackError"
  }
}

export async function loadChatPack(file: File): Promise<LoadedChatPack> {
  if (!file.name.toLowerCase().endsWith(".mikanchat")) {
    throw new ChatPackError(".mikanchatファイルを選んでください。")
  }
  if (file.size > limits.archive) {
    throw new ChatPackError("ファイルサイズが32 MiBの上限を超えています。")
  }

  const entries = await extractArchive(await readFileBytes(file))
  const packData = entries["pack.json"]
  if (!packData) throw new ChatPackError("pack.jsonが見つかりません。")
  if (packData.length > limits.json) throw new ChatPackError("pack.jsonが大きすぎます。")

  let input: unknown
  try {
    input = JSON.parse(decoder.decode(packData))
  } catch {
    throw new ChatPackError("pack.jsonをJSONとして読み込めませんでした。")
  }

  const pack = validatePack(input)
  const raw = input as Record<string, unknown>
  const referencedAssets = collectAssetPaths(pack, raw)
  for (const assetPath of referencedAssets) {
    if (!entries[assetPath]) throw new ChatPackError(`画像が見つかりません: ${assetPath}`)
  }
  const assets: Record<string, string> = {}
  for (const [assetPath, data] of Object.entries(entries)) {
    if (!assetPath.startsWith("assets/")) continue
    const mime = detectAssetMime(data)
    if (!mime) throw new ChatPackError(`ファイル形式を確認できません: ${assetPath}`)
    if (!matchesAssetExtension(assetPath, mime)) throw new ChatPackError(`拡張子とファイル形式が一致しません: ${assetPath}`)
    if (mime.startsWith("image/")) await validateImage(data, mime, assetPath)
    assets[assetPath] = toDataUrl(data, mime)
  }

  return { fileName: file.name, pack, raw, assets }
}

function readFileBytes(file: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new ChatPackError("ファイルを読み込めませんでした。"))
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new ChatPackError("ファイルを読み込めませんでした。"))
        return
      }
      resolve(new Uint8Array(reader.result))
    }
    reader.readAsArrayBuffer(file)
  })
}

function extractArchive(data: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    const files: Unzipped = {}
    const activeFiles = new Set<UnzipFile>()
    let count = 0
    let expandedSize = 0
    let pending = 0
    let archiveRead = false
    let settled = false

    const stop = (error: unknown) => {
      if (settled) return
      settled = true
      for (const file of activeFiles) file.terminate()
      reject(error instanceof ChatPackError ? error : new ChatPackError("ZIPを展開できませんでした。"))
    }
    const finish = () => {
      if (!settled && archiveRead && pending === 0) {
        settled = true
        resolve(files)
      }
    }
    const archive = new Unzip((file) => {
      if (settled) return file.terminate()
      try {
        validateArchiveEntry(file)
        count += 1
        if (count > limits.entries) throw new ChatPackError("パック内のファイル数が多すぎます。")
        if (file.name.endsWith("/")) return file.terminate()

        pending += 1
        activeFiles.add(file)
        const chunks: Uint8Array[] = []
        let fileSize = 0
        file.ondata = (error, chunk, final) => {
          if (settled) return
          if (error) return stop(error)
          fileSize += chunk.length
          expandedSize += chunk.length
          if (fileSize > limits.file) return stop(new ChatPackError(`ファイルが大きすぎます: ${file.name}`))
          if (expandedSize > limits.expanded) return stop(new ChatPackError("展開後のサイズが64 MiBの上限を超えています。"))
          chunks.push(chunk)
          if (!final) return
          files[file.name] = joinChunks(chunks, fileSize)
          activeFiles.delete(file)
          pending -= 1
          finish()
        }
        file.start()
      } catch (error) {
        stop(error)
      }
    })
    archive.register(UnzipInflate)
    let offset = 0
    const pushNextChunk = () => {
      if (settled) return
      const end = Math.min(offset + 8 * 1024, data.length)
      try {
        archive.push(data.subarray(offset, end), end === data.length)
        offset = end
        if (end < data.length) {
          setTimeout(pushNextChunk, 0)
          return
        }
        archiveRead = true
        finish()
      } catch (error) {
        stop(error)
      }
    }
    pushNextChunk()
  })
}

function joinChunks(chunks: Uint8Array[], size: number) {
  const output = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

function validateArchiveEntry(file: UnzipFile) {
  const path = file.name
  if (!/^[\x20-\x7e]+$/.test(path) || path.includes("\\") || path.startsWith("/") || path.includes("\0")) {
    throw new ChatPackError("安全でないファイル名が含まれています。")
  }
  if (path.split("/").some((part) => part === ".." || part === ".")) {
    throw new ChatPackError("パック外を参照するパスが含まれています。")
  }
  if (file.originalSize !== undefined && file.originalSize > limits.file) throw new ChatPackError(`ファイルが大きすぎます: ${path}`)
  if (file.compression !== 0 && file.compression !== 8) throw new ChatPackError("対応していないZIP圧縮方式です。")
  if (path.endsWith("/")) return
  if (allowedRootFiles.has(path)) return
  if (!path.startsWith("assets/")) throw new ChatPackError(`許可されていないファイルです: ${path}`)
  const extension = path.split(".").pop()?.toLowerCase() ?? ""
  if (!imageAssetExtensions.has(extension) && !audioAssetExtensions.has(extension)) throw new ChatPackError(`許可されていないファイル形式です: ${path}`)
}

function validatePack(input: unknown): ChatPack {
  const pack = requireObject(input, "pack.json")
  if (pack.spec !== "mikan.chat-pack" || pack.specVersion !== "0.1") {
    throw new ChatPackError("対応していないChat Pack形式です。")
  }
  if (!isUuid(pack.id)) throw new ChatPackError("パックIDがUUIDではありません。")
  const version = requireString(pack.version, "version")
  if (!isSemver(version)) throw new ChatPackError("versionはSemantic Versioning形式にしてください。")
  const language = requireString(pack.language, "language")
  if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(language)) throw new ChatPackError("languageはBCP 47形式にしてください。")
  const title = requireString(pack.title, "title")
  const summary = requireString(pack.summary, "summary")
  const license = requireString(pack.license, "license")
  if (pack.rating !== "all" && pack.rating !== "r15" && pack.rating !== "r18") {
    throw new ChatPackError("ratingはall、r15、r18のいずれかにしてください。")
  }

  const author = requireObject(pack.author, "author")
  const authorName = requireString(author.name, "author.name")
  const authorUrl = optionalString(author.url, "author.url")
  const discovery = requireObject(pack.discovery, "discovery")
  const covers = discovery.covers === undefined ? undefined : requireStringArray(discovery.covers, "discovery.covers", true)
  const tags = discovery.tags === undefined ? undefined : requireStringArray(discovery.tags, "discovery.tags")
  const description = optionalString(discovery.description, "discovery.description")
  const authorComment = optionalString(discovery.authorComment, "discovery.authorComment")
  const plot = requireObject(pack.plot, "plot")
  const premise = requireString(plot.premise, "plot.premise")
  const instructions = optionalString(plot.instructions, "plot.instructions")
  if (!Array.isArray(plot.characters) || plot.characters.length === 0) {
    throw new ChatPackError("登場人物を1人以上設定してください。")
  }

  const ids = new Set<string>()
  const characters = plot.characters.map((value, index) => {
    const character = requireObject(value, `plot.characters[${index}]`)
    const id = requireString(character.id, `plot.characters[${index}].id`)
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(id) || reservedCharacterIds.has(id) || ids.has(id)) {
      throw new ChatPackError(`登場人物IDを確認してください: ${id}`)
    }
    ids.add(id)
    const image = character.image === undefined ? undefined : requireAssetPath(character.image, `plot.characters[${index}].image`)
    const voice = character.voice === undefined ? undefined : validateVoice(character.voice, `plot.characters[${index}].voice`)
    return {
      id,
      name: requireString(character.name, `plot.characters[${index}].name`),
      profile: requireString(character.profile, `plot.characters[${index}].profile`),
      ...(image ? { image } : {}),
      ...(voice ? { voice } : {}),
    }
  })

  if (!Array.isArray(plot.opening) || plot.opening.length === 0) {
    throw new ChatPackError("導入シーンを1件以上設定してください。")
  }
  const opening = plot.opening.map((value, index) => validateEvent(value, index, ids))
  if (!validateSchema(input)) {
    const issue = validateSchema.errors?.[0]
    throw new ChatPackError(`pack.jsonがJSON Schemaに適合しません: ${issue?.instancePath || "/"} ${issue?.message ?? "形式を確認してください。"}`)
  }
  const semanticIssue = getChatPackSemanticIssue(input)
  if (semanticIssue) throw new ChatPackError(semanticIssue)

  return {
    spec: "mikan.chat-pack",
    specVersion: "0.1",
    id: pack.id as string,
    version,
    language,
    title,
    summary,
    author: { name: authorName, ...(authorUrl ? { url: authorUrl } : {}) },
    license,
    ...(optionalString(pack.licenseNotice, "licenseNotice") ? { licenseNotice: pack.licenseNotice as string } : {}),
    rating: pack.rating,
    discovery: {
      ...(covers ? { covers } : {}),
      ...(tags ? { tags } : {}),
      ...(description ? { description } : {}),
      ...(authorComment ? { authorComment } : {}),
    },
    plot: { premise, ...(instructions ? { instructions } : {}), characters, opening },
  }
}

function validateEvent(input: unknown, index: number, characterIds: Set<string>): ChatPackEvent {
  const event = requireObject(input, `plot.opening[${index}]`)
  const text = requireString(event.text, `plot.opening[${index}].text`)
  const image = event.image === undefined ? undefined : requireAssetPath(event.image, `plot.opening[${index}].image`)
  if (event.type === "narration") return { type: "narration", text, image }
  if (event.type === "dialogue") {
    const speaker = requireString(event.speaker, `plot.opening[${index}].speaker`)
    if (speaker !== "user" && !characterIds.has(speaker)) throw new ChatPackError(`存在しない話者です: ${speaker}`)
    return { type: "dialogue", speaker, text, image }
  }
  throw new ChatPackError(`導入イベントのtypeを確認してください: ${index + 1}件目`)
}

function collectAssetPaths(pack: ChatPack, raw: Record<string, unknown>) {
  const paths = new Set((pack.discovery.covers ?? []).map((path) => requireAssetPath(path, "discovery.covers")))
  for (const character of pack.plot.characters) if (character.image) paths.add(character.image)
  for (const character of pack.plot.characters) if (character.voice?.referenceAudio) paths.add(character.voice.referenceAudio.asset)
  for (const event of pack.plot.opening) if (event.image) paths.add(event.image)
  const discovery = raw.discovery as Record<string, unknown>
  for (const value of (discovery.credits as Array<Record<string, unknown>> | undefined) ?? []) {
    paths.add(requireAssetPath(value.asset, "discovery.credits[].asset"))
  }
  const plot = raw.plot as Record<string, unknown>
  for (const value of (plot.playerProfiles as Array<Record<string, unknown>> | undefined) ?? []) {
    if (value.image !== undefined) paths.add(requireAssetPath(value.image, "plot.playerProfiles[].image"))
  }
  for (const example of (plot.situationExamples as Array<Record<string, unknown>> | undefined) ?? []) {
    for (const event of example.events as Array<Record<string, unknown>>) {
      if (event.image !== undefined) paths.add(requireAssetPath(event.image, "plot.situationExamples[].events[].image"))
    }
  }
  return paths
}

function validateVoice(value: unknown, field: string): ChatPackVoice {
  const voice = requireObject(value, field)
  const profile = voice.profile === undefined ? undefined : requireObject(voice.profile, `${field}.profile`)
  const reference = voice.referenceAudio === undefined ? undefined : requireObject(voice.referenceAudio, `${field}.referenceAudio`)
  const preferred = voice.preferred === undefined ? undefined : (Array.isArray(voice.preferred) ? voice.preferred.map((item, index) => {
    const preference = requireObject(item, `${field}.preferred[${index}]`)
    return {
      provider: requireString(preference.provider, `${field}.preferred[${index}].provider`),
      voiceId: requireString(preference.voiceId, `${field}.preferred[${index}].voiceId`),
      ...(preference.parameters === undefined ? {} : { parameters: requireObject(preference.parameters, `${field}.preferred[${index}].parameters`) }),
    }
  }) : (() => { throw new ChatPackError(`${field}.preferredを確認してください。`) })())
  return {
    ...(profile ? { profile } : {}),
    ...(reference ? { referenceAudio: {
      asset: requireAssetPath(reference.asset, `${field}.referenceAudio.asset`),
      ...(optionalString(reference.transcript, `${field}.referenceAudio.transcript`) ? { transcript: reference.transcript as string } : {}),
      ...(optionalString(reference.language, `${field}.referenceAudio.language`) ? { language: reference.language as string } : {}),
      ...(optionalString(reference.creator, `${field}.referenceAudio.creator`) ? { creator: reference.creator as string } : {}),
      ...(optionalString(reference.source, `${field}.referenceAudio.source`) ? { source: reference.source as string } : {}),
      ...(optionalString(reference.license, `${field}.referenceAudio.license`) ? { license: reference.license as string } : {}),
    } } : {}),
    ...(preferred ? { preferred } : {}),
  }
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ChatPackError(`${field}を確認してください。`)
  return value as Record<string, unknown>
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") throw new ChatPackError(`${field}を入力してください。`)
  return value
}

function requireStringArray(value: unknown, field: string, required = false) {
  if (!Array.isArray(value) || (required && value.length === 0) || value.some((item) => typeof item !== "string")) {
    throw new ChatPackError(`${field}を確認してください。`)
  }
  return value as string[]
}

function optionalString(value: unknown, field: string) {
  if (value === undefined) return undefined
  return requireString(value, field)
}

function requireAssetPath(value: unknown, field: string) {
  const path = requireString(value, field)
  if (!assetPathPattern.test(path)) {
    throw new ChatPackError(`${field}はassets/以下の画像を参照してください。`)
  }
  return path
}

function isUuid(value: unknown) {
  return typeof value === "string" && uuidPattern.test(value)
}

function isSemver(value: string) {
  return semverPattern.test(value)
}

function detectAssetMime(data: Uint8Array) {
  if (data.length >= 12 && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return "image/webp"
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "image/png"
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg"
  if (data.length >= 12 && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 && data[8] === 0x57 && data[9] === 0x41 && data[10] === 0x56 && data[11] === 0x45) return "audio/wav"
  if (data.length >= 4 && data[0] === 0x66 && data[1] === 0x4c && data[2] === 0x61 && data[3] === 0x43) return "audio/flac"
  if ((data.length >= 3 && data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) || (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0)) return "audio/mpeg"
  return null
}

function matchesAssetExtension(path: string, mime: string) {
  const extension = path.split(".").pop()?.toLowerCase()
  return (mime === "image/webp" && extension === "webp")
    || (mime === "image/png" && extension === "png")
    || (mime === "image/jpeg" && (extension === "jpg" || extension === "jpeg"))
    || (mime === "audio/wav" && extension === "wav")
    || (mime === "audio/mpeg" && extension === "mp3")
    || (mime === "audio/flac" && extension === "flac")
}

async function validateImage(data: Uint8Array, mime: string, path: string) {
  const dimensions = readImageDimensions(data, mime)
  if (!dimensions || dimensions.width > 4096 || dimensions.height > 4096) {
    throw new ChatPackError(`画像をデコードできないか、4096pxの上限を超えています: ${path}`)
  }
  try {
    const bitmap = await createImageBitmap(new Blob([data.slice().buffer], { type: mime }))
    const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width <= 4096 && bitmap.height <= 4096
    bitmap.close()
    if (!valid) throw new Error("dimension mismatch")
  } catch {
    throw new ChatPackError(`画像をデコードできないか、4096pxの上限を超えています: ${path}`)
  }
}

function readImageDimensions(data: Uint8Array, mime: string) {
  if (mime === "image/png" && data.length >= 24) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (mime === "image/webp" && data.length >= 30) {
    const kind = String.fromCharCode(...data.subarray(12, 16))
    if (kind === "VP8X") {
      return {
        width: 1 + data[24] + (data[25] << 8) + (data[26] << 16),
        height: 1 + data[27] + (data[28] << 8) + (data[29] << 16),
      }
    }
    if (kind === "VP8L" && data[20] === 0x2f) {
      return {
        width: 1 + data[21] + ((data[22] & 0x3f) << 8),
        height: 1 + (data[22] >> 6) + (data[23] << 2) + ((data[24] & 0x0f) << 10),
      }
    }
    if (kind === "VP8 " && data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) {
      return {
        width: (data[26] | (data[27] << 8)) & 0x3fff,
        height: (data[28] | (data[29] << 8)) & 0x3fff,
      }
    }
  }
  if (mime === "image/jpeg") {
    let offset = 2
    while (offset + 8 < data.length) {
      if (data[offset] !== 0xff) return null
      while (data[offset] === 0xff) offset += 1
      const marker = data[offset++]
      if (marker === 0xd8 || marker === 0xd9) continue
      if (offset + 1 >= data.length) return null
      const length = (data[offset] << 8) | data[offset + 1]
      if (length < 2 || offset + length > data.length) return null
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return {
          width: (data[offset + 5] << 8) | data[offset + 6],
          height: (data[offset + 3] << 8) | data[offset + 4],
        }
      }
      offset += length
    }
  }
  return null
}

function toDataUrl(data: Uint8Array, mime: string) {
  let binary = ""
  const chunkSize = 0x8000
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunkSize))
  }
  return `data:${mime};base64,${btoa(binary)}`
}
