import { getResumeAssetStorage } from "../../../../../../server/assets/resume-asset-storage-factory"
import { ResumeAssetService } from "../../../../../../server/domain/resume-asset-service"
import { apiError, getRequestId } from "../../../../../../server/http/api-response"
import { assetResponse } from "../../../../../../server/http/asset-response"
import { getResumeRepository } from "../../../../../../server/repositories/repository-factory"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{
    "public-slug": string
    "asset-id": string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request)
  try {
    const params = await context.params
    const service = new ResumeAssetService(
      getResumeRepository(),
      getResumeAssetStorage(),
    )
    const asset = await service.getPublicAsset(
      params["public-slug"],
      params["asset-id"],
    )
    // 发布快照引用的资源内容不可变（上传即定稿，重新上传产生新 id），
    // 同 id 字节永不变；已发布的公开资源可以放心长期缓存。
    // 二次访问（招聘者重复打开分享页）直接命中浏览器缓存，不回源。
    return assetResponse(asset, "public, max-age=31536000, immutable")
  } catch (error) {
    return apiError(error, requestId)
  }
}
