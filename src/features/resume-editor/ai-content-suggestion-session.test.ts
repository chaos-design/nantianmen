import { describe, expect, it } from "vitest"
import type { AiContentImprovementOutput } from "./ai-content-suggestion-session"
import {
  getAiContentSuggestionSessionStorageKey,
  readAiContentSuggestionSession,
  saveAiContentSuggestionSession,
} from "./ai-content-suggestion-session"

const ownerId = "11111111-1111-4111-8111-111111111111"
const resumeId = "22222222-2222-4222-8222-222222222222"

const output: AiContentImprovementOutput = {
  type: "improve-content",
  suggestions: [
    {
      id: "suggestion-1",
      target: {
        sectionId: "section-1",
        itemId: "item-1",
        field: "description",
        index: null,
      },
      original: "负责平台开发。",
      revised: "负责平台核心能力建设并持续验证交付结果。",
      rationale: "突出职责与结果。",
    },
  ],
}

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe("AI content suggestion session", () => {
  it("saves and restores the latest content improvement result", () => {
    const storage = new MemoryStorage()

    saveAiContentSuggestionSession(
      ownerId,
      resumeId,
      {
        output,
        provider: "test-model",
        appliedTargetKeys: ["target-1", "target-1"],
      },
      storage,
    )

    expect(readAiContentSuggestionSession(ownerId, resumeId, storage)).toEqual({
      output,
      provider: "test-model",
      appliedTargetKeys: ["target-1"],
    })
  })

  it("isolates sessions by owner and resume", () => {
    const storage = new MemoryStorage()
    saveAiContentSuggestionSession(
      ownerId,
      resumeId,
      {
        output,
        provider: "test-model",
        appliedTargetKeys: [],
      },
      storage,
    )

    expect(readAiContentSuggestionSession("other-owner", resumeId, storage)).toBeNull()
    expect(readAiContentSuggestionSession(ownerId, "other-resume", storage)).toBeNull()
  })

  it("ignores malformed, unsupported and mismatched sessions", () => {
    const storage = new MemoryStorage()
    const key = getAiContentSuggestionSessionStorageKey(ownerId, resumeId)

    storage.setItem(key, "not-json")
    expect(readAiContentSuggestionSession(ownerId, resumeId, storage)).toBeNull()

    storage.setItem(
      key,
      JSON.stringify({
        version: 2,
        ownerId,
        resumeId,
        output,
        provider: "test-model",
        appliedTargetKeys: [],
      }),
    )
    expect(readAiContentSuggestionSession(ownerId, resumeId, storage)).toBeNull()

    storage.setItem(
      key,
      JSON.stringify({
        version: 1,
        ownerId: "other-owner",
        resumeId,
        output,
        provider: "test-model",
        appliedTargetKeys: [],
      }),
    )
    expect(readAiContentSuggestionSession(ownerId, resumeId, storage)).toBeNull()

    storage.setItem(
      key,
      JSON.stringify({
        version: 1,
        ownerId,
        resumeId,
        output: {
          type: "interview-questions",
          disclaimer: "仅供参考。",
          questions: [
            {
              id: "question-1",
              category: "项目背景",
              question: "项目目标是什么？",
              answerDirection: "说明背景与目标。",
              keyPoints: ["项目背景", "业务目标"],
              suggestedAnswer: "我负责的平台用于支持业务分析。",
              difficulty: "基础",
              relatedItemId: "item-1",
            },
          ],
        },
        provider: "test-model",
        appliedTargetKeys: [],
      }),
    )
    expect(readAiContentSuggestionSession(ownerId, resumeId, storage)).toBeNull()
  })

  it("silently degrades when storage is unavailable", () => {
    const unavailableStorage = {
      getItem() {
        throw new Error("storage unavailable")
      },
      setItem() {
        throw new Error("storage unavailable")
      },
    }

    expect(
      readAiContentSuggestionSession(ownerId, resumeId, unavailableStorage),
    ).toBeNull()
    expect(() =>
      saveAiContentSuggestionSession(
        ownerId,
        resumeId,
        {
          output,
          provider: "test-model",
          appliedTargetKeys: [],
        },
        unavailableStorage,
      ),
    ).not.toThrow()
  })
})
