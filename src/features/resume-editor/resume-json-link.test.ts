import { describe, expect, it } from "vitest"
import { createResumeDocument } from "../../shared/resume-schema/resume-schema"
import { findResumeJsonLink, resolveResumeJsonLinkAtOffset } from "./resume-json-link"

function createFixture() {
  const document = createResumeDocument()
  const value = JSON.stringify(document, null, 2)
  const section = document.sections[0]
  const item = section?.items[0]
  if (!section || !item) {
    throw new Error("测试简历缺少区块或条目")
  }
  return { item, section, value }
}

describe("resume JSON links", () => {
  it("resolves profile, section, and item targets from cursor offsets", () => {
    const { item, section, value } = createFixture()

    const profileLink = resolveResumeJsonLinkAtOffset(value, value.indexOf('"summary"'))
    const sectionLink = resolveResumeJsonLinkAtOffset(
      value,
      value.indexOf(`"id": "${section.id}"`),
    )
    const itemLink = resolveResumeJsonLinkAtOffset(
      value,
      value.indexOf(`"id": "${item.id}"`),
    )

    expect(profileLink?.target).toEqual({ kind: "profile" })
    expect(sectionLink?.target).toEqual({
      kind: "section",
      sectionId: section.id,
    })
    expect(itemLink?.target).toEqual({
      kind: "item",
      sectionId: section.id,
      itemId: item.id,
    })
  })

  it("finds exact JSON node ranges from stable resume IDs", () => {
    const { item, section, value } = createFixture()
    const link = findResumeJsonLink(value, {
      kind: "item",
      sectionId: section.id,
      itemId: item.id,
    })

    expect(link).not.toBeNull()
    expect(
      value.slice(link?.offset, (link?.offset ?? 0) + (link?.length ?? 0)),
    ).toContain(`"id": "${item.id}"`)
  })

  it("does not guess links for metadata or invalid JSON", () => {
    const { value } = createFixture()

    expect(
      resolveResumeJsonLinkAtOffset(value, value.indexOf('"schemaVersion"')),
    ).toBeNull()
    expect(resolveResumeJsonLinkAtOffset('{"profile":', 4)).toBeNull()
    expect(findResumeJsonLink('{"sections":[]}', { kind: "profile" })).toBeNull()
  })
})
