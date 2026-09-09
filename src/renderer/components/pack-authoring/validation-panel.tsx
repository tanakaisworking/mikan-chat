import { CircleAlert, CircleCheck } from "lucide-react"

import { SectionHeading } from "@/components/ui/section-heading"
import type { PackValidationIssue } from "@/lib/pack-authoring/build"

function sectionOf(path: string) {
  if (path.startsWith("title") || path.startsWith("summary") || path.startsWith("author") || path.startsWith("license") || path.startsWith("rating") || path.startsWith("discovery")) return "基本情報"
  if (path.startsWith("plot.premise") || path.startsWith("plot.instructions")) return "会話の指針"
  if (path.startsWith("plot.characters")) return "登場人物"
  if (path.startsWith("plot.opening")) return "導入"
  if (path.startsWith("plot")) return "会話の指針"
  return "全体"
}

export function ValidationPanel({ issues, checking }: { issues: PackValidationIssue[]; checking: boolean }) {
  return (
    <section className="grid gap-3 rounded-xl border border-border bg-surface p-4" aria-label="検証結果" aria-live="polite">
      <SectionHeading>検証結果</SectionHeading>
      {checking ? (
        <p className="text-sm text-muted-foreground" role="status">確認しています…</p>
      ) : issues.length === 0 ? (
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
          配布できます。エクスポートしてお届けしましょう。
        </p>
      ) : (
        <ul className="grid gap-2">
          {issues.map((issue, index) => (
            <li key={`${issue.path}-${index}`} className="flex items-start gap-2 text-sm">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <span>
                <span className="font-semibold">{sectionOf(issue.path)}</span>
                <span className="text-muted-foreground">：{issue.message}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
