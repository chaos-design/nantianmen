"use client"

import { ArrowLeftIcon, EyeIcon, PrinterIcon } from "lucide-react"
import Link from "next/link"
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { ScrollArea } from "../../components/ui/scroll-area"
import { DraftResumeRouteFallback, useDraftResumeLoader } from "./draft-resume-loader"
import { ResumePageContent, StaticResumeImageLayer } from "./resume-page"
import { paginateResumeDocument } from "./resume-pagination"

interface ResumeDraftPreviewPageProps {
  resumeId: string
  readOnly?: boolean
}

function calculatePreviewScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) {
    return 0.72
  }
  const widthScale = (width - 64) / 794
  const heightScale = (height - 64) / 1123
  return Math.min(1, Math.max(0.3, Math.min(widthScale, heightScale)))
}

export function ResumeDraftPreviewPage({
  resumeId,
  readOnly = false,
}: ResumeDraftPreviewPageProps) {
  const { resume, assetUrls, error } = useDraftResumeLoader(resumeId)
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.72)
  const pages = useMemo(
    () => (resume ? paginateResumeDocument(resume.document) : []),
    [resume],
  )

  useEffect(() => {
    if (!resume || !stageRef.current) {
      return
    }
    const stage = stageRef.current
    const updateScale = () => {
      setScale(calculatePreviewScale(stage.clientWidth, stage.clientHeight))
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [resume])

  if (!resume) {
    return <DraftResumeRouteFallback error={error} />
  }

  function printPreview() {
    window.document.body.dataset.printSource = "draft-preview"
    const cleanup = () => {
      delete window.document.body.dataset.printSource
    }
    window.addEventListener("afterprint", cleanup, { once: true })
    window.print()
  }

  return (
    <main className="resume-draft-preview-shell">
      <header className="resume-preview-toolbar">
        <div>
          <div className="resume-preview-title-row">
            <EyeIcon aria-hidden="true" />
            <h1>{resume.document.metadata.title}</h1>
            <Badge variant="outline">{pages.length} 页</Badge>
          </div>
          <p>当前草稿的只读 A4 全页预览</p>
        </div>
        <div className="resume-preview-actions">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={readOnly ? "/workspace" : `/editor/${resumeId}`}>
              <ArrowLeftIcon data-icon="inline-start" />
              {readOnly ? "返回工作台" : "返回编辑器"}
            </Link>
          </Button>
          <Button type="button" size="sm" onClick={printPreview}>
            <PrinterIcon data-icon="inline-start" />
            打印
          </Button>
        </div>
      </header>

      <ScrollArea ref={stageRef} className="resume-full-preview-stage">
        <div
          className="resume-full-preview-pages"
          style={{ "--full-preview-scale": scale } as CSSProperties}
        >
          {pages.map((page, index) => (
            <article
              className="resume-full-preview-page-wrap"
              aria-label={`第 ${index + 1} 页，共 ${pages.length} 页`}
              key={`draft-preview-page-${index + 1}`}
            >
              <div className="resume-full-preview-page">
                <ResumePageContent page={page} mode="public">
                  <StaticResumeImageLayer
                    document={resume.document}
                    pageIndex={index}
                    pageCount={pages.length}
                    assetUrls={assetUrls}
                  />
                </ResumePageContent>
              </div>
            </article>
          ))}
        </div>
      </ScrollArea>
    </main>
  )
}
