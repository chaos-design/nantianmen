"use client"

import { BracesIcon, ListTreeIcon, PanelLeftCloseIcon } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useRef } from "react"
import { Button } from "../../components/ui/button"
import { ScrollArea } from "../../components/ui/scroll-area"
import { Separator } from "../../components/ui/separator"
import { Skeleton } from "../../components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import type { ResumeLinkTarget } from "../../shared/resume-schema/resume-link-target"
import type {
  ResumeDocument,
  ResumeSection,
  ResumeSectionType,
} from "../../shared/resume-schema/resume-schema"
import type { EditorFocusRequest } from "./editor-focus-request"
import { SectionEditor } from "./section-editor"
import { SectionNavigation } from "./section-navigation"

export type ContentEditorTab = "form" | "json"

/**
 * Monaco JSON 编辑器拆成独立 chunk：
 * 首次切到 JSON 标签页才下载，编辑器主界面不需要预先携带
 * @monaco-editor/react 与语法解析依赖。
 */
const ResumeJsonEditor = dynamic(
  () => import("./resume-json-editor").then((module) => module.ResumeJsonEditor),
  {
    ssr: false,
    loading: () => (
      <div className="resume-json-editor-loading">
        <span className="sr-only">JSON 编辑器加载中</span>
        <Skeleton />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    ),
  },
)

interface ContentEditorPanelProps {
  document: ResumeDocument
  selectedSectionId: string
  focusRequest: EditorFocusRequest | null
  activeTab: ContentEditorTab
  jsonDraft: string
  jsonError: string
  jsonLinkedTarget: ResumeLinkTarget | null
  jsonMaximized: boolean
  collapsed: boolean
  pendingSuggestionItemIds: readonly string[]
  onTabChange: (tab: ContentEditorTab) => void
  onJsonDraftChange: (value: string) => void
  onJsonLinkedTargetChange: (target: ResumeLinkTarget | null) => void
  onJsonMaximizedChange: (maximized: boolean) => void
  onApplyJson: () => boolean
  onChange: (document: ResumeDocument) => void
  onSelectSection: (sectionId: string) => void
  onReorderSections: (sections: ResumeSection[]) => void
  onToggleVisibility: (sectionId: string) => void
  onAddSection: (type: ResumeSectionType) => void
  onDeleteSection: (sectionId: string) => void
  onCollapsedChange: (collapsed: boolean) => void
}

export function ContentEditorPanel({
  document,
  selectedSectionId,
  focusRequest,
  activeTab,
  jsonDraft,
  jsonError,
  jsonLinkedTarget,
  jsonMaximized,
  collapsed,
  pendingSuggestionItemIds,
  onTabChange,
  onJsonDraftChange,
  onJsonLinkedTargetChange,
  onJsonMaximizedChange,
  onApplyJson,
  onChange,
  onSelectSection,
  onReorderSections,
  onToggleVisibility,
  onAddSection,
  onDeleteSection,
  onCollapsedChange,
}: ContentEditorPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (collapsed || activeTab !== "form") {
      return
    }
    if (!selectedSectionId) {
      return
    }
    const frame = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("[data-editor-form-target]")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
    })
    return () => cancelAnimationFrame(frame)
  }, [activeTab, collapsed, selectedSectionId])

  useEffect(() => {
    if (
      !focusRequest ||
      collapsed ||
      activeTab !== "form" ||
      focusRequest.sectionId !== selectedSectionId
    ) {
      return
    }
    let nestedFrame = 0
    const frame = requestAnimationFrame(() => {
      nestedFrame = requestAnimationFrame(() => {
        const itemTarget = focusRequest.itemId
          ? Array.from(
              panelRef.current?.querySelectorAll<HTMLElement>(
                "[data-editor-item-focus-id]",
              ) ?? [],
            ).find(
              (element) => element.dataset.editorItemFocusId === focusRequest.itemId,
            )
          : null
        const target =
          itemTarget ??
          panelRef.current?.querySelector<HTMLElement>("[data-editor-form-target]")
        target?.scrollIntoView({
          behavior: "smooth",
          block: itemTarget ? "center" : "start",
        })
      })
    })
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(nestedFrame)
    }
  }, [activeTab, collapsed, focusRequest, selectedSectionId])

  return (
    <aside
      ref={panelRef}
      className="content-editor-panel"
      data-collapsed={collapsed}
      aria-hidden={collapsed}
      inert={collapsed}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (value === "form" || value === "json") {
            onTabChange(value)
          }
        }}
        className="content-editor-tabs"
      >
        <div className="content-editor-topbar">
          <TabsList className="content-editor-tab-list">
            <TabsTrigger value="form">
              <ListTreeIcon />
              表单编辑
            </TabsTrigger>
            <TabsTrigger value="json">
              <BracesIcon />
              JSON
            </TabsTrigger>
          </TabsList>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="折叠内容编辑区域"
            onClick={() => onCollapsedChange(true)}
          >
            <PanelLeftCloseIcon />
          </Button>
        </div>

        {activeTab === "form" ? (
          <ScrollArea className="content-editor-scroll">
            <TabsContent value="form" className="content-editor-tab-content">
              <SectionNavigation
                sections={document.sections}
                selectedSectionId={selectedSectionId}
                onSelect={onSelectSection}
                onReorder={onReorderSections}
                onToggleVisibility={onToggleVisibility}
                onAddSection={onAddSection}
              />
              <Separator />
              <SectionEditor
                document={document}
                selectedSectionId={selectedSectionId}
                focusRequest={focusRequest}
                pendingSuggestionItemIds={pendingSuggestionItemIds}
                onChange={onChange}
                onDeleteSection={onDeleteSection}
              />
            </TabsContent>
          </ScrollArea>
        ) : (
          <TabsContent value="json" className="content-editor-json-tab">
            <ResumeJsonEditor
              modelPath="inmemory://resume/document-inline.json"
              value={jsonDraft}
              error={jsonError}
              onChange={onJsonDraftChange}
              onApply={onApplyJson}
              maximized={jsonMaximized}
              onMaximizedChange={onJsonMaximizedChange}
              linkedTarget={jsonLinkedTarget}
              onLinkedTargetChange={onJsonLinkedTargetChange}
            />
          </TabsContent>
        )}
      </Tabs>
    </aside>
  )
}
