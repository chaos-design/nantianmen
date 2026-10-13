import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { ResumeImageAsset } from "../../shared/resume-schema/resume-schema"
import {
  buildPrivateAssetUrls,
  privateAssetUrl,
  usePrivateAssetUrls,
} from "./use-private-asset-urls"

const asset = (id: string): ResumeImageAsset => ({
  id,
  kind: "image",
  name: `${id}.png`,
  mimeType: "image/png",
  byteSize: 1024,
  width: 160,
  height: 160,
  alt: "",
})

function renderHook(resumeId: string, assets: ResumeImageAsset[]) {
  function Hook() {
    const urls = usePrivateAssetUrls(resumeId, assets)
    return React.createElement(
      "div",
      null,
      Object.entries(urls).map(([assetId, url]) =>
        React.createElement("span", { key: assetId, "data-asset": assetId }, url),
      ),
    )
  }
  return renderToStaticMarkup(React.createElement(Hook))
}

describe("private asset urls", () => {
  it("derives same-origin API urls from asset ids", () => {
    expect(privateAssetUrl("resume-1", "asset/1")).toBe(
      "/api/resumes/resume-1/assets/asset%2F1",
    )
  })

  it("builds one url per asset", () => {
    const urls = buildPrivateAssetUrls("resume-1", [asset("a"), asset("b")])
    expect(urls).toEqual({
      a: "/api/resumes/resume-1/assets/a",
      b: "/api/resumes/resume-1/assets/b",
    })
  })

  it("renders urls synchronously so SSR can inline them", () => {
    const markup = renderHook("resume-1", [asset("a")])
    expect(markup).toContain('data-asset="a"')
    expect(markup).toContain("/api/resumes/resume-1/assets/a")
  })

  it("renders nothing for an empty asset list", () => {
    expect(renderHook("resume-1", [])).toBe("<div></div>")
  })
})
