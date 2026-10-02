import { AiService, assertAiRateLimit } from "../../../../../server/ai/ai-service"
import { resolveAiClient } from "../../../../../server/ai/resolve-ai-client"
import { requireAuthContext } from "../../../../../server/auth/auth-context"
import {
  assertWritableActor,
  DomainError,
  ResumeService,
} from "../../../../../server/domain/resume-service"
import {
  apiError,
  apiSuccess,
  getRequestId,
} from "../../../../../server/http/api-response"
import { assertSameOrigin } from "../../../../../server/http/request-origin"
import { getResumeRepository } from "../../../../../server/repositories/repository-factory"
import { aiTaskSchema } from "../../../../../shared/resume-ai/resume-ai-contract"
import {
  parseResumeDocument,
  type ResumeDocument,
} from "../../../../../shared/resume-schema/resume-schema"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ "resume-id": string }>
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = getRequestId(request)
  try {
    assertSameOrigin(request)
    const actor = await requireAuthContext()
    assertWritableActor(actor)
    const params = await context.params
    const bodyResult = aiTaskSchema.safeParse(await request.json())
    if (!bodyResult.success) {
      throw new DomainError(
        "INVALID_AI_REQUEST",
        "AI 请求参数不合法",
        422,
        bodyResult.error.issues,
      )
    }

    const repository = getResumeRepository()
    const resumeService = new ResumeService(repository)
    await resumeService.getEditableResume(params["resume-id"], actor)

    const clientAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"
    assertAiRateLimit(`${actor.userId}:${params["resume-id"]}:${clientAddress}`)

    let document: ResumeDocument
    try {
      document = parseResumeDocument(bodyResult.data.document)
    } catch {
      throw new DomainError("INVALID_DOCUMENT", "AI 上下文不符合简历 Schema", 422)
    }

    const aiService = new AiService(
      repository,
      resolveAiClient(actor, bodyResult.data.providerConfig),
    )
    const result = await aiService.generate({
      resumeId: params["resume-id"],
      task: bodyResult.data.task,
      document,
      targetSectionId: bodyResult.data.targetSectionId,
      promptGuidance: bodyResult.data.promptGuidance,
    })
    return apiSuccess(result, requestId)
  } catch (error) {
    return apiError(error, requestId)
  }
}
