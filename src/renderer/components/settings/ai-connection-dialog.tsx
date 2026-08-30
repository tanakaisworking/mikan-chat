import { useEffect, useRef, useState } from "react"
import { CheckCircle2, ChevronDown, Cloud, MonitorCog } from "lucide-react"

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
import { cn } from "@/lib/utils"

export type ConnectionType = "local" | "online"
export type ConnectionSettings = {
  type: ConnectionType
  apiKey: string
  endpoint: string
}

export function AIConnectionDialog({
  open,
  initialConnection,
  initialApiKey,
  initialEndpoint,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  initialConnection: ConnectionType
  initialApiKey: string
  initialEndpoint: string
  onOpenChange: (open: boolean) => void
  onConfirm: (settings: ConnectionSettings) => void
}) {
  const [connection, setConnection] = useState<ConnectionType>(initialConnection)
  const [showManual, setShowManual] = useState(false)
  const [apiKey, setApiKey] = useState(initialApiKey)
  const [endpoint, setEndpoint] = useState(initialEndpoint)
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success">("idle")
  const testTimer = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setConnection(initialConnection)
      setShowManual(false)
      setApiKey(initialApiKey)
      setEndpoint(initialEndpoint)
      setTestStatus("idle")
    } else if (testTimer.current) {
      window.clearTimeout(testTimer.current)
      testTimer.current = null
    }
  }, [initialApiKey, initialConnection, initialEndpoint, open])

  useEffect(() => () => {
    if (testTimer.current) window.clearTimeout(testTimer.current)
  }, [])

  const testConnection = () => {
    setTestStatus("testing")
    testTimer.current = window.setTimeout(() => {
      setTestStatus("success")
      testTimer.current = null
    }, 500)
  }

  const resetTest = () => {
    if (testTimer.current) window.clearTimeout(testTimer.current)
    testTimer.current = null
    setTestStatus("idle")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-48px)] max-w-[640px] overflow-y-auto max-md:max-h-[calc(100dvh-1rem)]" data-testid="ai-connection-dialog">
        <DialogHeader>
          <DialogTitle className="text-3xl max-md:text-2xl">AIの接続</DialogTitle>
          <DialogDescription className="text-base">会話に使うAIを選びます</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <ChoiceCard
            size="dialog"
            selected={connection === "local"}
            icon={<MonitorCog />}
            title="このPCのAI"
            description="接続できています"
            trailing={connection === "local" ? <CheckCircle2 className="size-6 text-success" aria-hidden="true" /> : null}
            onClick={() => {
              resetTest()
              setConnection("local")
            }}
          />
          <ChoiceCard
            size="dialog"
            selected={connection === "online"}
            icon={<Cloud />}
            title="オンラインAI"
            description="APIキーを使って接続"
            trailing={connection === "online" ? <CheckCircle2 className="size-6 text-success" aria-hidden="true" /> : null}
            onClick={() => {
              resetTest()
              setConnection("online")
            }}
          />
        </div>

        {connection === "local" ? (
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-between border-y border-border/70 text-left text-sm text-muted-foreground"
            aria-expanded={showManual}
            onClick={() => setShowManual((current) => !current)}
          >
            手動で接続先を入力
            <ChevronDown className={cn("size-5 text-primary-bright transition-transform", showManual && "rotate-180")} />
          </button>
        ) : (
          <TextField
            name="api-key"
            type="password"
            label="APIキー"
            value={apiKey}
            placeholder="APIキーを入力"
            autoComplete="off"
            onChange={(event) => {
              resetTest()
              setApiKey(event.target.value)
            }}
            description="キーはこのPC内に保存します。"
          />
        )}

        {connection === "local" && showManual ? (
          <div className="grid gap-4 rounded-md bg-surface-soft p-4">
            <TextField
              name="endpoint"
              label="接続先URL"
              value={endpoint}
              onChange={(event) => {
                resetTest()
                setEndpoint(event.target.value)
              }}
              description="OllamaやOpenAI互換APIのURLを入力します。"
            />
          </div>
        ) : null}

        <div className="grid justify-items-center gap-2">
          <Button variant="outline" size="lg" className="min-w-52" disabled={testStatus === "testing" || (connection === "online" && !apiKey.trim())} onClick={testConnection}>
            {testStatus === "testing" ? "接続を確認中…" : "接続をテスト"}
          </Button>
          {testStatus === "success" ? <p className="text-sm text-success" role="status">接続できました</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button size="lg" disabled={connection === "online" && !apiKey.trim()} onClick={() => onConfirm({ type: connection, apiKey, endpoint })}>この接続を使う</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
