import { useEffect, useRef, useState, type RefObject } from "react"

import { ChatMessage, type ChatMessageData } from "@/components/chat/chat-message"
import { SceneIntroCard } from "@/components/chat/scene-intro-card"
import type { ScenarioContext } from "@/lib/scenario-context"
import { cn } from "@/lib/utils"

export function ChatTimeline({
  characterName,
  intro,
  animateIntro = false,
  sequenceKey,
  onIntroPlaybackChange,
  messages,
  isGenerating,
  error,
  canPlayAudio,
  playingMessageId,
  onToggleAudio,
  endRef,
  className,
}: {
  characterName: string
  intro?: ScenarioContext | null
  animateIntro?: boolean
  sequenceKey: string
  onIntroPlaybackChange?: (playing: boolean) => void
  messages: ChatMessageData[]
  isGenerating: boolean
  error?: string | null
  canPlayAudio: boolean
  playingMessageId: string | null
  onToggleAudio: (messageId: string) => void
  endRef: RefObject<HTMLDivElement | null>
  className?: string
}) {
  const playback = useStoryIntroPlayback({ intro, messages, animate: animateIntro, sequenceKey })
  const timeline = useRef<HTMLElement>(null)
  const shouldFollowEnd = useRef(true)
  const displayedMessageCount = playback.messages.length
  const lastMessageTextLength = playback.messages.at(-1)?.text.length ?? 0

  useEffect(() => {
    if (!playback.animated || !shouldFollowEnd.current) return
    endRef.current?.scrollIntoView({ behavior: playback.playing ? "auto" : "smooth" })
  }, [displayedMessageCount, endRef, lastMessageTextLength, playback.animated, playback.playing, playback.showStoryStart, playback.visibleIntroSections])

  useEffect(() => {
    onIntroPlaybackChange?.(playback.playing)
  }, [onIntroPlaybackChange, playback.playing])

  return (
    <>
      <section
        ref={timeline}
        className={cn(
          "min-h-0 overflow-y-auto px-[7%] py-6 max-md:bg-black/55 max-md:px-3 max-md:py-4",
          className,
        )}
        aria-label={`${characterName}との会話`}
        aria-busy={playback.playing}
        aria-live={playback.playing ? "off" : "polite"}
        onScroll={() => {
          const element = timeline.current
          if (!element) return
          shouldFollowEnd.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80
        }}
      >
        <div
          inert={playback.playing || undefined}
          aria-hidden={playback.playing || undefined}
          className={cn("mx-auto flex min-h-full max-w-3xl flex-col gap-5 max-md:gap-3", intro ? "justify-start" : "justify-center max-md:justify-end")}
        >
          {intro ? <SceneIntroCard context={intro} visibleSections={playback.visibleIntroSections} /> : null}
          {playback.showStoryStart ? (
            <div className="animate-in my-1 flex items-center justify-center gap-5 text-sm text-muted-foreground fade-in duration-300 max-md:text-xs max-md:text-white max-md:drop-shadow-md">
              <span className="h-px w-14 bg-border" aria-hidden="true" />
              {intro ? "ここから、物語がはじまる" : "今日 20:42"}
              <span className="h-px w-14 bg-border" aria-hidden="true" />
            </div>
          ) : null}
          {playback.messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isPlaying={playingMessageId === message.id}
              canPlayAudio={canPlayAudio}
              onToggleAudio={() => onToggleAudio(message.id)}
            />
          ))}
          {isGenerating ? (
            <p className="ml-2 text-base text-muted-foreground max-md:text-sm max-md:text-white max-md:drop-shadow-md">{characterName}が考えています…</p>
          ) : null}
          {error ? <p className="mx-auto rounded-md bg-danger/8 px-4 py-2 text-sm text-danger" role="alert">{error}</p> : null}
          <div ref={endRef} />
        </div>
      </section>
      {playback.announceCompletion ? (
        <p className="sr-only" role="status" aria-atomic="true">
          {playback.completionAnnouncement}
        </p>
      ) : null}
    </>
  )
}

const INTRO_SECTIONS = 4
const INTRO_LEAD_IN_MS = 180
const INTRO_SECTION_PAUSE_MS = 360
const STORY_START_PAUSE_MS = 350
const MESSAGE_PAUSE_MS = 400
const STREAM_CHARACTER_MS = 32

function useStoryIntroPlayback({
  intro,
  messages,
  animate,
  sequenceKey,
}: {
  intro?: ScenarioContext | null
  messages: ChatMessageData[]
  animate: boolean
  sequenceKey: string
}) {
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  const shouldAnimate = Boolean(animate && intro && !prefersReducedMotion)
  const initialMessages = useRef({ sequenceKey, messages })
  if (initialMessages.current.sequenceKey !== sequenceKey) initialMessages.current = { sequenceKey, messages }

  const [visibleIntroSections, setVisibleIntroSections] = useState(shouldAnimate ? 0 : INTRO_SECTIONS)
  const [showStoryStart, setShowStoryStart] = useState(!shouldAnimate)
  const [animatedMessages, setAnimatedMessages] = useState<ChatMessageData[]>([])
  const [complete, setComplete] = useState(!shouldAnimate)

  useEffect(() => {
    if (!shouldAnimate || !intro) {
      setVisibleIntroSections(INTRO_SECTIONS)
      setShowStoryStart(true)
      setComplete(true)
      return
    }

    let cancelled = false
    const pendingTimers = new Map<number, (completed: boolean) => void>()
    const delay = (duration: number) => new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        pendingTimers.delete(timer)
        resolve(true)
      }, duration)
      pendingTimers.set(timer, resolve)
    })
    const openingMessages = initialMessages.current.messages
    const play = async () => {
      setVisibleIntroSections(0)
      setShowStoryStart(false)
      setAnimatedMessages([])
      setComplete(false)
      if (!await delay(INTRO_LEAD_IN_MS)) return

      for (let index = 0; index < INTRO_SECTIONS; index += 1) {
        if (cancelled) return
        setVisibleIntroSections(index + 1)
        if (!await delay(INTRO_SECTION_PAUSE_MS)) return
      }

      if (cancelled) return
      setShowStoryStart(true)
      if (!await delay(STORY_START_PAUSE_MS)) return

      const revealed: ChatMessageData[] = []
      for (const message of openingMessages) {
        if (cancelled) return
        let streamedText = ""
        revealed.push({ ...message, text: streamedText })
        setAnimatedMessages([...revealed])
        for (const character of Array.from(message.text)) {
          if (cancelled) return
          streamedText += character
          revealed[revealed.length - 1] = { ...message, text: streamedText }
          setAnimatedMessages([...revealed])
          if (!await delay(STREAM_CHARACTER_MS)) return
        }
        if (!await delay(MESSAGE_PAUSE_MS)) return
      }

      if (!cancelled) setComplete(true)
    }

    void play()
    return () => {
      cancelled = true
      for (const [timer, resolve] of pendingTimers) {
        window.clearTimeout(timer)
        resolve(false)
      }
      pendingTimers.clear()
    }
  }, [intro, sequenceKey, shouldAnimate])

  const openingCount = initialMessages.current.messages.length
  const completionAnnouncement = [
    intro?.title,
    intro?.player.name,
    intro?.summary,
    ...initialMessages.current.messages.map((message) => message.text),
  ].filter(Boolean).join("。")
  return {
    visibleIntroSections,
    showStoryStart,
    animated: shouldAnimate,
    playing: shouldAnimate && !complete,
    announceCompletion: shouldAnimate && complete,
    completionAnnouncement,
    messages: complete ? messages : [...animatedMessages, ...messages.slice(openingCount)],
  }
}
