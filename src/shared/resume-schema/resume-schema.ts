import { z } from "zod"
import {
  getTemplateScheme,
  type ResumeTemplateId,
  templateIds,
  templateSchemes,
} from "../resume-template/template-schemes"

export { templateIds, type ResumeTemplateId }

const defaultTemplateScheme = templateSchemes[0]

export const documentFontFamilies = ["sans", "serif", "mono", "humanist"] as const

export const sectionFontFamilies = ["inherit", ...documentFontFamilies] as const

export const sectionStylePresets = [
  "default",
  "compact",
  "accent",
  "timeline",
  "card",
] as const

export const sectionTypes = [
  "workExperience",
  "education",
  "project",
  "skills",
  "certification",
  "custom",
] as const

export const A4_PAGE_WIDTH = 794
export const A4_PAGE_HEIGHT = 1123
export const MAX_RESUME_ASSETS = 20
export const MAX_RESUME_PLACEMENTS = 50
export const MAX_RESUME_PAGES = 20
export const MIN_IMAGE_PLACEMENT_SIZE = 32
export const MAX_IMAGE_Z_INDEX = 50

export const sectionTypeLabels: Record<(typeof sectionTypes)[number], string> = {
  workExperience: "工作经历",
  education: "教育经历",
  project: "项目经历",
  skills: "专业技能",
  certification: "证书与荣誉",
  custom: "自定义区块",
}

/**
 * AI 可改写字段的长度上限。
 * 这里必须是简历 Schema 的唯一真源：AI 侧校验简历结构时直接复用，
 * 避免出现「AI 允许 4000 字、简历只允许 120 字」这类静默不一致。
 */
export const resumeEditableFieldLimits = {
  summary: 4000,
  title: 120,
  subtitle: 160,
  description: 4000,
  highlight: 500,
} as const

export type ResumeEditableField = keyof typeof resumeEditableFieldLimits

const resumeItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(resumeEditableFieldLimits.title).default(""),
  subtitle: z.string().max(resumeEditableFieldLimits.subtitle).default(""),
  startDate: z.string().max(30).default(""),
  endDate: z.string().max(30).default(""),
  current: z.boolean().default(false),
  location: z.string().max(100).default(""),
  description: z.string().max(resumeEditableFieldLimits.description).default(""),
  highlights: z
    .array(z.string().max(resumeEditableFieldLimits.highlight))
    .max(20)
    .default([]),
  skills: z.array(z.string().max(60)).max(30).default([]),
  url: z.string().max(500).default(""),
})

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)

const sectionStyleSchema = z.object({
  preset: z.enum(sectionStylePresets).default("default"),
  fontFamily: z.enum(sectionFontFamilies).default("inherit"),
  fontSize: z.number().min(8).max(24).nullable().default(null),
  color: hexColorSchema.nullable().default(null),
  spacingBefore: z.number().int().min(0).max(64).default(0),
  spacingAfter: z.number().int().min(0).max(64).default(0),
})

const resumeSectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(sectionTypes),
  title: z.string().min(1).max(80),
  visible: z.boolean().default(true),
  items: z.array(resumeItemSchema).max(30).default([]),
  style: sectionStyleSchema.default({
    preset: "default",
    fontFamily: "inherit",
    fontSize: null,
    color: null,
    spacingBefore: 0,
    spacingAfter: 0,
  }),
})

const resumeImageAssetSchema = z.object({
  id: z.string().min(1).max(120),
  kind: z.literal("image"),
  name: z.string().min(1).max(255),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  byteSize: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
  width: z.number().int().positive().max(6000),
  height: z.number().int().positive().max(6000),
  alt: z.string().max(500).default(""),
})

const resumeImagePlacementSchema = z.object({
  id: z.string().min(1).max(120),
  assetId: z.string().min(1).max(120),
  pageIndex: z
    .number()
    .int()
    .min(0)
    .max(MAX_RESUME_PAGES - 1),
  x: z.number().min(0).max(A4_PAGE_WIDTH),
  y: z.number().min(0).max(A4_PAGE_HEIGHT),
  width: z.number().min(0).max(A4_PAGE_WIDTH),
  height: z.number().min(0).max(A4_PAGE_HEIGHT),
  zIndex: z.number().int().min(0).max(MAX_IMAGE_Z_INDEX),
  objectFit: z.enum(["cover", "contain"]).default("cover"),
  shape: z.enum(["rectangle", "rounded", "circle"]).default("rectangle"),
})

const resumeResourcesSchema = z
  .object({
    assets: z.array(resumeImageAssetSchema).max(MAX_RESUME_ASSETS).default([]),
    placements: z
      .array(resumeImagePlacementSchema)
      .max(MAX_RESUME_PLACEMENTS)
      .default([]),
  })
  .superRefine((resources, context) => {
    const assetIds = new Set<string>()
    for (const [index, asset] of resources.assets.entries()) {
      if (assetIds.has(asset.id)) {
        context.addIssue({
          code: "custom",
          message: "资源 ID 必须唯一",
          path: ["assets", index, "id"],
        })
      }
      assetIds.add(asset.id)
    }

    const placementIds = new Set<string>()
    for (const [index, placement] of resources.placements.entries()) {
      if (placementIds.has(placement.id)) {
        context.addIssue({
          code: "custom",
          message: "图片位置 ID 必须唯一",
          path: ["placements", index, "id"],
        })
      }
      placementIds.add(placement.id)

      if (!assetIds.has(placement.assetId)) {
        context.addIssue({
          code: "custom",
          message: "图片位置必须引用当前文档中的资源",
          path: ["placements", index, "assetId"],
        })
      }
      if (placement.x + placement.width > A4_PAGE_WIDTH) {
        context.addIssue({
          code: "custom",
          message: "图片位置超出 A4 页面宽度",
          path: ["placements", index, "width"],
        })
      }
      if (placement.y + placement.height > A4_PAGE_HEIGHT) {
        context.addIssue({
          code: "custom",
          message: "图片位置超出 A4 页面高度",
          path: ["placements", index, "height"],
        })
      }
    }
  })

export const resumeDocumentSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  metadata: z.object({
    title: z.string().min(1).max(120),
    locale: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
    targetRole: z.string().max(120).default(""),
  }),
  template: z.object({
    id: z.enum(templateIds),
    theme: z.object({
      accent: z
        .enum(["teal", "blue", "amber", "rose"])
        .default(defaultTemplateScheme.defaults.theme.accent),
      density: z
        .enum(["compact", "comfortable"])
        .default(defaultTemplateScheme.defaults.theme.density),
    }),
  }),
  style: z
    .object({
      fontFamily: z.enum(documentFontFamilies).default("sans"),
      baseFontSize: z.number().min(9).max(18).default(12),
      lineHeight: z.number().min(1.2).max(2.2).default(1.65),
      textColor: hexColorSchema.default("#17201f"),
      accentColor: hexColorSchema.default("#157d72"),
      pageBackground: hexColorSchema.default("#ffffff"),
      pageMargin: z.number().int().min(32).max(96).default(70),
      sectionGap: z.number().int().min(12).max(48).default(26),
    })
    .default({ ...defaultTemplateScheme.defaults.style }),
  profile: z.object({
    name: z.string().max(120).default(""),
    headline: z.string().max(160).default(""),
    email: z.string().max(200).default(""),
    phone: z.string().max(60).default(""),
    location: z.string().max(120).default(""),
    website: z.string().max(500).default(""),
    summary: z.string().max(resumeEditableFieldLimits.summary).default(""),
  }),
  sections: z.array(resumeSectionSchema).max(20),
  resources: resumeResourcesSchema.default({
    assets: [],
    placements: [],
  }),
})

export type ResumeDocument = z.infer<typeof resumeDocumentSchema>
export type ResumeSection = z.infer<typeof resumeSectionSchema>
export type ResumeItem = z.infer<typeof resumeItemSchema>
export type ResumeResources = z.infer<typeof resumeResourcesSchema>
export type ResumeImageAsset = z.infer<typeof resumeImageAssetSchema>
export type ResumeImagePlacement = z.infer<typeof resumeImagePlacementSchema>
export type ResumeSectionType = ResumeSection["type"]
export type ResumeSectionStyle = ResumeSection["style"]

export function createDefaultSectionStyle(): ResumeSectionStyle {
  return {
    preset: "default",
    fontFamily: "inherit",
    fontSize: null,
    color: null,
    spacingBefore: 0,
    spacingAfter: 0,
  }
}

export function createStableId(prefix: string): string {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${value}`
}

export function createResumeItem(type: ResumeSectionType): ResumeItem {
  const titles: Record<ResumeSectionType, string> = {
    workExperience: "职位名称",
    education: "专业名称",
    project: "项目名称",
    skills: "技能类别",
    certification: "证书名称",
    custom: "条目标题",
  }

  return {
    id: createStableId("item"),
    title: titles[type],
    subtitle: "",
    startDate: "",
    endDate: "",
    current: false,
    location: "",
    description: "",
    highlights: [],
    skills: [],
    url: "",
  }
}

export function createResumeSection(type: ResumeSectionType): ResumeSection {
  return {
    id: createStableId("section"),
    type,
    title: sectionTypeLabels[type],
    visible: true,
    items: [createResumeItem(type)],
    style: createDefaultSectionStyle(),
  }
}

export function createResumeDocument(
  templateId: ResumeTemplateId = defaultTemplateScheme.id,
): ResumeDocument {
  const templateScheme = getTemplateScheme(templateId)

  return {
    schemaVersion: "1.0.0",
    metadata: {
      title: "林知远 · 高级前端工程师简历",
      locale: "zh-CN",
      targetRole: "高级前端工程师",
    },
    template: {
      id: templateScheme.id as ResumeTemplateId,
      theme: { ...templateScheme.defaults.theme },
    },
    style: { ...templateScheme.defaults.style },
    profile: {
      name: "林知远",
      headline: "高级前端工程师 · 前端架构与工程效能",
      email: "lin.zhiyuan@example.com",
      phone: "+86 138 0013 8000",
      location: "北京",
      website: "https://github.com/Rain120",
      summary:
        "拥有 7 年企业级 Web 产品研发经验，经历过数据协作产品从 0 到 1 建设，也负责过成熟平台的架构升级与长期治理。目前带领 6 人前端小组支撑 8 条产品线和 1.2 万名月活用户，工作范围覆盖技术规划、核心功能交付、质量体系与团队培养。擅长把业务目标拆解为可度量的技术方案，并通过性能、稳定性、交付周期和用户反馈持续验证结果。",
    },
    sections: [
      {
        id: createStableId("section"),
        type: "workExperience",
        title: sectionTypeLabels.workExperience,
        visible: true,
        style: createDefaultSectionStyle(),
        items: [
          {
            id: createStableId("item"),
            title: "高级前端工程师",
            subtitle: "星河科技",
            startDate: "2022.06",
            endDate: "",
            current: true,
            location: "北京",
            description:
              "负责企业数据分析平台的前端架构和核心体验，带领 6 人小组维护分析工作台、指标中心与可视化搭建器，服务 8 条产品线及 1.2 万名月活用户。作为前端负责人，参与需求评审、季度路线制定和关键方案决策，并与产品、设计、数据和服务端团队共同推进跨域项目。除业务交付外，还负责技术方案评审、工程师培养和生产事故复盘，推动公共能力从项目内实现沉淀为可复用的平台资产。",
            highlights: [
              "重构微前端运行时与权限加载链路，首屏 P75 从 4.1 秒降至 2.3 秒，线上 JavaScript 异常率下降 46%",
              "主导 Orion 设计系统升级，沉淀 68 个生产级组件和 240 余项设计变量，跨产品需求平均交付周期缩短 35%",
              "建立 Playwright 关键路径回归、前端性能预算和发布看板，将高优线上缺陷月均数量从 11 个降至 4 个",
              "与产品、设计和数据团队制定季度技术路线，连续 6 个季度按期交付，负责 4 名工程师的成长与代码评审",
            ],
            skills: ["React", "TypeScript", "Next.js", "Node.js", "Playwright"],
            url: "https://github.com/Rain120",
          },
          {
            id: createStableId("item"),
            title: "前端工程师",
            subtitle: "云图网络",
            startDate: "2019.07",
            endDate: "2022.05",
            current: false,
            location: "北京",
            description:
              "参与数据协作平台从 0 到 1 建设，产品面向运营、销售和交付团队提供结构化数据收集、多人协作与经营分析能力。主要负责低代码表单、多人编辑器和运营分析模块，同时维护脚手架、发布流程与前端监控等基础设施。项目进入规模化阶段后，承担复杂需求拆解、跨端方案评审和新人培养工作，并与服务端及测试团队建立稳定的版本协作机制。",
            highlights: [
              "设计 Schema 驱动的表单引擎，覆盖 30 余类字段和 12 个业务场景，将标准页面平均开发时间从 5 天降至 2 天",
              "落地编辑器增量保存与冲突恢复机制，将弱网环境下的数据丢失投诉降低 82%",
              "接入错误监控、Source Map 归因和性能预算，线上 JavaScript 错误率下降 58%，版本回滚次数下降 40%",
            ],
            skills: ["Vue", "TypeScript", "ECharts", "WebSocket", "性能监控"],
            url: "https://github.com/Rain120",
          },
        ],
      },
      {
        id: createStableId("section"),
        type: "education",
        title: sectionTypeLabels.education,
        visible: true,
        style: createDefaultSectionStyle(),
        items: [
          {
            id: createStableId("item"),
            title: "软件工程 · 工学学士",
            subtitle: "同济大学",
            startDate: "2015.09",
            endDate: "2019.06",
            current: false,
            location: "北京",
            description:
              "主修软件架构、人机交互、数据库系统与计算机图形学，专业排名前 15%。课程实践以真实数据产品为主题，完成过城市交通可视分析、协同任务管理和图形渲染等项目。毕业阶段重点研究大规模时空数据的交互呈现，并通过用户测试迭代信息层级与操作路径。",
            highlights: [
              "校级优秀毕业设计：面向城市交通数据的交互式可视分析系统，负责数据建模、Canvas 渲染与可用性测试",
              "担任开源技术社团负责人，组织 20 余场工程实践活动，维护 3 个校内公共项目",
            ],
            skills: ["软件架构", "人机交互", "数据库系统", "数据可视化"],
            url: "https://github.com/Rain120",
          },
        ],
      },
      {
        id: createStableId("section"),
        type: "project",
        title: sectionTypeLabels.project,
        visible: true,
        style: createDefaultSectionStyle(),
        items: [
          {
            id: createStableId("item"),
            title: "Nebula 可视化工作台",
            subtitle: "核心负责人",
            startDate: "2023.03",
            endDate: "2024.01",
            current: false,
            location: "",
            description:
              "Nebula 是面向业务分析师的可组合数据洞察平台，支持百万级明细探索、跨数据源指标编排和可复用分析模板。我负责前端技术方案、插件协议和性能基线，并协调图表、查询与权限团队完成端到端交付。项目重点解决大数据集阻塞主线程、第三方插件隔离和复杂分析状态恢复问题，最终形成可供多个业务团队复用的平台能力。",
            highlights: [
              "设计插件化图表协议与沙箱通信层，支持 20 余个业务团队独立交付图表插件",
              "将计算和序列化迁移至 Web Worker，大数据集交互期间主线程长任务数量下降 73%",
              "通过虚拟化与分层缓存将 10 万行明细表滚动帧率稳定在 55 FPS 以上",
            ],
            skills: ["Canvas", "Web Worker", "Node.js", "性能分析"],
            url: "https://github.com/Rain120",
          },
          {
            id: createStableId("item"),
            title: "Orion 企业设计系统",
            subtitle: "架构与治理负责人",
            startDate: "2022.08",
            endDate: "2023.06",
            current: false,
            location: "北京",
            description:
              "Orion 是覆盖 8 条产品线的企业设计系统，用于统一视觉语言、组件 API、主题机制与无障碍交付标准。我负责技术架构、组件分层、版本策略和贡献流程，并与设计团队共同维护设计变量及交互规范。针对 30 余个存量应用，项目提供兼容层、自动迁移脚本和分阶段升级指南，降低一次性改造带来的业务风险。",
            highlights: [
              "沉淀 68 个生产级组件，覆盖 8 条产品线和 30 余个业务应用，核心组件单元测试覆盖率达到 92%",
              "引入视觉回归、变更审计和自动迁移脚本，组件升级导致的回归问题下降 71%",
              "建立 RFC 与贡献者机制，半年内接受 17 个跨团队组件贡献，重复实现需求下降 34%",
            ],
            skills: ["Design Token", "Storybook", "Playwright", "A11y", "Monorepo"],
            url: "https://github.com/Rain120",
          },
        ],
      },
      {
        id: createStableId("section"),
        type: "skills",
        title: sectionTypeLabels.skills,
        visible: true,
        style: createDefaultSectionStyle(),
        items: [
          {
            id: createStableId("item"),
            title: "工程能力",
            subtitle: "",
            startDate: "",
            endDate: "",
            current: false,
            location: "",
            description: "",
            highlights: [],
            skills: [
              "React",
              "TypeScript",
              "Next.js",
              "Node.js",
              "前端架构",
              "性能优化",
              "Playwright",
            ],
            url: "",
          },
          {
            id: createStableId("item"),
            title: "协作与产品",
            subtitle: "",
            startDate: "",
            endDate: "",
            current: false,
            location: "",
            description: "",
            highlights: [],
            skills: [
              "设计系统",
              "技术规划",
              "跨团队协作",
              "工程效能",
              "数据可视化",
              "无障碍",
            ],
            url: "",
          },
        ],
      },
      {
        id: createStableId("section"),
        type: "certification",
        title: sectionTypeLabels.certification,
        visible: true,
        style: createDefaultSectionStyle(),
        items: [
          {
            id: createStableId("item"),
            title: "AWS Certified Solutions Architect",
            subtitle: "Amazon Web Services",
            startDate: "2024.03",
            endDate: "2027.03",
            current: false,
            location: "",
            description:
              "2024 年 3 月通过 AWS SAA-C03 考试，证书有效期至 2027 年 3 月。认证覆盖高可用、安全、成本治理和灾难恢复。",
            highlights: [],
            skills: ["Cloud Architecture", "Security", "Reliability"],
            url: "https://github.com/Rain120",
          },
          {
            id: createStableId("item"),
            title: "年度工程影响力奖",
            subtitle: "星河科技",
            startDate: "2023.12",
            endDate: "",
            current: false,
            location: "北京",
            description:
              "因设计系统升级和性能治理获得公司年度工程影响力奖。奖项由研发与产品序列联合评审，关注覆盖范围和长期复用价值。",
            highlights: ["支撑 8 条产品线统一交付，年度重复开发成本降低 34%"],
            skills: ["技术领导力", "组织协作"],
            url: "",
          },
        ],
      },
    ],
    resources: {
      assets: [],
      placements: [],
    },
  }
}

export function parseResumeDocument(input: unknown): ResumeDocument {
  return resumeDocumentSchema.parse(input)
}
