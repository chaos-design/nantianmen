import { resolveAiClient } from "../../../../server/ai/resolve-ai-client"
import { requireAuthContext } from "../../../../server/auth/auth-context"
import {
  assertWritableActor,
  DomainError,
} from "../../../../server/domain/resume-service"
import {
  apiError,
  apiSuccess,
  getRequestId,
} from "../../../../server/http/api-response"
import { assertSameOrigin } from "../../../../server/http/request-origin"
import { aiConnectionTestSchema } from "../../../../shared/resume-ai/resume-ai-contract"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    assertSameOrigin(request)
    const actor = await requireAuthContext()
    assertWritableActor(actor)
    const bodyResult = aiConnectionTestSchema.safeParse(await request.json())
    if (!bodyResult.success) {
      throw new DomainError(
        "AI_PROVIDER_CONFIG_INVALID",
        "大模型配置不合法，请检查后重试",
        422,
      )
    }
    const client = resolveAiClient(actor, bodyResult.data.providerConfig)
    const content = await client.complete([
      {
        role: "system",
        content: "只返回一个合法 JSON 对象，不要输出 Markdown。",
      },
      {
        role: "user",
        content: '返回 {"ok":true}。',
      },
    ])
    let output: unknown
    try {
      output = JSON.parse(content)
    } catch {
      throw new DomainError(
        "AI_OUTPUT_INVALID",
        "模型不支持有效的 JSON Object 输出",
        502,
      )
    }
    if (typeof output !== "object" || output === null || Array.isArray(output)) {
      throw new DomainError(
        "AI_OUTPUT_INVALID",
        "模型不支持有效的 JSON Object 输出",
        502,
      )
    }
    return apiSuccess(
      {
        ok: true,
        provider: client.modelName,
      },
      requestId,
    )
  } catch (error) {
    return apiError(error, requestId)
  }
}
