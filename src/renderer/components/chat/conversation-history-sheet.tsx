import { useEffect, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { IconButton } from "@/components/ui/icon-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { TextField } from "@/components/ui/text-field"
import { getDesktopBridge, isMacDesktop } from "@/lib/platform"
import type { DesktopConversation } from "../../../shared/desktop-store"

const initialConversations = [
  { id: "today", title: "今日のこと", preview: "もちろん。ゆっくり聞かせて。", date: "12分前" },
  { id: "rain", title: "雨の日の帰り道", preview: "傘、ちゃんと持ってきた？", date: "昨日" },
  { id: "weekend", title: "週末の予定", preview: "今度、一緒に見に行こうよ。", date: "3日前" },
  { id: "first", title: "はじめての会話", preview: "会えてうれしい。", date: "8月24日" },
]
type ConversationItem = (typeof initialConversations)[number] & { stored?: DesktopConversation }

export function ConversationHistorySheet({
  open,
  scenarioId,
  characterName,
  importedPack = false,
  activeConversationId,
  onOpenChange,
  onSelectConversation,
}: {
  open: boolean
  scenarioId: string
  characterName: string
  importedPack?: boolean
  activeConversationId: string
  onOpenChange: (open: boolean) => void
  onSelectConversation: (conversationId: string) => void
}) {
  const [conversations, setConversations] = useState<ConversationItem[]>(() => importedPack ? [initialConversations[0]] : initialConversations)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState("")

  useEffect(() => {
    const store = getDesktopBridge()?.conversations
    if (!open || !store) return
    let active = true
    void store.list().then((items) => {
      if (!active) return
      const prefix = `${scenarioId}:`
      setConversations(items.filter((item) => item.scenarioId === scenarioId).map((item) => ({
        id: item.id.startsWith(prefix) ? item.id.slice(prefix.length) : item.id,
        title: item.title,
        preview: item.messages.at(-1)?.text ?? "まだ会話はありません。",
        date: new Date(item.updatedAt).toLocaleDateString("ja-JP"),
        stored: item,
      })))
    }).catch((error) => console.error("Failed to list conversations", error))
    return () => { active = false }
  }, [open, scenarioId])

  const startConversation = () => {
    const id = crypto.randomUUID()
    setConversations((current) => [
      { id, title: "新しい会話", preview: "まだ会話はありません。", date: "たった今" },
      ...current,
    ])
    onSelectConversation(id)
  }

  const saveTitle = () => {
    const title = renameTitle.trim()
    if (!renameId || !title) return
    setConversations((current) => {
      const target = current.find((item) => item.id === renameId)
      if (target) {
        const stored = "stored" in target ? target.stored as DesktopConversation : undefined
        void getDesktopBridge()?.conversations?.save({
          id: `${scenarioId}:${renameId}`,
          scenarioId,
          title,
          updatedAt: new Date().toISOString(),
          messages: stored?.messages ?? [],
        })
      }
      return current.map((item) => item.id === renameId ? { ...item, title } : item)
    })
    setRenameId(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        data-testid="conversation-history-sheet"
        // macOSは信号機分のタイトルバー（h-9）の下に寄せる。それ以外は全高のまま。
        // 共通側の data-[side=left]:inset-y-0/h-full と詳細度で争うため確実なinline指定にする。
        style={isMacDesktop() ? { top: 36, height: "calc(100% - 36px)" } : undefined}
      >
        <SheetHeader className="px-5 py-5">
          <SheetTitle>{characterName}との会話</SheetTitle>
          <SheetDescription className="sr-only">{characterName}との過去の会話一覧</SheetDescription>
        </SheetHeader>

        <div className="px-5">
          <Button size="lg" className="w-full" onClick={startConversation}>
            <Plus />
            新しい会話
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3">
          <div className="grid gap-3">
            {conversations.map((conversation) => {
              const active = conversation.id === activeConversationId
              return (
              <div
                key={conversation.id}
                className={
                  active
                    ? "group relative min-w-0 overflow-hidden rounded-md border border-primary-bright/55 bg-surface-soft shadow-soft"
                    : "group relative min-w-0 overflow-hidden rounded-md border border-border/70 bg-surface transition-colors hover:border-primary-bright/45 hover:bg-surface-soft/50"
                }
              >
                <button
                  type="button"
                  className="w-full p-4 text-left max-md:pr-24"
                  aria-current={active ? "true" : undefined}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <span className="flex min-w-0 items-start gap-3">
                    <span className="min-w-0 flex-1">
                      <span className={active ? "block font-semibold text-primary" : "block font-semibold"}>
                        {conversation.title}
                      </span>
                      <span className="mt-2 block truncate text-sm text-muted-foreground">{conversation.preview}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{conversation.date}</span>
                  </span>
                </button>
                <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100">
                  <IconButton
                    label={`${conversation.title}の名前を変更`}
                    onClick={() => {
                      setRenameId(conversation.id)
                      setRenameTitle(conversation.title)
                    }}
                  >
                    <Pencil />
                  </IconButton>
                  {!active ? (
                    <IconButton
                      label={`${conversation.title}を削除`}
                      onClick={() => {
                        setConversations((current) => current.filter((item) => item.id !== conversation.id))
                        void getDesktopBridge()?.conversations?.delete(`${scenarioId}:${conversation.id}`)
                      }}
                    >
                      <Trash2 className="text-danger" />
                    </IconButton>
                  ) : null}
                </div>
              </div>
              )
            })}
          </div>
        </div>
      </SheetContent>

      <Dialog open={renameId !== null} onOpenChange={(nextOpen) => { if (!nextOpen) setRenameId(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>会話名を変更</DialogTitle>
          </DialogHeader>
          <TextField
            label="会話名"
            value={renameTitle}
            autoFocus
            onChange={(event) => setRenameTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) saveTitle()
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>キャンセル</Button>
            <Button disabled={!renameTitle.trim()} onClick={saveTitle}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
