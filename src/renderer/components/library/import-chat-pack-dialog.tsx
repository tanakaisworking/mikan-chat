import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Download, FileArchive, Flower2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { demoChatPack } from "@/data/demo-chat-pack"
import { ChatPackError, loadChatPack, type LoadedChatPack } from "@/lib/chat-pack"

export function ImportChatPackDialog({
  open,
  onOpenChange,
  onAddToLibrary,
  onAddAndTalk,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToLibrary: (pack: LoadedChatPack) => string | undefined
  onAddAndTalk: (pack: LoadedChatPack) => string | undefined
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const requestIdRef = useRef(0)
  const [loaded, setLoaded] = useState<LoadedChatPack | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [adultPreview, setAdultPreview] = useState(false)

  useEffect(() => {
    if (!open) {
      requestIdRef.current += 1
      setLoaded(null)
      setLoading(false)
      setError("")
      setAdultPreview(false)
    }
  }, [open])

  const readFile = async (file: File, requestId = ++requestIdRef.current) => {
    setLoading(true)
    setError("")
    setLoaded(null)
    setAdultPreview(false)
    try {
      const nextPack = await loadChatPack(file)
      if (requestId === requestIdRef.current) setLoaded(nextPack)
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setError(cause instanceof ChatPackError ? cause.message : "チャットパックを読み込めませんでした。")
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }

  const loadDemo = async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError("")
    try {
      const response = await fetch(demoChatPack.url)
      if (!response.ok) throw new Error("demo download failed")
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (requestId !== requestIdRef.current) return
      await readFile(new File([bytes], demoChatPack.fileName, { type: "application/vnd.mikan.chat+zip" }), requestId)
    } catch {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setError("デモファイルを取得できませんでした。")
      }
    }
  }

  const character = loaded?.pack.plot.characters[0]
  const cover = loaded ? loaded.assets[loaded.pack.discovery.covers[0]] : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-48px)] max-w-[1040px] overflow-y-auto max-md:max-h-[calc(100dvh-1rem)]" data-testid="import-chat-pack-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Flower2 className="size-6 text-primary-bright" aria-hidden="true" />
            チャットパックを追加
          </DialogTitle>
          <DialogDescription>.mikanchatファイルを検証して、内容を確認してから追加します。</DialogDescription>
        </DialogHeader>

        {loaded?.pack.rating === "r18" && !adultPreview ? (
          <div className="grid min-h-72 place-items-center rounded-lg border border-danger/35 bg-danger/5 p-8 text-center max-md:min-h-60 max-md:p-5">
            <div className="max-w-lg">
              <p className="text-sm font-semibold text-danger">R18コンテンツ</p>
              <h3 className="mt-3 text-2xl font-semibold">成人向けの画像と内容が含まれます</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">18歳以上で、内容の表示を希望する場合だけ先へ進んでください。</p>
              <Button className="mt-6" variant="destructive" onClick={() => setAdultPreview(true)}>R18の内容を表示</Button>
            </div>
          </div>
        ) : loaded && character ? (
          <div className="grid grid-cols-[38%_minmax(0,1fr)] gap-8 max-md:grid-cols-1 max-md:gap-5">
            <img
              src={cover}
              alt={`${loaded.pack.title}のカバー`}
              className="aspect-[9/16] max-h-[520px] size-full rounded-lg border border-border object-cover object-top shadow-soft max-md:aspect-[16/10] max-md:max-h-64"
            />
            <div className="flex min-w-0 flex-col justify-center">
              <p className="text-sm font-semibold text-primary">Chat Pack v{loaded.pack.specVersion}</p>
              <h3 className="mt-2 text-3xl leading-snug font-semibold max-md:text-2xl">{loaded.pack.title}</h3>
              <p className="mt-2 text-base text-muted-foreground">作者：{loaded.pack.author.name}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {(loaded.pack.discovery.tags ?? []).map((tag) => (
                  <span key={tag} className="rounded-full border border-primary-bright/35 bg-surface-soft px-4 py-2 text-sm text-primary">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-7 text-base leading-relaxed">{loaded.pack.discovery.description ?? loaded.pack.summary}</p>
              <div className="mt-7 grid gap-3 border-t border-border/70 pt-6 text-sm">
                <p className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                  安全性と必須項目を確認しました
                </p>
                <p className="flex items-center gap-3 text-muted-foreground">
                  <FileArchive className="size-5" aria-hidden="true" />
                  {loaded.fileName}・登場人物 {loaded.pack.plot.characters.length}人
                </p>
              </div>
              <Button variant="link" className="mt-4 h-auto justify-start px-0" onClick={() => inputRef.current?.click()}>
                別のファイルを選ぶ
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="grid min-h-72 place-items-center rounded-lg border border-dashed border-primary-bright/55 bg-surface-soft/55 p-8 text-center transition-colors hover:bg-surface-soft max-md:min-h-60 max-md:p-5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const file = event.dataTransfer.files[0]
              if (file) void readFile(file)
            }}
          >
            <div>
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-surface text-primary shadow-soft">
                <Upload className="size-7" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-xl font-semibold">.mikanchatをここへドロップ</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">ZIPの内容と画像を展開前に検証します。</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button disabled={loading} onClick={() => inputRef.current?.click()}>
                  {loading ? "読み込み中…" : "ファイルを選ぶ"}
                </Button>
                <Button variant="outline" disabled={loading} onClick={() => void loadDemo()}>
                  デモを読み込む
                </Button>
              </div>
              <a href={demoChatPack.url} download={demoChatPack.fileName} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
                <Download className="size-4" aria-hidden="true" />
                デモファイルをダウンロード
              </a>
            </div>
          </div>
        )}

        {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}

        <input
          ref={inputRef}
          type="file"
          accept=".mikanchat,application/vnd.mikan.chat+zip"
          className="sr-only"
          aria-label="チャットパックファイル"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void readFile(file)
            event.target.value = ""
          }}
        />

        <DialogFooter>
          <Button variant="outline" size="lg" className="sm:mr-auto" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          {loaded && (loaded.pack.rating !== "r18" || adultPreview) ? (
            <>
              <Button variant="outline" size="lg" onClick={() => setError(onAddToLibrary(loaded) ?? "")}>
                ライブラリに追加
              </Button>
              <Button size="lg" onClick={() => setError(onAddAndTalk(loaded) ?? "")}>追加して話す</Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
