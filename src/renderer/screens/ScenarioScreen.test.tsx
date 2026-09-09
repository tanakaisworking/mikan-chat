import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { Character } from "@/data/characters"
import { ScenarioScreen } from "@/screens/ScenarioScreen"

function createCharacter(): Character {
  return {
    id: "scenario",
    name: "テストの物語",
    description: "テスト",
    lastMessage: "テスト",
    lastActive: "テスト",
  }
}

describe("ScenarioScreen", () => {
  it("編集ボタンで下書き化を開始し、終わると解除される", async () => {
    let release!: () => void
    const onEdit = vi.fn(() => new Promise<void>((resolve) => { release = resolve }))
    render(<ScenarioScreen character={createCharacter()} onBack={() => undefined} onStart={() => undefined} onEdit={onEdit} />)

    fireEvent.click(screen.getByRole("button", { name: "この物語を編集" }))
    expect(onEdit).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "開いています…" })).toBeDisabled()

    release()
    await waitFor(() => expect(screen.getByRole("button", { name: "この物語を編集" })).toBeEnabled())
  })

  it("編集に失敗したら理由を表示する", async () => {
    render(
      <ScenarioScreen
        character={createCharacter()}
        onBack={() => undefined}
        onStart={() => undefined}
        onEdit={() => Promise.reject(new Error("シナリオを読み込めませんでした。"))}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "この物語を編集" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("シナリオを読み込めませんでした。")
  })
})
