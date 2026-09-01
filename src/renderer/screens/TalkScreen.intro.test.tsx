import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { Character } from "@/data/characters"
import { TalkScreen } from "@/screens/TalkScreen"

describe("TalkScreenの物語導入", () => {
  it("新しい物語では役・状況・登場人物を冒頭に表示する", () => {
    vi.mocked(Element.prototype.scrollIntoView).mockClear()
    const character: Character = {
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

    expect(screen.getByText("物語のはじまり")).toBeInTheDocument()
    expect(screen.getByText("酒場の最後の客")).toBeInTheDocument()
    expect(screen.getByText("閉店後の酒場で依頼を持ちかけられる。")).toBeInTheDocument()
    expect(screen.getByText("ノア — 店を守る寡黙な護衛。")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("メッセージを入力")).toBeInTheDocument()
    expect(screen.getByText("ここから、物語がはじまる")).toBeInTheDocument()
    expect(screen.queryByText("今日 20:42")).not.toBeInTheDocument()
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()

    rerender(
      <TalkScreen
        character={character}
        conversationId="rain"
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
  })
})
