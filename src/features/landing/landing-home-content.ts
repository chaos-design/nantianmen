import {
  BracesIcon,
  FileTextIcon,
  LayoutTemplateIcon,
  MonitorSmartphoneIcon,
  Share2Icon,
  SparklesIcon,
} from "lucide-react"

const standardCapabilities = [
  {
    icon: BracesIcon,
    index: "01",
    title: "不用 Word 调格式",
    description:
      "用结构化表单整理经历，内容和排版分开管理，增删修改都不会打乱整份简历。",
  },
  {
    icon: LayoutTemplateIcon,
    index: "02",
    title: "不用到处找模板",
    description: "24 套 A4 模板与 16 套 Web 风格集中在一个模板库，切换时内容保持完整。",
  },
  {
    icon: MonitorSmartphoneIcon,
    index: "03",
    title: "一份内容，两种展示",
    description: "同一份职业档案同时生成适合投递的 A4 简历和适合在线展示的 Web 页面。",
  },
  {
    icon: FileTextIcon,
    index: "04",
    title: "PDF 随时导出",
    description: "实时查看 A4 排版和智能分页，需要正式文件时直接打印或导出 PDF。",
  },
  {
    icon: SparklesIcon,
    index: "05",
    title: "AI 帮你写清价值",
    description: "围绕职责、行动和结果优化表达，建议由你确认后再写入，不替你擅自改稿。",
  },
  {
    icon: Share2Icon,
    index: "06",
    title: "一个链接直接分享",
    description:
      "发布稳定的只读快照，直接把链接发给对方，后续修改草稿也不会影响已发版本。",
  },
] as const

const previewCapabilities = [
  {
    icon: LayoutTemplateIcon,
    index: "01",
    title: "固定测试简历",
    description: "Preview 账号只查看固定样例数据，不创建或编辑你的个人简历。",
  },
  {
    icon: BracesIcon,
    index: "02",
    title: "A4 与 Web 预览",
    description: "可以体验全页 A4、互动 Web 简历和模板切换效果。",
  },
  {
    icon: Share2Icon,
    index: "03",
    title: "只读分享快照",
    description: "仅查看已发布的只读展示页，不提供发布、保存或生成分享链接能力。",
  },
] as const

const standardWorkflow = [
  {
    step: "01",
    title: "写入真实经历",
    description: "集中维护岗位、项目、技能与成果，不必先打开 Word 决定每一行放在哪里。",
  },
  {
    step: "02",
    title: "选择展示方式",
    description: "在实时画布中切换 A4 与 Web 风格，内容不用复制，版式也不必重新调整。",
  },
  {
    step: "03",
    title: "导出或直接分享",
    description: "正式投递时导出 PDF，需要快速查看时发布只读链接，不再反复发送新文件。",
  },
] as const

const previewWorkflow = [
  {
    step: "01",
    title: "进入工作台",
    description: "Preview 工作台只展示固定测试简历，并隐藏创建与删除入口。",
  },
  {
    step: "02",
    title: "查看预览",
    description: "打开 A4 全页预览或 Web 预览，验证模板、分页和展示效果。",
  },
] as const

const standardHighlights = [
  {
    value: "24",
    suffix: "套",
    label: "真实渲染的 A4 专业模板",
  },
  {
    value: "16",
    suffix: "套",
    label: "适配不同岗位的 Web 风格",
  },
  {
    value: "1",
    suffix: "份",
    label: "结构化内容，多端复用",
  },
] as const

const previewHighlights = [
  {
    value: "24",
    suffix: "套",
    label: "可浏览的 A4 专业模板",
  },
  {
    value: "16",
    suffix: "套",
    label: "可体验的 Web 风格",
  },
  {
    value: "3",
    suffix: "种",
    label: "只读预览入口",
  },
] as const

export const landingImpactExample = {
  before: "负责数据分析平台前端开发，参与性能优化和组件建设。",
  after:
    "重构微前端运行时与权限加载链路，将首屏 P75 从 4.1 秒降至 2.3 秒，线上 JavaScript 异常率下降 46%。",
  evidence: ["范围：8 条产品线", "行动：重构加载链路", "结果：P75 提升 44%"],
} as const

export const landingLegacyWorkflow = [
  {
    step: "01",
    title: "到处找模板",
    description: "收藏很多文件，还是不知道哪一份适合自己。",
  },
  {
    step: "02",
    title: "打开 Word 调格式",
    description: "改一句话，整页的间距和对齐都可能重新调整。",
  },
  {
    step: "03",
    title: "导出 PDF",
    description: "每次修改都要重新命名、重新导出一份文件。",
  },
  {
    step: "04",
    title: "把文件发给别人",
    description: "版本越发越多，对方看到的未必是最新定稿。",
  },
] as const

export const landingUnifiedWorkflow = [
  {
    label: "CONTENT",
    title: "内容只维护一次",
    description: "所有经历集中在一份结构化职业档案中。",
  },
  {
    label: "OUTPUT",
    title: "模板与输出随时切换",
    description: "A4、PDF 和 Web 页面都来自同一份内容。",
  },
  {
    label: "SHARE",
    title: "发布后直接发链接",
    description: "对方打开即看，不用下载，也不会拿错版本。",
  },
] as const

export function getLandingCapabilities(previewMode: boolean) {
  return previewMode ? previewCapabilities : standardCapabilities
}

export function getLandingWorkflow(previewMode: boolean) {
  return previewMode ? previewWorkflow : standardWorkflow
}

export function getLandingHighlights(previewMode: boolean) {
  return previewMode ? previewHighlights : standardHighlights
}
