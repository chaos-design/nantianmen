"use client"

import {
  ArrowLeftIcon,
  CheckIcon,
  Maximize2Icon,
  Minimize2Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  Share2Icon,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { copyTextToClipboard } from "../../lib/clipboard"
import {
  defaultWebTemplateId,
  getWebTemplateScheme,
  type WebTemplateComposition,
  type WebTemplateId,
  webTemplateSchemes,
} from "../../shared/resume-template/web-template-schemes"
import { DraftResumeRouteFallback, useDraftResumeLoader } from "./draft-resume-loader"
import { ResumeWebPage } from "./resume-web-page"
import { WebTemplateThumbnail } from "./web-template-thumbnail"

interface ResumeWebBuilderPageProps {
  resumeId: string
  readOnly?: boolean
}

const templateSidebarCollapsedStorageKey =
  "resume-web-builder:template-sidebar-collapsed"
const webTemplateExitDurationMs = 180
const webTemplateCompositionLabels: Record<WebTemplateComposition, string> = {
  archive: "档案结构",
  editorial: "编辑布局",
  grid: "网格布局",
  mosaic: "拼贴结构",
  poster: "海报布局",
  studio: "影棚布局",
}

type WebTemplateTransitionState = "idle" | "exiting"

export function canShareWebPreview(readOnly: boolean, published: boolean): boolean {
  return !readOnly && published
}

export function getWebPreviewShareMessage(
  readOnly: boolean,
  published: boolean,
): string {
  if (readOnly) {
    return "Preview 只读模式不支持生成分享链接"
  }
  return published ? "分享内容来自最近发布版本" : "请先返回编辑器发布后再分享"
}

function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readTemplateSidebarCollapsed(
  storage: Pick<Storage, "getItem"> | null,
): boolean {
  if (!storage) {
    return false
  }
  try {
    return storage.getItem(templateSidebarCollapsedStorageKey) === "true"
  } catch {
    return false
  }
}

export function persistTemplateSidebarCollapsed(
  storage: Pick<Storage, "setItem"> | null,
  collapsed: boolean,
): boolean {
  if (!storage) {
    return false
  }
  try {
    storage.setItem(templateSidebarCollapsedStorageKey, String(collapsed))
    return true
  } catch {
    return false
  }
}

export function ResumeWebBuilderPage({
  resumeId,
  readOnly = false,
}: ResumeWebBuilderPageProps) {
  const { resume, error } = useDraftResumeLoader(resumeId, false)
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<WebTemplateId>(defaultWebTemplateId)
  const [renderedTemplateId, setRenderedTemplateId] =
    useState<WebTemplateId>(defaultWebTemplateId)
  const [templateTransitionState, setTemplateTransitionState] =
    useState<WebTemplateTransitionState>("idle")
  const [templateSidebarCollapsed, setTemplateSidebarCollapsed] = useState(false)
  const [previewMaximized, setPreviewMaximized] = useState(false)
  const maximizeButtonRef = useRef<HTMLButtonElement>(null)
  const exitMaximizeButtonRef = useRef<HTMLButtonElement>(null)
  const pendingTemplateIdRef = useRef<WebTemplateId | null>(null)
  const templateSwitchTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setTemplateSidebarCollapsed(readTemplateSidebarCollapsed(getBrowserStorage()))
  }, [])

  useEffect(() => {
    if (!previewMaximized) {
      return
    }
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const focusFrame = requestAnimationFrame(() => {
      exitMaximizeButtonRef.current?.focus()
    })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return
      }
      setPreviewMaximized(false)
      requestAnimationFrame(() => {
        maximizeButtonRef.current?.focus()
      })
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousBodyOverflow
    }
  }, [previewMaximized])

  useEffect(() => {
    return () => {
      if (templateSwitchTimerRef.current !== null) {
        window.clearTimeout(templateSwitchTimerRef.current)
      }
    }
  }, [])

  if (!resume) {
    return <DraftResumeRouteFallback error={error} />
  }

  const loadedResume = resume
  const selectedScheme = getWebTemplateScheme(selectedTemplateId)
  const shareEnabled = canShareWebPreview(readOnly, loadedResume.published)
  const shareMessage = getWebPreviewShareMessage(readOnly, loadedResume.published)

  function clearTemplateSwitchTimer() {
    if (templateSwitchTimerRef.current === null) {
      return
    }
    window.clearTimeout(templateSwitchTimerRef.current)
    templateSwitchTimerRef.current = null
  }

  function selectTemplate(nextTemplateId: WebTemplateId) {
    setSelectedTemplateId(nextTemplateId)
    if (nextTemplateId === renderedTemplateId) {
      pendingTemplateIdRef.current = null
      clearTemplateSwitchTimer()
      setTemplateTransitionState("idle")
      return
    }

    pendingTemplateIdRef.current = nextTemplateId
    clearTemplateSwitchTimer()
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reducedMotion) {
      setRenderedTemplateId(nextTemplateId)
      setTemplateTransitionState("idle")
      pendingTemplateIdRef.current = null
      return
    }

    setTemplateTransitionState("exiting")
    templateSwitchTimerRef.current = window.setTimeout(() => {
      const pendingTemplateId = pendingTemplateIdRef.current
      if (pendingTemplateId) {
        setRenderedTemplateId(pendingTemplateId)
      }
      pendingTemplateIdRef.current = null
      templateSwitchTimerRef.current = null
      setTemplateTransitionState("idle")
    }, webTemplateExitDurationMs)
  }

  function handleShare() {
    if (!shareEnabled) {
      return
    }
    const shareUrl = `${window.location.origin}/r/${loadedResume.publicSlug}/web?template=${encodeURIComponent(selectedTemplateId)}`
    void copyTextToClipboard(shareUrl).then((copied) => {
      if (copied) {
        toast.success("分享链接已复制")
      }
    })
  }

  return (
    <main
      className="resume-web-builder-shell"
      data-preview-maximized={previewMaximized}
      data-template-collapsed={templateSidebarCollapsed}
    >
      <header className="resume-web-builder-toolbar">
        <div>
          <p>WEB RESUME BUILDER</p>
          <h1>Web 简历生成器</h1>
          <span>
            当前模板：{selectedScheme.name} · {selectedScheme.category}
          </span>
        </div>
        <div className="resume-web-builder-actions">
          <div className="web-template-share-state">
            <Badge variant={resume.published ? "secondary" : "outline"}>
              {resume.published ? "已发布" : "未发布"}
            </Badge>
            <span>{shareMessage}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!shareEnabled}
            onClick={() => void handleShare()}
          >
            <Share2Icon data-icon="inline-start" />
            分享当前效果
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={templateSidebarCollapsed ? "展开模板栏" : "收起模板栏"}
            aria-pressed={templateSidebarCollapsed}
            onClick={() => {
              const nextCollapsed = !templateSidebarCollapsed
              setTemplateSidebarCollapsed(nextCollapsed)
              persistTemplateSidebarCollapsed(getBrowserStorage(), nextCollapsed)
            }}
          >
            {templateSidebarCollapsed ? (
              <PanelLeftOpenIcon data-icon="inline-start" />
            ) : (
              <PanelLeftCloseIcon data-icon="inline-start" />
            )}
            {templateSidebarCollapsed ? "展开模板" : "收起模板"}
          </Button>
          <Button
            ref={maximizeButtonRef}
            type="button"
            variant="outline"
            size="sm"
            aria-label="最大化预览 Web 简历"
            onClick={() => setPreviewMaximized(true)}
          >
            <Maximize2Icon data-icon="inline-start" />
            最大化预览
          </Button>
          <Button type="button" size="sm" asChild>
            <Link href={readOnly ? "/workspace" : `/editor/${resumeId}`}>
              <ArrowLeftIcon data-icon="inline-start" />
              {readOnly ? "返回工作台" : "返回编辑器"}
            </Link>
          </Button>
        </div>
      </header>

      <div className="resume-web-builder-workspace">
        <aside
          className="web-template-sidebar"
          aria-hidden={templateSidebarCollapsed || previewMaximized}
          inert={templateSidebarCollapsed || previewMaximized}
        >
          <div className="web-template-sidebar-heading">
            <span>{String(webTemplateSchemes.length).padStart(2, "0")} templates</span>
            <h2>选择 Web 模板</h2>
            <p>切换模板只改变当前 Web 简历效果。</p>
            <div className="web-template-sidebar-current">
              <i
                aria-hidden="true"
                style={{ background: selectedScheme.colors.accent }}
              />
              <span>
                <strong>{selectedScheme.name}</strong>
                <small>
                  {webTemplateCompositionLabels[selectedScheme.composition]} ·{" "}
                  {selectedScheme.tone === "dark" ? "深色" : "浅色"}
                </small>
              </span>
            </div>
          </div>
          <div className="web-template-options" role="radiogroup" aria-label="Web 模板">
            {webTemplateSchemes.map((scheme) => {
              const selected = scheme.id === selectedTemplateId
              return (
                <label
                  className="web-template-option"
                  data-selected={selected}
                  key={scheme.id}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="web-template"
                    value={scheme.id}
                    checked={selected}
                    disabled={templateTransitionState === "exiting"}
                    onChange={() => selectTemplate(scheme.id)}
                  />
                  <WebTemplateThumbnail scheme={scheme} />
                  <span>
                    <strong>{scheme.name}</strong>
                    <small>{scheme.category}</small>
                    <em>{scheme.description}</em>
                  </span>
                  {selected ? <CheckIcon aria-hidden="true" /> : null}
                </label>
              )
            })}
          </div>
        </aside>

        <section
          className="resume-web-builder-preview"
          aria-label="Web 简历实时预览"
          data-template-transition={templateTransitionState}
        >
          {previewMaximized ? (
            <Button
              ref={exitMaximizeButtonRef}
              className="web-preview-maximize-exit"
              type="button"
              variant="secondary"
              size="sm"
              aria-label="退出最大化预览"
              onClick={() => {
                setPreviewMaximized(false)
                requestAnimationFrame(() => {
                  maximizeButtonRef.current?.focus()
                })
              }}
            >
              <Minimize2Icon data-icon="inline-start" />
              退出最大化
            </Button>
          ) : null}
          <ResumeWebPage
            document={resume.document}
            templateId={renderedTemplateId}
            contained
          />
        </section>
      </div>
    </main>
  )
}
