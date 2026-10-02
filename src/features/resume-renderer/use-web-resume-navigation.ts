"use client"

import {
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import type { WebTemplateId } from "../../shared/resume-template/web-template-schemes"

interface WebResumeNavigationItem {
  id: string
  label: string
}

interface UseWebResumeNavigationOptions {
  rootRef: RefObject<HTMLDivElement | null>
  contentRef: RefObject<HTMLDivElement | null>
  contained: boolean
  navigation: readonly WebResumeNavigationItem[]
  templateId: WebTemplateId
}

export function useWebResumeNavigation({
  rootRef,
  contentRef,
  contained,
  navigation,
  templateId,
}: UseWebResumeNavigationOptions) {
  const navigationRef = useRef<HTMLElement>(null)
  const navigationTargetRef = useRef<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useState(navigation[0]?.id ?? "")

  useEffect(() => {
    const root = rootRef.current
    const scrollContainer = contentRef.current
    if (!root || !scrollContainer || root.dataset.webTemplate !== templateId) {
      return
    }
    const revealElements = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]"),
    )
    const sectionElements = navigation
      .map(({ id }) => root.querySelector<HTMLElement>(`#${CSS.escape(id)}`))
      .filter((element) => element !== null)

    navigationTargetRef.current = null
    delete root.dataset.navigationTarget
    root.dataset.enhanced = "true"
    const updateScrollState = () => {
      const scrollTop = scrollContainer.scrollTop
      const scrollHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight
      const progress = scrollHeight > 0 ? Math.min(1, scrollTop / scrollHeight) : 0
      root.style.setProperty("--web-scroll-progress", String(progress))

      const containerTop = scrollContainer.getBoundingClientRect().top
      const viewportHeight = scrollContainer.clientHeight
      root.style.setProperty("--web-motion-viewport-height", `${viewportHeight}px`)
      const navigationTargetId = navigationTargetRef.current
      if (navigationTargetId) {
        setActiveSectionId((currentId) =>
          currentId === navigationTargetId ? currentId : navigationTargetId,
        )
        return
      }
      const activationLine = containerTop + viewportHeight * 0.22
      let currentSectionId = sectionElements[0]?.id ?? ""
      for (const section of sectionElements) {
        if (section.getBoundingClientRect().top > activationLine) {
          break
        }
        currentSectionId = section.id
      }
      if (currentSectionId) {
        setActiveSectionId(currentSectionId)
      }
    }

    let revealObserver: IntersectionObserver | null = null
    if ("IntersectionObserver" in window) {
      for (const element of revealElements) {
        element.dataset.visible = "false"
      }
      revealObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const target = entry.target as HTMLElement
              target.dataset.visible = "true"
              revealObserver?.unobserve(entry.target)
            }
          }
        },
        { root: scrollContainer, threshold: 0.14 },
      )
      for (const element of revealElements) {
        revealObserver.observe(element)
      }
    } else {
      for (const element of revealElements) {
        element.dataset.visible = "true"
      }
    }

    let scrollFrameId: number | null = null
    let navigationReleaseTimeoutId: number | null = null
    const releaseNavigationTarget = () => {
      if (navigationReleaseTimeoutId !== null) {
        window.clearTimeout(navigationReleaseTimeoutId)
        navigationReleaseTimeoutId = null
      }
      if (!navigationTargetRef.current) {
        return
      }
      navigationTargetRef.current = null
      delete root.dataset.navigationTarget
      updateScrollState()
    }
    const scheduleNavigationTargetRelease = () => {
      if (navigationReleaseTimeoutId !== null) {
        window.clearTimeout(navigationReleaseTimeoutId)
      }
      navigationReleaseTimeoutId = window.setTimeout(releaseNavigationTarget, 160)
    }
    const scheduleScrollState = () => {
      if (navigationTargetRef.current) {
        scheduleNavigationTargetRelease()
      }
      if (scrollFrameId !== null) {
        return
      }
      scrollFrameId = requestAnimationFrame(() => {
        scrollFrameId = null
        updateScrollState()
      })
    }

    updateScrollState()
    scrollContainer.addEventListener("scroll", scheduleScrollState, {
      passive: true,
    })
    scrollContainer.addEventListener("scrollend", releaseNavigationTarget)
    window.addEventListener("resize", scheduleScrollState, { passive: true })
    return () => {
      scrollContainer.removeEventListener("scroll", scheduleScrollState)
      scrollContainer.removeEventListener("scrollend", releaseNavigationTarget)
      window.removeEventListener("resize", scheduleScrollState)
      if (scrollFrameId !== null) {
        cancelAnimationFrame(scrollFrameId)
      }
      if (navigationReleaseTimeoutId !== null) {
        window.clearTimeout(navigationReleaseTimeoutId)
      }
      navigationTargetRef.current = null
      delete root.dataset.navigationTarget
      revealObserver?.disconnect()
    }
  }, [contentRef, navigation, rootRef, templateId])

  const handleNavigationClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>, targetId: string) => {
      const root = rootRef.current
      const scrollContainer = contentRef.current
      const target = root?.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`)
      if (!root || !scrollContainer || !target) {
        return
      }

      event.preventDefault()
      if (activeSectionId !== targetId) {
        navigationTargetRef.current = targetId
        root.dataset.navigationTarget = targetId
      }
      setActiveSectionId(targetId)
      target.focus({ preventScroll: true })

      const rootStyle = window.getComputedStyle(root)
      const reducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const behavior: ScrollBehavior =
        reducedMotion || rootStyle.scrollBehavior === "auto" ? "auto" : "smooth"

      const containerRect = scrollContainer.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      scrollContainer.scrollTo({
        top: scrollContainer.scrollTop + targetRect.top - containerRect.top,
        behavior,
      })
      if (!contained) {
        window.history.replaceState(null, "", `#${targetId}`)
      }
    },
    [activeSectionId, contained, contentRef, rootRef],
  )

  return {
    navigationRef,
    activeSectionId,
    handleNavigationClick,
  }
}
