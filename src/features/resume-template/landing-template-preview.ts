import {
  createDefaultSectionStyle,
  createResumeDocument,
  type ResumeDocument,
  type ResumeTemplateId,
} from "../../shared/resume-schema/resume-schema"

export function createLandingTemplatePreviewDocument(
  templateId: ResumeTemplateId,
): ResumeDocument {
  const document = createResumeDocument(templateId)

  return {
    ...document,
    metadata: {
      title: "Rain120 · 产品工程师简历",
      locale: "zh-CN",
      targetRole: "产品工程师",
    },
    profile: {
      name: "Rain120",
      headline: "产品工程师 · 前端架构与智能体验",
      email: "rain120@example.com",
      phone: "+86 186 0086 2400",
      location: "北京",
      website: "https://github.com/Rain120",
      summary:
        "8 年企业产品研发经验，专注把复杂数据与 AI 能力转化为清晰、可靠的用户体验。负责过分析平台、设计系统和增长实验，擅长用工程指标验证业务结果。",
    },
    sections: [
      {
        id: "landing-work-experience",
        type: "workExperience",
        title: "工作经历",
        visible: true,
        style: createDefaultSectionStyle(),
        items: [
          {
            id: "landing-work-item",
            title: "高级产品工程师",
            subtitle: "边界科技",
            startDate: "2022.07",
            endDate: "",
            current: true,
            location: "上海",
            description:
              "负责智能分析平台的前端架构与核心体验，协同产品、设计和数据团队交付企业级洞察工作台。",
            highlights: [
              "重构数据加载链路，首屏 P75 从 3.8 秒降至 1.9 秒",
              "沉淀 42 个业务组件，跨团队需求交付周期缩短 31%",
            ],
            skills: ["React", "TypeScript", "Next.js", "AI UX"],
            url: "",
          },
        ],
      },
      {
        id: "landing-project",
        type: "project",
        title: "项目经历",
        visible: true,
        style: createDefaultSectionStyle(),
        items: [
          {
            id: "landing-project-item",
            title: "Atlas 智能洞察工作台",
            subtitle: "技术负责人",
            startDate: "2023.04",
            endDate: "2024.06",
            current: false,
            location: "",
            description:
              "设计可组合分析画布与插件协议，让业务团队独立搭建数据洞察页面。",
            highlights: ["支持 12 条业务线复用，分析页面搭建效率提升 2.4 倍"],
            skills: [],
            url: "",
          },
        ],
      },
      {
        id: "landing-education",
        type: "education",
        title: "教育经历",
        visible: true,
        style: createDefaultSectionStyle(),
        items: [
          {
            id: "landing-education-item",
            title: "软件工程 · 工学学士",
            subtitle: "浙江大学",
            startDate: "2014.09",
            endDate: "2018.06",
            current: false,
            location: "杭州",
            description: "",
            highlights: [],
            skills: [],
            url: "",
          },
        ],
      },
      {
        id: "landing-skills",
        type: "skills",
        title: "专业技能",
        visible: true,
        style: createDefaultSectionStyle(),
        items: [
          {
            id: "landing-skills-item",
            title: "核心能力",
            subtitle: "",
            startDate: "",
            endDate: "",
            current: false,
            location: "",
            description: "",
            highlights: [],
            skills: ["前端架构", "性能优化", "数据可视化", "设计系统", "团队协作"],
            url: "",
          },
        ],
      },
      {
        id: "landing-certification",
        type: "certification",
        title: "证书与荣誉",
        visible: true,
        style: createDefaultSectionStyle(),
        items: [
          {
            id: "landing-certification-item",
            title: "AWS Solutions Architect – Associate",
            subtitle: "Amazon Web Services",
            startDate: "2024.03",
            endDate: "2027.03",
            current: false,
            location: "",
            description: "",
            highlights: [],
            skills: [],
            url: "",
          },
        ],
      },
    ],
  }
}
