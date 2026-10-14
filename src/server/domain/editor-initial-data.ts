import type { ResumeImageAsset } from "../../shared/resume-schema/resume-schema"
import { mergeStoredAssets } from "../../shared/resume-schema/stored-asset-merge"
import { getResumeAssetStorage } from "../assets/resume-asset-storage-factory"
import { getResumeRepository } from "../repositories/repository-factory"
import { ResumeAssetService } from "./resume-asset-service"
import type { Actor, EditableResume } from "./resume-service"
import { DomainError, ResumeService } from "./resume-service"

export interface EditorInitialData {
  resume: EditableResume | null
  error: string | null
}

/**
 * 编辑器路由的服务端初始数据：草稿 + 已存储资源一次取齐，
 * 让首屏 HTML 直接包含可编辑内容，避免客户端拉取瀑布。
 *
 * 两个读取互不依赖（都只需要 resumeId + actor），并行发出以压缩 TTFB；
 * 任一失败时保持与串行版本相同的兜底语义。
 */
export async function loadEditorInitialData(
  resumeId: string,
  actor: Actor,
): Promise<EditorInitialData> {
  const repository = getResumeRepository()
  const assetService = new ResumeAssetService(repository, getResumeAssetStorage())
  const [resumeOutcome, storedAssets] = await Promise.all([
    new ResumeService(repository).getEditableResume(resumeId, actor).then(
      (
        resume,
      ): { ok: true; resume: EditableResume } | { ok: false; error: unknown } => ({
        ok: true,
        resume,
      }),
      (error: unknown): { ok: false; error: unknown } => ({ ok: false, error }),
    ),
    // 与客户端 loadResume 的兜底保持一致：资源列表不可用时沿用文档内资源。
    assetService
      .listAssets(resumeId, actor)
      .catch((): ResumeImageAsset[] | null => null),
  ])

  if (!resumeOutcome.ok) {
    const error = resumeOutcome.error
    return {
      resume: null,
      error:
        error instanceof DomainError
          ? error.code === "RESUME_NOT_FOUND"
            ? "该简历不存在，或当前登录账号没有它的编辑权限"
            : error.message
          : "简历加载失败，请稍后重试。",
    }
  }

  const baseResume = resumeOutcome.resume
  return {
    resume: {
      ...baseResume,
      document: mergeStoredAssets(
        baseResume.document,
        storedAssets ?? baseResume.document.resources.assets,
      ),
    },
    error: null,
  }
}
