import { describe, expect, it } from "vitest"
import {
  createResumeDocument,
  type ResumeSection,
} from "../../shared/resume-schema/resume-schema"
import { reorderSections } from "./reorder-sections"

function sectionIds(sections: ResumeSection[]): string[] {
  return sections.map((section) => section.id)
}

describe("reorder sections", () => {
  it("moves the dragged section to the target position", () => {
    const sections = createResumeDocument().sections
    const [first, second] = sections

    const reordered = reorderSections(sections, first.id, second.id)

    expect(sectionIds(reordered)).toEqual([
      second.id,
      first.id,
      ...sectionIds(sections).slice(2),
    ])
  })

  it("moves a section upwards across several positions", () => {
    const sections = createResumeDocument().sections
    const [first, second, third] = sections

    const reordered = reorderSections(sections, third.id, first.id)

    expect(sectionIds(reordered)).toEqual([
      third.id,
      first.id,
      second.id,
      ...sectionIds(sections).slice(3),
    ])
  })

  it("keeps the original array when the drop target is the source", () => {
    const sections = createResumeDocument().sections

    expect(reorderSections(sections, sections[0].id, sections[0].id)).toBe(sections)
  })

  it("keeps the original array for unknown ids", () => {
    const sections = createResumeDocument().sections

    expect(reorderSections(sections, "missing", sections[0].id)).toBe(sections)
    expect(reorderSections(sections, sections[0].id, "missing")).toBe(sections)
  })
})
