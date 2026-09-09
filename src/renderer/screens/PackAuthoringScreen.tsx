import { useState } from "react"
import { useLocation } from "react-router"

import { SectionHeading } from "@/components/ui/section-heading"
import { AiDraftDialog } from "@/components/pack-authoring/ai-draft-dialog"
import { DraftEditor } from "@/components/pack-authoring/draft-editor"
import { PackLibrary } from "@/components/pack-authoring/pack-library"
import { readBgmPreference } from "@/lib/audio-com"
import type { ConnectionSettings } from "@/components/settings/ai-connection-dialog"
import type { LoadedChatPack } from "@/lib/chat-pack"
import { aiDraftToNewDraft, parseAiScenario } from "@/lib/pack-authoring/ai-draft"
import { exportPackBlob, importExportedPack } from "@/lib/pack-authoring/build"
import {
  createLibraryEntry,
  loadLibrary,
  readAuthorMemory,
  saveAuthorMemory,
  saveLibrary,
  type DraftEntry,
} from "@/lib/pack-authoring/storage"
import { AUTHORING_DRAFT_SCENARIO_ID, assignCharacterId, createEmptyDraft, type PackDraft } from "@/lib/pack-authoring/types"

export function PackAuthoringScreen({
  connection,
  onImportAndTalk,
}: {
  connection: ConnectionSettings
  onImportAndTalk: (loaded: LoadedChatPack) => string | undefined
}) {
  const location = useLocation()
  const [entries, setEntries] = useState<DraftEntry[]>(() => loadLibrary())
  const [persisted, setPersisted] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(
    () => (location.state as { editId?: string } | null)?.editId ?? null,
  )
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const [actionError, setActionError] = useState("")
  const [aiDialogOpen, setAiDialogOpen] = useState(false)

  const persist = (next: DraftEntry[]) => {
    setEntries(next)
    setPersisted(saveLibrary(next))
  }

  const withAuthorMemory = (draft: PackDraft) => {
    const memory = readAuthorMemory()
    return {
      ...draft,
      authorName: draft.authorName || memory.name,
      authorUrl: draft.authorUrl || memory.url,
      license: draft.license === "All-Rights-Reserved" && memory.license !== "All-Rights-Reserved" ? memory.license : draft.license,
    }
  }

  const normalizeIds = (draft: PackDraft) => {
    if (!draft.characters.some((character) => !character.id.trim())) return draft
    const assigned: PackDraft["characters"] = []
    for (const character of draft.characters) {
      assigned.push(character.id.trim() ? character : { ...character, id: assignCharacterId(assigned) })
    }
    return { ...draft, characters: assigned }
  }

  const activeEntry = entries.find((entry) => entry.id === activeId) ?? null

  const handleNew = () => {
    const entry = createLibraryEntry(withAuthorMemory(normalizeIds(createEmptyDraft())))
    persist([entry, ...entries])
    setNotice("")
    setActionError("")
    setActiveId(entry.id)
  }

  const handleAiApply = (markdown: string) => {
    const entry = createLibraryEntry(withAuthorMemory(normalizeIds(aiDraftToNewDraft(parseAiScenario(markdown), createEmptyDraft()))))
    persist([entry, ...entries])
    setNotice("")
    setActionError("")
    setAiDialogOpen(false)
    setActiveId(entry.id)
  }

  const handleDraftChange = (id: string, next: PackDraft) => {
    saveAuthorMemory({ name: next.authorName, url: next.authorUrl, license: next.license })
    persist(entries.map((entry) => entry.id === id
      ? { ...entry, updatedAt: new Date().toISOString(), status: "draft" as const, draft: next }
      : entry))
  }
  const handleDuplicate = (id: string) => {
    const source = entries.find((entry) => entry.id === id)
    if (!source) return
    const title = source.draft.title.trim()
    const entry = createLibraryEntry({
      ...structuredClone(source.draft),
      title: title ? `${title} のコピー` : "",
    })
    persist([entry, ...entries])
    setNotice("複製しました。")
    setActionError("")
  }

  const handleDelete = (id: string) => {
    persist(entries.filter((entry) => entry.id !== id))
    if (activeId === id) setActiveId(null)
    setNotice("")
    setActionError("")
  }

  const runEntryExport = async (id: string, afterExport: (blob: Blob, fileName: string) => void | Promise<void>) => {
    const entry = entries.find((item) => item.id === id)
    if (!entry) return
    setWorkingId(id)
    setNotice("")
    setActionError("")
    try {
      const { blob, fileName } = await exportPackBlob(entry.draft, readBgmPreference(AUTHORING_DRAFT_SCENARIO_ID))
      await afterExport(blob, fileName)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "エクスポートできませんでした。")
    } finally {
      setWorkingId(null)
    }
  }

  const handleExport = (id: string) => void runEntryExport(id, (blob, fileName) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    persist(entries.map((entry) => entry.id === id ? { ...entry, status: "done" as const } : entry))
    setActiveId(null)
    setNotice("完成にしました。置き場からいつでも配れます。")
  })

  const handleTry = (id: string) => void runEntryExport(id, async (blob, fileName) => {
    const problem = onImportAndTalk(await importExportedPack(blob, fileName))
    if (problem) setActionError(problem)
  })

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-8 max-md:px-4" aria-label="シナリオをつくる">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <SectionHeading>シナリオをつくる</SectionHeading>
        </div>
      </div>

      {!persisted ? (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground" role="status">
          素材が大きく置き場を端末に残せませんでした。このまま続けてエクスポートできます。
        </p>
      ) : null}
      {notice ? <p className="text-sm font-medium text-success" role="status">{notice}</p> : null}
      {actionError ? <p className="text-sm text-danger" role="alert">{actionError}</p> : null}

      {activeEntry ? (
        <DraftEditor
          draft={activeEntry.draft}
          persisted={persisted}
          onDraftChange={(next) => handleDraftChange(activeEntry.id, next)}
          onExported={() => {
            persist(entries.map((entry) => entry.id === activeEntry.id ? { ...entry, status: "done" as const } : entry))
            setActiveId(null)
            setNotice("完成にしました。置き場からいつでも配れます。")
          }}
          onImportAndTalk={onImportAndTalk}
          onBack={() => setActiveId(null)}
        />
      ) : (
        <PackLibrary
          entries={entries}
          onNew={handleNew}
          onAiCreate={() => setAiDialogOpen(true)}
          onEdit={setActiveId}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onExport={handleExport}
          onTry={handleTry}
          workingId={workingId}
        />
      )}
      <AiDraftDialog
        open={aiDialogOpen}
        connection={connection}
        onOpenChange={setAiDialogOpen}
        onApply={handleAiApply}
      />
    </main>
  )
}
