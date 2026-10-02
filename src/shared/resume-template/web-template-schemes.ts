import {
  type ResumeFontRole,
  resumeFontStacks,
} from "../design-tokens/resume-template-tokens"

export type WebTemplateComposition =
  | "archive"
  | "editorial"
  | "grid"
  | "mosaic"
  | "poster"
  | "studio"

export interface WebTemplateScheme {
  id: string
  name: string
  category: string
  description: string
  composition: WebTemplateComposition
  tone: "dark" | "light"
  fontFamily: string
  colors: {
    background: string
    surface: string
    text: string
    muted: string
    accent: string
    grid: string
  }
  thumbnail: {
    background: string
    surface: string
    text: string
    muted: string
    accent: string
  }
}

function createWebTemplateVisual(input: {
  font: ResumeFontRole
  colors: WebTemplateScheme["colors"]
  thumbnailMuted: string
  fontFamily?: string
}): Pick<WebTemplateScheme, "colors" | "fontFamily" | "thumbnail"> {
  return {
    fontFamily: input.fontFamily ?? resumeFontStacks[input.font],
    colors: input.colors,
    thumbnail: {
      background: input.colors.background,
      surface: input.colors.surface,
      text: input.colors.text,
      muted: input.thumbnailMuted,
      accent: input.colors.accent,
    },
  }
}

function getWebTemplateFontRole(fontFamily: string): ResumeFontRole {
  if (fontFamily.includes("SFMono") || fontFamily.includes("Consolas")) {
    return "mono"
  }
  if (
    fontFamily.includes("Iowan") ||
    fontFamily.includes("Songti") ||
    fontFamily.includes("Georgia") ||
    fontFamily.includes("Baskerville")
  ) {
    return "serif"
  }
  if (fontFamily.includes("Gill Sans")) {
    return "humanist"
  }
  return "sans"
}

function normalizeWebTemplateScheme<T extends WebTemplateScheme>(scheme: T): T {
  const visual = createWebTemplateVisual({
    font: getWebTemplateFontRole(scheme.fontFamily),
    fontFamily: scheme.fontFamily,
    colors: scheme.colors,
    thumbnailMuted: scheme.thumbnail.muted,
  })

  return {
    ...scheme,
    ...visual,
  } as T
}

const rawWebTemplateSchemes = [
  {
    id: "digital-archive",
    name: "数字档案",
    category: "通用 / 数字化",
    description: "深色档案构图、粘性导航与精细光晕。",
    composition: "archive",
    tone: "dark",
    ...createWebTemplateVisual({
      font: "sans",
      thumbnailMuted: "#708381",
      colors: {
        background: "#080d15",
        surface: "#141c28",
        text: "#eef5f4",
        muted: "#9aaead",
        accent: "#52d8bd",
        grid: "#6ea69d",
      },
    }),
  },
  {
    id: "editorial-canvas",
    name: "编辑画布",
    category: "内容 / 品牌",
    description: "浅色杂志排版、超大标题与非对称留白。",
    composition: "editorial",
    tone: "light",
    ...createWebTemplateVisual({
      font: "serif",
      thumbnailMuted: "#9b978e",
      colors: {
        background: "#f2efe8",
        surface: "#fffdf7",
        text: "#191a1d",
        muted: "#686966",
        accent: "#d54b31",
        grid: "#928f86",
      },
    }),
  },
  {
    id: "kinetic-grid",
    name: "动态网格",
    category: "产品 / 增长",
    description: "高对比网格、粗体编号与快速运动反馈。",
    composition: "grid",
    tone: "light",
    fontFamily: '"Avenir Next", "PingFang SC", sans-serif',
    colors: {
      background: "#f4f238",
      surface: "#fffef0",
      text: "#11120f",
      muted: "#515249",
      accent: "#1746f5",
      grid: "#11120f",
    },
    thumbnail: {
      background: "#f4f238",
      surface: "#fffef0",
      text: "#11120f",
      muted: "#68695f",
      accent: "#1746f5",
    },
  },
  {
    id: "executive-noir",
    name: "高管黑金",
    category: "高管 / 商务",
    description: "克制黑金、衬线叙事与沉稳信息层级。",
    composition: "editorial",
    tone: "dark",
    fontFamily: '"Iowan Old Style", "Songti SC", Georgia, serif',
    colors: {
      background: "#11100e",
      surface: "#1b1916",
      text: "#f2eadc",
      muted: "#b2a994",
      accent: "#c9a45d",
      grid: "#76684e",
    },
    thumbnail: {
      background: "#11100e",
      surface: "#1b1916",
      text: "#f2eadc",
      muted: "#766f61",
      accent: "#c9a45d",
    },
  },
  {
    id: "portfolio-studio",
    name: "作品工作室",
    category: "设计 / 创意",
    description: "图像优先构图、暖红强调与作品集节奏。",
    composition: "studio",
    tone: "light",
    fontFamily: '"Iowan Old Style", "Songti SC", Georgia, serif',
    colors: {
      background: "#fff4ef",
      surface: "#fffaf7",
      text: "#2d211e",
      muted: "#77615a",
      accent: "#c94f38",
      grid: "#b48c80",
    },
    thumbnail: {
      background: "#fff4ef",
      surface: "#fffaf7",
      text: "#2d211e",
      muted: "#9b7f76",
      accent: "#c94f38",
    },
  },
  {
    id: "terminal-signal",
    name: "终端信号",
    category: "工程 / 技术",
    description: "终端绿、扫描线与等宽技术表达。",
    composition: "grid",
    tone: "dark",
    ...createWebTemplateVisual({
      font: "mono",
      thumbnailMuted: "#47735e",
      colors: {
        background: "#04100c",
        surface: "#0a1b15",
        text: "#dfffee",
        muted: "#77a990",
        accent: "#39f59a",
        grid: "#1d7b52",
      },
    }),
  },
  {
    id: "paper-journal",
    name: "纸张期刊",
    category: "教育 / 研究",
    description: "暖色纸张、书籍排版与清晰长文阅读。",
    composition: "archive",
    tone: "light",
    fontFamily: '"Songti SC", "Iowan Old Style", Georgia, serif',
    colors: {
      background: "#eee6d7",
      surface: "#fbf5e8",
      text: "#302820",
      muted: "#74685a",
      accent: "#8e3f32",
      grid: "#9e8d78",
    },
    thumbnail: {
      background: "#eee6d7",
      surface: "#fbf5e8",
      text: "#302820",
      muted: "#9b8d7a",
      accent: "#8e3f32",
    },
  },
  {
    id: "swiss-ledger",
    name: "瑞士账本",
    category: "咨询 / 运营",
    description: "瑞士网格、信号红与严谨的信息账本。",
    composition: "grid",
    tone: "light",
    ...createWebTemplateVisual({
      font: "sans",
      fontFamily: '"Helvetica Neue", "Avenir Next", "PingFang SC", sans-serif',
      thumbnailMuted: "#7c828c",
      colors: {
        background: "#f3f2ec",
        surface: "#ffffff",
        text: "#111419",
        muted: "#575b61",
        accent: "#d9362b",
        grid: "#1647d8",
      },
    }),
  },
  {
    id: "bauhaus-poster",
    name: "包豪斯海报",
    category: "品牌 / 市场",
    description: "几何切割、原色构成与鲜明海报节奏。",
    composition: "poster",
    tone: "light",
    fontFamily: '"Futura", "Avenir Next", "PingFang SC", sans-serif',
    colors: {
      background: "#f1e7d2",
      surface: "#fff8e8",
      text: "#171512",
      muted: "#625a4f",
      accent: "#c93625",
      grid: "#24477a",
    },
    thumbnail: {
      background: "#f1e7d2",
      surface: "#fff8e8",
      text: "#171512",
      muted: "#776f61",
      accent: "#c93625",
    },
  },
  {
    id: "aurora-glass",
    name: "极光玻璃",
    category: "AI / 数据",
    description: "深海底色、青紫极光与透明信息面板。",
    composition: "mosaic",
    tone: "dark",
    fontFamily: '"Gill Sans", "Avenir Next", "PingFang SC", sans-serif',
    colors: {
      background: "#070b1b",
      surface: "#111a31",
      text: "#f2f7ff",
      muted: "#a9b5cc",
      accent: "#35e0c1",
      grid: "#6855a4",
    },
    thumbnail: {
      background: "#070b1b",
      surface: "#111a31",
      text: "#f2f7ff",
      muted: "#697793",
      accent: "#35e0c1",
    },
  },
  {
    id: "botanical-editorial",
    name: "植物编辑",
    category: "内容 / 公益",
    description: "象牙纸张、森林绿与自然舒展的编辑排版。",
    composition: "editorial",
    tone: "light",
    fontFamily: '"Baskerville", "Songti SC", Georgia, serif',
    colors: {
      background: "#edf0e5",
      surface: "#fbf8ee",
      text: "#17251b",
      muted: "#5f6d60",
      accent: "#276447",
      grid: "#86947f",
    },
    thumbnail: {
      background: "#edf0e5",
      surface: "#fbf8ee",
      text: "#17251b",
      muted: "#829083",
      accent: "#276447",
    },
  },
  {
    id: "mono-brutalist",
    name: "黑白粗野",
    category: "创意 / 媒体",
    description: "黑白硬边、荧光黄与不妥协的粗野主义。",
    composition: "poster",
    tone: "light",
    fontFamily: '"Avenir Next Condensed", "Avenir Next", "PingFang SC", sans-serif',
    colors: {
      background: "#f5f4ef",
      surface: "#ffffff",
      text: "#101010",
      muted: "#555555",
      accent: "#789000",
      grid: "#101010",
    },
    thumbnail: {
      background: "#f5f4ef",
      surface: "#ffffff",
      text: "#101010",
      muted: "#555555",
      accent: "#c7e800",
    },
  },
  {
    id: "clay-studio",
    name: "陶土工作室",
    category: "艺术 / 空间",
    description: "陶土暖色、拱形影像与柔和手作质感。",
    composition: "studio",
    tone: "light",
    fontFamily: '"Baskerville", "Songti SC", Georgia, serif',
    colors: {
      background: "#ead8c6",
      surface: "#fff8ef",
      text: "#33231e",
      muted: "#79655b",
      accent: "#a84832",
      grid: "#ad8978",
    },
    thumbnail: {
      background: "#ead8c6",
      surface: "#fff8ef",
      text: "#33231e",
      muted: "#a08376",
      accent: "#a84832",
    },
  },
  {
    id: "midnight-product",
    name: "午夜产品",
    category: "产品 / SaaS",
    description: "墨蓝面板、薄荷信号与产品仪表盘节奏。",
    composition: "mosaic",
    tone: "dark",
    fontFamily: '"Gill Sans", "Avenir Next", "PingFang SC", sans-serif',
    colors: {
      background: "#07121f",
      surface: "#0d2030",
      text: "#effbf7",
      muted: "#9ab6ae",
      accent: "#5de0b0",
      grid: "#326a67",
    },
    thumbnail: {
      background: "#07121f",
      surface: "#0d2030",
      text: "#effbf7",
      muted: "#56776e",
      accent: "#5de0b0",
    },
  },
  {
    id: "solar-future",
    name: "日光未来",
    category: "气候 / 创新",
    description: "日光橙、生态绿与开放通透的未来主义版面。",
    composition: "mosaic",
    tone: "light",
    fontFamily: '"Gill Sans", "Avenir Next", "PingFang SC", sans-serif',
    colors: {
      background: "#f0f3df",
      surface: "#fffdf1",
      text: "#173128",
      muted: "#607268",
      accent: "#e76d2f",
      grid: "#729b75",
    },
    thumbnail: {
      background: "#f0f3df",
      surface: "#fffdf1",
      text: "#173128",
      muted: "#819388",
      accent: "#e76d2f",
    },
  },
  {
    id: "analog-radio",
    name: "模拟电台",
    category: "媒体 / 音乐",
    description: "勃艮第红、琥珀信号与模拟广播海报感。",
    composition: "poster",
    tone: "dark",
    fontFamily: '"Avenir Next Condensed", "Avenir Next", "PingFang SC", sans-serif',
    colors: {
      background: "#190d10",
      surface: "#2a1519",
      text: "#fff1dc",
      muted: "#c6a89f",
      accent: "#f2a23a",
      grid: "#7f3d3f",
    },
    thumbnail: {
      background: "#190d10",
      surface: "#2a1519",
      text: "#fff1dc",
      muted: "#815a58",
      accent: "#f2a23a",
    },
  },
  {
    id: "capital-deck",
    name: "资本路演",
    category: "投资 / 金融",
    description: "投资备忘录、增长绿与清晰的关键指标层级。",
    composition: "editorial",
    tone: "light",
    fontFamily: '"Avenir Next", "PingFang SC", sans-serif',
    colors: {
      background: "#f3f0e8",
      surface: "#fffdf7",
      text: "#10243f",
      muted: "#667386",
      accent: "#16855b",
      grid: "#b49a68",
    },
    thumbnail: {
      background: "#f3f0e8",
      surface: "#fffdf7",
      text: "#10243f",
      muted: "#87909b",
      accent: "#16855b",
    },
  },
  {
    id: "luxury-retail",
    name: "奢华零售",
    category: "零售 / 品牌",
    description: "曜石橱窗、香槟金与精品陈列式内容节奏。",
    composition: "studio",
    tone: "dark",
    fontFamily: '"Iowan Old Style", "Songti SC", Georgia, serif',
    colors: {
      background: "#100d0e",
      surface: "#21191b",
      text: "#fff4e8",
      muted: "#bca9a1",
      accent: "#d6b36a",
      grid: "#9f3154",
    },
    thumbnail: {
      background: "#100d0e",
      surface: "#21191b",
      text: "#fff4e8",
      muted: "#735c61",
      accent: "#d6b36a",
    },
  },
  {
    id: "cloud-architecture",
    name: "云端架构",
    category: "云计算 / 架构",
    description: "云白画布、钴蓝拓扑与模块化系统视图。",
    composition: "mosaic",
    tone: "light",
    fontFamily: '"SFMono-Regular", Consolas, "PingFang SC", monospace',
    colors: {
      background: "#edf6ff",
      surface: "#ffffff",
      text: "#102a43",
      muted: "#5f7488",
      accent: "#2563eb",
      grid: "#19a7ae",
    },
    thumbnail: {
      background: "#edf6ff",
      surface: "#ffffff",
      text: "#102a43",
      muted: "#8094a6",
      accent: "#2563eb",
    },
  },
  {
    id: "security-command",
    name: "安全指挥",
    category: "安全 / 应急",
    description: "炭黑指挥台、告警红与事件响应状态面板。",
    composition: "poster",
    tone: "dark",
    fontFamily: '"SFMono-Regular", Consolas, "PingFang SC", monospace',
    colors: {
      background: "#130d0d",
      surface: "#261416",
      text: "#fff3e8",
      muted: "#c3a6a3",
      accent: "#ff4d3f",
      grid: "#f4b740",
    },
    thumbnail: {
      background: "#130d0d",
      surface: "#261416",
      text: "#fff3e8",
      muted: "#79595a",
      accent: "#ff4d3f",
    },
  },
] as const satisfies readonly WebTemplateScheme[]

export type WebTemplateId = (typeof rawWebTemplateSchemes)[number]["id"]

export const webTemplateSchemes: readonly (WebTemplateScheme & {
  id: WebTemplateId
})[] = rawWebTemplateSchemes.map(normalizeWebTemplateScheme)

export const defaultWebTemplateId: WebTemplateId = "digital-archive"

export const webTemplateIds = webTemplateSchemes.map(
  (scheme) => scheme.id,
) as unknown as readonly [WebTemplateId, ...WebTemplateId[]]

const webTemplateIdSet = new Set<string>(webTemplateIds)
const legacyWebTemplateIdMap = new Map<string, WebTemplateId>([
  ["stellar-archive", "digital-archive"],
  ["citrus-grid", "kinetic-grid"],
  ["violet-circuit", "midnight-product"],
  ["linen-studio", "portfolio-studio"],
  ["blueprint-engineer", "terminal-signal"],
  ["oceanic-console", "terminal-signal"],
  ["museum-catalog", "editorial-canvas"],
  ["neon-lab", "aurora-glass"],
])

export function resolveWebTemplateId(value: unknown): WebTemplateId {
  if (typeof value !== "string") {
    return defaultWebTemplateId
  }
  if (webTemplateIdSet.has(value)) {
    return value as WebTemplateId
  }
  return legacyWebTemplateIdMap.get(value) ?? defaultWebTemplateId
}

export function getWebTemplateScheme(id: WebTemplateId): WebTemplateScheme {
  return webTemplateSchemes.find((scheme) => scheme.id === id) ?? webTemplateSchemes[0]
}
