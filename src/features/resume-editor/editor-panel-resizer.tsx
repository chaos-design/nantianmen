"use client"

import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from "react"

export const DEFAULT_LEFT_PANEL_WIDTH = 360
export const MIN_LEFT_PANEL_WIDTH = 300
export const MAX_LEFT_PANEL_RATIO = 0.4
export const LEFT_PANEL_KEYBOARD_STEP = 16

export function getMaximumLeftPanelWidth(viewportWidth: number): number {
  return Math.max(
    MIN_LEFT_PANEL_WIDTH,
    Math.floor(viewportWidth * MAX_LEFT_PANEL_RATIO),
  )
}

export function clampLeftPanelWidth(width: number, viewportWidth: number): number {
  return Math.min(
    getMaximumLeftPanelWidth(viewportWidth),
    Math.max(MIN_LEFT_PANEL_WIDTH, Math.round(width)),
  )
}

interface EditorPanelResizerProps {
  width: number
  viewportWidth: number
  onResize: (width: number) => void
}

interface DragState {
  pointerId: number
  startClientX: number
  startWidth: number
}

export function EditorPanelResizer({
  width,
  viewportWidth,
  onResize,
}: EditorPanelResizerProps) {
  const dragStateRef = useRef<DragState | null>(null)
  const removeDragListenersRef = useRef<(() => void) | null>(null)
  const maximum = getMaximumLeftPanelWidth(viewportWidth)

  useEffect(
    () => () => {
      removeDragListenersRef.current?.()
    },
    [],
  )

  function handlePointerDown(event: ReactPointerEvent<HTMLHRElement>) {
    event.preventDefault()
    removeDragListenersRef.current?.()
    const dragState: DragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startWidth: width,
    }
    dragStateRef.current = dragState

    const removeListeners = () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", finishPointerDrag)
      window.removeEventListener("pointercancel", finishPointerDrag)
      dragStateRef.current = null
      removeDragListenersRef.current = null
    }

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== dragState.pointerId) {
        return
      }
      onResize(
        clampLeftPanelWidth(
          dragState.startWidth + pointerEvent.clientX - dragState.startClientX,
          viewportWidth,
        ),
      )
    }

    const finishPointerDrag = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === dragState.pointerId) {
        removeListeners()
      }
    }

    removeDragListenersRef.current = removeListeners
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", finishPointerDrag)
    window.addEventListener("pointercancel", finishPointerDrag)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLHRElement>) {
    let nextWidth: number | null = null
    if (event.key === "ArrowLeft") {
      nextWidth = width - LEFT_PANEL_KEYBOARD_STEP
    } else if (event.key === "ArrowRight") {
      nextWidth = width + LEFT_PANEL_KEYBOARD_STEP
    } else if (event.key === "Home") {
      nextWidth = MIN_LEFT_PANEL_WIDTH
    } else if (event.key === "End") {
      nextWidth = maximum
    }
    if (nextWidth !== null) {
      event.preventDefault()
      onResize(clampLeftPanelWidth(nextWidth, viewportWidth))
    }
  }

  return (
    <hr
      className="editor-panel-resizer"
      tabIndex={0}
      aria-label="调整表单编辑区域宽度"
      aria-orientation="vertical"
      aria-valuemin={MIN_LEFT_PANEL_WIDTH}
      aria-valuemax={maximum}
      aria-valuenow={width}
      onDoubleClick={() => onResize(DEFAULT_LEFT_PANEL_WIDTH)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
    />
  )
}
