import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createRef } from "react"
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

function renderPanel(onApplyPatch: () => void = () => undefined, onClose: () => void = () => undefined) {
  render(
    <AiEditPanel
      triggerRef={{ current: null }}
      draft={createEmptyDraft()}
      connection={CONNECTION}
      onConnectionConfirm={() => undefined}
      onApplyPatch={onApplyPatch}
      onClose={onClose}
    />,
  )
}

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
        triggerRef={{ current: null }}
        draft={{ ...createEmptyDraft(), title: "元の題" }}
        connection={CONNECTION}
        onConnectionConfirm={() => undefined}
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

  it("外側クリックで閉じ、開閉ボタンでは閉じない", () => {
    const onClose = vi.fn()
    const triggerRef = createRef<HTMLSpanElement>()
    render(
      <>
        <span ref={triggerRef}>
          <button type="button">開閉</button>
        </span>
        <AiEditPanel
          triggerRef={triggerRef}
          draft={createEmptyDraft()}
          connection={CONNECTION}
          onConnectionConfirm={() => undefined}
          onApplyPatch={() => undefined}
          onClose={onClose}
        />
      </>,
    )

    fireEvent.pointerDown(screen.getByRole("button", { name: "開閉" }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.pointerDown(document.body)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("利用するAIを開いて確定できる", () => {
    const onConnectionConfirm = vi.fn()
    render(
      <AiEditPanel
        triggerRef={{ current: null }}
        draft={createEmptyDraft()}
        connection={CONNECTION}
        onConnectionConfirm={onConnectionConfirm}
        onApplyPatch={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(screen.queryByRole("button", { name: "接続を確認" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /利用するAI/ }))
    expect(screen.getByRole("button", { name: "接続を確認" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /を使う$/ }))
    expect(onConnectionConfirm).toHaveBeenCalledOnce()
  })

  it("AI未設定では設定誘導になる", () => {
    mockedReady.mockReturnValue(false)
    renderPanel()

    fireEvent.change(screen.getByPlaceholderText("どう直したいですか"), { target: { value: "何かして" } })
    fireEvent.click(screen.getByRole("button", { name: "送信" }))
    expect(screen.getByText("先に会話に使うAIを設定してください。")).toBeInTheDocument()
    expect(mockedStream).not.toHaveBeenCalled()
  })

  it("空の返答では反映できない", async () => {
    mockedStream.mockImplementation(async () => "")
    renderPanel()

    fireEvent.change(screen.getByPlaceholderText("どう直したいですか"), { target: { value: "何かして" } })
    fireEvent.click(screen.getByRole("button", { name: "送信" }))
    await waitFor(() => expect(mockedStream).toHaveBeenCalled())
    // 空の返答には反映ボタンが押せない
    expect(screen.getByRole("button", { name: "下書きに反映" })).toBeDisabled()
  })
})
