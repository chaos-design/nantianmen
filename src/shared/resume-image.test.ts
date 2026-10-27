import { describe, expect, it } from "vitest"
import {
  parseResumeImageWidth,
  resumeImageWidthFor,
  withPrivateImageWidth,
} from "./resume-image"

describe("resumeImageWidthFor", () => {
  it("按 2 倍像素密度取档", () => {
    expect(resumeImageWidthFor(200)).toBe(480)
    expect(resumeImageWidthFor(320)).toBe(640)
    expect(resumeImageWidthFor(500)).toBe(1280)
  })

  it("超过最大档位时封顶，不会返回 undefined", () => {
    expect(resumeImageWidthFor(4000)).toBe(1280)
  })

  it("宽度为 0 或负数时给最小档位，避免拼出 w=0", () => {
    expect(resumeImageWidthFor(0)).toBe(320)
    expect(resumeImageWidthFor(-10)).toBe(320)
  })
})

describe("withPrivateImageWidth", () => {
  it("给私有资源地址追加宽度档位", () => {
    expect(withPrivateImageWidth("/api/resumes/resume-1/assets/asset-1", 500)).toBe(
      "/api/resumes/resume-1/assets/asset-1?w=1280",
    )
  })

  it("已有的查询串用 & 续接", () => {
    expect(withPrivateImageWidth("/api/resumes/r/assets/a?x=1", 160)).toBe(
      "/api/resumes/r/assets/a?x=1&w=320",
    )
  })

  it("公开快照和外部地址保持原样", () => {
    expect(withPrivateImageWidth("/api/public-resumes/slug/assets/a", 500)).toBe(
      "/api/public-resumes/slug/assets/a",
    )
    expect(withPrivateImageWidth("https://cdn.example/a.png", 500)).toBe(
      "https://cdn.example/a.png",
    )
  })

  it("零尺寸占位不加参数（否则会拉一份用不上的图）", () => {
    expect(withPrivateImageWidth("/api/resumes/r/assets/a", 0)).toBe(
      "/api/resumes/r/assets/a",
    )
  })
})

describe("parseResumeImageWidth", () => {
  it("只接受档位内的整数", () => {
    expect(parseResumeImageWidth("640")).toBe(640)
    expect(parseResumeImageWidth("1280")).toBe(1280)
  })

  it("越界、非整数、空值都当作没有", () => {
    expect(parseResumeImageWidth("700")).toBeNull()
    expect(parseResumeImageWidth("640.5")).toBeNull()
    expect(parseResumeImageWidth("abc")).toBeNull()
    expect(parseResumeImageWidth("")).toBeNull()
    expect(parseResumeImageWidth(null)).toBeNull()
  })
})
