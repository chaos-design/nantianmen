"use client"

import { CheckIcon, FilePlus2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog"
import { Spinner } from "../../components/ui/spinner"
import { maximumMemberResumeCount } from "../../shared/resume-schema/resume-policy"
import type { ResumeTemplateId } from "../../shared/resume-schema/resume-schema"
import { templateSchemes } from "../../shared/resume-template/template-schemes"
import { createResume } from "../resume-editor/editor-api"
import { TemplateThumbnail } from "../resume-editor/template-thumbnail"

type TemplateSelectorPresentation = "inline" | "dialog"

interface WorkspaceTemplateSelectorProps {
  presentation: TemplateSelectorPresentation
  creationDisabled?: boolean
  onCreatingChange?: (isCreating: boolean) => void
}

function WorkspaceTemplateSelector({
  presentation,
  creationDisabled = false,
  onCreatingChange,
}: WorkspaceTemplateSelectorProps) {
  const router = useRouter()
  const [selectedTemplateId, setSelectedTemplateId] = useState<ResumeTemplateId | null>(
    null,
  )
  const [isCreating, setIsCreating] = useState(false)
  const selectedTemplate = templateSchemes.find(
    (scheme) => scheme.id === selectedTemplateId,
  )

  function updateCreating(isCreatingNext: boolean) {
    setIsCreating(isCreatingNext)
    onCreatingChange?.(isCreatingNext)
  }

  async function handleCreate() {
    if (!selectedTemplate) {
      return
    }
    updateCreating(true)
    try {
      const result = await createResume(selectedTemplate.id)
      router.push(`/editor/${result.resume.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建简历失败")
      updateCreating(false)
    }
  }

  const createAction = (
    <div
      className={
        presentation === "inline"
          ? "workspace-template-create"
          : "workspace-template-dialog-create"
      }
    >
      <div className="workspace-template-selection-summary" aria-live="polite">
        <strong>
          {creationDisabled
            ? "已达到简历数量上限"
            : selectedTemplate
              ? `已选择「${selectedTemplate.name}」`
              : "尚未选择模板"}
        </strong>
        <span>
          {creationDisabled
            ? "请先删除不再需要的简历，再创建新简历。"
            : selectedTemplate
              ? "确定后将创建简历并进入编辑器，内容、配色和版式仍可继续调整。"
              : "请选择一套初始版式；创建后仍可在编辑器中更换模板和完善内容。"}
        </span>
      </div>
      <Button
        type="button"
        disabled={creationDisabled || !selectedTemplate || isCreating}
        onClick={handleCreate}
        data-testid="create-resume"
      >
        {isCreating ? <Spinner data-icon="inline-start" /> : null}
        {isCreating ? "创建中" : "确定"}
      </Button>
    </div>
  )

  const templateGrid = (
    <fieldset
      className="workspace-template-grid"
      data-presentation={presentation}
      disabled={creationDisabled || isCreating}
    >
      <legend className="sr-only">简历模板库</legend>
      {templateSchemes.map((scheme, index) => {
        const selected = selectedTemplateId === scheme.id
        return (
          <button
            className="workspace-template-option"
            type="button"
            key={scheme.id}
            aria-label={`选择${scheme.name}模板`}
            aria-pressed={selected}
            data-selected={selected}
            data-testid="workspace-template-option"
            onClick={() => setSelectedTemplateId(scheme.id)}
          >
            <span className="workspace-template-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <TemplateThumbnail scheme={scheme} />
            <span className="workspace-template-copy">
              <strong>{scheme.name}</strong>
              <small>{scheme.category}</small>
              <span>{scheme.description}</span>
            </span>
            {selected ? (
              <CheckIcon className="workspace-template-check" aria-hidden="true" />
            ) : null}
          </button>
        )
      })}
    </fieldset>
  )

  if (presentation === "dialog") {
    return (
      <>
        {templateGrid}
        {createAction}
      </>
    )
  }

  return (
    <section
      className="workspace-template-library"
      aria-labelledby="workspace-template-library-title"
      aria-busy={isCreating}
      data-testid="workspace-template-library"
    >
      <header className="workspace-template-library-header">
        <div>
          <span>NEW RESUME / TEMPLATE FIRST</span>
          <h2 id="workspace-template-library-title">先选择一套模板</h2>
          <p>模板决定初始版式，进入编辑器后仍可随时更换。</p>
        </div>
        {createAction}
      </header>
      {templateGrid}
    </section>
  )
}

export function WorkspaceTemplateLibrary() {
  return <WorkspaceTemplateSelector presentation="inline" />
}

export function WorkspaceCreateResumeDialog({
  disabled = false,
}: {
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [selectionSession, setSelectionSession] = useState(0)

  function handleOpenChange(openNext: boolean) {
    if (disabled || isCreating) {
      return
    }
    setOpen(openNext)
    if (openNext) {
      setSelectionSession((value) => value + 1)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" data-testid="new-resume" disabled={disabled}>
          <FilePlus2Icon data-icon="inline-start" />
          {disabled ? `已达 ${maximumMemberResumeCount} 份上限` : "新建简历"}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="workspace-template-dialog"
        data-testid="workspace-template-dialog"
      >
        <DialogHeader className="workspace-template-dialog-header">
          <DialogTitle>选择模板创建简历</DialogTitle>
          <DialogDescription>
            选择一套初始版式，创建后直接进入编辑器继续完善内容。
          </DialogDescription>
        </DialogHeader>
        <WorkspaceTemplateSelector
          key={selectionSession}
          presentation="dialog"
          creationDisabled={disabled}
          onCreatingChange={setIsCreating}
        />
      </DialogContent>
    </Dialog>
  )
}
