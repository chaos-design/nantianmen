import type { Metadata } from "next"
import {
  LegalDocumentPage,
  type LegalSection,
} from "../../features/legal/legal-document-page"

export const metadata: Metadata = {
  title: "隐私政策",
  description: "Résumé Lab 隐私政策。",
}

const sections: readonly LegalSection[] = [
  {
    id: "scope",
    title: "适用范围",
    paragraphs: [
      "本政策说明 Résumé Lab 默认开源实现如何处理账号、简历、资源和使用记录。第三方部署方是其部署环境中个人信息处理活动的责任主体，并应根据实际地区、基础设施和业务用途提供补充说明。",
    ],
  },
  {
    id: "collection",
    title: "我们处理的信息",
    items: [
      "账号信息：邮箱、Supabase Auth 用户标识、邮箱确认状态和会话信息。",
      "简历内容：个人资料、经历、教育、项目、技能、自定义区块、排版设置和发布快照。",
      "资源文件：你主动上传的 PNG、JPEG 或 WebP 图片及其尺寸、类型和归属信息。",
      "操作与安全记录：请求时间、接口结果、版本冲突、发布与 AI 审计信息，以及服务商为安全和运维生成的必要日志。",
      "AI 配置信息：你主动提供的模型名称、服务地址、凭据和请求内容；浏览器个人配置优先保存在当前浏览器，但调用模型时仍会发送给你选择的服务商。",
    ],
  },
  {
    id: "purpose",
    title: "处理目的",
    items: [
      "创建和维护账号、验证身份并保护工作台访问。",
      "保存草稿、渲染 A4 与 Web 简历、处理资源并生成发布快照。",
      "提供密码恢复、验证码登录、版本冲突处理和客户支持。",
      "在你主动使用时调用 AI 服务生成内容建议。",
      "预防滥用、排查故障、维护安全并履行适用法律义务。",
    ],
  },
  {
    id: "storage",
    title: "存储与安全",
    paragraphs: [
      "业务数据存储于部署方配置的 Supabase PostgreSQL，图片存储于私有 Storage Bucket。浏览器不直接写业务表或私有 Storage，业务写操作经过 Next.js 服务端执行身份、所有权和同源校验。",
      "密码由 Supabase Auth 处理，Résumé Lab 业务数据库不保存明文密码。我们采用访问控制、私有存储、不可变发布快照和最小权限密钥等措施降低风险，但任何系统都无法保证绝对安全。",
    ],
  },
  {
    id: "providers",
    title: "第三方服务",
    paragraphs: [
      "默认部署可能使用 Supabase 提供认证、数据库和对象存储，使用 Vercel 托管 Next.js 应用。你主动使用 AI 功能时，选定的模型服务商会接收完成请求所需的内容。",
      "这些服务商依据各自条款处理信息。第三方部署方应披露其实际使用的服务商、部署地区和跨境传输安排。",
    ],
  },
  {
    id: "sharing",
    title: "公开分享",
    paragraphs: [
      "只有当你主动发布时，系统才生成公开快照。持有公开链接的人无需登录即可访问快照及其引用的公开资源。",
      "公开页面不读取未发布草稿，但你仍应在发布前移除不希望公开的电话、邮箱、住址、证件信息或其他敏感内容。",
    ],
  },
  {
    id: "retention",
    title: "保留与删除",
    paragraphs: [
      "草稿和发布数据通常保留至你删除对应简历，或当前部署方因服务终止、违规处理或法律义务进行清理。安全日志、备份和审计记录可能在合理期限内继续保留。",
      "工作台提供简历删除能力。账号删除、数据副本或其他隐私请求应通过当前部署方公布的联系方式提出。",
    ],
  },
  {
    id: "rights",
    title: "你的选择与权利",
    items: [
      "访问和修改工作台中的简历内容与排版设置。",
      "删除简历、停止发布新快照，并谨慎管理已分享链接。",
      "不使用 AI 功能，或删除浏览器中保存的个人模型配置。",
      "根据适用法律请求访问、更正、删除或导出个人信息，以及撤回可撤回的同意。",
    ],
  },
  {
    id: "cookies",
    title: "Cookie 与本地存储",
    paragraphs: [
      "系统使用必要 Cookie 维持 Supabase 登录会话或只读 Preview 会话，并可能使用浏览器存储保存编辑体验和个人 AI 配置。默认实现不依赖广告追踪 Cookie。",
      "禁用必要 Cookie 可能导致登录、会话刷新或受保护页面无法正常使用。",
    ],
  },
  {
    id: "minors",
    title: "未成年人",
    paragraphs: [
      "本服务主要面向具备求职和职业资料管理能力的用户。未成年人应在监护人指导下使用，并避免在公开简历中披露不必要的敏感信息。",
    ],
  },
  {
    id: "changes",
    title: "政策更新与联系",
    paragraphs: [
      "我们可能根据产品能力、服务商或法律要求更新本政策，并通过页面更新生效日期。重大变更应由当前部署方以合理方式提示。",
      "如需提出隐私请求或安全问题，请通过项目公开仓库或当前部署方公布的联系方式反馈。请勿在公开问题中提交密码、验证码、API Key 或完整简历内容。",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      documentType="privacy"
      eyebrow="LEGAL / PRIVACY"
      title="隐私政策"
      summary="这份政策说明 Résumé Lab 在账号认证、简历编辑、资源存储、公开分享和 AI 建议过程中如何处理信息。"
      sections={sections}
    />
  )
}
