import { useEffect, useState } from "react"

import { TextField } from "@/components/ui/text-field"

const MIN_BIRTH_YEAR = 1900
const CURRENT_YEAR = new Date().getFullYear()

type BirthYearFieldProps = {
  id: string
  value: number | null
  onChange: (year: number) => void
  onValidityChange?: (valid: boolean) => void
}

function parseBirthYear(value: string) {
  if (!/^\d{4}$/.test(value)) return null
  const year = Number(value)
  return year >= MIN_BIRTH_YEAR && year <= CURRENT_YEAR ? year : null
}

export function BirthYearField({ id, value, onChange, onValidityChange }: BirthYearFieldProps) {
  const [draft, setDraft] = useState(value?.toString() ?? "")
  const parsedYear = parseBirthYear(draft)
  const error = draft.length === 4 && !parsedYear
    ? `${MIN_BIRTH_YEAR}〜${CURRENT_YEAR}年の範囲で入力してください。`
    : undefined

  useEffect(() => {
    setDraft(value?.toString() ?? "")
  }, [value])

  return (
    <TextField
      id={id}
      label="生年"
      aria-label="生年"
      value={draft}
      inputMode="numeric"
      autoComplete="bday-year"
      maxLength={4}
      placeholder="例：1998"
      error={error}
      description="西暦4桁で入力してください。"
      onChange={(event) => {
        const next = event.target.value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
        if (!/^\d{0,4}$/.test(next)) return
        setDraft(next)
        const year = parseBirthYear(next)
        onValidityChange?.(Boolean(year))
        if (year) onChange(year)
      }}
      onBlur={() => {
        if (parsedYear) return
        setDraft(value?.toString() ?? "")
        onValidityChange?.(Boolean(value))
      }}
    />
  )
}
