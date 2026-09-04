import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { History, Mic2, Settings2 } from "lucide-react"

import { ChatComposer } from "@/components/chat/chat-composer"
import { CharacterStage } from "@/components/chat/character-stage"
import type { ChatMessageData } from "@/components/chat/chat-message"
import { ChatTimeline } from "@/components/chat/chat-timeline"
import { AppHeader } from "@/components/ui/app-header"
import { IconButton } from "@/components/ui/icon-button"
import type { ConnectionSettings } from "@/components/settings/ai-connection-dialog"
import type { Character } from "@/data/characters"
import { isConnectionReady, parseAssistantResponse, streamCharacterReply } from "@/lib/ai-chat"
import { getDesktopBridge } from "@/lib/platform"
import { createTtsDriver, DEFAULT_TTS_SETTINGS, getKokoroModelSnapshot, subscribeKokoroModel, type TtsSettings } from "@/lib/tts"
import { readScenarioContext } from "@/lib/scenario-context"

type TalkScreenProps = {
  character: Character
  scenarioId?: string
  conversationId: string
  connection: ConnectionSettings
  ttsSettings?: TtsSettings
  readAloud: boolean
  isNewStory?: boolean
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
  },
]

const rainMessages: ChatMessageData[] = [
  { id: "rain-user", role: "user", text: "雨、まだ降ってるかな？", time: "18:17" },
  { id: "rain-character", role: "character", text: "うん。でも傘はちゃんと持ってきたよ。", time: "18:18" },
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

function replaceStreamedReply(messages: ChatMessageData[], replyId: string, reply: string, character: Character, time: string) {
  const prefix = `${replyId}-`
  const firstIndex = messages.findIndex((message) => message.id.startsWith(prefix))
  const remaining = messages.filter((message) => !message.id.startsWith(prefix))
  const events = reply.trim() ? parseAssistantResponse(reply, character) : []
  const next = events.map((event, index) => ({
    id: `${prefix}${index}`,
    role: event.role,
    text: event.text,
    speakerName: event.speakerName,
    time,
  }))
  const insertAt = firstIndex < 0 ? remaining.length : firstIndex
  return [...remaining.slice(0, insertAt), ...next, ...remaining.slice(insertAt)]
}

function getSeededConversations(character: Character): Record<string, ChatMessageData[]> {
  if (!character.opening?.length) return seededConversations

  return {
    today: character.opening.map((event, index) => ({
      id: `opening-${index}`,
      role: event.role,
      text: event.text,
      time: "導入",
      speakerName: event.speakerName,
      image: event.image,
    })),
  } satisfies Record<string, ChatMessageData[]>
}

export function TalkScreen({
  character,
  scenarioId = character.id,
  conversationId,
  connection,
  ttsSettings = DEFAULT_TTS_SETTINGS,
  readAloud,
  isNewStory = false,
  onBack,
  onOpenConnection,
  onOpenVoice,
  onOpenHistory,
}: TalkScreenProps) {
  const [messageStore, setMessageStore] = useState<Record<string, ChatMessageData[]>>(() => getSeededConversations(character))
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [isIntroPlaying, setIsIntroPlaying] = useState(() => Boolean(isNewStory && character.opening?.length))
  const [conversationLoaded, setConversationLoaded] = useState(!getDesktopBridge()?.conversations)
  const generationController = useRef<AbortController | null>(null)
  const timelineEnd = useRef<HTMLDivElement>(null)
  useSyncExternalStore(subscribeKokoroModel, getKokoroModelSnapshot)
  const tts = useMemo(() => createTtsDriver(ttsSettings), [ttsSettings])
  const intro = useMemo(() => isNewStory && character.opening?.length ? readScenarioContext(character) : null, [character, isNewStory])
  const messages = messageStore[conversationId] ?? emptyMessages
  const initialMessageCount = useRef(messages.length)

  useEffect(() => {
    const conversations = getDesktopBridge()?.conversations
    if (!conversations) return
    let active = true
    setConversationLoaded(false)
    void conversations.list().then((items) => {
      if (!active) return
      const stored = items.find((item) => item.id === `${scenarioId}:${conversationId}`)
      const seeded = getSeededConversations(character)[conversationId] ?? []
      setMessageStore((current) => ({ ...current, [conversationId]: stored?.messages ?? seeded }))
    }).catch((error) => console.error("Failed to load conversation", error)).finally(() => {
      if (active) setConversationLoaded(true)
    })
    return () => { active = false }
  }, [character, conversationId, scenarioId])

  useEffect(() => {
    const conversations = getDesktopBridge()?.conversations
    if (!conversations || !conversationLoaded) return
    const timer = window.setTimeout(() => {
      void conversations.save({
        id: `${scenarioId}:${conversationId}`,
        scenarioId,
        updatedAt: new Date().toISOString(),
        messages,
      }).catch((error) => console.error("Failed to save conversation", error))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [conversationId, conversationLoaded, messages, scenarioId])

  useEffect(() => {
    if (messages.length > initialMessageCount.current || isGenerating) {
      timelineEnd.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isGenerating])

  useEffect(() => () => {
    generationController.current?.abort()
    tts.stop()
  }, [tts])

  const speak = (text: string, messageId?: string) => {
    if (!tts.supported) return
    setPlayingMessageId(messageId ?? null)
    tts.speak(text, { onEnd: () => setPlayingMessageId(null) })
  }

  const toggleMessageAudio = (messageId: string) => {
    if (playingMessageId === messageId) {
      tts.stop()
      setPlayingMessageId(null)
      return
    }
    const message = messages.find((item) => item.id === messageId)
    if (message?.role === "character") speak(message.text, messageId)
  }

  const sendMessage = (text: string) => {
    if (!isConnectionReady(connection)) {
      setGenerationError("先に会話に使うAIを設定してください。")
      onOpenConnection()
      return false
    }
    void generateReply(text)
    return true
  }

  const generateReply = async (text: string) => {
    const targetConversationId = conversationId
    const now = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    const userMessage: ChatMessageData = { id: crypto.randomUUID(), role: "user", text, time: now }
    const replyId = crypto.randomUUID()
    const replyTime = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    const promptMessages = [...messages, userMessage]
    setMessageStore((current) => ({
      ...current,
      [targetConversationId]: [
        ...(current[targetConversationId] ?? []),
        userMessage,
      ],
    }))
    setGenerationError(null)
    setIsGenerating(true)
    const controller = new AbortController()
    generationController.current = controller
    const updateReply = (reply: string) => setMessageStore((current) => ({
      ...current,
      [targetConversationId]: replaceStreamedReply(
        current[targetConversationId] ?? [],
        replyId,
        reply,
        character,
        replyTime,
      ),
    }))
    try {
      const replyText = await streamCharacterReply({
        connection,
        character,
        messages: promptMessages,
        signal: controller.signal,
        onText: updateReply,
      })
      updateReply(replyText)
      if (readAloud && tts.supported) {
        const speech = parseAssistantResponse(replyText, character)
          .filter((event) => event.role === "character")
          .map((event) => event.text)
          .join("\n")
        if (speech) speak(speech)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setGenerationError(error instanceof Error ? error.message : "AIから返答を受け取れませんでした。")
      }
    } finally {
      if (generationController.current === controller) {
        generationController.current = null
        setIsGenerating(false)
      }
    }
  }

  const stopGeneration = () => {
    generationController.current?.abort()
    generationController.current = null
    setIsGenerating(false)
  }

  return (
    <main
      className="grid h-screen grid-cols-[clamp(360px,40vw,560px)_minmax(0,1fr)] grid-rows-[96px_minmax(0,1fr)_auto] overflow-hidden bg-background max-[1100px]:grid-rows-[80px_minmax(0,1fr)_auto] max-md:h-dvh max-md:grid-cols-1 max-md:grid-rows-[64px_minmax(0,1fr)_auto]"
      data-testid="talk-screen"
    >
      <AppHeader
        title={character.name}
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
        key={`${character.id}:${conversationId}:${intro ? "intro" : "resume"}`}
        characterName={character.name}
        intro={intro}
        animateIntro={Boolean(intro)}
        sequenceKey={`${character.id}:${conversationId}`}
        onIntroPlaybackChange={setIsIntroPlaying}
        messages={messages}
        isGenerating={isGenerating}
        error={generationError}
        canPlayAudio={tts.supported}
        playingMessageId={playingMessageId}
        onToggleAudio={toggleMessageAudio}
        endRef={timelineEnd}
        className="max-md:z-10 max-md:col-start-1 max-md:row-start-2"
      />

      <div className="col-span-2 max-md:col-span-1 max-md:row-start-3 max-md:z-20">
        <ChatComposer
          onSend={sendMessage}
          isGenerating={isGenerating}
          onStop={stopGeneration}
          disabled={isIntroPlaying || !conversationLoaded}
        />
      </div>
    </main>
  )
}
