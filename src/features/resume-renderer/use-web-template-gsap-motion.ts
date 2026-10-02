"use client"

import { gsap } from "gsap"
import { type RefObject, useLayoutEffect } from "react"
import type { WebTemplateId } from "../../shared/resume-template/web-template-schemes"
import {
  getWebTemplateMotionProfile,
  getWebTemplateScrollMotion,
  type WebTemplateMotionVector,
} from "./web-template-gsap-motion"

interface MotionLayer {
  element: HTMLElement
  introDirection: number
  vector: WebTemplateMotionVector
}

function clearMotionStyles(root: HTMLElement) {
  for (const element of root.querySelectorAll<HTMLElement>(
    "[data-gsap-layer], [data-web-motion-stage], [data-gsap-background]",
  )) {
    for (const property of [
      "background-position",
      "opacity",
      "rotate",
      "scale",
      "transform",
      "transform-origin",
      "translate",
      "visibility",
      "will-change",
    ]) {
      element.style.removeProperty(property)
    }
  }
}

function getMotionLayers(root: HTMLElement, templateId: WebTemplateId): MotionLayer[] {
  const profile = getWebTemplateMotionProfile(templateId)
  const definitions = [
    {
      selector: '[data-gsap-layer="frame"]',
      introDirection: 1,
      vector: profile.frame,
    },
    {
      selector: '[data-gsap-layer="flow"]',
      introDirection: -0.72,
      vector: profile.flow,
    },
    {
      selector: '[data-gsap-layer="points"]',
      introDirection: 0.48,
      vector: profile.points,
    },
  ]

  return definitions.flatMap((definition) => {
    const element = root.querySelector<HTMLElement>(definition.selector)
    return element ? [{ ...definition, element }] : []
  })
}

function getScrollProgress(scrollContainer: HTMLElement) {
  const scrollRange = Math.max(
    0,
    scrollContainer.scrollHeight - scrollContainer.clientHeight,
  )
  if (scrollRange === 0) {
    return 0
  }

  return Math.min(1, scrollContainer.scrollTop / scrollRange)
}

function setupScrollMotion(
  scrollContainer: HTMLElement,
  stage: HTMLElement,
  templateId: WebTemplateId,
  amplitude: number,
) {
  const xTo = gsap.quickTo(stage, "x", {
    duration: 0.72,
    ease: "power3.out",
  })
  const yTo = gsap.quickTo(stage, "y", {
    duration: 0.72,
    ease: "power3.out",
  })
  const rotationTo = gsap.quickTo(stage, "rotation", {
    duration: 0.86,
    ease: "power3.out",
  })
  let frameId: number | null = null

  const update = () => {
    const motion = getWebTemplateScrollMotion(
      templateId,
      getScrollProgress(scrollContainer),
      amplitude,
    )
    xTo(motion.x)
    yTo(motion.y)
    rotationTo(motion.rotation)
  }
  const scheduleUpdate = () => {
    if (frameId !== null) {
      return
    }
    frameId = requestAnimationFrame(() => {
      frameId = null
      update()
    })
  }

  update()
  scrollContainer.addEventListener("scroll", scheduleUpdate, { passive: true })
  window.addEventListener("resize", scheduleUpdate, { passive: true })

  return () => {
    scrollContainer.removeEventListener("scroll", scheduleUpdate)
    window.removeEventListener("resize", scheduleUpdate)
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
    }
    xTo.tween.kill()
    yTo.tween.kill()
    rotationTo.tween.kill()
  }
}

export function useWebTemplateGsapMotion(
  rootRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  templateId: WebTemplateId,
) {
  useLayoutEffect(() => {
    const root = rootRef.current
    const scrollContainer = contentRef.current
    if (!root || !scrollContainer) {
      return
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 760px)")
    let context: ReturnType<typeof gsap.context> | null = null
    let scrollMotionCleanup: (() => void) | null = null
    let visibilityPausedTweens: gsap.core.Tween[] = []

    const clearMotion = () => {
      scrollMotionCleanup?.()
      scrollMotionCleanup = null
      context?.revert()
      context = null
      visibilityPausedTweens = []
      clearMotionStyles(root)
    }

    const syncDocumentVisibility = () => {
      if (!context) {
        return
      }
      if (document.hidden) {
        visibilityPausedTweens = context
          .getTweens()
          .filter((tween: gsap.core.Tween) => !tween.paused())
        for (const tween of visibilityPausedTweens) {
          tween.pause()
        }
        root.dataset.gsapPlayback = "paused"
        return
      }
      for (const tween of visibilityPausedTweens) {
        tween.resume()
      }
      visibilityPausedTweens = []
      root.dataset.gsapPlayback = "running"
    }

    const setupMotion = () => {
      clearMotion()
      const profile = getWebTemplateMotionProfile(templateId)
      root.dataset.gsapFamily = profile.family
      root.dataset.gsapScene = profile.scene

      if (reducedMotionQuery.matches) {
        root.dataset.gsapMotion = "reduced"
        root.dataset.gsapBackground = "static"
        root.dataset.gsapPlayback = "static"
        return
      }

      root.dataset.gsapMotion = "active"
      root.dataset.gsapBackground = "active"
      const amplitude = compactViewportQuery.matches ? 0.52 : 1

      try {
        context = gsap.context(() => {
          const layers = getMotionLayers(root, templateId)
          const stage = root.querySelector<HTMLElement>("[data-web-motion-stage]")
          const background = root.querySelector<HTMLElement>("[data-gsap-background]")
          const intro = gsap.timeline()

          layers.forEach((layer, index) => {
            const direction = layer.introDirection
            intro.fromTo(
              layer.element,
              {
                autoAlpha: 0,
                x: profile.intro.x * direction * amplitude,
                y: profile.intro.y * (1 + index * 0.12) * amplitude,
                rotation: profile.intro.rotation * direction * amplitude,
                scale: 1 - (1 - profile.intro.scale) * amplitude,
                transformOrigin: "50% 50%",
                force3D: true,
              },
              {
                autoAlpha: 1,
                x: 0,
                y: 0,
                rotation: 0,
                scale: 1,
                duration: profile.intro.duration,
                ease: profile.ease,
                force3D: true,
              },
              index * profile.intro.stagger,
            )
          })

          layers.forEach((layer, index) => {
            gsap.to(layer.element, {
              x: layer.vector.x * amplitude,
              y: layer.vector.y * amplitude,
              rotation: layer.vector.rotation * amplitude,
              scale: 1 + (layer.vector.scale - 1) * amplitude,
              duration: layer.vector.duration,
              delay: profile.intro.duration + index * profile.intro.stagger + 0.1,
              ease: "sine.inOut",
              repeat: -1,
              yoyo: true,
              force3D: true,
            })
          })

          if (stage) {
            scrollMotionCleanup = setupScrollMotion(
              scrollContainer,
              stage,
              templateId,
              amplitude,
            )
          }

          if (templateId === "mono-brutalist" && background) {
            gsap.fromTo(
              background,
              { backgroundPosition: "0px 0px" },
              {
                backgroundPosition: "40px 40px",
                duration: 7.2,
                ease: "none",
                repeat: -1,
              },
            )
          }
        }, root)
        syncDocumentVisibility()
      } catch {
        clearMotion()
        root.dataset.gsapMotion = "fallback"
        root.dataset.gsapBackground = "static"
        root.dataset.gsapPlayback = "static"
      }
    }

    setupMotion()
    reducedMotionQuery.addEventListener("change", setupMotion)
    compactViewportQuery.addEventListener("change", setupMotion)
    document.addEventListener("visibilitychange", syncDocumentVisibility)

    return () => {
      reducedMotionQuery.removeEventListener("change", setupMotion)
      compactViewportQuery.removeEventListener("change", setupMotion)
      document.removeEventListener("visibilitychange", syncDocumentVisibility)
      clearMotion()
      delete root.dataset.gsapFamily
      delete root.dataset.gsapBackground
      delete root.dataset.gsapMotion
      delete root.dataset.gsapPlayback
      delete root.dataset.gsapScene
    }
  }, [contentRef, rootRef, templateId])
}
