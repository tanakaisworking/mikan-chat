import { createEmptyDraft, type PackDraft } from "@/lib/pack-authoring/types"

const DRAFT_STORAGE_KEY = "mikan.pack-authoring.draft.v1"

let memoryDraft: PackDraft | null = null

function isVoiceLike(value: unknown): boolean {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isDraftLike(value: unknown): value is PackDraft {
  if (!value || typeof value !== "object") return false
  const draft = value as Record<string, unknown>
  if (typeof draft.title !== "string" || typeof draft.premise !== "string") return false
  if (!Array.isArray(draft.characters) || !draft.characters.every((character) =>
    Boolean(character) && typeof character === "object"
    && typeof (character as Record<string, unknown>).id === "string"
    && typeof (character as Record<string, unknown>).name === "string"
    && typeof (character as Record<string, unknown>).profile === "string"
    && isVoiceLike((character as Record<string, unknown>).voice),
  )) return false
  if (!Array.isArray(draft.opening) || !draft.opening.every((event) =>
    Boolean(event) && typeof event === "object"
    && ((event as Record<string, unknown>).type === "narration" || (event as Record<string, unknown>).type === "dialogue")
    && typeof (event as Record<string, unknown>).text === "string",
  )) return false
  return true
}

export function loadAuthoringDraft(): PackDraft {
  if (memoryDraft) return memoryDraft
  try {
    const stored = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) ?? "null") as unknown
    if (isDraftLike(stored)) {
      memoryDraft = { ...createEmptyDraft(), ...stored }
      return memoryDraft
    }
  } catch {
    // 破損した下書きは捨てて作り直す。
  }
  memoryDraft = createEmptyDraft()
  return memoryDraft
}

/** 下書きを保存する。容量不足で保存できない場合はメモリ保持のみになり false を返す。 */
export function saveAuthoringDraft(draft: PackDraft) {
  memoryDraft = draft
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function clearAuthoringDraft() {
  memoryDraft = null
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // 保存の失敗は無視する。
  }
}
