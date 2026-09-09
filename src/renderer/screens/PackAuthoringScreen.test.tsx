import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { clearAuthoringDraft } from "@/lib/pack-authoring/storage"
import { PackAuthoringScreen } from "@/screens/PackAuthoringScreen"

describe("PackAuthoringScreen", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
    clearAuthoringDraft()
    delete window.mikan
  })

  it("プレビューと入力欄を表示し、不備がある間はエクスポートできない", async () => {
    render(<PackAuthoringScreen onBack={() => undefined} onImportAndTalk={() => undefined} />)

    expect(screen.getByRole("main", { name: "シナリオをつくる" })).toBeInTheDocument()
    expect(screen.getByLabelText("主人公の名前")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "エクスポート" })).toBeDisabled()
    expect(await screen.findByText(/タイトルを入力してください/, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getAllByText("登場人物").length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText("カバー画像").length).toBeGreaterThanOrEqual(2)
  })

  it("タイトル等を埋めると検証が進み、下書きが保存される", async () => {
    render(<PackAuthoringScreen onBack={() => undefined} onImportAndTalk={() => undefined} />)

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "テストの物語" } })
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("mikan.pack-authoring.draft.v1") ?? "{}")).toMatchObject({ title: "テストの物語" })
    })
  })
})
