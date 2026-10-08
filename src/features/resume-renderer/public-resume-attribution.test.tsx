import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { landingRepository } from "../landing/landing-footer-links"
import { PublicResumeAttribution } from "./public-resume-attribution"

beforeAll(() => {
  vi.stubGlobal("React", React)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function renderAttribution(tone?: "light" | "dark") {
  return renderToStaticMarkup(
    React.createElement(PublicResumeAttribution, tone ? { tone } : null),
  )
}

describe("public resume attribution", () => {
  it("states the platform attribution and the structured JSON source of truth", () => {
    const markup = renderAttribution()

    expect(markup).toContain("本页面由 Résumé Lab 生成")
    expect(markup).toContain("结构化 JSON 为唯一事实来源")
    expect(markup).toContain('class="public-resume-attribution"')
  })

  it("renders the canonical repository entry that opens in a new window", () => {
    const markup = renderAttribution()

    expect(markup).toContain(`href="${landingRepository.href}"`)
    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('rel="noreferrer"')
    expect(markup).toContain(landingRepository.label)
    expect(markup).toContain(`仓库：${landingRepository.path}（新窗口打开）`)
    // GitHub 标识必须内联，不能退化成外部图片或装饰性图形。
    expect(markup).toContain("<svg")
    expect(markup).not.toContain("<img")
  })

  it("keeps the license line in sync with the landing footer copyright", () => {
    expect(renderAttribution()).toContain("Résumé Lab · Apache-2.0")
  })

  it("marks the dark tone for the web share page and defaults to light", () => {
    expect(renderAttribution()).toContain('data-tone="light"')
    expect(renderAttribution("dark")).toContain('data-tone="dark"')
  })
})
