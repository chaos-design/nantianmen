"use client"

import { type ReactNode, useEffect, useState } from "react"

export function WorkspaceHeader({ children }: { children: ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    function updateScrollState() {
      setIsScrolled(window.scrollY > 8)
    }

    updateScrollState()
    window.addEventListener("scroll", updateScrollState, { passive: true })
    return () => window.removeEventListener("scroll", updateScrollState)
  }, [])

  return (
    <header className="workspace-header" data-scrolled={isScrolled}>
      {children}
    </header>
  )
}
