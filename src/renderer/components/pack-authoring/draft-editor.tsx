import { useEffect, useMemo, useState } from "react"
import { Download, FlaskConical, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/ui/section-heading"
import { AiEditPanel } from "@/components/pack-authoring/ai-edit-panel"
import { ChatPreview } from "@/components/pack-authoring/chat-preview"
import { DraftBasics } from "@/components/pack-authoring/draft-basics"
import { DraftCharacters } from "@/components/pack-authoring/draft-characters"
import { DraftGuide, DraftOpening } from "@/components/pack-authoring/draft-opening"
import { DraftMedia } from "@/components/pack-authoring/draft-media"
import { ValidationPanel, type ValidationCheck } from "@/components/pack-authoring/validation-panel"
import { readBgmPreference } from "@/lib/audio-com"
import type { ConnectionSettings } from "@/components/settings/ai-connection-dialog"
import type { LoadedChatPack } from "@/lib/chat-pack"
import {
  buildPackFiles,
  exportPackBlob,
  importExportedPack,
  PackAuthoringError,
  validateBuiltPack,
  type PackValidationIssue,
} from "@/lib/pack-authoring/build"
import { saveAuthorMemory } from "@/lib/pack-authoring/storage"
import { AUTHORING_DRAFT_SCENARIO_ID, type PackDraft } from "@/lib/pack-authoring/types"

export function DraftEditor({
  draft,
  persisted,
  connection,
  onDraftChange,
  onExported,
  onImportAndTalk,
  onBack,
}: {
  draft: PackDraft
  persisted: boolean
  connection: ConnectionSettings
  onDraftChange: (draft: PackDraft) => void
  onExported: () => void
  onImportAndTalk: (loaded: LoadedChatPack) => string | undefined
  onBack: () => void
}) {
  const [issues, setIssues] = useState<PackValidationIssue[]>([{ path: "(全体)", message: "入力を始めるとここで確認できます。" }])
  const [checking, setChecking] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState("")
  const [exportError, setExportError] = useState("")

  const update = (patch: Partial<PackDraft>) => {
    const next = { ...draft, ...patch }
    saveAuthorMemory({ name: next.authorName, url: next.authorUrl, license: next.license })
    onDraftChange(next)
  }

  const draftJson = useMemo(
    () => JSON.stringify(draft, (key, value: unknown) => key === "dataUrl" ? undefined : value),
    [draft],
  )

  const checks = useMemo<ValidationCheck[]>(() => {
    const completeCharacters = draft.characters.filter((character) =>
      character.id.trim() && character.name.trim() && character.profile.trim())
    const characterSpeakers = new Set(
      draft.opening.flatMap((event) => event.type === "dialogue" && event.speaker !== "user" ? [event.speaker.trim()] : []),
    )
    return [
      { section: "基本情報", ok: Boolean(draft.title.trim() && draft.summary.trim() && draft.authorName.trim()) },
      { section: "会話の指針", ok: Boolean(draft.premise.trim()) },
      { section: "登場人物", ok: completeCharacters.length > 0 },
      {
        section: "導入",
        ok: draft.opening.length > 0 && completeCharacters.some((character) => characterSpeakers.has(character.id.trim())),
      },
      { section: "カバー画像", ok: draft.cover !== null, optional: true },
    ]
  }, [draft])

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
    onExported()
  })

  const tryExport = () => void runExport(async (blob, fileName) => {
    const problem = onImportAndTalk(await importExportedPack(blob, fileName))
    if (problem) setExportError(problem)
  })

  return (
    <div className="grid gap-8" aria-label="シナリオの編集">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={onBack}>
            置き場に戻る
          </Button>
          <SectionHeading>{draft.title.trim() || "無題の物語"}</SectionHeading>
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
          <ValidationPanel checks={checks} issues={issues} checking={checking} />
          <Button type="button" variant="outline" onClick={() => setAiPanelOpen(true)}>
            <Sparkles />AIに相談する
          </Button>
        </div>
      </div>
      {aiPanelOpen ? (
        <AiEditPanel
          draft={draft}
          connection={connection}
          onApplyPatch={(next) => onDraftChange(next)}
          onClose={() => setAiPanelOpen(false)}
        />
      ) : null}
    </div>
  )
}
