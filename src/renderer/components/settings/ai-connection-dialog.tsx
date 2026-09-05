import { useEffect, useRef, useState } from "react"
import { Bot, CheckCircle2, Cloud, Download, MonitorCog, RefreshCw, Sparkles, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChoiceCard } from "@/components/ui/choice-card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TextField } from "@/components/ui/text-field"
import {
  GOOGLE_AI_STUDIO_ENDPOINT,
  GOOGLE_AI_STUDIO_FALLBACK_MODEL,
  GOOGLE_AI_STUDIO_MODEL,
  GOOGLE_AI_STUDIO_STABLE_FALLBACK_MODEL,
  getConnectionError,
  getEndpointError,
  isGoogleAIStudioEndpoint,
  listAIModels,
  testAIConnection,
} from "@/lib/ai-chat"
import { getDesktopBridge } from "@/lib/platform"
import {
  BUILTIN_MODEL_ID,
  DEFAULT_BUILTIN_MODEL,
  GEMMA_4_12B_MODEL,
  localAIModelSpec,
  type LocalAIModelSpec,
  type LocalAIStatus,
} from "../../../shared/local-ai"

export type ConnectionType = "builtin" | "local" | "online"
export type ConnectionSettings = {
  type: ConnectionType
  apiKey: string
  endpoint: string
  model: string
}

export function AIConnectionDialog({
  open,
  initialConnection,
  initialApiKey,
  initialEndpoint,
  initialModel,
  isDesktop,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  initialConnection: ConnectionType
  initialApiKey: string
  initialEndpoint: string
  initialModel: string
  isDesktop: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (settings: ConnectionSettings) => void
}) {
  const [connection, setConnection] = useState<ConnectionType>(initialConnection)
  const [apiKey, setApiKey] = useState(initialApiKey)
  const [endpoint, setEndpoint] = useState(initialEndpoint)
  const [model, setModel] = useState(initialModel)
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [testError, setTestError] = useState<string | null>(null)
  const [localModels, setLocalModels] = useState<string[]>([])
  const [localModelsStatus, setLocalModelsStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [localModelsError, setLocalModelsError] = useState<string | null>(null)
  const [builtinStatus, setBuiltinStatus] = useState<LocalAIStatus | null>(null)
  const [builtinBusy, setBuiltinBusy] = useState(false)
  const [builtinActionError, setBuiltinActionError] = useState<string | null>(null)
  const testController = useRef<AbortController | null>(null)
  const testRequestId = useRef(0)
  const settings = { type: connection, apiKey, endpoint, model }
  const builtinModel = resolveBuiltinModel(model)
  const builtinSource = builtinModel.spec?.source
  const builtinLabel = builtinModel.spec?.label
  const isGoogleAIStudio = connection === "online" && isGoogleAIStudioEndpoint(endpoint)
  const connectionError = connection === "builtin" && builtinModel.error
    ? builtinModel.error
    : connection === "builtin" && builtinStatus?.state !== "ready"
      ? "内蔵AIのモデルを先にダウンロードしてください。"
    : getConnectionError(settings)
  const endpointError = endpoint.trim() ? getEndpointError(settings) : undefined
  const selectedConnectionLabel = connection === "builtin"
    ? "内蔵AI"
    : connection === "local"
      ? "このPCのAI"
      : isGoogleAIStudio ? "Google AI Studio" : "その他のオンラインAI"
  const selectedConnectionDetail = connection === "builtin"
    ? `${builtinModel.spec?.label ?? "モデル未選択"} ・ ${builtinStatusLabel(builtinStatus)}`
    : model.trim() || "モデル未選択"

  useEffect(() => {
    testController.current?.abort()
    testController.current = null
    testRequestId.current += 1
    if (open) {
      const nextConnection = isDesktop ? initialConnection : "online"
      const useGoogleDefaults = nextConnection === "online" && initialEndpoint.startsWith("http://127.0.0.1")
      setConnection(nextConnection)
      setApiKey(initialApiKey)
      setEndpoint(useGoogleDefaults ? GOOGLE_AI_STUDIO_ENDPOINT : initialEndpoint)
      setModel(useGoogleDefaults
        ? GOOGLE_AI_STUDIO_MODEL
        : nextConnection === "builtin" && initialModel === BUILTIN_MODEL_ID
          ? DEFAULT_BUILTIN_MODEL.source
          : initialModel)
      setTestStatus("idle")
      setTestError(null)
      setLocalModels([])
      setLocalModelsStatus("idle")
      setLocalModelsError(null)
    }
  }, [initialApiKey, initialConnection, initialEndpoint, initialModel, isDesktop, open])

  useEffect(() => {
    if (!open || connection !== "builtin" || !builtinSource) return
    const localAI = getDesktopBridge()?.localAI
    if (!localAI) return
    setBuiltinStatus(null)
    const spec = { source: builtinSource, label: builtinLabel ?? builtinSource }
    let active = true
    const unsubscribe = localAI.onStatus((status) => {
      if (status.source === spec.source) setBuiltinStatus(status)
    })
    void localAI.status(spec).then((status) => {
      if (active && status.source === spec.source) setBuiltinStatus(status)
    }).catch(() => {
      if (active) setBuiltinStatus(null)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [builtinLabel, builtinSource, connection, open])

  const testConnection = async () => {
    testController.current?.abort()
    const controller = new AbortController()
    testController.current = controller
    const requestId = ++testRequestId.current
    setTestStatus("testing")
    setTestError(null)
    try {
      await testAIConnection(settings, controller.signal)
      if (testRequestId.current !== requestId) return
      setTestStatus("success")
    } catch (error) {
      if (controller.signal.aborted || testRequestId.current !== requestId) return
      setTestStatus("error")
      setTestError(error instanceof Error ? error.message : "接続を確認できませんでした。")
    } finally {
      if (testController.current === controller) testController.current = null
    }
  }

  const resetTest = () => {
    testController.current?.abort()
    testController.current = null
    testRequestId.current += 1
    setTestStatus("idle")
    setTestError(null)
  }

  const resetLocalModels = () => {
    setLocalModels([])
    setLocalModelsStatus("idle")
    setLocalModelsError(null)
  }

  const loadLocalModels = async () => {
    testController.current?.abort()
    const controller = new AbortController()
    testController.current = controller
    setLocalModels([])
    setLocalModelsStatus("loading")
    setLocalModelsError(null)
    try {
      const models = await listAIModels({ type: "local", endpoint, apiKey: "" }, controller.signal)
      setLocalModels(models)
      setLocalModelsStatus("success")
      if (!model.trim() && models[0]) setModel(models[0])
    } catch (error) {
      if (controller.signal.aborted) return
      setLocalModelsStatus("error")
      setLocalModelsError(error instanceof TypeError
        ? "ローカルAIに接続できません。OllamaまたはLM Studioを起動してください。"
        : error instanceof Error ? error.message : "モデルを確認できませんでした。")
    } finally {
      if (testController.current === controller) testController.current = null
    }
  }

  const downloadBuiltinModel = async () => {
    const localAI = getDesktopBridge()?.localAI
    if (!localAI || !builtinModel.spec) return
    setBuiltinBusy(true)
    setBuiltinActionError(null)
    try {
      await localAI.download(builtinModel.spec)
    } catch (error) {
      setBuiltinActionError(error instanceof Error ? error.message : "モデルをダウンロードできませんでした。")
    } finally {
      setBuiltinBusy(false)
    }
  }

  const deleteBuiltinModel = async () => {
    const localAI = getDesktopBridge()?.localAI
    if (!localAI || !builtinModel.spec) return
    setBuiltinBusy(true)
    setBuiltinActionError(null)
    try {
      await localAI.delete(builtinModel.spec)
    } catch (error) {
      setBuiltinActionError(error instanceof Error ? error.message : "モデルを削除できませんでした。")
    } finally {
      setBuiltinBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-48px)] max-w-[640px] overflow-y-auto max-md:max-h-[calc(100dvh-1rem)]" data-testid="ai-connection-dialog">
        <DialogHeader>
          <DialogTitle className="text-3xl max-md:text-2xl">AIの接続</DialogTitle>
          <DialogDescription className="text-base">会話に使うAIを選びます</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          {isDesktop ? <section className="grid gap-3" aria-labelledby="local-ai-options">
            <h3 id="local-ai-options" className="text-sm font-semibold text-muted-foreground">この端末で動かす</h3>
            <ChoiceCard
              size="dialog"
              selected={connection === "builtin"}
              icon={<Bot />}
              title="内蔵AI"
              description="アプリだけで動きます。会話は端末の外に出ません"
              trailing={connection === "builtin" ? <span className="rounded-full bg-surface-soft px-3 py-1 text-sm font-bold text-primary">選択中</span> : null}
              onClick={() => {
                resetTest()
                setConnection("builtin")
                if (!resolveBuiltinModel(model).spec) setModel(DEFAULT_BUILTIN_MODEL.source)
              }}
            />
            <ChoiceCard
              size="dialog"
              selected={connection === "local"}
              icon={<MonitorCog />}
              title="このPCのAI"
              description="OllamaやLM Studioにつなぎます"
              trailing={connection === "local" ? <span className="rounded-full bg-surface-soft px-3 py-1 text-sm font-bold text-primary">選択中</span> : null}
              onClick={() => {
                resetTest()
                setConnection("local")
                if (connection === "builtin" || !endpoint.trim() || endpoint.startsWith("https://")) {
                  setEndpoint("http://127.0.0.1:11434/v1")
                  setModel("")
                  resetLocalModels()
                }
              }}
            />
          </section> : null}
          <section className="grid gap-3" aria-labelledby="online-ai-options">
            <h3 id="online-ai-options" className="text-sm font-semibold text-muted-foreground">オンラインAIにつなぐ</h3>
            <ChoiceCard
              size="dialog"
              selected={isGoogleAIStudio}
              icon={<Sparkles />}
              title="Google AI Studio"
              description="Gemini APIキーでつなぎます"
              trailing={isGoogleAIStudio ? <span className="rounded-full bg-surface-soft px-3 py-1 text-sm font-bold text-primary">選択中</span> : null}
              onClick={() => {
                resetTest()
                setConnection("online")
                setEndpoint(GOOGLE_AI_STUDIO_ENDPOINT)
                setModel(GOOGLE_AI_STUDIO_MODEL)
              }}
            />
            <ChoiceCard
              size="dialog"
              selected={connection === "online" && !isGoogleAIStudio}
              icon={<Cloud />}
              title="その他のオンラインAI"
              description="OpenAI互換のAPIにつなぎます"
              trailing={connection === "online" && !isGoogleAIStudio ? <span className="rounded-full bg-surface-soft px-3 py-1 text-sm font-bold text-primary">選択中</span> : null}
              onClick={() => {
                resetTest()
                setConnection("online")
                if (connection === "builtin" || !endpoint.trim() || isGoogleAIStudio || endpoint.startsWith("http://127.0.0.1")) {
                  setEndpoint("https://api.openai.com/v1")
                  setModel("gpt-4.1-mini")
                }
              }}
            />
          </section>
        </div>

        <div className="rounded-md border border-border bg-surface p-4" aria-live="polite">
          <p className="text-sm font-semibold text-muted-foreground">選んだAI</p>
          <p className="mt-1 font-bold text-primary">{selectedConnectionLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">{selectedConnectionDetail}</p>
        </div>

        {connection === "builtin" ? (
          <div className="grid gap-3 rounded-md border border-border bg-surface p-4" aria-live="polite">
            <div>
              <p className="font-semibold">使うモデル</p>
              <p className="mt-1 text-sm text-muted-foreground">初回ダウンロード後はオフラインで使えます。</p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1" role="group" aria-label="おすすめの内蔵AIモデル">
              {[DEFAULT_BUILTIN_MODEL, GEMMA_4_12B_MODEL].map((preset) => {
                const selected = builtinModel.spec?.source === preset.source
                return (
                  <Button
                    key={preset.source}
                    type="button"
                    variant="outline"
                    className={selected ? "border-primary font-bold text-primary hover:bg-surface" : undefined}
                    aria-pressed={selected}
                    disabled={builtinStatus?.state === "downloading" || builtinStatus?.state === "loading"}
                    onClick={() => {
                      resetTest()
                      setModel(preset.source)
                    }}
                  >
                    {selected ? <CheckCircle2 aria-hidden="true" /> : null}
                    {preset.label}
                  </Button>
                )
              })}
            </div>
            <TextField
              name="builtin-model-source"
              label="Hugging FaceのGGUFモデル"
              value={model}
              placeholder="hf:作者/リポジトリ:Q4_K_M"
              error={builtinModel.error ?? undefined}
              disabled={builtinStatus?.state === "downloading" || builtinStatus?.state === "loading"}
              onChange={(event) => {
                resetTest()
                setModel(event.target.value)
              }}
              description="hf:形式、またはHugging Face上の.ggufファイルURLを指定できます。大きなモデルは十分なメモリと空き容量が必要です。"
            />
            {builtinStatus?.state === "downloading" ? (
              <>
                <div
                  className="h-2 overflow-hidden rounded-full bg-border"
                  role="progressbar"
                  aria-label="モデルのダウンロード進捗"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent(builtinStatus)}
                >
                  <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${progressPercent(builtinStatus)}%` }} />
                </div>
                <p className="text-right text-xs tabular-nums text-muted-foreground">{formatBytes(builtinStatus.downloadedBytes)} / {formatBytes(builtinStatus.totalBytes)}</p>
              </>
            ) : null}
            {builtinStatus?.state === "loading" ? <p className="text-sm text-muted-foreground">モデルを起動しています…</p> : null}
            {builtinStatus?.state === "error" ? <p className="text-sm text-danger" role="alert">{builtinStatus.error}</p> : null}
            {builtinActionError ? <p className="text-sm text-danger" role="alert">{builtinActionError}</p> : null}
            {builtinStatus?.state === "ready" ? (
              <Button variant="outline" onClick={() => void deleteBuiltinModel()} disabled={builtinBusy}>
                <Trash2 />モデルを削除
              </Button>
            ) : builtinStatus?.state === "error" ? (
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <Button onClick={() => void downloadBuiltinModel()} disabled={builtinBusy}>
                  <Download />もう一度ダウンロード
                </Button>
                <Button variant="outline" onClick={() => void deleteBuiltinModel()} disabled={builtinBusy}>
                  <Trash2 />モデルを削除
                </Button>
              </div>
            ) : builtinStatus?.state !== "downloading" ? (
              <Button onClick={() => void downloadBuiltinModel()} disabled={builtinBusy || !builtinStatus}>
                <Download />モデルをダウンロード
              </Button>
            ) : null}
          </div>
        ) : null}

        {connection !== "builtin" ? <div className="grid gap-4 rounded-md bg-surface-soft p-4">
          <TextField
            name="endpoint"
            label="接続先URL"
            value={endpoint}
            error={endpointError ?? undefined}
            placeholder={connection === "local" ? "http://127.0.0.1:11434/v1" : GOOGLE_AI_STUDIO_ENDPOINT}
            onChange={(event) => {
              resetTest()
              resetLocalModels()
              setEndpoint(event.target.value)
            }}
            description={isGoogleAIStudio ? "Google AI StudioのOpenAI互換エンドポイントです。" : "OpenAI互換APIのベースURLを入力します。"}
          />
          <TextField
            name="model"
            label="モデル名"
            value={model}
            placeholder={connection === "local" ? "例: qwen3:8b" : isGoogleAIStudio ? `例: ${GOOGLE_AI_STUDIO_MODEL}` : "例: gpt-4.1-mini"}
            onChange={(event) => {
              resetTest()
              setModel(event.target.value)
            }}
            description={isGoogleAIStudio && model.trim() === GOOGLE_AI_STUDIO_MODEL ? `失敗時は${GOOGLE_AI_STUDIO_FALLBACK_MODEL}、さらに${GOOGLE_AI_STUDIO_STABLE_FALLBACK_MODEL}へ切り替えます。` : undefined}
          />
          {connection === "local" ? (
            <div className="grid gap-3 border-t border-border/70 pt-4">
              <Button variant="outline" onClick={() => void loadLocalModels()} disabled={localModelsStatus === "loading" || Boolean(endpointError)}>
                <RefreshCw className={localModelsStatus === "loading" ? "animate-spin" : undefined} />
                {localModelsStatus === "loading" ? "モデルを確認中…" : "インストール済みモデルを確認"}
              </Button>
              {localModels.length > 0 ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label="インストール済みモデル">
                  {localModels.map((modelName) => (
                    <Button
                      key={modelName}
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-pressed={model === modelName}
                      onClick={() => {
                        resetTest()
                        setModel(modelName)
                      }}
                    >
                      {modelName}
                    </Button>
                  ))}
                </div>
              ) : null}
              {localModelsStatus === "success" && localModels.length === 0 ? <p className="text-sm text-muted-foreground">インストール済みのモデルがありません。Ollamaでモデルを追加してから、もう一度確認してください。</p> : null}
              {localModelsStatus === "error" ? (
                <div className="grid gap-2 text-sm" role="alert">
                  <p className="text-danger">{localModelsError}</p>
                  <a className="w-fit font-semibold text-primary underline underline-offset-4" href="https://ollama.com/download" target="_blank" rel="noreferrer">Ollamaを入手する</a>
                </div>
              ) : null}
            </div>
          ) : null}
        </div> : null}

        {connection === "online" ? (
          <TextField
            name="api-key"
            type="password"
            label={isGoogleAIStudio ? "Gemini APIキー" : "APIキー"}
            value={apiKey}
            placeholder="APIキーを入力"
            autoComplete="off"
            onChange={(event) => {
              resetTest()
              setApiKey(event.target.value)
            }}
            description={isDesktop ? "キーはこのアプリを閉じるまで保持します。" : "このブラウザに保存し、次回も利用します。mikan chatのサーバーには保存しません。"}
          />
        ) : null}

        <div className="grid justify-items-center gap-2">
          <Button variant="outline" size="lg" className="min-w-52" disabled={testStatus === "testing" || Boolean(connectionError)} onClick={() => void testConnection()}>
            {testStatus === "testing" ? "接続を確認中…" : "接続を確認"}
          </Button>
          {testStatus === "success" ? <p className="text-sm text-success" role="status">接続できました</p> : null}
          {testStatus === "error" ? <p className="text-center text-sm text-danger" role="alert">{testError}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            size="lg"
            disabled={Boolean(connectionError)}
            onClick={() => onConfirm(connection === "builtin"
              ? { type: "builtin", endpoint: "", model: builtinModel.spec?.source ?? DEFAULT_BUILTIN_MODEL.source, apiKey }
              : settings)}
          >{selectedConnectionLabel}を使う</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function resolveBuiltinModel(source: string): { spec: LocalAIModelSpec | null; error: string | null } {
  try {
    const normalizedSource = source === BUILTIN_MODEL_ID ? DEFAULT_BUILTIN_MODEL.source : source
    const preset = [DEFAULT_BUILTIN_MODEL, GEMMA_4_12B_MODEL].find((item) => item.source === normalizedSource)
    return { spec: preset ?? localAIModelSpec({ source: normalizedSource, label: "" }), error: null }
  } catch (error) {
    return { spec: null, error: error instanceof Error ? error.message : "Hugging FaceのGGUFモデルを指定してください。" }
  }
}

function progressPercent(status: LocalAIStatus) {
  return status.totalBytes > 0 ? Math.min(100, Math.round((status.downloadedBytes / status.totalBytes) * 100)) : 0
}

function formatBytes(bytes: number) {
  if (!bytes) return "準備中"
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`
}

function builtinStatusLabel(status: LocalAIStatus | null) {
  if (!status) return "状態を確認中"
  if (status.state === "ready") return "利用できます"
  if (status.state === "downloading") return `ダウンロード中 ${progressPercent(status)}%`
  if (status.state === "loading") return "準備中"
  if (status.state === "error") return "エラー"
  return "ダウンロードが必要"
}
