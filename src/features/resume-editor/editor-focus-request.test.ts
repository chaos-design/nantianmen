import { describe, expect, it } from "vitest"
import type { AiContentSuggestion } from "../../shared/resume-ai/resume-ai-contract"
import { createResumeDocument } from "../../shared/resume-schema/resume-schema"
import { locateSuggestionTarget } from "./editor-focus-request"

function createSuggestion(target: AiContentSuggestion["target"]): AiContentSuggestion {
  return {
    id: "suggestion",
    target,
    original: "原文",
    revised: "改写",
    rationale: "理由",
  }
}

describe("locate suggestion target", () => {
  it("resolves an item suggestion to its section and item", () => {
    const document = createResumeDocument()
    const section = document.sections[0]
    const item = section.items[1]

    const target = locateSuggestionTarget(
      document,
      createSuggestion({
        sectionId: section.id,
        itemId: item.id,
        field: "description",
        index: null,
      }),
    )

    expect(target).toEqual({
      sectionId: section.id,
      itemId: item.id,
      linkedTarget: { kind: "item", sectionId: section.id, itemId: item.id },
    })
  })

  it("resolves a summary suggestion to the profile panel", () => {
    const document = createResumeDocument()

    const target = locateSuggestionTarget(
      document,
      createSuggestion({
        sectionId: null,
        itemId: null,
        field: "summary",
        index: null,
      }),
    )

    expect(target).toEqual({
      sectionId: "profile",
      itemId: null,
      linkedTarget: { kind: "profile" },
    })
  })

  it("returns null when the item no longer exists", () => {
    const document = createResumeDocument()
    const section = document.sections[0]

    expect(
      locateSuggestionTarget(
        document,
        createSuggestion({
          sectionId: section.id,
          itemId: "removed-item",
          field: "description",
          index: null,
        }),
      ),
    ).toBeNull()
  })

  it("returns null when the profile summary is empty", () => {
    const document = createResumeDocument()
    document.profile.summary = ""

    expect(
      locateSuggestionTarget(
        document,
        createSuggestion({
          sectionId: null,
          itemId: null,
          field: "summary",
          index: null,
        }),
      ),
    ).toBeNull()
  })
})
