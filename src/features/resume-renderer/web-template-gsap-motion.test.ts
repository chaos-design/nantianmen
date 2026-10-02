import { describe, expect, it } from "vitest"
import { webTemplateIds } from "../../shared/resume-template/web-template-schemes"
import {
  getWebTemplateMotionProfile,
  getWebTemplateScrollMotion,
  webTemplateMotionProfiles,
} from "./web-template-gsap-motion"

describe("web template GSAP motion profiles", () => {
  it("defines a distinct profile for every web template", () => {
    const profileIds = Object.keys(webTemplateMotionProfiles).sort()
    const templateIds = [...webTemplateIds].sort()
    const families = webTemplateIds.map(
      (templateId) => getWebTemplateMotionProfile(templateId).family,
    )

    expect(profileIds).toEqual(templateIds)
    expect(new Set(families).size).toBe(webTemplateIds.length)
  })

  it("maps every template to one of the five SVG scene families", () => {
    const scenes = webTemplateIds.map(
      (templateId) => getWebTemplateMotionProfile(templateId).scene,
    )

    expect(new Set(scenes)).toEqual(
      new Set(["orbit", "editorial", "geometry", "signal", "organic"]),
    )
    expect(getWebTemplateMotionProfile("digital-archive").scene).toBe("orbit")
    expect(getWebTemplateMotionProfile("editorial-canvas").scene).toBe("editorial")
    expect(getWebTemplateMotionProfile("kinetic-grid").scene).toBe("geometry")
    expect(getWebTemplateMotionProfile("terminal-signal").scene).toBe("signal")
    expect(getWebTemplateMotionProfile("botanical-editorial").scene).toBe("organic")
  })

  it("keeps decorative motion inside safe amplitude and duration bounds", () => {
    for (const templateId of webTemplateIds) {
      const profile = getWebTemplateMotionProfile(templateId)

      expect(Math.abs(profile.intro.x)).toBeLessThanOrEqual(36)
      expect(Math.abs(profile.intro.y)).toBeLessThanOrEqual(30)
      expect(Math.abs(profile.intro.rotation)).toBeLessThanOrEqual(5)
      expect(profile.intro.scale).toBeGreaterThanOrEqual(0.94)
      expect(profile.intro.scale).toBeLessThanOrEqual(1)
      expect(profile.intro.duration).toBeGreaterThanOrEqual(0.8)
      expect(profile.intro.duration).toBeLessThanOrEqual(1.4)
      expect(profile.intro.stagger).toBeGreaterThanOrEqual(0.06)
      expect(profile.intro.stagger).toBeLessThanOrEqual(0.18)

      for (const vector of [profile.frame, profile.flow, profile.points]) {
        expect(Math.abs(vector.x)).toBeLessThanOrEqual(16)
        expect(Math.abs(vector.y)).toBeLessThanOrEqual(20)
        expect(Math.abs(vector.rotation)).toBeLessThanOrEqual(8)
        expect(vector.scale).toBeGreaterThanOrEqual(0.96)
        expect(vector.scale).toBeLessThanOrEqual(1.04)
        expect(vector.duration).toBeGreaterThanOrEqual(4)
        expect(vector.duration).toBeLessThanOrEqual(18)
      }
    }
  })

  it("derives clamped scroll parallax from each template motion profile", () => {
    const endMotion = getWebTemplateScrollMotion("mono-brutalist", 1)
    const startMotion = getWebTemplateScrollMotion("mono-brutalist", -1)

    expect(endMotion.x).toBeCloseTo(9.6)
    expect(endMotion.y).toBe(-37)
    expect(endMotion.rotation).toBeCloseTo(-0.525)
    expect(startMotion.x).toBe(0)
    expect(startMotion.y).toBe(0)
    expect(startMotion.rotation).toBe(0)
    expect(getWebTemplateScrollMotion("mono-brutalist", 2)).toEqual(endMotion)
    expect(getWebTemplateScrollMotion("mono-brutalist", Number.NaN)).toEqual(
      startMotion,
    )
  })
})
