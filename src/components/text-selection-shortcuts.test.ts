import { describe, expect, it } from "vitest"
import {
  isSelectableInputType,
  isTextSelectionShortcut,
  type TextSelectionShortcut,
} from "./text-selection-shortcuts"

function createShortcut(
  overrides: Partial<TextSelectionShortcut> = {},
): TextSelectionShortcut {
  return {
    key: "a",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...overrides,
  }
}

describe("text selection shortcuts", () => {
  it("accepts Ctrl+A and Command+A independently", () => {
    expect(isTextSelectionShortcut(createShortcut({ ctrlKey: true }))).toBe(true)
    expect(isTextSelectionShortcut(createShortcut({ key: "A", metaKey: true }))).toBe(
      true,
    )
  })

  it("rejects conflicting modifiers and composition input", () => {
    expect(
      isTextSelectionShortcut(createShortcut({ ctrlKey: true, metaKey: true })),
    ).toBe(false)
    expect(
      isTextSelectionShortcut(createShortcut({ ctrlKey: true, altKey: true })),
    ).toBe(false)
    expect(
      isTextSelectionShortcut(createShortcut({ metaKey: true, shiftKey: true })),
    ).toBe(false)
    expect(
      isTextSelectionShortcut(createShortcut({ ctrlKey: true, isComposing: true })),
    ).toBe(false)
    expect(isTextSelectionShortcut(createShortcut({ key: "b", ctrlKey: true }))).toBe(
      false,
    )
  })

  it("returns false instead of throwing when the event carries no key", () => {
    // 运行时可能收到字段缺失的事件，绕过类型契约以复现真实崩溃
    const withoutKey = createShortcut({ ctrlKey: true })
    delete (withoutKey as Partial<Record<"key", string>>).key

    expect(() => isTextSelectionShortcut(withoutKey)).not.toThrow()
    expect(isTextSelectionShortcut(withoutKey)).toBe(false)
  })

  it("limits delegation to text-editable input types", () => {
    for (const type of [
      "text",
      "search",
      "email",
      "password",
      "tel",
      "url",
      "number",
    ]) {
      expect(isSelectableInputType(type), type).toBe(true)
    }
    for (const type of ["color", "file", "range", "checkbox", "radio", "button"]) {
      expect(isSelectableInputType(type), type).toBe(false)
    }
  })
})
