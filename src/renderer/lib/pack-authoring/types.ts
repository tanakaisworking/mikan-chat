export type DraftAsset = {
  fileName: string
  mimeType: string
  size: number
  dataUrl: string
}

/** 作成中のBGM設定を保存するシナリオID。再生側とエクスポートで共有する。 */
export const AUTHORING_DRAFT_SCENARIO_ID = "authoring-draft"

export type DraftVoice = {
  gender: "" | "male" | "female"
  description: string
  traits: string
  caption: string
  seed: string
  referenceAudio: DraftAsset | null
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
  | { key: string; type: "narration"; text: string }
  | { key: string; type: "dialogue"; speaker: string; text: string }

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
    opening: [],
  }
}

let draftKeyCounter = 0

export function nextDraftKey() {
  draftKeyCounter += 1
  return `draft-${Date.now().toString(36)}-${draftKeyCounter}`
}
