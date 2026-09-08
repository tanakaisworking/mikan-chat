export {}

import type { DesktopConversation, DesktopConversationInput, DesktopSettingsInput, DesktopStoreLoadResult } from "../shared/desktop-store"
import type { LocalAIChatRequest, LocalAIModelSpec, LocalAIStatus } from "../shared/local-ai"
import type { IrodoriRuntimeStatus, LocalTtsReference, LocalTtsSynthesisRequest } from "../shared/local-tts"

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
      tts?: {
        synthesizeLocal: (request: LocalTtsSynthesisRequest) => Promise<ArrayBuffer>
        hasReference?: (voiceId: string) => Promise<boolean>
        findReference?: (prefix: string) => Promise<string | null>
        deleteReference?: (voiceId: string) => Promise<void>
        registerReference?: (reference: LocalTtsReference) => Promise<void>
        cancelLocal: (requestId: string) => void
      }
      bgm?: {
        resolveAudioCom: (source: string) => Promise<{ streamUrl: string; title: string | null }>
      }
      irodori?: {
        status: () => Promise<IrodoriRuntimeStatus>
        install: () => Promise<void>
        start: () => Promise<void>
        stop: () => Promise<void>
        delete: () => Promise<void>
        onStatus: (callback: (status: IrodoriRuntimeStatus) => void) => () => void
      }
      localAI?: {
        status: (model: LocalAIModelSpec) => Promise<LocalAIStatus>
        download: (model: LocalAIModelSpec) => Promise<void>
        delete: (model: LocalAIModelSpec) => Promise<void>
        chat: (request: LocalAIChatRequest) => Promise<string>
        cancel: (requestId: string) => void
        onStatus: (callback: (status: LocalAIStatus) => void) => () => void
        onChunk: (callback: (requestId: string, text: string) => void) => () => void
      }
    }
  }
}
