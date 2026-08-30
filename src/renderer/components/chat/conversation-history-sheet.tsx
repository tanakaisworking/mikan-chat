import { useState } from "react"
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

const initialConversations = [
  { id: "today", title: "今日のこと", preview: "もちろん。ゆっくり聞かせて。", date: "12分前" },
  { id: "rain", title: "雨の日の帰り道", preview: "傘、ちゃんと持ってきた？", date: "昨日" },
  { id: "weekend", title: "週末の予定", preview: "今度、一緒に見に行こうよ。", date: "3日前" },
  { id: "first", title: "はじめての会話", preview: "会えてうれしい。", date: "8月24日" },
]

export function ConversationHistorySheet({
  open,
  characterName,
  activeConversationId,
  onOpenChange,
  onSelectConversation,
}: {
  open: boolean
  characterName: string
  activeConversationId: string
  onOpenChange: (open: boolean) => void
  onSelectConversation: (conversationId: string) => void
}) {
  const [conversations, setConversations] = useState(initialConversations)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState("")

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
    setConversations((current) => current.map((item) => item.id === renameId ? { ...item, title } : item))
    setRenameId(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" data-testid="conversation-history-sheet">
        <SheetHeader>
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
                    ? "group relative rounded-md border border-primary-bright/55 bg-surface-soft shadow-soft"
                    : "group relative rounded-md border border-border/70 bg-surface transition-colors hover:border-primary-bright/45 hover:bg-surface-soft/50"
                }
              >
                <button
                  type="button"
                  className="w-full p-4 text-left max-md:pr-24"
                  aria-current={active ? "true" : undefined}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <span className="flex items-start gap-3">
                    <span className="min-w-0 flex-1">
                      <span className={active ? "block font-semibold text-primary" : "block font-semibold"}>
                        {conversation.title}
                      </span>
                      <span className="mt-2 block truncate text-sm text-muted-foreground">{conversation.preview}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{conversation.date}</span>
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
                      onClick={() => setConversations((current) => current.filter((item) => item.id !== conversation.id))}
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
