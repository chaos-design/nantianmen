import { ResumeService } from "../../../../server/domain/resume-service"
import {
  apiError,
  apiSuccess,
  getRequestId,
} from "../../../../server/http/api-response"
import { getResumeRepository } from "../../../../server/repositories/repository-factory"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ "public-slug": string }>
}

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request)
  try {
    const params = await context.params
    const service = new ResumeService(getResumeRepository())
    const result = await service.getPublicResume(params["public-slug"])
    return apiSuccess(
      {
        title: result.resume.title,
        publicSlug: result.resume.publicSlug,
        publicationVersion: result.publication.publicationVersion,
        publishedAt: result.publication.publishedAt,
        document: result.publication.publishedDocument,
      },
      requestId,
    )
  } catch (error) {
    return apiError(error, requestId)
  }
}
