import { describe, expect, it } from "vitest"
import { resolveLandingNavLineSide } from "./landing-nav-links"

describe("landing nav line direction", () => {
  it("uses the pointer half to resolve the underline direction", () => {
    expect(resolveLandingNavLineSide(124, 100, 80)).toBe("left")
    expect(resolveLandingNavLineSide(176, 100, 80)).toBe("right")
  })
})
