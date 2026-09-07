const AUDIO_ID = /^[0-9]{6,24}$/

/**
 * アプリ同梱のBGM。かまタマゴ素材（商用利用OK・アプリへの組み込み可・クレジット任意）。
 * ライセンス条件が不明な第三者音源は同梱しない。
 */
export const BUNDLED_BGM_TRACKS = [
  { label: "雨の日", file: "/bgm/kamatamago_B00222_today-is-a-rainy-day.m4a", title: "today is a rainy day", credit: "かまタマゴ" },
  { label: "帰ってきた故郷", file: "/bgm/kamatamago_B00017_kaettekita-furusato.m4a", title: "kaettekita-furusato", credit: "かまタマゴ" },
  { label: "真夜中のパーク", file: "/bgm/kamatamago_B00002_mayonakano-park.m4a", title: "mayonakano-park", credit: "かまタマゴ" },
  { label: "恐怖の夜の樹海", file: "/bgm/kamatamago_B00006_kyoufuno-yoruno-jukai.m4a", title: "kyoufuno-yoruno-jukai", credit: "かまタマゴ" },
  { label: "神秘的な天空", file: "/bgm/kamatamago_B00012_sinpitekina-tenkuu.m4a", title: "sinpitekina-tenkuu", credit: "かまタマゴ" },
  { label: "荒野の道", file: "/bgm/kamatamago_B00023_kouya-miti.m4a", title: "kouya-miti", credit: "かまタマゴ" },
  { label: "自己紹介", file: "/bgm/kamatamago_B00025_jikosyoukai.m4a", title: "jikosyoukai", credit: "かまタマゴ" },
] as const

export function isBundledBgmFile(value: string | null | undefined) {
  return typeof value === "string" && BUNDLED_BGM_TRACKS.some((track) => track.file === value)
}

/** シナリオ指定もユーザー指定も無いときに流れるBGM（自己紹介・かまタマゴ）。 */
export const DEFAULT_BGM_FILE = "/bgm/kamatamago_B00025_jikosyoukai.m4a"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

/** Accepts a bare numeric audio id or an audio.com page/embed URL. */
export function parseAudioComSource(value: string) {
  const trimmed = value.trim()
  if (AUDIO_ID.test(trimmed)) return { id: trimmed, pageUrl: null }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== "https:" || !["audio.com", "www.audio.com"].includes(url.hostname.toLowerCase())) return null
  const segments = url.pathname.split("/").filter(Boolean)
  if (segments[0] === "embed" && segments[1] === "audio" && AUDIO_ID.test(segments[2] ?? "")) return { id: segments[2], pageUrl: null }
  return segments[1] === "audio" && segments[2] ? { id: null, pageUrl: url.href } : null
}

/**
 * Resolves an audio.com source to a playable stream URL.
 * Stream links are presigned and expire, so they are resolved per playback instead of stored in packs.
 *
 * NOTE: this uses audio.com's public site endpoints as a provisional measure for
 * user-supplied URLs only. Do not bundle third-party track IDs in packs or presets:
 * per-track licenses vary (some are All Rights Reserved or NonCommercial).
 * Before any commercial release, migrate to the official OAuth v1 API with
 * self-owned or properly licensed tracks.
 */
export async function resolveAudioComStreamUrl(source: string, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  const parsed = parseAudioComSource(source)
  if (!parsed) throw new Error("audio.comの音源を特定できませんでした。")

  const audioId = parsed.id ?? await lookupAudioComId(parsed.pageUrl!, fetcher, signal)
  if (!audioId) throw new Error("audio.comの音源を特定できませんでした。")

  const response = await fetcher(`https://api.audio.com/audio/${audioId}`, { headers: { Accept: "application/json" }, signal })
  if (!response.ok) throw new Error("audio.comから音源を取得できませんでした。")

  const payload = await response.json() as { title?: unknown; transcodings?: unknown; sources?: unknown }
  const streamUrl = pickStreamUrl(payload.transcodings) ?? pickStreamUrl(payload.sources)
  if (!streamUrl) throw new Error("再生できる音源が見つかりませんでした。")
  return { streamUrl, title: typeof payload.title === "string" ? payload.title : null }
}

async function lookupAudioComId(pageUrl: string, fetcher: typeof fetch, signal?: AbortSignal) {
  const response = await fetcher(`https://api.audio.com/oembed?url=${encodeURIComponent(pageUrl)}`, { headers: { Accept: "application/json" }, signal })
  if (!response.ok) return null
  const payload = await response.json() as { html?: unknown }
  return typeof payload.html === "string" ? /audio\.com\/embed\/audio\/([0-9]{6,24})/.exec(payload.html)?.[1] ?? null : null
}

function pickStreamUrl(value: unknown) {
  if (!Array.isArray(value)) return null
  const items = value.filter(isRecord).filter((item) => typeof item.url === "string")
  const chosen = items.find((item) => item.format === "mp3" || item.type === "audio/mpeg") ?? items[0]
  const streamUrl = typeof chosen?.url === "string" ? chosen.url : null
  return streamUrl?.startsWith("https://") ? streamUrl : null
}
