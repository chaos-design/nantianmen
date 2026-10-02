import { describe, expect, it } from "vitest"
import { formatResumePeriod } from "./resume-period"

describe("resume period", () => {
  it.each([
    {
      startDate: "2022.06",
      endDate: "2024.01",
      current: false,
      expected: "2022.06 - 2024.01",
    },
    {
      startDate: "2022.06",
      endDate: "",
      current: false,
      expected: "2022.06",
    },
    {
      startDate: "",
      endDate: "2024.01",
      current: false,
      expected: "2024.01",
    },
    {
      startDate: "2022.06",
      endDate: "",
      current: true,
      expected: "2022.06 - 至今",
    },
    {
      startDate: "",
      endDate: "",
      current: true,
      expected: "至今",
    },
    {
      startDate: " ",
      endDate: " ",
      current: false,
      expected: "",
    },
  ])("formats $startDate / $endDate / current=$current", ({ expected, ...item }) => {
    expect(formatResumePeriod(item)).toBe(expected)
  })

  it("supports the web separator without adding missing placeholders", () => {
    expect(
      formatResumePeriod(
        {
          startDate: "2022.06",
          endDate: "2024.01",
          current: false,
        },
        " — ",
      ),
    ).toBe("2022.06 — 2024.01")
  })
})
