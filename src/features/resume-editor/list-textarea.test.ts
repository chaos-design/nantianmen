import { describe, expect, it } from "vitest"
import { formatListText, parseListText } from "./list-textarea"

describe("list textarea", () => {
  it("parses skills separated by English commas, Chinese commas or newlines", () => {
    expect(
      parseListText(
        "React, TypeScript，Next.js\nNode.js,\n PostgreSQL",
        "comma-or-newline",
      ),
    ).toEqual(["React", "TypeScript", "Next.js", "Node.js", "PostgreSQL"])
  })

  it("parses non-empty lines without treating commas as separators", () => {
    expect(parseListText("提升性能 30%\n\n负责设计、开发与交付\n", "newline")).toEqual([
      "提升性能 30%",
      "负责设计、开发与交付",
    ])
  })

  it("formats stored values for their editing mode", () => {
    expect(formatListText(["React", "TypeScript"], "comma-or-newline")).toBe(
      "React, TypeScript",
    )
    expect(formatListText(["结果一", "结果二"], "newline")).toBe("结果一\n结果二")
  })
})
