import { afterEach, describe, expect, it } from "vitest"

import { createEmptyDraft } from "@/lib/pack-authoring/types"
import { clearLibrary, createLibraryEntry, loadLibrary, saveLibrary } from "@/lib/pack-authoring/storage"

describe("pack-authoring storage", () => {
  afterEach(() => {
    window.localStorage.clear()
    clearLibrary()
  })

  it("置き場を往復できる", () => {
    expect(loadLibrary()).toEqual([])
    const entry = createLibraryEntry({ ...createEmptyDraft(), title: "テスト" })
    expect(entry.status).toBe("draft")
    expect(saveLibrary([entry])).toBe(true)
    expect(loadLibrary()).toHaveLength(1)
    expect(loadLibrary()[0]?.draft.title).toBe("テスト")
  })

  it("旧形式の下書きを1回だけ取り込む", () => {
    window.localStorage.setItem("mikan.pack-authoring.draft.v1", JSON.stringify({ ...createEmptyDraft(), title: "旧下書き" }))
    expect(loadLibrary()).toHaveLength(1)
    expect(loadLibrary()[0]?.draft.title).toBe("旧下書き")
    expect(window.localStorage.getItem("mikan.pack-authoring.draft.v1")).toBeNull()
  })

  it("壊れた置き場は空で始める", () => {
    window.localStorage.setItem("mikan.pack-authoring.library.v1", "壊れたJSON{")
    expect(loadLibrary()).toEqual([])
  })
})
