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

interface RouteContext {
  params: Promise<{ "resume-id": string }>
}

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request)
  try {
    const actor = await requireAuthContext()
    const params = await context.params
    const service = new ResumeService(getResumeRepository())
    const resume = await service.getEditableResume(params["resume-id"], actor)
    return apiSuccess(resume, requestId)
  } catch (error) {
    return apiError(error, requestId)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getRequestId(request)
  try {
    assertSameOrigin(request)
    const actor = await requireAuthContext()
    const params = await context.params
    const body = (await request.json()) as {
      expectedVersion: number
      document: unknown
    }
    const service = new ResumeService(getResumeRepository())
    const resume = await service.saveDraft({
      resumeId: params["resume-id"],
      actor,
      expectedVersion: body.expectedVersion,
      document: body.document,
    })
    return apiSuccess(resume, requestId)
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
    const service = new ResumeService(getResumeRepository())
    await service.deleteResume(params["resume-id"], actor)
    return new Response(null, {
      status: 204,
      headers: { "x-request-id": requestId },
    })
  } catch (error) {
    return apiError(error, requestId)
  }
}
