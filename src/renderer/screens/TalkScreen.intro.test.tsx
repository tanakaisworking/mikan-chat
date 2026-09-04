import { createRef } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ChatTimeline } from "@/components/chat/chat-timeline"
import type { Character } from "@/data/characters"
import { readScenarioContext } from "@/lib/scenario-context"
import { TalkScreen } from "@/screens/TalkScreen"

describe("TalkScreenの物語導入", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
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
    expect(screen.getByPlaceholderText("物語を読み込み中…")).toBeDisabled()

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
    expect(screen.getByPlaceholderText("物語を読み込み中…")).toBeDisabled()

    await act(() => vi.advanceTimersToNextTimerAsync())
    expect(screen.getByText("ここから、物語がはじまる")).toBeInTheDocument()
    await act(() => vi.advanceTimersToNextTimerAsync())
    expect(screen.getByText("頼")).toBeInTheDocument()

    await act(() => vi.runAllTimersAsync())
    expect(screen.getByText("頼みがあるの。")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("メッセージを入力")).toBeEnabled()
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
