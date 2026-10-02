"use client"

import { useEffect } from "react"

const selectableInputTypes = new Set([
  "email",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "url",
])

export type TextSelectionShortcut = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing"
>

export function isTextSelectionShortcut(event: TextSelectionShortcut): boolean {
  if (typeof event.key !== "string") {
    return false
  }
  const primaryModifierCount = Number(event.ctrlKey) + Number(event.metaKey)
  return (
    event.key.toLowerCase() === "a" &&
    primaryModifierCount === 1 &&
    !event.altKey &&
    !event.shiftKey &&
    !event.isComposing
  )
}

export function isSelectableInputType(type: string): boolean {
  return selectableInputTypes.has(type.toLowerCase())
}

function isSelectableTextControl(
  target: EventTarget | null,
): target is HTMLInputElement | HTMLTextAreaElement {
  if (!(target instanceof Element) || target.closest(".monaco-editor")) {
    return false
  }
  if (target instanceof HTMLTextAreaElement) {
    return !target.disabled
  }
  return (
    target instanceof HTMLInputElement &&
    !target.disabled &&
    isSelectableInputType(target.type)
  )
}

export function TextSelectionShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTextSelectionShortcut(event) || !isSelectableTextControl(event.target)) {
        return
      }
      event.preventDefault()
      event.target.select()
    }

    document.addEventListener("keydown", handleKeyDown, true)
    return () => document.removeEventListener("keydown", handleKeyDown, true)
  }, [])

  return null
}
