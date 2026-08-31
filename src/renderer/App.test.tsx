import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { zipSync, strToU8 } from "fflate"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { App } from "@/App"
import { streamCharacterReply } from "@/lib/ai-chat"

vi.mock("@/lib/ai-chat", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/ai-chat")>(),
  streamCharacterReply: vi.fn(),
}))

describe("mikan chat UI flow", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/?screen=home")
    window.sessionStorage.clear()
    window.mikan = {
      platform: "darwin",
      speech: {
        start: vi.fn().mockResolvedValue(undefined),
        send: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn().mockReturnValue(vi.fn()),
      },
    }
    vi.mocked(streamCharacterReply).mockReset()
    vi.mocked(streamCharacterReply).mockImplementation(async ({ onText }) => {
      const reply = "うん。急がなくて大丈夫。今日はどんなことがあったの？"
      onText(reply)
      return reply
    })
  })

  afterEach(() => {
    delete window.mikan
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("ホームから葵のトーク画面を開ける", () => {
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "雨の夜、幼なじみの部屋で" }))

    expect(screen.getByTestId("talk-screen")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("メッセージを入力")).toBeInTheDocument()
  })

  it("Web版はAPIからシナリオを読み込む", async () => {
    delete window.mikan
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      items: [{
        id: "api-scenario",
        slug: "api-scenario",
        title: "DBから届いたシナリオ",
        characterName: "ミア・ノア",
        summary: "D1に保存されたシナリオ。",
        coverPath: "/scenario-covers/aoi.webp",
        rating: "all",
        tags: ["テスト"],
        conversationLabel: "2人と会話",
        lastMessage: "{{user}}さん、話を聞いて。",
        lastActive: "",
        pack: {},
        opening: [
          { role: "narration", text: "酒場の扉が静かに閉まる。", image: "/scenario-covers/mia.webp" },
          { role: "character", speakerName: "ミア", text: "{{user}}さん、頼みがあるの。", image: null },
          { role: "character", speakerName: "ノア", text: "まず話を聞け。", image: null },
          { role: "user", text: "わかった。聞かせて。", image: null },
        ],
      }],
    })))

    render(<App />)

    expect(await screen.findByRole("button", { name: "DBから届いたシナリオ" })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith("/api/scenarios")
    fireEvent.click(screen.getByRole("button", { name: "DBから届いたシナリオ" }))
    expect(screen.getByRole("heading", { name: "ミア・ノア" })).toBeInTheDocument()
    expect(screen.getByText("酒場の扉が静かに閉まる。")).toBeInTheDocument()
    expect(screen.getByText("あなた、頼みがあるの。")).toBeInTheDocument()
    expect(screen.getByText("まず話を聞け。")).toBeInTheDocument()
    expect(screen.getByText("わかった。聞かせて。")).toBeInTheDocument()
    expect(screen.getByText("ミア")).toBeInTheDocument()
    expect(screen.getByText("ノア")).toBeInTheDocument()
    expect(screen.queryByAltText("場面")).not.toBeInTheDocument()
  })

  it("Web版の読み込み失敗後に再試行できる", async () => {
    delete window.mikan
    const item = {
      id: "retry-scenario",
      slug: "retry-scenario",
      title: "再試行で届いたシナリオ",
      characterName: "みかん",
      summary: "再試行後に表示される。",
      coverPath: null,
      rating: "all",
      tags: [],
      conversationLabel: "1人と会話",
      lastMessage: "こんにちは",
      lastActive: "",
      pack: {},
    }
    vi.stubGlobal("fetch", vi.fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(Response.json({ items: [item] })))

    render(<App />)

    expect(await screen.findByRole("alert")).toHaveTextContent("シナリオを読み込めませんでした")
    fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }))
    expect(await screen.findByRole("button", { name: "再試行で届いたシナリオ" })).toBeInTheDocument()
  })

  it("API読み込み中に開始したインポート会話を完了後も維持する", async () => {
    delete window.mikan
    let resolveScenarios!: (response: Response) => void
    const scenarios = new Promise<Response>((resolve) => { resolveScenarios = resolve })
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) =>
      String(input).includes("/api/scenarios") ? scenarios : Promise.resolve(createDemoPackResponse()),
    ))
    window.history.replaceState({}, "", "/?screen=home&overlay=import")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "デモを読み込む" }))
    await screen.findByRole("heading", { name: "雨の夜、閉店後の喫茶店で" })
    fireEvent.click(screen.getByRole("button", { name: "追加して話す" }))
    expect(screen.getByRole("heading", { name: "葵" })).toBeInTheDocument()

    await act(async () => {
      resolveScenarios(Response.json({ items: [{
        id: "server-scenario",
        slug: "server-scenario",
        title: "サーバーのシナリオ",
        characterName: "別の人物",
        summary: "APIから届く。",
        coverPath: null,
        rating: "all",
        tags: [],
        conversationLabel: "1人と会話",
        lastMessage: "こんにちは",
        lastActive: "",
        pack: {},
      }] }))
    })

    expect(screen.getByRole("heading", { name: "葵" })).toBeInTheDocument()
    expect(screen.getByText(/こんな時間に、どうしたんですか/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "戻る" }))
    expect(screen.getByRole("button", { name: "サーバーのシナリオ" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "雨の夜、閉店後の喫茶店で" })).toBeInTheDocument()
  })

  it("スマホ用タブでホームとチャットを切り替えられる", () => {
    render(<App />)

    const mobileNavigation = screen.getByRole("navigation", { name: "モバイルメインナビゲーション" })
    const homeTab = within(mobileNavigation).getByRole("button", { name: "ホーム" })
    const chatTab = within(mobileNavigation).getByRole("button", { name: "チャット" })
    expect(homeTab).toHaveAttribute("aria-current", "page")

    fireEvent.click(chatTab)
    expect(chatTab).toHaveAttribute("aria-current", "page")
    expect(homeTab).not.toHaveAttribute("aria-current")
    expect(screen.getByText("続きから")).toBeInTheDocument()
  })

  it("PCサイドバーでホームとチャットを別ページとして切り替えられる", () => {
    render(<App />)

    const desktopNavigation = screen.getByRole("navigation", { name: "PCメインナビゲーション" })
    fireEvent.click(within(desktopNavigation).getByRole("button", { name: "チャット" }))

    expect(screen.getByText("続きから")).toBeInTheDocument()
    expect(screen.queryByText("シナリオを探す")).not.toBeInTheDocument()
  })

  it("スマホ下部のシナリオ導線からインポートを開ける", () => {
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "新しいシナリオを作成&インポート" }))

    expect(screen.getByRole("dialog", { name: "チャットパックを追加" })).toBeInTheDocument()
  })

  it("スマホヘッダーの補助操作をハンバーガーメニューに格納する", () => {
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }))

    expect(screen.getByRole("menuitem", { name: "技術ドキュメント" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "設定" })).toBeInTheDocument()
  })

  it("チャット一覧から会話を開き、戻るとチャットタブへ戻る", () => {
    render(<App />)

    const mobileNavigation = screen.getByRole("navigation", { name: "モバイルメインナビゲーション" })
    fireEvent.click(within(mobileNavigation).getByRole("button", { name: "チャット" }))
    fireEvent.click(screen.getByRole("button", { name: /葵 おかえり/ }))
    expect(screen.queryByRole("navigation", { name: "モバイルメインナビゲーション" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "戻る" }))
    expect(within(screen.getByRole("navigation", { name: "モバイルメインナビゲーション" })).getByRole("button", { name: "チャット" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByText("続きから")).toBeInTheDocument()
  })

  it("メッセージを送るとキャラクターの返答が追加される", async () => {
    window.history.replaceState({}, "", "/?screen=talk")
    render(<App />)
    configureLocalAI()

    const composer = screen.getByPlaceholderText("メッセージを入力")
    fireEvent.change(composer, { target: { value: "今日は少し疲れたよ" } })
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" })

    expect(screen.getByText("今日は少し疲れたよ")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("葵が考えています…")).not.toBeInTheDocument()
      expect(screen.getByText("うん。急がなくて大丈夫。今日はどんなことがあったの？")).toBeInTheDocument()
    }, { timeout: 5_000 })
  }, 10_000)

  it("URLからAI接続Dialogを確認できる", () => {
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    expect(screen.getByRole("dialog", { name: "AIの接続" })).toBeInTheDocument()
  })

  it("初回設定で選んだ接続方式をDialogへ引き継ぐ", () => {
    window.history.replaceState({}, "", "/?screen=setup")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: /AIサービスに接続する/ }))

    expect(screen.getByRole("button", { name: /Google AI Studio/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("オンライン接続はAPIキー入力後に確定でき、再表示でも保持する", () => {
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: /Google AI Studio/ }))
    const confirm = screen.getByRole("button", { name: "この接続を使う" })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText("APIキーを入力"), { target: { value: "runtime-test-key" } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    fireEvent.click(screen.getByRole("button", { name: "設定" }))

    expect(screen.getByPlaceholderText("APIキーを入力")).toHaveValue("runtime-test-key")
  })

  it("Web版は再読み込み後も同じタブの接続設定を復元する", () => {
    delete window.mikan
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json({ items: [] }))))
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    const firstRender = render(<App />)

    fireEvent.change(screen.getByPlaceholderText("APIキーを入力"), { target: { value: "runtime-test-key" } })
    fireEvent.click(screen.getByRole("button", { name: "この接続を使う" }))
    firstRender.unmount()

    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    expect(screen.getByPlaceholderText("APIキーを入力")).toHaveValue("runtime-test-key")
    expect(screen.getByRole("textbox", { name: /モデル名/ })).toHaveValue("gemini-flash-latest")
  })

  it("接続対象を変えると以前のテスト結果を消す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [{ id: "qwen3:8b" }] })))
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    fireEvent.change(screen.getByRole("textbox", { name: "モデル名" }), { target: { value: "qwen3:8b" } })
    fireEvent.click(screen.getByRole("button", { name: "接続をテスト" }))
    expect(await screen.findByText("接続できました")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Google AI Studio/ }))

    expect(screen.queryByText("接続できました")).not.toBeInTheDocument()
  })

  it("接続テスト中に設定を変えたら古い成功結果を表示しない", async () => {
    let resolveFetch!: (response: Response) => void
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve })))
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    fireEvent.change(screen.getByRole("textbox", { name: "モデル名" }), { target: { value: "qwen3:8b" } })
    fireEvent.click(screen.getByRole("button", { name: "接続をテスト" }))
    fireEvent.change(screen.getByRole("textbox", { name: /接続先URL/ }), { target: { value: "http://127.0.0.1:1234/v1" } })
    await act(async () => {
      resolveFetch(Response.json({ data: [{ id: "qwen3:8b" }] }))
    })

    expect(screen.queryByText("接続できました")).not.toBeInTheDocument()
  })

  it("オンラインAIのHTTP接続先を確定できない", () => {
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: /Google AI Studio/ }))
    fireEvent.change(screen.getByRole("textbox", { name: /接続先URL/ }), { target: { value: "http://example.com/v1" } })
    fireEvent.change(screen.getByPlaceholderText("APIキーを入力"), { target: { value: "runtime-test-key" } })

    expect(screen.getByText("オンラインAIの接続先にはhttpsを指定してください。")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "この接続を使う" })).toBeDisabled()
  })

  it("接続設定をキャンセルすると未確定の選択を破棄する", () => {
    window.history.replaceState({}, "", "/?screen=setup")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: /AIサービスに接続する/ }))
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }))
    fireEvent.click(screen.getByRole("button", { name: "あとで設定する" }))
    fireEvent.click(screen.getByRole("button", { name: "設定" }))

    expect(screen.getByRole("button", { name: /このPCのAI OllamaやLM Studioへ接続/ })).toHaveAttribute("aria-pressed", "true")
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

  it("AIが未設定なら入力を残したまま設定画面を開く", () => {
    window.history.replaceState({}, "", "/?screen=talk")
    render(<App />)

    const composer = screen.getByPlaceholderText("メッセージを入力")
    fireEvent.change(composer, { target: { value: "設定後に送りたい文章" } })
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" })

    expect(screen.getByRole("dialog", { name: "AIの接続" })).toBeInTheDocument()
    expect(composer).toHaveValue("設定後に送りたい文章")
  })

  it("生成を停止すると返答を追加しない", async () => {
    vi.mocked(streamCharacterReply).mockImplementation(({ signal }) => new Promise<string>((resolve) => {
      signal.addEventListener("abort", () => resolve(""), { once: true })
    }))
    window.history.replaceState({}, "", "/?screen=talk")
    render(<App />)
    configureLocalAI()

    const composer = screen.getByPlaceholderText("メッセージを入力")
    fireEvent.change(composer, { target: { value: "ここで止めて" } })
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" })
    fireEvent.click(screen.getByRole("button", { name: "生成を停止" }))

    await act(async () => undefined)

    expect(screen.queryByText("うん。急がなくて大丈夫。今日はどんなことがあったの？")).not.toBeInTheDocument()
    expect(screen.queryByText("葵が考えています…")).not.toBeInTheDocument()
  })

  it("デモの.mikanchatをライブラリへ追加できる", async () => {
    mockDemoPackFetch()
    window.history.replaceState({}, "", "/?screen=home&overlay=import")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "デモを読み込む" }))
    expect(await screen.findByRole("heading", { name: "雨の夜、閉店後の喫茶店で" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "ライブラリに追加" }))

    expect(screen.queryByRole("dialog", { name: "チャットパックを追加" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "雨の夜、閉店後の喫茶店で" })).toBeInTheDocument()
  })

  it("デモを追加して話すと情景描写と導入会話を表示する", async () => {
    mockDemoPackFetch()
    window.history.replaceState({}, "", "/?screen=home&overlay=import")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "デモを読み込む" }))
    await screen.findByRole("heading", { name: "雨の夜、閉店後の喫茶店で" })
    fireEvent.click(screen.getByRole("button", { name: "追加して話す" }))
    expect(screen.getByRole("heading", { name: "葵" })).toBeInTheDocument()
    expect(screen.getByText(/扉のベルが鳴る/)).toBeInTheDocument()
    expect(screen.getByText(/こんな時間に、どうしたんですか/)).toBeInTheDocument()
    expect(screen.queryByText(/あなたさん/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "戻る" }))

    expect(screen.getByRole("button", { name: "雨の夜、閉店後の喫茶店で" })).toBeInTheDocument()
  })

  it("画像なしのチャットパックを追加して会話できる", async () => {
    mockDemoPackFetch({
      discovery: { tags: ["日常"] },
      plot: {
        premise: "雨宿りに入った軒先で、旅人と出会う。",
        characters: [{ id: "traveler", name: "旅人", profile: "穏やかで、短く話す旅人。" }],
        opening: [{ type: "dialogue", speaker: "traveler", text: "ここ、半分使いますか？" }],
      },
    })
    window.history.replaceState({}, "", "/?screen=home&overlay=import")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "デモを読み込む" }))
    expect(await screen.findByRole("img", { name: "カバー画像はありません" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "追加して話す" }))

    expect(screen.getByRole("img", { name: "旅人の画像はありません" })).toBeInTheDocument()
    expect(screen.getByText("ここ、半分使いますか？")).toBeInTheDocument()
  })

  it("R18パックは確認前にカバーと追加操作を表示しない", async () => {
    mockDemoPackFetch({ rating: "r18" })
    window.history.replaceState({}, "", "/?screen=home&overlay=import")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "デモを読み込む" }))
    expect(await screen.findByRole("heading", { name: "成人向けの画像と内容が含まれます" })).toBeInTheDocument()
    expect(screen.queryByAltText("雨の夜、閉店後の喫茶店でのカバー")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "ライブラリに追加" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "R18の内容を表示" }))
    expect(screen.getByRole("heading", { name: "雨の夜、閉店後の喫茶店で" })).toBeInTheDocument()
  })

  it("同じIDのパックを黙って置換しない", async () => {
    mockDemoPackFetch()
    window.history.replaceState({}, "", "/?screen=home&overlay=import")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "デモを読み込む" }))
    await screen.findByRole("heading", { name: "雨の夜、閉店後の喫茶店で" })
    fireEvent.click(screen.getByRole("button", { name: "ライブラリに追加" }))
    fireEvent.click(screen.getByRole("button", { name: "シナリオを追加" }))
    fireEvent.click(screen.getByRole("button", { name: "デモを読み込む" }))
    await screen.findByRole("heading", { name: "雨の夜、閉店後の喫茶店で" })
    fireEvent.click(screen.getByRole("button", { name: "追加して話す" }))

    expect(screen.getByRole("alert")).toHaveTextContent("同じIDのチャットパックは追加済みです")
    expect(screen.getByRole("dialog", { name: "チャットパックを追加" })).toBeInTheDocument()
  })

  it("技術ドキュメントから仕様とデモ導線を確認できる", () => {
    window.history.replaceState({}, "", "/docs/")
    render(<App />)

    expect(screen.getByTestId("tech-docs-screen")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /mikan Chat Pack Specification v0.1/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "rainy-cafe.mikanchat" })).toHaveAttribute("download", "rainy-cafe.mikanchat")
    expect(screen.getByRole("link", { name: "JSON Schema" })).toHaveAttribute("href", "/schema/chat-pack-0.1.json")
    expect(screen.getByRole("link", { name: "JSON Schema" })).toHaveAttribute("download", "chat-pack-0.1.json")
  })

  it("Electron版の音声設定にHayamimiと未接続のTTSを表示する", () => {
    window.history.replaceState({}, "", "/?screen=talk&overlay=voice")
    render(<App />)

    expect(screen.getByText("Hayamimi")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "マイクを試す" })).toBeEnabled()
    const readAloud = screen.getByRole("switch", { name: "返答を読み上げる" })
    expect(readAloud).toHaveAttribute("aria-disabled", "true")
    expect(readAloud).not.toBeChecked()
    expect(screen.getByRole("button", { name: "Irodori TTS接続後に利用できます" })).toBeDisabled()
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

  it("新しい会話のメッセージを履歴の往復後も保持する", async () => {
    window.history.replaceState({}, "", "/?screen=talk&overlay=history")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "新しい会話" }))
    configureLocalAI()
    const composer = screen.getByPlaceholderText("メッセージを入力")
    fireEvent.change(composer, { target: { value: "この会話を残して" } })
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" })
    await act(async () => undefined)
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

function configureLocalAI() {
  fireEvent.click(screen.getByRole("button", { name: "AI接続設定" }))
  fireEvent.change(screen.getByRole("textbox", { name: "モデル名" }), { target: { value: "qwen3:8b" } })
  fireEvent.click(screen.getByRole("button", { name: "この接続を使う" }))
}

function mockDemoPackFetch(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => createDemoPackResponse(overrides)))
}

function createDemoPackResponse(overrides: Record<string, unknown> = {}) {
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ])
  const pack = {
    spec: "mikan.chat-pack",
    specVersion: "0.1",
    id: "5e17395e-79b0-4b46-8e55-4ddac9a8e787",
    version: "1.0.0",
    language: "ja",
    title: "雨の夜、閉店後の喫茶店で",
    summary: "秘密を抱えた常連客と二人きりになる。",
    author: { name: "mikan chat contributors" },
    license: "All-Rights-Reserved",
    rating: "all",
    discovery: { covers: ["assets/cover.webp"], tags: ["雨の夜"] },
    plot: {
      premise: "閉店後の喫茶店で葵と話す。",
      characters: [{ id: "aoi", name: "葵", profile: "物静かな常連客。", image: "assets/aoi.webp" }],
      opening: [
        { type: "narration", text: "扉のベルが鳴る。雨音だけが残る店内で、葵が振り返った。" },
        { type: "dialogue", speaker: "aoi", text: "……{{user}}さん。こんな時間に、どうしたんですか？" },
      ],
    },
    ...overrides,
  }
  const archive = zipSync({
    "pack.json": strToU8(JSON.stringify(pack)),
    "assets/cover.webp": webp,
    "assets/aoi.webp": webp,
  })
  return new Response(archive, { status: 200 })
}
