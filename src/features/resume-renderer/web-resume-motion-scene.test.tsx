import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { webTemplateIds } from "../../shared/resume-template/web-template-schemes"
import { WebResumeMotionScene } from "./web-resume-motion-scene"
import { getWebTemplateMotionProfile } from "./web-template-gsap-motion"

beforeAll(() => {
  vi.stubGlobal("React", React)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe("web resume motion scene", () => {
  it("renders only the selected theme scene with three SVG layers", () => {
    for (const templateId of webTemplateIds) {
      const scene = getWebTemplateMotionProfile(templateId).scene
      const markup = renderToStaticMarkup(
        React.createElement(WebResumeMotionScene, { templateId }),
      )

      expect(markup).toContain(`data-motion-scene="${scene}"`)
      expect(markup.match(/<svg/g)).toHaveLength(3)
      expect(markup.match(/data-gsap-layer=/g)).toHaveLength(3)
      expect(markup.match(/focusable="false"/g)).toHaveLength(3)
      expect(markup).toContain('aria-hidden="true"')
    }
  })

  it("uses distinct SVG geometry for all five scene families", () => {
    const representativeTemplates = [
      "digital-archive",
      "editorial-canvas",
      "kinetic-grid",
      "terminal-signal",
      "botanical-editorial",
    ] as const
    const sceneMarkup = representativeTemplates.map((templateId) =>
      renderToStaticMarkup(React.createElement(WebResumeMotionScene, { templateId })),
    )

    expect(new Set(sceneMarkup).size).toBe(representativeTemplates.length)
  })
})
