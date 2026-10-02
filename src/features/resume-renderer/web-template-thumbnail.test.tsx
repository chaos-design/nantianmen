import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { webTemplateSchemes } from "../../shared/resume-template/web-template-schemes"
import { WebTemplateThumbnail } from "./web-template-thumbnail"

beforeAll(() => {
  vi.stubGlobal("React", React)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe("web template thumbnail", () => {
  it("renders a local CSS cover for every web template", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        webTemplateSchemes.map((scheme) =>
          React.createElement(WebTemplateThumbnail, {
            key: scheme.id,
            scheme,
          }),
        ),
      ),
    )

    expect(markup.match(/web-template-thumbnail-media/g)).toHaveLength(
      webTemplateSchemes.length,
    )
    expect(markup).not.toContain("<img")
    expect(markup).not.toContain("http://")
    expect(markup).not.toContain("https://")
  })
})
