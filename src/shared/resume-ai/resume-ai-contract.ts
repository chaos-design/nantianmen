import { z } from "zod"
import {
  type ResumeEditableField,
  resumeEditableFieldLimits,
} from "../resume-schema/resume-schema"
import {
  aiInterviewQuestionLimit,
  aiPromptGuidanceSchema,
} from "./resume-ai-prompt-text"

export const aiTasks = ["improve-content", "interview-questions"] as const

export const aiProviderConfigSchema = z
  .object({
    modelName: z.string().trim().min(1).max(160),
    baseUrl: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .url()
      .refine((value) => {
        try {
          const protocol = new URL(value).protocol
          return protocol === "http:" || protocol === "https:"
        } catch {
          return false
        }
      }),
    apiKey: z.string().trim().min(1).max(1000),
  })
  .strict()

export const aiTaskSchema = z
  .object({
    task: z.enum(aiTasks),
    targetSectionId: z.string().min(1).nullable().optional(),
    document: z.unknown(),
    providerConfig: aiProviderConfigSchema,
    /**
     * 用户自定义导引，仅覆盖偏好部分。
     * 输出结构等服务端强校验的约束不在此处，永远由服务端拼接。
     */
    promptGuidance: aiPromptGuidanceSchema.optional(),
  })
  .strict()

export const aiConnectionTestSchema = z
  .object({
    providerConfig: aiProviderConfigSchema,
  })
  .strict()

export const aiSuggestionFields = [
  "summary",
  "title",
  "subtitle",
  "description",
  "highlight",
] as const

export const aiSuggestionTargetSchema = z
  .object({
    sectionId: z.string().min(1).nullable(),
    itemId: z.string().min(1).nullable(),
    field: z.enum(aiSuggestionFields),
    index: z.number().int().min(0).max(19).nullable(),
  })
  .strict()

/** 单次请求最多覆盖的优化单元数量，每个单元恰好对应一个简历条目。 */
export const aiContentUnitLimit = 10

/**
 * 按简历 Schema 的真实上限收紧 Provider 输出。
 * 这里不能用统一的 4000：标题上限 120、副标题 160、成果要点 500，
 * 放行超长文本会让建议在写入草稿时才被简历 Schema 拒绝，把文档改坏。
 */
function createRevisedSchema(field: ResumeEditableField) {
  return z.string().trim().min(1).max(resumeEditableFieldLimits[field])
}

/** Provider 侧的字段枚举按名称逐个绑定长度上限。 */
const providerSuggestionShape = {
  unitId: z.string().trim().min(1).max(200),
  index: z.number().int().min(0).max(19).nullable(),
  original: z.string().max(resumeEditableFieldLimits.description),
  rationale: z.string().trim().min(1).max(300),
}

/**
 * Provider 侧建议只声明所属单元和目标字段，sectionId 与 itemId 由服务端按单元回填。
 * 这样模型不需要逐字复制定位信息，定位错误由服务端结构消除。
 */
const providerContentSuggestionSchema = z
  .object({
    ...providerSuggestionShape,
    field: z.literal("summary"),
    revised: createRevisedSchema("summary"),
  })
  .strict()
  .or(
    z
      .object({
        ...providerSuggestionShape,
        field: z.literal("title"),
        revised: createRevisedSchema("title"),
      })
      .strict(),
  )
  .or(
    z
      .object({
        ...providerSuggestionShape,
        field: z.literal("subtitle"),
        revised: createRevisedSchema("subtitle"),
      })
      .strict(),
  )
  .or(
    z
      .object({
        ...providerSuggestionShape,
        field: z.literal("description"),
        revised: createRevisedSchema("description"),
      })
      .strict(),
  )
  .or(
    z
      .object({
        ...providerSuggestionShape,
        field: z.literal("highlight"),
        revised: createRevisedSchema("highlight"),
      })
      .strict(),
  )

const contentSuggestionSchema = z
  .object({
    id: z.string().min(1),
    target: aiSuggestionTargetSchema,
    original: z.string().max(4000),
    revised: z.string().trim().min(1).max(4000),
    rationale: z.string().trim().min(1).max(300),
  })
  .strict()

export const aiQuestionCategories = [
  "项目背景",
  "技术深度",
  "指标与影响",
  "协作沟通",
  "风险与复盘",
] as const

const providerInterviewQuestionSchema = z
  .object({
    category: z.enum(aiQuestionCategories),
    question: z.string().trim().min(1).max(500),
    answerDirection: z.string().trim().min(1).max(1000),
    keyPoints: z.array(z.string().trim().min(1).max(120)).min(2).max(4),
    suggestedAnswer: z.string().trim().min(1).max(1500),
    difficulty: z.enum(["基础", "进阶", "深入"]),
    relatedItemId: z.string().min(1).nullable(),
  })
  .strict()

const interviewQuestionSchema = providerInterviewQuestionSchema.extend({
  id: z.string().min(1),
})

export const aiProviderOutputSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("improve-content"),
      suggestions: z.array(providerContentSuggestionSchema).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("interview-questions"),
      disclaimer: z.string().trim().min(1).max(500),
      questions: z
        .array(providerInterviewQuestionSchema)
        .min(1)
        .max(aiInterviewQuestionLimit),
    })
    .strict(),
])

export const aiOutputSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("improve-content"),
      suggestions: z.array(contentSuggestionSchema).min(1).max(aiContentUnitLimit),
    })
    .strict(),
  z
    .object({
      type: z.literal("interview-questions"),
      disclaimer: z.string().trim().min(1).max(500),
      questions: z.array(interviewQuestionSchema).min(1).max(aiInterviewQuestionLimit),
    })
    .strict(),
])

export type AiTask = z.infer<typeof aiTaskSchema>["task"]
export type AiProviderConfig = z.infer<typeof aiProviderConfigSchema>
export type AiSuggestionTarget = z.infer<typeof aiSuggestionTargetSchema>
export type AiSuggestionField = z.infer<typeof aiSuggestionTargetSchema>["field"]
export type AiProviderOutput = z.infer<typeof aiProviderOutputSchema>
export type AiOutput = z.infer<typeof aiOutputSchema>
export type AiContentSuggestion = Extract<
  AiOutput,
  { type: "improve-content" }
>["suggestions"][number]
