import { CheckCircle2, FileArchive, Flower2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { assets } from "@/data/characters"

export function ImportCharacterDialog({
  open,
  onOpenChange,
  onAddToLibrary,
  onAddAndTalk,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToLibrary: () => void
  onAddAndTalk: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-48px)] max-w-[1120px] overflow-y-auto max-md:max-h-[calc(100dvh-1rem)]" data-testid="import-character-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Flower2 className="size-6 text-primary-bright" aria-hidden="true" />
            キャラクターを追加
          </DialogTitle>
          <DialogDescription className="sr-only">読み込むキャラクターパックの内容を確認します</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[40%_minmax(0,1fr)] gap-8 max-md:grid-cols-1 max-md:gap-5">
          <img
            src={assets.shizukuStage}
            alt="雫のキャラクター画像"
            className="aspect-square size-full rounded-lg border border-border object-cover object-top shadow-soft max-md:aspect-[16/10] max-md:object-[center_25%]"
          />
          <div className="flex min-w-0 flex-col justify-center">
            <h3 className="text-3xl font-semibold">雫</h3>
            <p className="mt-2 text-base text-muted-foreground">作者：雨音</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['落ち着いた', 'ミステリー', '雨の夜'].map((tag) => (
                <span key={tag} className="rounded-full border border-primary-bright/35 bg-surface-soft px-4 py-2 text-sm text-primary">
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-7 text-base leading-relaxed">閉店後の喫茶店で出会った、少し不思議な常連客。</p>

            <div className="mt-7 grid gap-3 border-t border-border/70 pt-6 text-sm">
              <p className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                このパックは安全に読み込めます
              </p>
              <p className="flex items-center gap-3 text-muted-foreground">
                <FileArchive className="size-5" aria-hidden="true" />
                shizuku.charx
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="lg" className="sm:mr-auto" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button variant="outline" size="lg" onClick={onAddToLibrary}>
            ライブラリに追加
          </Button>
          <Button size="lg" onClick={onAddAndTalk}>追加して話す</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
