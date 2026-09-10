import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AiEditPanel } from "@/components/pack-authoring/ai-edit-panel"
import { createEmptyDraft } from "@/lib/pack-authoring/types"
import type { ConnectionSettings } from "@/components/settings/ai-connection-dialog"

vi.mock("@/lib/ai-chat", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai-chat")>()
  return {
    ...original,
    streamInstructionReply: vi.fn(),
    isConnectionReady: vi.fn(() => true),
  }
})

const { isConnectionReady, streamInstructionReply } = await import("@/lib/ai-chat")
const mockedStream = vi.mocked(streamInstructionReply)
const mockedReady = vi.mocked(isConnectionReady)

const CONNECTION: ConnectionSettings = { type: "online", apiKey: "k", endpoint: "https://example.com/v1", model: "m" }

describe("AiEditPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    mockedReady.mockReturnValue(true)
  })

  it("相談して反映すると下書きが書き換わる", async () => {
    mockedStream.mockImplementation(async ({ onText }) => {
      onText("## タイトル\n新しい題")
      return "## タイトル\n新しい題"
    })
    const onApplyPatch = vi.fn()
    render(
      <AiEditPanel
        draft={{ ...createEmptyDraft(), title: "元の題" }}
        connection={CONNECTION}
        onApplyPatch={onApplyPatch}
        onClose={() => undefined}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText("どう直したいですか"), { target: { value: "題名を変えて" } })
    fireEvent.click(screen.getByRole("button", { name: "送信" }))

    expect(await screen.findByRole("button", { name: "下書きに反映" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "下書きに反映" }))
    expect(onApplyPatch).toHaveBeenCalledOnce()
    expect(onApplyPatch.mock.calls[0]?.[0]).toMatchObject({ title: "新しい題" })
    expect(screen.getByRole("button", { name: "反映済み" })).toBeInTheDocument()
  })

  it("AI未設定では設定誘導になる", () => {
    mockedReady.mockReturnValue(false)
    render(
      <AiEditPanel
        draft={createEmptyDraft()}
        connection={{ type: "online", apiKey: "", endpoint: "", model: "" }}
        onApplyPatch={() => undefined}
        onClose={() => undefined}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText("どう直したいですか"), { target: { value: "何かして" } })
    fireEvent.click(screen.getByRole("button", { name: "送信" }))
    expect(screen.getByText("先に会話に使うAIを設定してください。")).toBeInTheDocument()
    expect(mockedStream).not.toHaveBeenCalled()
  })

  it("空の返答では反映できない", async () => {
    mockedStream.mockImplementation(async () => "")
    render(
      <AiEditPanel
        draft={createEmptyDraft()}
        connection={CONNECTION}
        onApplyPatch={() => undefined}
        onClose={() => undefined}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText("どう直したいですか"), { target: { value: "何かして" } })
    fireEvent.click(screen.getByRole("button", { name: "送信" }))
    await waitFor(() => expect(mockedStream).toHaveBeenCalled())
    // 空の返答には反映ボタンが押せない
    expect(screen.getByRole("button", { name: "下書きに反映" })).toBeDisabled()
  })
})
