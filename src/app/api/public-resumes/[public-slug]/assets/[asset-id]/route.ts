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
    return assetResponse(asset, "public, max-age=3600, must-revalidate")
  } catch (error) {
    return apiError(error, requestId)
  }
}
