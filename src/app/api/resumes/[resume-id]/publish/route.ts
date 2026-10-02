import { requireAuthContext } from "../../../../../server/auth/auth-context"
import { ResumeService } from "../../../../../server/domain/resume-service"
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
    const service = new ResumeService(getResumeRepository())
    const result = await service.publishResume(params["resume-id"], actor)
    return apiSuccess(
      {
        publicationId: result.publication.id,
        publicationVersion: result.publication.publicationVersion,
        publishedAt: result.publication.publishedAt,
        publicSlug: result.resume.publicSlug,
        shareUrl: `/r/${result.resume.publicSlug}`,
      },
      requestId,
      201,
    )
  } catch (error) {
    return apiError(error, requestId)
  }
}
