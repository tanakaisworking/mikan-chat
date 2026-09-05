export type LocalTtsReference = {
  voiceId: string
  fileName: string
  mimeType: "audio/wav" | "audio/mpeg" | "audio/flac"
  data: ArrayBuffer
}

export type LocalTtsSynthesisRequest = {
  requestId: string
  endpoint: string
  model: string
  voice: string
  apiKey: string
  text: string
  caption?: string
  seed?: number
  numSteps?: 24 | 32 | 40
  referenceAudio?: LocalTtsReference
}

export type IrodoriRuntimeStatus = {
  supported: boolean
  state: "unsupported" | "missing" | "installing" | "ready" | "starting" | "running" | "error"
  progress: number
  stage: string
  indeterminate?: boolean
  error?: string
}
