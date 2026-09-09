import { createEmptyDraft, nextDraftKey, type PackDraft } from "@/lib/pack-authoring/types"
const LIBRARY_STORAGE_KEY = "mikan.pack-authoring.library.v1"
const LEGACY_DRAFT_STORAGE_KEY = "mikan.pack-authoring.draft.v1"
const AUTHOR_STORAGE_KEY = "mikan.pack-authoring.author.v1"

export type DraftEntry = {
  id: string
  updatedAt: string
  status: "draft" | "done"
  draft: PackDraft
}

let memoryLibrary: DraftEntry[] | null = null

function isDraftLike(value: unknown): value is PackDraft {
  if (!value || typeof value !== "object") return false
  const draft = value as Record<string, unknown>
  if (typeof draft.title !== "string" || typeof draft.premise !== "string") return false
  if (!Array.isArray(draft.characters) || !draft.characters.every((character) =>
    Boolean(character) && typeof character === "object"
    && typeof (character as Record<string, unknown>).id === "string"
    && typeof (character as Record<string, unknown>).name === "string"
    && typeof (character as Record<string, unknown>).profile === "string"
    && Boolean((character as Record<string, unknown>).voice) && typeof (character as Record<string, unknown>).voice === "object",
  )) return false
  if (!Array.isArray(draft.opening) || !draft.opening.every((event) =>
    Boolean(event) && typeof event === "object"
    && ((event as Record<string, unknown>).type === "narration" || (event as Record<string, unknown>).type === "dialogue")
    && typeof (event as Record<string, unknown>).text === "string",
  )) return false
  return true
}

function isEntryLike(value: unknown): value is DraftEntry {
  return Boolean(value) && typeof value === "object"
    && typeof (value as Record<string, unknown>).id === "string"
    && ((value as Record<string, unknown>).status === "draft" || (value as Record<string, unknown>).status === "done")
    && isDraftLike((value as Record<string, unknown>).draft)
}

function migrateLegacyDraft(): DraftEntry[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY) ?? "null") as unknown
    if (isDraftLike(stored)) {
      const entry: DraftEntry = { id: nextDraftKey(), updatedAt: new Date().toISOString(), status: "draft", draft: { ...createEmptyDraft(), ...stored } }
      window.localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY)
      return [entry]
    }
  } catch {
    // 破損した下書きは捨てる。
  }
  return []
}

export function loadLibrary(): DraftEntry[] {
  if (memoryLibrary) return memoryLibrary
  try {
    const stored = JSON.parse(window.localStorage.getItem(LIBRARY_STORAGE_KEY) ?? "null") as unknown
    if (Array.isArray(stored) && stored.every(isEntryLike)) {
      memoryLibrary = stored
      return memoryLibrary
    }
  } catch {
    // 破損した置き場は捨てて作り直す。
  }
  memoryLibrary = migrateLegacyDraft()
  return memoryLibrary
}

/** 置き場を保存する。容量不足で保存できない場合はメモリ保持のみになり false を返す。 */
export function saveLibrary(entries: DraftEntry[]) {
  memoryLibrary = entries
  try {
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(entries))
    return true
  } catch {
    return false
  }
}

export function clearLibrary() {
  memoryLibrary = null
  try {
    window.localStorage.removeItem(LIBRARY_STORAGE_KEY)
    window.localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY)
  } catch {
    // 保存の失敗は無視する。
  }
}

export function createLibraryEntry(draft: PackDraft): DraftEntry {
  return { id: nextDraftKey(), updatedAt: new Date().toISOString(), status: "draft", draft }
}

export type AuthorMemory = {
  name: string
  url: string
  license: string
}

export function readAuthorMemory(): AuthorMemory {
  try {
    const stored = JSON.parse(window.localStorage.getItem(AUTHOR_STORAGE_KEY) ?? "null") as Partial<AuthorMemory> | null
    return {
      name: typeof stored?.name === "string" ? stored.name : "",
      url: typeof stored?.url === "string" ? stored.url : "",
      license: typeof stored?.license === "string" && stored.license ? stored.license : "All-Rights-Reserved",
    }
  } catch {
    return { name: "", url: "", license: "All-Rights-Reserved" }
  }
}

export function saveAuthorMemory(memory: AuthorMemory) {
  try {
    window.localStorage.setItem(AUTHOR_STORAGE_KEY, JSON.stringify(memory))
  } catch {
    // 作者名の記憶に失敗しても下書きは保持する。
  }
}
