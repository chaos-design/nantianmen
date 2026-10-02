import {
  createResumeStyleDefaults,
  createResumeThumbnailDefaults,
  type ResumeDensityId,
  type ResumePaletteId,
} from "../design-tokens/resume-template-tokens"

export type TemplateLayout = "single" | "sidebar"

export type TemplateAppearance =
  | "modern"
  | "tech"
  | "classic"
  | "creative"
  | "executive"
  | "editorial"
  | "compact"
  | "academic"
  | "clean-sidebar"
  | "bold-product"
  | "finance"
  | "legal"
  | "clinical"
  | "growth"
  | "portfolio"
  | "global"
  | "civic"
  | "one-page"
  | "consulting"
  | "education"
  | "industrial"
  | "data-lab"
  | "hospitality"
  | "luxury"

export interface TemplateScheme {
  id: string
  name: string
  category: string
  description: string
  layout: TemplateLayout
  appearance: TemplateAppearance
  sidebar?: {
    width: number
    background: string
    foreground: string
    muted: string
    highlight: string
  }
  pagination?: {
    contentScale: number
    firstPageScale?: number
    continuationPageScale?: number
  }
  defaults: {
    theme: {
      accent: "teal" | "blue" | "amber" | "rose"
      density: "compact" | "comfortable"
    }
    style: {
      fontFamily: "sans" | "serif" | "mono" | "humanist"
      baseFontSize: number
      lineHeight: number
      textColor: string
      accentColor: string
      pageBackground: string
      pageMargin: number
      sectionGap: number
    }
  }
  thumbnail: {
    density: "compact" | "comfortable"
    composition: "standard" | "editorial"
    page: string
    sidebar: string
    accent: string
    title: string
    copy: string
    rule: string
  }
}

function getTemplatePaletteId(accent: TemplateScheme["defaults"]["theme"]["accent"]) {
  return accent satisfies ResumePaletteId
}

function getTemplateTypePreset(
  fontFamily: TemplateScheme["defaults"]["style"]["fontFamily"],
  density: ResumeDensityId,
) {
  if (fontFamily === "mono") {
    return "monoCompact"
  }
  if (fontFamily === "serif") {
    return "serifComfortable"
  }
  if (fontFamily === "humanist") {
    return "humanistComfortable"
  }
  return density === "compact" ? "monoCompact" : "sansComfortable"
}

function normalizeTemplateScheme<T extends TemplateScheme>(scheme: T): T {
  const palette = getTemplatePaletteId(scheme.defaults.theme.accent)
  const density = scheme.defaults.theme.density
  return {
    ...scheme,
    defaults: {
      ...scheme.defaults,
      style: createResumeStyleDefaults({
        palette,
        type: getTemplateTypePreset(scheme.defaults.style.fontFamily, density),
        density,
        overrides: scheme.defaults.style,
      }),
    },
    thumbnail: createResumeThumbnailDefaults({
      palette,
      density,
      composition: scheme.thumbnail.composition,
      overrides: scheme.thumbnail,
    }),
  } as T
}

const rawTemplateSchemes = [
  {
    id: "modern-minimal",
    name: "现代极简",
    category: "通用",
    description: "清晰单列、强调成果与阅读节奏",
    layout: "single",
    appearance: "modern",
    pagination: { contentScale: 0.96, firstPageScale: 0.94 },
    defaults: {
      theme: { accent: "teal", density: "comfortable" },
      style: createResumeStyleDefaults({
        palette: "teal",
        type: "sansComfortable",
        density: "comfortable",
      }),
    },
    thumbnail: createResumeThumbnailDefaults({
      palette: "teal",
      density: "comfortable",
      overrides: { title: "#34413f" },
    }),
  },
  {
    id: "tech-dark",
    name: "技术深色",
    category: "工程",
    description: "终端式细节与高对比技术表达",
    layout: "single",
    appearance: "tech",
    defaults: {
      theme: { accent: "teal", density: "compact" },
      style: createResumeStyleDefaults({
        palette: "signal",
        type: "monoCompact",
        density: "compact",
      }),
    },
    thumbnail: createResumeThumbnailDefaults({
      palette: "signal",
      density: "compact",
      overrides: { title: "#f1fbf8" },
    }),
  },
  {
    id: "classic-business",
    name: "经典商务",
    category: "管理",
    description: "保守层级、摘要优先、适合正式岗位",
    layout: "single",
    appearance: "classic",
    pagination: { contentScale: 0.97, firstPageScale: 0.85 },
    defaults: {
      theme: { accent: "amber", density: "comfortable" },
      style: {
        fontFamily: "serif",
        baseFontSize: 12,
        lineHeight: 1.7,
        textColor: "#2a241e",
        accentColor: "#8a6542",
        pageBackground: "#fffdf8",
        pageMargin: 82,
        sectionGap: 28,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "standard",
      page: "#fffdf8",
      sidebar: "#eee4d5",
      accent: "#8a6542",
      title: "#2a241e",
      copy: "#9d9388",
      rule: "#d7cdbf",
    },
  },
  {
    id: "creative-split",
    name: "创意分栏",
    category: "产品 / 设计",
    description: "侧栏信息与内容叙事并置",
    layout: "sidebar",
    appearance: "creative",
    sidebar: {
      width: 220,
      background: "#25202b",
      foreground: "#fffaf7",
      muted: "#d8ceda",
      highlight: "#ff9c91",
    },
    pagination: { contentScale: 0.92 },
    defaults: {
      theme: { accent: "rose", density: "comfortable" },
      style: createResumeStyleDefaults({
        palette: "rose",
        type: "sansComfortable",
        density: "comfortable",
        overrides: { pageMargin: 64 },
      }),
    },
    thumbnail: createResumeThumbnailDefaults({
      palette: "rose",
      density: "comfortable",
      overrides: { sidebar: "#25202b", accent: "#ff9c91" },
    }),
  },
  {
    id: "executive-serif",
    name: "高管叙事",
    category: "高管 / 咨询",
    description: "衬线标题与宽松节奏，突出领导力和业务结果",
    layout: "single",
    appearance: "executive",
    pagination: { contentScale: 1, firstPageScale: 0.9 },
    defaults: {
      theme: { accent: "blue", density: "comfortable" },
      style: createResumeStyleDefaults({
        palette: "blue",
        type: "serifComfortable",
        density: "comfortable",
        overrides: { lineHeight: 1.72, pageMargin: 74, sectionGap: 30 },
      }),
    },
    thumbnail: createResumeThumbnailDefaults({
      palette: "blue",
      density: "comfortable",
    }),
  },
  {
    id: "editorial-grid",
    name: "编辑网格",
    category: "媒体 / 内容",
    description: "杂志式网格和醒目编号，适合作品与内容岗位",
    layout: "sidebar",
    appearance: "editorial",
    sidebar: {
      width: 190,
      background: "#852f43",
      foreground: "#fff8f7",
      muted: "#e8cfd4",
      highlight: "#ffd1d8",
    },
    pagination: { contentScale: 0.93 },
    defaults: {
      theme: { accent: "rose", density: "comfortable" },
      style: {
        fontFamily: "sans",
        baseFontSize: 12,
        lineHeight: 1.6,
        textColor: "#202226",
        accentColor: "#d74d5d",
        pageBackground: "#fffdfb",
        pageMargin: 56,
        sectionGap: 24,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "editorial",
      page: "#fffdfb",
      sidebar: "#852f43",
      accent: "#d74d5d",
      title: "#202226",
      copy: "#96979a",
      rule: "#dedbd8",
    },
  },
  {
    id: "compact-engineer",
    name: "工程紧凑",
    category: "研发 / 架构",
    description: "高信息密度与技术标签，适合经历丰富的工程师",
    layout: "single",
    appearance: "compact",
    pagination: { contentScale: 0.9, continuationPageScale: 0.93 },
    defaults: {
      theme: { accent: "blue", density: "compact" },
      style: {
        fontFamily: "mono",
        baseFontSize: 10,
        lineHeight: 1.45,
        textColor: "#1d252c",
        accentColor: "#23618a",
        pageBackground: "#ffffff",
        pageMargin: 48,
        sectionGap: 14,
      },
    },
    thumbnail: {
      density: "compact",
      composition: "standard",
      page: "#ffffff",
      sidebar: "#dce8ef",
      accent: "#23618a",
      title: "#1d252c",
      copy: "#8b969e",
      rule: "#d4dce1",
    },
  },
  {
    id: "academic-paper",
    name: "学术论文",
    category: "学术 / 研究",
    description: "论文式层级和克制排版，适合研究与教育经历",
    layout: "single",
    appearance: "academic",
    pagination: { contentScale: 1, firstPageScale: 0.9 },
    defaults: {
      theme: { accent: "amber", density: "comfortable" },
      style: {
        fontFamily: "serif",
        baseFontSize: 12,
        lineHeight: 1.75,
        textColor: "#241f1a",
        accentColor: "#665546",
        pageBackground: "#fffdf8",
        pageMargin: 76,
        sectionGap: 28,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "standard",
      page: "#fffdf8",
      sidebar: "#ece5da",
      accent: "#665546",
      title: "#241f1a",
      copy: "#978f86",
      rule: "#cfc7bc",
    },
  },
  {
    id: "clean-sidebar",
    name: "清爽侧栏",
    category: "通用 / 应届",
    description: "浅色侧栏承载基础信息，主体聚焦经历叙述",
    layout: "sidebar",
    appearance: "clean-sidebar",
    sidebar: {
      width: 210,
      background: "#e9f2ef",
      foreground: "#263331",
      muted: "#5b6967",
      highlight: "#2f756c",
    },
    pagination: { contentScale: 0.92 },
    defaults: {
      theme: { accent: "teal", density: "comfortable" },
      style: {
        fontFamily: "humanist",
        baseFontSize: 12,
        lineHeight: 1.65,
        textColor: "#263331",
        accentColor: "#3f8379",
        pageBackground: "#ffffff",
        pageMargin: 62,
        sectionGap: 25,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "standard",
      page: "#ffffff",
      sidebar: "#e4f0ed",
      accent: "#3f8379",
      title: "#263331",
      copy: "#95a09e",
      rule: "#d6dfdd",
    },
  },
  {
    id: "bold-product",
    name: "产品宣言",
    category: "产品 / 创业",
    description: "粗体标题与高对比色块，强化产品判断和影响力",
    layout: "sidebar",
    appearance: "bold-product",
    sidebar: {
      width: 230,
      background: "#111619",
      foreground: "#fffaf0",
      muted: "#bcc5c6",
      highlight: "#f0a128",
    },
    pagination: { contentScale: 0.9 },
    defaults: {
      theme: { accent: "amber", density: "comfortable" },
      style: {
        fontFamily: "sans",
        baseFontSize: 12,
        lineHeight: 1.55,
        textColor: "#15191e",
        accentColor: "#f0a128",
        pageBackground: "#fffdf8",
        pageMargin: 58,
        sectionGap: 22,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "editorial",
      page: "#fffdf8",
      sidebar: "#15191e",
      accent: "#f0a128",
      title: "#15191e",
      copy: "#8d8f91",
      rule: "#d9d6cf",
    },
  },
  {
    id: "finance-ledger",
    name: "金融账簿",
    category: "金融 / 投行",
    description: "海军蓝与黄铜色规则，突出交易、模型和量化结果",
    layout: "single",
    appearance: "finance",
    defaults: {
      theme: { accent: "amber", density: "compact" },
      style: {
        fontFamily: "serif",
        baseFontSize: 11,
        lineHeight: 1.55,
        textColor: "#edf1f7",
        accentColor: "#d2ae61",
        pageBackground: "#14213d",
        pageMargin: 64,
        sectionGap: 20,
      },
    },
    thumbnail: {
      density: "compact",
      composition: "standard",
      page: "#14213d",
      sidebar: "#202f50",
      accent: "#d2ae61",
      title: "#d2ae61",
      copy: "#7c879c",
      rule: "#536077",
    },
  },
  {
    id: "legal-brief",
    name: "法务简报",
    category: "法律 / 合规",
    description: "正式衬线层级与编号式章节，适合严谨专业表达",
    layout: "single",
    appearance: "legal",
    defaults: {
      theme: { accent: "rose", density: "comfortable" },
      style: {
        fontFamily: "serif",
        baseFontSize: 12,
        lineHeight: 1.72,
        textColor: "#2a2022",
        accentColor: "#7a2832",
        pageBackground: "#fffdf8",
        pageMargin: 76,
        sectionGap: 26,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "standard",
      page: "#fffdf8",
      sidebar: "#eadde0",
      accent: "#7a2832",
      title: "#2a2022",
      copy: "#988e90",
      rule: "#d7ced0",
    },
  },
  {
    id: "clinical-clean",
    name: "临床清朗",
    category: "医疗 / 生命科学",
    description: "高留白与冷色标签，适合临床、医药和科研岗位",
    layout: "single",
    appearance: "clinical",
    pagination: { contentScale: 1, firstPageScale: 0.9 },
    defaults: {
      theme: { accent: "teal", density: "comfortable" },
      style: {
        fontFamily: "humanist",
        baseFontSize: 12,
        lineHeight: 1.7,
        textColor: "#243638",
        accentColor: "#2b8a91",
        pageBackground: "#f2fbfb",
        pageMargin: 72,
        sectionGap: 28,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "standard",
      page: "#f2fbfb",
      sidebar: "#d8efef",
      accent: "#2b8a91",
      title: "#243638",
      copy: "#8ca0a1",
      rule: "#cee0e1",
    },
  },
  {
    id: "growth-sales",
    name: "增长战报",
    category: "销售 / 商务拓展",
    description: "强指标侧栏与高能强调色，聚焦增长和商业成果",
    layout: "sidebar",
    appearance: "growth",
    sidebar: {
      width: 220,
      background: "#20242b",
      foreground: "#fffaf7",
      muted: "#c1c5ca",
      highlight: "#ff8a5d",
    },
    defaults: {
      theme: { accent: "amber", density: "compact" },
      style: {
        fontFamily: "sans",
        baseFontSize: 11,
        lineHeight: 1.5,
        textColor: "#f7f7f5",
        accentColor: "#f26b38",
        pageBackground: "#20242b",
        pageMargin: 56,
        sectionGap: 18,
      },
    },
    thumbnail: {
      density: "compact",
      composition: "editorial",
      page: "#20242b",
      sidebar: "#f26b38",
      accent: "#f26b38",
      title: "#ffffff",
      copy: "#7d8085",
      rule: "#55595f",
    },
  },
  {
    id: "portfolio-studio",
    name: "作品工作室",
    category: "设计 / 创意作品集",
    description: "非对称版式与作品集式构图，强调创作身份和方法",
    layout: "sidebar",
    appearance: "portfolio",
    sidebar: {
      width: 236,
      background:
        "linear-gradient(150deg, rgb(255 255 255 / 10%), transparent 42%), #87392f",
      foreground: "#fffaf7",
      muted: "#f0cdc5",
      highlight: "#ffd0c6",
    },
    pagination: { contentScale: 0.93, continuationPageScale: 0.97 },
    defaults: {
      theme: { accent: "rose", density: "comfortable" },
      style: {
        fontFamily: "humanist",
        baseFontSize: 12,
        lineHeight: 1.6,
        textColor: "#28201e",
        accentColor: "#da5f45",
        pageBackground: "#fff3ee",
        pageMargin: 58,
        sectionGap: 24,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "editorial",
      page: "#fff3ee",
      sidebar: "#87392f",
      accent: "#da5f45",
      title: "#28201e",
      copy: "#9b8c88",
      rule: "#decfc9",
    },
  },
  {
    id: "global-professional",
    name: "国际专业",
    category: "国际 / 英文",
    description: "中性国际排版与保守节奏，适合跨国企业申请",
    layout: "single",
    appearance: "global",
    pagination: { contentScale: 1, firstPageScale: 0.91 },
    defaults: {
      theme: { accent: "blue", density: "comfortable" },
      style: {
        fontFamily: "sans",
        baseFontSize: 11,
        lineHeight: 1.6,
        textColor: "#202a34",
        accentColor: "#385a7c",
        pageBackground: "#ffffff",
        pageMargin: 68,
        sectionGap: 24,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "standard",
      page: "#ffffff",
      sidebar: "#dfe7ef",
      accent: "#385a7c",
      title: "#202a34",
      copy: "#929aa3",
      rule: "#d5dce2",
    },
  },
  {
    id: "civic-formal",
    name: "公职规范",
    category: "政府 / 公共服务",
    description: "公文式居中层级与结构化横线，强调稳定和可信度",
    layout: "single",
    appearance: "civic",
    defaults: {
      theme: { accent: "rose", density: "comfortable" },
      style: {
        fontFamily: "serif",
        baseFontSize: 12,
        lineHeight: 1.75,
        textColor: "#251f1d",
        accentColor: "#9f2d28",
        pageBackground: "#fffdf8",
        pageMargin: 78,
        sectionGap: 28,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "standard",
      page: "#fffdf8",
      sidebar: "#eadedb",
      accent: "#9f2d28",
      title: "#251f1d",
      copy: "#978e8a",
      rule: "#d7ceca",
    },
  },
  {
    id: "one-page-impact",
    name: "一页影响力",
    category: "精简 / 转型",
    description: "压缩间距与强分隔线，适合一页高密度职业摘要",
    layout: "single",
    appearance: "one-page",
    pagination: { contentScale: 0.9, firstPageScale: 0.82 },
    defaults: {
      theme: { accent: "teal", density: "compact" },
      style: {
        fontFamily: "sans",
        baseFontSize: 10,
        lineHeight: 1.42,
        textColor: "#111619",
        accentColor: "#111619",
        pageBackground: "#ffffff",
        pageMargin: 42,
        sectionGap: 12,
      },
    },
    thumbnail: {
      density: "compact",
      composition: "standard",
      page: "#ffffff",
      sidebar: "#e4e7e8",
      accent: "#111619",
      title: "#111619",
      copy: "#868a8c",
      rule: "#111619",
    },
  },
  {
    id: "consulting-clarity",
    name: "咨询洞察",
    category: "咨询 / 战略",
    description: "严谨网格与结论先行结构，突出问题拆解和业务影响",
    layout: "single",
    appearance: "consulting",
    defaults: {
      theme: { accent: "rose", density: "compact" },
      style: {
        fontFamily: "sans",
        baseFontSize: 11,
        lineHeight: 1.5,
        textColor: "#202225",
        accentColor: "#c83932",
        pageBackground: "#ffffff",
        pageMargin: 58,
        sectionGap: 18,
      },
    },
    thumbnail: {
      density: "compact",
      composition: "standard",
      page: "#ffffff",
      sidebar: "#f0dfdd",
      accent: "#c83932",
      title: "#202225",
      copy: "#909294",
      rule: "#d5d5d4",
    },
  },
  {
    id: "education-chalk",
    name: "教育新章",
    category: "教育 / 培训",
    description: "温和纸张色与学院绿层级，适合教学和课程研发岗位",
    layout: "single",
    appearance: "education",
    defaults: {
      theme: { accent: "teal", density: "comfortable" },
      style: {
        fontFamily: "serif",
        baseFontSize: 12,
        lineHeight: 1.72,
        textColor: "#2b332c",
        accentColor: "#55745b",
        pageBackground: "#faf7eb",
        pageMargin: 72,
        sectionGap: 27,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "standard",
      page: "#faf7eb",
      sidebar: "#e2e8dc",
      accent: "#55745b",
      title: "#2b332c",
      copy: "#92988e",
      rule: "#d4d8cb",
    },
  },
  {
    id: "industrial-blueprint",
    name: "工业蓝图",
    category: "制造 / 工程",
    description: "工程图网格与深蓝侧栏，强调流程、质量和交付指标",
    layout: "sidebar",
    appearance: "industrial",
    sidebar: {
      width: 220,
      background: "#214b70",
      foreground: "#f7fbff",
      muted: "#c3d2df",
      highlight: "#f3bd4f",
    },
    defaults: {
      theme: { accent: "amber", density: "compact" },
      style: {
        fontFamily: "mono",
        baseFontSize: 11,
        lineHeight: 1.5,
        textColor: "#eef5fb",
        accentColor: "#e5a72d",
        pageBackground: "#17395c",
        pageMargin: 54,
        sectionGap: 18,
      },
    },
    thumbnail: {
      density: "compact",
      composition: "standard",
      page: "#17395c",
      sidebar: "#17395c",
      accent: "#e5a72d",
      title: "#e5a72d",
      copy: "#7b91a7",
      rule: "#536f89",
    },
  },
  {
    id: "data-lab",
    name: "数据实验室",
    category: "数据 / AI",
    description: "实验室式深色侧栏与信号色，突出模型、指标和技术栈",
    layout: "sidebar",
    appearance: "data-lab",
    sidebar: {
      width: 230,
      background:
        "radial-gradient(circle at 20% 8%, rgb(78 217 194 / 18%), transparent 150px), #101b27",
      foreground: "#d9f3ef",
      muted: "#9cbab8",
      highlight: "#4ed9c2",
    },
    defaults: {
      theme: { accent: "teal", density: "compact" },
      style: {
        fontFamily: "mono",
        baseFontSize: 11,
        lineHeight: 1.5,
        textColor: "#e8f2f5",
        accentColor: "#4ed9c2",
        pageBackground: "#101b27",
        pageMargin: 54,
        sectionGap: 18,
      },
    },
    thumbnail: {
      density: "compact",
      composition: "standard",
      page: "#101b27",
      sidebar: "#101b27",
      accent: "#4ed9c2",
      title: "#e8f2f5",
      copy: "#6c7b89",
      rule: "#40505f",
    },
  },
  {
    id: "hospitality-warm",
    name: "宾客体验",
    category: "酒店 / 服务",
    description: "暖米色与酒红细节，表达服务意识和运营品质",
    layout: "single",
    appearance: "hospitality",
    defaults: {
      theme: { accent: "rose", density: "comfortable" },
      style: {
        fontFamily: "humanist",
        baseFontSize: 12,
        lineHeight: 1.7,
        textColor: "#3a2c2b",
        accentColor: "#9e4f50",
        pageBackground: "#fff8ed",
        pageMargin: 72,
        sectionGap: 27,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "standard",
      page: "#fff8ed",
      sidebar: "#edddcf",
      accent: "#9e4f50",
      title: "#3a2c2b",
      copy: "#9d918a",
      rule: "#ded2c7",
    },
  },
  {
    id: "luxury-retail",
    name: "奢尚零售",
    category: "奢侈品 / 零售",
    description: "黑金侧栏与高留白排版，适合品牌、陈列和高端零售",
    layout: "sidebar",
    appearance: "luxury",
    sidebar: {
      width: 220,
      background: "#151515",
      foreground: "#f7f1e4",
      muted: "#c7bdac",
      highlight: "#c5a566",
    },
    defaults: {
      theme: { accent: "amber", density: "comfortable" },
      style: {
        fontFamily: "serif",
        baseFontSize: 11,
        lineHeight: 1.65,
        textColor: "#f1eadf",
        accentColor: "#c5a566",
        pageBackground: "#151515",
        pageMargin: 62,
        sectionGap: 24,
      },
    },
    thumbnail: {
      density: "comfortable",
      composition: "editorial",
      page: "#151515",
      sidebar: "#151515",
      accent: "#c5a566",
      title: "#c5a566",
      copy: "#726a5e",
      rule: "#4b443a",
    },
  },
] as const satisfies readonly TemplateScheme[]

export const templateSchemes = rawTemplateSchemes.map(
  normalizeTemplateScheme,
) as unknown as typeof rawTemplateSchemes

export type ResumeTemplateId = (typeof rawTemplateSchemes)[number]["id"]

export const templateIds = templateSchemes.map(
  (scheme) => scheme.id,
) as unknown as readonly [ResumeTemplateId, ...ResumeTemplateId[]]

export function getTemplateScheme(id: ResumeTemplateId): TemplateScheme {
  return templateSchemes.find((scheme) => scheme.id === id) ?? templateSchemes[0]
}

export function getTemplateAppearanceClass(scheme: TemplateScheme): string {
  return `template-${scheme.appearance}`
}
