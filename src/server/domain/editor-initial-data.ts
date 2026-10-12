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
 */
export async function loadEditorInitialData(
  resumeId: string,
  actor: Actor,
): Promise<EditorInitialData> {
  const repository = getResumeRepository()
  let baseResume: EditableResume
  try {
    const service = new ResumeService(repository)
    baseResume = await service.getEditableResume(resumeId, actor)
  } catch (error) {
    return {
      resume: null,
      error:
        error instanceof DomainError ? error.message : "简历加载失败，请稍后重试。",
    }
  }

  let storedAssets: ResumeImageAsset[]
  try {
    const assetService = new ResumeAssetService(repository, getResumeAssetStorage())
    storedAssets = await assetService.listAssets(resumeId, actor)
  } catch {
    // 与客户端 loadResume 的兜底保持一致：资源列表不可用时沿用文档内资源。
    storedAssets = baseResume.document.resources.assets
  }

  return {
    resume: {
      ...baseResume,
      document: mergeStoredAssets(baseResume.document, storedAssets),
    },
    error: null,
  }
}
