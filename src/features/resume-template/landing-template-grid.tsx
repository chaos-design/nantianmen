"use client"

import type { ReactNode } from "react"
import { useEffect, useRef } from "react"

export const LANDING_TEMPLATE_CAROUSEL_SPEED = 36
const POINTER_RESUME_DELAY = 900
const MAX_FRAME_DURATION = 64

interface LandingTemplateGridProps {
  children: ReactNode
  pageWidth: number
}

export function calculateCarouselScrollPosition(
  currentPosition: number,
  loopWidth: number,
  elapsedMilliseconds: number,
  speed = LANDING_TEMPLATE_CAROUSEL_SPEED,
): number {
  const safePosition = Number.isFinite(currentPosition)
    ? Math.max(0, currentPosition)
    : 0
  if (
    !Number.isFinite(loopWidth) ||
    loopWidth <= 0 ||
    !Number.isFinite(elapsedMilliseconds) ||
    elapsedMilliseconds < 0 ||
    !Number.isFinite(speed) ||
    speed <= 0
  ) {
    return safePosition
  }

  const elapsed = Math.min(elapsedMilliseconds, MAX_FRAME_DURATION)
  const nextPosition = safePosition + (elapsed / 1000) * speed
  return nextPosition >= loopWidth ? nextPosition % loopWidth : nextPosition
}

export function LandingTemplateGrid({ children, pageWidth }: LandingTemplateGridProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const sourceGroupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    const sourceGroup = sourceGroupRef.current
    if (!viewport || !track || !sourceGroup) {
      return
    }

    const cloneGroup = sourceGroup.cloneNode(true) as HTMLDivElement
    cloneGroup.removeAttribute("data-carousel-source")
    cloneGroup.setAttribute("data-carousel-clone", "true")
    cloneGroup.setAttribute("aria-hidden", "true")
    cloneGroup.inert = true
    track.append(cloneGroup)

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frameId = 0
    let resumeTimer = 0
    let loopWidth = 0
    let lastTimestamp = 0
    let hovered = false
    let focused = false
    let interacting = false
    let inView = !("IntersectionObserver" in window)
    let pageVisible = !document.hidden
    let reducedMotion = motionQuery.matches

    const canPlay = () =>
      loopWidth > 0 &&
      inView &&
      pageVisible &&
      !reducedMotion &&
      !hovered &&
      !focused &&
      !interacting

    const stopPlayback = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
        frameId = 0
      }
      lastTimestamp = 0
    }

    const animate = (timestamp: number) => {
      frameId = 0
      if (!canPlay()) {
        lastTimestamp = 0
        return
      }
      const elapsed = lastTimestamp ? timestamp - lastTimestamp : 0
      lastTimestamp = timestamp
      viewport.scrollLeft = calculateCarouselScrollPosition(
        viewport.scrollLeft,
        loopWidth,
        elapsed,
      )
      frameId = window.requestAnimationFrame(animate)
    }

    const syncPlayback = () => {
      viewport.dataset.carouselPaused = String(!canPlay())
      if (!canPlay()) {
        stopPlayback()
        return
      }
      if (!frameId) {
        frameId = window.requestAnimationFrame(animate)
      }
    }

    const updateDimensions = () => {
      const preview = sourceGroup.querySelector<HTMLElement>(".landing-template-sheet")
      if (!preview) {
        return
      }
      viewport.style.setProperty(
        "--landing-template-scale",
        String(preview.clientWidth / pageWidth),
      )
      loopWidth = sourceGroup.scrollWidth
      if (loopWidth > 0 && viewport.scrollLeft >= loopWidth) {
        viewport.scrollLeft %= loopWidth
      }
      viewport.dataset.carouselReady = String(loopWidth > 0)
      syncPlayback()
    }

    const handlePointerEnter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return
      }
      hovered = true
      syncPlayback()
    }
    const handlePointerLeave = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return
      }
      hovered = false
      syncPlayback()
    }
    const handlePointerDown = () => {
      window.clearTimeout(resumeTimer)
      interacting = true
      syncPlayback()
    }
    const handlePointerEnd = () => {
      if (!interacting) {
        return
      }
      window.clearTimeout(resumeTimer)
      resumeTimer = window.setTimeout(() => {
        interacting = false
        syncPlayback()
      }, POINTER_RESUME_DELAY)
    }
    const handleFocusIn = () => {
      focused = true
      syncPlayback()
    }
    const handleFocusOut = (event: FocusEvent) => {
      if (
        event.relatedTarget instanceof Node &&
        viewport.contains(event.relatedTarget)
      ) {
        return
      }
      focused = false
      syncPlayback()
    }
    const handleVisibilityChange = () => {
      pageVisible = !document.hidden
      syncPlayback()
    }
    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches
      syncPlayback()
    }

    const resizeObserver =
      "ResizeObserver" in window ? new ResizeObserver(updateDimensions) : null
    resizeObserver?.observe(viewport)
    resizeObserver?.observe(sourceGroup)

    const intersectionObserver =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) => {
              inView = Boolean(entry?.isIntersecting)
              syncPlayback()
            },
            { threshold: 0.05 },
          )
        : null
    intersectionObserver?.observe(viewport)

    viewport.addEventListener("pointerenter", handlePointerEnter, { passive: true })
    viewport.addEventListener("pointerleave", handlePointerLeave, { passive: true })
    viewport.addEventListener("pointerdown", handlePointerDown, { passive: true })
    window.addEventListener("pointerup", handlePointerEnd, { passive: true })
    window.addEventListener("pointercancel", handlePointerEnd, { passive: true })
    viewport.addEventListener("focusin", handleFocusIn)
    viewport.addEventListener("focusout", handleFocusOut)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    motionQuery.addEventListener("change", handleMotionChange)

    updateDimensions()

    return () => {
      stopPlayback()
      window.clearTimeout(resumeTimer)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      viewport.removeEventListener("pointerenter", handlePointerEnter)
      viewport.removeEventListener("pointerleave", handlePointerLeave)
      viewport.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("pointerup", handlePointerEnd)
      window.removeEventListener("pointercancel", handlePointerEnd)
      viewport.removeEventListener("focusin", handleFocusIn)
      viewport.removeEventListener("focusout", handleFocusOut)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      motionQuery.removeEventListener("change", handleMotionChange)
      cloneGroup.remove()
    }
  }, [pageWidth])

  return (
    <div className="landing-template-grid" ref={viewportRef}>
      <div className="landing-template-track" ref={trackRef}>
        <div
          className="landing-template-group"
          data-carousel-source="true"
          ref={sourceGroupRef}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
