import { describe, expect, it } from "vitest"
import { parseResumeDocument } from "../resume-schema/resume-schema"
import { templateSchemes } from "../resume-template/template-schemes"
import { webTemplateSchemes } from "../resume-template/web-template-schemes"
import {
  createResumeStyleDefaults,
  createResumeThumbnailDefaults,
  resumeDensityPresets,
  resumeFontStacks,
  resumePalettePresets,
  resumeTypePresets,
} from "./resume-template-tokens"

const hexColorPattern = /^#[0-9a-f]{6}$/i

describe("design tokens", () => {
  it("defines complete resume template token presets", () => {
    expect(Object.keys(resumeFontStacks)).toEqual(["sans", "serif", "mono", "humanist"])

    for (const palette of Object.values(resumePalettePresets)) {
      expect(palette.page).toMatch(hexColorPattern)
      expect(palette.text).toMatch(hexColorPattern)
      expect(palette.muted).toMatch(hexColorPattern)
      expect(palette.accent).toMatch(hexColorPattern)
      expect(palette.rule).toMatch(hexColorPattern)
      expect(palette.surface).toMatch(hexColorPattern)
    }

    for (const density of Object.values(resumeDensityPresets)) {
      expect(density.pageMargin).toBeGreaterThanOrEqual(32)
      expect(density.pageMargin).toBeLessThanOrEqual(96)
      expect(density.sectionGap).toBeGreaterThanOrEqual(12)
      expect(density.sectionGap).toBeLessThanOrEqual(48)
      expect(density.lineHeight).toBeGreaterThanOrEqual(1.2)
      expect(density.lineHeight).toBeLessThanOrEqual(2.2)
    }
  })

  it("derives resume defaults that stay compatible with the resume schema", () => {
    const style = createResumeStyleDefaults({
      palette: "teal",
      type: "sansComfortable",
      density: "comfortable",
    })

    expect(
      parseResumeDocument({
        schemaVersion: "1.0.0",
        metadata: { title: "Token Test" },
        template: { id: "modern-minimal", theme: { accent: "teal" } },
        style,
        profile: {},
        sections: [],
      }).style,
    ).toEqual(style)

    expect(
      createResumeThumbnailDefaults({
        palette: "teal",
        density: "comfortable",
      }),
    ).toMatchObject({
      page: resumePalettePresets.teal.page,
      accent: resumePalettePresets.teal.accent,
    })
  })

  it("keeps existing A4 and Web template exports structurally compatible", () => {
    for (const scheme of templateSchemes) {
      expect(scheme.defaults.style.baseFontSize).toBeGreaterThanOrEqual(9)
      expect(scheme.defaults.style.baseFontSize).toBeLessThanOrEqual(18)
      expect(scheme.defaults.style.textColor).toMatch(hexColorPattern)
      expect(scheme.defaults.style.accentColor).toMatch(hexColorPattern)
      expect(scheme.defaults.style.pageBackground).toMatch(hexColorPattern)
    }

    for (const scheme of webTemplateSchemes) {
      expect(scheme.fontFamily).toBeTruthy()
      expect(scheme.colors.background).toMatch(hexColorPattern)
      expect(scheme.colors.surface).toMatch(hexColorPattern)
      expect(scheme.colors.text).toMatch(hexColorPattern)
      expect(scheme.colors.muted).toMatch(hexColorPattern)
      expect(scheme.colors.accent).toMatch(hexColorPattern)
      expect(scheme.colors.grid).toMatch(hexColorPattern)
    }

    expect(Object.keys(resumeTypePresets)).toContain("sansComfortable")
  })
})
