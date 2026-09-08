import { z } from "zod"

import type { LocalTtsReference, LocalTtsSynthesisRequest } from "../shared/local-tts"

export const MAX_AUDIO_BYTES = 50 * 1024 * 1024

export const localTtsReferenceSchema = z.object({
  voiceId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(200),
  fileName: z.string().regex(/^[A-Za-z0-9_.-]+$/).max(200),
  mimeType: z.enum(["audio/wav", "audio/mpeg", "audio/flac"]),
  data: z.instanceof(ArrayBuffer).refine((data) => data.byteLength > 0 && data.byteLength <= 16 * 1024 * 1024),
})

export const localTtsSynthesisRequestSchema = z.object({
  requestId: z.string().uuid(),
  endpoint: z.string().url().max(500).refine(isLoopbackHttpUrl, "Irodori TTSはこのPCのローカルサーバーへだけ接続できます。"),
  model: z.string().trim().min(1).max(200),
  voice: z.string().trim().min(1).max(200),
  apiKey: z.string().trim().max(500),
  text: z.string().trim().min(1).max(4_096),
  caption: z.string().trim().min(1).max(1_000).optional(),
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
  numSteps: z.union([z.literal(24), z.literal(32), z.literal(40)]).optional(),
  referenceAudio: localTtsReferenceSchema.optional(),
})

export const seedCachedAudioSchema = z.object({
  request: localTtsSynthesisRequestSchema,
  audio: z.instanceof(ArrayBuffer).refine((data) => data.byteLength > 0 && data.byteLength <= MAX_AUDIO_BYTES),
})

export async function synthesizeLocalTts(request: LocalTtsSynthesisRequest, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  const input = localTtsSynthesisRequestSchema.parse(request)
  const endpoint = input.endpoint.replace(/\/+$/, "")
  if (input.referenceAudio) await registerLocalTtsReference(endpoint, input.apiKey, input.referenceAudio, fetcher, signal)
  const response = await fetcher(`${endpoint}/audio/speech`, {
    method: "POST",
    redirect: "error",
    headers: {
      ...(input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      input: input.text,
      voice: input.referenceAudio?.voiceId ?? input.voice,
      response_format: "wav",
      ...((input.caption || input.seed !== undefined || input.numSteps !== undefined) ? {
        irodori: {
          ...(input.caption ? { caption: input.caption } : {}),
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
          ...(input.numSteps !== undefined ? { num_steps: input.numSteps } : {}),
        },
      } : {}),
    }),
    signal,
  })
  if (!response.ok) throw new Error(`Irodori TTSからエラーが返りました（${response.status}）`)
  const declaredSize = Number(response.headers.get("content-length") ?? 0)
  if (declaredSize > MAX_AUDIO_BYTES) throw new Error("Irodori TTSの音声データが大きすぎます。")
  if (!response.body) throw new Error("Irodori TTSから音声データを受信できませんでした。")
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > MAX_AUDIO_BYTES) {
      await reader.cancel()
      throw new Error("Irodori TTSの音声データが大きすぎます。")
    }
    chunks.push(value)
  }
  const audio = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    audio.set(chunk, offset)
    offset += chunk.byteLength
  }
  return audio.buffer
}

export async function registerLocalTtsReference(
  endpoint: string,
  apiKey: string,
  reference: LocalTtsReference,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
  replace = false,
) {
  const input = localTtsReferenceSchema.parse(reference)
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined
  const voiceUrl = `${endpoint.replace(/\/+$/, "")}/audio/voices/${encodeURIComponent(input.voiceId)}`
  const existing = await fetcher(voiceUrl, { headers, redirect: "error", signal })
  if (existing.ok && !replace) return
  if (!existing.ok && existing.status !== 404) throw new Error(`Irodori TTSの参照音声を確認できませんでした（${existing.status}）`)
  const form = new FormData()
  if (!existing.ok) form.append("voice_id", input.voiceId)
  form.append("file", new Blob([input.data], { type: input.mimeType }), input.fileName)
  const uploaded = await fetcher(existing.ok ? voiceUrl : `${endpoint.replace(/\/+$/, "")}/audio/voices`, { method: existing.ok ? "PUT" : "POST", headers, body: form, redirect: "error", signal })
  if (!uploaded.ok && uploaded.status !== 409) throw new Error(`Irodori TTSへ参照音声を登録できませんでした（${uploaded.status}）`)
}

function isLoopbackHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]")
  } catch {
    return false
  }
}
