import { describe, expect, it } from "vitest"
import {
  defaultWebTemplateId,
  getWebTemplateScheme,
  resolveWebTemplateId,
  webTemplateIds,
  webTemplateSchemes,
} from "./web-template-schemes"

describe("web template schemes", () => {
  it("defines 20 complete templates with unique ids and names", () => {
    expect(webTemplateSchemes).toHaveLength(20)
    expect(new Set(webTemplateIds).size).toBe(20)
    expect(new Set(webTemplateSchemes.map((scheme) => scheme.name)).size).toBe(20)

    for (const scheme of webTemplateSchemes) {
      expect(scheme.name).toBeTruthy()
      expect(scheme.description).toBeTruthy()
      expect(scheme.colors.text).toMatch(/^#[0-9a-f]{6}$/i)
      expect(scheme.colors.accent).toMatch(/^#[0-9a-f]{6}$/i)
      expect(scheme.thumbnail.background).toMatch(/^#[0-9a-f]{6}$/i)
      expect(scheme.thumbnail.surface).toMatch(/^#[0-9a-f]{6}$/i)
      expect(scheme.thumbnail.text).toMatch(/^#[0-9a-f]{6}$/i)
      expect(scheme.thumbnail.muted).toMatch(/^#[0-9a-f]{6}$/i)
      expect(scheme.thumbnail.accent).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it("covers all six supported compositions", () => {
    expect(new Set(webTemplateSchemes.map((scheme) => scheme.composition))).toEqual(
      new Set(["archive", "editorial", "grid", "mosaic", "poster", "studio"]),
    )
  })

  it("resolves every curated template id", () => {
    for (const templateId of webTemplateIds) {
      expect(getWebTemplateScheme(templateId).id).toBe(templateId)
      expect(resolveWebTemplateId(templateId)).toBe(templateId)
    }
  })

  it("migrates consolidated template ids to the nearest curated template", () => {
    const migrations = {
      "stellar-archive": "digital-archive",
      "citrus-grid": "kinetic-grid",
      "violet-circuit": "midnight-product",
      "linen-studio": "portfolio-studio",
      "blueprint-engineer": "terminal-signal",
      "oceanic-console": "terminal-signal",
      "museum-catalog": "editorial-canvas",
      "neon-lab": "aurora-glass",
    } as const

    for (const [legacyId, templateId] of Object.entries(migrations)) {
      expect(resolveWebTemplateId(legacyId)).toBe(templateId)
    }
  })

  it("returns the requested scheme and a stable fallback", () => {
    expect(getWebTemplateScheme("terminal-signal").id).toBe("terminal-signal")
    expect(getWebTemplateScheme("unknown" as (typeof webTemplateIds)[number]).id).toBe(
      "digital-archive",
    )
    expect(resolveWebTemplateId("aurora-glass")).toBe("aurora-glass")
    expect(resolveWebTemplateId("unknown")).toBe(defaultWebTemplateId)
    expect(resolveWebTemplateId(["terminal-signal"])).toBe(defaultWebTemplateId)
  })
})
