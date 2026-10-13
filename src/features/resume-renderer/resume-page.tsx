import type { CSSProperties, ReactNode } from "react"
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
        return (
          // biome-ignore lint/performance/noImgElement: private publication assets are already validated and dimensioned
          <img
            className="resume-placed-image resume-placed-image-static"
            data-shape={placement.shape}
            key={placement.id}
            src={source}
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
