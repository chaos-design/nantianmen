"use client"

import { ScanIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react"
import type { CSSProperties, ReactElement } from "react"
import { Button } from "../../components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"

interface PreviewZoomControlsProps {
  zoom: number
  minimum: number
  maximum: number
  fitActive: boolean
  onZoomOut: () => void
  onZoomIn: () => void
  onZoomChange: (zoom: number) => void
  onFit: () => void
}

interface PreviewZoomTooltipProps {
  label: string
  children: ReactElement
}

function PreviewZoomTooltip({ label, children }: PreviewZoomTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        className="preview-zoom-tooltip"
        hideArrow
        side="top"
        sideOffset={8}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function PreviewZoomControls({
  zoom,
  minimum,
  maximum,
  fitActive,
  onZoomOut,
  onZoomIn,
  onZoomChange,
  onFit,
}: PreviewZoomControlsProps) {
  const zoomProgress =
    maximum > minimum ? ((zoom - minimum) / (maximum - minimum)) * 100 : 0

  return (
    <fieldset
      className="preview-zoom-controls"
      style={
        {
          "--preview-zoom-progress": `${Math.min(100, Math.max(0, zoomProgress))}%`,
        } as CSSProperties
      }
    >
      <legend className="sr-only">预览缩放控制</legend>
      <PreviewZoomTooltip label="缩小预览">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="缩小预览"
          disabled={zoom <= minimum}
          onClick={onZoomOut}
        >
          <ZoomOutIcon />
        </Button>
      </PreviewZoomTooltip>
      <PreviewZoomTooltip label={`当前缩放 ${Math.round(zoom)}%`}>
        <output className="preview-zoom-value" aria-live="polite">
          {Math.round(zoom)}%
        </output>
      </PreviewZoomTooltip>
      <PreviewZoomTooltip label="拖动调整缩放，Ctrl / Command + 滚轮可连续缩放">
        <input
          className="preview-zoom-range"
          type="range"
          min={minimum}
          max={maximum}
          step={1}
          value={zoom}
          aria-label="预览缩放"
          aria-valuetext={`${Math.round(zoom)}%`}
          onChange={(event) => onZoomChange(Number(event.target.value))}
        />
      </PreviewZoomTooltip>
      <PreviewZoomTooltip label="放大预览">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="放大预览"
          disabled={zoom >= maximum}
          onClick={onZoomIn}
        >
          <ZoomInIcon />
        </Button>
      </PreviewZoomTooltip>
      <PreviewZoomTooltip label="自适应预览">
        <Button
          className="preview-zoom-fit-button"
          type="button"
          variant={fitActive ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="快速自适应预览"
          aria-pressed={fitActive}
          onClick={onFit}
        >
          <ScanIcon />
        </Button>
      </PreviewZoomTooltip>
    </fieldset>
  )
}
