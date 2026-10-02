import { describe, expect, it } from "vitest"
import { sanitizeRedirectPath } from "./redirect-path"

describe("redirect path", () => {
  it("keeps valid internal paths", () => {
    expect(sanitizeRedirectPath("/editor/abc?mode=web#preview")).toBe(
      "/editor/abc?mode=web#preview",
    )
  })

  it.each([
    null,
    "",
    "editor/abc",
    "//example.com",
    "/\\example.com",
    "https://example.com",
    "javascript:alert(1)",
  ])("falls back for unsafe path %s", (value) => {
    expect(sanitizeRedirectPath(value)).toBe("/workspace")
  })

  /**
   * 回归用例：`..` 归一化会把 `/..//evil.com` 的 pathname 变成 `//evil.com`，
   * 而 `//` 在浏览器里等价于协议相对地址。只检查原始字符串的实现会漏掉这一类输入。
   */
  it.each([
    "/..//evil.com",
    "/..///evil.com",
    "/%2e%2e//evil.com",
    "/%2e%2e/%2e%2e//evil.com",
    "/a/..//evil.com",
    "/workspace/..//evil.com",
    "/..//evil.com/path",
    "/\\..//evil.com",
  ])(
    "rejects dot-segment escapes that normalize to a protocol-relative path: %s",
    (value) => {
      expect(sanitizeRedirectPath(value)).toBe("/workspace")
    },
  )

  it("never returns a value that resolves to an external origin", () => {
    const hostile = [
      "/..//evil.com",
      "/%2e%2e//evil.com",
      "//evil.com",
      "https://evil.com",
      "/..//evil.com?next=/x#y",
    ]

    for (const value of hostile) {
      const resolved = new URL(sanitizeRedirectPath(value), "https://app.example.com")
      expect(resolved.origin).toBe("https://app.example.com")
    }
  })

  it("keeps paths that merely contain dot segments inside the site", () => {
    expect(sanitizeRedirectPath("/editor/../workspace")).toBe("/workspace")
    expect(sanitizeRedirectPath("/a/b/../c")).toBe("/a/c")
    expect(sanitizeRedirectPath("/r/slug/..")).toBe("/r/")
  })

  it("preserves query strings and hashes on safe paths", () => {
    expect(sanitizeRedirectPath("/editor/abc?mode=web#preview")).toBe(
      "/editor/abc?mode=web#preview",
    )
    expect(sanitizeRedirectPath("/reset-password?next=%2Fworkspace")).toBe(
      "/reset-password?next=%2Fworkspace",
    )
  })

  it("supports an explicit safe fallback", () => {
    expect(sanitizeRedirectPath("invalid", "/")).toBe("/")
  })
})
