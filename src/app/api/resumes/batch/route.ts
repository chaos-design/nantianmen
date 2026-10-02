import { requireAuthContext } from "../../../../server/auth/auth-context"
import { ResumeService } from "../../../../server/domain/resume-service"
import {
  apiError,
  apiSuccess,
  getRequestId,
} from "../../../../server/http/api-response"
import { assertSameOrigin } from "../../../../server/http/request-origin"
import { getResumeRepository } from "../../../../server/repositories/repository-factory"

export const runtime = "nodejs"

export async function DELETE(request: Request) {
  const requestId = getRequestId(request)
  try {
    assertSameOrigin(request)
    const actor = await requireAuthContext()
    const body = (await request.json().catch(() => ({}))) as {
      resumeIds?: unknown
    }
    const service = new ResumeService(getResumeRepository())
    const deletedCount = await service.deleteResumes(body.resumeIds, actor)
    return apiSuccess({ deletedCount }, requestId)
  } catch (error) {
    return apiError(error, requestId)
  }
}
