import { describe, expect, it } from "vitest"

import { DEFAULT_BUILTIN_MODEL_SOURCE, GEMMA_4_12B_MODEL, normalizeHuggingFaceModelSource } from "./local-ai"

describe("normalizeHuggingFaceModelSource", () => {
  it("従来IDとHugging Face URLをGGUFソースへ正規化する", () => {
    expect(normalizeHuggingFaceModelSource("qwen3-1.7b")).toBe(DEFAULT_BUILTIN_MODEL_SOURCE)
    expect(normalizeHuggingFaceModelSource("https://huggingface.co/example/model-GGUF/blob/main/model.Q4_K_M.gguf?download=true"))
      .toBe("hf:example/model-GGUF/model.Q4_K_M.gguf")
    expect(normalizeHuggingFaceModelSource(GEMMA_4_12B_MODEL.source)).toBe(GEMMA_4_12B_MODEL.source)
  })

  it("Hugging Face以外と危険なパスを拒否する", () => {
    expect(() => normalizeHuggingFaceModelSource("https://example.com/model.gguf")).toThrow("Hugging Face")
    expect(() => normalizeHuggingFaceModelSource("hf:example/model-GGUF/path/../model.gguf")).toThrow("使用できない文字")
  })
})
