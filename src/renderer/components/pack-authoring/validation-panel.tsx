import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react"

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

export type ValidationCheck = {
  section: string
  ok: boolean
  optional?: boolean
}

export function ValidationPanel({
  checks,
  issues,
  checking,
}: {
  checks: ValidationCheck[]
  issues: PackValidationIssue[]
  checking: boolean
}) {
  const general = issues.filter((issue) => sectionOf(issue.path) === "全体")
  return (
    <section className="grid gap-3 rounded-xl border border-border bg-surface p-4" aria-label="検証結果" aria-live="polite">
      <SectionHeading>検証結果</SectionHeading>
      {checking ? <p className="text-sm text-muted-foreground" role="status">確認しています…</p> : null}
      <ul className="grid gap-2">
        {checks.map((check) => {
          const messages = issues.filter((issue) => sectionOf(issue.path) === check.section)
          return (
            <li key={check.section} className="flex items-start gap-2 text-sm">
              {check.ok && messages.length === 0 ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              ) : !check.ok && messages.length === 0 && check.optional ? (
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              )}
              <span>
                <span className="font-semibold">{check.section}</span>
                {messages.length > 0 ? (
                  <span className="text-muted-foreground">：{messages.map((issue) => issue.message).join("／")}</span>
                ) : check.ok ? null : check.optional ? (
                  <span className="text-muted-foreground">：なくても配布できます</span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
      {general.length > 0 ? (
        <ul className="grid gap-2 border-t border-border/70 pt-2">
          {general.map((issue, index) => (
            <li key={`general-${index}`} className="flex items-start gap-2 text-sm">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <span className="text-muted-foreground">{issue.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
