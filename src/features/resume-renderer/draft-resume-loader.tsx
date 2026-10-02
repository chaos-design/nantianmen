"use client"

import { HistoryIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "../../components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/empty"
import { Skeleton } from "../../components/ui/skeleton"
import type { EditableResume } from "../../server/domain/resume-service"
import type { ResumeDocument } from "../../shared/resume-schema/resume-schema"
import { listResumeAssets, loadResume } from "../resume-editor/editor-api"
import { usePrivateAssetUrls } from "../resume-editor/use-private-asset-urls"
import { consumeDraftPreviewSnapshot } from "./draft-preview-session"

interface DraftResumeLoaderResult {
  resume: EditableResume | null
  assetUrls: Record<string, string>
  error: string
}

export function useDraftResumeLoader(
  resumeId: string,
  loadAssetUrls = true,
): DraftResumeLoaderResult {
  const [resume, setResume] = useState<EditableResume | null>(null)
  const [error, setError] = useState("")
  const assetUrls = usePrivateAssetUrls(
    resumeId,
    loadAssetUrls ? (resume?.document.resources.assets ?? []) : [],
  )

  useEffect(() => {
    let active = true
    void loadResume(resumeId)
      .then(async (loadedResume) => {
        const storedAssets = await listResumeAssets(resumeId).catch(
          () => loadedResume.document.resources.assets,
        )
        if (!active) {
          return
        }
        const previewDocument =
          consumeDraftPreviewSnapshot(resumeId) ?? loadedResume.document
        const existingAssetIds = new Set(
          previewDocument.resources.assets.map((asset) => asset.id),
        )
        const document: ResumeDocument = {
          ...previewDocument,
          resources: {
            ...previewDocument.resources,
            assets: [
              ...previewDocument.resources.assets,
              ...storedAssets.filter((asset) => !existingAssetIds.has(asset.id)),
            ],
          },
        }
        setResume({ ...loadedResume, document })
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "简历加载失败，请稍后重试。",
          )
        }
      })
    return () => {
      active = false
    }
  }, [resumeId])

  return { resume, assetUrls, error }
}

export function DraftResumeRouteFallback({ error }: { error?: string }) {
  if (!error) {
    return (
      <main className="draft-route-loading" aria-label="正在加载简历">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="draft-route-loading-body" />
      </main>
    )
  }

  return (
    <main className="editor-access-error">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>无法打开草稿预览</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
        <Button asChild>
          <Link href="/workspace">返回工作台选择模板</Link>
        </Button>
      </Empty>
    </main>
  )
}
