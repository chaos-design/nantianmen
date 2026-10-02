import { describe, expect, it } from "vitest"
import {
  clampLeftPanelWidth,
  getMaximumLeftPanelWidth,
  MIN_LEFT_PANEL_WIDTH,
} from "./editor-panel-resizer"

describe("editor panel width", () => {
  it("uses forty percent of the viewport as the maximum", () => {
    expect(getMaximumLeftPanelWidth(1600)).toBe(640)
    expect(getMaximumLeftPanelWidth(1000)).toBe(400)
  })

  it("never allows a maximum below the minimum width", () => {
    expect(getMaximumLeftPanelWidth(600)).toBe(MIN_LEFT_PANEL_WIDTH)
  })

  it("clamps and rounds resized widths", () => {
    expect(clampLeftPanelWidth(260, 1600)).toBe(300)
    expect(clampLeftPanelWidth(482.6, 1600)).toBe(483)
    expect(clampLeftPanelWidth(800, 1600)).toBe(640)
  })
})
