export const BUILTIN_MODEL_ID = "qwen3-1.7b"
export const BUILTIN_MODEL_LABEL = "Qwen3 1.7B"
export const DEFAULT_BUILTIN_MODEL_SOURCE = "hf:Qwen/Qwen3-1.7B-GGUF:Q8_0"

export type LocalAIModelSpec = {
  source: string
  label: string
}

export const DEFAULT_BUILTIN_MODEL: LocalAIModelSpec = {
  source: DEFAULT_BUILTIN_MODEL_SOURCE,
  label: BUILTIN_MODEL_LABEL,
}

export const GEMMA_4_12B_MODEL: LocalAIModelSpec = {
  source: "hf:giladgd/gemma-4-12B-it-GGUF:Q4_K_M",
  label: "Gemma 4 12B Q4_K_M",
}

export type LocalAIStatus = {
  state: "missing" | "downloading" | "ready" | "loading" | "error"
  modelId: string
  label: string
  source: string
  downloadedBytes: number
  totalBytes: number
  error?: string
}

export type LocalAIChatRequest = {
  requestId: string
  modelSource: string
  systemPrompt: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
}

export function normalizeHuggingFaceModelSource(input: string) {
  const value = input.trim()
  if (value === BUILTIN_MODEL_ID) return DEFAULT_BUILTIN_MODEL_SOURCE
  const urlMatch = /^https:\/\/huggingface\.co\/([^/]+)\/([^/]+)\/(?:blob|resolve)\/main\/(.+\.gguf)(?:\?.*)?$/i.exec(value)
  const normalized = urlMatch ? `hf:${urlMatch[1]}/${urlMatch[2]}/${urlMatch[3]}` : value
  if (!/^hf:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+|\/[A-Za-z0-9_./-]+\.gguf)$/i.test(normalized)) {
    throw new Error("Hugging FaceのGGUFモデルを「hf:作者/リポジトリ:量子化」またはGGUFファイルURLで指定してください。")
  }
  if (normalized.includes("..")) throw new Error("モデルのパスに使用できない文字が含まれています。")
  return normalized
}

export function localAIModelSpec(input: LocalAIModelSpec): LocalAIModelSpec {
  const source = normalizeHuggingFaceModelSource(input.source)
  const label = input.label.trim().slice(0, 100) || source.replace(/^hf:/, "")
  return { source, label }
}
