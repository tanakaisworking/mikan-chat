import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { History, Music, Settings2, Volume2, VolumeX } from "lucide-react"

import { ChatComposer } from "@/components/chat/chat-composer"
import { CharacterStage } from "@/components/chat/character-stage"
import type { ChatMessageData } from "@/components/chat/chat-message"
import { ChatTimeline } from "@/components/chat/chat-timeline"
import { PREFERENCE_EVENT, ScenarioBgmPlayer } from "@/components/chat/scenario-bgm-player"
import { getScenarioBgmAudioPath, readBgmPreference } from "@/lib/audio-com"
import { AppHeader } from "@/components/ui/app-header"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ConnectionSettings } from "@/components/settings/ai-connection-dialog"
import type { Character } from "@/data/characters"
import { isConnectionReady, parseAssistantResponse, streamCharacterReply, summarizeConversation } from "@/lib/ai-chat"
import { DEFAULT_BUILTIN_MODEL, localAIModelSpec } from "../../shared/local-ai"
import { getDesktopBridge } from "@/lib/platform"
import { createTtsDriver, DEFAULT_TTS_SETTINGS, getIrodoriRuntimeSnapshot, getKokoroModelSnapshot, subscribeIrodoriRuntime, subscribeKokoroModel, type TtsSettings } from "@/lib/tts"
import { readScenarioContext } from "@/lib/scenario-context"
import { resolveScenarioVoice, type ScenarioVoiceSelection } from "@/lib/scenario-voice"

type TalkScreenProps = {
  character: Character
  scenarioId?: string
  conversationId: string
  connection: ConnectionSettings
  ttsSettings?: TtsSettings
  voiceSelections?: ScenarioVoiceSelection[]
  ttsVoiceReady?: boolean
  readAloud: boolean
  onReadAloudChange?: (value: boolean) => void
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

// eslint-disable-next-line react-refresh/only-export-components
export function getCharacterSpeechChunks(reply: string, character: Character, includeTrailing = false) {
  const events = parseAssistantResponse(reply, character).filter((event) => event.role === "character")
  return events.flatMap((event, eventIndex) => {
      const chunks: Array<{ text: string; speakerName?: string }> = []
      const sentencePattern = /[^。！？!?]+[。！？!?]+[」』”’）)]*/g
      let consumed = 0
      for (const match of event.text.matchAll(sentencePattern)) {
        const text = match[0].trim()
        if (text) chunks.push({ text, speakerName: event.speakerName })
        consumed = (match.index ?? 0) + match[0].length
      }
      const trailing = event.text.slice(consumed).trim()
      if ((includeTrailing || eventIndex < events.length - 1) && trailing) {
        chunks.push({ text: trailing, speakerName: event.speakerName })
      }
      return chunks
    })
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
  voiceSelections,
  ttsVoiceReady = true,
  readAloud,
  onReadAloudChange,
  isNewStory = false,
  onBack,
  onOpenConnection,
  onOpenHistory,
}: TalkScreenProps) {
  const [messageStore, setMessageStore] = useState<Record<string, ChatMessageData[]>>(() => getSeededConversations(character))
  const [isGenerating, setIsGenerating] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryThroughId, setSummaryThroughId] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [loadingMessageId, setLoadingMessageId] = useState<string | null>(null)
  const [bgmOpen, setBgmOpen] = useState(false)
  const bgmPanelRef = useRef<HTMLSpanElement>(null)
  const [bgmEnabled, setBgmEnabled] = useState(() => readBgmPreference(character.id).enabled)

  useEffect(() => {
    setBgmEnabled(readBgmPreference(character.id).enabled)
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ scenarioId: string; preference: { enabled: boolean } }>).detail
      if (detail?.scenarioId !== character.id) return
      setBgmEnabled(detail.preference.enabled)
    }
    window.addEventListener(PREFERENCE_EVENT, update)
    return () => window.removeEventListener(PREFERENCE_EVENT, update)
  }, [character.id])

  useEffect(() => {
    if (!bgmOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (bgmPanelRef.current && !bgmPanelRef.current.contains(event.target as Node)) {
        setBgmOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [bgmOpen])
  const [cachedAudioMap, setCachedAudioMap] = useState<Record<string, boolean>>({})
  const [isIntroPlaying, setIsIntroPlaying] = useState(() => Boolean(isNewStory && character.opening?.length))
  const [conversationLoaded, setConversationLoaded] = useState(!getDesktopBridge()?.conversations)
  const [builtinAvailable, setBuiltinAvailable] = useState(connection.type !== "builtin")
  const generationController = useRef<AbortController | null>(null)
  const summarizeController = useRef<AbortController | null>(null)
  const streamingSpeechCancel = useRef<(() => void) | null>(null)
  const prevReadAloud = useRef(readAloud)
  const timelineEnd = useRef<HTMLDivElement>(null)
  // 読み上げオフ時の生成済み音声再生用。ドライバー外で直接 Audio を扱う。
  const cachedAudioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null)

  const stopCachedAudio = () => {
    cachedAudioRef.current?.audio.pause()
    if (cachedAudioRef.current) URL.revokeObjectURL(cachedAudioRef.current.url)
    cachedAudioRef.current = null
  }
  useSyncExternalStore(subscribeKokoroModel, getKokoroModelSnapshot)
  const irodoriRuntime = useSyncExternalStore(subscribeIrodoriRuntime, getIrodoriRuntimeSnapshot)
  const tts = useMemo(() => createTtsDriver(ttsSettings, irodoriRuntime), [irodoriRuntime, ttsSettings])
  const intro = useMemo(() => character.opening?.length ? readScenarioContext(character) : null, [character])
  const messages = messageStore[conversationId] ?? emptyMessages
  const initialMessageCount = useRef(messages.length)

  useEffect(() => {
    if (connection.type !== "builtin") {
      setBuiltinAvailable(true)
      return
    }
    const localAI = getDesktopBridge()?.localAI
    if (!localAI) {
      setBuiltinAvailable(false)
      return
    }
    let active = true
    const update = (status: { state: string }) => {
      if (active) setBuiltinAvailable(status.state === "ready" || status.state === "loading")
    }
    const model = localAIModelSpec({ source: connection.model || DEFAULT_BUILTIN_MODEL.source, label: "" })
    const unsubscribe = localAI.onStatus((status) => {
      if (status.source === model.source) update(status)
    })
    void localAI.status(model).then(update).catch(() => {
      if (active) setBuiltinAvailable(false)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [connection.model, connection.type])

  useEffect(() => {
    const conversations = getDesktopBridge()?.conversations
    if (!conversations) return
    let active = true
    setConversationLoaded(false)
    void conversations.list().then((items) => {
      if (!active) return
      const stored = items.find((item) => item.id === `${scenarioId}:${conversationId}`)
      const seeded = getSeededConversations(character)[conversationId] ?? []
      setSummary(stored?.summary ?? null)
      setSummaryThroughId(stored?.summaryThroughId ?? null)
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
        summary: summary ?? undefined,
        summaryThroughId: summaryThroughId ?? undefined,
      }).catch((error) => console.error("Failed to save conversation", error))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [conversationId, conversationLoaded, messages, scenarioId, summary, summaryThroughId])

  useEffect(() => {
    if (isGenerating || summarizeController.current) return
    if (messages.length <= 40) return
    const throughIndex = summaryThroughId ? messages.findIndex((message) => message.id === summaryThroughId) : -1
    if (throughIndex >= 0 && messages.length - throughIndex < 10) return
    const cut = messages.length - 20
    if (cut <= Math.max(throughIndex, 0)) return
    const target = messages.slice(0, cut)
    const controller = new AbortController()
    summarizeController.current = controller
    void summarizeConversation({ connection, character, messages: target, signal: controller.signal }).then((result) => {
      if (result?.trim()) {
        setSummary(result.trim())
        setSummaryThroughId(target[target.length - 1]?.id ?? null)
      }
    }).finally(() => {
      if (summarizeController.current === controller) summarizeController.current = null
    })
  }, [character, connection, isGenerating, messages, summaryThroughId])

  useEffect(() => {
    if (messages.length > initialMessageCount.current || isGenerating) {
      timelineEnd.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isGenerating])

  useEffect(() => () => generationController.current?.abort(), [])
  useEffect(() => () => summarizeController.current?.abort(), [])
  useEffect(() => () => {
    streamingSpeechCancel.current?.()
    tts.stop()
    setLoadingMessageId(null)
    cachedAudioRef.current?.audio.pause()
    if (cachedAudioRef.current) URL.revokeObjectURL(cachedAudioRef.current.url)
    cachedAudioRef.current = null
  }, [tts])

  const playMessage = (text: string, messageId?: string, speakerName?: string, onEnd?: () => void) => {
    if (!tts.supported || !ttsVoiceReady) return
    if (messageId) {
      setLoadingMessageId(messageId)
      setPlayingMessageId(null)
    } else {
      setPlayingMessageId(null)
    }
    tts.speak(text, {
      onStart: () => {
        if (!messageId) return
        setLoadingMessageId((current) => (current === messageId ? null : current))
        setPlayingMessageId(messageId)
      },
      onEnd: () => {
        if (messageId) setLoadingMessageId((current) => (current === messageId ? null : current))
        setPlayingMessageId(null)
        onEnd?.()
      },
    }, resolveScenarioVoice(character, speakerName, voiceSelections))
  }

  const speak = (text: string, messageId?: string, speakerName?: string, onEnd?: () => void) => {
    if (!readAloud) return
    playMessage(text, messageId, speakerName, onEnd)
  }

  const toggleMessageAudio = (messageId: string) => {
    streamingSpeechCancel.current?.()
    streamingSpeechCancel.current = null
    if (playingMessageId === messageId || loadingMessageId === messageId) {
      tts.stop()
      stopCachedAudio()
      setPlayingMessageId(null)
      setLoadingMessageId(null)
      return
    }
    const message = messages.find((item) => item.id === messageId)
    if (message?.role !== "character") return
    // モデル利用可能なら新規生成、それ以外は生成済みのみ再生する。
    // ON＋ロード中も生成済みボタンは押せるようにする。
    if (readAloud && tts.supported && ttsVoiceReady) {
      speak(message.text, messageId, message.speakerName)
      return
    }
    // 読み上げオフ時やモデル未ロード時はキャッシュ済み音声のみ、モデルをロードせずに再生する。
    const cached = message.audio === true || cachedAudioMap[messageId] === true
    if (!cached) return
    if (!tts.playCached) return
    setLoadingMessageId(messageId)
    setPlayingMessageId(null)
    void tts.playCached(message.text, resolveScenarioVoice(character, message.speakerName, voiceSelections)).then((blob) => {
      if (!blob || typeof Audio === "undefined") {
        // ファイルが後から消えていた場合はボタンを出さない状態へ戻す。
        setCachedAudioMap((map) => (map[messageId] === false ? map : { ...map, [messageId]: false }))
        setLoadingMessageId((current) => (current === messageId ? null : current))
        setPlayingMessageId((current) => (current === messageId ? null : current))
        return
      }
      stopCachedAudio()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      cachedAudioRef.current = { audio, url }
      const clearPlayback = () => {
        stopCachedAudio()
        setLoadingMessageId((current) => (current === messageId ? null : current))
        setPlayingMessageId((current) => (current === messageId ? null : current))
      }
      audio.onended = clearPlayback
      audio.onerror = clearPlayback
      void audio.play().then(() => {
        setLoadingMessageId((current) => (current === messageId ? null : current))
        setPlayingMessageId(messageId)
      }).catch(clearPlayback)
    }).catch(() => {
      // 要求組み立てに失敗した場合はスピナーで固まらないよう戻す。
      setLoadingMessageId((current) => (current === messageId ? null : current))
      setPlayingMessageId((current) => (current === messageId ? null : current))
    })
  }

  // オン→オフ遷移のときだけ停止する。tts作り直しのたびに止めると、
  // 起動中タスクを中断して声ゲートのリトライと起動停止フラップを起こす。
  useEffect(() => {
    if (prevReadAloud.current && !readAloud) {
      streamingSpeechCancel.current?.()
      streamingSpeechCancel.current = null
      tts.stop()
      stopCachedAudio()
      setPlayingMessageId(null)
      setLoadingMessageId(null)
      if (ttsSettings.provider === "irodori") void window.mikan?.irodori?.stop()
    }
  }, [readAloud, tts, ttsSettings.provider])

  useEffect(() => {
    if (prevReadAloud.current === readAloud) return
    prevReadAloud.current = readAloud
    if (ttsSettings.provider !== "irodori") return
    if (readAloud) void window.mikan?.irodori?.start()
  }, [readAloud, tts, ttsSettings.provider])

  useEffect(() => {
    if (!tts.hasCached) return
    // 読み上げONかつモデル利用可能ならボタンは常に出るので確認不要。
    // ON＋ロード中とOFFは生成済み確認を行う。
    if (readAloud && tts.supported) return
    let cancelled = false
    for (const message of messages) {
      if (message.role !== "character") continue
      if (message.audio === true || cachedAudioMap[message.id] !== undefined) continue
      void tts.hasCached(message.text, resolveScenarioVoice(character, message.speakerName, voiceSelections)).then((hasCached) => {
        if (cancelled) return
        setCachedAudioMap((map) => (map[message.id] === hasCached ? map : { ...map, [message.id]: hasCached }))
      })
    }
    return () => { cancelled = true }
  }, [readAloud, tts, messages, character, voiceSelections, cachedAudioMap])

  const sendMessage = (text: string) => {
    if (!isConnectionReady(connection) || !builtinAvailable) {
      setGenerationError("先に会話に使うAIを設定してください。")
      onOpenConnection()
      return false
    }
    void generateReply(text)
    return true
  }

  const generateReply = async (text: string) => {
    streamingSpeechCancel.current?.()
    streamingSpeechCancel.current = null
    const targetConversationId = conversationId
    const now = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    const userMessage: ChatMessageData = { id: crypto.randomUUID(), role: "user", text, time: now }
    const replyId = crypto.randomUUID()
    const replyTime = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    const promptMessages = [...messages, userMessage]
    const throughIndex = summaryThroughId ? promptMessages.findIndex((message) => message.id === summaryThroughId) : -1
    const contextMessages = summary && throughIndex >= 0 ? promptMessages.slice(throughIndex + 1) : promptMessages
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
    const streamSpeech = readAloud && tts.supported && ttsVoiceReady && (ttsSettings.provider === "irodori" || ttsSettings.provider === "kokoro")
      ? (() => {
          const queue: Array<{ text: string; speakerName?: string }> = []
          let speaking = false
          let queuedCount = 0
          let finished = false
          let cancelled = false
          const playNext = () => {
            if (cancelled || speaking) return
            const next = queue.shift()
            if (!next) {
              if (finished && streamingSpeechCancel.current === cancel) streamingSpeechCancel.current = null
              return
            }
            speaking = true
            speak(next.text, undefined, next.speakerName, () => {
              speaking = false
              playNext()
            })
          }
          const push = (reply: string, includeTrailing = false) => {
            const chunks = getCharacterSpeechChunks(reply, character, includeTrailing)
            if (chunks.length < queuedCount) {
              queue.length = 0
              speaking = false
              queuedCount = 0
              tts.stop()
            }
            if (chunks.length > queuedCount) queue.push(...chunks.slice(queuedCount))
            queuedCount = Math.max(queuedCount, chunks.length)
            if (includeTrailing) finished = true
            playNext()
          }
          const cancel = () => {
            cancelled = true
            queue.length = 0
            tts.stop()
          }
          streamingSpeechCancel.current = cancel
          return { push, cancel }
        })()
      : null
    try {
      const replyText = await streamCharacterReply({
        connection,
        character,
        summary: summary ?? undefined,
        messages: contextMessages,
        signal: controller.signal,
        onText: (reply) => {
          updateReply(reply)
          streamSpeech?.push(reply)
        },
      })
      updateReply(replyText)
      if (streamSpeech) {
        streamSpeech.push(replyText, true)
      } else if (readAloud && tts.supported) {
        const speech = parseAssistantResponse(replyText, character).filter((event) => event.role === "character")
        const speakNext = (index: number) => {
          const event = speech[index]
          if (event) speak(event.text, undefined, event.speakerName, () => speakNext(index + 1))
        }
        speakNext(0)
      }
    } catch (error) {
      streamSpeech?.cancel()
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
    streamingSpeechCancel.current?.()
    streamingSpeechCancel.current = null
  }

  const scenarioBgmAudio = (() => {
    const audioPath = getScenarioBgmAudioPath(character.pack)
    return audioPath ? character.assets?.[audioPath] ?? null : null
  })()

  return (
    <main
      className="grid h-full grid-cols-[clamp(360px,40vw,560px)_minmax(0,1fr)] grid-rows-[96px_minmax(0,1fr)_auto] overflow-hidden bg-background max-[1100px]:grid-rows-[80px_minmax(0,1fr)_auto] max-md:h-full max-md:grid-cols-1 max-md:grid-rows-[64px_minmax(0,1fr)_auto]"
      data-testid="talk-screen"
    >
      <AppHeader
        title={character.name}
        onBack={onBack}
        className="col-span-2 max-md:col-span-1"
        actions={
          <>
            {onReadAloudChange ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={readAloud ? "セリフ読み上げをオフにする" : "セリフ読み上げをオンにする"}
                      aria-pressed={readAloud}
                      className={readAloud ? "shrink-0 text-primary [-webkit-app-region:no-drag]" : "shrink-0 [-webkit-app-region:no-drag]"}
                      onClick={() => onReadAloudChange(!readAloud)}
                    >
                      {readAloud ? <Volume2 /> : <VolumeX />}
                    </Button>
                  }
                />
                <TooltipContent side="bottom" align="end" className="block w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-4 text-left text-foreground shadow-xl [&_svg]:bg-popover [&_svg]:fill-popover">
                  <span className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-soft text-primary-bright">
                      {readAloud ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                    </span>
                    <span className="font-semibold">セリフ読み上げモード</span>
                  </span>
                  <span className="mt-2 block text-[13px] leading-7 text-muted-foreground">オンにすると、キャラクターの返答を自動で読み上げます。</span>
                  <span className="mt-1 block text-[13px] leading-7 text-muted-foreground">オフにすると読み上げモデルをロードしません。生成済みの音声はモデルなしで再生できます。Irodori TTS使用時は約7GBのメモリプレッシャーを削減できます。</span>
                </TooltipContent>
              </Tooltip>
            ) : null}
            <span ref={bgmPanelRef} className="relative">
              <IconButton
                label="BGM"
                aria-expanded={bgmOpen}
                aria-pressed={bgmEnabled}
                className={bgmEnabled ? "text-primary" : undefined}
                onClick={() => setBgmOpen((open) => !open)}
              >
                <Music />
              </IconButton>
              {bgmOpen ? (
                <div
                  role="dialog"
                  aria-label="BGM設定"
                  className="absolute right-0 top-full z-30 mt-2 max-h-[70vh] w-[28rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-popover p-3 text-foreground shadow-xl"
                >
                  <ScenarioBgmPlayer
                    key={character.id}
                    scenarioId={character.id}
                    pack={character.pack}
                    title={character.packTitle ?? character.name}
                    bundledAudio={scenarioBgmAudio}
                    mode="settings"
                  />
                </div>
              ) : null}
            </span>
            <IconButton label="会話履歴" onClick={onOpenHistory}>
              <History />
            </IconButton>
            <IconButton label="AIと音声の設定" onClick={onOpenConnection}>
              <Settings2 />
            </IconButton>
          </>
        }
      />

      <CharacterStage key={character.id} image={character.stageImage ?? character.image} idleVideo={character.idleVideo} name={character.name} className="max-md:col-start-1 max-md:row-start-2" />

      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)] max-md:z-10 max-md:col-start-1 max-md:row-start-2">
        <ScenarioBgmPlayer
          key={character.id}
          scenarioId={character.id}
          pack={character.pack}
          title={character.packTitle ?? character.name}
          bundledAudio={scenarioBgmAudio}
        />
        <ChatTimeline
          key={`${character.id}:${conversationId}:${intro ? "intro" : "resume"}`}
          characterName={character.name}
          intro={intro}
          animateIntro={isNewStory && Boolean(intro)}
          sequenceKey={`${character.id}:${conversationId}`}
          onIntroPlaybackChange={setIsIntroPlaying}
          messages={messages}
          isGenerating={isGenerating}
          error={generationError}
          canPlayAudio={(message) => (readAloud && tts.supported && ttsVoiceReady)
            || message.audio === true || cachedAudioMap[message.id] === true}
          playingMessageId={playingMessageId}
          loadingMessageId={loadingMessageId}
          onToggleAudio={toggleMessageAudio}
          endRef={timelineEnd}
        />
      </div>

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
