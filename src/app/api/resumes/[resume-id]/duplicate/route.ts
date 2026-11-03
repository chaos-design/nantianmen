import { getResumeAssetStorage } from "../../../../../server/assets/resume-asset-storage-factory"
import {
  getTestResumePolicy,
  requireAuthContext,
} from "../../../../../server/auth/auth-context"
import { ResumeAssetService } from "../../../../../server/domain/resume-asset-service"
import {
  apiError,
  apiSuccess,
  getRequestId,
} from "../../../../../server/http/api-response"
import { assertSameOrigin } from "../../../../../server/http/request-origin"
import { getResumeRepository } from "../../../../../server/repositories/repository-factory"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ "resume-id": string }>
}

export async function POST(request: Request, context: RouteContext) {
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
    const result = await service.duplicateResume(params["resume-id"], actor)
    return apiSuccess(result, requestId, 201)
  } catch (error) {
    return apiError(error, requestId)
  }
}
