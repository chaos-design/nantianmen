import { getResumeAssetStorage } from "../../../../../../server/assets/resume-asset-storage-factory"
import { buildImageVariant } from "../../../../../../server/assets/resume-image-variant"
import {
  getTestResumePolicy,
  requireAuthContext,
} from "../../../../../../server/auth/auth-context"
import { ResumeAssetService } from "../../../../../../server/domain/resume-asset-service"
import { apiError, getRequestId } from "../../../../../../server/http/api-response"
import {
  assetResponse,
  binaryAssetResponse,
} from "../../../../../../server/http/asset-response"
import { assertSameOrigin } from "../../../../../../server/http/request-origin"
import { getResumeRepository } from "../../../../../../server/repositories/repository-factory"
import { parseResumeImageWidth } from "../../../../../../shared/resume-image"

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
      getTestResumePolicy(),
    )
    const asset = await service.getPrivateAsset(
      params["resume-id"],
      params["asset-id"],
      actor,
    )
    // `?w=` 是放置图的显示尺寸档位：A4 上按 500×640 铺的原图有 50 kB 量级，
    // 慢网下它和样式表、脚本抢同一条管道，直接把首屏 LCP 拖到 5 秒。转成同尺寸
    // WebP 通常只剩三分之一。非法/越界档位一律回落到原图，绝不做「任意宽度缩放」。
    const width = parseResumeImageWidth(new URL(request.url).searchParams.get("w"))
    if (width) {
      const variant = await buildImageVariant(
        params["asset-id"],
        asset.bytes,
        asset.mimeType,
        width,
      )
      if (variant) {
        return binaryAssetResponse(
          variant.bytes,
          variant.mimeType,
          "private, max-age=3600",
        )
      }
    }
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
      getTestResumePolicy(),
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
