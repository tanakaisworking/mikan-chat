import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ConnectionSettings } from "@/components/settings/ai-connection-dialog"
import { clearLibrary } from "@/lib/pack-authoring/storage"
import { PackAuthoringScreen } from "@/screens/PackAuthoringScreen"

const CONNECTION: ConnectionSettings = { type: "online", apiKey: "", endpoint: "", model: "" }

function renderScreen() {
  render(
    <MemoryRouter>
      <PackAuthoringScreen connection={CONNECTION} onConnectionConfirm={() => undefined} onImportAndTalk={() => undefined} onBack={() => undefined} />
    </MemoryRouter>,
  )
}

describe("PackAuthoringScreen", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
    clearLibrary()
    delete window.mikan
  })

  it("置き場から新規作成して編集画面へ進める", async () => {
    renderScreen()

    expect(screen.getByRole("main", { name: "シナリオをつくる" })).toBeInTheDocument()
    expect(screen.getByText("つくった物語")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "新しくつくる" }))

    expect(screen.getByLabelText("主人公の名前")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "エクスポート" })).toBeDisabled()
    expect(await screen.findByText(/タイトルを入力してください/, {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it("置き場の削除は二度押しで確定する", async () => {
    const { createEmptyDraft } = await import("@/lib/pack-authoring/types")
    window.localStorage.setItem("mikan.pack-authoring.library.v1", JSON.stringify([{
      id: "entry-1",
      updatedAt: new Date().toISOString(),
      status: "draft",
      draft: { ...createEmptyDraft(), title: "テストの物語" },
    }]))
    renderScreen()

    expect(screen.getByText("テストの物語")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "テストの物語を削除" }))
    expect(screen.getByRole("button", { name: "本当に削除" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "本当に削除" }))
    expect(screen.queryByText("テストの物語")).not.toBeInTheDocument()
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("mikan.pack-authoring.library.v1") ?? "[]")).toHaveLength(0)
    })
  })

  it("AIで作るダイアログを開き、結果なしでは適用できない", () => {
    renderScreen()

    fireEvent.click(screen.getByRole("button", { name: "AIで作る" }))
    expect(screen.getByRole("dialog", { name: "どんなシナリオを作りたいですか" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "この内容で作る" })).toBeDisabled()

    fireEvent.change(screen.getByLabelText("作りたい物語"), { target: { value: "政略結婚の話" } })
    expect(screen.getByRole("button", { name: "構成案を作る" })).toBeEnabled()
  })
})
