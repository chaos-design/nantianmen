"use client"

import Link from "next/link"
import type { PointerEvent, MouseEvent as ReactMouseEvent } from "react"

const landingNavLinks = [
  { href: "#capabilities", label: "特色" },
  { href: "#templates", label: "模板" },
  { href: "#workflow", label: "使用方式" },
] as const

type LandingNavLineSide = "left" | "right"

export function resolveLandingNavLineSide(
  clientX: number,
  elementLeft: number,
  elementWidth: number,
): LandingNavLineSide {
  return clientX - elementLeft < elementWidth / 2 ? "left" : "right"
}

function readPointerSide(element: HTMLElement, clientX: number): LandingNavLineSide {
  const rect = element.getBoundingClientRect()
  return resolveLandingNavLineSide(clientX, rect.left, rect.width)
}

function handlePointerDirection(event: PointerEvent<HTMLAnchorElement>) {
  event.currentTarget.dataset.lineSide = readPointerSide(
    event.currentTarget,
    event.clientX,
  )
}

function scrollToHashTarget(event: ReactMouseEvent<HTMLAnchorElement>, href: string) {
  const targetId = href.startsWith("#") ? href.slice(1) : ""
  const target = targetId ? document.getElementById(targetId) : null
  if (!target) {
    return
  }

  event.preventDefault()
  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  target.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "start",
  })
  window.history.replaceState(null, "", href)
}

export function LandingNavLinks() {
  return (
    <div className="landing-nav-links">
      {landingNavLinks.map((item) => (
        <Link
          href={item.href}
          data-line-side="left"
          key={item.href}
          onClick={(event) => scrollToHashTarget(event, item.href)}
          onPointerEnter={handlePointerDirection}
          onPointerLeave={handlePointerDirection}
        >
          {item.label}
        </Link>
      ))}
    </div>
  )
}
