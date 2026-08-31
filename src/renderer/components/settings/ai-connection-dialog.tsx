import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Cloud, MonitorCog, Sparkles } from "lucide-react"

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
  testAIConnection,
} from "@/lib/ai-chat"

export type ConnectionType = "local" | "online"
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
  const testController = useRef<AbortController | null>(null)
  const testRequestId = useRef(0)
  const settings = { type: connection, apiKey, endpoint, model }
  const isGoogleAIStudio = connection === "online" && isGoogleAIStudioEndpoint(endpoint)
  const connectionError = getConnectionError(settings)
  const endpointError = endpoint.trim() ? getEndpointError(settings) : undefined

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
      setModel(useGoogleDefaults ? GOOGLE_AI_STUDIO_MODEL : initialModel)
      setTestStatus("idle")
      setTestError(null)
    }
  }, [initialApiKey, initialConnection, initialEndpoint, initialModel, isDesktop, open])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-48px)] max-w-[640px] overflow-y-auto max-md:max-h-[calc(100dvh-1rem)]" data-testid="ai-connection-dialog">
        <DialogHeader>
          <DialogTitle className="text-3xl max-md:text-2xl">AIの接続</DialogTitle>
          <DialogDescription className="text-base">会話に使うAIを選びます</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {isDesktop ? <ChoiceCard
              size="dialog"
              selected={connection === "local"}
              icon={<MonitorCog />}
              title="このPCのAI"
              description="OllamaやLM Studioへ接続"
              trailing={connection === "local" ? <CheckCircle2 className="size-6 text-success" aria-hidden="true" /> : null}
              onClick={() => {
              resetTest()
              setConnection("local")
              if (endpoint.startsWith("https://")) {
                setEndpoint("http://127.0.0.1:11434/v1")
                setModel("")
              }
              }}
            /> : null}
          <ChoiceCard
            size="dialog"
            selected={isGoogleAIStudio}
            icon={<Sparkles />}
            title="Google AI Studio"
            description="Gemini APIキーを使って接続"
            trailing={isGoogleAIStudio ? <CheckCircle2 className="size-6 text-success" aria-hidden="true" /> : null}
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
            description="OpenAI互換APIへ接続"
            trailing={connection === "online" && !isGoogleAIStudio ? <CheckCircle2 className="size-6 text-success" aria-hidden="true" /> : null}
            onClick={() => {
              resetTest()
              setConnection("online")
              if (isGoogleAIStudio || endpoint.startsWith("http://127.0.0.1")) {
                setEndpoint("https://api.openai.com/v1")
                setModel("gpt-4.1-mini")
              }
            }}
          />
        </div>

        <div className="grid gap-4 rounded-md bg-surface-soft p-4">
          <TextField
            name="endpoint"
            label="接続先URL"
            value={endpoint}
            error={endpointError ?? undefined}
            placeholder={connection === "local" ? "http://127.0.0.1:11434/v1" : GOOGLE_AI_STUDIO_ENDPOINT}
            onChange={(event) => {
              resetTest()
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
        </div>

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
            description={isDesktop ? "キーはこのアプリを閉じるまで保持します。" : "同じタブでは再読み込み後も保持し、タブを閉じると破棄します。mikan chatのサーバーには保存しません。"}
          />
        ) : null}

        <div className="grid justify-items-center gap-2">
          <Button variant="outline" size="lg" className="min-w-52" disabled={testStatus === "testing" || Boolean(connectionError)} onClick={() => void testConnection()}>
            {testStatus === "testing" ? "接続を確認中…" : "接続をテスト"}
          </Button>
          {testStatus === "success" ? <p className="text-sm text-success" role="status">接続できました</p> : null}
          {testStatus === "error" ? <p className="text-center text-sm text-danger" role="alert">{testError}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button size="lg" disabled={Boolean(connectionError)} onClick={() => onConfirm(settings)}>この接続を使う</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
