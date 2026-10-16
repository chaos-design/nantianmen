import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import { preload } from "react-dom"
import { PublicResumeActions } from "../../../features/resume-renderer/public-resume-actions"
import { PublicResumeAttribution } from "../../../features/resume-renderer/public-resume-attribution"
import {
  getPagePlacements,
  publicResumeAssetUrl,
  ResumePageContent,
  StaticResumeImageLayer,
} from "../../../features/resume-renderer/resume-page"
import { paginateResumeDocument } from "../../../features/resume-renderer/resume-pagination"
import {
  getOptionalPublicViewer,
  getTestResumePolicy,
} from "../../../server/auth/auth-context"
import { ResumeService } from "../../../server/domain/resume-service"
import { getResumeRepository } from "../../../server/repositories/repository-factory"

export const dynamic = "force-dynamic"

interface PublicResumePageProps {
  params: Promise<{ "public-slug": string }>
}

/**
 * 同一请求里 generateMetadata 与页面各取一次公开快照；
 * 用 React cache 按 slug 去重，服务端只查一次存储，直接压缩 TTFB。
 */
const getPublicResume = cache(async (publicSlug: string) => {
  try {
    const service = new ResumeService(getResumeRepository(), getTestResumePolicy())
    const viewer = await getOptionalPublicViewer()
    return await service.getPublicResume(publicSlug, viewer)
  } catch {
    notFound()
  }
})

export async function generateMetadata({
  params,
}: PublicResumePageProps): Promise<Metadata> {
  const routeParams = await params
  const result = await getPublicResume(routeParams["public-slug"])
  return {
    title: result.resume.title,
    description: result.publication.publishedDocument.profile.summary,
    robots: { index: false, follow: false },
  }
}

export default async function PublicResumePage({ params }: PublicResumePageProps) {
  const routeParams = await params
  const result = await getPublicResume(routeParams["public-slug"])
  const document = result.publication.publishedDocument
  const pages = paginateResumeDocument(document)

  // 首页放置图可能成为 LCP 元素：把预载链接写进 <head>，浏览器解析到文档
  // 头部就开始拉取图片，与 CSS 下载并行，不必等 DOM 解析到深处的 <img>。
  for (const placement of getPagePlacements(document, 0, pages.length)) {
    const asset = document.resources.assets.find(
      (candidate) => candidate.id === placement.assetId,
    )
    if (!asset) {
      continue
    }
    preload(publicResumeAssetUrl(result.resume.publicSlug, asset.id), {
      as: "image",
      fetchPriority: "high",
    })
  }

  return (
    <main className="public-resume-shell">
      <header className="public-resume-toolbar">
        <Link className="brand-mark brand-mark-compact" href="/">
          <span>R</span>
          <span>Résumé Lab</span>
        </Link>
        <div>
          <PublicResumeActions mode="a4" publicSlug={result.resume.publicSlug} />
        </div>
      </header>
      <div className="public-resume-stage">
        <div className="public-a4-pages">
          {pages.map((page, index) => (
            <div className="public-a4-page" key={`page-${index + 1}`}>
              <ResumePageContent page={page} mode="public">
                <StaticResumeImageLayer
                  document={document}
                  pageIndex={index}
                  pageCount={pages.length}
                  publicSlug={result.resume.publicSlug}
                />
              </ResumePageContent>
            </div>
          ))}
        </div>
      </div>
      <PublicResumeAttribution />
    </main>
  )
}
