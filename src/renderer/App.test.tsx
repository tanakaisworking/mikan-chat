import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { zipSync, strToU8 } from "fflate"
import { HashRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { App, AppContent } from "@/App"
import { streamCharacterReply } from "@/lib/ai-chat"
import { DEFAULT_BUILTIN_MODEL, GEMMA_4_12B_MODEL, type LocalAIStatus } from "../shared/local-ai"

const AOI_PUBLIC_ID = "5e17395e-79b0-4b46-8e55-4ddac9a8e787"
const MIA_PUBLIC_ID = "b1aa0948-3062-4f41-90c5-7fa451dec95f"
const API_SCENARIO_PUBLIC_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const TEST_PUBLIC_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const DEMO_PUBLIC_ID = "99999999-9999-4999-8999-999999999999"

vi.mock("@/lib/ai-chat", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/ai-chat")>(),
  streamCharacterReply: vi.fn(),
}))

describe("mikan chat UI flow", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/?screen=home")
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.localStorage.setItem("mikan-chat.onboarding.v1", JSON.stringify({
      gender: "prefer-not-to-say",
      birthYear: 2000,
      favoriteGenre: "日常",
    }))
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

  it("ホームで物語の詳細を確認してからトーク画面を開ける", () => {
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "雨の夜、幼なじみの部屋で" }))

    const scenarioScreen = screen.getByTestId("scenario-screen")
    expect(window.location.pathname).toBe(`/scenarios/${AOI_PUBLIC_ID}`)
    const previewCover = within(scenarioScreen).getByRole("img", { name: "雨の夜、幼なじみの部屋での物語カバー" })
    const previewCoverFrame = within(scenarioScreen).getByTestId("scenario-preview-cover-frame")
    const titleOverlay = within(previewCoverFrame).getByTestId("scenario-preview-title-overlay")
    expect(previewCover).toHaveClass("object-contain", "object-center")
    expect(previewCoverFrame).toHaveClass("aspect-[9/16]", "h-full", "max-md:w-full")
    expect(titleOverlay).toHaveTextContent("雨の夜、幼なじみの部屋で")
    expect(previewCoverFrame).not.toHaveTextContent("1人と会話")
    expect(previewCoverFrame).not.toHaveTextContent("#日常")
    expect(within(scenarioScreen).getByTestId("scenario-preview-details")).not.toHaveTextContent("雨の夜、幼なじみの部屋で")
    expect(within(scenarioScreen).getByTestId("scenario-preview-metadata")).not.toHaveTextContent("1人と会話")
    expect(within(scenarioScreen).getByTestId("scenario-preview-metadata")).toHaveTextContent("#日常")
    expect(within(scenarioScreen).getByTestId("scenario-preview-scroll")).toHaveClass("max-md:overflow-y-auto")
    expect(screen.getByText("物語の中のあなた")).toBeInTheDocument()
    expect(screen.queryByTestId("talk-screen")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "この物語をはじめる" }))
    expect(window.location.pathname).toBe(`/scenarios/${AOI_PUBLIC_ID}/chat`)
    expect(screen.getByTestId("talk-screen")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("メッセージを入力")).toBeInTheDocument()
  })

  it("シナリオ紹介とチャットのURLへ直接アクセスできる", () => {
    window.history.replaceState({}, "", `/scenarios/${AOI_PUBLIC_ID}`)
    const { unmount } = render(<App />)

    expect(screen.getByTestId("scenario-screen")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "雨の夜、幼なじみの部屋で" })).toBeInTheDocument()
    unmount()

    window.history.replaceState({}, "", `/scenarios/${AOI_PUBLIC_ID}/chat`)
    render(<App />)
    expect(screen.getByTestId("talk-screen")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "葵" })).toBeInTheDocument()
  })

  it("Electron版はHashRouterでシナリオ紹介とチャットへ直接アクセスできる", () => {
    window.history.replaceState({}, "", `/#/scenarios/${AOI_PUBLIC_ID}`)
    const { unmount } = render(<HashRouter><AppContent /></HashRouter>)

    expect(screen.getByTestId("scenario-screen")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "雨の夜、幼なじみの部屋で" })).toBeInTheDocument()
    unmount()

    window.history.replaceState({}, "", `/#/scenarios/${AOI_PUBLIC_ID}/chat`)
    render(<HashRouter><AppContent /></HashRouter>)
    expect(screen.getByTestId("talk-screen")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "葵" })).toBeInTheDocument()
  })

  it("旧slugのシナリオURLでは表示しない", () => {
    window.history.replaceState({}, "", "/scenarios/aoi")
    render(<App />)

    expect(screen.getByText("シナリオが見つかりません")).toBeInTheDocument()
    expect(screen.queryByTestId("scenario-screen")).not.toBeInTheDocument()
  })

  it("連番ダミーUUIDを廃止したシナリオは新UUIDだけで表示する", () => {
    window.history.replaceState({}, "", `/scenarios/${MIA_PUBLIC_ID}`)
    const { unmount } = render(<App />)
    expect(screen.getByRole("heading", { name: "閉店後の酒場で、秘密の依頼を" })).toBeInTheDocument()
    unmount()

    window.history.replaceState({}, "", "/scenarios/22222222-2222-4222-8222-222222222222")
    render(<App />)
    expect(screen.getByRole("heading", { name: "シナリオが見つかりません" })).toBeInTheDocument()
  })

  it("Web版のシナリオUUIDへ直接アクセスできる", async () => {
    delete window.mikan
    window.history.replaceState({}, "", `/scenarios/${API_SCENARIO_PUBLIC_ID}`)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      items: [scenarioApiItem("direct", "UUIDで開いたシナリオ", API_SCENARIO_PUBLIC_ID)],
    })))

    render(<App />)

    expect(await screen.findByRole("heading", { name: "UUIDで開いたシナリオ" })).toBeInTheDocument()
    const scenarioScreen = screen.getByTestId("scenario-screen")
    expect(scenarioScreen).toBeInTheDocument()
    expect(within(scenarioScreen).queryByTestId("scenario-preview-metadata")).not.toBeInTheDocument()
    expect(scenarioScreen).not.toHaveTextContent("1人と会話")
  })

  it("Web版では旧talkクエリをホームとして扱う", async () => {
    delete window.mikan
    window.history.replaceState({}, "", "/?screen=talk")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ items: [scenarioApiItem("web-home", "Webホーム")] })))

    render(<App />)

    expect(await screen.findByRole("button", { name: "Webホーム" })).toBeInTheDocument()
    expect(screen.queryByTestId("talk-screen")).not.toBeInTheDocument()
  })

  it("初回アクセスで回答を順番に保存してからホームを表示する", async () => {
    window.localStorage.removeItem("mikan-chat.onboarding.v1")
    delete window.mikan
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      items: [{
        id: "onboarding-scenario",
        publicId: TEST_PUBLIC_ID,
        slug: "onboarding-scenario",
        title: "オンボーディング用シナリオ",
        characterName: "しずく",
        summary: "初回設定の確認用。",
        coverPath: null,
        rating: "all",
        tags: ["静かな恋", "大学"],
        conversationLabel: "1人と会話",
        lastMessage: "こんにちは",
        lastActive: "",
        pack: {},
      }],
    })))

    render(<App />)

    expect(screen.getByRole("heading", { name: /未完成の物語を、\s*AIチャットで楽しもう。/ })).toBeInTheDocument()
    expect(screen.getByTestId("onboarding-screen")).toHaveClass("h-full", "overflow-y-auto", "overscroll-y-contain")
    expect(screen.queryByText("あなたへのおすすめ")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /女性/ }))
    expect(screen.getByRole("heading", { name: "生まれた年を教えてください" })).toHaveFocus()
    fireEvent.click(screen.getByRole("button", { name: "戻る" }))
    expect(screen.getByRole("button", { name: /女性/ })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: /女性/ }))
    const birthYearInput = screen.getByLabelText("生年")
    const nextButton = screen.getByRole("button", { name: "次へ" })
    expect(nextButton).toBeDisabled()
    fireEvent.change(birthYearInput, { target: { value: "1899" } })
    expect(birthYearInput).toHaveAttribute("aria-invalid", "true")
    expect(nextButton).toBeDisabled()
    fireEvent.blur(birthYearInput)
    expect(birthYearInput).toHaveValue("")
    fireEvent.change(birthYearInput, { target: { value: "１９９８" } })
    expect(birthYearInput).toHaveValue("1998")
    expect(nextButton).toBeEnabled()
    fireEvent.click(nextButton)
    expect(await screen.findByRole("heading", { name: "好きなジャンルを選んでください" })).toHaveFocus()
    fireEvent.click(await screen.findByRole("button", { name: "静かな恋" }))
    fireEvent.click(screen.getByRole("button", { name: "大学" }))
    expect(screen.getByRole("button", { name: "静かな恋" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "大学" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "はじめる" }))

    expect(await screen.findByText("あなたへのおすすめ")).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem("mikan-chat.onboarding.v1") ?? "null")).toEqual({
      gender: "woman",
      birthYear: 1998,
      favoriteGenres: ["静かな恋", "大学"],
    })
  })

  it("Web版はAPIからシナリオを読み込む", async () => {
    delete window.mikan
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      items: [{
        id: "api-scenario",
        publicId: API_SCENARIO_PUBLIC_ID,
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
        pack: {
          author: { name: "テスト作者" },
          rating: "all",
          plot: {
            premise: "閉店後の酒場で、秘密の荷物を運ぶ相談を持ちかけられる。",
            characters: [
              { id: "mia", name: "ミア", profile: "依頼を持ちかけるエルフの店主。" },
              { id: "noah", name: "ノア", profile: "店の護衛を務める寡黙な剣士。" },
            ],
            playerProfiles: [{ id: "last-guest", name: "酒場の最後の客", description: "閉店間際まで店に残っていた旅人。" }],
            defaultPlayerProfile: "last-guest",
          },
        },
        opening: [
          { role: "narration", text: "酒場の扉が静かに閉まる。", image: "/scenario-covers/mia.webp" },
          { role: "character", speakerName: "ミア", text: "{{user}}さん、頼みがあるの。", image: null },
          { role: "character", speakerName: "ノア", text: "まず話を聞け。", image: null },
          { role: "user", text: "わかった。聞かせて。", image: null },
        ],
      }],
    })))

    render(<App />)

    const scenarioCard = await screen.findByRole("button", { name: "DBから届いたシナリオ" })
    expect(scenarioCard).not.toHaveTextContent("2人と会話")
    expect(scenarioCard).not.toHaveTextContent("登場人物：ミア・ノア")
    const scenarioCover = within(scenarioCard).getByRole("img", { name: "DBから届いたシナリオのカバー画像" })
    expect(scenarioCover).toHaveAttribute("loading", "lazy")
    expect(scenarioCover).toHaveAttribute("decoding", "async")
    expect(scenarioCover).toHaveClass("transition-[opacity,transform]", "duration-300")
    expect(scenarioCover).toHaveClass("opacity-0")
    fireEvent.load(scenarioCover)
    expect(scenarioCover).toHaveClass("opacity-100")
    expect(fetch).toHaveBeenCalledWith("/api/scenarios")
    fireEvent.click(scenarioCard)
    expect(screen.getByTestId("scenario-screen")).toBeInTheDocument()
    expect(window.location.pathname).toBe(`/scenarios/${API_SCENARIO_PUBLIC_ID}`)
    expect(screen.getByText("閉店後の酒場で、秘密の荷物を運ぶ相談を持ちかけられる。")).toBeInTheDocument()
    expect(screen.getByText("酒場の最後の客")).toBeInTheDocument()
    expect(screen.getByText("依頼を持ちかけるエルフの店主。")).toBeInTheDocument()
    expect(screen.getByText("店の護衛を務める寡黙な剣士。")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "この物語をはじめる" }))
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
      publicId: TEST_PUBLIC_ID,
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

  it("Web版は重複したシナリオUUIDを拒否する", async () => {
    delete window.mikan
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      items: [scenarioApiItem("first", "先のシナリオ"), scenarioApiItem("second", "後のシナリオ")],
    })))

    render(<App />)

    expect(await screen.findByRole("alert")).toHaveTextContent("シナリオを読み込めませんでした")
    expect(screen.queryByRole("button", { name: "先のシナリオ" })).not.toBeInTheDocument()
  })

  it("並行したシナリオ再取得では最新の結果だけを反映する", async () => {
    delete window.mikan
    let resolveOlder!: (response: Response) => void
    let resolveLatest!: (response: Response) => void
    const older = new Promise<Response>((resolve) => { resolveOlder = resolve })
    const latest = new Promise<Response>((resolve) => { resolveLatest = resolve })
    vi.stubGlobal("fetch", vi.fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockReturnValueOnce(older)
      .mockReturnValueOnce(latest))

    render(<App />)
    const retry = await screen.findByRole("button", { name: "もう一度試す" })
    act(() => {
      retry.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      retry.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    await act(async () => {
      resolveLatest(Response.json({ items: [scenarioApiItem("latest", "最新のシナリオ")] }))
    })
    expect(await screen.findByRole("button", { name: "最新のシナリオ" })).toBeInTheDocument()

    await act(async () => {
      resolveOlder(Response.json({ items: [scenarioApiItem("older", "古いシナリオ")] }))
    })
    expect(screen.getByRole("button", { name: "最新のシナリオ" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "古いシナリオ" })).not.toBeInTheDocument()
  })

  it("API読み込み中に開始した同UUIDのインポート会話を完了後も維持する", async () => {
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
        publicId: DEMO_PUBLIC_ID,
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
    expect(screen.getByRole("heading", { name: "雨の夜、閉店後の喫茶店で" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "別のシナリオを見る" }))
    expect(screen.queryByRole("button", { name: "サーバーのシナリオ" })).not.toBeInTheDocument()
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

  it("会話済みのシナリオをおすすめから外してチャットに表示する", async () => {
    window.mikan!.conversations = {
      list: vi.fn().mockResolvedValue([{
        id: `${AOI_PUBLIC_ID}:today`,
        scenarioId: AOI_PUBLIC_ID,
        title: "葵との会話",
        updatedAt: "2026-09-05T10:00:00.000Z",
        messages: [],
      }]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }
    render(<App />)

    await screen.findByRole("button", { name: "閉店後の酒場で、秘密の依頼を" })
    expect(screen.queryByRole("button", { name: /雨の夜、幼なじみ/ })).not.toBeInTheDocument()

    fireEvent.click(within(screen.getByRole("navigation", { name: "PCメインナビゲーション" })).getByRole("button", { name: "チャット" }))
    expect(await screen.findByRole("button", { name: /葵/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /ミア/ })).not.toBeInTheDocument()
  })

  it("PCサイドバーでホームとチャットを別ページとして切り替えられる", () => {
    render(<App />)

    const desktopNavigation = screen.getByRole("navigation", { name: "PCメインナビゲーション" })
    const homeButton = within(desktopNavigation).getByRole("button", { name: "ホーム" })
    const chatButton = within(desktopNavigation).getByRole("button", { name: "チャット" })
    expect(homeButton).toHaveAttribute("aria-current", "page")
    expect(homeButton).toHaveClass("text-primary")
    expect(within(homeButton).getByText("ホーム")).toHaveClass("font-semibold")
    expect(homeButton).toHaveClass("bg-surface")
    expect(homeButton).not.toHaveClass("bg-surface-accent")
    expect(homeButton).not.toHaveClass("shadow-soft")
    expect(chatButton).toHaveClass("bg-surface")
    fireEvent.click(chatButton)

    expect(chatButton).toHaveAttribute("aria-current", "page")
    expect(chatButton).toHaveClass("bg-surface")
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
    }, { timeout: 10_000 })
  }, 15_000)

  it("受信途中の情景描写と台詞を順次表示する", async () => {
    let finishReply!: () => void
    vi.mocked(streamCharacterReply).mockImplementation(async ({ onText }) => {
      onText(">: 窓の外で雨音が強くなる。")
      await new Promise<void>((resolve) => { finishReply = resolve })
      const reply = ">: 窓の外で雨音が強くなる。\n葵: もう少し、ここにいてもいい？"
      onText(reply)
      return reply
    })
    window.history.replaceState({}, "", "/?screen=talk")
    render(<App />)
    configureLocalAI()

    const composer = screen.getByPlaceholderText("メッセージを入力")
    fireEvent.change(composer, { target: { value: "雨が強くなったね" } })
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" })

    expect(await screen.findByText("窓の外で雨音が強くなる。")).toBeInTheDocument()
    expect(screen.getByText("葵が考えています…")).toBeInTheDocument()
    await act(async () => finishReply())
    expect(await screen.findByText("もう少し、ここにいてもいい？")).toBeInTheDocument()
  })

  it("URLからAI接続Dialogを確認できる", () => {
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    expect(screen.getByRole("dialog", { name: "会話AIの設定" })).toBeInTheDocument()
  })

  it("設定画面で表示とユーザー情報を保存し、AI接続を項目として開ける", () => {
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "設定" }))
    expect(window.location.pathname).toBe("/settings")
    expect(screen.getByRole("heading", { name: "表示" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "ユーザー情報" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "AIの接続" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "読み上げの音声" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "大きめ" }))
    fireEvent.click(screen.getByRole("button", { name: "ダーク" }))
    fireEvent.change(screen.getByLabelText("性別"), { target: { value: "woman" } })
    fireEvent.change(screen.getByLabelText("生年"), { target: { value: "1998" } })
    fireEvent.click(screen.getByRole("button", { name: "雨の夜" }))

    expect(document.documentElement.dataset.textSize).toBe("large")
    expect(document.documentElement.dataset.theme).toBe("dark")
    expect(window.localStorage.getItem("mikan-chat.appearance.v1")).toContain('"theme":"dark"')
    expect(window.localStorage.getItem("mikan-chat.onboarding.v1")).toContain('"birthYear":1998')
    expect(window.localStorage.getItem("mikan-chat.onboarding.v1")).toContain('"favoriteGenres":["日常","雨の夜"]')

    fireEvent.click(screen.getByRole("button", { name: "接続設定" }))
    expect(screen.getByRole("dialog", { name: "会話AIの設定" })).toBeInTheDocument()
  })

  it("Web版で会話AIと別のBYOK読み上げTTSを保存できる", async () => {
    delete window.mikan
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ items: [] })))
    window.history.replaceState({}, "", "/settings")
    render(<App />)

    await screen.findByRole("heading", { name: "読み上げの音声" })
    fireEvent.click(screen.getByRole("button", { name: "音声設定" }))
    fireEvent.click(screen.getByRole("button", { name: /外部の読み上げAI/ }))
    fireEvent.change(screen.getByRole("textbox", { name: "接続先URL" }), { target: { value: "https://tts.example.com/v1" } })
    fireEvent.change(screen.getByRole("textbox", { name: "モデル名" }), { target: { value: "voice-model" } })
    fireEvent.change(screen.getByRole("textbox", { name: "声の名前" }), { target: { value: "voice-a" } })
    fireEvent.change(document.querySelector("#tts-api-key")!, { target: { value: "tts-test-key" } })

    expect(JSON.parse(window.localStorage.getItem("mikan-chat.tts.v1") ?? "null")).toEqual({
      provider: "openai-compatible",
      apiKey: "tts-test-key",
      endpoint: "https://tts.example.com/v1",
      model: "voice-model",
      voice: "voice-a",
    })
    expect(screen.getByRole("switch", { name: "返答を読み上げる" })).toBeEnabled()
  })

  it("Web版でElevenLabsのBYOK設定を保存できる", async () => {
    delete window.mikan
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ items: [] })))
    window.history.replaceState({}, "", "/settings")
    render(<App />)

    await screen.findByRole("heading", { name: "読み上げの音声" })
    fireEvent.click(screen.getByRole("button", { name: "音声設定" }))
    const elevenLabsCard = screen.getByRole("button", { name: /ElevenLabs/ })
    const kokoroCard = screen.getByRole("button", { name: /Kokoro/ })
    fireEvent.click(elevenLabsCard)
    const settingsPanel = screen.getByTestId("selected-tts-settings")
    expect(elevenLabsCard).toHaveAttribute("aria-expanded", "true")
    expect(elevenLabsCard).toHaveAttribute("aria-controls", settingsPanel.id)
    expect(elevenLabsCard.nextElementSibling).toContainElement(settingsPanel)
    expect(kokoroCard).toHaveAttribute("aria-expanded", "false")
    fireEvent.change(screen.getByPlaceholderText("ElevenLabsのVoice ID"), { target: { value: "voice-jp" } })
    fireEvent.change(document.querySelector("#tts-api-key")!, { target: { value: "eleven-test-key" } })
    fireEvent.click(screen.getByRole("button", { name: /ElevenLabs/, pressed: true }))

    expect(JSON.parse(window.localStorage.getItem("mikan-chat.tts.v1") ?? "null")).toEqual({
      provider: "elevenlabs",
      apiKey: "eleven-test-key",
      endpoint: "https://api.elevenlabs.io/v1",
      model: "eleven_flash_v2_5",
      voice: "voice-jp",
    })
    expect(screen.getByRole("switch", { name: "返答を読み上げる" })).toBeEnabled()
  })

  it("Web版で無料のKokoroを選択できる", async () => {
    delete window.mikan
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ items: [] })))
    window.history.replaceState({}, "", "/settings")
    render(<App />)

    await screen.findByRole("heading", { name: "読み上げの音声" })
    fireEvent.click(screen.getByRole("button", { name: "音声設定" }))
    fireEvent.click(screen.getByRole("button", { name: /Kokoro/ }))

    expect(JSON.parse(window.localStorage.getItem("mikan-chat.tts.v1") ?? "null")).toEqual({
      provider: "kokoro",
      apiKey: "",
      endpoint: "",
      model: "Kokoro-82M",
      voice: "jf_alpha",
    })
    expect(screen.getByText("音声生成はブラウザ内で完結し、文章は外部へ送信しません。", { exact: false })).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "モデルをダウンロード" })).toBeEnabled()
    expect(screen.getByRole("switch", { name: "返答を読み上げる" })).toHaveAttribute("aria-disabled", "true")
  })

  it("保存した表示設定を起動時に復元する", () => {
    window.localStorage.setItem("mikan-chat.appearance.v1", JSON.stringify({ textSize: "large", theme: "dark" }))

    render(<App />)

    expect(document.documentElement.dataset.textSize).toBe("large")
    expect(document.documentElement.dataset.theme).toBe("dark")
  })

  it("オンライン接続はAPIキー入力後に確定でき、再表示でも保持する", () => {
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    const googleAI = screen.getByRole("button", { name: /Google AI Studio/ })
    fireEvent.click(googleAI)
    expect(googleAI).toHaveAttribute("aria-pressed", "true")
    expect(googleAI).toHaveAttribute("aria-expanded", "true")
    expect(within(googleAI).getByText("選択中")).toBeInTheDocument()
    const googleSettings = document.getElementById("ai-settings-google")
    expect(googleSettings).toBeInTheDocument()
    expect(googleAI.nextElementSibling).toContainElement(googleSettings)
    const confirm = screen.getByRole("button", { name: "Google AI Studioを使う" })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText("APIキーを入力"), { target: { value: "runtime-test-key" } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    fireEvent.click(screen.getByRole("button", { name: "設定" }))
    fireEvent.click(screen.getByRole("button", { name: "接続設定" }))

    expect(screen.getByPlaceholderText("APIキーを入力")).toHaveValue("runtime-test-key")
  })

  it("内蔵モデルの起動エラー時にもモデルを削除できる", async () => {
    const deleteModel = vi.fn().mockResolvedValue(undefined)
    window.mikan!.localAI = {
      status: vi.fn().mockResolvedValue({
        state: "error",
        modelId: "qwen3-1.7b",
        label: "Qwen3 1.7B",
        source: DEFAULT_BUILTIN_MODEL.source,
        downloadedBytes: 0,
        totalBytes: 0,
        error: "モデルが破損しています。",
      }),
      download: vi.fn().mockResolvedValue(undefined),
      delete: deleteModel,
      chat: vi.fn(),
      cancel: vi.fn(),
      onStatus: vi.fn().mockReturnValue(vi.fn()),
      onChunk: vi.fn().mockReturnValue(vi.fn()),
    }
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    fireEvent.click(await screen.findByRole("button", { name: "モデルを削除" }))

    expect(deleteModel).toHaveBeenCalledTimes(1)
  })

  it("内蔵モデル切り替え後に直前モデルの遅い状態を表示しない", async () => {
    let resolveQwen!: (status: LocalAIStatus) => void
    const qwenStatus = new Promise<LocalAIStatus>((resolve) => { resolveQwen = resolve })
    window.mikan!.localAI = {
      status: vi.fn((spec) => spec.source === DEFAULT_BUILTIN_MODEL.source
        ? qwenStatus
        : Promise.resolve({ state: "missing" as const, modelId: spec.source, label: spec.label, source: spec.source, downloadedBytes: 0, totalBytes: 0 })),
      download: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      chat: vi.fn(),
      cancel: vi.fn(),
      onStatus: vi.fn().mockReturnValue(vi.fn()),
      onChunk: vi.fn().mockReturnValue(vi.fn()),
    }
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: GEMMA_4_12B_MODEL.label }))
    expect(await screen.findByRole("button", { name: "モデルをダウンロード" })).toBeEnabled()
    await act(async () => resolveQwen({ state: "ready", modelId: "qwen3-1.7b", label: DEFAULT_BUILTIN_MODEL.label, source: DEFAULT_BUILTIN_MODEL.source, downloadedBytes: 1, totalBytes: 1 }))

    expect(screen.queryByText("利用できます")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "モデルをダウンロード" })).toBeEnabled()
  })

  it("内蔵AIから別の接続へ切り替えると利用可能な初期値を入れる", async () => {
    window.mikan!.localAI = {
      status: vi.fn().mockResolvedValue({
        state: "ready",
        modelId: "qwen3-1.7b",
        label: "Qwen3 1.7B",
        source: DEFAULT_BUILTIN_MODEL.source,
        downloadedBytes: 1,
        totalBytes: 1,
      }),
      download: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      chat: vi.fn(),
      cancel: vi.fn(),
      onStatus: vi.fn().mockReturnValue(vi.fn()),
      onChunk: vi.fn().mockReturnValue(vi.fn()),
    }
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    fireEvent.click(await screen.findByRole("button", { name: /このPCのAI/ }))
    expect(screen.getByRole("textbox", { name: /接続先URL/ })).toHaveValue("http://127.0.0.1:11434/v1")
    fireEvent.click(screen.getByRole("button", { name: /内蔵AI/ }))
    fireEvent.click(screen.getByRole("button", { name: /その他のオンラインAI/ }))
    expect(screen.getByRole("textbox", { name: /接続先URL/ })).toHaveValue("https://api.openai.com/v1")
    expect(screen.getByRole("textbox", { name: "モデル名" })).toHaveValue("gpt-4.1-mini")
  })

  it("Web版は保存した接続設定を次回起動時に復元する", () => {
    delete window.mikan
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json({ items: [] }))))
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    const firstRender = render(<App />)

    fireEvent.change(screen.getByPlaceholderText("APIキーを入力"), { target: { value: "runtime-test-key" } })
    fireEvent.click(screen.getByRole("button", { name: "Google AI Studioを使う" }))
    firstRender.unmount()

    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    expect(screen.getByPlaceholderText("APIキーを入力")).toHaveValue("runtime-test-key")
    expect(screen.getByRole("textbox", { name: /モデル名/ })).toHaveValue("gemini-flash-latest")
  })

  it("Electron版はmainプロセスから設定を復元し、変更を保存する", async () => {
    const saveSettings = vi.fn().mockResolvedValue(undefined)
    window.mikan = {
      platform: "darwin",
      store: {
        load: vi.fn().mockResolvedValue({
          settings: {
            connection: { type: "local", apiKey: "", endpoint: "http://127.0.0.1:11434/v1", model: "qwen3:8b" },
            tts: { provider: "browser", apiKey: "", endpoint: "", model: "", voice: "" },
            profile: { gender: "woman", birthYear: 1995, favoriteGenres: ["恋愛"] },
            appearance: { textSize: "large", theme: "dark" },
            readAloud: false,
          },
          recoveredCorruptData: false,
          secretsAvailable: true,
        }),
        saveSettings,
      },
    }

    render(<App />)

    await screen.findByRole("button", { name: "設定" })
    expect(document.documentElement.dataset.textSize).toBe("large")
    expect(document.documentElement.dataset.theme).toBe("dark")
    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      connection: expect.objectContaining({ model: "qwen3:8b" }),
      profile: expect.objectContaining({ favoriteGenres: ["恋愛"] }),
    })), { timeout: 2_000 })
  })

  it("以前のタブ保存設定をブラウザ保存へ移行する", () => {
    delete window.mikan
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json({ items: [] }))))
    window.sessionStorage.setItem("mikan-chat.connection.v1", JSON.stringify({
      type: "online",
      apiKey: "legacy-test-key",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-flash-latest",
    }))
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")

    render(<App />)

    expect(screen.getByPlaceholderText("APIキーを入力")).toHaveValue("legacy-test-key")
    expect(window.localStorage.getItem("mikan-chat.connection.v1")).toContain("legacy-test-key")
    expect(window.sessionStorage.getItem("mikan-chat.connection.v1")).toBeNull()
  })

  it("接続対象を変えると以前のテスト結果を消す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [{ id: "qwen3:8b" }] })))
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    fireEvent.change(screen.getByRole("textbox", { name: "モデル名" }), { target: { value: "qwen3:8b" } })
    fireEvent.click(screen.getByRole("button", { name: "接続を確認" }))
    expect(await screen.findByText("接続できました")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Google AI Studio/ }))

    expect(screen.queryByText("接続できました")).not.toBeInTheDocument()
  })

  it("アプリ版でインストール済みのローカルAIモデルを検出して選べる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [{ id: "qwen3:8b" }, { id: "gemma3:4b" }] })))
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "インストール済みモデルを確認" }))

    const models = await screen.findByRole("group", { name: "インストール済みモデル" })
    fireEvent.click(within(models).getByRole("button", { name: "gemma3:4b" }))
    expect(screen.getByRole("textbox", { name: "モデル名" })).toHaveValue("gemma3:4b")
  })

  it("接続テスト中に設定を変えたら古い成功結果を表示しない", async () => {
    let resolveFetch!: (response: Response) => void
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve })))
    window.history.replaceState({}, "", "/?screen=home&overlay=connection")
    render(<App />)

    fireEvent.change(screen.getByRole("textbox", { name: "モデル名" }), { target: { value: "qwen3:8b" } })
    fireEvent.click(screen.getByRole("button", { name: "接続を確認" }))
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
    expect(screen.getByRole("button", { name: "その他のオンラインAIを使う" })).toBeDisabled()
  })

  it("接続設定をキャンセルすると未確定の選択を破棄する", () => {
    window.history.replaceState({}, "", "/settings")
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "接続設定" }))
    fireEvent.click(screen.getByRole("button", { name: /Google AI Studio/ }))
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }))
    fireEvent.click(screen.getByRole("button", { name: "接続設定" }))

    expect(screen.getByRole("button", { name: /このPCのAI OllamaやLM Studioにつなぎます/ })).toHaveAttribute("aria-pressed", "true")
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

    expect(screen.getByRole("dialog", { name: "会話AIの設定" })).toBeInTheDocument()
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
    expect(screen.getByRole("heading", { name: "雨の夜、閉店後の喫茶店で" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "別のシナリオを見る" }))
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

  it("Electron版の音声設定からIrodori TTSを自動セットアップできる", async () => {
    const install = vi.fn().mockResolvedValue(undefined)
    window.mikan!.irodori = {
      status: vi.fn().mockResolvedValue({ supported: true, state: "missing", progress: 0, stage: "セットアップが必要です" }),
      install,
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      onStatus: vi.fn().mockReturnValue(vi.fn()),
    }
    window.history.replaceState({}, "", "/?screen=talk&overlay=voice")
    render(<App />)

    expect(screen.getByText("Hayamimi")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "マイクを試す" })).toBeEnabled()
    const readAloud = screen.getByRole("switch", { name: "返答を読み上げる" })
    expect(readAloud).toHaveAttribute("aria-disabled", "true")
    expect(readAloud).not.toBeChecked()
    fireEvent.click(screen.getByRole("button", { name: /Irodori TTS このPC/ }))
    const setup = await screen.findByRole("button", { name: "IrodoriをこのMacで使えるようにする" })
    expect(screen.queryByRole("textbox", { name: /接続先URL/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Irodori TTSをセットアップしてください" })).toBeDisabled()
    fireEvent.click(setup)

    await waitFor(() => expect(install).toHaveBeenCalledOnce())
  })

  it("Electron版でも無料のKokoroを選択してモデルを管理できる", async () => {
    window.history.replaceState({}, "", "/?screen=talk&overlay=voice")
    render(<App />)

    const kokoroCard = screen.getByRole("button", { name: /Kokoro/ })
    fireEvent.click(kokoroCard)

    expect(kokoroCard).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("音声生成はアプリ内で完結し、文章は外部へ送信しません。", { exact: false })).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "モデルをダウンロード" })).toBeEnabled()
  })

  it("Irodoriの参照音声確認が一時失敗しても再確認する", async () => {
    const saveSettings = vi.fn().mockResolvedValue(undefined)
    const hasReference = vi.fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockRejectedValueOnce(new Error("temporary"))
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue(false)
    window.mikan = {
      platform: "darwin",
      store: {
        load: vi.fn().mockResolvedValue({
          settings: {
            connection: { type: "local", apiKey: "", endpoint: "http://127.0.0.1:11434/v1", model: "qwen3:8b" },
            tts: { provider: "irodori", apiKey: "", endpoint: "http://127.0.0.1:8088/v1", model: "irodori-tts", voice: "none" },
            profile: { gender: "prefer-not-to-say", birthYear: 2000, favoriteGenres: ["日常"] },
            appearance: { textSize: "medium", theme: "light" },
            readAloud: true,
          },
          recoveredCorruptData: false,
          secretsAvailable: true,
        }),
        saveSettings,
      },
      irodori: {
        status: vi.fn().mockResolvedValue({ supported: true, state: "ready", progress: 100, stage: "利用できます" }),
        install: vi.fn().mockResolvedValue(undefined),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        onStatus: vi.fn().mockReturnValue(vi.fn()),
      },
      tts: {
        synthesizeLocal: vi.fn(),
        hasReference,
        registerReference: vi.fn(),
        cancelLocal: vi.fn(),
      },
    }
    window.localStorage.setItem("mikan-chat.scenario-voices.v1", JSON.stringify({
      [`${DEMO_PUBLIC_ID}:aoi`]: {
        characterId: "aoi",
        voiceId: `mikan-user-${DEMO_PUBLIC_ID}-aoi-1-0-0`,
        caption: "物静かな声",
        seed: 42,
        scenarioVersion: "1.0.0",
      },
    }))
    mockDemoPackFetch()
    window.history.replaceState({}, "", "/#/?screen=home&overlay=import")

    render(<HashRouter><AppContent /></HashRouter>)
    fireEvent.click(await screen.findByRole("button", { name: "デモを読み込む" }))
    await screen.findByRole("heading", { name: "雨の夜、閉店後の喫茶店で" })
    fireEvent.click(screen.getByRole("button", { name: "追加して話す" }))

    expect(await screen.findByRole("heading", { name: "キャラクターの声を決める" }, { timeout: 8_000 })).toBeInTheDocument()
    expect(hasReference.mock.calls.length).toBeGreaterThanOrEqual(4)
    expect(screen.getByRole("switch", { name: "返答を読み上げる" })).not.toBeChecked()
    expect(saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ readAloud: true }))
  }, 10_000)

  it("Web版はブラウザ標準TTSで返答を読み上げる", async () => {
    class MockUtterance {
      text: string
      lang = ""
      onend: (() => void) | null = null
      onerror: (() => void) | null = null

      constructor(text: string) {
        this.text = text
      }
    }
    const speak = vi.fn()
    const cancel = vi.fn()
    delete window.mikan
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance)
    vi.stubGlobal("speechSynthesis", { cancel, speak })
    window.localStorage.setItem("mikan-chat.connection.v1", JSON.stringify({
      type: "online",
      apiKey: "runtime-test-key",
      endpoint: "https://example.com/v1",
      model: "test-model",
    }))
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      items: [{
        id: "browser-tts",
        publicId: TEST_PUBLIC_ID,
        slug: "browser-tts",
        title: "ブラウザ音声テスト",
        characterName: "葵",
        summary: "音声確認用シナリオ",
        coverPath: null,
        rating: "all",
        tags: ["テスト"],
        conversationLabel: "1人と会話",
        lastMessage: "話してみて。",
        lastActive: "",
        opening: [{ role: "character", speakerName: "葵", text: "話してみて。" }],
        pack: { plot: { characters: [{ id: "aoi", name: "葵", profile: "幼なじみ" }] } },
      }],
    })))
    render(<App />)

    fireEvent.click(await screen.findByRole("button", { name: "ブラウザ音声テスト" }))
    fireEvent.click(screen.getByRole("button", { name: "この物語をはじめる" }))
    expect(screen.queryByRole("button", { name: "AI接続設定" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "音声設定" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "AIと音声の設定" }))
    fireEvent.click(screen.getByRole("button", { name: "BGM" }))
    expect(screen.getByRole("dialog", { name: "BGM設定" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "同梱BGMから選ぶ" })).toBeInTheDocument()
    expect(document.querySelector("audio[controls]")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "音声" }))
    expect(screen.getByRole("button", { name: "音声" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("ブラウザ標準TTS")).toBeInTheDocument()
    const readAloud = screen.getByRole("switch", { name: "返答を読み上げる" })
    expect(readAloud).toBeEnabled()
    fireEvent.click(readAloud)
    fireEvent.click(screen.getByRole("button", { name: "ブラウザ標準TTSを試す" }))
    expect(speak).toHaveBeenCalled()
    const cancelCount = cancel.mock.calls.length
    fireEvent.click(screen.getByRole("button", { name: "会話AI" }))
    expect(cancel.mock.calls.length).toBeGreaterThan(cancelCount)
    fireEvent.click(screen.getByRole("button", { name: "音声" }))
    fireEvent.click(screen.getByRole("button", { name: "完了" }))
    expect(screen.getAllByRole("button", { name: "音声を再生" }).length).toBeGreaterThan(0)

    speak.mockClear()
    const composer = screen.getByPlaceholderText("メッセージを入力")
    fireEvent.change(composer, { target: { value: "今日はどうだった？" } })
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" })
    await waitFor(() => expect(speak).toHaveBeenCalled())
    expect((speak.mock.calls[0][0] as MockUtterance).text).toContain("急がなくて大丈夫")
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

function scenarioApiItem(id: string, title: string, publicId = TEST_PUBLIC_ID) {
  return {
    id,
    publicId,
    slug: id,
    title,
    characterName: title,
    summary: `${title}の説明。`,
    coverPath: null,
    rating: "all",
    tags: [],
    conversationLabel: "1人と会話",
    lastMessage: "こんにちは",
    lastActive: "",
    pack: {},
  }
}

function configureLocalAI() {
  fireEvent.click(screen.getByRole("button", { name: "AIと音声の設定" }))
  fireEvent.change(screen.getByRole("textbox", { name: "モデル名" }), { target: { value: "qwen3:8b" } })
  fireEvent.click(screen.getByRole("button", { name: "このPCのAIを使う" }))
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
    id: DEMO_PUBLIC_ID,
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
