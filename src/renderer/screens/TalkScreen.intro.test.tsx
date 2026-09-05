import { createRef } from "react"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ChatTimeline } from "@/components/chat/chat-timeline"
import { CharacterStage } from "@/components/chat/character-stage"
import type { Character } from "@/data/characters"
import { readScenarioContext } from "@/lib/scenario-context"
import { getCharacterSpeechChunks, TalkScreen } from "@/screens/TalkScreen"

describe("TalkScreenの物語導入", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    delete window.mikan
  })

  it("キャラクター画像をアプリ外へドラッグできない", () => {
    render(<CharacterStage image="/character.webp" name="ミア" />)
    const image = screen.getByRole("img", { name: "ミアのキャラクタービジュアル" })

    expect(image).toHaveAttribute("draggable", "false")
    expect(fireEvent.dragStart(image)).toBe(false)
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

    await act(() => vi.advanceTimersToNextTimerAsync())
    expect(screen.getByText("物語のはじまり")).toBeInTheDocument()
    expect(screen.queryByText("酒場の最後の客")).not.toBeInTheDocument()
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()

    timeline.scrollTop = 500
    fireEvent.scroll(timeline)
    await act(() => vi.advanceTimersToNextTimerAsync())
    expect(screen.getByText("酒場の最後の客")).toBeInTheDocument()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    await act(() => vi.advanceTimersToNextTimerAsync())
    expect(screen.getByText("閉店後の酒場で依頼を持ちかけられる。")).toBeInTheDocument()
    await act(() => vi.advanceTimersToNextTimerAsync())
    expect(screen.getByText("ノア — 店を守る寡黙な護衛。")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("メッセージを入力")).toHaveValue("先に入力しておく")
    expect(screen.getByRole("button", { name: "送信" })).toBeDisabled()

    await act(() => vi.advanceTimersToNextTimerAsync())
    expect(screen.getByText("ここから、物語がはじまる")).toBeInTheDocument()
    await act(() => vi.advanceTimersToNextTimerAsync())
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
    expect(screen.queryByText("物語のはじまり")).not.toBeInTheDocument()
    expect(screen.getByText("頼みがあるの。")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("メッセージを入力")).toBeEnabled()
  })

  it("モーション低減時は導入を即時表示してタイマーを残さない", () => {
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
    expect(vi.getTimerCount()).toBe(0)
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

    await act(() => vi.advanceTimersToNextTimerAsync())
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
      canPlayAudio: false,
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
        canPlayAudio
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
