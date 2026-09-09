export type DraftAsset = {
  fileName: string
  mimeType: string
  size: number
  dataUrl: string
}

/** 作成中のBGM設定を保存するシナリオID。再生側とエクスポートで共有する。 */
export const AUTHORING_DRAFT_SCENARIO_ID = "authoring-draft"

export type DraftVoice = {
  gender: "" | "male" | "female" | "neutral"
  description: string
  traits: string
  caption: string
  seed: string
  referenceAudio: DraftAsset | null
  /** UIなしで引き継ぐ声の数値指定 */
  speed?: number
  pitch?: number
  language?: string
}

export type DraftCharacter = {
  key: string
  id: string
  name: string
  profile: string
  image: DraftAsset | null
  voice: DraftVoice
}

export type DraftEvent =
  | { key: string; type: "narration"; text: string; image?: DraftAsset | null }
  | { key: string; type: "dialogue"; speaker: string; text: string; image?: DraftAsset | null }

/** 編集UIを持たないがフォーク時に維持する原文ブロック */
export type DraftKept = {
  licenseNotice?: unknown
  authorComment?: unknown
  credits?: unknown
  playerProfiles?: unknown
  defaultPlayerProfile?: unknown
  narrator?: unknown
  style?: unknown
}

export type PackDraft = {
  title: string
  summary: string
  authorName: string
  authorUrl: string
  license: string
  rating: "all" | "r15" | "r18"
  tags: string
  description: string
  audience: "all" | "men" | "women"
  cover: DraftAsset | null
  premise: string
  instructions: string
  characters: DraftCharacter[]
  opening: DraftEvent[]
  kept?: DraftKept
}

export function createEmptyCharacter(key: string): DraftCharacter {
  return {
    key,
    id: "",
    name: "",
    profile: "",
    image: null,
    voice: { gender: "", description: "", traits: "", caption: "", seed: "", referenceAudio: null },
  }
}

export function createEmptyDraft(): PackDraft {
  return {
    title: "",
    summary: "",
    authorName: "",
    authorUrl: "",
    license: "All-Rights-Reserved",
    rating: "all",
    tags: "",
    description: "",
    audience: "all",
    cover: null,
    premise: "",
    instructions: "",
    characters: [createEmptyCharacter(nextDraftKey())],
    opening: [{ key: nextDraftKey(), type: "dialogue", speaker: "", text: "" }],
  }
}

let draftKeyCounter = 0

export function nextDraftKey() {
  draftKeyCounter += 1
  return `draft-${Date.now().toString(36)}-${draftKeyCounter}`
}

/** 空欄IDに安定した自動IDを振る。削除済みの番号は再利用しない。 */
export function assignCharacterId(characters: Array<{ id: string }>) {
  const taken = new Set(characters.map((character) => character.id.trim()).filter(Boolean))
  let index = 1
  for (const id of taken) {
    const match = /^character(\d+)$/.exec(id)
    if (match) index = Math.max(index, Number(match[1]) + 1)
  }
  while (taken.has(`character${index}`)) index += 1
  return `character${index}`
}
