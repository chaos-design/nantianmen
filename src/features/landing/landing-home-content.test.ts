import { describe, expect, it } from "vitest"
import {
  getLandingCapabilities,
  getLandingHighlights,
  getLandingWorkflow,
  landingImpactExample,
  landingLegacyWorkflow,
  landingUnifiedWorkflow,
} from "./landing-home-content"

describe("landing home content", () => {
  it("keeps the full product story for normal users", () => {
    expect(getLandingCapabilities(false).map((item) => item.title)).toEqual([
      "不用 Word 调格式",
      "不用到处找模板",
      "一份内容，两种展示",
      "PDF 随时导出",
      "AI 帮你写清价值",
      "一个链接直接分享",
    ])
    expect(getLandingWorkflow(false).map((item) => item.title)).toEqual([
      "写入真实经历",
      "选择展示方式",
      "导出或直接分享",
    ])
    expect(getLandingHighlights(false).map((item) => item.value)).toEqual([
      "24",
      "16",
      "1",
    ])
  })

  it("uses only available read-only content for Preview users", () => {
    const capabilityText = getLandingCapabilities(true)
      .map((item) => `${item.title} ${item.description}`)
      .join(" ")
    const workflowText = getLandingWorkflow(true)
      .map((item) => `${item.title} ${item.description}`)
      .join(" ")

    expect(capabilityText).not.toContain("AI 简历陪练")
    expect(capabilityText).not.toContain("内容与样式解耦")
    expect(capabilityText).toContain("只读")
    expect(workflowText).not.toContain("发布分享")
    expect(workflowText).toContain("查看")
    expect(getLandingHighlights(true).map((item) => item.value)).toEqual([
      "24",
      "16",
      "3",
    ])
  })

  it("uses a specific, evidence-based impact example", () => {
    expect(landingImpactExample.before).toContain("负责")
    expect(landingImpactExample.after).toContain("4.1 秒")
    expect(landingImpactExample.after).toContain("46%")
    expect(landingImpactExample.evidence).toHaveLength(3)
  })

  it("explains why the product replaces the document workflow", () => {
    expect(landingLegacyWorkflow.map((item) => item.title)).toEqual([
      "到处找模板",
      "打开 Word 调格式",
      "导出 PDF",
      "把文件发给别人",
    ])
    expect(landingUnifiedWorkflow.map((item) => item.title)).toEqual([
      "内容只维护一次",
      "模板与输出随时切换",
      "发布后直接发链接",
    ])
  })
})
