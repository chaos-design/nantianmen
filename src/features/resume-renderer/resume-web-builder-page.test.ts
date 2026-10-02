import { describe, expect, it, vi } from "vitest"
import {
  canShareWebPreview,
  getWebPreviewShareMessage,
  persistTemplateSidebarCollapsed,
  readTemplateSidebarCollapsed,
} from "./resume-web-builder-page"

describe("web builder share availability", () => {
  it("requires a published resume outside Preview mode", () => {
    expect(canShareWebPreview(false, true)).toBe(true)
    expect(canShareWebPreview(false, false)).toBe(false)
    expect(canShareWebPreview(true, true)).toBe(false)
  })

  it("explains why sharing is unavailable", () => {
    expect(getWebPreviewShareMessage(true, true)).toBe(
      "Preview 只读模式不支持生成分享链接",
    )
    expect(getWebPreviewShareMessage(false, false)).toBe("请先返回编辑器发布后再分享")
    expect(getWebPreviewShareMessage(false, true)).toBe("分享内容来自最近发布版本")
  })
})

describe("web builder template sidebar preference", () => {
  it("reads the persisted collapsed state", () => {
    const getItem = vi.fn(() => "true")

    expect(readTemplateSidebarCollapsed({ getItem })).toBe(true)
    expect(getItem).toHaveBeenCalledWith(
      "resume-web-builder:template-sidebar-collapsed",
    )
  })

  it("defaults to expanded for missing or invalid values", () => {
    expect(readTemplateSidebarCollapsed(null)).toBe(false)
    expect(readTemplateSidebarCollapsed({ getItem: () => null })).toBe(false)
    expect(readTemplateSidebarCollapsed({ getItem: () => "1" })).toBe(false)
  })

  it("defaults to expanded when storage cannot be read", () => {
    expect(
      readTemplateSidebarCollapsed({
        getItem: () => {
          throw new Error("storage unavailable")
        },
      }),
    ).toBe(false)
  })

  it("persists the collapsed state", () => {
    const setItem = vi.fn()

    expect(persistTemplateSidebarCollapsed({ setItem }, true)).toBe(true)
    expect(setItem).toHaveBeenCalledWith(
      "resume-web-builder:template-sidebar-collapsed",
      "true",
    )
  })

  it("reports a failed persistence attempt without throwing", () => {
    expect(
      persistTemplateSidebarCollapsed(
        {
          setItem: () => {
            throw new Error("storage unavailable")
          },
        },
        true,
      ),
    ).toBe(false)
  })
})
