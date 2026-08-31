import { unzip, type UnzipFileInfo, type Unzipped } from "fflate"

const limits = {
  archive: 32 * 1024 * 1024,
  expanded: 64 * 1024 * 1024,
  entries: 64,
  file: 16 * 1024 * 1024,
  json: 512 * 1024,
}

const allowedRootFiles = new Set(["pack.json", "README.md", "LICENSE.txt"])
const allowedAssetExtensions = new Set(["webp", "png", "jpg", "jpeg"])
const reservedCharacterIds = new Set(["user", "narrator"])
const decoder = new TextDecoder("utf-8", { fatal: true })

export type ChatPackEvent =
  | { type: "narration"; text: string; image?: string }
  | { type: "dialogue"; speaker: string; text: string; image?: string }

export type ChatPackCharacter = {
  id: string
  name: string
  profile: string
  image: string
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
    covers: string[]
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
  const referencedAssets = collectAssetPaths(pack)
  const assets: Record<string, string> = {}
  for (const assetPath of referencedAssets) {
    const data = entries[assetPath]
    if (!data) throw new ChatPackError(`画像が見つかりません: ${assetPath}`)
    const mime = detectImageMime(data)
    if (!mime) throw new ChatPackError(`画像形式を確認できません: ${assetPath}`)
    await validateImage(data, mime, assetPath)
    assets[assetPath] = toDataUrl(data, mime)
  }

  return { fileName: file.name, pack, assets }
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
  let count = 0
  let expandedSize = 0
  let validationError: ChatPackError | null = null

  return new Promise((resolve, reject) => {
    unzip(
      data,
      {
        filter(file) {
          if (validationError) return false
          try {
            validateArchiveEntry(file)
            count += 1
            expandedSize += file.originalSize
            if (count > limits.entries) throw new ChatPackError("パック内のファイル数が多すぎます。")
            if (expandedSize > limits.expanded) throw new ChatPackError("展開後のサイズが64 MiBの上限を超えています。")
            return !file.name.endsWith("/")
          } catch (error) {
            validationError = error instanceof ChatPackError ? error : new ChatPackError("ZIPの内容を検証できませんでした。")
            return false
          }
        },
      },
      (error, files) => {
        if (validationError) return reject(validationError)
        if (error) return reject(new ChatPackError("ZIPを展開できませんでした。"))
        resolve(files)
      },
    )
  })
}

function validateArchiveEntry(file: UnzipFileInfo) {
  const path = file.name
  if (!/^[\x20-\x7e]+$/.test(path) || path.includes("\\") || path.startsWith("/") || path.includes("\0")) {
    throw new ChatPackError("安全でないファイル名が含まれています。")
  }
  if (path.split("/").some((part) => part === ".." || part === ".")) {
    throw new ChatPackError("パック外を参照するパスが含まれています。")
  }
  if (file.originalSize > limits.file) throw new ChatPackError(`ファイルが大きすぎます: ${path}`)
  if (file.compression !== 0 && file.compression !== 8) throw new ChatPackError("対応していないZIP圧縮方式です。")
  if (path.endsWith("/")) return
  if (allowedRootFiles.has(path)) return
  if (!path.startsWith("assets/")) throw new ChatPackError(`許可されていないファイルです: ${path}`)
  const extension = path.split(".").pop()?.toLowerCase() ?? ""
  if (!allowedAssetExtensions.has(extension)) throw new ChatPackError(`許可されていない画像形式です: ${path}`)
}

function validatePack(input: unknown): ChatPack {
  const pack = requireObject(input, "pack.json")
  if (pack.spec !== "mikan.chat-pack" || pack.specVersion !== "0.1") {
    throw new ChatPackError("対応していないChat Pack形式です。")
  }
  if (!isUuid(pack.id)) throw new ChatPackError("パックIDがUUIDではありません。")
  requireString(pack.version, "version")
  requireString(pack.language, "language")
  requireString(pack.title, "title")
  requireString(pack.summary, "summary")
  requireString(pack.license, "license")
  if (pack.rating !== "all" && pack.rating !== "r15" && pack.rating !== "r18") {
    throw new ChatPackError("ratingはall、r15、r18のいずれかにしてください。")
  }

  const author = requireObject(pack.author, "author")
  const authorName = requireString(author.name, "author.name")
  const authorUrl = optionalString(author.url, "author.url")
  const discovery = requireObject(pack.discovery, "discovery")
  const covers = requireStringArray(discovery.covers, "discovery.covers", true)
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
    return {
      id,
      name: requireString(character.name, `plot.characters[${index}].name`),
      profile: requireString(character.profile, `plot.characters[${index}].profile`),
      image: requireAssetPath(character.image, `plot.characters[${index}].image`),
    }
  })

  if (!Array.isArray(plot.opening) || plot.opening.length === 0) {
    throw new ChatPackError("導入シーンを1件以上設定してください。")
  }
  const opening = plot.opening.map((value, index) => validateEvent(value, index, ids))

  return {
    spec: "mikan.chat-pack",
    specVersion: "0.1",
    id: pack.id as string,
    version: pack.version as string,
    language: pack.language as string,
    title: pack.title as string,
    summary: pack.summary as string,
    author: { name: authorName, ...(authorUrl ? { url: authorUrl } : {}) },
    license: pack.license as string,
    ...(optionalString(pack.licenseNotice, "licenseNotice") ? { licenseNotice: pack.licenseNotice as string } : {}),
    rating: pack.rating,
    discovery: {
      covers,
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

function collectAssetPaths(pack: ChatPack) {
  const paths = new Set(pack.discovery.covers.map((path) => requireAssetPath(path, "discovery.covers")))
  for (const character of pack.plot.characters) paths.add(character.image)
  for (const event of pack.plot.opening) if (event.image) paths.add(event.image)
  return paths
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
  if (!path.startsWith("assets/") || path.includes("..") || path.includes("\\") || !/^[a-z0-9][a-z0-9/.-]*$/.test(path)) {
    throw new ChatPackError(`${field}はassets/以下の画像を参照してください。`)
  }
  return path
}

function isUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function detectImageMime(data: Uint8Array) {
  if (data.length >= 12 && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return "image/webp"
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "image/png"
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg"
  return null
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
