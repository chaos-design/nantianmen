import { describe, expect, it } from "vitest"
import {
  calculateCarouselScrollPosition,
  LANDING_TEMPLATE_CAROUSEL_SPEED,
} from "./landing-template-grid"

describe("landing template carousel", () => {
  it("advances by elapsed time and configured speed", () => {
    expect(calculateCarouselScrollPosition(120, 1000, 50)).toBe(
      120 + (LANDING_TEMPLATE_CAROUSEL_SPEED * 50) / 1000,
    )
  })

  it("wraps seamlessly after crossing the source group width", () => {
    expect(calculateCarouselScrollPosition(998, 1000, 64, 40)).toBeCloseTo(0.56)
  })

  it("caps long frames to prevent large jumps", () => {
    expect(calculateCarouselScrollPosition(0, 1000, 2000, 100)).toBe(6.4)
  })

  it("keeps a safe position when dimensions or timing are invalid", () => {
    expect(calculateCarouselScrollPosition(120, 0, 16)).toBe(120)
    expect(calculateCarouselScrollPosition(Number.NaN, 1000, 16)).toBeCloseTo(
      (LANDING_TEMPLATE_CAROUSEL_SPEED * 16) / 1000,
    )
    expect(calculateCarouselScrollPosition(120, 1000, -1)).toBe(120)
  })
})
