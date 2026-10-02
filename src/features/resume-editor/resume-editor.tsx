"use client"

import {
  BracesIcon,
  CheckIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileJsonIcon,
  HistoryIcon,
  Maximize2Icon,
  MoreHorizontalIcon,
  PanelLeftOpenIcon,
  PrinterIcon,
  Redo2Icon,
  RocketIcon,
  RotateCcwIcon,
  SaveIcon,
  Undo2Icon,
  UploadIcon,
} from "lucide-react"
import Link from "next/link"
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/empty"
import { Input } from "../../components/ui/input"
import { ScrollArea } from "../../components/ui/scroll-area"
import { Skeleton } from "../../components/ui/skeleton"
import { Spinner } from "../../components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import type { EditableResume } from "../../server/domain/resume-service"
import type { ResumeLinkTarget } from "../../shared/resume-schema/resume-link-target"
import {
  createResumeSection,
  parseResumeDocument,
  type ResumeDocument,
  type ResumeSectionType,
} from "../../shared/resume-schema/resume-schema"
import { writeDraftPreviewSnapshot } from "../resume-renderer/draft-preview-session"
import {
  A4Preview,
  MAX_PREVIEW_ZOOM,
  MIN_PREVIEW_ZOOM,
  PREVIEW_ZOOM_STEP,
  paginateResumeDocument,
} from "./a4-preview"
import { AiAssistant } from "./ai-assistant"
import { applyAiSuggestion } from "./apply-ai-suggestion"
import { ContentEditorPanel, type ContentEditorTab } from "./content-editor-panel"
import { listResumeAssets, loadResume, publishResume, saveResume } from "./editor-api"
import { type EditorFocusRequest, locateSuggestionTarget } from "./editor-focus-request"
import { EditorPanelResizer } from "./editor-panel-resizer"
import { PreviewZoomControls } from "./preview-zoom-controls"
import { ResumeHistory } from "./resume-history"
import { StyleInspector } from "./style-inspector"
import { useEditorLayoutPreferences } from "./use-editor-layout-preferences"
import { usePreviewZoom } from "./use-preview-zoom"
import { usePrivateAssetUrls } from "./use-private-asset-urls"

interface ResumeEditorProps {
  resumeId: string
  aiStorageOwnerId: string
}

type SaveStatus = "saved" | "unsaved" | "saving" | "error"

function downloadJson(document: ResumeDocument) {
  const blob = new Blob([JSON.stringify(document, null, 2)], {
    type: "application/json",
  })
  const href = URL.createObjectURL(blob)
  const anchor = window.document.createElement("a")
  anchor.href = href
  anchor.download = `${document.metadata.title || "resume"}.json`
  anchor.click()
  URL.revokeObjectURL(href)
}

function LoadingEditor() {
  return (
    <div className="editor-loading">
      <Skeleton className="h-14 w-full" />
      <div className="editor-loading-grid">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    </div>
  )
}

export function ResumeEditor({ resumeId, aiStorageOwnerId }: ResumeEditorProps) {
  const [resume, setResume] = useState<EditableResume | null>(null)
  const [document, setDocument] = useState<ResumeDocument | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState("profile")
  const [selectedPageIndex, setSelectedPageIndex] = useState(0)
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const [loadError, setLoadError] = useState("")
  const [contentEditorTab, setContentEditorTab] = useState<ContentEditorTab>("form")
  const [jsonDraft, setJsonDraft] = useState("")
  const [jsonError, setJsonError] = useState("")
  const [jsonLinkedTarget, setJsonLinkedTarget] = useState<ResumeLinkTarget | null>(
    null,
  )
  const [editorFocusRequest, setEditorFocusRequest] =
    useState<EditorFocusRequest | null>(null)
  const [pendingAiSuggestionItemIds, setPendingAiSuggestionItemIds] = useState<
    string[]
  >([])
  const [jsonPanelMaximized, setJsonPanelMaximized] = useState(false)
  const [shareUrl, setShareUrl] = useState("")
  const [isPublishing, setIsPublishing] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewPanelRef = useRef<HTMLElement>(null)
  const versionRef = useRef(1)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const lastSavedSerializedRef = useRef("")
  const documentRef = useRef<ResumeDocument | null>(null)
  const historyRef = useRef<ResumeHistory<ResumeDocument> | null>(null)
  const editorFocusSequenceRef = useRef(0)
  if (!historyRef.current) {
    historyRef.current = new ResumeHistory()
  }
  const history = historyRef.current
  const {
    viewportWidth,
    renderedLeftPanelWidth,
    setLeftPanelWidth,
    contentPanelCollapsed,
    setContentPanelCollapsed,
    effectiveInspectorCollapsed,
    setInspectorCollapsed,
    effectiveLeftPanelWidth,
    editorSideCoverage,
  } = useEditorLayoutPreferences({
    contentPanelMaximized: jsonPanelMaximized,
    inspectorTemporarilyCollapsed: jsonPanelMaximized,
  })
  const editorReady = Boolean(document)
  const assetUrls = usePrivateAssetUrls(resumeId, document?.resources.assets ?? [])
  const pageCount = document ? paginateResumeDocument(document).length : 1
  const getPreviewFitWidth = useCallback(() => {
    const panelWidth = previewPanelRef.current?.clientWidth ?? 0
    return Math.max(0, panelWidth - editorSideCoverage)
  }, [editorSideCoverage])
  const {
    previewZoom,
    fitPreview,
    zoomBy,
    setManualZoom,
    fit: fitPreviewToPanel,
  } = usePreviewZoom({
    panelRef: previewPanelRef,
    enabled: editorReady,
    getFitWidth: getPreviewFitWidth,
  })

  useEffect(() => {
    if (!editorFocusRequest) {
      return
    }
    const requestId = editorFocusRequest.id
    const timeout = window.setTimeout(() => {
      setEditorFocusRequest((current) => (current?.id === requestId ? null : current))
    }, 1600)
    return () => window.clearTimeout(timeout)
  }, [editorFocusRequest])

  /** 统一定位入口：应用与仅定位都走这里，保证跳转和展开行为一致。 */
  const focusEditorTarget = useCallback(
    (target: Omit<EditorFocusRequest, "id">) => {
      setContentEditorTab("form")
      setContentPanelCollapsed(false)
      setSelectedSectionId(target.sectionId)
      editorFocusSequenceRef.current += 1
      setEditorFocusRequest({
        ...target,
        id: editorFocusSequenceRef.current,
      })
    },
    [setContentPanelCollapsed],
  )

  useEffect(() => {
    void loadResume(resumeId)
      .then(async (loadedResume) => {
        const storedAssets = await listResumeAssets(resumeId).catch(
          () => loadedResume.document.resources.assets,
        )
        const existingAssetIds = new Set(
          loadedResume.document.resources.assets.map((asset) => asset.id),
        )
        const mergedDocument: ResumeDocument = {
          ...loadedResume.document,
          resources: {
            ...loadedResume.document.resources,
            assets: [
              ...loadedResume.document.resources.assets,
              ...storedAssets.filter((asset) => !existingAssetIds.has(asset.id)),
            ],
          },
        }
        setResume({ ...loadedResume, document: mergedDocument })
        setDocument(mergedDocument)
        documentRef.current = mergedDocument
        history.reset()
        versionRef.current = loadedResume.version
        const serialized = JSON.stringify(mergedDocument)
        lastSavedSerializedRef.current = serialized
        setJsonDraft(JSON.stringify(mergedDocument, null, 2))
      })
      .catch((error) => {
        setLoadError(
          error instanceof Error ? error.message : "简历加载失败，请稍后重试。",
        )
      })
  }, [history, resumeId])

  useEffect(() => {
    setSelectedPageIndex((current) => Math.min(Math.max(0, pageCount - 1), current))
  }, [pageCount])

  const queueSave = useCallback(
    (nextDocument: ResumeDocument): Promise<void> => {
      const serialized = JSON.stringify(nextDocument)
      if (serialized === lastSavedSerializedRef.current) {
        setSaveStatus("saved")
        return saveQueueRef.current
      }
      setSaveStatus("saving")

      const task = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const updated = await saveResume({
            resumeId,
            version: versionRef.current,
            document: nextDocument,
          })
          versionRef.current = updated.version
          lastSavedSerializedRef.current = serialized
          setResume(updated)
          setSaveStatus(
            JSON.stringify(documentRef.current) === serialized ? "saved" : "unsaved",
          )
        })
        .catch((error) => {
          setSaveStatus("error")
          toast.error(error instanceof Error ? error.message : "保存失败")
          throw error
        })

      saveQueueRef.current = task
      return task
    },
    [resumeId],
  )

  useEffect(() => {
    if (!document) {
      return
    }
    documentRef.current = document
    const serialized = JSON.stringify(document)
    if (serialized === lastSavedSerializedRef.current) {
      setSaveStatus("saved")
      return
    }
    setSaveStatus("unsaved")
  }, [document])

  useEffect(() => {
    if (saveStatus !== "unsaved") {
      return
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [saveStatus])

  function commitDocument(nextDocument: ResumeDocument, recordHistory = true) {
    if (document && recordHistory) {
      history.record(document)
      setHistoryVersion((value) => value + 1)
    }
    documentRef.current = nextDocument
    setDocument(nextDocument)
  }

  function handleUndo() {
    if (!document) {
      return
    }
    const previous = history.undo(document)
    if (!previous) {
      return
    }
    commitDocument(previous, false)
    setHistoryVersion((value) => value + 1)
  }

  function handleRedo() {
    if (!document) {
      return
    }
    const next = history.redo(document)
    if (!next) {
      return
    }
    commitDocument(next, false)
    setHistoryVersion((value) => value + 1)
  }

  async function handlePublish() {
    if (!document) {
      return
    }
    setIsPublishing(true)
    try {
      await queueSave(document)
      await saveQueueRef.current
      const result = await publishResume(resumeId)
      setResume((current) => (current ? { ...current, published: true } : current))
      setShareUrl(`${window.location.origin}${result.shareUrl}`)
      toast.success(`已发布版本 ${result.publicationVersion}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发布失败")
    } finally {
      setIsPublishing(false)
    }
  }

  async function handleSave() {
    if (!document) {
      return
    }
    try {
      await queueSave(document)
      await saveQueueRef.current
      toast.success("简历已保存")
    } catch {
      // queueSave already reports the concrete error.
    }
  }

  function handleDiscardChanges() {
    if (!document) {
      return
    }
    try {
      const savedDocument = parseResumeDocument(
        JSON.parse(lastSavedSerializedRef.current),
      )
      history.record(document)
      documentRef.current = savedDocument
      setDocument(savedDocument)
      setJsonDraft(JSON.stringify(savedDocument, null, 2))
      setSelectedSectionId("profile")
      setJsonLinkedTarget({ kind: "profile" })
      setSelectedPlacementId(null)
      setSaveStatus("saved")
      setHistoryVersion((value) => value + 1)
      toast.success("已回退到最近保存版本")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "回退失败")
    }
  }

  function prepareDraftPreview() {
    if (document) {
      writeDraftPreviewSnapshot(resumeId, document)
    }
  }

  async function handleImportFile(file: File) {
    try {
      const imported = parseResumeDocument(JSON.parse(await file.text()))
      commitDocument(imported)
      setSelectedSectionId("profile")
      setJsonLinkedTarget({ kind: "profile" })
      setSelectedPageIndex(0)
      setSelectedPlacementId(null)
      toast.success("JSON 简历已导入")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "JSON 文件无效")
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  function handleApplyJson(): boolean {
    try {
      const parsed = parseResumeDocument(JSON.parse(jsonDraft))
      setJsonError("")
      commitDocument(parsed)
      if (
        selectedSectionId !== "profile" &&
        !parsed.sections.some((section) => section.id === selectedSectionId)
      ) {
        setSelectedSectionId("profile")
      }
      if (
        selectedPlacementId &&
        !parsed.resources.placements.some(
          (placement) => placement.id === selectedPlacementId,
        )
      ) {
        setSelectedPlacementId(null)
      }
      setJsonDraft(JSON.stringify(parsed, null, 2))
      toast.success("JSON 已应用")
      return true
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "JSON 内容无效")
      return false
    }
  }

  function handleContentEditorTabChange(tab: ContentEditorTab) {
    if (tab !== "json") {
      setJsonPanelMaximized(false)
    }
    setContentEditorTab(tab)
    if (tab === "json" && document) {
      setJsonDraft(JSON.stringify(document, null, 2))
      setJsonError("")
      setJsonLinkedTarget(
        selectedSectionId === "profile"
          ? { kind: "profile" }
          : { kind: "section", sectionId: selectedSectionId },
      )
    }
  }

  function handlePreviewSectionSelect(sectionId: string) {
    setSelectedSectionId(sectionId)
  }

  function handleFormSectionSelect(sectionId: string) {
    setSelectedSectionId(sectionId)
    editorFocusSequenceRef.current += 1
    setEditorFocusRequest({
      id: editorFocusSequenceRef.current,
      sectionId,
      itemId: null,
      linkedTarget:
        sectionId === "profile" ? { kind: "profile" } : { kind: "section", sectionId },
    })
  }

  function handleJsonLinkedTargetChange(target: ResumeLinkTarget | null) {
    setJsonLinkedTarget(target)
    if (target) {
      setSelectedSectionId(target.kind === "profile" ? "profile" : target.sectionId)
    }
  }

  function handleContentPanelCollapsedChange(collapsed: boolean) {
    if (collapsed) {
      setJsonPanelMaximized(false)
    }
    setContentPanelCollapsed(collapsed)
  }

  function handleLeftPanelResize(width: number) {
    setJsonPanelMaximized(false)
    setLeftPanelWidth(width)
  }

  function handleInspectorCollapsedChange(collapsed: boolean) {
    if (!collapsed && jsonPanelMaximized) {
      setJsonPanelMaximized(false)
    }
    setInspectorCollapsed(collapsed)
  }

  if (loadError) {
    return (
      <main className="editor-access-error">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon />
            </EmptyMedia>
            <EmptyTitle>无法恢复编辑权</EmptyTitle>
            <EmptyDescription>{loadError}</EmptyDescription>
          </EmptyHeader>
          <Button asChild>
            <Link href="/workspace">返回工作台选择模板</Link>
          </Button>
        </Empty>
      </main>
    )
  }

  if (!document || !resume) {
    return <LoadingEditor />
  }

  const saveLabels: Record<SaveStatus, string> = {
    saved: "已保存",
    unsaved: "待保存",
    saving: "保存中",
    error: "保存失败",
  }

  return (
    <main className="editor-shell">
      <header className="editor-topbar">
        <div className="editor-brand-area">
          <Link className="brand-mark brand-mark-compact" href="/">
            <span>R</span>
            <span>Résumé Lab</span>
          </Link>
          <ChevronRightIcon aria-hidden="true" />
          <Input
            className="editor-title-input"
            aria-label="简历标题"
            value={document.metadata.title}
            onChange={(event) =>
              commitDocument({
                ...document,
                metadata: {
                  ...document.metadata,
                  title: event.target.value,
                },
              })
            }
          />
        </div>

        <div className="editor-toolbar">
          <Badge
            className="editor-save-status"
            variant={saveStatus === "error" ? "destructive" : "secondary"}
            data-testid="save-status"
          >
            {saveStatus === "saved" && <CheckIcon />}
            {saveLabels[saveStatus]}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saveStatus === "saving" || saveStatus === "saved"}
            onClick={() => void handleSave()}
          >
            {saveStatus === "saving" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            保存
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saveStatus === "saving" || saveStatus === "saved"}
            onClick={handleDiscardChanges}
          >
            <RotateCcwIcon data-icon="inline-start" />
            放弃修改
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="撤销"
                disabled={!history.canUndo}
                onClick={handleUndo}
                data-history-version={historyVersion}
              >
                <Undo2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>撤销</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="重做"
                disabled={!history.canRedo}
                onClick={handleRedo}
                data-history-version={historyVersion}
              >
                <Redo2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>重做</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="editor-preview-action"
                type="button"
                variant="outline"
                size="sm"
                asChild
              >
                <Link
                  href={`/editor/${resumeId}/preview`}
                  aria-label="全页预览"
                  target="_blank"
                  rel="noreferrer"
                  onClick={prepareDraftPreview}
                >
                  <Maximize2Icon data-icon="inline-start" />
                  <span className="editor-preview-action-label">全页预览</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>全页预览</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="editor-preview-action"
                type="button"
                variant="outline"
                size="sm"
                asChild
              >
                <Link
                  href={`/editor/${resumeId}/web`}
                  aria-label="Web 页面"
                  target="_blank"
                  rel="noreferrer"
                  onClick={prepareDraftPreview}
                >
                  <BracesIcon data-icon="inline-start" />
                  <span className="editor-preview-action-label">Web 页面</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Web 页面</TooltipContent>
          </Tooltip>
          <AiAssistant
            resumeId={resumeId}
            storageOwnerId={aiStorageOwnerId}
            document={document}
            selectedSectionId={selectedSectionId}
            onPendingSuggestionItemsChange={setPendingAiSuggestionItemIds}
            onApplySuggestion={(suggestion) => {
              const application = applyAiSuggestion(document, suggestion)
              if (!application) {
                return null
              }
              commitDocument(application.document)
              focusEditorTarget({
                sectionId: application.sectionId,
                itemId: application.itemId,
                linkedTarget: application.linkedTarget,
              })
              return { label: application.label }
            }}
            onLocateSuggestion={(suggestion) => {
              const target = locateSuggestionTarget(document, suggestion)
              if (!target) {
                return false
              }
              focusEditorTarget({ ...target, revealOnly: true })
              return true
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="更多操作">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                  <UploadIcon />
                  导入 JSON
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => downloadJson(document)}>
                  <DownloadIcon />
                  导出 JSON
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.print()}>
                  <PrinterIcon />
                  打印 / 导出 PDF
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {resume.published && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onSelect={() =>
                        setShareUrl(`${window.location.origin}/r/${resume.publicSlug}`)
                      }
                    >
                      <FileJsonIcon />
                      查看分享链接
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            disabled={isPublishing}
            onClick={handlePublish}
            data-testid="publish-resume"
          >
            <RocketIcon data-icon="inline-start" />
            {isPublishing ? "发布中" : "发布"}
          </Button>
        </div>
      </header>

      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void handleImportFile(file)
          }
        }}
      />

      <div
        className="editor-workspace"
        data-content-collapsed={contentPanelCollapsed}
        data-inspector-collapsed={effectiveInspectorCollapsed}
        data-json-maximized={jsonPanelMaximized}
        style={
          {
            "--editor-left-width": `${renderedLeftPanelWidth}px`,
            "--editor-left-coverage": `${effectiveLeftPanelWidth}px`,
          } as CSSProperties
        }
      >
        <ContentEditorPanel
          document={document}
          selectedSectionId={selectedSectionId}
          focusRequest={editorFocusRequest}
          activeTab={contentEditorTab}
          jsonDraft={jsonDraft}
          jsonError={jsonError}
          pendingSuggestionItemIds={pendingAiSuggestionItemIds}
          jsonLinkedTarget={jsonLinkedTarget}
          jsonMaximized={jsonPanelMaximized}
          collapsed={contentPanelCollapsed}
          onTabChange={handleContentEditorTabChange}
          onJsonDraftChange={setJsonDraft}
          onJsonLinkedTargetChange={handleJsonLinkedTargetChange}
          onJsonMaximizedChange={setJsonPanelMaximized}
          onApplyJson={handleApplyJson}
          onChange={commitDocument}
          onSelectSection={handleFormSectionSelect}
          onReorderSections={(sections) => commitDocument({ ...document, sections })}
          onToggleVisibility={(sectionId) =>
            commitDocument({
              ...document,
              sections: document.sections.map((section) =>
                section.id === sectionId
                  ? { ...section, visible: !section.visible }
                  : section,
              ),
            })
          }
          onAddSection={(type: ResumeSectionType) => {
            const section = createResumeSection(type)
            commitDocument({
              ...document,
              sections: [...document.sections, section],
            })
            setSelectedSectionId(section.id)
          }}
          onDeleteSection={(sectionId) => {
            commitDocument({
              ...document,
              sections: document.sections.filter((section) => section.id !== sectionId),
            })
            setSelectedSectionId("profile")
          }}
          onCollapsedChange={handleContentPanelCollapsedChange}
        />

        {!contentPanelCollapsed ? (
          <EditorPanelResizer
            width={renderedLeftPanelWidth}
            viewportWidth={viewportWidth}
            onResize={handleLeftPanelResize}
          />
        ) : null}

        <section
          ref={previewPanelRef}
          className="editor-stage-panel"
          aria-label="A4 可视化预览"
        >
          {contentPanelCollapsed ? (
            <Button
              className="content-editor-expand"
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="展开内容编辑区域"
              onClick={() => setContentPanelCollapsed(false)}
            >
              <PanelLeftOpenIcon />
            </Button>
          ) : null}
          <PreviewZoomControls
            zoom={previewZoom}
            minimum={MIN_PREVIEW_ZOOM}
            maximum={MAX_PREVIEW_ZOOM}
            fitActive={fitPreview}
            onZoomOut={() => zoomBy(-PREVIEW_ZOOM_STEP)}
            onZoomIn={() => zoomBy(PREVIEW_ZOOM_STEP)}
            onZoomChange={setManualZoom}
            onFit={fitPreviewToPanel}
          />
          <ScrollArea className="editor-stage-scroll editor-canvas-scroll" horizontal>
            <A4Preview
              document={document}
              assetUrls={assetUrls}
              selectedSectionId={contentEditorTab === "json" ? "" : selectedSectionId}
              selectedPageIndex={selectedPageIndex}
              selectedPlacementId={selectedPlacementId}
              linkedTarget={
                contentEditorTab === "json"
                  ? jsonLinkedTarget
                  : (editorFocusRequest?.linkedTarget ?? null)
              }
              zoom={previewZoom}
              onChange={commitDocument}
              onSelectSection={handlePreviewSectionSelect}
              onSelectPage={setSelectedPageIndex}
              onSelectPlacement={setSelectedPlacementId}
              onSelectLinkedTarget={handleJsonLinkedTargetChange}
            />
          </ScrollArea>
        </section>

        <StyleInspector
          resumeId={resumeId}
          document={document}
          assetUrls={assetUrls}
          selectedSectionId={selectedSectionId}
          selectedPageIndex={selectedPageIndex}
          pageCount={pageCount}
          selectedPlacementId={selectedPlacementId}
          collapsed={effectiveInspectorCollapsed}
          onChange={commitDocument}
          onCollapsedChange={handleInspectorCollapsedChange}
          onSelectPlacement={setSelectedPlacementId}
        />
      </div>

      <Dialog
        open={Boolean(shareUrl)}
        onOpenChange={(open) => !open && setShareUrl("")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>简历已发布</DialogTitle>
            <DialogDescription>
              该链接展示最近发布的只读快照，后续草稿修改不会自动公开。
            </DialogDescription>
          </DialogHeader>
          <Input readOnly value={shareUrl} aria-label="分享链接" />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl)
                toast.success("分享链接已复制")
              }}
            >
              复制链接
            </Button>
            <Button asChild>
              <a href={shareUrl} target="_blank" rel="noreferrer">
                打开分享页
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
