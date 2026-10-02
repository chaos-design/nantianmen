import { randomUUID } from "node:crypto"
import type { z } from "zod"
import {
  type AiOutput,
  type AiProviderOutput,
  type AiSuggestionField,
  type AiTask,
  aiContentUnitLimit,
  aiOutputSchema,
  aiProviderOutputSchema,
} from "../../shared/resume-ai/resume-ai-contract"
import type {
  ResumeDocument,
  ResumeItem,
  ResumeSection,
} from "../../shared/resume-schema/resume-schema"
import { DomainError } from "../domain/resume-service"
import type { ResumeRepository } from "../repositories/resume-repository"
import type { AiChatClient } from "./open-ai-chat-client"
import {
  type AiChatMessage,
  type AiContentField,
  type AiContentUnit,
  type AiInterviewItem,
  createContentImprovementMessages,
  createInterviewQuestionMessages,
} from "./prompts/resume-ai-prompts"

export type {
  AiContentSuggestion,
  AiOutput,
  AiTask,
} from "../../shared/resume-ai/resume-ai-contract"

interface RateWindow {
  count: number
  expiresAt: number
}

const rateWindows = new Map<string, RateWindow>()
const maximumContextItems = 20

export function assertAiRateLimit(key: string): void {
  const now = Date.now()
  const current = rateWindows.get(key)
  if (!current || current.expiresAt <= now) {
    rateWindows.set(key, { count: 1, expiresAt: now + 5 * 60 * 1000 })
    return
  }
  if (current.count >= 10) {
    throw new DomainError("AI_RATE_LIMITED", "AI 请求过于频繁，请稍后再试", 429)
  }
  current.count += 1
}

const profileUnitId = "profile"

interface AiContentUnitTarget {
  unitId: string
  sectionId: string | null
  itemId: string | null
}

function createItemFields(item: ResumeItem): AiContentField[] {
  const fields: AiContentField[] = []
  const append = (
    field: AiSuggestionField,
    original: string,
    index: number | null = null,
  ) => {
    if (original.trim()) {
      fields.push({ field, index, original })
    }
  }
  append("description", item.description)
  item.highlights.forEach((highlight, index) => {
    append("highlight", highlight, index)
  })
  append("title", item.title)
  append("subtitle", item.subtitle)
  return fields
}

function createItemUnit(
  section: ResumeSection,
  item: ResumeItem,
): AiContentUnit | null {
  const fields = createItemFields(item)
  if (fields.length === 0) {
    return null
  }
  return {
    unitId: item.id,
    label: `${section.title} / ${item.title || item.subtitle || "未命名条目"}`,
    context: {
      itemTitle: item.title,
      itemSubtitle: item.subtitle,
    },
    fields,
  }
}

/**
 * 每个简历条目是一个独立优化单元。区块条目数超过上限时按原顺序截断，
 * 保证每个单元都能拿到完整且互不干扰的上下文。
 */
function createContentUnits(
  document: ResumeDocument,
  targetSectionId?: string | null,
): { units: AiContentUnit[]; targets: Map<string, AiContentUnitTarget> } {
  if (!targetSectionId) {
    if (!document.profile.summary.trim()) {
      throw new DomainError("AI_TARGET_INVALID", "请先填写个人摘要再进行优化", 422)
    }
    return {
      units: [
        {
          unitId: profileUnitId,
          label: "个人信息 / 个人摘要",
          context: null,
          fields: [
            { field: "summary", index: null, original: document.profile.summary },
          ],
        },
      ],
      targets: new Map([
        [profileUnitId, { unitId: profileUnitId, sectionId: null, itemId: null }],
      ]),
    }
  }

  const section = document.sections.find((entry) => entry.id === targetSectionId)
  if (!section) {
    throw new DomainError("AI_TARGET_INVALID", "AI 建议目标已失效", 422)
  }

  const units: AiContentUnit[] = []
  const targets = new Map<string, AiContentUnitTarget>()
  for (const item of section.items) {
    if (units.length >= aiContentUnitLimit) {
      break
    }
    const unit = createItemUnit(section, item)
    if (!unit) {
      continue
    }
    units.push(unit)
    targets.set(unit.unitId, {
      unitId: unit.unitId,
      sectionId: section.id,
      itemId: item.id,
    })
  }
  if (units.length === 0) {
    throw new DomainError("AI_TARGET_INVALID", "当前区块没有可优化的内容", 422)
  }
  return { units, targets }
}

function createInterviewItems(document: ResumeDocument): AiInterviewItem[] {
  const items = document.sections
    .filter(
      (section) =>
        section.visible && ["workExperience", "project"].includes(section.type),
    )
    .flatMap((section) =>
      section.items.map((item) => ({
        sectionId: section.id,
        sectionTitle: section.title,
        itemId: item.id,
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        highlights: item.highlights,
      })),
    )
    .filter(
      (item) =>
        item.title.trim() ||
        item.subtitle.trim() ||
        item.description.trim() ||
        item.highlights.some((highlight) => highlight.trim()),
    )
    .slice(0, maximumContextItems)
  if (items.length === 0) {
    throw new DomainError(
      "AI_TARGET_INVALID",
      "当前简历没有可生成面试题的工作或项目经历",
      422,
    )
  }
  return items
}

/** 结构性问题可回传模型的具体原因，让它有一次机会自我纠正。 */
class AiRepairableOutputError extends DomainError {
  constructor(
    readonly repairHint: string,
    message: string,
  ) {
    super("AI_OUTPUT_INVALID", message, 502)
  }
}

/** 把 Zod issue 压成模型读得懂的一句或多句纠正说明。 */
function formatSchemaIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "顶层"
      return `${path}：${issue.message}`
    })
    .join("；")
}

function parseProviderOutput(content: string): AiProviderOutput {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new AiRepairableOutputError(
      "上一次输出不是合法 JSON，只返回一个 JSON 对象，不要包含代码围栏或解释文字。",
      "AI 返回的不是合法 JSON",
    )
  }
  const result = aiProviderOutputSchema.safeParse(parsed)
  if (!result.success) {
    throw new AiRepairableOutputError(
      `上一次输出的结构校验未通过：${formatSchemaIssues(result.error)}。请严格按要求的字段名、类型和长度重新输出。`,
      "AI 返回结构不符合预期，请重试",
    )
  }
  return result.data
}

/**
 * 把 Provider 的「按单元」输出还原为客户端的「按定位」输出。
 * 定位信息完全由服务端从 unitId 回填，模型无法指向不存在的条目或字段。
 */
function createContentOutput(
  providerOutput: AiProviderOutput,
  units: AiContentUnit[],
  targets: Map<string, AiContentUnitTarget>,
): AiOutput {
  if (providerOutput.type !== "improve-content") {
    throw new DomainError("AI_OUTPUT_INVALID", "AI 返回结构不符合预期，请重试", 502)
  }

  const unitMap = new Map(units.map((unit) => [unit.unitId, unit]))
  const seenUnitIds = new Set<string>()
  const suggestions = providerOutput.suggestions.map((suggestion) => {
    const unit = unitMap.get(suggestion.unitId)
    const unitTarget = targets.get(suggestion.unitId)
    if (!unit || !unitTarget || seenUnitIds.has(suggestion.unitId)) {
      throw new DomainError("AI_TARGET_INVALID", "AI 建议目标已失效", 502)
    }
    const field = unit.fields.find(
      (entry) => entry.field === suggestion.field && entry.index === suggestion.index,
    )
    if (!field || field.original !== suggestion.original) {
      throw new DomainError("AI_TARGET_INVALID", "AI 建议目标已失效", 502)
    }
    seenUnitIds.add(suggestion.unitId)
    return {
      id: randomUUID(),
      target: {
        sectionId: unitTarget.sectionId,
        itemId: unitTarget.itemId,
        field: suggestion.field,
        index: suggestion.index,
      },
      original: suggestion.original,
      revised: suggestion.revised,
      rationale: suggestion.rationale,
    }
  })

  if (seenUnitIds.size !== units.length) {
    const missing = units
      .filter((unit) => !seenUnitIds.has(unit.unitId))
      .map((unit) => unit.label)
    throw new AiRepairableOutputError(
      `上一次输出缺少这些条目的建议：${missing.join("、")}。每个条目都必须恰好返回一条建议。`,
      "AI 未覆盖全部条目，请重试",
    )
  }

  return aiOutputSchema.parse({
    type: "improve-content",
    suggestions,
  })
}

const difficultyRank: Record<string, number> = {
  基础: 0,
  进阶: 1,
  深入: 2,
}

function createInterviewOutput(
  providerOutput: AiProviderOutput,
  items: AiInterviewItem[],
): AiOutput {
  if (providerOutput.type !== "interview-questions") {
    throw new DomainError("AI_OUTPUT_INVALID", "AI 返回结构不符合预期，请重试", 502)
  }
  const itemIds = new Set(items.map((item) => item.itemId))
  if (
    providerOutput.questions.some(
      (question) =>
        question.relatedItemId === null || !itemIds.has(question.relatedItemId),
    )
  ) {
    throw new DomainError("AI_TARGET_INVALID", "AI 建议目标已失效", 502)
  }
  // 「由简到难」在服务端排序而不是指望模型自觉：
  // 先按经历在文档中的顺序分组，再在组内按难度升序。
  const itemOrder = new Map(items.map((item, index) => [item.itemId, index]))
  const sorted = [...providerOutput.questions].sort((left, right) => {
    const leftItem = itemOrder.get(left.relatedItemId ?? "") ?? Number.MAX_SAFE_INTEGER
    const rightItem =
      itemOrder.get(right.relatedItemId ?? "") ?? Number.MAX_SAFE_INTEGER
    if (leftItem !== rightItem) {
      return leftItem - rightItem
    }
    return (
      (difficultyRank[left.difficulty] ?? 0) - (difficultyRank[right.difficulty] ?? 0)
    )
  })
  return aiOutputSchema.parse({
    ...providerOutput,
    questions: sorted.map((question) => ({
      ...question,
      id: randomUUID(),
    })),
  })
}

function createAuditOutput(output: AiOutput, provider: string) {
  return output.type === "improve-content"
    ? {
        type: output.type,
        suggestionCount: output.suggestions.length,
        provider,
      }
    : {
        type: output.type,
        questionCount: output.questions.length,
        provider,
      }
}

/** 结构可纠正时最多重试一次，避免无意义的循环与费用放大。 */
const maximumRepairAttempts = 1

/**
 * 执行一次生成；结构不合法时带着具体原因回传模型再试一次。
 * 只有 AiRepairableOutputError 会触发重试，其余错误直接抛出。
 */
async function completeWithRepair(
  client: AiChatClient,
  messages: AiChatMessage[],
): Promise<AiProviderOutput> {
  let attemptMessages = messages
  for (let attempt = 0; ; attempt += 1) {
    const content = await client.complete(attemptMessages)
    try {
      return parseProviderOutput(content)
    } catch (error) {
      const isRepairable = error instanceof AiRepairableOutputError
      if (!isRepairable || attempt >= maximumRepairAttempts) {
        throw error
      }
      attemptMessages = [
        ...messages,
        { role: "assistant", content },
        {
          role: "user",
          content: `上一次输出不可用，原因：${error.repairHint} 请重新输出完整且合法的 JSON。`,
        },
      ]
    }
  }
}

export class AiService {
  constructor(
    private readonly repository: ResumeRepository,
    private readonly client: AiChatClient,
  ) {}

  async generate(input: {
    resumeId: string
    task: AiTask
    document: ResumeDocument
    targetSectionId?: string | null
    promptGuidance?: string
  }): Promise<{ output: AiOutput; provider: string }> {
    const startedAt = Date.now()
    const provider = this.client.modelName
    let output: AiOutput
    let contextCount: number

    if (input.task === "improve-content") {
      const { units, targets } = createContentUnits(
        input.document,
        input.targetSectionId,
      )
      const providerOutput = await completeWithRepair(
        this.client,
        createContentImprovementMessages(units, input.promptGuidance),
      )
      output = createContentOutput(providerOutput, units, targets)
      contextCount = units.length
    } else {
      const items = createInterviewItems(input.document)
      const providerOutput = await completeWithRepair(
        this.client,
        createInterviewQuestionMessages(items, input.promptGuidance),
      )
      output = createInterviewOutput(providerOutput, items)
      contextCount = items.length
    }

    await this.repository.recordAiGeneration({
      id: randomUUID(),
      resumeId: input.resumeId,
      taskType: input.task,
      targetSectionId: input.targetSectionId ?? null,
      inputSummary: {
        schemaVersion: input.document.schemaVersion,
        contextCount,
      },
      output: createAuditOutput(output, provider),
      provider,
      latencyMs: Date.now() - startedAt,
      createdAt: new Date().toISOString(),
    })

    return { output, provider }
  }
}
