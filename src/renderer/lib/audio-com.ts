import { getDesktopBridge } from "@/lib/platform"
import { parseAudioComSource } from "../../shared/audio-com"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

/** Accepts an audio.com page URL or a bare numeric audio id. */
export function getAudioComId(value?: string | null) {
  if (!value) return null
  const parsed = parseAudioComSource(value)
  return parsed ? parsed.id ?? parsed.pageUrl : null
}

export function getScenarioAudioComSource(pack?: Record<string, unknown>) {
  const extensions = isRecord(pack?.extensions) ? pack.extensions : null
  const bgm = isRecord(extensions?.["mikan.bgm"]) ? extensions["mikan.bgm"] : null
  if (bgm?.provider !== "audio.com") return null
  const source = typeof bgm.id === "string" ? bgm.id : typeof bgm.url === "string" ? bgm.url : null
  return getAudioComId(source)
}

/** パック同梱のBGM音源パス（assets/以下）を返す。解決は呼び出し側で行う。 */
export function getScenarioBgmAudioPath(pack?: Record<string, unknown>) {
  const extensions = isRecord(pack?.extensions) ? pack.extensions : null
  const bgm = isRecord(extensions?.["mikan.bgm"]) ? extensions["mikan.bgm"] : null
  const audio = bgm?.audio
  return typeof audio === "string" && audio.startsWith("assets/") ? audio : null
}

/** Stream URLs are short-lived presigned S3 links, so they are resolved per playback instead of stored in packs. */
export async function resolveAudioComStream(source: string, signal?: AbortSignal) {
  // The desktop build resolves in the main process, which has no browser CORS restriction.
  const bridge = getDesktopBridge()?.bgm
  if (bridge) return bridge.resolveAudioCom(source)

  // The web build proxies through its own origin because api.audio.com sends no CORS headers.
  const response = await fetch(`/api/bgm/audio-com?source=${encodeURIComponent(source)}`, { signal })
  if (!response.ok) throw new Error("BGMを読み込めませんでした。")
  const payload = await response.json() as { streamUrl?: unknown; title?: unknown }
  if (typeof payload.streamUrl !== "string") throw new Error("BGMを読み込めませんでした。")
  return { streamUrl: payload.streamUrl, title: typeof payload.title === "string" ? payload.title : null }
}

const DEFAULT_BGM_VOLUME = 20

export type BgmPreference = {
  customUrl: string | null
  volume: number
  enabled: boolean
  customFile?: { name: string; dataUrl: string } | null
}

/** シナリオごとのBGM設定を読む。作成画面のエクスポートと再生側で共有する。 */
export function readBgmPreference(scenarioId: string): BgmPreference {
  try {
    const value = JSON.parse(window.localStorage.getItem(`mikan.bgm.${scenarioId}`) ?? "null") as Partial<BgmPreference> | null
    const customFile = value?.customFile
    return {
      customUrl: typeof value?.customUrl === "string" ? value.customUrl : null,
      volume: typeof value?.volume === "number" ? Math.min(100, Math.max(0, value.volume)) : DEFAULT_BGM_VOLUME,
      enabled: value?.enabled === undefined ? true : value.enabled !== false,
      customFile: customFile && typeof customFile.name === "string" && typeof customFile.dataUrl === "string" ? customFile : null,
    }
  } catch {
    return { customUrl: null, volume: DEFAULT_BGM_VOLUME, enabled: true, customFile: null }
  }
}

/** シナリオごとのBGM設定を書く。容量不足時は false を返す。 */
export function writeBgmPreference(scenarioId: string, preference: BgmPreference) {
  try {
    window.localStorage.setItem(`mikan.bgm.${scenarioId}`, JSON.stringify(preference))
    return true
  } catch {
    return false
  }
}
