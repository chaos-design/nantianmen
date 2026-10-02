import { describe, expect, it } from "vitest"
import { diffAiText } from "./ai-text-diff"

describe("diff AI text", () => {
  it("marks only the rewritten Chinese characters", () => {
    const original = "负责后台系统开发"
    const revised = "主导后台系统架构设计"

    const diff = diffAiText(original, revised)

    const changedOriginal = diff.original
      .filter((segment) => segment.changed)
      .map((segment) => segment.text)
      .join("")
    const changedRevised = diff.revised
      .filter((segment) => segment.changed)
      .map((segment) => segment.text)
      .join("")
    const sharedOriginal = diff.original
      .filter((segment) => !segment.changed)
      .map((segment) => segment.text)
      .join("")

    expect(diff.original.map((segment) => segment.text).join("")).toBe(original)
    expect(diff.revised.map((segment) => segment.text).join("")).toBe(revised)
    // 未改写的部分在两侧必须一致，只有改写片段带高亮。
    expect(sharedOriginal).toBe("后台系统")
    expect(changedOriginal).toBe("负责开发")
    expect(changedRevised).toBe("主导架构设计")
  })

  it("keeps shared latin words unhighlighted", () => {
    const diff = diffAiText("build React apps", "build Vue apps")

    const revised = diff.revised.map((segment) => segment.text).join("")
    expect(revised).toBe("build Vue apps")
    expect(
      diff.revised.find((segment) => segment.text.includes("build")),
    ).toMatchObject({ changed: false })
    expect(diff.revised.find((segment) => segment.text.includes("Vue"))).toMatchObject({
      changed: true,
    })
  })

  it("merges adjacent changed tokens into one segment", () => {
    const diff = diffAiText("一二三四五六", "二三四五六")

    expect(diff.original).toEqual([
      { text: "一", changed: true },
      { text: "二三四五六", changed: false },
    ])
    expect(diff.revised).toEqual([{ text: "二三四五六", changed: false }])
  })

  it("returns unchanged segments when both texts are identical", () => {
    const diff = diffAiText("保持原样", "保持原样")

    expect(diff.original).toEqual([{ text: "保持原样", changed: false }])
    expect(diff.revised).toEqual([{ text: "保持原样", changed: false }])
  })

  it("handles an empty original without diffing", () => {
    const diff = diffAiText("", "补充一段描述")

    expect(diff.original).toEqual([])
    expect(diff.revised).toEqual([{ text: "补充一段描述", changed: false }])
  })

  it("falls back to plain segments when the text exceeds the diff budget", () => {
    const long = "描".repeat(500)
    const diff = diffAiText(long, `${long}补充`)

    expect(diff.original).toEqual([{ text: long, changed: false }])
    expect(diff.revised).toEqual([{ text: `${long}补充`, changed: false }])
  })
})
