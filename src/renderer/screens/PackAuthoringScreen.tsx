import { useEffect, useMemo, useState } from "react"
import { Download, FlaskConical } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/ui/section-heading"
import { ChatPreview } from "@/components/pack-authoring/chat-preview"
import { DraftBasics } from "@/components/pack-authoring/draft-basics"
import { DraftCharacters } from "@/components/pack-authoring/draft-characters"
import { DraftGuide, DraftOpening } from "@/components/pack-authoring/draft-opening"
import { DraftMedia } from "@/components/pack-authoring/draft-media"
import { ValidationPanel } from "@/components/pack-authoring/validation-panel"
import { readBgmPreference } from "@/lib/audio-com"
import {
  buildPackFiles,
  exportPackBlob,
  importExportedPack,
  PackAuthoringError,
  validateBuiltPack,
  type PackValidationIssue,
} from "@/lib/pack-authoring/build"
import { loadAuthoringDraft, saveAuthoringDraft } from "@/lib/pack-authoring/storage"
import { AUTHORING_DRAFT_SCENARIO_ID, type PackDraft } from "@/lib/pack-authoring/types"
import type { LoadedChatPack } from "@/lib/chat-pack"

export function PackAuthoringScreen({
  onBack,
  onImportAndTalk,
}: {
  onBack: () => void
  onImportAndTalk: (loaded: LoadedChatPack) => string | undefined
}) {
  const [draft, setDraft] = useState<PackDraft>(() => loadAuthoringDraft())
  const [persisted, setPersisted] = useState(true)
  const [issues, setIssues] = useState<PackValidationIssue[]>([{ path: "(全体)", message: "入力を始めるとここで確認できます。" }])
  const [checking, setChecking] = useState(false)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState("")
  const [exportError, setExportError] = useState("")

  const update = (patch: Partial<PackDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch }
      setPersisted(saveAuthoringDraft(next))
      return next
    })
  }

  // 素材のdataUrlは除外する（数MBの文字列化を毎回回さない＋容量変化は検知する）。
  const draftJson = useMemo(
    () => JSON.stringify(draft, (key, value: unknown) => key === "dataUrl" ? undefined : value),
    [draft],
  )

  useEffect(() => {
    setChecking(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { pack, files } = await buildPackFiles(draft, readBgmPreference(AUTHORING_DRAFT_SCENARIO_ID))
          validateBuiltPack(pack, files)
          setIssues([])
        } catch (cause) {
          if (cause instanceof PackAuthoringError) {
            const issues = (cause as { issues?: PackValidationIssue[] }).issues
            setIssues(issues ?? [{ path: "(全体)", message: cause.message }])
          } else {
            setIssues([{ path: "(全体)", message: "確認中にエラーが起きました。" }])
          }
        } finally {
          setChecking(false)
        }
      })()
    }, 400)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftJson])

  const runExport = async (afterExport: (blob: Blob, fileName: string) => void | Promise<void>) => {
    setWorking(true)
    setExportError("")
    setNotice("")
    try {
      const { blob, fileName } = await exportPackBlob(draft, readBgmPreference(AUTHORING_DRAFT_SCENARIO_ID))
      await afterExport(blob, fileName)
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "エクスポートできませんでした。")
    } finally {
      setWorking(false)
    }
  }

  const downloadExport = () => void runExport((blob, fileName) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setNotice(`${fileName} を保存しました。配って遊べます。`)
  })

  const tryExport = () => void runExport(async (blob, fileName) => {
    const problem = onImportAndTalk(await importExportedPack(blob, fileName))
    if (problem) setExportError(problem)
  })

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-8 max-md:px-4" aria-label="シナリオをつくる">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={onBack}>
            戻る
          </Button>
          <SectionHeading>シナリオをつくる</SectionHeading>
          <p className="text-sm leading-relaxed text-muted-foreground">
            左のプレビューがそのまま会話画面になります。画像と名前はプレビューから直接設定できます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={working || issues.length > 0} onClick={tryExport}>
            <FlaskConical />取り込んで試す
          </Button>
          <Button type="button" disabled={working || issues.length > 0} onClick={downloadExport}>
            <Download />エクスポート
          </Button>
        </div>
      </div>

      {!persisted ? (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground" role="status">
          素材が大きく下書きを端末に残せませんでした。このまま続けてエクスポートできます。
        </p>
      ) : null}
      {notice ? <p className="text-sm font-medium text-success" role="status">{notice}</p> : null}
      {exportError ? <p className="text-sm text-danger" role="alert">{exportError}</p> : null}

      <ChatPreview draft={draft} onChange={update} />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-10">
          <DraftBasics draft={draft} onChange={update} />
          <DraftCharacters characters={draft.characters} onChange={(characters) => update({ characters })} />
          <DraftOpening opening={draft.opening} characters={draft.characters} onChange={(opening) => update({ opening })} />
          <DraftGuide premise={draft.premise} instructions={draft.instructions} onChange={update} />
          <DraftMedia />
        </div>
        <div className="grid gap-4 lg:sticky lg:top-4">
          <ValidationPanel issues={issues} checking={checking} />
        </div>
      </div>
    </main>
  )
}
