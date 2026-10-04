import { describe, expect, it } from "vitest"
import {
  formatLandingFooterCopyright,
  landingLegalLinks,
  landingRepository,
} from "./landing-footer-links"

describe("landing footer links", () => {
  it("points the repository entry at the canonical GitHub URL", () => {
    const url = new URL(landingRepository.href)

    expect(url.protocol).toBe("https:")
    expect(url.host).toBe("github.com")
    expect(url.pathname).toBe("/chaos-design/nantianmen")
    expect(landingRepository.path).toBe("chaos-design/nantianmen")
  })

  it("keeps the legal entries pointing at the site legal pages", () => {
    expect(landingLegalLinks.map((item) => item.href)).toEqual(["/terms", "/privacy"])
    expect(landingLegalLinks.every((item) => item.label.length > 0)).toBe(true)
  })

  it("renders the copyright line with the requested year", () => {
    expect(formatLandingFooterCopyright(2026)).toBe("© 2026 Résumé Lab · Apache-2.0")
  })
})
