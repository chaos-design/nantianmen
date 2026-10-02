import { describe, expect, it } from "vitest"
import { aiTasks } from "../../shared/resume-ai/resume-ai-contract"
import {
  composeAiSystemPrompt,
  defaultAiSystemPrompt,
} from "../../shared/resume-ai/resume-ai-prompt-text"
import {
  clearBrowserAiPrompts,
  emptyBrowserAiPrompts,
  getBrowserAiPromptsStorageKey,
  hasCustomPrompt,
  readBrowserAiPrompts,
  readPromptGuidance,
  readPromptText,
  saveBrowserAiPrompts,
  updatePromptText,
} from "./browser-ai-prompts"

function createStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    map,
  }
}

describe("browser AI prompts", () => {
  it("shows the complete built-in prompt before any edit", () => {
    // 编辑器展示的就是完整 prompt，用户所见即模型所得。
    for (const task of aiTasks) {
      expect(readPromptText(emptyBrowserAiPrompts, task)).toBe(
        defaultAiSystemPrompt[task],
      )
    }
  })

  it("shows a prompt long enough to be a real instruction set", () => {
    // 内容从 4 行扩到 19 行是刻意的：只有把专业判断写进去才有意义。
    expect(
      readPromptText(emptyBrowserAiPrompts, "improve-content").split("\n").length,
    ).toBeGreaterThan(12)
    expect(
      readPromptText(emptyBrowserAiPrompts, "interview-questions").split("\n").length,
    ).toBeGreaterThan(12)
  })

  it("reports no customisation until the text actually changes", () => {
    expect(hasCustomPrompt(emptyBrowserAiPrompts, "improve-content")).toBe(false)
    expect(readPromptGuidance(emptyBrowserAiPrompts, "improve-content")).toBeUndefined()
  })

  it("treats whitespace-only changes as no customisation", () => {
    const same = updatePromptText(
      emptyBrowserAiPrompts,
      "improve-content",
      defaultAiSystemPrompt["improve-content"],
    )
    const blank = updatePromptText(emptyBrowserAiPrompts, "improve-content", "   ")

    expect(hasCustomPrompt(same, "improve-content")).toBe(false)
    expect(hasCustomPrompt(blank, "improve-content")).toBe(false)
  })

  it("edits one sentence without discarding the rest", () => {
    const defaults = defaultAiSystemPrompt["improve-content"].split("\n")
    const edited = updatePromptText(
      emptyBrowserAiPrompts,
      "improve-content",
      [defaults[0], "改写后的第一句。", defaults[2], defaults[3]].join("\n"),
    )

    const lines = readPromptText(edited, "improve-content").split("\n")
    // 改动一行，其余三行原样保留。
    expect(lines[1]).toBe("改写后的第一句。")
    expect(lines[0]).toBe(defaults[0])
    expect(lines[2]).toBe(defaults[2])
    expect(lines[3]).toBe(defaults[3])
  })

  it("drops a line when the user deletes it", () => {
    const defaults = defaultAiSystemPrompt["improve-content"].split("\n")
    const edited = updatePromptText(
      emptyBrowserAiPrompts,
      "improve-content",
      [defaults[0], defaults[2]].join("\n"),
    )

    const lines = readPromptText(edited, "improve-content").split("\n")
    expect(lines).toHaveLength(2)
    expect(lines).not.toContain(defaults[1])
  })

  it("appends an extra sentence at the end", () => {
    const base = defaultAiSystemPrompt["improve-content"]
    const edited = updatePromptText(
      emptyBrowserAiPrompts,
      "improve-content",
      `${base}\n多用量化表达。`,
    )

    const lines = readPromptText(edited, "improve-content").split("\n")
    expect(lines).toHaveLength(base.split("\n").length + 1)
    expect(lines.at(-1)).toBe("多用量化表达。")
  })

  it("keeps the two tasks independent", () => {
    const prompts = updatePromptText(
      emptyBrowserAiPrompts,
      "improve-content",
      "只改内容优化。",
    )

    expect(hasCustomPrompt(prompts, "improve-content")).toBe(true)
    expect(hasCustomPrompt(prompts, "interview-questions")).toBe(false)
    expect(readPromptText(prompts, "interview-questions")).toBe(
      defaultAiSystemPrompt["interview-questions"],
    )
  })

  it("persists only the customised task", () => {
    const storage = createStorage()
    const edited = updatePromptText(
      emptyBrowserAiPrompts,
      "improve-content",
      "更简洁。",
    )

    saveBrowserAiPrompts("owner", edited, storage)

    const restored = readBrowserAiPrompts("owner", storage)
    expect(hasCustomPrompt(restored, "improve-content")).toBe(true)
    expect(hasCustomPrompt(restored, "interview-questions")).toBe(false)
  })

  it("does not persist text identical to the built-in default", () => {
    const storage = createStorage()
    const noop = updatePromptText(
      emptyBrowserAiPrompts,
      "improve-content",
      defaultAiSystemPrompt["improve-content"],
    )

    saveBrowserAiPrompts("owner", noop, storage)

    // 等价于默认值，整个键都不该留下。
    expect(storage.map.has(getBrowserAiPromptsStorageKey("owner"))).toBe(false)
  })

  it("removes the whole key when both tasks return to default", () => {
    const storage = createStorage()
    const edited = updatePromptText(
      emptyBrowserAiPrompts,
      "improve-content",
      "更简洁。",
    )
    saveBrowserAiPrompts("owner", edited, storage)
    expect(storage.map.has(getBrowserAiPromptsStorageKey("owner"))).toBe(true)

    saveBrowserAiPrompts(
      "owner",
      updatePromptText(
        edited,
        "improve-content",
        defaultAiSystemPrompt["improve-content"],
      ),
      storage,
    )

    expect(storage.map.has(getBrowserAiPromptsStorageKey("owner"))).toBe(false)
    expect(
      readPromptGuidance(readBrowserAiPrompts("owner", storage), "improve-content"),
    ).toBeUndefined()
  })

  it("falls back to the in-memory default after localStorage is cleared", () => {
    const storage = createStorage()
    const edited = updatePromptText(
      emptyBrowserAiPrompts,
      "improve-content",
      "更简洁。",
    )
    saveBrowserAiPrompts("owner", edited, storage)
    clearBrowserAiPrompts("owner", storage)

    const restored = readBrowserAiPrompts("owner", storage)
    expect(readPromptText(restored, "improve-content")).toBe(
      defaultAiSystemPrompt["improve-content"],
    )
    expect(readPromptGuidance(restored, "improve-content")).toBeUndefined()
  })

  it("round-trips a partial edit through storage", () => {
    const storage = createStorage()
    const defaults = defaultAiSystemPrompt["improve-content"].split("\n")
    const edited = updatePromptText(
      emptyBrowserAiPrompts,
      "improve-content",
      [defaults[0], "第二句改过。", defaults[2], defaults[3]].join("\n"),
    )

    saveBrowserAiPrompts("owner", edited, storage)

    const lines = readPromptText(
      readBrowserAiPrompts("owner", storage),
      "improve-content",
    ).split("\n")
    expect(lines[1]).toBe("第二句改过。")
    expect(lines).toHaveLength(4)
  })

  it("trims surrounding whitespace before persisting", () => {
    const storage = createStorage()
    const edited = updatePromptText(
      emptyBrowserAiPrompts,
      "improve-content",
      "\n  更简洁。  \n",
    )

    saveBrowserAiPrompts("owner", edited, storage)

    expect(
      readPromptGuidance(readBrowserAiPrompts("owner", storage), "improve-content"),
    ).toBe("更简洁。")
  })

  it("ignores corrupted storage instead of surfacing a parse error", () => {
    const storage = createStorage()
    storage.map.set(getBrowserAiPromptsStorageKey("owner"), "{not json")

    expect(readBrowserAiPrompts("owner", storage)).toEqual(emptyBrowserAiPrompts)
  })

  it("ignores legacy storage written by an earlier schema version", () => {
    const storage = createStorage()
    storage.map.set(
      "resume-ai:prompts:v1:owner",
      JSON.stringify({
        version: 1,
        improveContent: "旧版文本",
        interviewQuestions: "",
      }),
    )

    // 旧键名不再读取，用户回到内置默认导引而不是沿用未知结构。
    expect(readBrowserAiPrompts("owner", storage)).toEqual(emptyBrowserAiPrompts)
  })

  it("rejects a prompt longer than the shared length limit", () => {
    const storage = createStorage()
    const tooLong = "标".repeat(8001)

    expect(() =>
      saveBrowserAiPrompts(
        "owner",
        updatePromptText(emptyBrowserAiPrompts, "improve-content", tooLong),
        storage,
      ),
    ).toThrow()
  })

  it("sends the user's text verbatim, including a rewritten structure line", () => {
    // 用户有权整体替换，包括输出结构那几行；服务端不再拼接任何前缀。
    const storage = createStorage()
    const custom = [
      "你是资深技术招聘顾问。",
      '输出结构：{"type":"improve-content","suggestions":[]}',
      "只输出一句话。",
    ].join("\n")
    const saved = saveBrowserAiPrompts(
      "owner",
      updatePromptText(emptyBrowserAiPrompts, "improve-content", custom),
      storage,
    )

    expect(readPromptGuidance(saved, "improve-content")).toBe(custom)
    expect(
      composeAiSystemPrompt(
        "improve-content",
        readPromptGuidance(saved, "improve-content"),
      ),
    ).toBe(custom)
  })
})
