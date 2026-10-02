import { describe, expect, it } from "vitest"
import type { AiContentSuggestion } from "../../shared/resume-ai/resume-ai-contract"
import {
  createResumeDocument,
  resumeEditableFieldLimits,
} from "../../shared/resume-schema/resume-schema"
import { applyAiSuggestion } from "./apply-ai-suggestion"

describe("apply AI suggestion", () => {
  it("updates the exact item highlight without changing another item", () => {
    const document = createResumeDocument()
    const section = document.sections[0]
    const firstItem = section.items[0]
    const targetItem = section.items[1]
    const original = targetItem.highlights[1]
    const suggestion: AiContentSuggestion = {
      id: "suggestion-1",
      target: {
        sectionId: section.id,
        itemId: targetItem.id,
        field: "highlight",
        index: 1,
      },
      original,
      revised: "通过字段级定位安全更新第二段经历的成果表达。",
      rationale: "明确动作和结果。",
    }

    const result = applyAiSuggestion(document, suggestion)

    expect(result?.document.sections[0].items[1].highlights[1]).toBe(suggestion.revised)
    expect(result?.document.sections[0].items[0]).toEqual(firstItem)
    expect(result).toMatchObject({
      label: `工作经历 / ${targetItem.title} / 亮点`,
      sectionId: section.id,
      itemId: targetItem.id,
      linkedTarget: {
        kind: "item",
        sectionId: section.id,
        itemId: targetItem.id,
      },
    })
  })

  it("updates the profile summary through the explicit profile target", () => {
    const document = createResumeDocument()
    const suggestion: AiContentSuggestion = {
      id: "suggestion-2",
      target: {
        sectionId: null,
        itemId: null,
        field: "summary",
        index: null,
      },
      original: document.profile.summary,
      revised: "聚焦企业级前端架构、工程效能与可量化交付结果。",
      rationale: "压缩背景并突出核心价值。",
    }

    const result = applyAiSuggestion(document, suggestion)

    expect(result?.document.profile.summary).toBe(suggestion.revised)
    expect(result).toMatchObject({
      label: "个人信息 / 个人摘要",
      sectionId: "profile",
      itemId: null,
      linkedTarget: { kind: "profile" },
    })
  })

  it("rejects a rewrite that would exceed the resume field limit", () => {
    const document = createResumeDocument()
    const section = document.sections[0]
    const item = section.items[0]
    // 标题上限 120 字；超长建议来自 sessionStorage 等旁路，应用时必须挡住。
    const suggestion: AiContentSuggestion = {
      id: "suggestion-4",
      target: {
        sectionId: section.id,
        itemId: item.id,
        field: "title",
        index: null,
      },
      original: item.title,
      revised: "标".repeat(resumeEditableFieldLimits.title + 1),
      rationale: "超长改写。",
    }

    expect(applyAiSuggestion(document, suggestion)).toBeNull()
    expect(document.sections[0].items[0].title).toBe(item.title)
  })

  it("rejects a stale suggestion without modifying the document", () => {
    const document = createResumeDocument()
    const section = document.sections[0]
    const item = section.items[0]
    const suggestion: AiContentSuggestion = {
      id: "suggestion-3",
      target: {
        sectionId: section.id,
        itemId: item.id,
        field: "description",
        index: null,
      },
      original: "已经过期的原文",
      revised: "不应写入",
      rationale: "陈旧建议。",
    }

    expect(applyAiSuggestion(document, suggestion)).toBeNull()
  })
})
