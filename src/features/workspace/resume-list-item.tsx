"use client"

import {
  BracesIcon,
  CheckIcon,
  EyeIcon,
  PencilLineIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type KeyboardEvent, useState } from "react"
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
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "../../components/ui/card"
import type { ResumeListItem as ResumeListItemData } from "../../server/domain/resume-service"
import { deleteResume } from "../resume-editor/editor-api"

interface ResumeListItemProps {
  resume: ResumeListItemData
  currentUserId: string
  showOwner: boolean
  readOnly?: boolean
  managementMode?: boolean
  selected?: boolean
  onSelectedChange?: (selected: boolean) => void
  onDeleted?: (resumeId: string) => void
}

export function ResumeListItem({
  resume,
  currentUserId,
  showOwner,
  readOnly = false,
  managementMode = false,
  selected = false,
  onSelectedChange,
  onDeleted,
}: ResumeListItemProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const ownerLabel =
    resume.ownerId === currentUserId
      ? "本人"
      : resume.ownerId
        ? `用户 ${resume.ownerId.slice(0, 8)}`
        : "历史无归属"
  const primaryHref = readOnly ? `/editor/${resume.id}/preview` : `/editor/${resume.id}`
  const primaryLabel = readOnly ? `预览${resume.title}` : `编辑${resume.title}`

  function toggleSelection() {
    onSelectedChange?.(!selected)
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      !managementMode ||
      event.target !== event.currentTarget ||
      (event.key !== "Enter" && event.key !== " ")
    ) {
      return
    }
    event.preventDefault()
    toggleSelection()
  }

  const deleteAction = readOnly ? null : (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          className="workspace-resume-action"
          data-action="delete"
          variant="ghost"
          size="xs"
          disabled={isDeleting}
          aria-label="删除简历"
          title="删除简历"
        >
          <span className="workspace-resume-action-icon">
            <Trash2Icon />
          </span>
          <span>删除</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除「{resume.title}」？</AlertDialogTitle>
          <AlertDialogDescription>
            删除后会移除草稿、发布快照和资源元数据。该操作不能撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={async (event) => {
              event.preventDefault()
              setIsDeleting(true)
              try {
                await deleteResume(resume.id)
                toast.success("简历已删除")
                onDeleted?.(resume.id)
                router.refresh()
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "删除简历失败")
                setIsDeleting(false)
              }
            }}
          >
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  const shareAction = resume.published ? (
    <Button
      className="workspace-resume-action"
      data-action="share"
      variant="ghost"
      size="xs"
      asChild
    >
      <Link
        href={`/r/${resume.publicSlug}/web`}
        target="_blank"
        rel="noreferrer"
        aria-label="打开 Web 分享页"
        title="打开 Web 分享页"
      >
        <span className="workspace-resume-action-icon">
          <Share2Icon />
        </span>
        <span>Web</span>
      </Link>
    </Button>
  ) : (
    <span
      className="workspace-resume-action-disabled"
      title="发布简历后可打开 Web 分享页"
    >
      <Button
        className="workspace-resume-action"
        data-action="share"
        variant="ghost"
        size="xs"
        disabled
        aria-label="Web 分享不可用，简历尚未发布"
      >
        <span className="workspace-resume-action-icon">
          <Share2Icon />
        </span>
        <span>Web</span>
      </Button>
    </span>
  )

  return (
    <Card
      className="workspace-resume-card"
      data-selected={selected}
      data-management-mode={managementMode}
      data-read-only={readOnly}
      data-published={resume.published}
      role={managementMode ? "checkbox" : undefined}
      tabIndex={managementMode ? 0 : undefined}
      aria-checked={managementMode ? selected : undefined}
      aria-label={
        managementMode ? `${selected ? "取消选择" : "选择"}${resume.title}` : undefined
      }
      aria-busy={isDeleting}
      onClick={managementMode ? toggleSelection : undefined}
      onKeyDown={handleCardKeyDown}
    >
      {!managementMode ? (
        <Link
          className="workspace-resume-card-link"
          href={primaryHref}
          target={readOnly ? "_blank" : undefined}
          rel={readOnly ? "noreferrer" : undefined}
          aria-label={primaryLabel}
        />
      ) : null}
      <div className="workspace-resume-card-status">
        <span>
          <i aria-hidden="true" />
          {resume.published ? "已发布" : "草稿"}
        </span>
        {showOwner ? <small>{ownerLabel}</small> : null}
        {managementMode ? (
          <span className="workspace-resume-select" aria-hidden="true">
            <span>
              <CheckIcon />
            </span>
          </span>
        ) : null}
      </div>
      <CardContent className="workspace-resume-card-body">
        <span>RESUME / V{String(resume.version).padStart(2, "0")}</span>
        <CardTitle>{resume.title}</CardTitle>
        <CardDescription>
          更新于{" "}
          {new Intl.DateTimeFormat("zh-CN", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(resume.updatedAt))}
        </CardDescription>
      </CardContent>
      {!managementMode ? (
        <div className="workspace-resume-actions">
          {readOnly ? (
            <>
              <Button
                className="workspace-resume-action"
                data-action="preview"
                variant="ghost"
                size="xs"
                asChild
              >
                <Link
                  href={`/editor/${resume.id}/preview`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="A4 预览"
                  title="A4 预览"
                >
                  <span className="workspace-resume-action-icon">
                    <EyeIcon />
                  </span>
                  <span>预览</span>
                </Link>
              </Button>
              <Button
                className="workspace-resume-action"
                data-action="web-preview"
                variant="ghost"
                size="xs"
                asChild
              >
                <Link
                  href={`/editor/${resume.id}/web`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Web 预览"
                  title="Web 预览"
                >
                  <span className="workspace-resume-action-icon">
                    <BracesIcon />
                  </span>
                  <span>网页</span>
                </Link>
              </Button>
              {shareAction}
            </>
          ) : (
            <>
              <Button
                className="workspace-resume-action"
                data-action="edit"
                variant="ghost"
                size="xs"
                asChild
              >
                <Link
                  href={`/editor/${resume.id}`}
                  aria-label="进入编辑"
                  title="进入编辑"
                >
                  <span className="workspace-resume-action-icon">
                    <PencilLineIcon />
                  </span>
                  <span>编辑</span>
                </Link>
              </Button>
              <Button
                className="workspace-resume-action"
                data-action="preview"
                variant="ghost"
                size="xs"
                asChild
              >
                <Link
                  href={`/editor/${resume.id}/preview`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="A4 预览"
                  title="A4 预览"
                >
                  <span className="workspace-resume-action-icon">
                    <EyeIcon />
                  </span>
                  <span>预览</span>
                </Link>
              </Button>
              {shareAction}
              {deleteAction}
            </>
          )}
        </div>
      ) : null}
      <div className="workspace-resume-card-signal" aria-hidden="true" />
    </Card>
  )
}
