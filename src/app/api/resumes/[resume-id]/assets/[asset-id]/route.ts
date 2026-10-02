import { getResumeAssetStorage } from "../../../../../../server/assets/resume-asset-storage-factory"
import { requireAuthContext } from "../../../../../../server/auth/auth-context"
import { ResumeAssetService } from "../../../../../../server/domain/resume-asset-service"
import { apiError, getRequestId } from "../../../../../../server/http/api-response"
import { assetResponse } from "../../../../../../server/http/asset-response"
import { assertSameOrigin } from "../../../../../../server/http/request-origin"
import { getResumeRepository } from "../../../../../../server/repositories/repository-factory"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{
    "resume-id": string
    "asset-id": string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request)
  try {
    const actor = await requireAuthContext()
    const params = await context.params
    const service = new ResumeAssetService(
      getResumeRepository(),
      getResumeAssetStorage(),
    )
    const asset = await service.getPrivateAsset(
      params["resume-id"],
      params["asset-id"],
      actor,
    )
    return assetResponse(asset, "private, max-age=3600")
  } catch (error) {
    return apiError(error, requestId)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = getRequestId(request)
  try {
    assertSameOrigin(request)
    const actor = await requireAuthContext()
    const params = await context.params
    const service = new ResumeAssetService(
      getResumeRepository(),
      getResumeAssetStorage(),
    )
    await service.deleteAsset(params["resume-id"], params["asset-id"], actor)
    return new Response(null, {
      status: 204,
      headers: { "x-request-id": requestId },
    })
  } catch (error) {
    return apiError(error, requestId)
  }
}
