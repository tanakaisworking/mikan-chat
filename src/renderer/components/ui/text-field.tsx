import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type TextFieldProps = ComponentProps<"input"> & {
  label: string
  description?: ReactNode
  error?: string
}

export function TextField({
  id,
  label,
  description,
  error,
  className,
  ...props
}: TextFieldProps) {
  const fieldId = id ?? props.name
  const descriptionId = fieldId ? `${fieldId}-description` : undefined
  const errorId = fieldId ? `${fieldId}-error` : undefined

  return (
    <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor={fieldId}>
      <span>{label}</span>
      <input
        id={fieldId}
        aria-describedby={error ? errorId : description ? descriptionId : undefined}
        aria-invalid={Boolean(error)}
        className={cn(
          "h-12 rounded-md border border-input bg-surface px-4 text-base text-foreground shadow-soft outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15 aria-invalid:border-danger",
          className,
        )}
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
