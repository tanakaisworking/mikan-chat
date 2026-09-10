import { APICallError, generateText, streamText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { z } from "zod"

import type { ConnectionSettings } from "@/components/settings/ai-connection-dialog"
import type { ChatMessageData } from "@/components/chat/chat-message"
import type { Character } from "@/data/characters"
import { getDesktopBridge } from "@/lib/platform"
import { DEFAULT_BUILTIN_MODEL, localAIModelSpec } from "../../shared/local-ai"

type StreamReplyOptions = {
  connection: ConnectionSettings
  character: Character
  summary?: string
  messages: ChatMessageData[]
  signal: AbortSignal
  onText: (text: string) => void
}

export const GOOGLE_AI_STUDIO_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai"
export const GOOGLE_AI_STUDIO_MODEL = "gemini-flash-latest"
export const GOOGLE_AI_STUDIO_FALLBACK_MODEL = "gemini-flash-lite-latest"
export const GOOGLE_AI_STUDIO_STABLE_FALLBACK_MODEL = "gemini-3.5-flash-lite"
export const GOOGLE_AI_STUDIO_GEMMA_FALLBACK_MODEL = "gemma-4-31b-it"
export const GOOGLE_AI_STUDIO_RATE_LIMIT_URL = "https://aistudio.google.com/rate-limit"

/** 品質優先の順番。上から試し、上限・障害時は下へ切り替える。 */
export const GOOGLE_AI_STUDIO_CHAIN = [
  GOOGLE_AI_STUDIO_MODEL,
  GOOGLE_AI_STUDIO_FALLBACK_MODEL,
  GOOGLE_AI_STUDIO_STABLE_FALLBACK_MODEL,
  GOOGLE_AI_STUDIO_GEMMA_FALLBACK_MODEL,
] as const

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
  summary,
  messages,
  signal,
  onText,
}: StreamReplyOptions) {
  assertConnection(connection)
  if (connection.type === "builtin") {
    return streamBuiltinReply({ connection, character, summary, messages, signal, onText })
  }
  const provider = createOpenAICompatible({
    name: "mikan-chat",
    baseURL: normalizeBaseUrl(connection.endpoint),
    apiKey: normalizeApiKey(connection.apiKey) || undefined,
  })
  const modelCandidates = getModelCandidates(connection)
  let lastError: unknown
  for (const [index, model] of modelCandidates.entries()) {
    try {
      return await streamModelReply({ provider, model, character, summary, messages, signal, onText })
    } catch (error) {
      lastError = error
      if (signal.aborted || index === modelCandidates.length - 1 || !shouldFallback(error)) throw withQuotaGuidance(error)
      onText("")
    }
  }
  throw withQuotaGuidance(lastError)
}

export async function testAIConnection(connection: ConnectionSettings, signal?: AbortSignal) {
  assertConnection(connection)
  if (connection.type === "builtin") {
    const status = await getDesktopBridge()?.localAI?.status(builtinSpec(connection.model))
    if (status?.state !== "ready") throw new Error("内蔵AIのモデルを先にダウンロードしてください。")
    return
  }
  const availableModelIds = await listAIModels(connection, signal)
  const modelCandidates = getModelCandidates(connection)
  const availableModels = new Set(availableModelIds)
  const googleAliases = isGoogleAIStudioEndpoint(connection.endpoint)
    && modelCandidates.slice(0, 2).every((candidate) => candidate === GOOGLE_AI_STUDIO_MODEL || candidate === GOOGLE_AI_STUDIO_FALLBACK_MODEL)
  if (!googleAliases && !modelCandidates.some((candidate) => availableModels.has(candidate))) {
    throw new Error(`モデル「${modelCandidates.join("」または「")}」が接続先に見つかりません。`)
  }
}

export async function listAIModels(connection: Pick<ConnectionSettings, "type" | "endpoint" | "apiKey">, signal?: AbortSignal) {
  if (connection.type === "builtin") {
    const status = await getDesktopBridge()?.localAI?.status(builtinSpec(DEFAULT_BUILTIN_MODEL.source))
    return status?.state === "ready" ? [status.modelId] : []
  }
  const endpointError = getEndpointError(connection)
  if (endpointError) throw new Error(endpointError)
  const apiKey = normalizeApiKey(connection.apiKey)
  const response = await fetch(`${normalizeBaseUrl(connection.endpoint)}/models`, {
    headers: apiKey
      ? { Authorization: `Bearer ${apiKey}` }
      : undefined,
    signal,
  })
  if (!response.ok) throw new Error(`接続先からエラーが返りました（${response.status}）`)
  const result = modelListSchema.safeParse(await response.json())
  if (!result.success) throw new Error("接続先のモデル一覧を確認できませんでした。")
  return result.data.data.map((model) => model.id.replace(/^models\//, ""))
}

async function streamModelReply({
  provider,
  model,
  character,
  summary,
  messages,
  signal,
  onText,
}: Omit<StreamReplyOptions, "connection"> & {
  provider: ReturnType<typeof createOpenAICompatible>
  model: string
}) {
  const result = streamText({
    model: provider(model),
    system: buildSystemPrompt(character, summary),
    messages: formatConversationMessages(character, messages),
    maxOutputTokens: 600,
    maxRetries: 0,
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
  if (!isGoogleAIStudioEndpoint(connection.endpoint)) return [model]
  const index = (GOOGLE_AI_STUDIO_CHAIN as readonly string[]).indexOf(model)
  return index < 0 ? [model] : GOOGLE_AI_STUDIO_CHAIN.slice(index)
}

function shouldFallback(error: unknown) {
  return !APICallError.isInstance(error) || (error.statusCode !== 401 && error.statusCode !== 403)
}

export function withQuotaGuidance(error: unknown) {
  if (APICallError.isInstance(error) && error.statusCode === 429) {
    return new Error(`AIの利用上限に達しました。全モデルで混み合っているため、しばらく待ってからもう一度お試しください。利用状況: ${GOOGLE_AI_STUDIO_RATE_LIMIT_URL}`)
  }
  return error
}

export function isConnectionReady(connection: ConnectionSettings) {
  return getConnectionError(connection) === null
}

export function getEndpointError(connection: Pick<ConnectionSettings, "endpoint" | "type">) {
  if (connection.type === "builtin") return null
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
  if (connection.type === "builtin") return getDesktopBridge()?.localAI ? null : "内蔵AIはデスクトップアプリで利用できます。"
  const endpointError = getEndpointError(connection)
  if (endpointError) return endpointError
  if (!connection.model.trim()) return "モデル名を入力してください。"
  const apiKey = normalizeApiKey(connection.apiKey)
  if (connection.type === "online" && !apiKey) return "APIキーを入力してください。"
  if (connection.type === "online" && !/^[\x21-\x7e]+$/.test(apiKey)) {
    return "APIキーに使用できない文字が含まれています。Google AI Studioからキーだけをコピーしてください。"
  }
  return null
}

export function parseAssistantResponse(text: string, character: Character) {
  const names = new Set([character.name, ...readCharacterNames(character).values()])
  const events: Array<{ role: "narration" | "character"; text: string; speakerName?: string }> = []
  let current: (typeof events)[number] | null = null

  const flush = () => {
    if (current?.text.trim()) events.push({ ...current, text: current.text.trim() })
  }
  for (const line of text.split(/\r?\n/)) {
    const narration = line.match(/^>[：:]\s*(.*)$/)
    const dialogue = line.match(/^([^:：\r\n]+?)\s*[：:]\s*(.*)$/)
    const speakerName = dialogue?.[1].trim()
    if (narration) {
      flush()
      current = { role: "narration", text: narration[1] }
    } else if (dialogue && speakerName && names.has(speakerName)) {
      flush()
      current = { role: "character", text: dialogue[2], speakerName }
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

async function streamBuiltinReply({ connection, character, summary, messages, signal, onText }: StreamReplyOptions) {
  const bridge = getDesktopBridge()?.localAI
  if (!bridge) throw new Error("内蔵AIはデスクトップアプリで利用できます。")
  const requestId = crypto.randomUUID()
  const unsubscribe = bridge.onChunk((id, text) => {
    if (id === requestId) onText(text)
  })
  const cancel = () => bridge.cancel(requestId)
  signal.addEventListener("abort", cancel, { once: true })
  try {
    return await bridge.chat({
      requestId,
      modelSource: builtinSpec(connection.model).source,
      systemPrompt: buildSystemPrompt(character, summary),
      messages: formatConversationMessages(character, messages),
    })
  } finally {
    signal.removeEventListener("abort", cancel)
    unsubscribe()
  }
}

function formatConversationMessages(character: Character, messages: ChatMessageData[]) {
  return messages.slice(-30).map((message) => ({
    role: message.role === "user" ? "user" as const : "assistant" as const,
    content: message.role === "narration"
      ? `>: ${message.text}`
      : message.role === "character"
        ? `${message.speakerName ?? character.name}: ${message.text}`
        : message.text,
  }))
}

export async function streamInstructionReply({
  connection,
  systemPrompt,
  userPrompt,
  maxOutputTokens = 4000,
  signal,
  onText,
}: {
  connection: ConnectionSettings
  systemPrompt: string
  userPrompt: string
  maxOutputTokens?: number
  signal: AbortSignal
  onText: (text: string) => void
}) {
  assertConnection(connection)
  if (connection.type === "builtin") {
    const bridge = getDesktopBridge()?.localAI
    if (!bridge) throw new Error("内蔵AIはデスクトップアプリで利用できます。")
    const requestId = crypto.randomUUID()
    const unsubscribe = bridge.onChunk((id, text) => {
      if (id === requestId) onText(text)
    })
    const cancel = () => bridge.cancel(requestId)
    signal.addEventListener("abort", cancel, { once: true })
    try {
      const text = await bridge.chat({
        requestId,
        modelSource: builtinSpec(connection.model).source,
        systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      })
      onText(text)
      return text
    } finally {
      signal.removeEventListener("abort", cancel)
      unsubscribe()
    }
  }
  const provider = createOpenAICompatible({
    name: "mikan-chat",
    baseURL: normalizeBaseUrl(connection.endpoint),
    apiKey: normalizeApiKey(connection.apiKey) || undefined,
  })
  const result = streamText({
    model: provider(getModelCandidates(connection)[0]),
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens,
    maxRetries: 0,
    abortSignal: signal,
  })
  let text = ""
  try {
    for await (const delta of result.textStream) {
      text += delta
      onText(text)
    }
  } catch (error) {
    if (signal.aborted) throw error
    throw withQuotaGuidance(error)
  }
  return text
}

export async function summarizeConversation({ connection, character, messages, signal }: Omit<StreamReplyOptions, "onText" | "summary">) {
  try {
    if (connection.type === "builtin") {
      const bridge = getDesktopBridge()?.localAI
      if (!bridge) return null
      const requestId = crypto.randomUUID()
      return await bridge.chat({
        requestId,
        modelSource: builtinSpec(connection.model).source,
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        messages: formatConversationMessages(character, messages),
      })
    }
    const provider = createOpenAICompatible({
      name: "mikan-chat",
      baseURL: normalizeBaseUrl(connection.endpoint),
      apiKey: normalizeApiKey(connection.apiKey) || undefined,
    })
    const result = await generateText({
      model: provider(getModelCandidates(connection)[0]),
      system: SUMMARY_SYSTEM_PROMPT,
      messages: formatConversationMessages(character, messages),
      maxOutputTokens: 300,
      maxRetries: 0,
      abortSignal: signal,
    })
    return result.text
  } catch {
    return null
  }
}

const SUMMARY_SYSTEM_PROMPT = [
  "あなたは会話の書記です。これまでの会話の流れを、登場人物名と出来事を残して簡潔な日本語の箇条書きで要約してください。",
  "決定や約束、感情の変化は必ず残してください。要約本文だけを出力し、挨拶や補足は書かないでください。",
].join("\n")

function builtinSpec(source: string) {
  return localAIModelSpec({ source: source || DEFAULT_BUILTIN_MODEL.source, label: "" })
}

export function normalizeApiKey(apiKey: string) {
  const compact = apiKey.replace(/[\s\u200b-\u200d\ufeff]+/gu, "")
  return /^(['"]).*\1$/.test(compact) ? compact.slice(1, -1) : compact
}

function buildSystemPrompt(character: Character, summary?: string) {
  const pack = character.pack
  const plot = isRecord(pack?.plot) ? pack.plot : null
  const characters = Array.isArray(plot?.characters)
    ? plot.characters.flatMap((item) => {
      if (!isRecord(item) || typeof item.name !== "string" || typeof item.profile !== "string") return []
      return [`- ${item.name}: ${item.profile}`]
    })
    : [`- ${character.name}: ${character.description}`]
  const exampleSpeaker = readCharacterNames(character).values().next().value ?? character.name
  const playerProfiles = Array.isArray(plot?.playerProfiles)
    ? plot.playerProfiles.filter((item) => isRecord(item) && typeof item.name === "string" && typeof item.description === "string")
    : []
  const defaultPlayerId = typeof plot?.defaultPlayerProfile === "string" ? plot.defaultPlayerProfile : null
  const player = playerProfiles.find((item) => item.id === defaultPlayerId) ?? playerProfiles[0]
  const premise = typeof plot?.premise === "string" ? plot.premise : character.description
  const instructions = typeof plot?.instructions === "string" ? plot.instructions : ""
  const guides: string[] = []
  if (typeof plot?.situationGuide === "string" && plot.situationGuide.trim()) {
    guides.push(`会話の指針（シチュエーション）: ${plot.situationGuide.trim()}`)
  }
  if (Array.isArray(plot?.characters)) {
    const records = plot.characters.filter(isRecord)
    const mainCharacter = records.find((item) => item.name === character.name) ?? records[0]
    if (mainCharacter && typeof mainCharacter.characterGuide === "string" && mainCharacter.characterGuide.trim()) {
      guides.push(`キャラの指針（性格・行動原理）: ${mainCharacter.characterGuide.trim()}`)
    }
  }
  const style = isRecord(plot?.style) ? JSON.stringify(plot.style) : ""

  return [
    "あなたはmikan chatのシナリオ進行役です。ユーザーと自然な日本語で会話してください。",
    "登場人物の性格と関係性を守り、ユーザーの発言や行動を勝手に決めないでください。",
    "必要に応じて、台詞だけでなく短い情景描写や仕草も入れてください。",
    "複数の登場人物がいる場合は、話者名が分かる形で必要な人物だけを登場させてください。",
    "返答は各イベントを別の行にしてください。台詞は「キャラクター名: 発話内容」、情景描写や仕草など台詞以外は「>: 内容」の形式で出力してください。記号は半角のコロンを使い、これ以外の形式やラベルは使わないでください。",
    `出力例:\n>: 窓の外で雨音が強くなる。\n${exampleSpeaker}: もう少し、ここにいてもいい？`,
    `シナリオ: ${premise}`,
    player ? `ユーザーの役: ${player.name}\n${player.description}` : "",
    `登場人物:\n${characters.join("\n")}`,
    instructions ? `追加指示: ${instructions}` : "",
    guides.length ? guides.join("\n") : "",
    summary?.trim() ? `ここまでのあらまし:\n${summary.trim()}` : "",
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
