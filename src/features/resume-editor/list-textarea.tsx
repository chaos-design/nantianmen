"use client"

import { type ComponentProps, useEffect, useRef, useState } from "react"
import { Textarea } from "../../components/ui/textarea"

export type ListTextareaMode = "comma-or-newline" | "newline"

interface ListTextareaProps
  extends Omit<ComponentProps<typeof Textarea>, "defaultValue" | "onChange" | "value"> {
  mode: ListTextareaMode
  value: string[]
  onChange: (value: string[]) => void
}

export function parseListText(value: string, mode: ListTextareaMode): string[] {
  const separator = mode === "comma-or-newline" ? /[,，\n]/ : /\n/
  return value
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function formatListText(value: string[], mode: ListTextareaMode): string {
  return value.join(mode === "comma-or-newline" ? ", " : "\n")
}

function getValueSignature(value: string[]): string {
  return JSON.stringify(value)
}

export function ListTextarea({ mode, value, onChange, ...props }: ListTextareaProps) {
  const valueSignature = getValueSignature(value)
  const formattedValue = formatListText(value, mode)
  const [draft, setDraft] = useState(formattedValue)
  const committedSignatureRef = useRef(valueSignature)

  useEffect(() => {
    if (valueSignature === committedSignatureRef.current) {
      return
    }
    committedSignatureRef.current = valueSignature
    setDraft(formattedValue)
  }, [formattedValue, valueSignature])

  return (
    <Textarea
      {...props}
      value={draft}
      onChange={(event) => {
        const nextDraft = event.target.value
        const nextValue = parseListText(nextDraft, mode)
        setDraft(nextDraft)
        committedSignatureRef.current = getValueSignature(nextValue)
        onChange(nextValue)
      }}
    />
  )
}
