import { readFile } from "node:fs/promises"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const nilUuid = "00000000-0000-0000-0000-000000000000"
const defaultPublicSlug = "preview-test-resume"

async function readLocalEnvironment() {
  const envPath = path.join(process.cwd(), ".env")
  try {
    const contents = await readFile(envPath, "utf8")
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) {
        continue
      }
      const separatorIndex = trimmed.indexOf("=")
      if (separatorIndex < 0) {
        continue
      }
      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1).trim()
      if (key && process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error
    }
  }
}

function readRequiredValue(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`缺少环境变量：${name}`)
  }
  return value
}

function assertNotProduction() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error("拒绝在生产环境清空 Preview 数据")
  }
}

function createItem(id, title, subtitle, highlights, options = {}) {
  return {
    id,
    title,
    subtitle,
    startDate: options.startDate ?? "",
    endDate: options.endDate ?? "",
    current: options.current ?? false,
    location: options.location ?? "",
    description: options.description ?? "",
    highlights,
    skills: options.skills ?? [],
    url: options.url ?? "",
  }
}

function createSection(id, type, title, items) {
  return {
    id,
    type,
    title,
    visible: true,
    style: {
      preset: "default",
      fontFamily: "inherit",
      fontSize: null,
      color: null,
      spacingBefore: 0,
      spacingAfter: 0,
    },
    items,
  }
}

function createPreviewDocument() {
  return {
    schemaVersion: "1.0.0",
    metadata: {
      title: "Preview 测试简历",
      locale: "zh-CN",
      targetRole: "高级前端工程师",
    },
    template: {
      id: "modern-minimal",
      theme: {
        accent: "teal",
        density: "comfortable",
      },
    },
    style: {
      fontFamily: "sans",
      baseFontSize: 12,
      lineHeight: 1.65,
      textColor: "#17201f",
      accentColor: "#157d72",
      pageBackground: "#ffffff",
      pageMargin: 70,
      sectionGap: 26,
    },
    profile: {
      name: "林知远",
      headline: "高级前端工程师 · 前端架构与工程效能",
      email: "preview@example.com",
      phone: "+86 138 0013 8000",
      location: "北京",
      website: "https://github.com/Rain120",
      summary:
        "拥有 7 年企业级 Web 产品研发经验，长期负责复杂编辑器、数据可视化和设计系统建设。擅长把业务目标拆解为可度量的技术方案，通过性能、稳定性、交付周期和用户反馈持续验证结果。",
    },
    sections: [
      createSection("section-work", "workExperience", "工作经历", [
        createItem(
          "item-work-1",
          "高级前端工程师",
          "星河科技",
          [
            "重构微前端运行时与权限加载链路，首屏 P75 从 4.1 秒降至 2.3 秒",
            "主导设计系统升级，沉淀 68 个生产级组件和 240 余项设计变量",
            "建立 Playwright 回归、性能预算和发布看板，高优线上缺陷月均下降 64%",
          ],
          {
            startDate: "2022.06",
            current: true,
            location: "北京",
            description:
              "负责企业数据分析平台的前端架构和核心体验，带领 6 人小组维护分析工作台、指标中心与可视化搭建器。",
            skills: ["React", "TypeScript", "Next.js", "Playwright"],
            url: "https://github.com/Rain120",
          },
        ),
        createItem(
          "item-work-2",
          "前端工程师",
          "云图网络",
          [
            "设计 Schema 驱动表单引擎，覆盖 30 余类字段和 12 个业务场景",
            "落地编辑器增量保存与冲突恢复机制，弱网数据丢失投诉降低 82%",
            "接入错误监控和性能预算，版本回滚次数下降 40%",
          ],
          {
            startDate: "2019.07",
            endDate: "2022.05",
            location: "北京",
            description:
              "参与数据协作平台从 0 到 1 建设，负责低代码表单、多人编辑器和运营分析模块。",
            skills: ["Vue", "TypeScript", "ECharts", "WebSocket"],
          },
        ),
      ]),
      createSection("section-project", "project", "项目经历", [
        createItem(
          "item-project-1",
          "Nebula 可视化工作台",
          "核心负责人",
          [
            "设计插件化图表协议与沙箱通信层，支持 20 余个业务团队独立交付图表插件",
            "将计算和序列化迁移至 Web Worker，主线程长任务数量下降 73%",
            "通过虚拟化与分层缓存将 10 万行明细表滚动帧率稳定在 55 FPS 以上",
          ],
          {
            startDate: "2023.03",
            endDate: "2024.01",
            description:
              "面向业务分析师的可组合数据洞察平台，支持百万级明细探索、跨数据源指标编排和可复用分析模板。",
            skills: ["Canvas", "Web Worker", "Node.js", "性能分析"],
          },
        ),
      ]),
      createSection("section-skills", "skills", "专业技能", [
        createItem(
          "item-skills-1",
          "前端架构",
          "React / TypeScript / Next.js",
          ["复杂状态建模", "组件库治理", "性能预算", "微前端运行时"],
          {
            skills: ["React", "TypeScript", "Next.js", "Zod"],
          },
        ),
        createItem(
          "item-skills-2",
          "工程质量",
          "测试 / 监控 / 发布",
          ["Playwright E2E", "可观测性", "灰度发布", "错误归因"],
          {
            skills: ["Playwright", "Vitest", "Biome", "监控告警"],
          },
        ),
      ]),
      createSection("section-education", "education", "教育经历", [
        createItem(
          "item-education-1",
          "软件工程 · 工学学士",
          "同济大学",
          ["校级优秀毕业设计", "专业排名前 15%", "开源技术社团负责人"],
          {
            startDate: "2015.09",
            endDate: "2019.06",
            location: "北京",
            description: "主修软件架构、人机交互、数据库系统与计算机图形学。",
          },
        ),
      ]),
      createSection("section-certification", "certification", "证书与荣誉", [
        createItem(
          "item-cert-1",
          "公司年度技术影响力奖",
          "星河科技",
          ["因设计系统治理、性能专项和工程质量体系建设获得团队级表彰"],
          {
            startDate: "2024",
          },
        ),
      ]),
    ],
    resources: {
      assets: [],
      placements: [],
    },
  }
}

async function deleteAll(supabase, table) {
  const { error } = await supabase.from(table).delete().neq("id", nilUuid)
  if (error) {
    throw new Error(`清空 ${table} 失败：${error.message}`)
  }
}

async function main() {
  await readLocalEnvironment()
  assertNotProduction()

  const supabaseUrl = readRequiredValue("SUPABASE_URL")
  const serviceRoleKey = readRequiredValue("SUPABASE_SERVICE_ROLE_KEY")
  const previewConfig = {
    userId: readRequiredValue("PREVIEW_USER_ID"),
    email: readRequiredValue("PREVIEW_USER_EMAIL"),
    resumeId: readRequiredValue("PREVIEW_RESUME_ID"),
    sessionSecret: readRequiredValue("PREVIEW_SESSION_SECRET"),
  }
  const document = createPreviewDocument()
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  await deleteAll(supabase, "ai_generations")
  await deleteAll(supabase, "resume_assets")
  await deleteAll(supabase, "resume_publications")
  await deleteAll(supabase, "resumes")

  const { error: insertError } = await supabase.from("resumes").insert({
    id: previewConfig.resumeId,
    owner_id: null,
    title: document.metadata.title,
    public_slug: defaultPublicSlug,
    edit_token_hash: null,
    draft_document: document,
    draft_schema_version: document.schemaVersion,
    draft_version: 1,
  })
  if (insertError) {
    throw new Error(`创建 Preview 简历失败：${insertError.message}`)
  }

  const { data: publicationResult, error: publishError } = await supabase.rpc(
    "publish_resume_snapshot",
    {
      p_resume_id: previewConfig.resumeId,
    },
  )
  if (publishError) {
    throw new Error(`发布 Preview 简历失败：${publishError.message}`)
  }

  console.log("Preview 数据已重建")
  console.log(`Preview 用户邮箱: ${previewConfig.email}`)
  console.log(`工作台: /workspace`)
  console.log(`A4 预览: /editor/${previewConfig.resumeId}/preview`)
  console.log(`Web 预览: /editor/${previewConfig.resumeId}/web`)
  console.log(`分享预览: /r/${defaultPublicSlug}`)
  console.log(`发布版本: ${publicationResult?.publication?.publication_version ?? 1}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
