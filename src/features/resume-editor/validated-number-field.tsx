"use client"

import { useEffect, useRef, useState } from "react"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "../../components/ui/field"
import { Input } from "../../components/ui/input"

interface NumberDraftOptions {
  label: string
  min: number
  max: number
  step?: number | "any"
  integer?: boolean
  allowEmpty?: boolean
}

type NumberDraftResult =
  | { value: number | null; error: null }
  | { value: null; error: string }

export function validateNumberDraft(
  draft: string,
  {
    label,
    min,
    max,
    step = "any",
    integer = false,
    allowEmpty = false,
  }: NumberDraftOptions,
): NumberDraftResult {
  const normalized = draft.trim()
  if (normalized === "") {
    return allowEmpty
      ? { value: null, error: null }
      : { value: null, error: `请输入${label}` }
  }

  const value = Number(normalized)
  if (!Number.isFinite(value)) {
    return { value: null, error: `请输入有效的${label}` }
  }
  if (integer && !Number.isInteger(value)) {
    return { value: null, error: `${label}必须为整数` }
  }
  if (value < min) {
    return { value: null, error: `${label}不能小于 ${min}` }
  }
  if (value > max) {
    return { value: null, error: `${label}不能大于 ${max}` }
  }

  if (
    typeof step === "number" &&
    step > 0 &&
    Math.abs((value - min) / step - Math.round((value - min) / step)) >
      Number.EPSILON * 100
  ) {
    return { value: null, error: `${label}必须以 ${step} 为步长` }
  }

  return { value, error: null }
}

interface ValidatedNumberFieldProps extends NumberDraftOptions {
  id: string
  value: number | null
  suffix?: string
  description?: string
  onChange: (value: number | null) => void
}

export function ValidatedNumberField({
  id,
  label,
  value,
  min,
  max,
  step = "any",
  suffix,
  description,
  integer = false,
  allowEmpty = false,
  onChange,
}: ValidatedNumberFieldProps) {
  const [draft, setDraft] = useState(value === null ? "" : String(value))
  const [error, setError] = useState<string | null>(null)
  const editingRef = useRef(false)

  useEffect(() => {
    if (!editingRef.current) {
      setDraft(value === null ? "" : String(value))
      setError(null)
    }
  }, [value])

  function commitDraft() {
    editingRef.current = false
    const result = validateNumberDraft(draft, {
      label,
      min,
      max,
      step,
      integer,
      allowEmpty,
    })
    setError(result.error)
    if (!result.error && result.value !== value) {
      onChange(result.value)
    }
  }

  const input = (
    <Input
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      aria-invalid={Boolean(error)}
      onBlur={commitDraft}
      onFocus={() => {
        editingRef.current = true
      }}
      onChange={(event) => {
        setDraft(event.target.value)
        setError(null)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur()
        }
      }}
    />
  )

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {suffix ? (
        <div className="style-number-control">
          {input}
          <span>{suffix}</span>
        </div>
      ) : (
        input
      )}
      {description && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}
