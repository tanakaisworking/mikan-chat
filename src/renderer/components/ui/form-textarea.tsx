import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type FormTextareaProps = ComponentProps<"textarea"> & {
  label: string
  description?: ReactNode
  error?: string
}

export function FormTextarea({
  id,
  label,
  description,
  error,
  className,
  rows = 4,
  required,
  ...props
}: FormTextareaProps) {
  const fieldId = id ?? props.name
  const descriptionId = fieldId ? `${fieldId}-description` : undefined
  const errorId = fieldId ? `${fieldId}-error` : undefined

  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground" htmlFor={fieldId}>
      <span className={required ? "after:ml-1 after:text-danger after:content-['*']" : undefined}>{label}</span>
      <textarea
        id={fieldId}
        rows={rows}
        aria-describedby={error ? errorId : description ? descriptionId : undefined}
        aria-invalid={Boolean(error)}
        className={cn(
          "max-h-96 min-h-24 w-full min-w-0 resize-none overflow-y-auto rounded-md border border-input bg-surface px-4 py-3 text-base leading-relaxed text-foreground shadow-soft outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15 [field-sizing:content] aria-invalid:border-danger",
          className,
        )}
        required={required}
        {...props}
      />
      {description && !error ? (
        <span id={descriptionId} className="text-xs font-normal leading-relaxed text-muted-foreground">
          {description}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="text-xs font-normal text-danger">
          {error}
        </span>
      ) : null}
    </label>
  )
}
