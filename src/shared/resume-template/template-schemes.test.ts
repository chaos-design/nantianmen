import { describe, expect, it } from "vitest"
import { applyTemplateScheme } from "../../features/resume-template/apply-template-scheme"
import {
  createResumeDocument,
  parseResumeDocument,
} from "../resume-schema/resume-schema"
import {
  getTemplateAppearanceClass,
  templateIds,
  templateSchemes,
} from "./template-schemes"

describe("template schemes", () => {
  it("provides 24 unique schemes as the template ID source", () => {
    expect(templateSchemes).toHaveLength(24)
    expect(new Set(templateIds).size).toBe(templateSchemes.length)
    expect(templateIds).toEqual(templateSchemes.map((scheme) => scheme.id))
  })

  it("provides valid defaults and reusable appearance classes", () => {
    const document = createResumeDocument()

    for (const scheme of templateSchemes) {
      expect(
        parseResumeDocument({
          ...document,
          template: {
            id: scheme.id,
            theme: scheme.defaults.theme,
          },
          style: scheme.defaults.style,
        }).template.id,
      ).toBe(scheme.id)
      expect(getTemplateAppearanceClass(scheme)).toBe(`template-${scheme.appearance}`)
      expect("sidebar" in scheme).toBe(scheme.layout === "sidebar")
      if ("sidebar" in scheme) {
        expect(scheme.sidebar.width).toBeGreaterThanOrEqual(190)
        expect(scheme.sidebar.background).not.toBe("")
        expect(scheme.sidebar.foreground).toMatch(/^#/)
        expect(scheme.sidebar.muted).toMatch(/^#/)
        expect(scheme.sidebar.highlight).toMatch(/^#/)
      } else {
        expect(scheme.layout).toBe("single")
      }
      if ("pagination" in scheme) {
        const scales = [
          scheme.pagination.contentScale,
          "firstPageScale" in scheme.pagination
            ? scheme.pagination.firstPageScale
            : undefined,
          "continuationPageScale" in scheme.pagination
            ? scheme.pagination.continuationPageScale
            : undefined,
        ].filter((scale) => scale !== undefined)
        expect(scales.every((scale) => scale >= 0.6 && scale <= 1)).toBe(true)
      }
    }
  })

  it("applies scheme presentation defaults without changing resume content", () => {
    const document = createResumeDocument()
    const scheme = templateSchemes.find(({ id }) => id === "finance-ledger")
    if (!scheme) {
      throw new Error("finance-ledger scheme is missing")
    }

    const result = applyTemplateScheme(document, scheme.id)

    expect(result.template).toEqual({
      id: scheme.id,
      theme: scheme.defaults.theme,
    })
    expect(result.style).toEqual(scheme.defaults.style)
    expect(result.profile).toBe(document.profile)
    expect(result.sections).toBe(document.sections)
    expect(result.resources).toBe(document.resources)
  })

  it("creates a default resume from a selected scheme", () => {
    const scheme = templateSchemes.find(({ id }) => id === "creative-split")
    if (!scheme) {
      throw new Error("creative-split scheme is missing")
    }

    const document = createResumeDocument(scheme.id)

    expect(document.template).toEqual({
      id: scheme.id,
      theme: scheme.defaults.theme,
    })
    expect(document.style).toEqual(scheme.defaults.style)
  })
})
