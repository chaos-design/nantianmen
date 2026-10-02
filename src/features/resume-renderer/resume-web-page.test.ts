import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createResumeDocument,
  createResumeSection,
} from "../../shared/resume-schema/resume-schema"
import { ResumeWebPage } from "./resume-web-page"
import {
  calculateFittedNameFontSize,
  getWebResumeSections,
  normalizeExternalUrl,
} from "./web-resume-content"

beforeAll(() => {
  vi.stubGlobal("React", React)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe("web resume name fitting", () => {
  it("keeps the preferred font size when the name already fits", () => {
    expect(calculateFittedNameFontSize(96, 640, 480)).toBe(96)
  })

  it("shrinks the font size when the name exceeds the available width", () => {
    expect(calculateFittedNameFontSize(96, 480, 960)).toBeCloseTo(47.52)
  })

  it("falls back when a measurement is invalid", () => {
    expect(calculateFittedNameFontSize(96, 0, 960)).toBeNull()
    expect(calculateFittedNameFontSize(Number.NaN, 480, 960)).toBeNull()
  })
})

describe("web resume module mapping", () => {
  it("keeps source order while filtering hidden and empty sections", () => {
    const document = createResumeDocument()
    const hidden = {
      ...createResumeSection("project"),
      id: "hidden-project",
      visible: false,
    }
    const empty = {
      ...createResumeSection("custom"),
      id: "empty-custom",
      items: [
        {
          ...createResumeSection("custom").items[0],
          title: " 条目标题 ",
          highlights: [" "],
          skills: [""],
        },
        {
          ...createResumeSection("custom").items[0],
          id: "second-placeholder",
        },
      ],
    }
    const populated = {
      ...createResumeSection("certification"),
      id: "visible-certification",
      items: [
        {
          ...createResumeSection("certification").items[0],
          title: "AWS Certified Solutions Architect",
        },
      ],
    }
    const sections = getWebResumeSections({
      ...document,
      sections: [hidden, document.sections[1], empty, populated],
    })

    expect(sections.map((section) => section.id)).toEqual([
      document.sections[1].id,
      populated.id,
    ])
  })

  it("keeps a placeholder-titled item when another field contains content", () => {
    const custom = createResumeSection("custom")
    const sections = getWebResumeSections({
      ...createResumeDocument(),
      sections: [
        {
          ...custom,
          id: "custom-with-description",
          items: [
            {
              ...custom.items[0],
              description: "分享大型前端工程的性能治理实践。",
            },
          ],
        },
      ],
    })

    expect(sections.map((section) => section.id)).toEqual(["custom-with-description"])
  })

  it("normalizes safe web links and rejects unsupported protocols", () => {
    expect(normalizeExternalUrl("example.com/profile")).toBe(
      "https://example.com/profile",
    )
    expect(normalizeExternalUrl("http://example.com")).toBe("http://example.com/")
    expect(normalizeExternalUrl("javascript:alert(1)")).toBeNull()
    expect(normalizeExternalUrl("")).toBeNull()
  })
})

describe("web resume hero rendering", () => {
  it("renders profile information without an image", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ResumeWebPage, { document: createResumeDocument() }),
    )

    expect(markup).toContain('data-has-hero-asset="false"')
    expect(markup).toContain('class="web-resume-background"')
    expect(markup).toContain('data-gsap-background=""')
    expect(markup).toContain('data-web-motion-scene=""')
    expect(markup).toContain('data-web-motion-stage=""')
    expect(markup).toContain('data-motion-scene="orbit"')
    expect(markup).toContain(">DIGITAL PROFILE<")
    expect(markup).not.toContain("ZH-CN")
    expect(markup).toContain("个人信息")
    expect(markup).not.toContain(">首页<")
    expect(markup).toContain("林知远")
    expect(markup).toContain("高级前端工程师")
    expect(markup).toContain("lin.zhiyuan@example.com")
    expect(markup).not.toContain("web-resume-hero-visual")
    expect(markup).not.toContain("web-resume-hero-fallback")
  })

  it("does not render an image when the document contains image assets", () => {
    const document = createResumeDocument()
    const asset = {
      id: "asset-hero",
      kind: "image" as const,
      name: "portrait.webp",
      mimeType: "image/webp" as const,
      byteSize: 2048,
      width: 1200,
      height: 1600,
      alt: "候选人头像",
    }
    const placement = {
      id: "placement-hero",
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
    const markup = renderToStaticMarkup(
      React.createElement(ResumeWebPage, {
        document: {
          ...document,
          resources: {
            assets: [asset],
            placements: [placement],
          },
        },
      }),
    )

    expect(markup).toContain('data-has-hero-asset="false"')
    expect(markup).not.toContain("web-resume-hero-visual")
    expect(markup).not.toContain("<img")
  })
})
