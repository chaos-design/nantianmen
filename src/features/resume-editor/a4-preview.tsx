"use client"

import { ImageIcon } from "lucide-react"
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react"
import { Badge } from "../../components/ui/badge"
import type { ResumeLinkTarget } from "../../shared/resume-schema/resume-link-target"
import type {
  ResumeDocument,
  ResumeImagePlacement,
} from "../../shared/resume-schema/resume-schema"
import {
  A4_PAGE_HEIGHT,
  A4_PAGE_WIDTH,
  MIN_IMAGE_PLACEMENT_SIZE,
} from "../../shared/resume-schema/resume-schema"
import {
  getPagePlacements,
  getPlacementStyle,
  ResumePageContent,
} from "../resume-renderer/resume-page"
import {
  clampPlacementPageIndex,
  paginateResumeDocument,
} from "../resume-renderer/resume-pagination"

export { paginateResumeDocument } from "../resume-renderer/resume-pagination"

export const MIN_PREVIEW_ZOOM = 40
export const MAX_PREVIEW_ZOOM = 150
export const PREVIEW_ZOOM_STEP = 10

export function clampPreviewZoom(zoom: number): number {
  return Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, zoom))
}

export function calculateWheelZoom(currentZoom: number, deltaY: number): number {
  if (!Number.isFinite(currentZoom)) {
    return 60
  }
  if (!Number.isFinite(deltaY)) {
    return clampPreviewZoom(currentZoom)
  }
  const nextZoom = currentZoom * Math.exp(deltaY * -0.0012)
  return clampPreviewZoom(Math.round(nextZoom * 100) / 100)
}

export function calculateDampedZoom(
  currentZoom: number,
  targetZoom: number,
  elapsedMilliseconds: number,
): number {
  const safeCurrent = Number.isFinite(currentZoom) ? clampPreviewZoom(currentZoom) : 60
  const safeTarget = Number.isFinite(targetZoom)
    ? clampPreviewZoom(targetZoom)
    : safeCurrent
  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds <= 0) {
    return safeCurrent
  }

  const elapsed = Math.min(elapsedMilliseconds, 64)
  const response = 1 - Math.exp(-elapsed / 24)
  const nextZoom = safeCurrent + (safeTarget - safeCurrent) * response
  if (Math.abs(safeTarget - nextZoom) < 0.05) {
    return safeTarget
  }
  return clampPreviewZoom(Math.round(nextZoom * 1000) / 1000)
}

export function calculateDampedScrollPosition(
  currentPosition: number,
  targetPosition: number,
  elapsedMilliseconds: number,
): number {
  const safeCurrent = Number.isFinite(currentPosition)
    ? Math.max(0, currentPosition)
    : 0
  const safeTarget = Number.isFinite(targetPosition)
    ? Math.max(0, targetPosition)
    : safeCurrent
  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds <= 0) {
    return safeCurrent
  }

  const elapsed = Math.min(elapsedMilliseconds, 64)
  const response = 1 - Math.exp(-elapsed / 18)
  const nextPosition = safeCurrent + (safeTarget - safeCurrent) * response
  if (Math.abs(safeTarget - nextPosition) < 0.5) {
    return safeTarget
  }
  return Math.max(0, Math.round(nextPosition * 100) / 100)
}

export function calculateAnchoredScrollPosition(
  scrollPosition: number,
  pointerPosition: number,
  anchorStartPosition: number,
  anchorSize: number,
  anchorRatio: number,
): number {
  const safeScrollPosition = Number.isFinite(scrollPosition)
    ? Math.max(0, scrollPosition)
    : 0
  if (
    !Number.isFinite(pointerPosition) ||
    !Number.isFinite(anchorStartPosition) ||
    !Number.isFinite(anchorSize) ||
    !Number.isFinite(anchorRatio)
  ) {
    return safeScrollPosition
  }
  return Math.max(
    0,
    safeScrollPosition +
      anchorStartPosition +
      anchorSize * anchorRatio -
      pointerPosition,
  )
}

export function calculateFitZoom(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return 60
  }
  const availableWidth = Math.max(0, containerWidth - 64)
  const rawZoom = (availableWidth / 794) * 100
  const steppedZoom = Math.floor(rawZoom / PREVIEW_ZOOM_STEP) * PREVIEW_ZOOM_STEP
  return clampPreviewZoom(steppedZoom)
}

interface A4PreviewProps {
  document: ResumeDocument
  assetUrls: Record<string, string>
  selectedSectionId: string
  selectedPageIndex: number
  selectedPlacementId: string | null
  linkedTarget: ResumeLinkTarget | null
  zoom: number
  onChange: (document: ResumeDocument) => void
  onSelectSection: (sectionId: string) => void
  onSelectPage: (pageIndex: number) => void
  onSelectPlacement: (placementId: string | null) => void
  onSelectLinkedTarget: (target: ResumeLinkTarget | null) => void
}

interface PlacementGesture {
  pointerId: number
  mode: "move" | "resize"
  pageIndex: number
  startClientX: number
  startClientY: number
  original: ResumeImagePlacement
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function A4Preview({
  document,
  assetUrls,
  selectedSectionId,
  selectedPageIndex,
  selectedPlacementId,
  linkedTarget,
  zoom,
  onChange,
  onSelectSection,
  onSelectPage,
  onSelectPlacement,
  onSelectLinkedTarget,
}: A4PreviewProps) {
  const pages = paginateResumeDocument(document)
  const [transientPlacement, setTransientPlacement] =
    useState<ResumeImagePlacement | null>(null)
  const transientPlacementRef = useRef<ResumeImagePlacement | null>(null)
  const gestureRef = useRef<PlacementGesture | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const effectiveSelectedPageIndex = clampPlacementPageIndex(
    selectedPageIndex,
    pages.length,
  )

  function handleCanvasClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const page = target.closest<HTMLElement>("[data-page-index]")
    if (page?.dataset.pageIndex) {
      onSelectPage(Number(page.dataset.pageIndex))
      onSelectPlacement(null)
    }
    const item = target.closest<HTMLElement>("[data-item-id]")
    const section = target.closest<HTMLElement>("[data-section-id]")
    if (item?.dataset.itemId && section?.dataset.sectionId) {
      onSelectSection(section.dataset.sectionId)
      onSelectLinkedTarget({
        kind: "item",
        sectionId: section.dataset.sectionId,
        itemId: item.dataset.itemId.replace(/::continuation-\d+$/, ""),
      })
      return
    }
    if (section?.dataset.sectionId) {
      onSelectSection(section.dataset.sectionId)
      onSelectLinkedTarget(
        section.dataset.sectionId === "profile"
          ? { kind: "profile" }
          : {
              kind: "section",
              sectionId: section.dataset.sectionId,
            },
      )
      return
    }
    onSelectLinkedTarget(null)
  }

  useEffect(() => {
    if (!linkedTarget) {
      return
    }
    const frame = requestAnimationFrame(() => {
      const targets =
        linkedTarget.kind === "profile"
          ? canvasRef.current?.querySelectorAll<HTMLElement>(
              '[data-section-id="profile"]',
            )
          : linkedTarget.kind === "section"
            ? canvasRef.current?.querySelectorAll<HTMLElement>("[data-section-id]")
            : canvasRef.current?.querySelectorAll<HTMLElement>("[data-item-id]")
      const linkedElement = Array.from(targets ?? []).find((element) => {
        if (linkedTarget.kind === "profile") {
          return true
        }
        if (linkedTarget.kind === "section") {
          return element.dataset.sectionId === linkedTarget.sectionId
        }
        return (
          element.dataset.itemId === linkedTarget.itemId ||
          element.dataset.itemId?.startsWith(`${linkedTarget.itemId}::continuation-`)
        )
      })
      const pageIndex = Number(
        linkedElement?.closest<HTMLElement>("[data-page-index]")?.dataset.pageIndex,
      )
      if (Number.isInteger(pageIndex) && pageIndex >= 0) {
        onSelectPage(pageIndex)
      }
      linkedElement?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [linkedTarget, onSelectPage])

  function startGesture(
    event: ReactPointerEvent<HTMLElement>,
    placement: ResumeImagePlacement,
    pageIndex: number,
    mode: PlacementGesture["mode"],
  ) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = {
      pointerId: event.pointerId,
      mode,
      pageIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      original: placement,
    }
    transientPlacementRef.current = placement
    setTransientPlacement(placement)
    onSelectPage(pageIndex)
    onSelectPlacement(placement.id)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return
    }
    event.preventDefault()
    const scale = zoom / 100
    const deltaX = (event.clientX - gesture.startClientX) / scale
    const deltaY = (event.clientY - gesture.startClientY) / scale
    const original = gesture.original
    const resizeDelta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY
    const circleSize =
      original.shape === "circle"
        ? clamp(
            Math.min(original.width, original.height) + resizeDelta,
            MIN_IMAGE_PLACEMENT_SIZE,
            Math.min(A4_PAGE_WIDTH - original.x, A4_PAGE_HEIGHT - original.y),
          )
        : null
    const nextPlacement =
      gesture.mode === "move"
        ? {
            ...original,
            pageIndex: gesture.pageIndex,
            x: clamp(original.x + deltaX, 0, A4_PAGE_WIDTH - original.width),
            y: clamp(original.y + deltaY, 0, A4_PAGE_HEIGHT - original.height),
          }
        : {
            ...original,
            pageIndex: gesture.pageIndex,
            width:
              circleSize ??
              clamp(
                original.width + deltaX,
                MIN_IMAGE_PLACEMENT_SIZE,
                A4_PAGE_WIDTH - original.x,
              ),
            height:
              circleSize ??
              clamp(
                original.height + deltaY,
                MIN_IMAGE_PLACEMENT_SIZE,
                A4_PAGE_HEIGHT - original.y,
              ),
          }
    transientPlacementRef.current = nextPlacement
    setTransientPlacement(nextPlacement)
  }

  function finishGesture(event: ReactPointerEvent<HTMLElement>, commit: boolean) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const nextPlacement = transientPlacementRef.current
    if (
      commit &&
      nextPlacement &&
      JSON.stringify(nextPlacement) !== JSON.stringify(gesture.original)
    ) {
      onChange({
        ...document,
        resources: {
          ...document.resources,
          placements: document.resources.placements.map((placement) =>
            placement.id === nextPlacement.id ? nextPlacement : placement,
          ),
        },
      })
    }
    gestureRef.current = null
    transientPlacementRef.current = null
    setTransientPlacement(null)
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: the canvas contains nested resume links and cannot be a button
    <div
      ref={canvasRef}
      className="a4-canvas"
      role="button"
      tabIndex={0}
      aria-label="A4 可视化画布，点击简历区块进行选择"
      data-zoom={zoom}
      style={
        {
          "--a4-scale": (zoom / 100).toFixed(5),
        } as CSSProperties
      }
      onClick={handleCanvasClick}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          onSelectSection(selectedSectionId)
        }
      }}
    >
      {pages.map((page, index) => (
        <div
          className="a4-page-wrap"
          data-page-index={index}
          data-selected={effectiveSelectedPageIndex === index}
          key={`page-${index + 1}`}
        >
          <div className="a4-page-label">
            <span>A4</span>
            <Badge variant="outline">
              {index + 1} / {pages.length}
            </Badge>
          </div>
          <div className="a4-page">
            <ResumePageContent
              page={page}
              selectedSectionId={selectedSectionId}
              linkedTarget={linkedTarget}
            >
              <div className="resume-image-layer resume-image-layer-editable">
                {getPagePlacements(document, index, pages.length).map((placement) => {
                  const renderedPlacement =
                    transientPlacement?.id === placement.id
                      ? transientPlacement
                      : placement
                  const asset = document.resources.assets.find(
                    (candidate) => candidate.id === placement.assetId,
                  )
                  if (!asset) {
                    return null
                  }
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: placement contains a nested resize control
                    <div
                      className="resume-image-placement"
                      data-selected={selectedPlacementId === placement.id}
                      data-shape={renderedPlacement.shape}
                      data-zero-size={
                        renderedPlacement.width === 0 || renderedPlacement.height === 0
                      }
                      key={placement.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`选择图片 ${asset.alt || asset.name}`}
                      style={getPlacementStyle(renderedPlacement)}
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelectPage(index)
                        onSelectPlacement(placement.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onSelectPage(index)
                          onSelectPlacement(placement.id)
                        }
                      }}
                      onPointerDown={(event) =>
                        startGesture(event, placement, index, "move")
                      }
                      onPointerMove={handlePointerMove}
                      onPointerUp={(event) => finishGesture(event, true)}
                      onPointerCancel={(event) => finishGesture(event, false)}
                    >
                      {assetUrls[asset.id] ? (
                        // biome-ignore lint/performance/noImgElement: authenticated Blob URLs cannot use the Next image optimizer
                        <img
                          className="resume-placed-image"
                          src={assetUrls[asset.id]}
                          alt={asset.alt}
                          draggable={false}
                          style={{ objectFit: renderedPlacement.objectFit }}
                        />
                      ) : (
                        <div className="resume-image-placeholder">
                          <ImageIcon aria-hidden="true" />
                          <span>加载图片</span>
                        </div>
                      )}
                      {(renderedPlacement.width === 0 ||
                        renderedPlacement.height === 0) && (
                        <span
                          className="resume-image-zero-locator"
                          aria-hidden="true"
                        />
                      )}
                      {selectedPlacementId === placement.id && (
                        <button
                          className="resume-image-resize-handle"
                          type="button"
                          aria-label="拖动调整图片大小"
                          onPointerDown={(event) =>
                            startGesture(event, placement, index, "resize")
                          }
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </ResumePageContent>
          </div>
        </div>
      ))}
    </div>
  )
}
