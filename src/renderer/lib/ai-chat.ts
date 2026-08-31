import { APICallError, streamText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { z } from "zod"

import type { ConnectionSettings } from "@/components/settings/ai-connection-dialog"
import type { ChatMessageData } from "@/components/chat/chat-message"
import type { Character } from "@/data/characters"

type StreamReplyOptions = {
  connection: ConnectionSettings
  character: Character
  messages: ChatMessageData[]
  signal: AbortSignal
  onText: (text: string) => void
}

export const GOOGLE_AI_STUDIO_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai"
export const GOOGLE_AI_STUDIO_MODEL = "gemini-flash-latest"
export const GOOGLE_AI_STUDIO_FALLBACK_MODEL = "gemini-flash-lite-latest"

export function isGoogleAIStudioEndpoint(endpoint: string) {
  try {
    return new URL(endpoint).hostname === "generativelanguage.googleapis.com"
  } catch {
    return false
  }
}

export async function streamCharacterReply({
  connection,
  character,
  messages,
  signal,
  onText,
}: StreamReplyOptions) {
  assertConnection(connection)
  const provider = createOpenAICompatible({
    name: "mikan-chat",
    baseURL: normalizeBaseUrl(connection.endpoint),
    apiKey: connection.apiKey.trim() || undefined,
  })
  const modelCandidates = getModelCandidates(connection)
  let lastError: unknown
  for (const [index, model] of modelCandidates.entries()) {
    try {
      return await streamModelReply({ provider, model, character, messages, signal, onText })
    } catch (error) {
      lastError = error
      if (signal.aborted || index === modelCandidates.length - 1 || !shouldFallback(error)) throw error
      onText("")
    }
  }
  throw lastError
}

export async function testAIConnection(connection: ConnectionSettings, signal?: AbortSignal) {
  assertConnection(connection)
  const response = await fetch(`${normalizeBaseUrl(connection.endpoint)}/models`, {
    headers: connection.apiKey.trim()
      ? { Authorization: `Bearer ${connection.apiKey.trim()}` }
      : undefined,
    signal,
  })
  if (!response.ok) throw new Error(`接続先からエラーが返りました（${response.status}）`)
  const result = modelListSchema.safeParse(await response.json())
  if (!result.success) throw new Error("接続先のモデル一覧を確認できませんでした。")
  const modelCandidates = getModelCandidates(connection)
  const availableModels = new Set(result.data.data.map((model) => model.id.replace(/^models\//, "")))
  const googleAliases = isGoogleAIStudioEndpoint(connection.endpoint)
    && modelCandidates.every((candidate) => candidate === GOOGLE_AI_STUDIO_MODEL || candidate === GOOGLE_AI_STUDIO_FALLBACK_MODEL)
  if (!googleAliases && !modelCandidates.some((candidate) => availableModels.has(candidate))) {
    throw new Error(`モデル「${modelCandidates.join("」または「")}」が接続先に見つかりません。`)
  }
}

async function streamModelReply({
  provider,
  model,
  character,
  messages,
  signal,
  onText,
}: Omit<StreamReplyOptions, "connection"> & {
  provider: ReturnType<typeof createOpenAICompatible>
  model: string
}) {
  const result = streamText({
    model: provider(model),
    system: buildSystemPrompt(character),
    messages: messages.slice(-30)
      .map((message) => ({
        role: message.role === "user" ? "user" as const : "assistant" as const,
        content: message.role === "narration"
          ? `[narration] ${message.text}`
          : message.role === "character"
            ? `[dialogue] ${message.speakerName ?? character.name}: ${message.text}`
            : message.text,
      })),
    maxOutputTokens: 600,
    abortSignal: signal,
    onError: () => undefined,
  })

  let text = ""
  for await (const part of result.fullStream) {
    if (part.type === "error") throw part.error
    if (part.type === "text-delta") {
      text += part.text
      onText(text)
    }
  }
  if (!text.trim()) throw new Error("AIから返答がありませんでした。")
  return text
}

function getModelCandidates(connection: ConnectionSettings) {
  const model = connection.model.trim()
  return isGoogleAIStudioEndpoint(connection.endpoint) && model === GOOGLE_AI_STUDIO_MODEL
    ? [model, GOOGLE_AI_STUDIO_FALLBACK_MODEL]
    : [model]
}

function shouldFallback(error: unknown) {
  return !APICallError.isInstance(error) || (error.statusCode !== 401 && error.statusCode !== 403)
}

export function isConnectionReady(connection: ConnectionSettings) {
  return getConnectionError(connection) === null
}

export function getEndpointError(connection: Pick<ConnectionSettings, "endpoint" | "type">) {
  if (!connection.endpoint.trim()) return "接続先URLを入力してください。"
  let url: URL
  try {
    url = new URL(connection.endpoint)
  } catch {
    return "接続先URLの形式が正しくありません。"
  }
  if (connection.type === "online" && url.protocol !== "https:") {
    return "オンラインAIの接続先にはhttpsを指定してください。"
  }
  if (connection.type === "local" && url.protocol === "http:" && !isLoopback(url.hostname)) {
    return "暗号化されていないローカル接続は、このPC内のアドレスだけ指定できます。"
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "接続先URLはhttpまたはhttpsで入力してください。"
  }
  return null
}

export function getConnectionError(connection: ConnectionSettings) {
  const endpointError = getEndpointError(connection)
  if (endpointError) return endpointError
  if (!connection.model.trim()) return "モデル名を入力してください。"
  if (connection.type === "online" && !connection.apiKey.trim()) return "APIキーを入力してください。"
  return null
}

export function parseAssistantResponse(text: string, character: Character) {
  const names = readCharacterNames(character)
  const events: Array<{ role: "narration" | "character"; text: string; speakerName?: string }> = []
  let current: (typeof events)[number] | null = null

  const flush = () => {
    if (current?.text.trim()) events.push({ ...current, text: current.text.trim() })
  }
  for (const line of text.split(/\r?\n/)) {
    const marker = line.match(/^\[(narration|dialogue:([a-z][a-z0-9-]{0,63}))\]\s*(.*)$/)
    if (marker) {
      flush()
      current = marker[1] === "narration"
        ? { role: "narration", text: marker[3] }
        : { role: "character", text: marker[3], speakerName: names.get(marker[2]) ?? marker[2] }
    } else if (current) {
      current.text += `${current.text ? "\n" : ""}${line}`
    }
  }
  flush()
  return events.length > 0 ? events : [{ role: "character" as const, text: text.trim(), speakerName: character.name }]
}

function assertConnection(connection: ConnectionSettings) {
  const error = getConnectionError(connection)
  if (error) throw new Error(error)
}

function normalizeBaseUrl(endpoint: string) {
  return endpoint.trim().replace(/\/+$/, "")
}

function buildSystemPrompt(character: Character) {
  const pack = character.pack
  const plot = isRecord(pack?.plot) ? pack.plot : null
  const characters = Array.isArray(plot?.characters)
    ? plot.characters.flatMap((item) => {
      if (!isRecord(item) || typeof item.name !== "string" || typeof item.profile !== "string") return []
      return [`- ${item.name}: ${item.profile}`]
    })
    : [`- ${character.name}: ${character.description}`]
  const premise = typeof plot?.premise === "string" ? plot.premise : character.description
  const instructions = typeof plot?.instructions === "string" ? plot.instructions : ""
  const style = isRecord(plot?.style) ? JSON.stringify(plot.style) : ""

  return [
    "あなたはmikan chatのシナリオ進行役です。ユーザーと自然な日本語で会話してください。",
    "登場人物の性格と関係性を守り、ユーザーの発言や行動を勝手に決めないでください。",
    "必要に応じて、台詞だけでなく短い情景描写や仕草も入れてください。",
    "複数の登場人物がいる場合は、話者名が分かる形で必要な人物だけを登場させてください。",
    "返答は各イベントを別の行にし、情景描写は [narration] 本文、台詞は [dialogue:人物ID] 本文 の形式で出力してください。これ以外の形式は使わないでください。",
    `シナリオ: ${premise}`,
    `登場人物:\n${characters.join("\n")}`,
    instructions ? `追加指示: ${instructions}` : "",
    style ? `文体設定: ${style}` : "",
  ].filter(Boolean).join("\n\n")
}

function readCharacterNames(character: Character) {
  const plot = isRecord(character.pack?.plot) ? character.pack.plot : null
  const pairs = Array.isArray(plot?.characters)
    ? plot.characters.flatMap((item) => isRecord(item) && typeof item.id === "string" && typeof item.name === "string"
      ? [[item.id, item.name] as const]
      : [])
    : []
  return new Map(pairs)
}

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1"
}

const modelListSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
