import type { AiSuggestionField } from "../../../shared/resume-ai/resume-ai-contract"
import { composeAiSystemPrompt } from "../../../shared/resume-ai/resume-ai-prompt-text"

export interface AiChatMessage {
  /** assistant 仅用于结构纠正时把模型上一次的原始输出回传。 */
  role: "system" | "user" | "assistant"
  content: string
}

export interface AiContentField {
  field: AiSuggestionField
  index: number | null
  original: string
}

/**
 * 一个优化单元等价于一个简历条目：模型对每个单元独立给出至多一条建议，
 * 单元之间互不影响，sectionId 与 itemId 由服务端按 unitId 回填。
 */
export interface AiContentUnit {
  unitId: string
  label: string
  context: {
    itemTitle: string
    itemSubtitle: string
  } | null
  fields: AiContentField[]
}

export interface AiInterviewItem {
  sectionId: string
  sectionTitle: string
  itemId: string
  title: string
  subtitle: string
  description: string
  highlights: string[]
}

export function createContentImprovementMessages(
  units: AiContentUnit[],
  guidance?: string | null,
): AiChatMessage[] {
  return [
    {
      role: "system",
      content: composeAiSystemPrompt("improve-content", guidance),
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "improve-content",
        units,
      }),
    },
  ]
}

export function createInterviewQuestionMessages(
  items: AiInterviewItem[],
  guidance?: string | null,
): AiChatMessage[] {
  return [
    {
      role: "system",
      content: composeAiSystemPrompt("interview-questions", guidance),
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "interview-questions",
        experiences: items,
      }),
    },
  ]
}
