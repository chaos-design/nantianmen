import { requireAuthContext } from "../../../server/auth/auth-context"
import { ResumeService } from "../../../server/domain/resume-service"
import { apiError, apiSuccess, getRequestId } from "../../../server/http/api-response"
import { assertSameOrigin } from "../../../server/http/request-origin"
import { getResumeRepository } from "../../../server/repositories/repository-factory"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const actor = await requireAuthContext()
    const service = new ResumeService(getResumeRepository())
    const resumes = await service.listResumes(actor)
    return apiSuccess(resumes, requestId)
  } catch (error) {
    return apiError(error, requestId)
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    assertSameOrigin(request)
    const actor = await requireAuthContext()
    const body = (await request.json().catch(() => ({}))) as {
      initialDocument?: unknown
      templateId?: unknown
    }
    const service = new ResumeService(getResumeRepository())
    const result = await service.createResume(
      actor,
      body.initialDocument,
      body.templateId,
    )
    return apiSuccess(result, requestId, 201)
  } catch (error) {
    return apiError(error, requestId)
  }
}
