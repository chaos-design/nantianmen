import { fontStacks, foundationColors, resumeSpaceScale } from "./foundation-tokens"

export type ResumeFontRole = "sans" | "serif" | "mono" | "humanist"
export type ResumePaletteId =
  | "teal"
  | "blue"
  | "amber"
  | "rose"
  | "mono"
  | "noir"
  | "paper"
  | "signal"

export type ResumeDensityId = "compact" | "comfortable"

export const resumeFontStacks: Record<ResumeFontRole, string> = {
  sans: fontStacks.resumeSans,
  serif: fontStacks.resumeSerif,
  mono: fontStacks.resumeMono,
  humanist: fontStacks.resumeHumanist,
}

export const resumePalettePresets = {
  teal: {
    page: foundationColors.paper.white,
    text: foundationColors.ink.neutral,
    muted: "#9aa5a3",
    accent: "#157d72",
    rule: "#d7dddc",
    surface: "#dceeea",
    inverseText: "#fffaf7",
    inverseSurface: "#153832",
  },
  blue: {
    page: foundationColors.paper.ivory,
    text: foundationColors.ink.slate,
    muted: "#949ca3",
    accent: "#354f68",
    rule: "#d4dade",
    surface: "#dfe6eb",
    inverseText: "#f6fbff",
    inverseSurface: "#1e3348",
  },
  amber: {
    page: foundationColors.paper.warm,
    text: foundationColors.ink.warm,
    muted: "#9d9388",
    accent: "#8a6542",
    rule: "#d7cdbf",
    surface: "#eee4d5",
    inverseText: "#fff8ec",
    inverseSurface: "#42311f",
  },
  rose: {
    page: "#fbfaf7",
    text: "#222831",
    muted: "#8b9096",
    accent: "#c95c68",
    rule: "#ddd9d2",
    surface: "#f1e2df",
    inverseText: "#fff8f7",
    inverseSurface: "#852f43",
  },
  mono: {
    page: "#f7f7f2",
    text: "#161a1d",
    muted: "#747a7d",
    accent: "#2f5f5a",
    rule: "#d8ddd8",
    surface: "#eeeeea",
    inverseText: "#eef5f2",
    inverseSurface: "#1e2428",
  },
  noir: {
    page: "#11100e",
    text: "#f2eadc",
    muted: "#b2a994",
    accent: "#c9a45d",
    rule: "#76684e",
    surface: "#1b1916",
    inverseText: "#11100e",
    inverseSurface: "#f2eadc",
  },
  paper: {
    page: foundationColors.paper.journal,
    text: "#302820",
    muted: "#74685a",
    accent: "#8e3f32",
    rule: "#9e8d78",
    surface: "#eee6d7",
    inverseText: "#fbf5e8",
    inverseSurface: "#5a382d",
  },
  signal: {
    page: "#071317",
    text: "#d6e4e1",
    muted: "#6f8d87",
    accent: "#27d6a9",
    rule: "#34524c",
    surface: "#13352f",
    inverseText: "#dfffee",
    inverseSurface: "#04100c",
  },
} as const

export const resumeDensityPresets = {
  compact: {
    pageMargin: resumeSpaceScale.px60,
    sectionGap: resumeSpaceScale.px18,
    itemGap: resumeSpaceScale.px10,
    lineHeight: 1.55,
    paginationScale: 0.92,
  },
  comfortable: {
    pageMargin: resumeSpaceScale.px70,
    sectionGap: resumeSpaceScale.px26,
    itemGap: resumeSpaceScale.px16,
    lineHeight: 1.65,
    paginationScale: 0.96,
  },
} as const

export const resumeTypePresets = {
  sansComfortable: {
    fontFamily: "sans",
    baseFontSize: 12,
    lineHeight: 1.65,
    titleScale: 3.5,
    metaScale: 0.75,
  },
  serifComfortable: {
    fontFamily: "serif",
    baseFontSize: 12,
    lineHeight: 1.7,
    titleScale: 3.5,
    metaScale: 0.75,
  },
  monoCompact: {
    fontFamily: "mono",
    baseFontSize: 11,
    lineHeight: 1.55,
    titleScale: 3.2,
    metaScale: 0.72,
  },
  humanistComfortable: {
    fontFamily: "humanist",
    baseFontSize: 12,
    lineHeight: 1.66,
    titleScale: 3.4,
    metaScale: 0.75,
  },
} as const satisfies Record<
  string,
  {
    fontFamily: ResumeFontRole
    baseFontSize: number
    lineHeight: number
    titleScale: number
    metaScale: number
  }
>

export interface ResumeStyleDefaults {
  fontFamily: ResumeFontRole
  baseFontSize: number
  lineHeight: number
  textColor: string
  accentColor: string
  pageBackground: string
  pageMargin: number
  sectionGap: number
}

export interface ResumeThumbnailDefaults {
  density: ResumeDensityId
  composition: "standard" | "editorial"
  page: string
  sidebar: string
  accent: string
  title: string
  copy: string
  rule: string
}

export function createResumeStyleDefaults(input: {
  palette: ResumePaletteId
  type: keyof typeof resumeTypePresets
  density: ResumeDensityId
  overrides?: Partial<ResumeStyleDefaults>
}): ResumeStyleDefaults {
  const palette = resumePalettePresets[input.palette]
  const type = resumeTypePresets[input.type]
  const density = resumeDensityPresets[input.density]

  return {
    fontFamily: type.fontFamily,
    baseFontSize: type.baseFontSize,
    lineHeight: type.lineHeight || density.lineHeight,
    textColor: palette.text,
    accentColor: palette.accent,
    pageBackground: palette.page,
    pageMargin: density.pageMargin,
    sectionGap: density.sectionGap,
    ...input.overrides,
  }
}

export function createResumeThumbnailDefaults(input: {
  palette: ResumePaletteId
  density: ResumeDensityId
  composition?: "standard" | "editorial"
  sidebarPalette?: ResumePaletteId
  overrides?: Partial<ResumeThumbnailDefaults>
}): ResumeThumbnailDefaults {
  const palette = resumePalettePresets[input.palette]
  const sidebarPalette = input.sidebarPalette
    ? resumePalettePresets[input.sidebarPalette]
    : palette

  return {
    density: input.density,
    composition: input.composition ?? "standard",
    page: palette.page,
    sidebar: sidebarPalette.surface,
    accent: palette.accent,
    title: palette.text,
    copy: palette.muted,
    rule: palette.rule,
    ...input.overrides,
  }
}
