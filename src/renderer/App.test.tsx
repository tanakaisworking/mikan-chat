import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { App } from "@/App"

describe("mikan chat UI flow", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/?screen=home")
  })

  it("ホームから葵のトーク画面を開ける", () => {
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "葵と話す" }))

    expect(screen.getByTestId("talk-screen")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("メッセージを入力")).toBeInTheDocument()
  })

  it("メッセージを送るとキャラクターの返答が追加される", async () => {
    vi.useFakeTimers()
    window.history.replaceState({}, "", "/?screen=talk")
    render(<App />)

    const composer = screen.getByPlaceholderText("メッセージを入力")
    fireEvent.change(composer, { target: { value: "今日は少し疲れたよ" } })
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" })

    expect(screen.getByText("今日は少し疲れたよ")).toBeInTheDocument()
    expect(screen.getByText("葵が考えています…")).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(900)
    })

    expect(screen.getByText("うん。急がなくて大丈夫。今日はどんなことがあったの？")).toBeInTheDocument()
    vi.useRealTimers()
  })

  it("URLからAI接続Dialogを確認できる", () => {
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    expect(screen.getByRole("dialog", { name: "AIの接続" })).toBeInTheDocument()
  })

  it("初回設定で選んだ接続方式をDialogへ引き継ぐ", () => {
    window.history.replaceState({}, "", "/?screen=setup")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: /AIサービスに接続する/ }))

    expect(screen.getByRole("button", { name: /オンラインAI/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("オンライン接続はAPIキー入力後に確定でき、再表示でも保持する", () => {
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: /オンラインAI/ }))
    const confirm = screen.getByRole("button", { name: "この接続を使う" })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText("APIキーを入力"), { target: { value: "runtime-test-key" } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    fireEvent.click(screen.getByRole("button", { name: "設定" }))

    expect(screen.getByPlaceholderText("APIキーを入力")).toHaveValue("runtime-test-key")
  })

  it("接続対象を変えると以前のテスト結果を消す", async () => {
    vi.useFakeTimers()
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "接続をテスト" }))
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.getByText("接続できました")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /オンラインAI/ }))

    expect(screen.queryByText("接続できました")).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it("接続設定をキャンセルすると未確定の選択を破棄する", () => {
    window.history.replaceState({}, "", "/?screen=setup")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: /AIサービスに接続する/ }))
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }))
    fireEvent.click(screen.getByRole("button", { name: "あとで設定する" }))
    fireEvent.click(screen.getByRole("button", { name: "設定" }))

    expect(screen.getByRole("button", { name: /このPCのAI 接続できています/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("日本語入力中とShift+Enterでは送信しない", () => {
    window.history.replaceState({}, "", "/?screen=talk")
    render(<App />)

    const composer = screen.getByPlaceholderText("メッセージを入力")
    fireEvent.change(composer, { target: { value: "入力途中" } })
    fireEvent.compositionStart(composer)
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" })
    fireEvent.compositionEnd(composer)
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", shiftKey: true })

    expect(screen.getAllByRole("article")).toHaveLength(3)
    expect(composer).toHaveValue("入力途中")
  })

  it("生成を停止すると返答を追加しない", async () => {
    vi.useFakeTimers()
    window.history.replaceState({}, "", "/?screen=talk")
    render(<App />)

    const composer = screen.getByPlaceholderText("メッセージを入力")
    fireEvent.change(composer, { target: { value: "ここで止めて" } })
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" })
    fireEvent.click(screen.getByRole("button", { name: "生成を停止" }))

    await act(async () => {
      vi.advanceTimersByTime(900)
    })

    expect(screen.queryByText("うん。急がなくて大丈夫。今日はどんなことがあったの？")).not.toBeInTheDocument()
    expect(screen.queryByText("葵が考えています…")).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it("インポートしたキャラクターをライブラリへ追加できる", () => {
    window.history.replaceState({}, "", "/?screen=home&overlay=import")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "ライブラリに追加" }))

    expect(screen.queryByRole("dialog", { name: "キャラクターを追加" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "雫と話す" })).toBeInTheDocument()
  })

  it("追加して話したあともキャラクターがライブラリに残る", () => {
    window.history.replaceState({}, "", "/?screen=home&overlay=import")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "追加して話す" }))
    expect(screen.getByRole("heading", { name: "雫" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "戻る" }))

    expect(screen.getByRole("button", { name: "雫と話す" })).toBeInTheDocument()
  })

  it("音声設定のテスト状態を操作でき、閉じるとリセットされる", () => {
    window.history.replaceState({}, "", "/?screen=talk&overlay=voice")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "マイクを試す" }))
    expect(screen.getByRole("button", { name: "テストを停止" })).toBeInTheDocument()
    const readAloud = screen.getByRole("switch", { name: "返答を読み上げる" })
    fireEvent.click(readAloud)
    expect(readAloud).not.toBeChecked()
    fireEvent.click(screen.getByRole("button", { name: "声を試す" }))
    expect(screen.getByRole("button", { name: "再生を停止" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }))
    fireEvent.click(screen.getByRole("button", { name: "音声設定" }))

    expect(screen.getByRole("button", { name: "マイクを試す" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "声を試す" })).toBeInTheDocument()
  })

  it("履歴を選ぶと会話内容を切り替える", () => {
    window.history.replaceState({}, "", "/?screen=talk&overlay=history")
    render(<App />)

    const rainConversation = screen
      .getAllByRole("button", { name: /雨の日の帰り道/ })
      .find((button) => !button.hasAttribute("aria-label"))
    expect(rainConversation).toBeDefined()
    fireEvent.click(rainConversation!)

    expect(screen.getByText("雨、まだ降ってるかな？")).toBeInTheDocument()
    expect(screen.queryByTestId("conversation-history-sheet")).not.toBeInTheDocument()
  })

  it("履歴を削除し、新しい会話を始められる", () => {
    window.history.replaceState({}, "", "/?screen=talk&overlay=history")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "雨の日の帰り道を削除" }))
    expect(screen.queryByText("雨の日の帰り道")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "新しい会話" }))

    expect(screen.queryAllByRole("article")).toHaveLength(0)
    expect(screen.queryByTestId("conversation-history-sheet")).not.toBeInTheDocument()
  })

  it("会話履歴の名前を変更できる", () => {
    window.history.replaceState({}, "", "/?screen=talk&overlay=history")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "今日のことの名前を変更" }))
    const titleInput = screen.getByRole("textbox", { name: "会話名" })
    fireEvent.change(titleInput, { target: { value: "今日の振り返り" } })
    fireEvent.keyDown(titleInput, { key: "Enter", isComposing: true })
    expect(screen.getByRole("dialog", { name: "会話名を変更" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "保存" }))

    expect(screen.getByText("今日の振り返り")).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "会話名を変更" })).not.toBeInTheDocument()
  })

  it("新しい会話のメッセージを履歴の往復後も保持する", () => {
    window.history.replaceState({}, "", "/?screen=talk&overlay=history")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "新しい会話" }))
    const composer = screen.getByPlaceholderText("メッセージを入力")
    fireEvent.change(composer, { target: { value: "この会話を残して" } })
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" })
    fireEvent.click(screen.getByRole("button", { name: "会話履歴" }))
    const todayConversation = screen
      .getAllByRole("button", { name: /今日のこと/ })
      .find((button) => !button.hasAttribute("aria-label"))
    expect(todayConversation).toBeDefined()
    fireEvent.click(todayConversation!)
    fireEvent.click(screen.getByRole("button", { name: "会話履歴" }))
    const newConversation = screen
      .getAllByRole("button", { name: /新しい会話/ })
      .find((button) => button.className.includes("text-left"))
    expect(newConversation).toBeDefined()
    fireEvent.click(newConversation!)

    expect(screen.getByText("この会話を残して")).toBeInTheDocument()
  })
})
