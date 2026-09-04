export {}

import type { DesktopConversation, DesktopConversationInput, DesktopSettingsInput, DesktopStoreLoadResult } from "../shared/desktop-store"

declare global {
  interface SpeechRecognitionEventLike extends Event {
    resultIndex: number
    results: ArrayLike<{
      isFinal: boolean
      0?: { transcript: string }
    }>
  }

  interface SpeechRecognitionErrorEventLike extends Event {
    error: string
  }

  interface SpeechRecognitionLike {
    lang: string
    continuous: boolean
    interimResults: boolean
    onstart: (() => void) | null
    onend: (() => void) | null
    onresult: ((event: SpeechRecognitionEventLike) => void) | null
    onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
    start: () => void
    stop: () => void
    abort: () => void
  }

  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }

  interface Window {
    mikan?: {
      platform: NodeJS.Platform
      speech?: {
        start: (sessionId: string, sampleRate: number) => Promise<void>
        send: (sessionId: string, audio: ArrayBuffer) => void
        stop: (sessionId: string) => Promise<void>
        onEvent: (callback: (sessionId: string, payload: string) => void) => () => void
      }
      store?: {
        load: () => Promise<DesktopStoreLoadResult>
        saveSettings: (settings: DesktopSettingsInput) => Promise<void>
      }
      conversations?: {
        list: () => Promise<DesktopConversation[]>
        save: (conversation: DesktopConversationInput) => Promise<void>
        delete: (id: string) => Promise<void>
      }
    }
  }
}
