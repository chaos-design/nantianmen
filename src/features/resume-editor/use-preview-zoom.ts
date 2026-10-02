"use client"

import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import {
  calculateAnchoredScrollPosition,
  calculateDampedScrollPosition,
  calculateDampedZoom,
  calculateFitZoom,
  calculateWheelZoom,
  clampPreviewZoom,
} from "./a4-preview"

interface PreviewZoomAnchor {
  viewport: HTMLElement
  canvas: HTMLElement
  page: HTMLElement
  pointerX: number
  pointerY: number
  pageRatioX: number
  pageRatioY: number
}

interface UsePreviewZoomOptions {
  panelRef: RefObject<HTMLElement | null>
  enabled: boolean
  getFitWidth: () => number
}

const initialPreviewZoom = 60

function getPreviewCanvas(panel: HTMLElement): HTMLElement | null {
  return panel.querySelector<HTMLElement>(".a4-canvas")
}

function renderPreviewZoom(canvas: HTMLElement, zoom: number) {
  canvas.style.setProperty("--a4-scale", (zoom / 100).toFixed(5))
  canvas.dataset.zoom = String(zoom)
}

function getPointDistanceSquared(
  rect: DOMRect,
  pointerX: number,
  pointerY: number,
): number {
  const distanceX =
    pointerX < rect.left
      ? rect.left - pointerX
      : pointerX > rect.right
        ? pointerX - rect.right
        : 0
  const distanceY =
    pointerY < rect.top
      ? rect.top - pointerY
      : pointerY > rect.bottom
        ? pointerY - rect.bottom
        : 0
  return distanceX * distanceX + distanceY * distanceY
}

function getAnchorPage(
  canvas: HTMLElement,
  target: EventTarget | null,
  pointerX: number,
  pointerY: number,
): HTMLElement | null {
  const targetPage =
    target instanceof Element ? target.closest<HTMLElement>(".a4-page") : null
  if (targetPage && canvas.contains(targetPage)) {
    return targetPage
  }

  let nearestPage: HTMLElement | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const page of canvas.querySelectorAll<HTMLElement>(".a4-page")) {
    const distance = getPointDistanceSquared(
      page.getBoundingClientRect(),
      pointerX,
      pointerY,
    )
    if (distance < nearestDistance) {
      nearestPage = page
      nearestDistance = distance
    }
  }
  return nearestPage
}

function getZoomAnchor(
  panel: HTMLElement,
  event: WheelEvent,
): PreviewZoomAnchor | null {
  const viewport = panel.querySelector<HTMLElement>(
    '[data-slot="scroll-area-viewport"]',
  )
  const canvas = getPreviewCanvas(panel)
  if (!viewport || !canvas) {
    return null
  }
  const page = getAnchorPage(canvas, event.target, event.clientX, event.clientY)
  if (!page) {
    return null
  }
  const pageRect = page.getBoundingClientRect()
  if (pageRect.width <= 0 || pageRect.height <= 0) {
    return null
  }
  return {
    viewport,
    canvas,
    page,
    pointerX: event.clientX,
    pointerY: event.clientY,
    pageRatioX: (event.clientX - pageRect.left) / pageRect.width,
    pageRatioY: (event.clientY - pageRect.top) / pageRect.height,
  }
}

export function usePreviewZoom({
  panelRef,
  enabled,
  getFitWidth,
}: UsePreviewZoomOptions) {
  const [previewZoom, setPreviewZoom] = useState(initialPreviewZoom)
  const [fitPreview, setFitPreview] = useState(true)
  const wheelZoomFrameRef = useRef<number | null>(null)
  const previewZoomRef = useRef(initialPreviewZoom)
  const wheelZoomTargetRef = useRef(initialPreviewZoom)
  const wheelZoomLastFrameRef = useRef<number | null>(null)
  const wheelZoomAnchorRef = useRef<PreviewZoomAnchor | null>(null)

  const stopWheelZoomAnimation = useCallback(() => {
    if (wheelZoomFrameRef.current !== null) {
      window.cancelAnimationFrame(wheelZoomFrameRef.current)
    }
    wheelZoomFrameRef.current = null
    wheelZoomLastFrameRef.current = null
    wheelZoomAnchorRef.current = null
  }, [])

  const applyPreviewZoom = useCallback(
    (zoom: number) => {
      const nextZoom = clampPreviewZoom(zoom)
      stopWheelZoomAnimation()
      previewZoomRef.current = nextZoom
      wheelZoomTargetRef.current = nextZoom
      const panel = panelRef.current
      const canvas = panel ? getPreviewCanvas(panel) : null
      if (canvas) {
        renderPreviewZoom(canvas, nextZoom)
      }
      setPreviewZoom(nextZoom)
    },
    [panelRef, stopWheelZoomAnimation],
  )

  useEffect(() => {
    if (!fitPreview || !enabled) {
      return
    }
    const panel = panelRef.current
    if (!panel) {
      return
    }
    const updateZoom = () => {
      applyPreviewZoom(calculateFitZoom(getFitWidth()))
    }
    updateZoom()
    const observer = new ResizeObserver(updateZoom)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [applyPreviewZoom, enabled, fitPreview, getFitWidth, panelRef])

  useEffect(() => {
    if (!enabled) {
      return
    }
    const panel = panelRef.current
    if (!panel) {
      return
    }
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    const renderZoom = (
      nextZoom: number,
      elapsedMilliseconds: number,
      settleScroll = false,
    ) => {
      const currentZoom = previewZoomRef.current
      if (nextZoom === currentZoom) {
        return
      }
      const anchor = wheelZoomAnchorRef.current
      const canvas = anchor?.canvas ?? getPreviewCanvas(panel)
      if (canvas?.isConnected) {
        renderPreviewZoom(canvas, nextZoom)
      }
      previewZoomRef.current = nextZoom

      if (
        anchor?.viewport.isConnected &&
        anchor.canvas.isConnected &&
        anchor.page.isConnected
      ) {
        const pageRect = anchor.page.getBoundingClientRect()
        const targetScrollLeft = calculateAnchoredScrollPosition(
          anchor.viewport.scrollLeft,
          anchor.pointerX,
          pageRect.left,
          pageRect.width,
          anchor.pageRatioX,
        )
        const targetScrollTop = calculateAnchoredScrollPosition(
          anchor.viewport.scrollTop,
          anchor.pointerY,
          pageRect.top,
          pageRect.height,
          anchor.pageRatioY,
        )
        anchor.viewport.scrollLeft = settleScroll
          ? targetScrollLeft
          : calculateDampedScrollPosition(
              anchor.viewport.scrollLeft,
              targetScrollLeft,
              elapsedMilliseconds,
            )
        anchor.viewport.scrollTop = settleScroll
          ? targetScrollTop
          : calculateDampedScrollPosition(
              anchor.viewport.scrollTop,
              targetScrollTop,
              elapsedMilliseconds,
            )
      }
    }

    const animateWheelZoom = (timestamp: number) => {
      const previousTimestamp = wheelZoomLastFrameRef.current ?? timestamp - 16
      wheelZoomLastFrameRef.current = timestamp
      const targetZoom = wheelZoomTargetRef.current
      const elapsedMilliseconds = timestamp - previousTimestamp
      const nextZoom = calculateDampedZoom(
        previewZoomRef.current,
        targetZoom,
        elapsedMilliseconds,
      )
      renderZoom(nextZoom, elapsedMilliseconds, nextZoom === targetZoom)

      if (nextZoom !== targetZoom) {
        wheelZoomFrameRef.current = window.requestAnimationFrame(animateWheelZoom)
        return
      }
      wheelZoomFrameRef.current = null
      wheelZoomLastFrameRef.current = null
      wheelZoomAnchorRef.current = null
      setPreviewZoom(targetZoom)
    }

    const handleWheelZoom = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return
      }
      event.preventDefault()
      setFitPreview(false)
      const deltaMultiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? panel.clientHeight
            : 1
      const normalizedDelta = Math.max(
        -120,
        Math.min(120, event.deltaY * deltaMultiplier),
      )
      wheelZoomTargetRef.current = calculateWheelZoom(
        wheelZoomTargetRef.current,
        normalizedDelta,
      )
      wheelZoomAnchorRef.current = getZoomAnchor(panel, event)

      if (motionQuery.matches) {
        const targetZoom = wheelZoomTargetRef.current
        renderZoom(targetZoom, 0, true)
        wheelZoomAnchorRef.current = null
        setPreviewZoom(targetZoom)
        return
      }
      if (wheelZoomFrameRef.current !== null) {
        return
      }
      wheelZoomLastFrameRef.current = performance.now()
      wheelZoomFrameRef.current = window.requestAnimationFrame(animateWheelZoom)
    }

    panel.addEventListener("wheel", handleWheelZoom, { passive: false })
    return () => {
      panel.removeEventListener("wheel", handleWheelZoom)
      stopWheelZoomAnimation()
    }
  }, [enabled, panelRef, stopWheelZoomAnimation])

  const zoomBy = useCallback(
    (delta: number) => {
      setFitPreview(false)
      applyPreviewZoom(previewZoomRef.current + delta)
    },
    [applyPreviewZoom],
  )

  const setManualZoom = useCallback(
    (zoom: number) => {
      setFitPreview(false)
      applyPreviewZoom(zoom)
    },
    [applyPreviewZoom],
  )

  const fit = useCallback(() => {
    setFitPreview(true)
    applyPreviewZoom(calculateFitZoom(getFitWidth()))
  }, [applyPreviewZoom, getFitWidth])

  return {
    previewZoom,
    fitPreview,
    zoomBy,
    setManualZoom,
    fit,
  }
}
