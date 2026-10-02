import { describe, expect, it } from "vitest"
import { aiTasks } from "./resume-ai-contract"
import {
  aiInterviewQuestionLimit,
  composeAiSystemPrompt,
  defaultAiSystemPrompt,
  findMissingStructureMarkers,
} from "./resume-ai-prompt-text"

describe("compose AI system prompt", () => {
  it("uses the built-in prompt when nothing is customised", () => {
    for (const task of aiTasks) {
      expect(composeAiSystemPrompt(task)).toBe(defaultAiSystemPrompt[task])
      expect(composeAiSystemPrompt(task, undefined)).toBe(defaultAiSystemPrompt[task])
      expect(composeAiSystemPrompt(task, null)).toBe(defaultAiSystemPrompt[task])
    }
  })

  it("treats blank text as no customisation", () => {
    expect(composeAiSystemPrompt("improve-content", "   \n  ")).toBe(
      defaultAiSystemPrompt["improve-content"],
    )
  })

  it("sends the user's text verbatim with nothing prepended or appended", () => {
    // 用户在编辑器里看到什么，模型就必须原样收到什么。
    const custom = "只回答一句话。\n不要 JSON。"
    const composed = composeAiSystemPrompt("improve-content", custom)

    expect(composed).toBe(custom)
    expect(composed.startsWith("你是资深技术招聘顾问")).toBe(false)
  })

  it("keeps the output structure in every built-in prompt", () => {
    for (const task of aiTasks) {
      const prompt = defaultAiSystemPrompt[task]
      expect(prompt).toContain("输出结构")
      expect(prompt).toContain("不得输出 Markdown")
      expect(findMissingStructureMarkers(task, prompt)).toEqual([])
    }
  })

  it("caps the interview question count consistently", () => {
    expect(aiInterviewQuestionLimit).toBe(15)
    expect(defaultAiSystemPrompt["interview-questions"]).toContain(
      `题目数量必须在 1 到 ${aiInterviewQuestionLimit} 道之间`,
    )
  })

  it("keeps the per-experience and difficulty-ordering rules", () => {
    const prompt = defaultAiSystemPrompt["interview-questions"]
    expect(prompt).toContain("单独出题")
    expect(prompt).toContain("由简到难")
  })

  it("keeps the structural rules the Zod schema depends on", () => {
    const improve = defaultAiSystemPrompt["improve-content"]
    expect(improve).toContain("必须为每个 unitId 恰好返回一条建议")
    expect(improve).toContain("original 必须逐字复制")

    const interview = defaultAiSystemPrompt["interview-questions"]
    expect(interview).toContain("relatedItemId")
    expect(interview).toContain("difficulty 只能是基础、进阶、深入")
  })
})

describe("structure markers", () => {
  it("reports nothing missing when the default prompt is intact", () => {
    for (const task of aiTasks) {
      expect(findMissingStructureMarkers(task, defaultAiSystemPrompt[task])).toEqual([])
    }
  })

  it("reports every marker when the text says nothing about structure", () => {
    expect(findMissingStructureMarkers("improve-content", "随便一段话").length).toBe(5)
  })

  it("detects a prompt whose output structure line was deleted", () => {
    const stripped = defaultAiSystemPrompt["improve-content"]
      .split("\n")
      .filter((line) => !line.startsWith("输出结构"))
      .join("\n")

    expect(findMissingStructureMarkers("improve-content", stripped)).toContain(
      "输出结构",
    )
  })

  it("detects partial damage such as removing the field names", () => {
    const stripped = defaultAiSystemPrompt["interview-questions"]
      .split("\n")
      .filter((line) => !line.includes("relatedItemId"))
      .join("\n")

    const missing = findMissingStructureMarkers("interview-questions", stripped)
    expect(missing).toContain("relatedItemId")
  })

  it("uses markers specific to each task", () => {
    // 内容优化的探针不应该要求面试题专有的字段。
    const contentOnly = "输出结构 unitId suggestions original revised"
    expect(findMissingStructureMarkers("interview-questions", contentOnly)).toContain(
      "suggestedAnswer",
    )
  })
})
