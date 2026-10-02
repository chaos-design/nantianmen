import { describe, expect, it } from "vitest"
import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  createResumeDocument,
  createResumeItem,
  createResumeSection,
  parseResumeDocument,
  sectionTypeLabels,
  sectionTypes,
  templateIds,
} from "./resume-schema"

function countSentences(value: string): number {
  return value.match(/[。！？]/g)?.length ?? 0
}

describe("resume schema", () => {
  it("creates a complete versioned document", () => {
    const document = createResumeDocument()

    expect(parseResumeDocument(document)).toEqual(document)
    expect(document.schemaVersion).toBe("1.0.0")
    expect(templateIds).toContain(document.template.id)
    expect(templateIds).toHaveLength(24)
    expect("webTemplateId" in document).toBe(false)
    expect(document.style.pageMargin).toBe(70)
    expect(document.sections).toHaveLength(5)
    expect(new Set(document.sections.map((section) => section.id)).size).toBe(5)
    expect(document.sections.flatMap((section) => section.items)).toHaveLength(9)
    expect(document.profile.email).toMatch(/@example\.com$/)
    expect(document.profile.location).toBe("北京")
    expect(document.profile.website).toBe("https://github.com/Rain120")
    expect(
      document.sections
        .flatMap((section) => section.items)
        .every((item) => !item.location || item.location === "北京"),
    ).toBe(true)
    expect(
      document.sections
        .flatMap((section) => section.items)
        .every((item) => !item.url || item.url === "https://github.com/Rain120"),
    ).toBe(true)
    expect(document.profile.summary).toContain("7 年")
    expect(countSentences(document.profile.summary)).toBeGreaterThanOrEqual(3)
    expect(
      document.sections.flatMap((section) =>
        section.items.flatMap((item) => item.highlights),
      ).length,
    ).toBeGreaterThanOrEqual(15)
    expect(
      document.sections
        .find((section) => section.type === "workExperience")
        ?.items.every((item) => item.description.length >= 50),
    ).toBe(true)
    expect(
      document.sections
        .filter((section) => section.type !== "skills")
        .flatMap((section) => section.items)
        .every((item) => countSentences(item.description) >= 2),
    ).toBe(true)
  })

  it.each(sectionTypes)("creates a valid %s section and item", (type) => {
    const section = createResumeSection(type)
    const item = createResumeItem(type)

    expect(section.type).toBe(type)
    expect(section.title).toBe(sectionTypeLabels[type])
    expect(section.items).toHaveLength(1)
    expect(item.id).toMatch(/^item-/)
    expect(() =>
      parseResumeDocument({
        ...createResumeDocument(),
        sections: [{ ...section, items: [item] }],
      }),
    ).not.toThrow()
  })

  it("rejects unknown templates and arbitrary HTML-shaped data", () => {
    const document = createResumeDocument()

    expect(() =>
      parseResumeDocument({
        ...document,
        template: { ...document.template, id: "unknown-template" },
      }),
    ).toThrow()
    expect(() =>
      parseResumeDocument({
        ...document,
        sections: [
          ...document.sections,
          {
            id: "unsafe",
            type: "html",
            title: "Unsafe",
            visible: true,
            items: [],
          },
        ],
      }),
    ).toThrow()
  })

  it("applies safe defaults to imported JSON", () => {
    const document = createResumeDocument()
    const { resources: _resources, style: _documentStyle, ...legacyDocument } = document
    const parsed = parseResumeDocument({
      ...legacyDocument,
      profile: { name: "候选人" },
      metadata: { title: "导入简历" },
      template: { id: "modern-minimal", theme: {} },
      sections: legacyDocument.sections.map(
        ({ style: _sectionStyle, ...section }) => section,
      ),
    })

    expect(parsed.profile.summary).toBe("")
    expect(parsed.metadata.locale).toBe("zh-CN")
    expect(parsed.template.theme.density).toBe("comfortable")
    expect(parsed.style.fontFamily).toBe("sans")
    expect(parsed.style.accentColor).toBe("#157d72")
    expect(parsed.sections[0].style.preset).toBe("default")
    expect(parsed.resources).toEqual({ assets: [], placements: [] })
  })

  it("validates image resource references and A4 placement boundaries", () => {
    const document = createResumeDocument()
    const asset = {
      id: "asset-1",
      kind: "image" as const,
      name: "portrait.webp",
      mimeType: "image/webp" as const,
      byteSize: 2048,
      width: 1200,
      height: 1600,
      alt: "候选人头像",
    }
    const placement = {
      id: "placement-1",
      assetId: asset.id,
      pageIndex: 0,
      x: 650,
      y: 40,
      width: 144,
      height: 144,
      zIndex: 1,
      objectFit: "cover" as const,
      shape: "circle" as const,
    }

    expect(
      parseResumeDocument({
        ...document,
        resources: {
          assets: [asset],
          placements: [placement],
        },
      }).resources.placements[0],
    ).toEqual(placement)

    expect(() =>
      parseResumeDocument({
        ...document,
        resources: {
          assets: [asset],
          placements: [{ ...placement, assetId: "asset-missing" }],
        },
      }),
    ).toThrow()
    expect(() =>
      parseResumeDocument({
        ...document,
        resources: {
          assets: [asset],
          placements: [{ ...placement, x: 651 }],
        },
      }),
    ).toThrow()
    expect(() =>
      parseResumeDocument({
        ...document,
        resources: {
          assets: [asset, asset],
          placements: [placement, placement],
        },
      }),
    ).toThrow()
    expect(() =>
      parseResumeDocument({
        ...document,
        resources: {
          assets: [asset],
          placements: [{ ...placement, y: 980 }],
        },
      }),
    ).toThrow()
  })

  it("accepts zero-sized image placements at the A4 boundaries", () => {
    const document = createResumeDocument()
    const asset = {
      id: "asset-zero",
      kind: "image" as const,
      name: "hidden.png",
      mimeType: "image/png" as const,
      byteSize: 1024,
      width: 100,
      height: 100,
      alt: "",
    }
    const placement = {
      id: "placement-zero",
      assetId: asset.id,
      pageIndex: 0,
      x: A4_PAGE_WIDTH,
      y: A4_PAGE_HEIGHT,
      width: 0,
      height: 0,
      zIndex: 0,
      objectFit: "contain" as const,
      shape: "rectangle" as const,
    }

    expect(
      parseResumeDocument({
        ...document,
        resources: {
          assets: [asset],
          placements: [placement],
        },
      }).resources.placements[0],
    ).toEqual(placement)
  })
})
