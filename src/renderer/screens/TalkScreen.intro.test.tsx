import { createRef } from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ChatTimeline } from "@/components/chat/chat-timeline"
import { CharacterStage } from "@/components/chat/character-stage"
import { ConversationHistorySheet } from "@/components/chat/conversation-history-sheet"
import { ScenarioBgmPlayer } from "@/components/chat/scenario-bgm-player"
import type { Character } from "@/data/characters"
import { readScenarioContext } from "@/lib/scenario-context"
import { getCharacterSpeechChunks, TalkScreen } from "@/screens/TalkScreen"
import type { IrodoriRuntimeStatus } from "../../shared/local-tts"

describe("TalkScreenの物語導入", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    window.localStorage.clear()
    delete window.mikan
  })

  it("キャラクター画像をアプリ外へドラッグできない", () => {
    render(<CharacterStage image="/character.webp" name="ミア" />)
    const image = screen.getByRole("img", { name: "ミアのキャラクタービジュアル" })

    expect(image).toHaveAttribute("draggable", "false")
    expect(fireEvent.dragStart(image)).toBe(false)
  })

  it("待機モーションがあれば静止画をポスターにして自動ループする", () => {
    render(<CharacterStage image="/character.webp" idleVideo="/character.mp4" name="ミア" />)

    const video = document.querySelector("video")
    expect(video).not.toBeNull()
    expect(video).toHaveAttribute("src", "/character.mp4")
    expect(video).toHaveAttribute("poster", "/character.webp")
    expect(video).toHaveProperty("autoplay", true)
    expect(video).toHaveProperty("loop", true)
    expect(video).toHaveProperty("muted", true)
  })

  it("同梱BGMを選ぶと保存して自動再生する", async () => {
    render(<>
      <ScenarioBgmPlayer scenarioId="custom-bgm" title="テスト" />
      <ScenarioBgmPlayer scenarioId="custom-bgm" title="テスト" mode="settings" />
    </>)
    expect(screen.getByTitle("テストのBGM")).toHaveAttribute("src", "/bgm/kamatamago_B00025_jikosyoukai.m4a")

    fireEvent.click(screen.getByRole("button", { name: "雨の日" }))
    fireEvent.change(screen.getByLabelText("BGM音量"), { target: { value: "35" } })

    await waitFor(() => expect(screen.getByTitle("テストのBGM")).toBeInTheDocument())
    expect(document.querySelector("audio")).toHaveAttribute("src", "/bgm/kamatamago_B00222_today-is-a-rainy-day.m4a")
    expect(JSON.parse(window.localStorage.getItem("mikan.bgm.custom-bgm") ?? "null")).toMatchObject({ customUrl: "/bgm/kamatamago_B00222_today-is-a-rainy-day.m4a", volume: 35, enabled: true })
  })

  it("BGM未指定でもURLと音量を保存できる", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ streamUrl: "https://s3.ustatik.com/audio.com.audio/transcoding/a.mp3?sig=1", title: "自作BGM" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<>
      <ScenarioBgmPlayer scenarioId="custom-bgm" title="テスト" />
      <ScenarioBgmPlayer scenarioId="custom-bgm" title="テスト" mode="settings" />
    </>)
    expect(screen.getByTitle("テストのBGM")).toHaveAttribute("src", "/bgm/kamatamago_B00025_jikosyoukai.m4a")

    fireEvent.change(screen.getByLabelText("BGMのURL"), { target: { value: "https://audio.com/embed/audio/1793474640476011" } })
    fireEvent.click(screen.getByRole("button", { name: "この音源を使う" }))
    fireEvent.change(screen.getByLabelText("BGM音量"), { target: { value: "35" } })

    await waitFor(() => expect(screen.getByTitle("テストのBGM")).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith("/api/bgm/audio-com?source=1793474640476011", expect.anything())
    expect(JSON.parse(window.localStorage.getItem("mikan.bgm.custom-bgm") ?? "null")).toMatchObject({ customUrl: "https://audio.com/embed/audio/1793474640476011", volume: 35, enabled: true })
  })

  it("BGM設定を保存できない環境でも会話画面を表示する", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota") })

    expect(() => render(<ScenarioBgmPlayer scenarioId="no-storage" title="テスト" mode="settings" />)).not.toThrow()
    expect(screen.getByRole("group", { name: "同梱BGMから選ぶ" })).toBeInTheDocument()
    setItem.mockRestore()
  })

  it("BGMの再生を停止できる", async () => {
    render(<>
      <ScenarioBgmPlayer scenarioId="mute-bgm" title="テスト" />
      <ScenarioBgmPlayer scenarioId="mute-bgm" title="テスト" mode="settings" />
    </>)
    expect(screen.getByTitle("テストのBGM")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("switch", { name: "BGMを再生する" }))

    await waitFor(() => expect(screen.queryByTitle("テストのBGM")).not.toBeInTheDocument())
    expect(window.localStorage.getItem("mikan.bgm.mute-bgm")).toContain('"enabled":false')
  })

  it("音声ファイルを読み込んで再生できる", async () => {
    render(<>
      <ScenarioBgmPlayer scenarioId="file-bgm" title="テスト" />
      <ScenarioBgmPlayer scenarioId="file-bgm" title="テスト" mode="settings" />
    </>)

    const file = new File([new Uint8Array([1, 2, 3, 4])], "my-bgm.mp3", { type: "audio/mpeg" })
    fireEvent.change(screen.getByLabelText("読み込む音声ファイル"), { target: { files: [file] } })

    await waitFor(() => expect(screen.getByTitle("テストのBGM")).toHaveAttribute("src", expect.stringContaining("data:audio/mpeg;base64,")))
    expect(screen.getByTitle("my-bgm.mp3")).toBeInTheDocument()
  })

  it("audio.com指定のBGMは窓を出さず音声だけ読み込む", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ streamUrl: "https://s3.ustatik.com/audio.com.audio/transcoding/a.mp3?sig=1", title: "テストBGM" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<ScenarioBgmPlayer scenarioId="audio-com-bgm" title="テスト" pack={{ extensions: { "mikan.bgm": { provider: "audio.com", id: "1793474640476011" } } }} />)

    await waitFor(() => expect(document.querySelector("audio")).not.toBeNull())
    const audio = document.querySelector("audio")!
    expect(audio).toHaveAttribute("src", "https://s3.ustatik.com/audio.com.audio/transcoding/a.mp3?sig=1")
    expect(audio).toHaveProperty("loop", true)
    expect(audio).toHaveAttribute("hidden")
    expect(audio).not.toHaveAttribute("controls")
    expect(document.querySelector("iframe")).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith("/api/bgm/audio-com?source=1793474640476011", expect.anything())
  })

  it("ストリーム中は完成したキャラクターの文だけを順番に取り出す", () => {
    const character = createCharacter()
    const reply = `>: 窓の外で雨が降る。\n${character.name}: おかえり。今日はどうだった`

    expect(getCharacterSpeechChunks(reply, character)).toEqual([
      { text: "おかえり。", speakerName: character.name },
    ])
    expect(getCharacterSpeechChunks(reply, character, true)).toEqual([
      { text: "おかえり。", speakerName: character.name },
      { text: "今日はどうだった", speakerName: character.name },
    ])
  })

  it("次の話者が現れたら句点のない直前の台詞も一度だけ確定する", () => {
    const character = createCharacter()
    const reply = `${character.name}: ありがとう\nノア: 任せて。`

    expect(getCharacterSpeechChunks(reply, character)).toEqual([
      { text: "ありがとう", speakerName: character.name },
      { text: "任せて。", speakerName: "ノア" },
    ])
    expect(getCharacterSpeechChunks(reply, character, true)).toEqual([
      { text: "ありがとう", speakerName: character.name },
      { text: "任せて。", speakerName: "ノア" },
    ])
  })

  it("内蔵モデル未取得時は入力を保持して設定を開く", async () => {
    const onOpenConnection = vi.fn()
    window.mikan = {
      platform: "darwin",
      localAI: {
        status: vi.fn(async () => ({ state: "missing", modelId: "qwen3-1.7b", label: "Qwen3 1.7B", source: "hf:Qwen/Qwen3-1.7B-GGUF:Q8_0", downloadedBytes: 0, totalBytes: 0 } as const)),
        download: vi.fn(),
        delete: vi.fn(),
        chat: vi.fn(),
        cancel: vi.fn(),
        onStatus: vi.fn(() => () => undefined),
        onChunk: vi.fn(() => () => undefined),
      },
    }
    render(
      <TalkScreen
        character={createCharacter()}
        conversationId="today"
        connection={{ type: "builtin", apiKey: "", endpoint: "", model: "qwen3-1.7b" }}
        readAloud={false}
        onBack={() => undefined}
        onOpenConnection={onOpenConnection}
        onOpenVoice={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )
    await act(() => Promise.resolve())
    const composer = screen.getByPlaceholderText("メッセージを入力")
    fireEvent.change(composer, { target: { value: "消さないで" } })
    fireEvent.click(screen.getByRole("button", { name: "送信" }))

    expect(composer).toHaveValue("消さないで")
    expect(onOpenConnection).toHaveBeenCalledOnce()
    expect(screen.getByRole("alert")).toHaveTextContent("先に会話に使うAIを設定してください。")
  })

  it("新しい物語では導入を上から順に表示し、開始後の台詞を文字送りする", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
    vi.mocked(Element.prototype.scrollIntoView).mockClear()
    const character = createCharacter()

    const { rerender } = render(
      <TalkScreen
        character={character}
        conversationId="today"
        connection={{ type: "online", apiKey: "", endpoint: "", model: "" }}
        readAloud={false}
        isNewStory
        onBack={() => undefined}
        onOpenConnection={() => undefined}
        onOpenVoice={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )

    expect(screen.queryByText("物語のはじまり")).not.toBeInTheDocument()
    expect(screen.queryByText("ここから、物語がはじまる")).not.toBeInTheDocument()
    expect(screen.queryByText("頼みがあるの。")).not.toBeInTheDocument()
    const composer = screen.getByPlaceholderText("メッセージを入力")
    expect(composer).toBeEnabled()
    fireEvent.change(composer, { target: { value: "先に入力しておく" } })
    expect(screen.getByRole("button", { name: "送信" })).toBeDisabled()
    const timeline = screen.getByRole("region", { name: "ミア・ノアとの会話" })
    Object.defineProperties(timeline, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, value: 0, writable: true },
    })
    fireEvent.scroll(timeline)
    vi.mocked(Element.prototype.scrollIntoView).mockClear()

    await act(() => vi.advanceTimersByTimeAsync(180))
    expect(screen.getByText("物語のはじまり")).toBeInTheDocument()
    expect(screen.queryByText("酒場の最後の客")).not.toBeInTheDocument()
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()

    timeline.scrollTop = 500
    fireEvent.scroll(timeline)
    await act(() => vi.advanceTimersByTimeAsync(360))
    expect(screen.getByText("酒場の最後の客")).toBeInTheDocument()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(360))
    expect(screen.getByText("閉店後の酒場で依頼を持ちかけられる。")).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(360))
    expect(screen.getByText("ノア — 店を守る寡黙な護衛。")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("メッセージを入力")).toHaveValue("先に入力しておく")
    expect(screen.getByRole("button", { name: "送信" })).toBeDisabled()

    await act(() => vi.advanceTimersByTimeAsync(360))
    expect(screen.getByText("ここから、物語がはじまる")).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(350))
    expect(screen.getByText("頼")).toBeInTheDocument()

    await act(() => vi.runAllTimersAsync())
    expect(screen.getByText("頼みがあるの。")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("メッセージを入力")).toBeEnabled()
    expect(screen.getByPlaceholderText("メッセージを入力")).toHaveValue("先に入力しておく")
    expect(screen.getByRole("button", { name: "送信" })).toBeEnabled()
    expect(screen.getByRole("status")).toHaveTextContent(/頼みがあるの/)
    expect(screen.queryByText("今日 20:42")).not.toBeInTheDocument()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()

    rerender(
      <TalkScreen
        character={character}
        conversationId="today"
        connection={{ type: "online", apiKey: "", endpoint: "", model: "" }}
        readAloud={false}
        isNewStory={false}
        onBack={() => undefined}
        onOpenConnection={() => undefined}
        onOpenVoice={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )
    expect(screen.getByText("物語のはじまり")).toBeInTheDocument()
    expect(screen.getByText("頼みがあるの。")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("メッセージを入力")).toBeEnabled()
  })

  it("既存の会話でも物語のはじまりを表示する", () => {
    const character = createCharacter()
    render(
      <TalkScreen
        character={character}
        conversationId="today"
        connection={{ type: "online", apiKey: "", endpoint: "", model: "" }}
        readAloud={false}
        isNewStory={false}
        onBack={() => undefined}
        onOpenConnection={() => undefined}
        onOpenVoice={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )
    expect(screen.getByText("物語のはじまり")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("メッセージを入力")).toBeEnabled()
  })

  it("モーション低減時は導入を即時表示する", () => {
    vi.useFakeTimers()
    const character = createCharacter()

    render(
      <TalkScreen
        character={character}
        conversationId="today"
        connection={{ type: "online", apiKey: "", endpoint: "", model: "" }}
        readAloud={false}
        isNewStory
        onBack={() => undefined}
        onOpenConnection={() => undefined}
        onOpenVoice={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )

    expect(screen.getByText("物語のはじまり")).toBeInTheDocument()
    expect(screen.getByText("ここから、物語がはじまる")).toBeInTheDocument()
    expect(screen.getByText("頼みがあるの。")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("メッセージを入力")).toBeEnabled()
  })

  it("導入途中で会話を切り替えると旧タイマーを破棄する", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
    const character = createCharacter()
    const props = {
      character,
      connection: { type: "online" as const, apiKey: "", endpoint: "", model: "" },
      readAloud: false,
      onBack: () => undefined,
      onOpenConnection: () => undefined,
      onOpenVoice: () => undefined,
      onOpenHistory: () => undefined,
    }
    const { rerender } = render(<TalkScreen {...props} conversationId="today" isNewStory />)

    await act(() => vi.advanceTimersByTimeAsync(180))
    expect(screen.getByText("物語のはじまり")).toBeInTheDocument()

    rerender(<TalkScreen {...props} conversationId="rain" isNewStory={false} />)
    expect(vi.getTimerCount()).toBe(0)
    await act(() => vi.runAllTimersAsync())
    expect(screen.queryByText("頼みがあるの。")).not.toBeInTheDocument()
  })

  it("導入完了通知は後から増えた会話を再通知しない", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
    const character = createCharacter()
    const intro = readScenarioContext(character)
    const opening = [{ id: "opening-0", role: "character" as const, speakerName: "ミア", text: "頼みがあるの。", time: "導入" }]
    const endRef = createRef<HTMLDivElement>()
    const props = {
      characterName: character.name,
      intro,
      animateIntro: true,
      sequenceKey: "tavern:today",
      isGenerating: false,
      canPlayAudio: () => false,
      playingMessageId: null,
      onToggleAudio: () => undefined,
      endRef,
    }
    const { rerender } = render(<ChatTimeline {...props} messages={opening} />)

    await act(() => vi.runAllTimersAsync())
    const announcement = screen.getByRole("status").textContent
    expect(announcement).toContain("頼みがあるの。")

    rerender(<ChatTimeline {...props} messages={[...opening, { id: "later", role: "user", text: "後から送った会話", time: "12:00" }]} />)
    expect(screen.getByRole("status")).toHaveTextContent(announcement ?? "")
    expect(screen.getByRole("status")).not.toHaveTextContent("後から送った会話")
  })

  it("Irodoriの声が未確定ならメッセージの読み上げ操作を表示しない", () => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel: vi.fn(), speak: vi.fn() } })
    vi.stubGlobal("SpeechSynthesisUtterance", class {})

    render(
      <TalkScreen
        character={createCharacter()}
        conversationId="today"
        connection={{ type: "online", apiKey: "", endpoint: "", model: "" }}
        readAloud={false}
        ttsVoiceReady={false}
        onBack={() => undefined}
        onOpenConnection={() => undefined}
        onOpenVoice={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )

    expect(screen.queryByRole("button", { name: "音声を再生" })).not.toBeInTheDocument()
  })

  it("読み上げオフ継続ではサーバー停止を繰り返さない", async () => {
    let pushStatus!: (status: IrodoriRuntimeStatus) => void
    const start = vi.fn()
    const stop = vi.fn()
    window.mikan = {
      platform: "darwin",
      tts: { synthesizeLocal: vi.fn(), hasCachedAudio: vi.fn(async () => false), readCachedAudio: vi.fn(async () => null), cancelLocal: vi.fn() },
      irodori: {
        status: vi.fn(async (): Promise<IrodoriRuntimeStatus> => ({ supported: true, state: "ready", progress: 100, stage: "セットアップ済み" })),
        start, stop, install: vi.fn(), delete: vi.fn(),
        onStatus: vi.fn((callback: (status: IrodoriRuntimeStatus) => void) => {
          pushStatus = callback
          return () => undefined
        }),
      },
    }
    const screenProps = (readAloud: boolean) => (
      <TalkScreen
        character={createCharacter()}
        conversationId="today"
        connection={{ type: "online", apiKey: "", endpoint: "", model: "" }}
        ttsSettings={{ provider: "irodori", apiKey: "", endpoint: "http://127.0.0.1:8088/v1", model: "irodori-tts", voice: "none", irodoriQuality: "balanced" }}
        ttsVoiceReady
        readAloud={readAloud}
        onReadAloudChange={() => undefined}
        onBack={() => undefined}
        onOpenConnection={() => undefined}
        onOpenVoice={() => undefined}
        onOpenHistory={() => undefined}
      />
    )
    const { rerender } = render(screenProps(false))
    await act(() => Promise.resolve())
    expect(stop).not.toHaveBeenCalled()

    // 状態通知でドライバーが作り直されてもオフ継続では止めない
    await act(async () => {
      pushStatus({ supported: true, state: "running", progress: 100, stage: "利用できます" })
    })
    expect(stop).not.toHaveBeenCalled()

    rerender(screenProps(true))
    expect(start).toHaveBeenCalledTimes(1)
    rerender(screenProps(false))
    expect(stop).toHaveBeenCalledTimes(1)

    // オフ後の状態通知でも追加で止めない
    await act(async () => {
      pushStatus({ supported: true, state: "ready", progress: 100, stage: "セットアップ済み" })
    })
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it("生成中はスピナーを出し、再生開始で停止ボタンに切り替える", async () => {
    const playMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("Audio", class {
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      pause = vi.fn()
      play = playMock
    })
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:cached") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
    let resolveRead!: (audio: ArrayBuffer) => void
    window.mikan = {
      platform: "darwin",
      tts: {
        synthesizeLocal: vi.fn(),
        hasCachedAudio: vi.fn(async () => true),
        readCachedAudio: vi.fn(() => new Promise<ArrayBuffer>((resolve) => { resolveRead = resolve })),
        cancelLocal: vi.fn(),
      },
      irodori: {
        status: vi.fn(async (): Promise<IrodoriRuntimeStatus> => ({ supported: true, state: "running", progress: 100, stage: "利用できます" })),
        start: vi.fn(), stop: vi.fn(), install: vi.fn(), delete: vi.fn(),
        onStatus: vi.fn(() => () => undefined),
      },
    }
    render(
      <TalkScreen
        character={createCharacter()}
        conversationId="today"
        connection={{ type: "online", apiKey: "", endpoint: "", model: "" }}
        ttsSettings={{ provider: "irodori", apiKey: "", endpoint: "http://127.0.0.1:8088/v1", model: "irodori-tts", voice: "none", irodoriQuality: "balanced" }}
        ttsVoiceReady
        readAloud={false}
        onReadAloudChange={() => undefined}
        onBack={() => undefined}
        onOpenConnection={() => undefined}
        onOpenVoice={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )

    const playButtons = await screen.findAllByRole("button", { name: "音声を再生" }, { timeout: 5000 })
    fireEvent.click(playButtons[0])
    expect(await screen.findByRole("button", { name: "音声を生成中" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "音声を停止" })).not.toBeInTheDocument()

    await act(async () => {
      resolveRead(new Uint8Array([1, 2, 3, 4]).buffer)
    })
    await waitFor(() => expect(playMock).toHaveBeenCalled())
    expect(await screen.findByRole("button", { name: "音声を停止" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "音声を生成中" })).not.toBeInTheDocument()
  })

  it("読み上げON＋モデルロード中も生成済み音声は再生できる", async () => {
    const playMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("Audio", class {
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      pause = vi.fn()
      play = playMock
    })
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:cached") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
    const speak = vi.fn(async () => new Uint8Array([9, 9, 9]).buffer)
    const hasCachedAudio = vi.fn(async () => true)
    const readCachedAudio = vi.fn(async () => new Uint8Array([1, 2, 3, 4]).buffer)
    window.mikan = {
      platform: "darwin",
      tts: {
        synthesizeLocal: speak,
        hasCachedAudio,
        readCachedAudio,
        cancelLocal: vi.fn(),
      },
      irodori: {
        // モデル未ロード状態。ドライバーは supported=false になる。
        status: vi.fn(async (): Promise<IrodoriRuntimeStatus> => ({ supported: true, state: "starting", progress: 70, stage: "音声モデルを読み込んでいます" })),
        start: vi.fn(), stop: vi.fn(), install: vi.fn(), delete: vi.fn(),
        onStatus: vi.fn(() => () => undefined),
      },
    }
    render(
      <TalkScreen
        character={createCharacter()}
        conversationId="today"
        connection={{ type: "online", apiKey: "", endpoint: "", model: "" }}
        ttsSettings={{ provider: "irodori", apiKey: "", endpoint: "http://127.0.0.1:8088/v1", model: "irodori-tts", voice: "none", irodoriQuality: "balanced" }}
        ttsVoiceReady
        readAloud
        onReadAloudChange={() => undefined}
        onBack={() => undefined}
        onOpenConnection={() => undefined}
        onOpenVoice={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )

    // モデル未ロードでも生成済みボタンは隠れない
    await waitFor(() => expect(hasCachedAudio).toHaveBeenCalled())
    // 差し替え後の安定したDOMを同期的につかむ（findとclickの間に再レンダー禁止）
    await waitFor(() => expect(screen.queryAllByRole("button", { name: "音声を再生" }).length).toBeGreaterThan(0))
    await new Promise((r) => setTimeout(r, 100))
    fireEvent.click(screen.getAllByRole("button", { name: "音声を再生" })[0])

    // 新規生成ではなくキャッシュ再生になる
    await waitFor(() => expect(playMock).toHaveBeenCalled())
    expect(speak).not.toHaveBeenCalled()
    expect(await screen.findByRole("button", { name: "音声を停止" })).toBeInTheDocument()
  })

  it("ヘッダーのBGMボタンで設定ポップアップを開閉できる", () => {
    render(
      <TalkScreen
        character={createCharacter()}
        conversationId="today"
        connection={{ type: "online", apiKey: "", endpoint: "", model: "" }}
        readAloud={false}
        onBack={() => undefined}
        onOpenConnection={() => undefined}
        onOpenVoice={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )

    expect(screen.queryByRole("dialog", { name: "BGM設定" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "BGM" }))
    expect(screen.getByRole("dialog", { name: "BGM設定" })).toBeInTheDocument()
    expect(screen.getByText("同梱BGMから選ぶ")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("switch", { name: "BGMを再生する" }))
    expect(JSON.parse(window.localStorage.getItem("mikan.bgm.tavern") ?? "null")).toMatchObject({ enabled: false })

    fireEvent.click(screen.getByRole("button", { name: "BGM" }))
    expect(screen.queryByRole("dialog", { name: "BGM設定" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "BGM" }))
    expect(screen.getByRole("dialog", { name: "BGM設定" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "BGM" }))
    expect(screen.queryByRole("dialog", { name: "BGM設定" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "BGM" }))
    expect(screen.getByRole("dialog", { name: "BGM設定" })).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole("dialog", { name: "BGM設定" })).not.toBeInTheDocument()
  })

  it("BGMボタンは再生ONのときにオレンジ表示になる", () => {
    render(
      <TalkScreen
        character={createCharacter()}
        conversationId="today"
        connection={{ type: "online", apiKey: "", endpoint: "", model: "" }}
        readAloud={false}
        onBack={() => undefined}
        onOpenConnection={() => undefined}
        onOpenVoice={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )

    // 既定で再生ONのためオレンジ
    expect(screen.getByRole("button", { name: "BGM" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "BGM" }))
    fireEvent.click(screen.getByRole("switch", { name: "BGMを再生する" }))
    expect(screen.getByRole("button", { name: "BGM" })).toHaveAttribute("aria-pressed", "false")
  })
  it("macOSでは履歴シートが信号機と被らない位置に開く", () => {
    window.mikan = { platform: "darwin" }
    render(
      <ConversationHistorySheet
        open
        scenarioId="tavern"
        characterName="テスト"
        activeConversationId="today"
        onOpenChange={() => undefined}
        onSelectConversation={() => undefined}
      />,
    )

    const sheet = screen.getByTestId("conversation-history-sheet")
    expect(sheet).toHaveStyle({ top: "36px" })
  })

  it("macOS以外では履歴シートは全高のまま", () => {
    render(
      <ConversationHistorySheet
        open
        scenarioId="tavern"
        characterName="テスト"
        activeConversationId="today"
        onOpenChange={() => undefined}
        onSelectConversation={() => undefined}
      />,
    )

    expect(screen.getByTestId("conversation-history-sheet")).not.toHaveStyle({ top: "36px" })
  })

  it("発言者と情景描写を吹き出しに頼らず区別する", () => {
    const messages = [
      { id: "scene", role: "narration" as const, text: "雨音だけが残る。", time: "" },
      { id: "mia", role: "character" as const, speakerName: "ミア", text: "少し話さない？", time: "18:17" },
      { id: "user", role: "user" as const, text: "いいよ。", time: "18:18" },
    ]

    render(
      <ChatTimeline
        characterName="ミア"
        sequenceKey="tavern:today"
        messages={messages}
        isGenerating={false}
        canPlayAudio={() => true}
        playingMessageId={null}
        onToggleAudio={() => undefined}
        endRef={createRef<HTMLDivElement>()}
      />,
    )

    expect(screen.getByRole("article", { name: "情景描写" })).toHaveTextContent("雨音だけが残る。")
    const characterMessage = screen.getByRole("article", { name: "ミアの発言" })
    expect(characterMessage).toHaveTextContent("少し話さない？")
    expect(within(characterMessage).getByRole("button", { name: "音声を再生" })).toBeInTheDocument()
    expect(screen.getByRole("article", { name: "あなたの発言" })).toHaveTextContent("いいよ。")
  })
})

function createCharacter(): Character {
  return {
    id: "tavern",
    name: "ミア・ノア",
    packTitle: "閉店後の酒場で、秘密の依頼を",
    description: "閉店後の酒場で依頼を持ちかけられる。",
    lastMessage: "頼みがあるの。",
    lastActive: "",
    opening: [{ role: "character", speakerName: "ミア", text: "頼みがあるの。" }],
    pack: {
      plot: {
        premise: "閉店後の酒場で、和平条約を夜明けまで預かってほしいと頼まれる。",
        playerProfiles: [{ id: "guest", name: "酒場の最後の客", description: "閉店間際まで残っていた旅人。" }],
        defaultPlayerProfile: "guest",
        characters: [
          { id: "mia", name: "ミア", profile: "依頼を持ちかける店主。" },
          { id: "noah", name: "ノア", profile: "店を守る寡黙な護衛。" },
        ],
      },
    },
  }
}
