export const fontStacks = {
  ui: '"Avenir Next", "Segoe UI", "PingFang SC", sans-serif',
  display: '"Iowan Old Style", "Songti SC", Georgia, serif',
  code: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  resumeSans: '"Avenir Next", "PingFang SC", sans-serif',
  resumeSerif: '"Iowan Old Style", "Songti SC", Georgia, serif',
  resumeMono: '"SFMono-Regular", Consolas, "PingFang SC", monospace',
  resumeHumanist: '"Gill Sans", "Avenir Next", "PingFang SC", sans-serif',
} as const

export const resumeSpaceScale = {
  px4: 4,
  px6: 6,
  px8: 8,
  px10: 10,
  px12: 12,
  px16: 16,
  px18: 18,
  px20: 20,
  px24: 24,
  px26: 26,
  px28: 28,
  px32: 32,
  px40: 40,
  px48: 48,
  px60: 60,
  px70: 70,
  px82: 82,
  px96: 96,
} as const

export const foundationColors = {
  neutralSlate: {
    950: "oklch(0.14 0.018 248)",
    925: "oklch(0.16 0.018 248)",
    900: "oklch(0.18 0.018 248)",
    875: "oklch(0.19 0.02 248)",
    850: "oklch(0.22 0.018 248)",
    800: "oklch(0.23 0.024 245)",
    760: "oklch(0.26 0.035 190)",
    700: "oklch(0.31 0.025 245)",
    420: "oklch(0.7 0.025 225)",
    120: "oklch(0.92 0.014 205)",
    80: "oklch(0.95 0.012 205)",
  },
  teal: {
    700: "oklch(0.72 0.12 172)",
    650: "oklch(0.78 0.14 172)",
    120: "oklch(0.13 0.03 205)",
  },
  blue: {
    650: "oklch(0.69 0.13 225)",
  },
  amber: {
    650: "oklch(0.73 0.14 75)",
  },
  rose: {
    650: "oklch(0.67 0.17 330)",
  },
  red: {
    650: "oklch(0.63 0.2 25)",
  },
  paper: {
    white: "#ffffff",
    warm: "#fffdf8",
    ivory: "#fffdf9",
    journal: "#fbf5e8",
  },
  ink: {
    black: "#111419",
    neutral: "#17201f",
    warm: "#2a241e",
    slate: "#252b31",
  },
} as const
