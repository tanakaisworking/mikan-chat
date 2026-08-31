import { useEffect, useRef, useState } from "react"
import { History, Mic2, Settings2 } from "lucide-react"

import { ChatComposer } from "@/components/chat/chat-composer"
import { CharacterStage } from "@/components/chat/character-stage"
import type { ChatMessageData } from "@/components/chat/chat-message"
import { ChatTimeline } from "@/components/chat/chat-timeline"
import { AppHeader } from "@/components/ui/app-header"
import { IconButton } from "@/components/ui/icon-button"
import type { Character } from "@/data/characters"

type TalkScreenProps = {
  character: Character
  conversationId: string
  onBack: () => void
  onOpenConnection: () => void
  onOpenVoice: () => void
  onOpenHistory: () => void
}

const initialMessages: ChatMessageData[] = [
  {
    id: "welcome",
    role: "character",
    text: "おかえり。今日は少し遅かったね。",
    time: "20:42",
  },
  {
    id: "reply",
    role: "user",
    text: "ただいま。ちょっと話してもいい？",
    time: "20:43",
  },
  {
    id: "listen",
    role: "character",
    text: "もちろん。ゆっくり聞かせて。",
    time: "20:43",
    audio: true,
  },
]

const rainMessages: ChatMessageData[] = [
  { id: "rain-user", role: "user", text: "雨、まだ降ってるかな？", time: "18:17" },
  { id: "rain-character", role: "character", text: "うん。でも傘はちゃんと持ってきたよ。", time: "18:18", audio: true },
]

const seededConversations: Record<string, ChatMessageData[]> = {
  today: initialMessages,
  rain: rainMessages,
  weekend: [
    { id: "weekend-character", role: "character", text: "今度、一緒に見に行こうよ。", time: "15:32" },
  ],
  first: [
    { id: "first-character", role: "character", text: "会えてうれしい。これからよろしくね。", time: "21:05" },
  ],
}
const emptyMessages: ChatMessageData[] = []

function getSeededConversations(character: Character) {
  if (!character.opening?.length) return seededConversations

  return {
    today: character.opening.map((event, index) => ({
      id: `opening-${index}`,
      role: event.role,
      text: event.text,
      time: "導入",
      audio: event.role === "character",
      speakerName: event.speakerName,
      image: event.image,
    })),
  } satisfies Record<string, ChatMessageData[]>
}

export function TalkScreen({
  character,
  conversationId,
  onBack,
  onOpenConnection,
  onOpenVoice,
  onOpenHistory,
}: TalkScreenProps) {
  const [messageStore, setMessageStore] = useState<Record<string, ChatMessageData[]>>(() => getSeededConversations(character))
  const [isGenerating, setIsGenerating] = useState(false)
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const generationTimer = useRef<number | null>(null)
  const timelineEnd = useRef<HTMLDivElement>(null)
  const messages = messageStore[conversationId] ?? emptyMessages

  useEffect(() => {
    timelineEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isGenerating])

  useEffect(() => () => {
    if (generationTimer.current) window.clearTimeout(generationTimer.current)
  }, [])

  const sendMessage = (text: string) => {
    const targetConversationId = conversationId
    const now = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    setMessageStore((current) => ({
      ...current,
      [targetConversationId]: [
        ...(current[targetConversationId] ?? []),
        { id: crypto.randomUUID(), role: "user", text, time: now },
      ],
    }))
    setIsGenerating(true)
    generationTimer.current = window.setTimeout(() => {
      setMessageStore((current) => ({
        ...current,
        [targetConversationId]: [
          ...(current[targetConversationId] ?? []),
          {
            id: crypto.randomUUID(),
            role: "character",
            text: "うん。急がなくて大丈夫。今日はどんなことがあったの？",
            time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
            audio: true,
          },
        ],
      }))
      setIsGenerating(false)
      generationTimer.current = null
    }, 900)
  }

  const stopGeneration = () => {
    if (generationTimer.current) window.clearTimeout(generationTimer.current)
    generationTimer.current = null
    setIsGenerating(false)
  }

  return (
    <main
      className="grid h-screen grid-cols-[clamp(360px,40vw,560px)_minmax(0,1fr)] grid-rows-[96px_minmax(0,1fr)_136px] overflow-hidden bg-background max-[1100px]:grid-rows-[80px_minmax(0,1fr)_112px] max-md:h-dvh max-md:grid-cols-1 max-md:grid-rows-[64px_minmax(0,1fr)_80px]"
      data-testid="talk-screen"
    >
      <AppHeader
        title={character.name}
        status="このPCで処理"
        onBack={onBack}
        className="col-span-2 max-md:col-span-1"
        actions={
          <>
            <IconButton label="会話履歴" onClick={onOpenHistory}>
              <History />
            </IconButton>
            <IconButton label="音声設定" onClick={onOpenVoice}>
              <Mic2 />
            </IconButton>
            <IconButton label="AI接続設定" onClick={onOpenConnection}>
              <Settings2 />
            </IconButton>
          </>
        }
      />

      <CharacterStage image={character.stageImage ?? character.image} name={character.name} className="max-md:col-start-1 max-md:row-start-2" />

      <ChatTimeline
        characterName={character.name}
        messages={messages}
        isGenerating={isGenerating}
        playingMessageId={playingMessageId}
        onToggleAudio={(messageId) => setPlayingMessageId((current) => (current === messageId ? null : messageId))}
        endRef={timelineEnd}
        className="max-md:z-10 max-md:col-start-1 max-md:row-start-2"
      />

      <div className="col-span-2 max-md:col-span-1 max-md:row-start-3 max-md:z-20">
        <ChatComposer
          onSend={sendMessage}
          isGenerating={isGenerating}
          onStop={stopGeneration}
          onOpenVoice={onOpenVoice}
        />
      </div>
    </main>
  )
}
