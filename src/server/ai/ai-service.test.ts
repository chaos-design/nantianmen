import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import { aiContentUnitLimit } from "../../shared/resume-ai/resume-ai-contract"
import {
  createResumeDocument,
  resumeEditableFieldLimits,
} from "../../shared/resume-schema/resume-schema"
import { DomainError } from "../domain/resume-service"
import {
  type AiGenerationRecord,
  InMemoryResumeRepository,
} from "../repositories/resume-repository"
import { AiService, assertAiRateLimit } from "./ai-service"
import type { AiChatClient } from "./open-ai-chat-client"
import type { AiChatMessage } from "./prompts/resume-ai-prompts"

class StubAiChatClient implements AiChatClient {
  readonly modelName = "test-model"
  readonly requests: AiChatMessage[][] = []

  constructor(private readonly responses: string[]) {}

  async complete(messages: AiChatMessage[]): Promise<string> {
    this.requests.push(messages)
    const response = this.responses.shift()
    if (!response) {
      throw new Error("Missing stub response")
    }
    return response
  }
}

class RecordingRepository extends InMemoryResumeRepository {
  readonly generations: AiGenerationRecord[] = []

  override async recordAiGeneration(record: AiGenerationRecord): Promise<void> {
    this.generations.push(structuredClone(record))
    await super.recordAiGeneration(record)
  }
}

describe("AI service", () => {
  it("returns one independent suggestion per item with minimized context", async () => {
    const document = createResumeDocument()
    const section = document.sections[0]
    const items = section.items.slice(0, 2)
    const client = new StubAiChatClient([
      JSON.stringify({
        type: "improve-content",
        suggestions: items.map((item, index) => ({
          unitId: item.id,
          field: "description",
          index: null,
          original: item.description,
          revised: `第 ${index + 1} 条经历的独立优化稿。`,
          rationale: "突出动作与结果。",
        })),
      }),
    ])
    const repository = new RecordingRepository()
    const service = new AiService(repository, client)

    const result = await service.generate({
      resumeId: randomUUID(),
      task: "improve-content",
      document,
      targetSectionId: section.id,
    })

    expect(result.provider).toBe("test-model")
    expect(result.output.type).toBe("improve-content")
    if (result.output.type === "improve-content") {
      expect(result.output.suggestions).toHaveLength(items.length)
      expect(result.output.suggestions.map((entry) => entry.target.itemId)).toEqual(
        items.map((item) => item.id),
      )
      expect(
        result.output.suggestions.every(
          (entry) => entry.target.sectionId === section.id,
        ),
      ).toBe(true)
    }
    const request = client.requests[0].map((message) => message.content).join("")
    expect(request).not.toContain(document.profile.email)
    expect(request).not.toContain(document.profile.phone)
    expect(request).not.toContain(document.profile.website)
    expect(request).not.toContain(items[0].url)
    expect(request).toContain("必须为每个 unitId 恰好返回一条建议")
    expect(repository.generations[0].output).toEqual({
      type: "improve-content",
      suggestionCount: items.length,
      provider: "test-model",
    })
    expect(JSON.stringify(repository.generations[0])).not.toContain(
      items[0].description,
    )
  })

  it("generates validated interview questions from work and project items", async () => {
    const document = createResumeDocument()
    const relatedItemId = document.sections[0].items[0].id
    const client = new StubAiChatClient([
      JSON.stringify({
        type: "interview-questions",
        disclaimer: "基于简历内容生成，仅供面试准备参考。",
        questions: [
          {
            category: "技术深度",
            question: "你如何通过工程质量建设降低线上问题？",
            answerDirection: "按质量机制、覆盖范围和结果指标组织回答。",
            keyPoints: [
              "Playwright 关键路径回归",
              "前端性能预算与发布看板",
              "高优缺陷月均从 11 个降至 4 个",
            ],
            suggestedAnswer:
              "我建立了 Playwright 关键路径回归，并引入前端性能预算和发布看板。这套机制覆盖了核心交付链路，让质量问题能在发布前被发现。落地后，高优线上缺陷月均数量从 11 个降至 4 个。",
            difficulty: "深入",
            relatedItemId,
          },
        ],
      }),
    ])
    const service = new AiService(new RecordingRepository(), client)

    const result = await service.generate({
      resumeId: randomUUID(),
      task: "interview-questions",
      document,
    })

    expect(result.output.type).toBe("interview-questions")
    if (result.output.type === "interview-questions") {
      expect(result.output.questions[0].relatedItemId).toBe(relatedItemId)
      expect(result.output.questions[0].keyPoints).toEqual([
        "Playwright 关键路径回归",
        "前端性能预算与发布看板",
        "高优缺陷月均从 11 个降至 4 个",
      ])
    }
    const request = client.requests[0].map((message) => message.content).join("")
    expect(request).toContain("suggestedAnswer")
    expect(request).toContain("keyPoints")
    expect(request).toContain("单独出题")
    expect(request).toContain("题目数量必须在 1 到 15 道之间")
    expect(request).toContain("relatedItemId 必须复制某一条经历已提供的 itemId")
    expect(request).toContain("keyPoints")
    expect(request).toContain("禁止用“可以介绍”")
    expect(request).not.toContain(document.profile.name)
    expect(request).not.toContain(document.profile.email)
  })

  it("orders interview questions by experience then easy to hard", async () => {
    const document = createResumeDocument()
    const items = document.sections
      .filter((section) => ["workExperience", "project"].includes(section.type))
      .flatMap((section) => section.items)
    const [first, second] = items

    const question = (relatedItemId: string, difficulty: string, index: number) => ({
      category: "技术深度",
      question: `问题 ${index}`,
      answerDirection: "说明约束和决策。",
      keyPoints: ["候选方案", "最终决策"],
      suggestedAnswer: "我会先说明可选方案，再解释最终决策与验证结果。",
      difficulty,
      relatedItemId,
    })

    // 模型乱序返回：深→浅，且两条经历交错。
    const client = new StubAiChatClient([
      JSON.stringify({
        type: "interview-questions",
        disclaimer: "仅供参考。",
        questions: [
          question(second.id, "深入", 1),
          question(first.id, "进阶", 2),
          question(second.id, "基础", 3),
          question(first.id, "基础", 4),
        ],
      }),
    ])
    const service = new AiService(new RecordingRepository(), client)

    const result = await service.generate({
      resumeId: randomUUID(),
      task: "interview-questions",
      document,
    })

    expect(result.output.type).toBe("interview-questions")
    if (result.output.type === "interview-questions") {
      expect(
        result.output.questions.map((entry) => [entry.relatedItemId, entry.difficulty]),
      ).toEqual([
        [first.id, "基础"],
        [first.id, "进阶"],
        [second.id, "基础"],
        [second.id, "深入"],
      ])
    }
  })

  it("rejects a suggestion that points at an unknown unit", async () => {
    const document = createResumeDocument()
    const section = document.sections[0]
    const client = new StubAiChatClient([
      JSON.stringify({
        type: "improve-content",
        suggestions: [
          {
            unitId: "missing-item",
            field: "description",
            index: null,
            original: "不存在",
            revised: "无效建议",
            rationale: "无效定位。",
          },
        ],
      }),
    ])
    const service = new AiService(new RecordingRepository(), client)

    await expect(
      service.generate({
        resumeId: randomUUID(),
        task: "improve-content",
        document,
        targetSectionId: section.id,
      }),
    ).rejects.toMatchObject({
      code: "AI_TARGET_INVALID",
    })
  })

  it("rejects output that does not cover every item", async () => {
    const document = createResumeDocument()
    const section = document.sections[0]
    const items = section.items.slice(0, 2)
    const client = new StubAiChatClient([
      JSON.stringify({
        type: "improve-content",
        suggestions: [
          {
            unitId: items[0].id,
            field: "description",
            index: null,
            original: items[0].description,
            revised: "只覆盖第一条。",
            rationale: "遗漏了第二条。",
          },
        ],
      }),
    ])
    const service = new AiService(new RecordingRepository(), client)

    await expect(
      service.generate({
        resumeId: randomUUID(),
        task: "improve-content",
        document,
        targetSectionId: section.id,
      }),
    ).rejects.toMatchObject({
      code: "AI_OUTPUT_INVALID",
    })
  })

  it("rejects a field that the unit does not contain", async () => {
    const document = createResumeDocument()
    const section = document.sections[0]
    const item = section.items[0]
    const client = new StubAiChatClient([
      JSON.stringify({
        type: "improve-content",
        suggestions: [
          {
            unitId: item.id,
            field: "description",
            index: null,
            original: "与原文不一致",
            revised: "无效建议",
            rationale: "原文不匹配。",
          },
        ],
      }),
    ])
    const service = new AiService(new RecordingRepository(), client)

    await expect(
      service.generate({
        resumeId: randomUUID(),
        task: "improve-content",
        document,
        targetSectionId: section.id,
      }),
    ).rejects.toMatchObject({
      code: "AI_TARGET_INVALID",
    })
  })

  it("limits a single request to the maximum number of items", async () => {
    const document = createResumeDocument()
    const baseSection = document.sections[0]
    const baseItem = baseSection.items[0]
    const items = Array.from({ length: aiContentUnitLimit + 2 }, (_, index) => ({
      ...baseItem,
      id: `item-${index}`,
      title: `项目 ${index + 1}`,
      description: `第 ${index + 1} 个项目的背景描述。`,
    }))
    const section = { ...baseSection, items }
    const client = new StubAiChatClient([
      JSON.stringify({
        type: "improve-content",
        suggestions: items.slice(0, aiContentUnitLimit).map((item) => ({
          unitId: item.id,
          field: "description",
          index: null,
          original: item.description,
          revised: "逐条独立优化。",
          rationale: "覆盖该条目。",
        })),
      }),
    ])
    const service = new AiService(new RecordingRepository(), client)

    const result = await service.generate({
      resumeId: randomUUID(),
      task: "improve-content",
      document: { ...document, sections: [section, ...document.sections.slice(1)] },
      targetSectionId: section.id,
    })

    expect(result.output.type).toBe("improve-content")
    if (result.output.type === "improve-content") {
      expect(result.output.suggestions).toHaveLength(aiContentUnitLimit)
    }
  })

  it("rejects malformed provider output after one repair attempt", async () => {
    const document = createResumeDocument()
    const client = new StubAiChatClient(["not-json", "still-not-json"])
    const service = new AiService(new RecordingRepository(), client)

    await expect(
      service.generate({
        resumeId: randomUUID(),
        task: "interview-questions",
        document,
      }),
    ).rejects.toMatchObject({
      code: "AI_OUTPUT_INVALID",
    })
    // 结构不合法时最多重试一次，不会无限循环。
    expect(client.requests).toHaveLength(2)
  })

  it("recovers when the provider repairs its output on the second attempt", async () => {
    const document = createResumeDocument()
    const relatedItemId = document.sections[0].items[0].id
    const service = new AiService(
      new RecordingRepository(),
      new StubAiChatClient([
        '{"type":"interview-questions","questions":[]}',
        JSON.stringify({
          type: "interview-questions",
          disclaimer: "仅供参考。",
          questions: [
            {
              category: "技术深度",
              question: "如何保证工程质量？",
              answerDirection: "说明机制与覆盖范围。",
              keyPoints: ["回归测试", "发布看板"],
              suggestedAnswer: "我建立了回归测试与发布看板，覆盖核心交付链路。",
              difficulty: "进阶",
              relatedItemId,
            },
          ],
        }),
      ]),
    )

    const result = await service.generate({
      resumeId: randomUUID(),
      task: "interview-questions",
      document,
    })

    expect(result.output.type).toBe("interview-questions")
    if (result.output.type === "interview-questions") {
      expect(result.output.questions[0].relatedItemId).toBe(relatedItemId)
    }
  })

  it("tells the model why the previous output was rejected", async () => {
    const document = createResumeDocument()
    const client = new StubAiChatClient([
      '{"type":"interview-questions","questions":[]}',
      JSON.stringify({
        type: "interview-questions",
        disclaimer: "仅供参考。",
        questions: [
          {
            category: "技术深度",
            question: "如何保证工程质量？",
            answerDirection: "说明机制与覆盖范围。",
            keyPoints: ["回归测试", "发布看板"],
            suggestedAnswer: "我建立了回归测试与发布看板，覆盖核心交付链路。",
            difficulty: "进阶",
            relatedItemId: document.sections[0].items[0].id,
          },
        ],
      }),
    ])
    const service = new AiService(new RecordingRepository(), client)

    await service.generate({
      resumeId: randomUUID(),
      task: "interview-questions",
      document,
    })

    const repairTurn = client.requests[1].at(-1)
    expect(repairTurn?.role).toBe("user")
    expect(repairTurn?.content).toContain("上一次输出不可用")
    expect(repairTurn?.content).toContain("questions")
  })

  it("rejects a rewrite that exceeds the resume field length limit", async () => {
    const document = createResumeDocument()
    const section = document.sections[0]
    const item = section.items[0]
    // 标题在简历 Schema 中上限 120 字，放行超长改写会把文档改坏。
    const tooLongTitle = "标".repeat(resumeEditableFieldLimits.title + 1)
    const client = new StubAiChatClient([
      JSON.stringify({
        type: "improve-content",
        suggestions: [
          {
            unitId: item.id,
            field: "title",
            index: null,
            original: item.title,
            revised: tooLongTitle,
            rationale: "超长改写。",
          },
        ],
      }),
      JSON.stringify({
        type: "improve-content",
        suggestions: [
          {
            unitId: item.id,
            field: "title",
            index: null,
            original: item.title,
            revised: item.title,
            rationale: "保持不变。",
          },
        ],
      }),
    ])
    const service = new AiService(new RecordingRepository(), client)

    const result = await service.generate({
      resumeId: randomUUID(),
      task: "improve-content",
      document: {
        ...document,
        sections: [{ ...section, items: [item] }, ...document.sections.slice(1)],
      },
      targetSectionId: section.id,
    })

    expect(result.output.type).toBe("improve-content")
    // 纠正回合必须把长度上限告诉模型，否则它只会再写一次长的。
    const repairTurn = client.requests[1].at(-1)
    expect(repairTurn?.content).toContain(String(resumeEditableFieldLimits.title))
  })

  it("rejects interview answers without a related resume item", async () => {
    const document = createResumeDocument()
    const service = new AiService(
      new RecordingRepository(),
      new StubAiChatClient([
        JSON.stringify({
          type: "interview-questions",
          disclaimer: "仅供参考。",
          questions: [
            {
              category: "协作沟通",
              question: "你如何推动跨团队协作？",
              answerDirection: "说明协作对象、行动和结果。",
              keyPoints: ["协作对象", "推动动作", "最终结果"],
              suggestedAnswer:
                "我会先识别协作对象，再推动各方形成共识，并持续跟进最终结果。",
              difficulty: "进阶",
              relatedItemId: null,
            },
          ],
        }),
      ]),
    )

    await expect(
      service.generate({
        resumeId: randomUUID(),
        task: "interview-questions",
        document,
      }),
    ).rejects.toMatchObject({
      code: "AI_TARGET_INVALID",
    })
  })

  it("requires interview key points and a suggested answer", async () => {
    const document = createResumeDocument()
    // 结构不合法会触发一次纠正回合，两次都不合法才判定失败。
    const incomplete = JSON.stringify({
      type: "interview-questions",
      disclaimer: "仅供参考。",
      questions: [
        {
          category: "技术深度",
          question: "如何进行技术选型？",
          answerDirection: "说明约束和决策。",
          difficulty: "进阶",
          relatedItemId: null,
        },
      ],
    })
    const service = new AiService(
      new RecordingRepository(),
      new StubAiChatClient([incomplete, incomplete]),
    )

    await expect(
      service.generate({
        resumeId: randomUUID(),
        task: "interview-questions",
        document,
      }),
    ).rejects.toMatchObject({
      code: "AI_OUTPUT_INVALID",
    })
  })

  it("does not invent a profile summary from empty content", async () => {
    const document = createResumeDocument()
    document.profile.summary = ""
    const service = new AiService(
      new RecordingRepository(),
      new StubAiChatClient(['{"type":"improve-content","suggestions":[]}']),
    )

    await expect(
      service.generate({
        resumeId: randomUUID(),
        task: "improve-content",
        document,
        targetSectionId: null,
      }),
    ).rejects.toMatchObject({
      code: "AI_TARGET_INVALID",
    })
  })

  it("limits repeated requests in a five-minute window", () => {
    const key = randomUUID()
    for (let index = 0; index < 10; index += 1) {
      expect(() => assertAiRateLimit(key)).not.toThrow()
    }
    expect(() => assertAiRateLimit(key)).toThrowError(DomainError)
  })
})
