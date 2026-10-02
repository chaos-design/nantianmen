"use client"

import { type RefObject, useLayoutEffect } from "react"
import type {
  WebTemplateId,
  WebTemplateScheme,
} from "../../shared/resume-template/web-template-schemes"
import { calculateFittedNameFontSize } from "./web-resume-content"

interface UseWebResumeLayoutOptions {
  rootRef: RefObject<HTMLDivElement | null>
  navigationRef: RefObject<HTMLElement | null>
  nameHeadingRef: RefObject<HTMLHeadingElement | null>
  displayName: string
  templateId: WebTemplateId
  composition: WebTemplateScheme["composition"]
  activeSectionId: string
}

export function useWebResumeLayout({
  rootRef,
  navigationRef,
  nameHeadingRef,
  displayName,
  templateId,
  composition,
  activeSectionId,
}: UseWebResumeLayoutOptions): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    root.dataset.templateReady = "false"
    root.dataset.templateMotion = templateId
    let readyFrameId: number | null = null
    const prepareFrameId = requestAnimationFrame(() => {
      readyFrameId = requestAnimationFrame(() => {
        root.dataset.templateReady = "true"
      })
    })

    return () => {
      cancelAnimationFrame(prepareFrameId)
      if (readyFrameId !== null) {
        cancelAnimationFrame(readyFrameId)
      }
    }
  }, [rootRef, templateId])

  useLayoutEffect(() => {
    const navigationElement = navigationRef.current
    if (!navigationElement) {
      return
    }

    const usesSharedIndicator = composition === "editorial" || composition === "poster"
    if (!usesSharedIndicator) {
      delete navigationElement.dataset.indicatorReady
      navigationElement.style.removeProperty("--web-nav-indicator-width")
      navigationElement.style.removeProperty("--web-nav-indicator-x")
      return
    }

    let frameId: number | null = null
    const activeLink = navigationElement.querySelector<HTMLElement>(
      `a[href="#${CSS.escape(activeSectionId)}"]`,
    )
    const updateIndicator = () => {
      frameId = null
      if (!activeLink) {
        delete navigationElement.dataset.indicatorReady
        return
      }
      const navigationRect = navigationElement.getBoundingClientRect()
      const activeLinkRect = activeLink.getBoundingClientRect()
      navigationElement.style.setProperty(
        "--web-nav-indicator-x",
        `${activeLinkRect.left - navigationRect.left}px`,
      )
      navigationElement.style.setProperty(
        "--web-nav-indicator-width",
        `${activeLinkRect.width}px`,
      )
      navigationElement.dataset.indicatorReady = "true"
    }
    const scheduleIndicatorUpdate = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
      frameId = requestAnimationFrame(updateIndicator)
    }

    scheduleIndicatorUpdate()
    const ResizeObserverConstructor = (
      window as Window & { ResizeObserver?: typeof ResizeObserver }
    ).ResizeObserver
    if (ResizeObserverConstructor) {
      const resizeObserver = new ResizeObserverConstructor(scheduleIndicatorUpdate)
      resizeObserver.observe(navigationElement)
      if (activeLink) {
        resizeObserver.observe(activeLink)
      }
      return () => {
        resizeObserver.disconnect()
        if (frameId !== null) {
          cancelAnimationFrame(frameId)
        }
      }
    }

    window.addEventListener("resize", scheduleIndicatorUpdate)
    return () => {
      window.removeEventListener("resize", scheduleIndicatorUpdate)
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [activeSectionId, composition, navigationRef])

  useLayoutEffect(() => {
    const heading = nameHeadingRef.current
    const container = heading?.parentElement
    const root = rootRef.current
    if (
      !heading ||
      !container ||
      heading.textContent !== displayName ||
      root?.dataset.webTemplate !== templateId
    ) {
      return
    }

    let frameId: number | null = null
    const fitName = () => {
      heading.style.removeProperty("font-size")
      const preferredFontSize = Number.parseFloat(
        window.getComputedStyle(heading).fontSize,
      )
      const fittedFontSize = calculateFittedNameFontSize(
        preferredFontSize,
        heading.clientWidth,
        heading.scrollWidth,
      )
      if (fittedFontSize !== null && fittedFontSize < preferredFontSize) {
        heading.style.fontSize = `${fittedFontSize.toFixed(3)}px`
      }
    }
    const scheduleFit = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
      frameId = requestAnimationFrame(() => {
        frameId = null
        fitName()
      })
    }

    fitName()
    const ResizeObserverConstructor = (
      window as Window & { ResizeObserver?: typeof ResizeObserver }
    ).ResizeObserver
    if (ResizeObserverConstructor) {
      const resizeObserver = new ResizeObserverConstructor(scheduleFit)
      resizeObserver.observe(container)
      return () => {
        resizeObserver.disconnect()
        if (frameId !== null) {
          cancelAnimationFrame(frameId)
        }
        heading.style.removeProperty("font-size")
      }
    }

    window.addEventListener("resize", scheduleFit)
    return () => {
      window.removeEventListener("resize", scheduleFit)
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
      heading.style.removeProperty("font-size")
    }
  }, [displayName, nameHeadingRef, rootRef, templateId])
}
