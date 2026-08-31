import { useMemo } from "react"
import { Download, FileArchive, FileJson2, FlaskConical } from "lucide-react"
import { marked } from "marked"

import { AppHeader } from "@/components/ui/app-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { demoChatPack } from "@/data/demo-chat-pack"
import { cn } from "@/lib/utils"
import specMarkdown from "../../../docs/chat-pack-v0.1.md?raw"
import schemaUrl from "../../../schema/chat-pack-0.1.json?url"

export function TechDocsScreen({ onBack, onTryDemo }: { onBack: () => void; onTryDemo: () => void }) {
  const schemaHref = window.location.protocol === "file:" ? schemaUrl : "/schema/chat-pack-0.1.json"
  const renderedSpec = useMemo(
    () => marked.parse(specMarkdown.replace("../schema/chat-pack-0.1.json", schemaHref), { async: false }) as string,
    [schemaHref],
  )

  return (
    <main className="grid h-screen grid-rows-[80px_minmax(0,1fr)] overflow-hidden bg-background max-md:h-dvh max-md:grid-rows-[64px_minmax(0,1fr)]" data-testid="tech-docs-screen">
      <AppHeader
        title="技術ドキュメント"
        status="Chat Pack v0.1"
        onBack={onBack}
        actions={
          <a href={demoChatPack.url} download={demoChatPack.fileName} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "max-md:size-11 max-md:px-0")} aria-label="デモファイルをダウンロード">
            <Download />
            <span className="max-md:sr-only">デモをダウンロード</span>
          </a>
        }
      />

      <div className="grid min-h-0 grid-cols-[280px_minmax(0,1fr)] max-md:block max-md:overflow-y-auto">
        <aside className="overflow-y-auto border-r border-border/70 bg-surface-soft/55 p-6 max-md:overflow-visible max-md:border-r-0 max-md:border-b max-md:p-4">
          <div className="sticky top-0 max-md:static">
            <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Open format</p>
            <h2 className="mt-3 text-2xl leading-snug font-semibold">.mikanchat</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              シナリオ、登場人物、情景描写、音声設定を一つのファイルで持ち運べます。
            </p>

            <div className="mt-6 grid gap-3">
              <Button onClick={onTryDemo}>
                <FlaskConical />
                デモを読み込む
              </Button>
              <a href={demoChatPack.url} download={demoChatPack.fileName} className={buttonVariants({ variant: "outline" })}>
                <FileArchive />
                rainy-cafe.mikanchat
              </a>
              <a href={schemaHref} download="chat-pack-0.1.json" className={buttonVariants({ variant: "outline" })}>
                <FileJson2 />
                JSON Schema
              </a>
            </div>

            <dl className="mt-7 grid gap-3 border-t border-border/70 pt-5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-semibold">Draft</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Spec</dt>
                <dd className="font-semibold">0.1</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Container</dt>
                <dd className="font-semibold">ZIP</dd>
              </div>
            </dl>
          </div>
        </aside>

        <section className="min-w-0 overflow-y-auto px-12 py-10 max-md:overflow-visible max-md:px-4 max-md:py-7">
          <article
            className="technical-document mx-auto max-w-[900px]"
            dangerouslySetInnerHTML={{ __html: renderedSpec }}
          />
        </section>
      </div>
    </main>
  )
}
