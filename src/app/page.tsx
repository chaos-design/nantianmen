import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  Globe2Icon,
  Layers3Icon,
  LockKeyholeIcon,
  SparklesIcon,
} from "lucide-react"
import { cookies } from "next/headers"
import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import {
  formatLandingFooterCopyright,
  landingLegalLinks,
  landingRepository,
} from "../features/landing/landing-footer-links"
import { LandingGithubMark } from "../features/landing/landing-github-mark"
import {
  getLandingCapabilities,
  getLandingHighlights,
  getLandingWorkflow,
  landingImpactExample,
  landingLegacyWorkflow,
  landingUnifiedWorkflow,
} from "../features/landing/landing-home-content"
import { LandingNavLinks } from "../features/landing/landing-nav-links"
import { ResumePageContent } from "../features/resume-renderer/resume-page"
import { paginateResumeDocument } from "../features/resume-renderer/resume-pagination"
import { LandingTemplateGrid } from "../features/resume-template/landing-template-grid"
import { createLandingTemplatePreviewDocument } from "../features/resume-template/landing-template-preview"
import { readPreviewSession } from "../server/auth/preview-session"
import { previewSessionCookieName } from "../server/auth/preview-session-cookie"
import { A4_PAGE_WIDTH } from "../shared/resume-schema/resume-schema"
import { templateSchemes } from "../shared/resume-template/template-schemes"

type PreviewConfig = Parameters<typeof readPreviewSession>[1]

const landingFinalOutputs = [
  {
    icon: FileTextIcon,
    index: "01",
    title: "A4 简历",
    description: "智能分页 · PDF 导出",
  },
  {
    icon: Globe2Icon,
    index: "02",
    title: "Web 页面",
    description: "响应式展示 · 16 种风格",
  },
  {
    icon: LockKeyholeIcon,
    index: "03",
    title: "只读分享",
    description: "发布快照 · 权限隔离",
  },
] as const

const landingIntentOutputIcons = [Layers3Icon, FileTextIcon, Globe2Icon] as const

const standardWorkflowStageLabels = [
  "CONTENT INPUT",
  "VISUAL SYSTEM",
  "PUBLISHED OUTPUT",
] as const

const previewWorkflowStageLabels = ["PREVIEW ENTRY", "READ-ONLY OUTPUT"] as const

function LandingSectionHeading({
  index,
  eyebrow,
  title,
  description,
  titleId,
  status = "CONNECTED",
}: {
  index: string
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  titleId?: string
  status?: string
}) {
  return (
    <header className="landing-section-heading">
      <div className="landing-section-index" aria-hidden="true">
        <span>{index}</span>
        <i />
      </div>
      <div className="landing-section-copy">
        <span>{eyebrow}</span>
        <h2 id={titleId}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="landing-section-status" aria-hidden="true">
        <i />
        {status}
      </div>
    </header>
  )
}

function readPreviewConfig(
  environment: Readonly<Record<string, string | undefined>>,
): PreviewConfig {
  const userId = environment.PREVIEW_USER_ID?.trim()
  const email = environment.PREVIEW_USER_EMAIL?.trim()
  const resumeId = environment.PREVIEW_RESUME_ID?.trim()
  const sessionSecret = environment.PREVIEW_SESSION_SECRET?.trim()

  if (!userId || !email || !resumeId || !sessionSecret) {
    return null
  }

  return {
    userId,
    email,
    resumeId,
    sessionSecret,
  }
}

async function isPreviewHomeSession(): Promise<boolean> {
  const preview = readPreviewConfig(process.env)
  if (!preview) {
    return false
  }
  const cookieStore = await cookies()
  return Boolean(
    readPreviewSession(cookieStore.get(previewSessionCookieName)?.value, preview),
  )
}

function TemplateResumePreview({
  scheme,
  index,
}: {
  scheme: (typeof templateSchemes)[number]
  index: number
}) {
  const pages = paginateResumeDocument(createLandingTemplatePreviewDocument(scheme.id))
  const [page] = pages

  return (
    <div
      className="landing-template-sheet"
      aria-hidden="true"
      data-template={scheme.id}
      data-page-count={pages.length}
      inert
      style={
        {
          "--template-order": index,
        } as CSSProperties
      }
    >
      <div className="landing-template-document">
        <ResumePageContent page={page} mode="public" />
      </div>
      <div className="landing-template-glow" aria-hidden="true" />
    </div>
  )
}

export default async function HomePage() {
  const previewMode = await isPreviewHomeSession()
  const sampleDocument = createLandingTemplatePreviewDocument(templateSchemes[0].id)
  const [samplePage] = paginateResumeDocument(sampleDocument)
  const landingCapabilities = getLandingCapabilities(previewMode)
  const landingHighlights = getLandingHighlights(previewMode)
  const landingWorkflow = getLandingWorkflow(previewMode)
  const workflowStageLabels = previewMode
    ? previewWorkflowStageLabels
    : standardWorkflowStageLabels
  const templateCategoryCount = new Set(
    templateSchemes.map((scheme) => scheme.category),
  ).size
  const footerCopyright = formatLandingFooterCopyright(new Date().getFullYear())
  const finalCta = previewMode
    ? {
        badge: "PREVIEW READY",
        title: "一份固定样例，完整走过三种展示结果。",
        description: "进入工作台，依次查看 A4、Web 页面与已发布的只读分享快照。",
      }
    : {
        badge: "YOUR STORY, SHARPER",
        title: "写一次，导出 PDF，也能直接发链接。",
        description:
          "不必再找模板、打开 Word 和反复传文件。在一个工作台完成内容、排版与分享。",
      }

  return (
    <main className="landing-shell" data-preview-mode={previewMode}>
      <div className="landing-grid" aria-hidden="true" />
      <div className="landing-journey-line" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <nav className="landing-nav">
        <Link className="brand-mark" href="/">
          <span>R</span>
          <span>Résumé Lab</span>
        </Link>
        <LandingNavLinks />
        <Link className="landing-nav-entry" href="/workspace">
          {previewMode ? "进入 Preview 工作台" : "进入工作台"}
          <ArrowRightIcon />
        </Link>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <div className="landing-stage-label" aria-hidden="true">
            <span>01</span>
            <i />
            CAREER STORY WORKBENCH
          </div>
          <Badge variant="secondary">
            <SparklesIcon data-icon="inline-start" />
            {previewMode ? "Preview 只读体验" : "不找模板 · 不开 Word · 直接分享"}
          </Badge>
          {previewMode ? (
            <>
              <h1>
                查看固定测试简历，
                <span>体验只读预览能力。</span>
              </h1>
              <p>
                Preview 账号不支持创建、编辑、AI、发布或删除。这里仅保留可查看的 A4 和
                Web 展示入口，避免出现不可用功能。
              </p>
            </>
          ) : (
            <>
              <h1>
                简历写一次，
                <span>PDF 与链接都能直接交付。</span>
              </h1>
              <p>
                不用到处找模板，不用打开 Word 反复调格式。
                在一个工作台整理经历、切换样式、导出 PDF，或发布一个链接直接分享。
              </p>
            </>
          )}
          <div className="landing-actions" id="start">
            {previewMode ? (
              <Button size="lg" asChild>
                <Link href="/workspace">
                  进入 Preview 工作台
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            ) : (
              <Button size="lg" asChild>
                <Link href="/workspace">
                  进入工作台选择模板
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            )}
            <Button size="lg" variant="outline" asChild>
              <Link href="#templates">
                浏览 24 套模板
                <ArrowDownIcon data-icon="inline-end" />
              </Link>
            </Button>
            <span>
              {previewMode
                ? "固定样例 · 只读浏览 · 不开放编辑"
                : "邮箱登录后保存 · 跨设备继续编辑"}
            </span>
          </div>
          <div className="landing-proof">
            <span>
              <CheckIcon />
              内容只写一次
            </span>
            <span>
              <CheckIcon />
              {previewMode ? "A4 智能分页" : "PDF 随时导出"}
            </span>
            <span>
              <CheckIcon />
              {previewMode ? "只读展示" : "链接直接分享"}
            </span>
          </div>
        </div>

        <div className="landing-preview">
          <div className="landing-preview-toolbar">
            <div aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p>LIVE CANVAS · A4 / 01</p>
          </div>
          <div className="landing-preview-flow" aria-hidden="true">
            <span>STRUCTURED CONTENT</span>
            <i />
            <span>LIVE LAYOUT</span>
          </div>
          <div className="landing-preview-canvas">
            <ResumePageContent page={samplePage} mode="public" />
          </div>
          <div className="landing-preview-state" aria-hidden="true">
            <span>
              <i />
              DOCUMENT VALID
            </span>
            <span>24 STYLES READY</span>
          </div>
          <div className="landing-preview-note">
            <Layers3Icon />
            <div>
              <strong>结构驱动渲染</strong>
              <span>切换模板，内容保持完整</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-outcomes" aria-label="产品能力概览">
        <div className="landing-outcomes-source" aria-hidden="true">
          <span>ONE SOURCE</span>
          <i />
          <small>MULTI OUTPUT</small>
        </div>
        {landingHighlights.map((item) => (
          <article key={item.label}>
            <span className="landing-outcome-status" aria-hidden="true">
              READY
            </span>
            <strong>
              {item.value}
              <span>{item.suffix}</span>
            </strong>
            <p>{item.label}</p>
          </article>
        ))}
      </section>

      {!previewMode ? (
        <section
          className="landing-intent"
          id="intent"
          aria-labelledby="landing-intent-title"
        >
          <LandingSectionHeading
            index="02"
            eyebrow="WHY THIS EXISTS"
            title="少一点文件操作，多一点真正的表达。"
            description="这个系统的初心很简单：把找模板、调 Word、导出 PDF 和来回传文件，收束成一条可以持续维护的简历工作流。"
            titleId="landing-intent-title"
            status="ONE WORKSPACE"
          />
          <div className="landing-intent-system">
            <article className="landing-intent-legacy">
              <header>
                <span>传统方式</span>
                <small>4 STEPS / REPEAT</small>
              </header>
              <div>
                {landingLegacyWorkflow.map((item) => (
                  <div key={item.step}>
                    <span>{item.step}</span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <footer>
                <span>每次修改，整套流程重新开始</span>
                <small>VERSION_最终版_再改.pdf</small>
              </footer>
            </article>

            <div className="landing-intent-bridge" aria-hidden="true">
              <ArrowRightIcon />
              <span>REPLACE</span>
            </div>

            <article className="landing-intent-unified">
              <header>
                <span>Résumé Lab</span>
                <small>ONE SOURCE / READY</small>
              </header>
              <div>
                {landingUnifiedWorkflow.map((item, index) => {
                  const Icon = landingIntentOutputIcons[index] ?? Globe2Icon

                  return (
                    <div key={item.label}>
                      <div className="landing-intent-output-icon">
                        <Icon aria-hidden="true" />
                      </div>
                      <div>
                        <small>{item.label}</small>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                      </div>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                    </div>
                  )
                })}
              </div>
              <footer>
                <span>
                  <i />
                  SHARE LINK READY
                </span>
                <small>内容更新，出口始终清晰</small>
              </footer>
            </article>
          </div>
        </section>
      ) : null}

      <section className="landing-capabilities" id="capabilities" aria-label="平台能力">
        <LandingSectionHeading
          index={previewMode ? "02" : "03"}
          eyebrow="BUILT FOR CLARITY"
          title={
            previewMode
              ? "Preview 只展示真正可用的内容"
              : "从写内容到发出去，功能都在一个工作台"
          }
          description={
            previewMode
              ? "创建、编辑和发布入口已隐藏，只保留固定样例的 A4、Web 与分享预览。"
              : "内容、样式和发布彼此独立。换模板不重写，改内容不重排，需要文件或链接时随时输出。"
          }
        />
        <div className="landing-capability-grid">
          <div className="landing-capability-rail" aria-hidden="true">
            <span>SOURCE</span>
            <i />
            <span>OUTPUT</span>
          </div>
          {landingCapabilities.map(
            ({ icon: Icon, index, title, description }, capabilityIndex) => (
              <article
                key={title}
                style={
                  {
                    "--capability-order": capabilityIndex,
                  } as CSSProperties
                }
              >
                <div className="landing-capability-marker">
                  <span>{index}</span>
                  <Icon aria-hidden="true" />
                </div>
                <div className="landing-capability-copy">
                  <small>CORE MODULE / {index}</small>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <span className="landing-capability-state">
                  <i />
                  CONNECTED
                </span>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="landing-impact" aria-labelledby="landing-impact-title">
        <LandingSectionHeading
          index={previewMode ? "03" : "04"}
          eyebrow="FROM TASKS TO IMPACT"
          title="招聘者想看的，不只是你做过什么。"
          description="把工作范围、关键行动和可验证结果放在一起，让真正重要的贡献更快被看见。"
          titleId="landing-impact-title"
          status="EVIDENCE READY"
        />
        <div className="landing-impact-comparison">
          <div className="landing-impact-axis" aria-hidden="true">
            <span>RAW INPUT</span>
            <i />
            <small>STRUCTURE / EVIDENCE / RESULT</small>
            <i />
            <span>HIRING SIGNAL</span>
          </div>
          <article className="landing-impact-before">
            <span>常见写法</span>
            <p>{landingImpactExample.before}</p>
            <small>信息存在，但价值信号不足</small>
          </article>
          <div className="landing-impact-transform" aria-hidden="true">
            <ArrowRightIcon />
            <span>REWRITE</span>
          </div>
          <article className="landing-impact-after">
            <span>更有说服力</span>
            <p>{landingImpactExample.after}</p>
            <div>
              {landingImpactExample.evidence.map((item) => (
                <small key={item}>{item}</small>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="landing-template-library" id="templates">
        <LandingSectionHeading
          index={previewMode ? "04" : "05"}
          eyebrow="TEMPLATE LIBRARY"
          title={
            previewMode
              ? "浏览真实模板效果，不开放创建入口"
              : "看看哪种方式，更适合呈现你的经历"
          }
          description={
            previewMode
              ? "Preview 账号可以查看完整 A4 外观；使用模板创建简历属于编辑能力，已隐藏。"
              : "这里展示 24 套模板的真实 A4 效果。实际选择与创建统一在工作台完成。"
          }
          status={`${templateSchemes.length} STYLES ONLINE`}
        />
        <div className="landing-template-context">
          <div aria-hidden="true">
            <span>LIBRARY INDEX</span>
            <strong>{String(templateSchemes.length).padStart(2, "0")}</strong>
            <small>A4 STYLES</small>
          </div>
          <div className="landing-template-context-status">
            <span>
              <i />
              REAL A4 RENDER
            </span>
            <span>{templateCategoryCount} 类职业场景</span>
            <span>{previewMode ? "横向浏览模板" : "工作台中选择并创建"}</span>
          </div>
        </div>
        <LandingTemplateGrid pageWidth={A4_PAGE_WIDTH}>
          {templateSchemes.map((scheme, index) => (
            <article key={scheme.id}>
              <TemplateResumePreview scheme={scheme} index={index} />
              <div className="landing-template-meta">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{scheme.name}</h3>
                <p>{scheme.category}</p>
              </div>
            </article>
          ))}
        </LandingTemplateGrid>
      </section>

      <section className="landing-workflow" id="workflow">
        <LandingSectionHeading
          index={previewMode ? "05" : "06"}
          eyebrow="HOW IT WORKS"
          title={
            previewMode
              ? "沿着清晰路径，查看每种最终效果"
              : "写好内容，选择样式，然后决定怎么交付"
          }
          description={
            previewMode
              ? "从工作台进入固定测试简历，依次体验 A4、Web 与分享预览。"
              : "需要正式投递就导出 PDF，需要快速展示就发布链接；下一次修改仍从同一份内容继续。"
          }
          status="PATH VERIFIED"
        />
        <div className="landing-workflow-track">
          <div className="landing-workflow-line" aria-hidden="true">
            <i />
          </div>
          {landingWorkflow.map((item, index) => (
            <article
              key={item.step}
              style={
                {
                  "--workflow-order": index,
                } as CSSProperties
              }
            >
              <header>
                <span>{item.step}</span>
                <small>{workflowStageLabels[index]}</small>
              </header>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <footer>
                <span>
                  <i />
                  READY
                </span>
                {index < landingWorkflow.length - 1 ? (
                  <ArrowRightIcon aria-hidden="true" />
                ) : (
                  <CheckIcon aria-hidden="true" />
                )}
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta" aria-labelledby="landing-final-title">
        <div className="landing-final-copy">
          <div className="landing-final-heading">
            <Badge variant="outline">{finalCta.badge}</Badge>
            <h2 id="landing-final-title">{finalCta.title}</h2>
            <p>{finalCta.description}</p>
          </div>
          <div className="landing-final-proof">
            <span>
              <CheckIcon />
              不用 Word 反复排版
            </span>
            <span>
              <CheckIcon />
              不用来回发送文件
            </span>
          </div>
          {previewMode ? (
            <Button className="landing-final-action" size="lg" asChild>
              <Link href="/workspace">
                进入 Preview 工作台
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          ) : (
            <Button className="landing-final-action" size="lg" asChild>
              <Link href="/workspace">
                进入工作台选择模板
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          )}
        </div>

        <section className="landing-final-console" aria-label="可生成的简历展示结果">
          <header>
            <div aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <span>OUTPUT PIPELINE</span>
            <small>03 / READY</small>
          </header>
          <div className="landing-final-output-list">
            {landingFinalOutputs.map(({ icon: Icon, index, title, description }) => (
              <article key={title}>
                <span>{index}</span>
                <div className="landing-final-output-icon">
                  <Icon aria-hidden="true" />
                </div>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <small>READY</small>
              </article>
            ))}
          </div>
          <footer>
            <span>
              <i />
              STRUCTURED SOURCE
            </span>
            <span>ONE CONTENT / MANY VIEWS</span>
          </footer>
          <div className="landing-final-scan" aria-hidden="true" />
        </section>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-statement">
          <div className="landing-footer-index" aria-hidden="true">
            <span>END NOTE</span>
            <i />
            <small>06 / CLOSE</small>
          </div>
          <div className="landing-footer-copy">
            <span>CAREER STORY / EDITORIAL CLOSE</span>
            <h2 id="landing-footer-title">
              让经历被看见，
              <span>让价值被准确交付。</span>
            </h2>
            <p>内容只维护一次，表达可以抵达不同场景。</p>
          </div>
        </div>

        <div className="landing-footer-rail">
          <Link className="brand-mark brand-mark-compact" href="/">
            <span>R</span>
            <span>Résumé Lab</span>
          </Link>

          <ul className="landing-footer-signals" aria-label="支持的输出方式">
            <li>
              <i aria-hidden="true" />
              STRUCTURED CONTENT
            </li>
            <li>
              <i aria-hidden="true" />
              A4 + WEB
            </li>
            <li>
              <i aria-hidden="true" />
              READY TO SHARE
            </li>
          </ul>

          <div className="landing-footer-actions">
            <div className="landing-footer-schema">
              <i aria-hidden="true" />
              <span>SCHEMA</span>
              <strong>V1.0 / STABLE</strong>
            </div>
            <Link className="landing-footer-entry" href="/workspace">
              {previewMode ? "进入 Preview 工作台" : "进入工作台"}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="landing-footer-meta">
          <p className="landing-footer-copyright">{footerCopyright}</p>
          <nav className="landing-footer-links" aria-label="站点信息与开源地址">
            <a
              className="landing-footer-repo"
              href={landingRepository.href}
              rel="noreferrer"
              target="_blank"
            >
              <LandingGithubMark />
              {landingRepository.label}
              <span className="sr-only">
                仓库：{landingRepository.path}（新窗口打开）
              </span>
            </a>
            {landingLegalLinks.map((item) => (
              <Link className="landing-footer-link" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </main>
  )
}
