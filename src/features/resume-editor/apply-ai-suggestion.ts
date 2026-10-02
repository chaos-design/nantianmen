import type { AiContentSuggestion } from "../../shared/resume-ai/resume-ai-contract"
import type { ResumeLinkTarget } from "../../shared/resume-schema/resume-link-target"
import {
  type ResumeDocument,
  type ResumeItem,
  resumeEditableFieldLimits,
} from "../../shared/resume-schema/resume-schema"

export interface AppliedAiSuggestion {
  document: ResumeDocument
  label: string
  sectionId: string
  itemId: string | null
  linkedTarget: ResumeLinkTarget
}

const fieldLabels: Record<AiContentSuggestion["target"]["field"], string> = {
  summary: "个人摘要",
  title: "标题",
  subtitle: "副标题",
  description: "描述",
  highlight: "亮点",
}

/**
 * 写入前再校验一次长度上限。
 * 建议可能来自 sessionStorage 恢复或旧版本会话，不经过服务端校验；
 * 超长文本一旦写入就会让整份简历违反 Schema。
 */
function exceedsFieldLimit(suggestion: AiContentSuggestion): boolean {
  const { field } = suggestion.target
  return suggestion.revised.length > resumeEditableFieldLimits[field]
}

function replaceItemField(
  item: ResumeItem,
  suggestion: AiContentSuggestion,
): ResumeItem | null {
  const { field, index } = suggestion.target
  if (field === "highlight") {
    if (index === null || item.highlights[index] !== suggestion.original) {
      return null
    }
    const highlights = [...item.highlights]
    highlights[index] = suggestion.revised
    return { ...item, highlights }
  }
  if (field === "summary" || index !== null || item[field] !== suggestion.original) {
    return null
  }
  return {
    ...item,
    [field]: suggestion.revised,
  }
}

export function applyAiSuggestion(
  document: ResumeDocument,
  suggestion: AiContentSuggestion,
): AppliedAiSuggestion | null {
  const { sectionId, itemId, field, index } = suggestion.target
  if (exceedsFieldLimit(suggestion)) {
    return null
  }
  if (field === "summary") {
    if (
      sectionId !== null ||
      itemId !== null ||
      index !== null ||
      document.profile.summary !== suggestion.original
    ) {
      return null
    }
    return {
      document: {
        ...document,
        profile: {
          ...document.profile,
          summary: suggestion.revised,
        },
      },
      label: "个人信息 / 个人摘要",
      sectionId: "profile",
      itemId: null,
      linkedTarget: { kind: "profile" },
    }
  }
  if (!sectionId || !itemId) {
    return null
  }

  const sectionIndex = document.sections.findIndex(
    (section) => section.id === sectionId,
  )
  if (sectionIndex < 0) {
    return null
  }
  const section = document.sections[sectionIndex]
  const itemIndex = section.items.findIndex((item) => item.id === itemId)
  if (itemIndex < 0) {
    return null
  }
  const item = section.items[itemIndex]
  const nextItem = replaceItemField(item, suggestion)
  if (!nextItem) {
    return null
  }

  const items = [...section.items]
  items[itemIndex] = nextItem
  const sections = [...document.sections]
  sections[sectionIndex] = { ...section, items }
  return {
    document: { ...document, sections },
    label: `${section.title} / ${item.title || `条目 ${itemIndex + 1}`} / ${fieldLabels[field]}`,
    sectionId: section.id,
    itemId: item.id,
    linkedTarget: {
      kind: "item",
      sectionId: section.id,
      itemId: item.id,
    },
  }
}
