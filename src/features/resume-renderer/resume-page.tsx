import type { CSSProperties, ReactNode } from "react"
import { withPrivateImageWidth } from "../../shared/resume-image"
import type { ResumeLinkTarget } from "../../shared/resume-schema/resume-link-target"
import type {
  ResumeDocument,
  ResumeImagePlacement,
} from "../../shared/resume-schema/resume-schema"
import { clampPlacementPageIndex, type ResumePage } from "./resume-pagination"
import { ResumeRenderer } from "./resume-renderer"

interface ResumePageContentProps {
  page: ResumePage
  mode?: "preview" | "public"
  selectedSectionId?: string
  linkedTarget?: ResumeLinkTarget | null
  children?: ReactNode
}

export function ResumePageContent({
  page,
  mode = "preview",
  selectedSectionId,
  linkedTarget,
  children,
}: ResumePageContentProps) {
  return (
    <div className="resume-page-content">
      <ResumeRenderer
        document={page.document}
        mode={mode}
        showProfile={page.showProfile}
        selectedSectionId={selectedSectionId}
        linkedTarget={linkedTarget}
      />
      {children}
    </div>
  )
}

export function getPagePlacements(
  document: ResumeDocument,
  pageIndex: number,
  pageCount: number,
): ResumeImagePlacement[] {
  return document.resources.placements
    .filter(
      (placement) =>
        clampPlacementPageIndex(placement.pageIndex, pageCount) === pageIndex,
    )
    .slice()
    .sort((first, second) => first.zIndex - second.zIndex)
}

export function getPlacementStyle(placement: ResumeImagePlacement): CSSProperties {
  return {
    left: placement.x,
    top: placement.y,
    width: placement.width,
    height: placement.height,
    zIndex: placement.zIndex + 1,
  }
}

/** 公开分享页资源的同源地址；页面预载与图片层共用，避免两处拼写漂移。 */
export function publicResumeAssetUrl(publicSlug: string, assetId: string): string {
  return `/api/public-resumes/${encodeURIComponent(publicSlug)}/assets/${encodeURIComponent(assetId)}`
}

/**
 * 图片优化器可接受的宽度档位，对应 next.config 默认的 deviceSizes / imageSizes。
 * 传进 `w` 的宽度不在这些档位里会被优化器拒绝，所以这里只取固定几档。
 */
const optimizedImageWidths = [640, 1080] as const

/**
 * 公开快照的放置图改走 Next 图片优化器。
 *
 * 源图是用户上传的原图（实测 600×800 JPEG 约 50 kB），但 A4 上只按 500×640 显示，
 * 慢网（400 ms / 409 kbps）下原图要 1 秒以上才能下完，而它又是首屏 LCP 元素。
 * 交给优化器按显示宽度转码后字节数通常只剩三分之一，LCP 直接受益。
 *
 * 只给单一地址、不铺 `srcSet`：这一张图只需要一个尺寸，`srcSet` + `sizes` 会引入
 * 「浏览器自己挑候选」的分支，预载地址和实际请求容易对不上，多下一个尺寸不划算。
 *
 * 只对公开快照启用：私有资源要按 JWT 校验归属，优化器是以服务端身份去取源的，
 * 拿不到用户会话，走这条路会 401。
 */
export function publicOptimizedImageUrl(source: string, width: number): string {
  const allowed =
    optimizedImageWidths.find((candidate) => candidate >= width) ??
    optimizedImageWidths[optimizedImageWidths.length - 1]
  return `/_next/image?url=${encodeURIComponent(source)}&w=${allowed}&q=75`
}

interface StaticResumeImageLayerProps {
  document: ResumeDocument
  pageIndex: number
  pageCount: number
  assetUrls?: Record<string, string>
  publicSlug?: string
}

export function StaticResumeImageLayer({
  document,
  pageIndex,
  pageCount,
  assetUrls,
  publicSlug,
}: StaticResumeImageLayerProps) {
  return (
    <div className="resume-image-layer">
      {getPagePlacements(document, pageIndex, pageCount).map((placement) => {
        const asset = document.resources.assets.find(
          (candidate) => candidate.id === placement.assetId,
        )
        if (!asset) {
          return null
        }
        const source =
          assetUrls?.[asset.id] ??
          (publicSlug ? publicResumeAssetUrl(publicSlug, asset.id) : "")
        if (!source) {
          return null
        }
        // 首页放置图可能成为 LCP 元素：高优先级预取；其余页面不占带宽。
        // 公开快照走 Next 图片优化器；私有资源由资源路由自己按 `?w=` 转码。
        // 两条路都按显示宽度取档，宽度为 0 的占位不参与优化，直接下发原图地址。
        const optimized =
          placement.width > 0
            ? publicSlug
              ? publicOptimizedImageUrl(source, placement.width)
              : withPrivateImageWidth(source, placement.width)
            : null
        return (
          // biome-ignore lint/performance/noImgElement: private publication assets are already validated and dimensioned
          <img
            className="resume-placed-image resume-placed-image-static"
            data-shape={placement.shape}
            key={placement.id}
            src={optimized ?? source}
            alt={asset.alt}
            fetchPriority={pageIndex === 0 ? "high" : "low"}
            style={{
              ...getPlacementStyle(placement),
              objectFit: placement.objectFit,
            }}
          />
        )
      })}
    </div>
  )
}
