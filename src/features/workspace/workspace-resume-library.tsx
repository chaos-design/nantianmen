"use client"

import {
  ChevronDownIcon,
  Layers3Icon,
  PowerIcon,
  SearchIcon,
  SearchXIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useDeferredValue, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import { Input } from "../../components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { Spinner } from "../../components/ui/spinner"
import type { ResumeListItem as ResumeListItemData } from "../../server/domain/resume-service"
import type { ResumeTemplateId } from "../../shared/resume-schema/resume-schema"
import { templateSchemes } from "../../shared/resume-template/template-schemes"
import { deleteResumes } from "../resume-editor/editor-api"
import { ResumeListItem } from "./resume-list-item"
import {
  filterWorkspaceResumes,
  groupWorkspaceResumes,
  type WorkspacePublicationFilter,
} from "./workspace-resume-groups"

interface WorkspaceResumeLibraryProps {
  resumes: ResumeListItemData[]
  currentUserId: string
  showOwner: boolean
  readOnly: boolean
}

interface SelectionCheckboxProps {
  checked: boolean
  indeterminate?: boolean
  label: string
  onChange: () => void
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: SelectionCheckboxProps) {
  return (
    <label className="workspace-selection-checkbox">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        ref={(input) => {
          if (input) {
            input.indeterminate = indeterminate
          }
        }}
        onChange={onChange}
      />
      <span aria-hidden="true" />
    </label>
  )
}

export function WorkspaceResumeLibrary({
  resumes,
  currentUserId,
  showOwner,
  readOnly,
}: WorkspaceResumeLibraryProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [managementMode, setManagementMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [templateFilters, setTemplateFilters] = useState<ResumeTemplateId[]>([])
  const [publicationFilter, setPublicationFilter] =
    useState<WorkspacePublicationFilter>("all")
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const visibleResumes = useMemo(
    () => resumes.filter((resume) => !removedIds.has(resume.id)),
    [removedIds, resumes],
  )
  const filteredResumes = useMemo(
    () =>
      filterWorkspaceResumes(visibleResumes, {
        query: deferredSearchQuery,
        templateIds: templateFilters,
        publicationStatus: publicationFilter,
      }),
    [deferredSearchQuery, publicationFilter, templateFilters, visibleResumes],
  )
  const groups = useMemo(
    () => groupWorkspaceResumes(filteredResumes),
    [filteredResumes],
  )
  const templateFilterLabel =
    templateFilters.length === 0
      ? "全部模板"
      : templateFilters.length === 1
        ? (templateSchemes.find((scheme) => scheme.id === templateFilters[0])?.name ??
          "1 个模板")
        : `已选 ${templateFilters.length} 个`
  const selectedCount = selectedIds.size
  const allSelected =
    filteredResumes.length > 0 && selectedCount === filteredResumes.length
  const hasTemplateFilters = templateFilters.length > 0
  const hasPublicationFilter = publicationFilter !== "all"
  const hasActiveFilters =
    Boolean(searchQuery.trim()) || hasTemplateFilters || hasPublicationFilter

  function updateSelection(resumeIds: string[], selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const resumeId of resumeIds) {
        if (selected) {
          next.add(resumeId)
        } else {
          next.delete(resumeId)
        }
      }
      return next
    })
  }

  function removeResumes(resumeIds: string[]) {
    setRemovedIds((current) => new Set([...current, ...resumeIds]))
    updateSelection(resumeIds, false)
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function clearFilters() {
    setSearchQuery("")
    setTemplateFilters([])
    setPublicationFilter("all")
    clearSelection()
  }

  function clearTemplateFilters() {
    setTemplateFilters([])
    clearSelection()
  }

  function clearPublicationFilter() {
    setPublicationFilter("all")
    clearSelection()
  }

  function updateTemplateFilter(templateId: ResumeTemplateId, selected: boolean) {
    setTemplateFilters((current) => {
      if (selected) {
        return current.includes(templateId) ? current : [...current, templateId]
      }
      return current.filter((currentId) => currentId !== templateId)
    })
    clearSelection()
  }

  function toggleManagementMode() {
    setManagementMode((enabled) => !enabled)
    clearSelection()
  }

  async function handleBatchDelete() {
    const resumeIds = [...selectedIds]
    if (resumeIds.length === 0) {
      return
    }

    setIsDeleting(true)
    try {
      const deletedCount = await deleteResumes(resumeIds)
      removeResumes(resumeIds)
      toast.success(`已删除 ${deletedCount} 份简历`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量删除简历失败")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="workspace-resume-library">
      <div className="workspace-library-sticky">
        <section className="workspace-library-controls" aria-label="搜索与筛选">
          <div className="workspace-resume-search">
            <SearchIcon aria-hidden="true" />
            <Input
              type="search"
              value={searchQuery}
              aria-label="搜索简历名称"
              placeholder="搜索简历名称"
              onChange={(event) => {
                setSearchQuery(event.target.value)
                clearSelection()
              }}
            />
          </div>
          <div className="workspace-library-filters">
            <div
              className="workspace-filter-trigger-wrap"
              data-clearable={hasTemplateFilters}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="workspace-template-filter-trigger"
                    type="button"
                    variant="outline"
                    aria-label={`按模板筛选，${templateFilterLabel}`}
                  >
                    <Layers3Icon data-icon="inline-start" />
                    <span>{templateFilterLabel}</span>
                    <ChevronDownIcon className="workspace-filter-chevron" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="workspace-template-filter-menu"
                  align="start"
                  avoidCollisions={false}
                  side="bottom"
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="workspace-template-filter-label">
                    <span>模板筛选</span>
                    <small>支持多选</small>
                  </DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={templateFilters.length === 0}
                    onCheckedChange={clearTemplateFilters}
                    onSelect={(event) => event.preventDefault()}
                  >
                    全部模板
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {templateSchemes.map((scheme) => (
                    <DropdownMenuCheckboxItem
                      key={scheme.id}
                      checked={templateFilters.includes(scheme.id)}
                      onCheckedChange={(checked) =>
                        updateTemplateFilter(scheme.id, checked === true)
                      }
                      onSelect={(event) => event.preventDefault()}
                    >
                      <span>{scheme.name}</span>
                      <small>{scheme.category}</small>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {hasTemplateFilters ? (
                <button
                  className="workspace-filter-clear"
                  type="button"
                  aria-label="清空模板筛选"
                  onClick={clearTemplateFilters}
                >
                  <XIcon aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <div
              className="workspace-filter-trigger-wrap"
              data-clearable={hasPublicationFilter}
            >
              <Select
                value={publicationFilter}
                onValueChange={(value) => {
                  setPublicationFilter(value as WorkspacePublicationFilter)
                  clearSelection()
                }}
              >
                <SelectTrigger aria-label="按发布状态筛选">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                </SelectContent>
              </Select>
              {hasPublicationFilter ? (
                <button
                  className="workspace-filter-clear"
                  type="button"
                  aria-label="清空发布状态筛选"
                  onClick={clearPublicationFilter}
                >
                  <XIcon aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="workspace-library-summary">
            <span>
              {filteredResumes.length}
              <small> / {visibleResumes.length}</small>
            </span>
            {!readOnly ? (
              <Button
                className="workspace-power-action"
                type="button"
                variant={managementMode ? "secondary" : "outline"}
                size="sm"
                aria-pressed={managementMode}
                onClick={toggleManagementMode}
              >
                <PowerIcon data-icon="inline-start" />
                {managementMode ? "退出管理" : "管理"}
              </Button>
            ) : null}
          </div>
        </section>

        {managementMode && !readOnly ? (
          <div
            className="workspace-batch-toolbar"
            data-has-selection={selectedCount > 0}
          >
            <div>
              <SelectionCheckbox
                checked={allSelected}
                indeterminate={selectedCount > 0 && !allSelected}
                label={allSelected ? "取消选择当前结果" : "选择当前结果"}
                onChange={() =>
                  updateSelection(
                    filteredResumes.map((resume) => resume.id),
                    !allSelected,
                  )
                }
              />
              <div>
                <strong>
                  {selectedCount > 0 ? `已选择 ${selectedCount} 份` : "管理模式"}
                </strong>
                <span>危险操作已解锁，退出管理将清空选择</span>
              </div>
            </div>
            <div>
              {selectedCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isDeleting}
                  onClick={clearSelection}
                >
                  <XIcon data-icon="inline-start" />
                  清空选择
                </Button>
              ) : null}
              {selectedCount > 0 ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <Trash2Icon data-icon="inline-start" />
                      )}
                      批量删除
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        删除选中的 {selectedCount} 份简历？
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        将同时移除这些简历的草稿、发布快照和资源元数据。该操作不能撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        disabled={isDeleting}
                        onClick={async (event) => {
                          event.preventDefault()
                          await handleBatchDelete()
                        }}
                      >
                        {isDeleting ? <Spinner data-icon="inline-start" /> : null}
                        确认删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {groups.length > 0 ? (
        <div className="workspace-resume-groups">
          {groups.map((group, groupIndex) => {
            const groupResumeIds = group.resumes.map((resume) => resume.id)
            const selectedInGroup = groupResumeIds.filter((resumeId) =>
              selectedIds.has(resumeId),
            ).length
            const groupSelected = selectedInGroup === groupResumeIds.length

            return (
              <section
                className="workspace-resume-group"
                key={group.templateId}
                aria-labelledby={`workspace-resume-group-${group.templateId}`}
              >
                <header>
                  <div className="workspace-resume-group-index" aria-hidden="true">
                    {String(groupIndex + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <span>RESUME TYPE</span>
                    <h2 id={`workspace-resume-group-${group.templateId}`}>
                      {group.templateName}
                    </h2>
                    <p>{group.category}</p>
                  </div>
                  <div className="workspace-resume-group-meta">
                    <Badge variant="outline">{group.resumes.length} 份</Badge>
                    {managementMode && !readOnly ? (
                      <div className="workspace-resume-group-select">
                        <SelectionCheckbox
                          checked={groupSelected}
                          indeterminate={selectedInGroup > 0 && !groupSelected}
                          label={
                            groupSelected
                              ? `取消选择全部${group.templateName}简历`
                              : `选择全部${group.templateName}简历`
                          }
                          onChange={() =>
                            updateSelection(groupResumeIds, !groupSelected)
                          }
                        />
                        <span>{groupSelected ? "取消全选" : "选择本类"}</span>
                      </div>
                    ) : (
                      <Layers3Icon aria-hidden="true" />
                    )}
                  </div>
                </header>
                <div className="workspace-resume-grid">
                  {group.resumes.map((resume) => (
                    <ResumeListItem
                      key={resume.id}
                      resume={resume}
                      currentUserId={currentUserId}
                      showOwner={showOwner}
                      readOnly={readOnly}
                      managementMode={managementMode && !readOnly}
                      selected={selectedIds.has(resume.id)}
                      onSelectedChange={(selected) =>
                        updateSelection([resume.id], selected)
                      }
                      onDeleted={(resumeId) => removeResumes([resumeId])}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="workspace-filter-empty">
          <SearchXIcon aria-hidden="true" />
          <h2>{visibleResumes.length > 0 ? "没有匹配的简历" : "暂无简历"}</h2>
          <p>
            {visibleResumes.length > 0
              ? "尝试调整搜索词、模板或发布状态。"
              : "新建一份简历后，它会出现在这里。"}
          </p>
          {hasActiveFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              清除筛选
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
