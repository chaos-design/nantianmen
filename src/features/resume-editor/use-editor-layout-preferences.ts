"use client"

import { useEffect, useState } from "react"
import {
  clampLeftPanelWidth,
  DEFAULT_LEFT_PANEL_WIDTH,
  getMaximumLeftPanelWidth,
} from "./editor-panel-resizer"

const leftPanelWidthStorageKey = "resume-editor:left-panel-width"
const contentPanelCollapsedStorageKey = "resume-editor:content-panel-collapsed"
const inspectorCollapsedStorageKey = "resume-editor:inspector-collapsed"
const styleInspectorWidth = 340

function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // The editor remains usable when browser storage is unavailable.
  }
}

export function useEditorLayoutPreferences({
  contentPanelMaximized = false,
  inspectorTemporarilyCollapsed = false,
}: {
  contentPanelMaximized?: boolean
  inspectorTemporarilyCollapsed?: boolean
} = {}) {
  const [viewportWidth, setViewportWidth] = useState(1440)
  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_PANEL_WIDTH)
  const [contentPanelCollapsed, setContentPanelCollapsed] = useState(false)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
  const [preferencesReady, setPreferencesReady] = useState(false)

  useEffect(() => {
    const updateViewportWidth = () => {
      const nextViewportWidth = window.innerWidth
      setViewportWidth(nextViewportWidth)
      setLeftPanelWidth((current) => clampLeftPanelWidth(current, nextViewportWidth))
    }
    const savedWidth = Number(readPreference(leftPanelWidthStorageKey))
    setViewportWidth(window.innerWidth)
    setLeftPanelWidth(
      clampLeftPanelWidth(
        Number.isFinite(savedWidth) && savedWidth > 0
          ? savedWidth
          : DEFAULT_LEFT_PANEL_WIDTH,
        window.innerWidth,
      ),
    )
    setContentPanelCollapsed(readPreference(contentPanelCollapsedStorageKey) === "true")
    setInspectorCollapsed(readPreference(inspectorCollapsedStorageKey) === "true")
    setPreferencesReady(true)
    window.addEventListener("resize", updateViewportWidth)
    return () => window.removeEventListener("resize", updateViewportWidth)
  }, [])

  useEffect(() => {
    if (preferencesReady) {
      writePreference(leftPanelWidthStorageKey, String(leftPanelWidth))
    }
  }, [leftPanelWidth, preferencesReady])

  useEffect(() => {
    if (preferencesReady) {
      writePreference(contentPanelCollapsedStorageKey, String(contentPanelCollapsed))
    }
  }, [contentPanelCollapsed, preferencesReady])

  useEffect(() => {
    if (preferencesReady) {
      writePreference(inspectorCollapsedStorageKey, String(inspectorCollapsed))
    }
  }, [inspectorCollapsed, preferencesReady])

  const renderedLeftPanelWidth = contentPanelMaximized
    ? getMaximumLeftPanelWidth(viewportWidth)
    : leftPanelWidth
  const effectiveLeftPanelWidth = contentPanelCollapsed ? 0 : renderedLeftPanelWidth
  const effectiveInspectorCollapsed =
    inspectorCollapsed || inspectorTemporarilyCollapsed
  const editorSideCoverage =
    effectiveLeftPanelWidth + (effectiveInspectorCollapsed ? 0 : styleInspectorWidth)

  return {
    viewportWidth,
    leftPanelWidth,
    renderedLeftPanelWidth,
    setLeftPanelWidth,
    contentPanelCollapsed,
    setContentPanelCollapsed,
    inspectorCollapsed,
    effectiveInspectorCollapsed,
    setInspectorCollapsed,
    effectiveLeftPanelWidth,
    editorSideCoverage,
  }
}
