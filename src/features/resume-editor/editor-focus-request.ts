import type { AiContentSuggestion } from "../../shared/resume-ai/resume-ai-contract"
import type { ResumeLinkTarget } from "../../shared/resume-schema/resume-link-target"
import type { ResumeDocument } from "../../shared/resume-schema/resume-schema"

export interface EditorFocusRequest {
  id: number
  sectionId: string
  itemId: string | null
  linkedTarget: ResumeLinkTarget
  /**
   * 仅定位、不写入时为 true。表单侧据此保持区块折叠，
   * 避免「查看建议」意外改变用户的编辑状态。
   */
  revealOnly?: boolean
}

/** 按需定位：跳到目标条目并高亮，不修改文档。 */
export function locateSuggestionTarget(
  document: ResumeDocument,
  suggestion: AiContentSuggestion,
): { sectionId: string; itemId: string | null; linkedTarget: ResumeLinkTarget } | null {
  const { sectionId, itemId } = suggestion.target
  if (!sectionId || !itemId) {
    return document.profile.summary
      ? { sectionId: "profile", itemId: null, linkedTarget: { kind: "profile" } }
      : null
  }
  const section = document.sections.find((entry) => entry.id === sectionId)
  if (!section?.items.some((item) => item.id === itemId)) {
    return null
  }
  return {
    sectionId,
    itemId,
    linkedTarget: { kind: "item", sectionId, itemId },
  }
}
